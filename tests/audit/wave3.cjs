/* Wave 3 · D-02 (the rolling Q4->Q9 path and its back-calculation) and I-4 (forecast vs actual).
   The point of D-02 is not more numbers per quarter — it is knowing which of this quarter's
   decisions are really a later quarter's decisions, and which start dates have already passed. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---------- the horizon is the whole horizon
const shape=await page.evaluate(()=>{
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:1,Y:2},brazil:{X:0,Y:0}};
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:3,brazil:0};
  S.quarters.Q3.operational.techX=0; S.quarters.Q3.operational.techY=1;
  const rows=rollingPlan('Q3',null);
  return { qs:rows.map(r=>r.q), hasCash:rows.every(r=>r.cash!=null), hasTech:rows.every(r=>r.tech!=null),
    firstIsNext:rows[0].isNext===true, capX:rows[0].capX, capY:rows[0].capY };
});
ck('D-02 · the path covers every remaining quarter through Q9',
  JSON.stringify(shape.qs)==='["Q4","Q5","Q6","Q7","Q8","Q9"]', shape.qs.join(','));
ck('D-02 · every quarter carries a cash figure and a projected grade',
  shape.hasCash && shape.hasTech);
ck('D-02 · capacity is derived from the declared split (1 X + 2 Y in Europe)',
  shape.capX===35000 && shape.capY===36000, `X ${shape.capX} · Y ${shape.capY}`);

// ---------- lead times: a plant built in Q produces from Q+1
const pipe=await page.evaluate(()=>{
  const lev={}; nextQuarters('Q3').forEach(q=>{ lev[q]={rd:0,regions:{}};
    REGIONS.forEach(x=>lev[q].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0}); });
  lev.Q4.regions.europe.newFac=1; lev.Q4.regions.europe.product='X';
  const p=plantPipeline('Q3',lev);
  return {q4:p.Q4.europe.X, q5:p.Q5.europe.X, q6:p.Q6.europe.X};
});
ck('D-02 · a plant built in Q4 is NOT on stream in Q4', pipe.q4===1, `X plants Q4 = ${pipe.q4}`);
ck('D-02 · it is on stream from Q5 onward', pipe.q5===2 && pipe.q6===2, `Q5 ${pipe.q5} · Q6 ${pipe.q6}`);

/* techPath's one-grade-per-quarter projection is kept as the raw mechanic (a grade cannot move in
   an unfunded quarter) but is NO LONGER what the rolling plan uses: §4.3 resets the probability to
   zero after every patent, so a steady spend does not yield a grade per quarter. The corrected
   behaviour is asserted in wave4.cjs; here we only pin the funding floor. */
const tech=await page.evaluate(()=>{
  const mk=(amount)=>{ const lev={}; nextQuarters('Q3').forEach(q=>{ lev[q]={rd:0,rdX:amount,rdY:0,regions:{}};
      REGIONS.forEach(x=>lev[q].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0}); });
    return techPath('Q3',lev); };
  const min=DATALOG.rdMinPerQuarter.X;
  return { min, funded:mk(min), starved:mk(min-1) };
});
ck('D-02 · a quarter funded at the legal minimum can move a grade',
  tech.funded.Q4.X===1, `Q4 = ${tech.funded.Q4.X}`);
ck('D-02 · funding below the legal minimum moves nothing',
  tech.starved.Q6.X===0, `Q6 = ${tech.starved.Q6.X}`);

// ---------- the back-calculation, which is the whole point
const cp=await page.evaluate(()=>{
  S.quarters.Q3.operational.techX=0;
  const c=criticalPath('Q3',null);
  return { now:c.now.map(m=>`${m.kind}@${m.forQ}<-${m.startQ}`),
           missed:c.missed.map(m=>`${m.kind}@${m.forQ}<-${m.startQ}`) };
});
ck('D-02 · production for the Q5 contract is flagged as starting in Q4',
  cp.now.includes('contract@Q5<-Q4'), cp.now.join(' | '));
/* Wave 3 asserted the start dates Q1 and Q2 here, from a one-grade-per-quarter lead time. With the
   §4.3 reset modelled (wave 4) a three-grade climb needs five funded quarters, so the start date
   for a Q5 delivery falls before Q1 — the commitment was never reachable by own R&D at all. The
   exact dates are asserted in wave4.cjs; what belongs here is that both tranches are missed. */
ck('D-02 · at grade X0, both X3 tranches are reported as already missed',
  cp.missed.filter(x=>/^tech@/.test(x)).length===2, cp.missed.join(' | '));

