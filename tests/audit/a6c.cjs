const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open({seed:false});
await page.evaluate(()=>{ try{localStorage.clear();}catch(e){} });
await page.reload(); await new Promise(r=>setTimeout(r,900));
const cold=await page.evaluate(()=>({
  entered:QUARTERS.filter(q=>S.quarters[q].entered), activeQuarter:S.activeQuarter,
  bodyLen:document.body.innerText.length,
  first:document.body.innerText.replace(/\n+/g,' | ').slice(0,700),
  primaryCTAs:[...document.querySelectorAll('button.primary')].map(b=>b.textContent.trim()),
  redAlerts:[...document.querySelectorAll('.tag.r')].map(t=>t.textContent.trim()).slice(0,6)
}));
console.log('TRUE COLD START'); console.log(JSON.stringify(cold,null,1));
const pages=['dashboard','plan','sim','export','financials','ingest'];
for(const p of pages){ await page.evaluate(k=>go(k),p); await new Promise(r=>setTimeout(r,400));
  const r=await page.evaluate(()=>({len:document.body.innerText.length, guidance:/העלה|טרם נקלט|אין נתונים|התחל/.test(document.body.innerText)}));
  console.log(' ',p,JSON.stringify(r)); }
console.log('cold-start JS errors:',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length, errors.filter(e=>!/net::ERR|Failed to load/.test(e)).slice(0,4));
await browser.close();
})();
