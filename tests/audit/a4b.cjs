const {open}=require('../lib.cjs');
const snap=(page)=>page.evaluate(()=>{
  const t=nextQuarters(S.activeQuarter)[0];
  const rec=recommendGoals(), mp=masterPlanStatus();
  const items=(buildActionPlan(S.activeQuarter,t)||[]);
  const nums=items.filter(i=>i.sim).map(i=>{ const s=i.sim; let v=[];
    Object.entries(s.regions||{}).forEach(([rid,gg])=>{ ['production','price','qtySold','advertising','invest','offices'].forEach(k=>{ if(gg[k]) v.push(rid+'.'+k+'='+gg[k]); }); });
    if(s.rd) v.push('rd='+s.rd); return v.join(','); }).filter(Boolean);
  const proj=projectCashflow(S.activeQuarter,null);
  const path={}; proj.forEach(p=>path[p.q]=Math.round(p.unified));
  return { targets:{cumProfit:rec.cumProfitTarget, finalRE:rec.finalRETarget, equity:rec.equityTarget,
      techX:rec.techXTarget, techY:rec.techYTarget, share:rec.q9Share,
      roe:rec.scoreTargets.roe, roi:rec.scoreTargets.roi, ros:rec.scoreTargets.ros},
    score:+scoreProxy(null).value.toFixed(1), tScore:mp.tScore, onTrack:mp.onTrack,
    pace:mp.pace, required:mp.required==null?null:+mp.required.toFixed(1),
    snaps:(mp.snaps||[]).length, pivots:(mp.pivots||[]).length,
    pivotTxt:(mp.pivots||[]).map(p=>p.replace(/<[^>]+>/g,'').slice(0,60)),
    decisionNumbers:nums, cashPath:path, actionTitles:items.map(i=>i.title.slice(0,46)) };
});
(async()=>{
const {browser,page,errors}=await open();
const seed=async()=>page.evaluate(()=>{
  ['Q1','Q2','Q3'].forEach((q,i)=>{ const Q=S.quarters[q]; Q.entered=true;
    Q.financial.netProfit=[-900000,-700000,-499768][i];
    Q.financial.retainedEarnings=[-900000,-1600000,-2429293][i];
    Q.financial.totalEquity=[7500000,6300000,5570707][i];
    Q.financial.totalAssets=[9000000,8600000,8358651][i];
    Q.financial.roe=[-12,-11,-9][i]; Q.financial.roi=[-9,-8,-6][i]; Q.financial.ros=[-60,-50,-40][i];
    Q.financial.cash={us:0,europe:0,brazil:2094904,hq:20000}; Q.financial.loans=643433;
    Q.operational.techX=[0,1,2][i]; Q.operational.techY=[0,1,1][i]; Q.operational.offices=3;
    Q.operational.plantsByProduct={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
    Q.operational.plantsByRegion={us:0,europe:4,brazil:0};
  });
  S.quarters.Q3.operational.inventory=[{product:'Y',grade:0,region:'europe',qty:35000,cost:42.88,price:0}];
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  S.activeQuarter='Q3'; S.scenarios=[]; S.masterPlan={snapshots:[]};
  backfillMasterPlan(); updateLearning(); save();
});
await seed(); const base=await snap(page);
console.log('=== BASELINE ==='); console.log(JSON.stringify(base,null,1));

await page.evaluate(()=>{ const Q=S.quarters.Q3;
  Q.financial.netProfit=-1800000; Q.financial.retainedEarnings=-5200000;
  Q.financial.totalEquity=2800000; Q.financial.cash={us:0,europe:0,brazil:200000,hq:20000};
  Q.financial.roe=-40; Q.financial.roi=-30; Q.financial.ros=-120;
  S.masterPlan={snapshots:[]}; backfillMasterPlan(); updateLearning(); save(); });
const worse=await snap(page);

await seed();
await page.evaluate(()=>{ const Q=S.quarters.Q3;
  Q.financial.netProfit=+2200000; Q.financial.retainedEarnings=+3100000;
  Q.financial.totalEquity=11500000; Q.financial.cash={us:900000,europe:2600000,brazil:2094904,hq:1800000};
  Q.financial.roe=28; Q.financial.roi=19; Q.financial.ros=15;
  S.masterPlan={snapshots:[]}; backfillMasterPlan(); updateLearning(); save(); });
const better=await snap(page);

await seed();
await page.evaluate(()=>{ const Q=S.quarters.Q3;
  Q.operational.techX=0; Q.operational.plantsByProduct.europe.X=0; Q.operational.plantsByRegion.europe=2;
  S.config.plantSplit.europe={X:0,Y:2};
  S.masterPlan={snapshots:[]}; backfillMasterPlan(); updateLearning(); save(); });
const shock=await snap(page);

const cmp=(a,b,label)=>{
  const tMoved=Object.keys(a.targets).filter(k=>String(a.targets[k])!==String(b.targets[k]));
  const cMoved=Object.keys(a.cashPath).filter(k=>Math.abs((a.cashPath[k]||0)-(b.cashPath[k]||0))>1000);
  const setA=new Set(a.decisionNumbers), setB=new Set(b.decisionNumbers);
  const dMoved=[...setB].filter(x=>!setA.has(x)).length + [...setA].filter(x=>!setB.has(x)).length;
  const titleDiff=[...new Set(b.actionTitles)].filter(x=>!a.actionTitles.includes(x));
  return {label, targetsMoved:tMoved, cashPathQuartersMoved:cMoved.length, decisionNumbersChanged:dMoved,
    score:[a.score,b.score], tScore:[a.tScore,b.tScore], pace:[a.pace,b.pace], required:[a.required,b.required],
    onTrack:[a.onTrack,b.onTrack], pivots:[a.pivots,b.pivots], pivotTxtB:b.pivotTxt,
    newActions:titleDiff.slice(0,5)};
};
console.log('\n=== P-10 deterioration ==='); console.log(JSON.stringify(cmp(base,worse),null,1));
console.log('\n=== P-11 improvement ==='); console.log(JSON.stringify(cmp(base,better),null,1));
console.log('\n=== P-12 shock ==='); console.log(JSON.stringify(cmp(base,shock),null,1));
console.log('\nerrs',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length);
await browser.close();
})();
