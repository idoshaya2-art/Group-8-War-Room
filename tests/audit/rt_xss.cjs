/* D-01 · A model-authored action must never be able to execute code in the page. The decision card
   renders title/form/detail as raw HTML by design, so the escaping has to happen where the model's
   text becomes an item. This suite asserts the injection stays inert. */
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
  const tq=nextQuarters('Q3')[0];
  const items=buildActionPlan('Q3',tq)||[];
  const inj='<img src=x onerror="window.__pwned=1"><b>PWNED</b>';
  const rev=parseReviewJSON(JSON.stringify({rationale:'ok',plan:[
     {verdict:'add',title:inj,form:'A1-2',level:'info',why:inj+' <img src=y onerror="window.__pwned2=1">',
      sim:{regions:{europe:{advertising:1000}}}}]}),tq,items.length);
  const ap=applyReview(items,rev,tq);
  S.ai=S.ai||{}; S.ai.review={q:tq,at:Date.now(),rationale:rev.rationale,...ap};
  save();
  return {added:ap.list.filter(x=>x.aiVerdict==='add').length, rejected:ap.rejected,
          titleRaw:(ap.list.find(x=>x.aiVerdict==='add')||{}).title};
});
console.log(JSON.stringify(res));
await page.evaluate(()=>go('plan'));
await new Promise(r=>setTimeout(r,1200));
const out=await page.evaluate(()=>({
  pwned:!!window.__pwned, pwned2:!!window.__pwned2,
  injectedImgs:document.querySelectorAll('img[src="x"],img[src="y"]').length,
  pwnedText:/PWNED/.test(document.body.innerText),
  escapedVisible:/<img src=x/.test(document.body.innerText)
}));
ck('D-01 · the injected action is accepted by the engine (so the render path is really exercised)',
  res.added===1, `added ${res.added}`);
ck('D-01 · the title is stored escaped', /^&lt;img/.test(String(res.titleRaw||'')), String(res.titleRaw||'').slice(0,40));
ck('D-01 · no handler ran from the title', out.pwned===false);
ck('D-01 · no handler ran from the detail', out.pwned2===false);
ck('D-01 · no injected node reached the DOM', out.injectedImgs===0, `${out.injectedImgs} nodes`);
ck('D-01 · the markup is shown to the user as literal text', out.escapedVisible===true);
ck('D-01 · no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
await browser.close();
process.exit(report('RED TEAM — HTML injection via model output')?1:0);
})();
