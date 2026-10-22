export function labStudies(data) {
  return [
    ...Object.values(data.horizons).flatMap(cohorts=>Object.values(cohorts)),
    ...Object.values(data.risk),
    ...Object.values(data.portfolioSelection).flatMap(cohorts=>Object.values(cohorts)),
  ];
}
export function validateLab(data) {
  if(data?.version!=='macro-transition-lab-4'||data.status!=='exploratory-retrospective')return false;
  const a=data.audit;
  if(a?.status!=='Independent source reconstruction passed'||a.checkedInputSha256!==data.inputSha256||
    a.checkedProtocolSha256!==data.protocolSha256||a.checkedRiskProtocolSha256!==data.riskProtocolSha256||
    a.checkedPolicyProtocolSha256!==data.policyProtocolSha256)return false;
  if(![data.inputSha256,data.protocolSha256,data.riskProtocolSha256,data.policyProtocolSha256].every(v=>/^[a-f0-9]{64}$/.test(v)))return false;
  try {
    const studies=labStudies(data),attempts=studies.reduce((n,s)=>n+(s.attempts?.length||0),0);
    return attempts===120&&data.attemptCount===attempts&&data.selectorProcedureCount===18&&
      a.attemptChecks===attempts&&a.predictionChecks>0&&a.selectionChecks>0&&a.policyChecks>0&&
      studies.every(s=>s.comparisons.every(c=>c.confirmedEdge===false));
  }catch{return false;}
}
export function labStudy(data,question,horizon,cohort='main') {
  if(question==='risk')return data.risk[horizon];
  return (question==='portfolio'?data.portfolioSelection:data.horizons)[horizon][cohort];
}
export function netWealth(rows) {
  let wealth=1;
  return [{month:rows[0]?.month,value:1},...rows.map(r=>({month:r.month,value:wealth*=1+r.return}))];
}
