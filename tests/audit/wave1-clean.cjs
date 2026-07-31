const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open({seed:false});
await page.evaluate(()=>{ try{localStorage.clear();}catch(e){} });
await page.reload(); await page.waitForTimeout(900);
await page.evaluate(()=>go('export')); await page.waitForTimeout(600);
const t=await page.evaluate(()=>document.body.innerText);
ck('D-06 · no gap table on a clean install', !/פערים בין התוכנית|תואמת את המצב/.test(t));
/* The plan-vs-actual card became background on the submission tab (that tab now leads with the
   actions you ticked), so this message lives inside a closed disclosure. It must still be
   produced — silence on a clean install is exactly what D-06 was about. */
ck('D-06 · it says why instead of showing nothing',
  await page.evaluate(()=>/תופיע לאחר קליטת הרבעון הראשון/.test(document.body.textContent)));
ck('D-06 · no derived figure is presented as an actual', !/420,000 SF/.test(t) && !/חסר 30,000/.test(t));
ck('D-06 · clean install still boots with no JS errors',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
await browser.close();
process.exit(report('WAVE 1 — clean install (D-06)')?1:0);
})();
