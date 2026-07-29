const {open}=require('../lib.cjs');
(async()=>{
const {browser,page}=await open();
const seed=async()=>page.evaluate(()=>{
  ['Q1','Q2','Q3'].forEach((q,i)=>{ const Q=S.quarters[q]; Q.entered=true;
    Q.financial.netProfit=[-900000,-700000,-499768][i];
    Q.financial.roe=[-12,-11,-9][i]; Q.financial.roi=[-9,-8,-6][i]; Q.financial.ros=[-60,-50,-40][i];
    Q.operational.techX=[0,1,2][i]; Q.operational.techY=[0,1,1][i];
  });
  S.activeQuarter='Q3'; save();
});
await seed();
const a=await page.evaluate(()=>{ const r=recommendGoals(); return {QUARTERS:QUARTERS.slice(), remaining:r.remaining, cumNet:r.cumNet, profPace:r.profPace, cumProfitTarget:r.cumProfitTarget, goalsNow:{cp:S.config.goals.cumProfitTarget,re:S.config.goals.finalRETarget,eq:S.config.goals.equityTarget}}; });
console.log('BASE', JSON.stringify(a));
await page.evaluate(()=>{ S.quarters.Q3.financial.netProfit=-1800000; save(); });
const b=await page.evaluate(()=>{ const r=recommendGoals(); return {remaining:r.remaining, cumNet:r.cumNet, profPace:r.profPace, cumProfitTarget:r.cumProfitTarget}; });
console.log('WORSE', JSON.stringify(b));
await browser.close();
})();
