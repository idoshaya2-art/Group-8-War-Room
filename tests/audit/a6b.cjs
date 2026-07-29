const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
await page.evaluate(()=>{ S.activeQuarter='Q3'; save(); });
await page.evaluate(()=>go('plan')); await new Promise(r=>setTimeout(r,700));
let clicks=1; const t0=Date.now();
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/שלח לסימולטור/.test(b.textContent)); b.click(); }); clicks++;
await new Promise(r=>setTimeout(r,400));
const modal=await page.evaluate(()=>({ open:!!document.querySelector('#recTarget'),
  txt:document.body.innerText.match(/לאיזה תרחיש[\s\S]{0,160}/)?.[0].replace(/\n+/g,' | ')||null }));
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/העבר לתרחיש/.test(b.textContent)); if(b) b.click(); }); clicks++;
await new Promise(r=>setTimeout(r,700));
const after=await page.evaluate(()=>({ sent:/הועבר לסימולטור/.test(document.body.innerText),
  scenarios:(S.scenarios||[]).length, levQ:Object.keys((S.scenarios[0]||{levers:{}}).levers||{}),
  toast:/הועבר ל/.test(document.body.innerText) }));
console.log('U-02 REAL clicks =',clicks,'| seconds =',((Date.now()-t0)/1000).toFixed(1));
console.log('modal',JSON.stringify(modal,null,1));
console.log('after',JSON.stringify(after));
// U-09: is the "what to type into the simulator" sheet reachable and complete?
await page.evaluate(()=>go('export')); await new Promise(r=>setTimeout(r,600));
const sheet=await page.evaluate(()=>({ rows:document.querySelectorAll('table tr').length,
  hasForms:(document.body.innerText.match(/A1-\d|A2-\d|H\d-\d|W\d/g)||[]).length,
  copyBtns:[...document.querySelectorAll('button')].filter(b=>/העתק|הורד|ייצוא/.test(b.textContent)).length }));
console.log('U-09 submission sheet',JSON.stringify(sheet));
// U-10: undo/backup
const undo=await page.evaluate(()=>({ backup:[...document.querySelectorAll('button')].some(b=>/גיבוי/.test(b.textContent)),
  restore:[...document.querySelectorAll('button')].some(b=>/שחזור/.test(b.textContent)),
  unmark:/בטל סימון/.test(document.body.innerText) }));
console.log('U-10 undo/backup',JSON.stringify(undo));
console.log('errs',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length);
await browser.close();
})();
