"""Fixed US-only bond rules with exact-date issuer risk and NAV sensitivity."""
import argparse
import csv
import json
from pathlib import Path
import numpy as np
import pandas as pd
from extended_state import ROOT,digest
from learned_entry import Dataset,feature,HORIZONS
from entry_opportunities import bootstrap,episode_indices,nonoverlap_count,holm
from rates_entry import compare

VERSION='observed-us-bonds-1'
RULES=('carry','disinflation','weak')
MODES=('complete60','observed48')
EPS=1e-9
SEGMENTS=[('Earlier / through 2015','2000-01','2016-01'),('2016–2019','2016-01','2020-01'),('2020–2026','2020-01','2027-01')]


def sleeve_risk(raw,requested):
    if raw.get('productId')!=239456:raise ValueError('Wrong issuer fund')
    fields=raw['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']
    if str(fields['asOfDate']['value'])!=requested.replace('-',''):raise ValueError('Ignored historical as-of date')
    keys=['holdingPercent','assetClass','cusip','duration','yieldToMaturity']
    values={k:fields[k]['value'] for k in keys};n=len(values['holdingPercent'])
    if any(not isinstance(v,list) or len(v)!=n for v in values.values()):raise ValueError('Misaligned issuer security fields')
    weights=np.array(values['holdingPercent'],dtype=float)
    if not np.isfinite(weights).all() or not 95<=weights.sum()<=105:raise ValueError('Invalid reported net fund weight')
    eligible=[i for i in range(n) if weights[i]>0 and values['assetClass'][i]=='Fixed Income' and str(values['cusip'][i]).startswith('912')]
    total=float(weights[eligible].sum())
    if not 95<=total<=105:raise ValueError('Insufficient eligible Treasury exposure')
    good=[]
    for i in eligible:
        d,y=values['duration'][i],values['yieldToMaturity'][i]
        if d is not None and y is not None and np.isfinite([d,y]).all() and d>0:good.append(i)
    covered=float(weights[good].sum())
    if covered<.99*total:raise ValueError('Missing Treasury yield/duration exceeds one percent')
    y=float(np.average([values['yieldToMaturity'][i] for i in good],weights=weights[good]))
    d=float(np.average([values['duration'][i] for i in good],weights=weights[good]))
    return {'date':requested,'month':requested[:7],'ytm':y,'duration':d,'cushion':y/d,
            'treasuryWeight':total,'netReportedWeight':float(weights.sum()),'riskCoverage':covered/total,
            'positiveTreasurySecurities':len(eligible),'validRiskSecurities':len(good)}


def reference_at(risks,entry,mode):
    current=entry-2
    if current not in risks:return None
    months=pd.period_range(current-60,current-1,freq='M')
    if months[0]<min(risks):return None
    values=[risks.get(m) for m in months];count=sum(v is not None for v in values)
    gap=longest=0
    for v in values:
        gap=gap+1 if v is None else 0;longest=max(longest,gap)
    if (mode=='complete60' and count!=60) or (mode=='observed48' and (count<48 or longest>6)):return None
    return {**risks[current],'referenceFirst':str(months[0]),'referenceLast':str(months[-1]),
            'referenceCount':count,'referenceMaxGap':longest,
            'medianCushion':float(np.median([v['cushion'] for v in values if v is not None]))}


def masks_at(risk,macro):
    carry=risk['cushion']>risk['medianCushion']+EPS
    disinflation=carry and macro[3]<-.2-EPS
    return {'carry':bool(carry),'disinflation':bool(disinflation),'weak':bool(disinflation and macro[0]<-EPS)}


