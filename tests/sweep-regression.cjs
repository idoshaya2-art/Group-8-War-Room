const { chromium } = require('./lib.cjs').loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1280,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(require('./lib.cjs').APP,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(400);
await p.evaluate(()=>{
  QUARTERS.forEach(q=>S.quarters[q]=emptyQuarter());
  const set=(q,cons,np,rd,x,y,inv,cash)=>{const Q=S.quarters[q];Q.entered=true;Q.financial.consolidated=cons;Q.financial.cash=cash;Q.financial.netProfit=np;Q.financial.retainedEarnings=np;Q.operational.rd=rd;Q.operational.techX=x;Q.operational.techY=y;if(inv)Q.operational.inventory=inv;Q.marketIntel.competitors={'8':{num:8,retainedEarnings:np,rdChip:200},'3':{num:3,retainedEarnings:900000,rdChip:500}};};
  set('Q1',6562577,-821543,800000,1,0,null,{us:0,europe:151050,brazil:0,hq:6336002});
  set('Q3',1067452,-499768,0,2,1,[{product:'Y',region:'europe',grade:'Standard',qty:18000,cost:220,price:0},{product:'X',region:'europe',grade:'Standard',qty:5000,cost:120,price:0}],{us:200000,europe:900000,brazil:900000,hq:80000});
  S.cumulative=false; S.activeQuarter='Q3'; save();
});
const pages=['ingest','dashboard','plan','sim','export','financials','intel','ai','goals'];
for(const pg of pages){ await p.evaluate(id=>window.go(id),pg); await p.waitForTimeout(140); }
await p.evaluate(()=>{ S.cumulative=true; save(); window.go('dashboard'); }); await p.waitForTimeout(150);
// mobile
await p.setViewportSize({width:375,height:800}); await p.evaluate(()=>{S.cumulative=false;window.go('plan');}); await p.waitForTimeout(150);
const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
console.log('pageErrors:',errs.length, errs.slice(0,6));
console.log('mobileOverflow:',ov);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
