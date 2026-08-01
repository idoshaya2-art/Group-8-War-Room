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
/* The written plan owns the list for every quarter it covers (Q4 onward), and a plan action is
   never model-authored — so the render path this finding guards lives in the quarters the plan
   does NOT cover, where the engine's generated list is still what the tab shows. Inject there:
   reviewing Q4 and then rendering Q1→Q2 put the item on a page it was never going to appear on,
   which made the assertion pass or fail for reasons unrelated to escaping. */
const BASE='Q1';
const res=await page.evaluate((BASE)=>{
  S.activeQuarter=BASE;
  const tq=nextQuarters(BASE)[0];
  const items=buildActionPlan(BASE,tq)||[];
  const inj='<img src=x onerror="window.__pwned=1"><b>PWNED</b>';
  const rev=parseReviewJSON(JSON.stringify({rationale:'ok',plan:[
     {verdict:'add',title:inj,form:'A1-2',level:'info',why:inj+' <img src=y onerror="window.__pwned2=1">',
      sim:{regions:{europe:{advertising:1000}}}}]}),tq,items.length);
  const ap=applyReview(items,rev,tq);
  S.ai=S.ai||{}; S.ai.review={q:tq,at:Date.now(),rationale:rev.rationale,...ap};
  save();
  return {added:ap.list.filter(x=>x.aiVerdict==='add').length, rejected:ap.rejected,
          targetQ:tq, titleRaw:(ap.list.find(x=>x.aiVerdict==='add')||{}).title};
}, BASE);
console.log(JSON.stringify(res));
await page.evaluate(()=>{ go('plan'); });
await new Promise(r=>setTimeout(r,1200));
const out=await page.evaluate(()=>({
  pwned:!!window.__pwned, pwned2:!!window.__pwned2,
  injectedImgs:document.querySelectorAll('img[src="x"],img[src="y"]').length,
  pwnedText:/PWNED/.test(document.body.innerText),
  // The whole point: the markup reaches the user as characters he can read, not as a node the
  // browser parsed. If this is false, check first that the injected action is on the rendered
  // list at all — an item that never renders also never executes, and would pass every
  // assertion above while proving nothing.
  escapedVisible:/<img src=x/.test(document.body.innerText),
  onList:/PWNED/.test(document.body.innerText)
}));
ck('D-01 · the injected action is accepted by the engine (so the render path is really exercised)',
  res.added===1, `added ${res.added}`);
ck('D-01 · the title is stored escaped', /^&lt;img/.test(String(res.titleRaw||'')), String(res.titleRaw||'').slice(0,40));
ck('D-01 · no handler ran from the title', out.pwned===false);
ck('D-01 · no handler ran from the detail', out.pwned2===false);
ck('D-01 · no injected node reached the DOM', out.injectedImgs===0, `${out.injectedImgs} nodes`);
ck('D-01 · the injected action really is on the rendered list, not merely in state',
  out.onList===true, `target ${res.targetQ}`);
ck('D-01 · the markup is shown to the user as literal text', out.escapedVisible===true);
ck('D-01 · no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
await browser.close();
process.exit(report('RED TEAM — HTML injection via model output')?1:0);
})();
