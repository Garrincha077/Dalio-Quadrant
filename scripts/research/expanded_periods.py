"""Expand source/evaluation periods per asset; preserve the frozen model recipe."""
import argparse
import csv
import json
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import ROOT, digest
from learned_entry import MIN_TRAIN, HORIZONS, ages_at, enters, metrics, model_id
from rates_entry import (MarketDataset, RateSource, BASE_NAMES, STAGES, COHORTS,
                         fit, predict, rank_score, choose, compare, trailing_return)
from zscore_entry import trailing_z
from entry_opportunities import episode_indices, holm

VERSION='expanded-periods-1'
ERAS=[('1970–1989','1970-01','1990-01'),('1990–2007','1990-01','2008-01'),
      ('2008–2019','2008-01','2020-01'),('2020–2026','2020-01','2027-01')]


def load_histories(path,as_of):
    path=Path(path);meta=json.loads(path.read_text());prices={};dates={}
    if meta['version']!='per-asset-histories-1' or len(meta['assets']) not in (4,5):
        raise ValueError('Expected independently attributed asset histories')
    for name,source in meta['assets'].items():
        file=path.parent/source['prices']
        if digest(file)!=source['pricesSha256'] or source['currency']!='USD' or not source.get('sourceFileSha256'):
            raise ValueError('Independent price provenance mismatch')
        raw=pd.read_csv(file);dt=pd.to_datetime(raw.date,errors='raise');ix=pd.PeriodIndex(dt,freq='M')
        series=pd.Series(pd.to_numeric(raw.price,errors='raise').to_numpy(),index=ix)
        if ix.duplicated().any() or not ix.is_monotonic_increasing or (dt!=dt.dt.normalize()).any():
            raise ValueError('Need unique ordered monthly dated observations')
        if not np.isfinite(series).all() or (series<=0).any() or not ix.equals(pd.period_range(ix.min(),ix.max(),freq='M')):
            raise ValueError('Invalid price or interior gap; never bridge it')
        keep=ix<pd.Period(as_of,freq='M');series=series[keep]
        if source['priceStart']!=str(series.index.min()) or source['priceEnd']!=str(series.index.max()) or source['priceMonths']!=len(series):
            raise ValueError('Published source bounds differ from prices')
        prices[name]=series;dates[name]=dict(zip(ix[keep],dt[keep].dt.strftime('%Y-%m-%d')))
    calendar=pd.period_range(min(s.index.min() for s in prices.values()),max(s.index.max() for s in prices.values()),freq='M')
    return pd.DataFrame(prices,index=calendar),dates,meta


class IndependentDataset(MarketDataset):
    def __init__(self,manifest,information,as_of,vintages,rates,cohort):
        self.prices,self.asset_dates,self.metadata=load_histories(manifest,as_of)
        self.manifest=Path(manifest);self.assets=list(self.prices.columns)
        self.information,self.cohort,self.rates=information,cohort,rates
        self.feature_names=BASE_NAMES+['nominal10Y']+(['real10Y'] if cohort=='real' else [])+['trend12']
        self.input_count=len(self.feature_names)
        self.vintage_dir=Path(vintages);self.vintage_manifest=json.loads((self.vintage_dir/'manifest.json').read_text())
        self.snapshot_hashes={r['cutoff']:r['sha256'] for r in self.vintage_manifest['snapshots']}
        raw=json.loads((ROOT/'data/state-forward.json').read_text())
        self.revised={pd.Period(p['month'],freq='M'):(p['activity'],p['inflation']) for p in raw['points']}
        self.schedule={pd.Period(r['entryMonth'],freq='M'):r for r in json.loads(Path(__file__).with_name('state-vintage-schedule.json').read_text())}
        self.frames,self.prepared={},{}
        self.price_features={(a,m):trailing_z(self.prices[a],m,36) for a in self.assets for m in self.prices.index}
        self.trends={(a,m):trailing_return(self.prices[a],m) for a in self.assets for m in self.prices.index}

    def x(self,entry,asset):
        if entry not in self.asset_dates[asset]:return None
        if self.information=='vintage' and self.metadata['panel']=='etf':
            row=self.schedule.get(entry)
            if row is None:return None
            if row['tradeDate']!=self.asset_dates[asset][entry]:
                raise ValueError('Actual ETF close date differs from archived information cutoff schedule')
        return super().x(entry,asset)

    def outcome(self,entry,horizon,asset):
        block=self.prices[asset].reindex(pd.period_range(entry,entry+horizon,freq='M')).to_numpy(dtype=float)
        if not np.isfinite(block).all() or (block<=0).any():return None
        return float(block[-1]/block[0]*.999/1.001-1)


