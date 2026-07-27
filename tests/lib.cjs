/* Shared harness for the INTOPIA War Room test suites.
   Every suite runs the real index.html in a real browser — no mocks of the app itself. */
const path=require('path');
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP='file://'+path.resolve(__dirname,'..','index.html');

function loadPlaywright(){
  const candidates=['/opt/node22/lib/node_modules/playwright/index.js','playwright','playwright-core'];
  for(const c of candidates){ try{ return require(c); }catch(e){} }
  throw new Error('Playwright not found. Install it, or run these tests where it is available.');
}

/* A realistic end-of-Q3 position for Group 8, close to the team's actual state.
   Suites seed this so assertions are about behaviour, not about an empty app. */
const SEED=`(()=>{
  S.activeQuarter='Q3';
  ['Q1','Q2','Q3'].forEach((q,i)=>{ const Q=S.quarters[q]; Q.entered=true;
    Q.financial.netProfit=[-380000,-410000,-313000][i];
    Q.financial.cash={us:120000,europe:640000,brazil:95000,hq:213000};
    Q.financial.retainedEarnings=[-380000,-790000,-1103000][i];
    Q.financial.totalEquity=6900000; Q.financial.loans=1136879;
    Q.financial.revenue=[210000,480000,643000][i];
    Q.financial.roe=-4; Q.financial.roi=-3; Q.financial.ros=-12;
    Q.operational.techX=3; Q.operational.techY=1; Q.operational.rd=90000;
    Q.operational.plantsByRegion={us:0,europe:2,brazil:0};
  });
  S.quarters.Q3.operational.inventory=[{product:'Y',grade:1,region:'europe',qty:35000,price:0,cost:0}];
  S.quarters.Q3.marketIntel={
    competitors:{2:{num:2,retainedEarnings:2429},5:{num:5,retainedEarnings:1870},8:{num:8,retainedEarnings:-1103}},
    sales:[{company:8,region:'europe',product:'Y',units:4900},{company:2,region:'europe',product:'Y',units:9800},
           {company:5,region:'europe',product:'Y',units:7400},{company:2,region:'us',product:'Y',units:12000}],
    sources:[],generic:[],
    compPrices:[{region:'europe',product:'Y',company:2,price:139},{region:'europe',product:'Y',company:5,price:132}]};
  updateLearning(); save();
})()`;

async function open(opts={}){
  const {chromium}=loadPlaywright();
  const browser=await chromium.launch({executablePath:CHROME});
  const page=await browser.newPage({viewport:opts.viewport||{width:1400,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{ if(m.type()==='error') errors.push('console: '+m.text()); });
  await page.goto(APP);
  await page.waitForTimeout(600);
  if(opts.seed!==false){ await page.evaluate(SEED); await page.waitForTimeout(300); }
  return {browser,page,errors};
}

/* Tiny assertion recorder — suites print one line per check so failures are readable. */
function checks(){
  const pass=[],fail=[];
  const ck=(name,cond,detail)=>{ (cond?pass:fail).push(name+(detail?' — '+detail:'')); return !!cond; };
  const report=(title)=>{
    console.log(`\n=== ${title} ===`);
    console.log(`PASS ${pass.length}  FAIL ${fail.length}`);
    fail.forEach(f=>console.log('  ✗ '+f));
    pass.forEach(f=>console.log('  ✓ '+f));
    return fail.length;
  };
  return {ck,report,pass,fail};
}
module.exports={open,checks,SEED,APP,CHROME,loadPW:loadPlaywright};