class Macro(Dataset):
    def __init__(self,information,vintages):
        self.information=information;self.vintage_dir=Path(vintages)
        self.vintage_manifest=json.loads((self.vintage_dir/'manifest.json').read_text())
        self.snapshot_hashes={s['cutoff']:s['sha256'] for s in self.vintage_manifest['snapshots']}
        self.frames={}
        self.schedule={pd.Period(r['entryMonth'],freq='M'):r for r in json.loads(Path(__file__).with_name('state-vintage-schedule.json').read_text())}
        self.revised={pd.Period(r['month'],freq='M'):(r['activity'],r['inflation']) for r in json.loads((ROOT/'data/state-forward.json').read_text())['points']}


def outcome(series,entry,horizon):
    part=series.reindex(pd.period_range(entry,entry+horizon,freq='M')).to_numpy(dtype=float)
    if not np.isfinite(part).all() or (part<=0).any():return None
    return float(part[-1]/part[0]*.999/1.001-1)


def point(records,rule):
    y=np.array([r['actual'] for r in records]);selected=np.array([r['policies'][rule]['enter'] for r in records],dtype=bool)
    clock=[{'entry':r['entry'],'reference':r['entry']} for r in records]
    result={'nScored':len(records),'selectedStarts':int(selected.sum()),'coverage':float(selected.mean()) if len(records) else None,
      'episodes':len(episode_indices(clock,selected)),'nonoverlappingStarts':nonoverlap_count(clock,selected,records[0]['horizon']) if records else 0,
      'usualMean':float(y.mean()) if len(y) else None,'mean':float(y[selected].mean()) if selected.any() else None,
      'lift':float(y[selected].mean()-y.mean()) if selected.any() else None}
    result['supported']=result['selectedStarts']>=24 and result['episodes']>=6
    if selected.any():result.update({'median':float(np.median(y[selected])),'p10':float(np.quantile(y[selected],.1)),
        'lossFrequency':float((y[selected]<0).mean()),'stress25bpLift':float((y[selected].mean()-y.mean())*(.9975/1.0025)/(.999/1.001))})
    return result


def results_at(records,horizon,draws):
    results={rule:{**point(records,rule),'liftCI95':None,'bootstrapP':None} for rule in RULES}
    nonempty=[s for s in RULES if results[s]['selectedStarts']]
    if records and nonempty:
        clock=[{'entry':r['entry']} for r in records];y=np.array([r['actual'] for r in records])[:,None]
        masks=np.array([[r['policies'][s]['enter'] for s in nonempty] for r in records],dtype=float)
        boot=bootstrap(clock,y,masks,horizon,draws)
        for i,s in enumerate(nonempty):results[s].update(boot[0,i])
    return results


def diagnostic(row,risks):
    if row['horizon']!=12:return None
    start=risks.get(pd.Period(row['entry'],freq='M'));end=risks.get(pd.Period(row['exit'],freq='M'))
    if start is None or end is None:return None
    carry=start['ytm']/100;shock=-start['duration']*(end['ytm']-start['ytm'])/100
    gross=(1+row['actual'])*1.001/.999-1
    return {'entryRiskDate':start['date'],'exitRiskDate':end['date'],'carry':carry,'durationShock':shock,
            'approximateReturn':carry+shock,'actualBeforeEntryExitCost':gross,'residual':gross-carry-shock}


