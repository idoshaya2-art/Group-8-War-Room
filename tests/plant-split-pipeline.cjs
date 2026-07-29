const {loadPW,APP}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1400,height:1000}}); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(700);
const R=await p.evaluate(()=>{
  const out={pass:[],fail:[]}; const ck=(n,c,d)=>(c?out.pass:out.fail).push(n+(d?' — '+d:''));
  S.activeQuarter='Q3'; S.quarters.Q3.entered=true;
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:2,brazil:0};
  S.quarters.Q3.operational.techX=3; S.quarters.Q3.operational.techY=1;
  S.quarters.Q3.operational.inventory=[{product:'Y',grade:1,region:'europe',qty:35000,price:0,cost:0}];
  REGIONS.forEach(r=>S.quarters.Q3.financial.cash[r.id]=300000);

  // ---- #1 plant split ----
  ck('undeclared by default', plantsForProduct('europe','X')===null && plantsForProduct('europe','Y')===null);
  let cx=capacityForProduct('X');
  ck('chip capacity reports UNKNOWN, not a guess', cx.known===false, 'known='+cx.known+' units='+cx.units);
  let c=contractPlan()[0];
  ck('contract capacity flagged unknown', c.capKnown===false);
  ck('alert says the split was never declared', computeAlerts('Q3').find(a=>a.key==='ct_group').desc.includes('לא הוצהר'));
  // declare: both European plants make COMPUTERS -> zero chip capacity
  setPlantSplit('europe','X',0); setPlantSplit('europe','Y',2);
  cx=capacityForProduct('X'); const cy=capacityForProduct('Y');
  ck('after declaring, chip capacity is known and ZERO', cx.known===true && cx.units===0);
  ck('computer capacity derived from declared Y plants', cy.known===true && cy.units===2*DATALOG.capacity.Y.europe, 'Y='+cy.units);
  c=contractPlan()[0];
  ck('contract now knows it cannot be produced in-house', c.capKnown===true && c.capPerQuarter===0 && c.capOK===false);
  const card=buildActionPlan('Q3','Q4').find(i=>/התחייבות/.test(i.title||''));
  ck('action card states there is no chip plant at all', card && /אין מפעל שמייצר X/.test(card.detail));
  ck('and points to the real alternatives (new plant / buy)', card && /H6/.test(card.detail));
  ck('mismatch against the report is detected', (setPlantSplit('europe','X',5), plantSplitStatus().anyMismatch===true), 'declared 5+2 vs report 2');
  setPlantSplit('europe','X',0);
  ck('no mismatch when the declaration adds up', plantSplitStatus().anyMismatch===false);
  // declared chip plants restore capacity
  setPlantSplit('europe','X',1); setPlantSplit('europe','Y',1);
  ck('one declared chip plant gives real chip capacity', capacityForProduct('X').units===DATALOG.capacity.X.europe);
  ck('optimizer capacity follows the declared Y plants', (()=>{ go('sim'); newScenario(); const sc=S.scenarios[0];
      magicOptimize(sc.id); const prod=Object.values(sc.levers)[0].regions.europe.production;
      return prod<=1*DATALOG.capacity.Y.europe; })(), 'production capped by 1 declared Y plant');

  // ---- #2 pipeline continuity ----
  S.scenarios=[]; save();
  go('sim');
  const area=document.getElementById('scenarioArea');
  ck('sim no longer opens blank — it offers the mandatory actions', area && /פעולות חובה/.test(area.textContent), (area&&area.textContent.slice(0,60))||'(empty)');
  ck('and exposes a one-click build button', !!document.querySelector('button[onclick="seedScenarioFromMusts()"]'));
  seedScenarioFromMusts();
  ck('a scenario now exists', S.scenarios.length===1);
  ck('it spans the whole horizon to Q9', Object.keys(S.scenarios[0].levers).length===planHorizon('Q3').length);
  const seeded=S.scenarios[0].levers.Q4;
  ck('it carries real lever values from the recommendations',
     REGIONS.some(r=>{const g=seeded.regions[r.id]||{}; return (g.sales>0||g.production>0||g.price>0);}),
     JSON.stringify(seeded.regions.europe));
  ck('and editable action cards', (seeded.actions||[]).length>0, 'actions='+(seeded.actions||[]).length);

  // ---- #3 estimate marking ----
  const groups=pcSellOptions('Q3');
  ck('sell options exist to mark', groups.length>0);
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f)); R.pass.forEach(f=>console.log('  ✓ '+f));
// estimate markers must actually render on the decisions page
await p.evaluate(()=>{ S.scenarios=[];
  S.quarters.Q3.marketIntel={competitors:{2:{num:2,retainedEarnings:2429},5:{num:5,retainedEarnings:1870},8:{num:8,retainedEarnings:-1103}},
    sales:[{company:8,region:'europe',product:'Y',units:4900},{company:2,region:'europe',product:'Y',units:9800}],
    compPrices:[{region:'europe',product:'Y',company:2,price:139}]};
  updateLearning(); go('plan'); });
await p.waitForTimeout(500);
const est=await p.evaluate(()=>{ const e=[...document.querySelectorAll('.est')];
  return {count:e.length, sample:e.slice(0,2).map(x=>x.textContent.trim().slice(0,40)), titled:e.every(x=>!!x.title)}; });
console.log('estimate markers on Decisions:',JSON.stringify(est));
await p.evaluate(()=>go('intel')); await p.waitForTimeout(400);
const est2=await p.evaluate(()=>document.querySelectorAll('.est').length);
console.log('estimate markers on Intel:',est2);
console.log('pageErrors:',errs);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