def point(records,stage):
    selected=[r for r in records if r['policies'][stage]['enter']]
    clock=[{'reference':r['entry']} for r in records]
    mask=np.array([r['policies'][stage]['enter'] for r in records],dtype=bool)
    usual=float(np.mean([r['actual'] for r in records])) if records else None
    mean=float(np.mean([r['actual'] for r in selected])) if selected else None
    return {'nScored':len(records),'selectedStarts':len(selected),'episodes':len(episode_indices(clock,mask)),
            'usualMean':usual,'mean':mean,'lift':mean-usual if mean is not None else None}


def previous_records(panel,target):
    refs={f['refitMonth'][:4]:f for f in target['refits']};rows=[]
    for r in target['forecasts']:
        policies={}
        for stage in STAGES:
            model=panel['models'][refs[r['entry'][:4]]['models'][stage]];score=float(predict(model,r['x'])[0])
            policies[stage]={'enter':bool(enters(score,model['threshold']))}
        rows.append({**r,'policies':policies})
    return rows


def period_comparison(records,old_panel,old_target):
    older=previous_records(old_panel,old_target);old_map={r['entry']:r for r in older};new_map={r['entry']:r for r in records}
    shared=sorted(set(old_map)&set(new_map));old_first=older[0]['entry'] if older else None;old_last=older[-1]['entry'] if older else None
    earlier=[r for r in records if old_first is not None and r['entry']<old_first]
    later=[r for r in records if old_last is not None and r['entry']>old_last]
    return {'previousScored':len(older),'expandedScored':len(records),'additionalScored':len(records)-len(older),
            'previousFirst':old_first,'previousLast':old_last,'commonDates':len(shared),
            'commonFirst':shared[0] if shared else None,'commonLast':shared[-1] if shared else None,
            'commonOriginal':{s:point([old_map[m] for m in shared],s) for s in STAGES},
            'commonExpanded':{s:point([new_map[m] for m in shared],s) for s in STAGES},
            'earlierAdded':{s:point(earlier,s) for s in STAGES},'laterAdded':{s:point(later,s) for s in STAGES}}


def run(dataset,panel_name,draws,old_panel):
    models,targets={},[]
    for h in HORIZONS:
        for asset in dataset.assets:
            records,refits=[],[]
            # No arbitrary outer-start floor; missing features/matured labels govern eligibility.
            for year in range(max(1967,dataset.prices.index.min().year),dataset.prices.index.max().year+1):
                refit=pd.Period(year=year,month=1,freq='M');rows,x,y=dataset.train(refit,h,asset)
                if len(y)<MIN_TRAIN:continue
                choices,trace=choose(dataset,refit,h,asset);refs={}
                for stage in STAGES:
                    model=fit(x,y,ages_at(rows,refit),choices[stage])
                    model.update({'refitMonth':str(refit),'asset':asset,'horizon':h,'cohort':dataset.cohort,
                        'information':dataset.information,'vintageCutoff':dataset.vintage_cutoff(refit),
                        'firstTrainingEntry':str(rows[0]),'lastTrainingExit':str(rows[-1]+h),'history':'independent-expanded'})
                    key=model_id(model);models[key]=model;refs[stage]=key
                before=len(records)
                for entry in pd.period_range(refit,refit+11,freq='M'):
                    tx,actual=dataset.x(entry,asset),dataset.outcome(entry,h,asset)
                    if tx is None or actual is None:continue
                    policies={}
                    for stage in STAGES:
                        model=models[refs[stage]];value=float(predict(model,tx)[0])
                        policies[stage]={'score':value,'baseline':model['baseline'],'enter':bool(enters(value,model['threshold']))}
                    records.append({'entry':str(entry),'exit':str(entry+h),'x':tx.tolist(),'actual':actual,'policies':policies})
                refits.append({'refitMonth':str(refit),'models':refs,'scoredEntries':len(records)-before,**trace})
            results={s:metrics(records,s,h,draws) for s in STAGES};extra={}
            for left,right in [('rates','base'),('trend','rates'),('trend','base')]:
                value=compare(records,left,right,h,draws)
                value.update({'left':left,'right':right,'supported':results[left].get('supported',False) and results[right].get('supported',False)})
                extra[left+'-'+right]=value
            old_target=next(t for t in old_panel['targets'] if t['asset']==asset and t['horizon']==h)
            source=dataset.metadata['assets'][asset]
            targets.append({'asset':asset,'horizon':h,'results':results,'incremental':extra,'refits':refits,
                'inputStart':source['priceStart'],'inputEnd':source['priceEnd'],
                'periodComparison':period_comparison(records,old_panel,old_target),
                'eras':[{'label':label,'start':start,'endExclusive':end,
                         'results':{s:point([r for r in records if start<=r['entry']<end],s) for s in STAGES}}
                        for label,start,end in ERAS],
                'forecasts':[{k:r[k] for k in ('entry','exit','x','actual')} for r in records]})
            print(panel_name,dataset.information,dataset.cohort,asset,h,len(records),records[0]['entry'] if records else None,flush=True)
    return {'panel':panel_name,'information':dataset.information,'cohort':dataset.cohort,
        'priceStart':str(dataset.prices.index.min()),'priceEnd':str(dataset.prices.index.max()),
        'features':dataset.feature_names,'assets':dataset.metadata['assets'],
        'sourceHashes':{'manifest':digest(dataset.manifest),
                        'macroVintages':digest(dataset.vintage_dir/'manifest.json') if dataset.information=='vintage' else None},
        'models':models,'targets':targets}