def load_inputs(folder,prices,as_of):
    folder=Path(folder);manifest=json.loads((folder/'manifest.json').read_text())
    if manifest['version']!='ief-issuer-risk-1' or manifest['failures'] or manifest['asOf']!=as_of:raise ValueError('Incomplete issuer collection')
    if manifest['scheduleSourceSha256']!=digest(prices):raise ValueError('Issuer schedule/price source mismatch')
    risks={};bad=[]
    for row in manifest['snapshots']:
        path=folder/(row['date']+'.json')
        if digest(path)!=row['sha256']:raise ValueError('Issuer file hash mismatch')
        try:
            risk=sleeve_risk(json.loads(path.read_text()),row['date']);month=pd.Period(risk['month'],freq='M')
            if month in risks:raise ValueError('Duplicate issuer risk month')
            risks[month]=risk
        except ValueError as error:bad.append({'date':row['date'],'reason':str(error)})
    raw=pd.read_csv(prices);dates=pd.to_datetime(raw.timestamp);ix=pd.PeriodIndex(dates,freq='M')
    if ix.duplicated().any():raise ValueError('Duplicate market month')
    market=pd.Series(pd.to_numeric(raw['adjusted close']).to_numpy(),index=ix).sort_index()
    market=market[market.index<pd.Period(as_of,freq='M')]
    if not np.isfinite(market).all() or (market<=0).any() or not market.index.equals(pd.period_range(market.index.min(),market.index.max(),freq='M')):raise ValueError('Incomplete adjusted market returns')
    path=folder/'performance.json'
    if digest(path)!=manifest['performanceSha256']:raise ValueError('Issuer performance hash mismatch')
    perf=json.loads(path.read_text())
    if perf['productId']!=239456:raise ValueError('Wrong NAV fund')
    chart=perf['componentsByNameMap']['performance']['containersByNameMap']['chart']
    if chart['properties']['chartType']!='MONTHLY_PERFORMANCE':raise ValueError('Wrong performance-series meaning')
    series=chart['dataPointsByNameMap']['performanceData'];d=series['asOfDate'];v=series['value']
    if len(d)!=len(v):raise ValueError('Misaligned issuer NAV series')
    nav=pd.Series(np.array(v,dtype=float),index=pd.PeriodIndex(pd.to_datetime([str(x) for x in d],format='%Y%m%d'),freq='M'))
    if nav.index.duplicated().any() or not np.isfinite(nav).all() or (nav<=0).any():raise ValueError('Invalid issuer NAV returns')
    nav=nav.reindex(market.index)
    if nav.isna().any():raise ValueError('NAV sensitivity must cover the same observed ETF months')
    delta=(market.pct_change()-nav.pct_change()).dropna().abs()*10000
    quality={'collectionManifestSha256':digest(folder/'manifest.json'),'exactSnapshots':len(manifest['snapshots']),
      'unavailableDates':len(manifest['unavailable']),'riskValidMonths':len(risks),'invalidRisk':bad,
      'firstRisk':str(min(risks)),'lastRisk':str(max(risks)),
      'firstPrice':str(market.index.min()),'lastPrice':str(market.index.max()),
      'navMarketComparison':{'months':len(delta),'medianDifferenceBps':float(delta.median()),'maxDifferenceBps':float(delta.max())},
      'riskRows':[risks[m] for m in sorted(risks)],'sourceManifest':manifest}
    return risks,{'market':market,'nav':nav},quality