// ---------- and it responds to state: reaching the grade clears the missed items
const cleared=await page.evaluate(()=>{
  S.quarters.Q3.operational.techX=3;
  const c=criticalPath('Q3',null);
  return {missed:c.missed.length, techMissed:c.missed.filter(m=>m.kind==='tech').length};
});
ck('D-02 · once the grade is held, the tech items stop being reported as missed',
  cleared.techMissed===0, `${cleared.missed} missed, ${cleared.techMissed} of them tech`);

// ---------- I-4 · forecast, then actual
const fc=await page.evaluate(()=>{
  const tq='Q4';
  const sc={id:'f1',name:'תחזית',base:'Q3',levers:{}};
  sc.levers[tq]={rd:120000,regions:{}};
  REGIONS.forEach(x=>sc.levers[tq].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0});
  Object.assign(sc.levers[tq].regions.europe,{production:20000,unitCost:50,price:140,qtySold:18000,sales:2520000});
  // a second quarter of levers, to prove the profit forecast is per-quarter and not the horizon sum
  sc.levers.Q5=JSON.parse(JSON.stringify(sc.levers.Q4));
  S.scenarios=[sc];
  const stored=captureForecast(tq,sc);
  const perQ=projectedNetForQuarter('Q3',sc.levers,tq), sum=projectedNetAdd('Q3',sc.levers);
  const before=forecastVariance(tq);
  S.quarters[tq].entered=true;
  S.quarters[tq].financial.netProfit=900000;
  S.quarters[tq].financial.cash={us:0,europe:1500000,brazil:200000,hq:100000};
  S.quarters[tq].marketIntel={competitors:{},sales:[{company:8,region:'europe',product:'Y',units:15000}],sources:[],generic:[],compPrices:[]};
  const after=forecastVariance(tq);
  return { stored, perQ, sum, before, metrics:after.rows.map(r=>r.metric),
    errs:after.rows.map(r=>({m:r.metric,err:r.err})), bias:forecastAccuracy().bias };
});
ck('I-4 · a forecast is stored for the committed quarter', !!fc.stored && fc.stored.q==='Q4');
ck('I-4 · the stored profit is the QUARTER figure, not the horizon sum',
  fc.stored.netProfit===fc.perQ && fc.perQ!==fc.sum, `quarter ${fc.perQ} vs sum ${fc.sum}`);
ck('I-4 · no variance is reported before the quarter is ingested', fc.before===null);
ck('I-4 · after ingestion, cash / profit / units are compared',
  fc.metrics.length===3 && fc.metrics.includes('מזומן מאוחד') && fc.metrics.includes('רווח נקי') && fc.metrics.includes('יחידות שנמכרו'),
  fc.metrics.join(' · '));
ck('I-4 · revenue is deliberately excluded — its unit basis is unconfirmed',
  !fc.metrics.some(m=>/מחזור/.test(m)));
ck('I-4 · errors are signed, so over- and under-forecasting are distinguishable',
  fc.errs.some(e=>e.err>0) && fc.errs.some(e=>e.err<0), JSON.stringify(fc.errs));
ck('I-4 · one measurement is never reported as a consistent bias',
  fc.bias.every(b=>b.n>1 || b.consistent===false), JSON.stringify(fc.bias.map(b=>[b.n,b.consistent])));

// ---------- it reaches the screen
await page.evaluate(()=>{ S.quarters.Q3.operational.techX=0; S.quarters.Q4.entered=false; save(); });
await page.evaluate(()=>go('plan')); await page.waitForTimeout(900);
const ui=await page.evaluate(()=>{
  const d=[...document.querySelectorAll('details')].find(x=>/הנתיב המתגלגל/.test(x.textContent));
  if(d) d.open=true;
  const t=document.body.innerText;
  return { card:/הנתיב הקריטי/.test(t), missed:/כבר איחרנו/.test(t), now:/חייבות להתחיל/.test(t),
    section:!!d, rows:d?d.querySelectorAll('tbody tr').length:0, q9:/Q9/.test(d?d.innerText:''),
    x3:/דרגת X3/.test(t) };
});
ck('D-02 · the critical path is on the decisions page, above the decisions', ui.card===true);
ck('D-02 · missed start dates and start-now items are both shown', ui.missed && ui.now);
ck('D-02 · the rolling table has one row per remaining quarter and reaches Q9',
  ui.rows===6 && ui.q9===true, `${ui.rows} rows`);
ck('D-02 · the X3 grade requirement is named on screen', ui.x3===true);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('WAVE 3 — rolling plan Q4->Q9 and forecast accuracy')?1:0);
})();
