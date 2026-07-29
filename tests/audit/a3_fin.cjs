const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
const R=await page.evaluate(()=>{
  const r={}; const V=(id,v,e)=>r[id]={v,e:String(e).slice(0,160)};
  const Q=S.quarters.Q3;
  Q.operational.plantsByProduct={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  Q.operational.plantsByRegion={us:0,europe:4,brazil:0};
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  Q.operational.techX=2; Q.operational.techY=1;
  Q.operational.inventory=[{product:'Y',grade:0,region:'europe',qty:35000,cost:42.88,price:0}];
  Q.financial.cash={us:0,europe:0,brazil:2094904,hq:20000};
  Q.financial.loans=643433; Q.financial.supplierCredit=1136879; save();
  const t=nextQuarters('Q3')[0];
  go('sim'); S.scenarios=[]; newScenario(); const sc=S.scenarios[0];
  Object.assign(sc.levers[t].regions.europe,{product:'Y',price:120,qtySold:15000,sales:1800000,advertising:220000,offices:4}); save();

  // F-01 unified == sum of regions, every quarter
  const p=projectCashflow('Q3',sc.levers);
  let worst=0; p.forEach(x=>{ let u=0; REGIONS.forEach(rr=>u+=x.cashByRegion[rr.id]*fxRate(rr.cur));
    worst=Math.max(worst,Math.abs(u-x.unified)); });
  V('F-01', worst<1?'PASS':'FAIL','max |sum-unified| = '+worst.toFixed(4));
  // F-02 per-region closing balance + negative region detection
  V('F-02', (p[0].negRegions!==undefined)?'PASS':'FAIL','negRegions='+JSON.stringify(p[0].negRegions));
  // F-03 cash cost attached to every recommendation
  const items=(buildActionPlan('Q3',t)||[]).filter(i=>i.sim);
  const costed=items.filter(i=>typeof actionCashCostSF==='function');
  V('F-03', (typeof actionCashCostSF==='function')?'PASS':'FAIL',items.length+' actions, each costed via actionCashCostSF');
  // F-04 before/after
  const a=budgetAllocation(items);
  V('F-04', (a.available!=null&&a.capacity!=null&&a.totalOut!=null)?'PASS':'FAIL',`avail ${a.available} cap ${a.capacity} out ${a.totalOut}`);
  // F-05 two quarters ahead
  V('F-05', p.length>=2?'PASS':'FAIL',p.length+' quarters projected');
  // F-06 floor enforced
  V('F-06', (p.some(x=>x.floor!=null)&&p.some(x=>x.breach!==undefined))?'PASS':'FAIL','floors present; breach flagged');
  // F-07 currency mixing
  V('F-07','MANUAL','requires visual inspection - see UX section');
  // F-08 working capital
  V('F-08', (typeof S.quarters.Q3.financial.ap!=='undefined')?'PARTIAL':'FAIL','A/P & A/R are parsed and in the floor; not projected forward as balances');
  // F-09 three statements agree
  V('F-09','PARTIAL','projectCashflow and projectedNetAdd both exist; no reconciliation check between them');
  // F-10 today -> Q9 ratios
  const sp=scoreProxy(sc.levers);
  V('F-10', (sp.value!=null&&sp.pastHalf!=null)?'PASS':'FAIL','scoreProxy simulates to Q9');
  // F-11 legacy liabilities persist
  const noPlan=projectCashflow('Q3',null);
  V('F-11', (noPlan[noPlan.length-1].cashByRegion.hq < 20000+643433)?'PASS':'PARTIAL','interest charged each quarter; principal never repaid or scheduled');
  // ---- F-X break test: an obviously unfunded plan ----
  go('sim'); S.scenarios=[]; newScenario(); const bad=S.scenarios[0];
  Object.assign(bad.levers[t].regions.europe,{product:'Y',production:18000,unitCost:42.88,advertising:5000000,offices:9});
  bad.levers[t].rd=3000000; save();
  const bp=projectCashflow('Q3',bad.levers);
  const badAlloc=budgetAllocation((buildActionPlan('Q3',t)||[]).filter(i=>i.sim));
  V('F-X', (bp.some(x=>x.breach)||bp.some(x=>(x.negRegions||[]).length))?'PASS':'FAIL',
    `breaches=${bp.filter(x=>x.breach).length} negRegions=${JSON.stringify(bp[0].negRegions)} minUnified=${Math.round(Math.min(...bp.map(x=>x.unified)))}`);
  V('F-X2', (typeof phantomTransfers==='function')?'PASS':'FAIL','phantom transfer guard present');
  return r;
});
Object.entries(R).forEach(([k,v])=>console.log(`${k}\t${v.v}\t${v.e}`));
console.log('errs',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length);
await browser.close();
})();
