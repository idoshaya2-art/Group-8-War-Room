const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
// U-01 cold start: what does a first-time user see, and can they act?
const t0=Date.now();
const cold=await page.evaluate(()=>{
  const navs=[...document.querySelectorAll('[onclick^="go("]')].map(b=>b.textContent.trim().replace(/\s+/g,' ')).filter(Boolean);
  return { title:document.title, bodyLen:document.body.innerText.length,
    navCount:new Set(navs).size, navs:[...new Set(navs)].slice(0,12),
    ctaCount:document.querySelectorAll('button.primary').length,
    firstScreen:document.body.innerText.slice(0,260).replace(/\n+/g,' | ') };
});
console.log('U-01 cold start', JSON.stringify(cold,null,1));

// U-02 clicks-to-first-decision, measured
await page.evaluate(()=>{
  ['Q1','Q2','Q3'].forEach((q,i)=>{ const Q=S.quarters[q]; Q.entered=true;
    Q.financial.netProfit=-500000; Q.financial.cash={us:0,europe:0,brazil:2094904,hq:20000};
    Q.operational.techX=2; Q.operational.techY=1; Q.operational.offices=3;
    Q.operational.plantsByProduct={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
    Q.operational.plantsByRegion={us:0,europe:4,brazil:0}; });
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  S.activeQuarter='Q3'; save();
});
let clicks=0; const tStart=Date.now();
await page.evaluate(()=>go('plan')); clicks++;
await new Promise(r=>setTimeout(r,600));
const planPage=await page.evaluate(()=>{
  const send=[...document.querySelectorAll('button')].filter(b=>/שלח לסימולטור/.test(b.textContent));
  const heads=[...document.querySelectorAll('h2,h3')].map(h=>h.textContent.trim()).slice(0,14);
  return { sendButtons:send.length, firstSendText:send[0]?send[0].textContent.trim():null,
    heads, wordsBeforeFirstSend:(()=>{ const t=document.body.innerText; const i=t.indexOf('שלח לסימולטור');
      return i<0?null:t.slice(0,i).split(/\s+/).length; })(),
    scrollH:document.documentElement.scrollHeight, viewH:window.innerHeight };
});
if(planPage.sendButtons>0){ await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(b=>/שלח לסימולטור/.test(b.textContent)); b.click(); }); clicks++; }
await new Promise(r=>setTimeout(r,500));
const afterSend=await page.evaluate(()=>({ sentTags:document.querySelectorAll('.tag.g').length,
  hasSentMark:/הועבר לסימולטור/.test(document.body.innerText),
  scenarios:(S.scenarios||[]).length }));
console.log('U-02 clicks to first decision sent =',clicks,'| seconds =',((Date.now()-tStart)/1000).toFixed(1));
console.log('U-02 plan page', JSON.stringify(planPage,null,1));
console.log('U-02 after send', JSON.stringify(afterSend));

// U-03..U-06: every page renders, no errors, no overflow, headings present
const pages=await page.evaluate(()=>[...new Set([...document.querySelectorAll('[onclick^="go("]')].map(b=>b.getAttribute('onclick').match(/go\('([^']+)'/)[1]))]);
const perPage={};
for(const p of pages){
  await page.evaluate(k=>go(k),p); await new Promise(r=>setTimeout(r,450));
  perPage[p]=await page.evaluate(()=>({ len:document.body.innerText.length,
    h:document.querySelectorAll('h2,h3').length,
    tables:document.querySelectorAll('table').length,
    overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    emptyMsg:/טרם|אין נתונים|העלה/.test(document.body.innerText) }));
}
console.log('U-03 pages', JSON.stringify(perPage,null,1));

// U-07 mobile
await page.setViewportSize({width:390,height:844});
const mob={};
for(const p of pages){ await page.evaluate(k=>go(k),p); await new Promise(r=>setTimeout(r,400));
  mob[p]=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth); }
console.log('U-07 mobile overflow px per page', JSON.stringify(mob));

// U-08 tap target sizes on mobile
const taps=await page.evaluate(()=>{ const bs=[...document.querySelectorAll('button')];
  const small=bs.filter(b=>{const r=b.getBoundingClientRect(); return r.width>0 && (r.height<32);});
  return {buttons:bs.length, under32px:small.length, samples:small.slice(0,4).map(b=>b.textContent.trim().slice(0,24))}; });
console.log('U-08 tap targets', JSON.stringify(taps));
console.log('errs', errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length, errors.slice(0,3));
await browser.close();
})();
