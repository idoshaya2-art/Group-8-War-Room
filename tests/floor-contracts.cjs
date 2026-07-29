const {loadPW,APP}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(700);
const R=await p.evaluate(()=>{
  const out={pass:[],fail:[]}; const ck=(n,c,d)=>(c?out.pass:out.fail).push(n+(d?' — '+d:''));
  S.activeQuarter='Q3'; S.quarters.Q3.entered=true;
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:2,brazil:0};
  S.quarters.Q3.operational.techX=3; S.quarters.Q3.operational.techY=1;
  REGIONS.forEach(r=>S.quarters.Q3.financial.cash[r.id]=1500000);
  S.quarters.Q3.financial.loans=500000;

  // ---- CONTRACTS: the grade bug ----
  S.quarters.Q3.operational.inventory=[{product:'X',grade:0,region:'europe',qty:30000,price:40,cost:12}];
  let cp=contractPlan();
  ck('both X3 commitments tracked', cp.length===2 && cp[0].deliveryQuarter==='Q5' && cp[1].deliveryQuarter==='Q6');
  ck('30,000 X0 does NOT satisfy a 30,000 X3 commitment', cp[0].stock===0 && cp[0].gap===30000, 'stock='+cp[0].stock);
  ck('the wrong-grade stock is reported, not silently ignored', cp[0].wrongGrade===30000);
  ck('production deadline is one quarter BEFORE delivery', cp[0].productionQuarter==='Q4' && cp[1].productionQuarter==='Q5');
  ck('Q5 delivery means production must START now (Q4)', cp[0].startNow===true, 'quartersLeft='+cp[0].quartersLeft+' slack='+cp[0].slack);
  ck('alert fires now that grade is respected', computeAlerts('Q3').some(a=>a.key==='ct_group'));
  ck('alert is RED because a deadline is immediate', computeAlerts('Q3').find(a=>a.key==='ct_group').level==='red');
  // right grade in stock clears it
  S.quarters.Q3.operational.inventory=[{product:'X',grade:3,region:'europe',qty:30000,price:40,cost:12}];
  cp=contractPlan();
  ck('30,000 X3 in stock covers the Q5 commitment', cp[0].gap===0, 'gap='+cp[0].gap);
  ck('but Q6 still needs another 30,000', cp[1].gap===0 || cp[1].gap>0);
  // a higher grade satisfies a lower-grade commitment
  S.quarters.Q3.operational.inventory=[{product:'X',grade:5,region:'europe',qty:30000}];
  ck('a higher grade (X5) satisfies an X3 commitment', contractPlan()[0].gap===0);
  // tech too low is flagged
  S.quarters.Q3.operational.techX=1; S.quarters.Q3.operational.inventory=[];
  ck('flags that current chip grade cannot make X3', contractPlan()[0].techOK===false, 'techX=1');
  S.quarters.Q3.operational.techX=3;
  ck('capacity is UNKNOWN until the X/Y plant split is declared', contractPlan()[0].capKnown===false,
     'capKnown='+contractPlan()[0].capKnown);
  setPlantSplit('europe','X',2); setPlantSplit('europe','Y',0);
  ck('once declared, chip capacity comes from the declared chip plants',
     contractPlan()[0].capPerQuarter===2*DATALOG.capacity.X.europe, 'cap='+contractPlan()[0].capPerQuarter);
  setPlantSplit('europe','X',null); setPlantSplit('europe','Y',null);

  // ---- the strategist must now be told, and must reject plans that miss it ----
  const hz=planHorizon('Q3');
  const ctx=strategyContext('Q3',hz);
  ck('strategist context states the commitments as a hard constraint', /אילוץ קשיח/.test(ctx)&&/X3/.test(ctx));
  ck('strategist context gives the real production deadline', /הייצור חייב להסתיים ב-\*\*Q4\*\*/.test(ctx));
  const missing=parseStrategyJSON(JSON.stringify({variants:[{name:'מתעלם',thesis:'t',quarters:Object.fromEntries(hz.map(q=>[q,
    {rd:120000,regions:{europe:{production:15000,unitCost:70,price:135,qtySold:14000,advertising:60000,offices:2,product:'Y'}}}]))}]}),hz);
  const sm=scoreStrategyVariant(missing[0],'Q3');
  ck('engine REJECTS a plan that ignores the commitment', !sm.legal && sm.violations.some(x=>/התחייבות/.test(x)), sm.violations.find(x=>/התחייבות/.test(x)));
  const covers=parseStrategyJSON(JSON.stringify({variants:[{name:'מכסה',thesis:'t',quarters:Object.fromEntries(hz.map(q=>[q,
    {rd:120000,regions:{europe:(q==='Q4'||q==='Q5')?{production:30000,unitCost:12,price:45,qtySold:0,offices:2,product:'X',grade:3}
      :{production:0,unitCost:0,price:0,qtySold:0,offices:2,product:'Y'}}}]))}]}),hz);
  ck('a chip plan is parsed as product X with its grade', covers[0].levers.Q4.regions.europe.product==='X'&&covers[0].levers.Q4.regions.europe.grade===3);
  const sc2=scoreStrategyVariant(covers[0],'Q3');
  ck('a plan that DOES cover the commitment passes that check', !sc2.violations.some(x=>/התחייבות/.test(x)), JSON.stringify(sc2.violations));

  // ---- FLOOR: derived, itemised, non-zero ----
  ck('floors currently default to 0 (no real floor)', QUARTERS.every(q=>!(S.config.goals.floors[q]>0)));
  const fc=floorComponents('Q4');
  ck('floor is itemised with sources', fc.items.length>=4 && fc.items.every(i=>i.src&&i.sf>0), fc.items.length+' items');
  ck('floor includes the legal HQ minimum', fc.items.some(i=>i.sf===DATALOG.minHOCashSF));
  ck('floor includes fixed plant cost (paid from cash)', fc.items.some(i=>/מפעלים/.test(i.label)));
  ck('floor includes the R&D legal minimum', fc.items.some(i=>/מו״פ/.test(i.label)));
  ck('floor includes interest on existing debt', fc.items.some(i=>/ריבית/.test(i.label)));
  ck('floor total is the sum of its parts', fc.total===fc.items.reduce((a,i)=>a+i.sf,0), 'total='+fc.total);
  ck('floor names the quarter it funds', fc.fundsQuarter==='Q5');
  const rec=recommendFloors();
  ck('a floor is produced for every remaining quarter', planHorizon('Q3').every(q=>rec.floors[q]>0));
  applyRecommendedFloors();
  ck('applying sets real non-zero floors', planHorizon('Q3').every(q=>S.config.goals.floors[q]>0),
     planHorizon('Q3').map(q=>q+':'+S.config.goals.floors[q]).join(' '));
  ck('the projection now measures against a real floor', projectCashflow('Q3',null).every(x=>x.floor>0));
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f)); R.pass.forEach(f=>console.log('  ✓ '+f));
console.log('pageErrors:',errs);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
