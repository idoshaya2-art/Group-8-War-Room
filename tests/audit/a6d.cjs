const {open}=require('../lib.cjs');
(async()=>{
const {browser,page}=await open({seed:false});
await page.evaluate(()=>{ try{localStorage.clear();}catch(e){} });
await page.reload(); await new Promise(r=>setTimeout(r,900));
for(const p of ['sim','export']){ await page.evaluate(k=>go(k),p); await new Promise(r=>setTimeout(r,500));
  const t=await page.evaluate(()=>document.body.innerText.replace(/\n+/g,' | '));
  console.log('---',p,'\n',t.slice(300,1400)); }
await browser.close();
})();