def build(args):
    rates=RateSource(args.rates,args.as_of);old=json.loads((ROOT/'data/rates-entry.json').read_text())
    report={'version':VERSION,'asOf':args.as_of,'horizons':list(HORIZONS),'stages':list(STAGES),'cohorts':list(COHORTS),
        'bootstrapDraws':args.draws,'builderSha256':digest(__file__),
        'preparationSha256':digest(Path(__file__).with_name('prepare_period_histories.py')),
        'protocolSha256':digest(Path(__file__).with_name('expanded-periods-protocol.md')),
        'dependencies':{p:digest(Path(__file__).with_name(p)) for p in ('rates_entry.py','learned_entry.py','zscore_entry.py','extended_state.py','entry_opportunities.py','prepare_extended_long.py')},
        'stateSourceSha256':digest(ROOT/'data/state-forward.json'),'previousStudySha256':digest(ROOT/'data/rates-entry.json'),
        'rateCollection':{**rates.manifest,'manifestSha256':digest(Path(args.rates)/'manifest.json')},
        'spyCrossCheck':json.loads((Path(args.histories)/'spy-crosscheck.json').read_text()),
        'limitations':['Independent asset histories; cross-asset averages need not share evaluation dates.',
          'Revised economic history begins May 1967; actual macro archives begin May 2011.',
          'No invented pre-2003 actual real yields or pre-1973 free-floating gold training history.',
          'Shared-calendar comparisons can differ because of longer training and SPY provider history.',
          'Long reconstructed bonds and monthly-average gold are not executable closes.',
          'Previously researched periods; descriptive era summaries are not new validated strategies.'], 'panels':[]}
    for info in args.information:
        for panel in ['long','etf']:
            for cohort in COHORTS:
                dataset=IndependentDataset(Path(args.histories)/(panel+'-manifest.json'),info,args.as_of,args.vintages,rates,cohort)
                previous=next(p for p in old['panels'] if p['panel']==panel and p['information']==info and p['cohort']==cohort)
                report['panels'].append(run(dataset,panel,args.draws,previous))
    for info in args.information:
        for panel in ['long','etf']:
            rows=[r for p in report['panels'] if p['panel']==panel and p['information']==info
                  for t in p['targets'] for section in ['results','incremental'] for r in t[section].values()]
            for row,value in zip(rows,holm([r.get('bootstrapP') if r.get('supported') else None for r in rows])):row['holmP']=value
    output=Path(args.output);output.write_text(json.dumps(report,separators=(',',':'),allow_nan=False)+'\n')
    with output.with_suffix('.csv').open('w',newline='') as f:
        fields=['panel','information','cohort','asset','horizon','entry','exit','nominal10Y','real10Y','trend12','priceZ36','actual','stage','score','trainingRank','enter','model']
        writer=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');writer.writeheader()
        for p in report['panels']:
            for t in p['targets']:
                refs={r['refitMonth'][:4]:r for r in t['refits']}
                for row in t['forecasts']:
                    for stage in STAGES:
                        key=refs[row['entry'][:4]]['models'][stage];model=p['models'][key];score=float(predict(model,row['x'])[0])
                        writer.writerow({'panel':p['panel'],'information':p['information'],'cohort':p['cohort'],'asset':t['asset'],
                            'horizon':t['horizon'],'entry':row['entry'],'exit':row['exit'],'nominal10Y':row['x'][5],
                            'real10Y':row['x'][6] if p['cohort']=='real' else None,'trend12':row['x'][-1],
                            'priceZ36':row['x'][4],'actual':row['actual'],'stage':stage,'score':score,'trainingRank':rank_score(model,score),
                            'enter':bool(enters(score,model['threshold'])),'model':key})
    print('Wrote',output,flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--histories',default=str(ROOT/'work/research/periods'))
    parser.add_argument('--rates',default=str(ROOT/'work/research/rate-vintages'))
    parser.add_argument('--vintages',default=str(ROOT/'work/research/state-vintages'))
    parser.add_argument('--information',nargs='+',choices=['revised','vintage'],default=['revised','vintage'])
    parser.add_argument('--as-of',default='2026-10-26');parser.add_argument('--draws',type=int,default=5000)
    parser.add_argument('--output',default=str(ROOT/'data/expanded-periods.json'));build(parser.parse_args())
