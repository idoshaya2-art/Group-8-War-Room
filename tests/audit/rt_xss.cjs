/* D-01 · Model-authored plan-review text must never be able to execute code in the page. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();
await page.evaluate(()=>{
  ['Q1','Q2','Q3'].forEach((q,i)=>{ const Q=S.quarters[q]; Q.entered=true;
    Q.financial.netProfit=-500000; Q.financial.cash={us:0,europe:0,brazil:2094904,hq:20000};
    Q.operational.techX=2; Q.operational.techY=1; Q.operational.offices=3;
    Q.operational.plantsByProduct={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
    Q.operational.plantsByRegion={us:0,europe:4,brazil:0}; });
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  S.activeQuarter='Q3'; save();
});
const res=await page.evaluate(()=>{
  S.activeQuarter='Q3';
  const tq='Q4', count=planV6For(tq).actions.length;
  const inj='<img src=x onerror="window.__pwned=1"><b>PWNED</b>';
  const rev=parsePlanReview(JSON.stringify({rationale:inj,actions:[
    {n:1,verdict:'fix',why:inj+' <img src=y onerror="window.__pwned2=1">',fix:inj}],
    missing:[{what:inj,why:inj}]}),count);
  S.ai=S.ai||{}; S.ai.planReview={q:tq,at:Date.now(),...rev};
  save();
  return {missing:rev.missing.length,targetQ:tq,whatRaw:(rev.missing[0]||{}).what,
    rationaleRaw:rev.rationale,whyRaw:(rev.byN[1]||{}).why};
});
console.log(JSON.stringify(res));
await page.evaluate(()=>{ go('plan'); });
await new Promise(r=>setTimeout(r,1200));
const out=await page.evaluate(()=>({
  pwned:!!window.__pwned, pwned2:!!window.__pwned2,
  injectedImgs:document.querySelectorAll('img[src="x"],img[src="y"]').length,
  pwnedText:/PWNED/.test(document.body.innerText),
  // The markup reaches the user as characters, not as a node parsed by the browser.
  escapedVisible:/<img src=x/.test(document.body.innerText),
  onList:/PWNED/.test(document.body.innerText)
}));
ck('D-01 · the injected AI missing-item reaches the review render path',
  res.missing===1, `missing ${res.missing}`);
ck('D-01 · all model-authored plan-review fields are stored escaped',
  /^&lt;img/.test(String(res.whatRaw||'')) && /^&lt;img/.test(String(res.rationaleRaw||'')) && /^&lt;img/.test(String(res.whyRaw||'')));
ck('D-01 · no handler ran from the missing-item title', out.pwned===false);
ck('D-01 · no handler ran from its reason', out.pwned2===false);
ck('D-01 · no injected node reached the DOM', out.injectedImgs===0, `${out.injectedImgs} nodes`);
ck('D-01 · the injected review text really is rendered, not merely stored in state',
  out.onList===true, `target ${res.targetQ}`);
ck('D-01 · the markup is shown to the user as literal text', out.escapedVisible===true);
ck('D-01 · no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
await browser.close();
process.exit(report('RED TEAM — HTML injection via model output')?1:0);
})();