def build(args):
    risks,bases,quality=load_inputs(Path(args.issuer),Path(args.prices),args.as_of)
    report={'version':VERSION,'asOf':args.as_of,'scope':'United States / IEF only','rules':list(RULES),'referenceModes':list(MODES),
      'returnBases':['market','nav'],'horizons':list(HORIZONS),'bootstrapDraws':args.draws,'builderSha256':digest(__file__),
      'protocolSha256':digest(Path(__file__).with_name('observed-us-bonds-protocol.md')),
      'collectorSha256':digest(Path(__file__).with_name('fetch-ief-risk-history.py')),
      'dependencies':{p:digest(Path(__file__).with_name(p)) for p in ['learned_entry.py','rates_entry.py','entry_opportunities.py']},
      'stateSourceSha256':digest(ROOT/'data/state-forward.json'),'priceSourceSha256':digest(args.prices),
      'macroManifestSha256':digest(Path(args.vintages)/'manifest.json'),
      'quality':quality,'targets':[],'limitations':[
       'Dated issuer reconstructions retrieved now; original publication timestamps are not independently captured.',
       'Two-month risk lag is a publication-buffer assumption, not proof of fully point-in-time holdings.',
       'Treasury-sleeve weighted risk is not an official whole-fund SEC yield/duration.',
       'Fixed new rules, but previously inspected dates; retrospective exploratory evaluation.',
       'Carry/duration diagnostic uses future yields only ex post; it is not a forecast.']}
    for info in ['revised','vintage']:
        macro=Macro(info,args.vintages)
        for mode in MODES:
            for basis,prices in bases.items():
                for h in HORIZONS:
                    rows=[]
                    for entry in prices.index:
                        risk=reference_at(risks,entry,mode)
                        if risk is None:continue
                        frame=macro.frame(entry);x=feature(frame,entry-2) if frame is not None else None
                        actual=outcome(prices,entry,h)
                        if x is None or actual is None:continue
                        policies={k:{'enter':v} for k,v in masks_at(risk,x).items()}
                        row={'entry':str(entry),'exit':str(entry+h),'horizon':h,'macroReference':str(entry-2),
                          'macroVintageCutoff':macro.vintage_cutoff(entry),'macro':x.tolist(),'risk':risk,
                          'actual':actual,'policies':policies}
                        row['diagnostic']=diagnostic(row,risks);rows.append(row)
                    results=results_at(rows,h,args.draws);pairs={}
                    for left,right in [('disinflation','carry'),('weak','disinflation')]:
                        pair=compare(rows,left,right,h,args.draws);pair.update({'left':left,'right':right,
                          'supported':results[left]['supported'] and results[right]['supported']});pairs[left+'-'+right]=pair
                    segments=[{'label':label,'start':start,'endExclusive':end,
                      'results':{s:point([r for r in rows if start<=r['entry']<end],s) for s in RULES}} for label,start,end in SEGMENTS]
                    report['targets'].append({'information':info,'referenceMode':mode,'returnBasis':basis,'horizon':h,
                        'firstEntry':rows[0]['entry'] if rows else None,'lastEntry':rows[-1]['entry'] if rows else None,
                        'results':results,'incremental':pairs,'segments':segments,'records':rows})
                    print(info,mode,basis,h,len(rows),flush=True)
    for info in ['revised','vintage']:
        values=[v for t in report['targets'] if t['information']==info for section in ['results','incremental'] for v in t[section].values()]
        for v,p in zip(values,holm([v.get('bootstrapP') if v['supported'] else None for v in values])):v['holmP']=p
    output=Path(args.output);output.write_text(json.dumps(report,separators=(',',':'),allow_nan=False)+'\n')
    with output.with_suffix('.csv').open('w',newline='') as f:
        fields=['information','referenceMode','returnBasis','horizon','entry','exit','riskDate','ytm','duration','cushion','medianCushion','referenceCount','activity','inflation','deltaActivity','deltaInflation','actual','rule','selected']
        writer=csv.DictWriter(f,fieldnames=fields,lineterminator='\n');writer.writeheader()
        for t in report['targets']:
            for row in t['records']:
                for rule in RULES:
                    writer.writerow({'information':t['information'],'referenceMode':t['referenceMode'],'returnBasis':t['returnBasis'],
                      'horizon':t['horizon'],'entry':row['entry'],'exit':row['exit'],'riskDate':row['risk']['date'],
                      **{k:row['risk'][k] for k in ['ytm','duration','cushion','medianCushion','referenceCount']},
                      **dict(zip(['activity','inflation','deltaActivity','deltaInflation'],row['macro'])),
                      'actual':row['actual'],'rule':rule,'selected':row['policies'][rule]['enter']})
    print('Wrote',output,flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--issuer',default=str(ROOT/'work/research/ief-risk'))
    parser.add_argument('--prices',default=str(ROOT/'work/research/prices/IEF.csv'))
    parser.add_argument('--vintages',default=str(ROOT/'work/research/state-vintages'))
    parser.add_argument('--as-of',default='2026-10-26');parser.add_argument('--draws',type=int,default=5000)
    parser.add_argument('--output',default=str(ROOT/'data/observed-us-bonds.json'));build(parser.parse_args())
