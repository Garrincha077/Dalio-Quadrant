"""Fetch exact dated public issuer holdings; reject ignored as-of requests."""
import argparse
import concurrent.futures
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path
import pandas as pd

ROOT=Path(__file__).resolve().parents[2]
API='https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/api/v2/get-product-data?'
PARAMS={'appSubType':'ISHARES','appType':'PRODUCT_PAGE','locale':'en_US','portfolioId':'239456',
        'targetSite':'us-ishares','userType':'individual','excludeContent':'true','includeConfig':'true'}


def url(component,date=''):
    return API+urllib.parse.urlencode({**PARAMS,'component':component,'asOfDate':date})


def fetch_bytes(address):
    request=urllib.request.Request(address,headers={'Accept':'application/json','x-application-id':'pp-ui-csr'})
    with urllib.request.urlopen(request,timeout=45) as response:
        if 'json' not in response.headers.get('Content-Type',''):raise ValueError('Issuer returned a non-JSON page')
        return response.read()


def collect(prices,output,as_of):
    output.mkdir(parents=True,exist_ok=True)
    raw=pd.read_csv(prices);dates=pd.to_datetime(raw.timestamp)
    dates=sorted(dates[dates.dt.to_period('M')<pd.Period(as_of,freq='M')].dt.strftime('%Y-%m-%d'))
    manifest={'version':'ief-issuer-risk-1','asOf':as_of,'source':API,'fundId':239456,'productPage':'https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf',
        'scheduleSourceSha256':hashlib.sha256(prices.read_bytes()).hexdigest(),'snapshots':[],'unavailable':[],'failures':[]}
    def one(date):
        key=date.replace('-','');file=output/(date+'.json')
        try:
            if file.exists():body=file.read_bytes()
            else:body=fetch_bytes(url('holdings',key));file.write_bytes(body);time.sleep(.25)
            data=json.loads(body)
            if data.get('productId')!=239456:raise ValueError('Wrong fund identifier')
            fields=data['componentsByNameMap']['holdings']['containersByNameMap']['all']['dataPointsByNameMap']
            returned=str(fields.get('asOfDate',{}).get('value',''))
            if returned!=key:
                return 'unavailable',{'date':date,'returnedDate':returned,'reason':'Exact requested issuer as-of date unavailable.'}
            return 'snapshots',{'date':date,'sha256':hashlib.sha256(body).hexdigest()}
        except Exception as error:
            return 'failures',{'date':date,'reason':str(error)[:160]}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for index,(kind,row) in enumerate(pool.map(one,dates)):
            manifest[kind].append(row)
            if (index+1)%36==0:print(index+1,'requests processed',flush=True)
    performance=fetch_bytes(url('performance'));p=output/'performance.json';p.write_bytes(performance)
    manifest['performanceSha256']=hashlib.sha256(performance).hexdigest()
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print({k:len(manifest[k]) for k in ['snapshots','unavailable','failures']},flush=True)
    if manifest['failures']:raise ValueError('Resolve failed issuer requests before analysis')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prices',type=Path,default=ROOT/'work/research/prices/IEF.csv')
    parser.add_argument('--output',type=Path,default=ROOT/'work/research/ief-risk')
    parser.add_argument('--as-of',default='2026-10-26');a=parser.parse_args();collect(a.prices,a.output,a.as_of)
