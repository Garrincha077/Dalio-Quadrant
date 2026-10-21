"""Immutable pre-execution forecast ledger. Backfills cannot become live records."""
import copy
import hashlib
import json
from pathlib import Path


def append_forecast(ledger, record, recorded_at):
    required = ['model','cutoff','tradeDate','executionAt','horizon','protocolSha256','inputSha256','modelArtifactSha256','ranking']
    if any(k not in record for k in required): raise ValueError('Incomplete forecast provenance')
    if record['horizon'] not in [3,12,36]: raise ValueError('Unsupported horizon')
    import datetime, re
    recorded = datetime.datetime.fromisoformat(recorded_at.replace('Z','+00:00'))
    execution = datetime.datetime.fromisoformat(record['executionAt'].replace('Z','+00:00'))
    cutoff = datetime.datetime.fromisoformat(record['cutoff']+'T23:59:59+00:00')
    if not recorded.tzinfo or not execution.tzinfo or not cutoff <= recorded < execution or record['executionAt'][:10] != record['tradeDate']:
        raise ValueError('A forward forecast must be recorded after its cutoff and before execution')
    if record['cutoff'] != (datetime.date.fromisoformat(record['tradeDate']) - datetime.timedelta(days=1)).isoformat():
        raise ValueError('Forecast cutoff must be the day before the planned execution')
    if any(not re.fullmatch(r'[a-f0-9]{64}',record[k]) for k in ['protocolSha256','inputSha256','modelArtifactSha256']):
        raise ValueError('Invalid provenance hash')
    if len(record['ranking']) != 5 or len(set(record['ranking'])) != 5:
        raise ValueError('Ranking must contain five distinct assets')
    if set(record['ranking']) != {'SPY','IEF','GLD','TIP','DBC'}: raise ValueError('Unexpected asset')
    result = copy.deepcopy(ledger)
    forecast = copy.deepcopy(record)
    forecast['recordedAt'] = recorded_at
    forecast['status'] = 'forward-tracking'
    forecast['id'] = hashlib.sha256(json.dumps(forecast,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    # One immutable decision per model/protocol/horizon/trading date.
    existing = next((r for r in result['forecasts'] if all(r[k]==record[k] for k in ['model','protocolSha256','horizon','tradeDate'])),None)
    if existing:
        if all(existing[k]==record[k] for k in required): return result
        raise ValueError('An existing forward forecast cannot be rewritten')
    result['forecasts'].append(forecast)
    result['status'] = 'forward-tracking'
    return result


def append_outcome(ledger, forecast_id, outcome, recorded_at):
    result=copy.deepcopy(ledger)
    record=next((r for r in result['forecasts'] if r['id']==forecast_id),None)
    if record is None: raise ValueError('Unknown forecast')
    import pandas as pd
    maturity=(pd.Period(record['tradeDate'][:7],freq='M')+record['horizon']).end_time.strftime('%Y-%m-%d')
    if recorded_at[:10]<=maturity: raise ValueError('Outcome has not matured')
    if set(outcome) != {'SPY','IEF','GLD','TIP','DBC'}: raise ValueError('Incomplete outcome')
    import math
    if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in outcome.values()): raise ValueError('Invalid outcome')
    existing=next((r for r in result['outcomes'] if r['forecastId']==forecast_id),None)
    value={'forecastId':forecast_id,'recordedAt':recorded_at,'returns':copy.deepcopy(outcome)}
    if existing:
        if existing['returns']==value['returns']: return result
        raise ValueError('An existing outcome cannot be rewritten')
    result['outcomes'].append(value)
    return result


def research_record(path, model, horizon, trade_date, execution_at):
    data=json.loads(Path(path).read_text())
    rows=data['horizons'][str(horizon)]['forecastRows']
    row=next((r for r in rows if r['tradeDate']==trade_date),None)
    if row is None: raise ValueError('No estimate for planned execution; acquire the known cutoff and rebuild first')
    predictions=row['predictions'].get(model)
    import math
    if not predictions or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in predictions):
        raise ValueError('Model estimate is unavailable')
    ranking=sorted(zip(data['assets'],predictions),key=lambda p:(-p[1],p[0]))
    return {'model':model,'cutoff':row['cutoff'],'tradeDate':trade_date,'executionAt':execution_at,
        'horizon':horizon,'protocolSha256':data['protocolSha256'],'inputSha256':data['sources']['featureSha256'],
        'modelArtifactSha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),
        'ranking':[a for a,_ in ranking], 'estimates':dict(zip(data['assets'],predictions))}


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('record',nargs='?',help='Private JSON with record or outcome; never accepts backfilled live forecasts')
    parser.add_argument('--from-research',help='Build a record from an actual generated research artifact')
    parser.add_argument('--model',default='combined')
    parser.add_argument('--horizon',type=int,choices=[3,12,36],default=12)
    parser.add_argument('--trade-date')
    parser.add_argument('--execution-at')
    parser.add_argument('--ledger',default=str(Path(__file__).resolve().parents[3]/'data/forecast-ledger.json'))
    args=parser.parse_args()
    import datetime
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    path=Path(args.ledger)
    ledger=json.loads(path.read_text())
    if args.from_research:
        if not args.trade_date or not args.execution_at: parser.error('Planned trade date and execution timestamp are required')
        value=research_record(args.from_research,args.model,args.horizon,args.trade_date,args.execution_at)
    elif args.record:
        value=json.loads(Path(args.record).read_text())
    else: parser.error('Supply a record or --from-research')
    updated=append_outcome(ledger,value['forecastId'],value['returns'],now) if 'forecastId' in value else append_forecast(ledger,value,now)
    path.write_text(json.dumps(updated,indent=2))
    print('Ledger verified and saved; original forecasts preserved.')
