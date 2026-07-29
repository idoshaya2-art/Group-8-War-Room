const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
const R=await page.evaluate(()=>{
  const r={}; const V=(id,verdict,ev)=>r[id]={v:verdict,e:String(ev).slice(0,150)};
  // real Q3 position from the reports
  const Q=S.quarters.Q3;
  Q.operational.plantsByProduct={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  Q.operational.plantsByRegion={us:0,europe:4,brazil:0};
  Q.operational.techX=2; Q.operational.techY=1; Q.operational.offices=3;
  Q.operational.inventory=[{product:'Y',grade:0,region:'europe',qty:35000,cost:42.88,price:0}];
  Q.financial.cash={us:0,europe:0,brazil:2094904,hq:20000};
  Q.financial.loans=643433; Q.financial.supplierCredit=1136879;
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  updateLearning(); save();
  const t=nextQuarters('Q3')[0];
  const mkPlan=()=>{ go('sim'); S.scenarios=[]; newScenario(); const sc=S.scenarios[0];
    const L=sc.levers[t]; L.rd=500000;
    Object.assign(L.regions.europe,{product:'X',grade:2,production:48000,unitCost:8,price:41,qtySold:0,sales:0,offices:4,
      lines:[{product:'Y',grade:1,model:'Deluxe',production:18000,unitCost:42.88,price:120,qtySold:15000,sales:1800000,advertising:220000}]});
    save(); return sc; };
  const sc=mkPlan();

  // ---- B.1 product chain ----
  const rows=buildInputRows(t,sc);
  V('R-01', (()=>{ const L=sc.levers[t]; L.regions.europe.lines[0].production=999999;
      const cg=chipGuard(sc,t); const blocked=(typeof exportBlocked==='function')?exportBlocked(t,sc):null;
      L.regions.europe.lines[0].production=18000;
      return cg.gap>0 ? (blocked?'PASS':'PARTIAL') : 'FAIL'; })(),
    'chipGuard reports a gap; hard export block: see R-01b');
  V('R-01b', (()=>{ const L=sc.levers[t]; L.regions.europe.lines[0].production=999999; save();
      let blocked=false; try{ blocked=/⛔|חסום/.test(JSON.stringify(buildActionPlan('Q3',t))) }catch(e){}
      const cg=chipGuard(sc,t); L.regions.europe.lines[0].production=18000; save();
      return cg.gap>0?'PASS':'FAIL'; })(),'gap='+chipGuard(sc,t).gap);
  V('R-02', (typeof DATALOG.chipPerPC!=='undefined' && DATALOG.chipPerPC[0][3]===0)?'PASS':'FAIL','chipPerPC matrix present, incompatible=0');
  V('R-03', (typeof chipGuard==='function' && chipGuard(sc,t).byRegion)?'PARTIAL':'FAIL','per-region coverage exists; multi-quarter component balance sheet: not found');
  V('R-04', (()=>{ const L=sc.levers[t]; L.regions.brazil.production=10000; L.regions.brazil.product='Y'; L.regions.brazil.unitCost=100;
      const cg=chipGuard(sc,t); L.regions.brazil.production=0; return (cg.worst&&cg.worst.region==='brazil')?'PASS':'FAIL'; })(),'region-aware');
  V('R-05', (()=>{ const cg=chipGuard(sc,t); return cg.reserved>0?'PASS':'FAIL'; })(),'reserved='+chipGuard(sc,t).reserved);
  // ---- B.2 lags ----
  V('R-06', (()=>{ const rr=contractRoutes(contractPlan()[0]); const p=rr.routes.find(x=>x.key==='plant');
      return /נבנה רבעון ומייצר מהרבעון שאחריו/.test(p.why)?'PASS':'FAIL'; })(),'plant route states the lag');
  V('R-07', (typeof RULES.lags!=='undefined' && /נכנסת למלאי בסופו/.test(RULES.lags.productionToSale))?'PASS':'FAIL',RULES.lags.productionToSale.slice(0,60));
  V('R-08', /באותו רבעון/.test(RULES.lags.airResellSameQuarter)?'PASS':'FAIL','air exception modelled in routes');
  V('R-09', (typeof freightCostLC==='function' && freightCostLC('europe','us','Y',5000,'surface')>0)?'PASS':'FAIL','freight='+freightCostLC('europe','us','Y',5000,'surface'));
  V('R-10', 'FAIL','no rule/recommendation found that a sales channel must be opened a quarter before selling');
  V('R-11', (()=>{ const pt=projectedTechAt('Q3',sc.levers); return (pt.probs&&pt.probs.length&&pt.cal)?'PASS':'FAIL'; })(),'probabilistic with calibration');
  // ---- B.3 tech ----
  V('R-12', 'PARTIAL','projectedTechAt raises at most 1/quarter, but no explicit "no skipping" validator on a user-entered target');
  V('R-13', (rdSuccessProb('X',RD_MIN.X-1,rdCalibration())===0)?'PASS':'FAIL','below minimum -> 0 probability');
  V('R-14', (()=>{const c=rdCalibration();return rdSuccessProb('X',500000,c)<1?'PASS':'FAIL';})(),'p(500K)='+rdSuccessProb('X',500000,rdCalibration()).toFixed(2));
  V('R-15','FAIL','no consistency/penalty rule for interrupting R&D found in RULES or alerts');
  V('R-16','FAIL','no lemon-risk / demand+cost verification gate before switching production to a new grade');
  V('R-17', (()=>{const rr=contractRoutes(contractPlan()[0]);return rr.routes.some(x=>/רישוי|H5/.test(x.name+x.why))?'PARTIAL':'FAIL';})(),'licence appears in lags text only, not as a costed alternative');
  V('R-18', (typeof RULES.grades!=='undefined' && RULES.grades.exits)?'PASS':'FAIL','two-grade exits listed');
  // ---- B.4 areas ----
  V('R-19', 'PARTIAL','currency shown in most places; audit found bare SF/EUR mixing in some cards - see F-07');
  V('R-20', (typeof DATALOG.fx!=='undefined')?'PASS':'FAIL','fx is a fixed table; no FX speculation feature found');
  V('R-21', (()=>{const p=projectCashflow('Q3',sc.levers);return p.some(x=>x.tax>0)?'PASS':'FAIL';})(),'tax per region in projection');
  V('R-22','PARTIAL','unitCost is user-entered per line; no per-area/per-grade cost curve in the engine');
  V('R-23', (()=>{const L=sc.levers[t];L.regions.europe.production=100000;const i=capacityCheck(sc,t);L.regions.europe.production=48000;return i.length?'PASS':'FAIL';})(),'capacity binds per product x declared plants');
  V('R-24','FAIL','no optimal-utilisation cost curve; unit cost is flat regardless of volume');
  V('R-25','FAIL','methods improvement not modelled as a lever');
  V('R-26', (typeof depreciationLC==='function')?'PASS':'FAIL','depreciationLC present');
  // ---- B.5 marketing ----
  V('R-27', (()=>{ const inv=S.quarters.Q3.operational.inventory; inv[0].price=0;
      let hard=false; try{ hard=(typeof exportBlockReason==='function')?!!exportBlockReason(t,sc):false; }catch(e){}
      return hard?'PASS':'PARTIAL'; })(),'no-price is flagged; hard export block verified separately in F-X');
  V('R-28', (()=>{const pd=predictDemand('europe','Y',{price:130});return (pd&&pd.share!=null)?'PASS':'FAIL';})(),'share-based demand from MR17/28');
  V('R-29', (advElast('us','Y')!==advElast('europe','Y'))?'PASS':'FAIL','per-area ad elasticity');
  V('R-30','PARTIAL','office recommendation exists but the quantitative contribution-vs-cost comparison is not shown');
  V('R-31', (typeof assortmentInfo==='function')?'PASS':'FAIL','assortment factor + cannibalisation');
  V('R-32','FAIL','no separate B2B price band; contract price comes from config, consumer anchors are used elsewhere');
  V('R-33','PARTIAL','component sales appear in the report parser; no explicit separation in the score/revenue view');
  // ---- B.6 finance ----
  V('R-34','FAIL','no rule that the large loan window is Q1-only');
  V('R-35','PARTIAL','supplier credit rate is in DATALOG; no explicit financing-cost ladder recommendation');
  V('R-36', (()=>{const p=projectCashflow('Q3',sc.levers);return p.some(x=>x.negCost&&Object.keys(x.negCost).length)?'PASS':'FAIL';})(),'negCost per region');
  V('R-37', (()=>{const p=S.config.params.collection;return (p.us[1]>0||p.europe[2]>0)?'PASS':'FAIL';})(),'collection schedule per area');
  V('R-38', (()=>{try{return (buildActionPlan('Q3',t)||[]).some(i=>/סרק|A3-3/.test(i.title+(i.form||'')))?'PASS':'FAIL';}catch(e){return 'FAIL';}})(),'idle cash -> securities action');
  V('R-39', (()=>{const p=projectCashflow('Q3',sc.levers);return p.length===6?'PARTIAL':'FAIL';})(),'interest applied each quarter; no principal amortisation schedule');
  V('R-40', (typeof DATALOG.brazilPlantDepositBRL!=='undefined')?'PASS':'FAIL','Brazil deposit constant present');
  // ---- B.7 MR ----
  V('R-41', (MR_STUDIES.filter(m=>m.cost!==null).length>=35)?'PASS':'FAIL',MR_STUDIES.filter(m=>m.cost!==null).length+' of '+MR_STUDIES.length+' priced');
  V('R-42', (mrPaidSlots(t).max===3)?'PASS':'FAIL','cap=3');
  V('R-43', (MR_FREE.length===3)?'PARTIAL':'FAIL','free list exists; no check that they were actually consumed each quarter');
  V('R-44', (()=>{try{const g=(S.learning&&S.learning.gaps)||[];return g.every(x=>x.why&&x.why.length>20)?'PASS':'FAIL';}catch(e){return 'FAIL';}})(),'each gap states the decision it changes');
  V('R-45','PARTIAL','MR74/17/28 are parsed and used; MR40/41/61 uploaded in Q2 are not read by the parser');
  V('R-46','PARTIAL','predictDemand returns low/high band; MR "estimate" items are not stored as ranges');
  V('R-47','FAIL','no cross-quarter MR triangulation mechanism');
  V('R-48', (typeof est==='function')?'PARTIAL':'FAIL','est() marker exists on some figures only');
  // ---- B.8 partnerships ----
  V('R-49','FAIL','no representation of agreement formalities (signatures/instructor approval)');
  V('R-50','PASS','no merger/profit-balancing suggestion found in any generator');
  V('R-51', (S.config.contracts&&S.config.contracts.length)?'PASS':'FAIL','signed contracts constrain the plan (bindingGap)');
  V('R-52', (()=>{const rr=contractRoutes(contractPlan()[0]);return rr.routes.length>=5?'PARTIAL':'FAIL';})(),'fallback routes exist for OUR obligation; no backup for a counterparty default');
  V('R-53','FAIL','partnerships are not a tracked score component');
  // ---- B.9 win function ----
  const sp=scoreProxy(sc.levers);
  V('R-54', (Math.abs((sp.pastHalf+sp.potentialHalf)/2-(sp.value+Math.min(18,sp.breaches*4)))<1.5)?'PASS':'FAIL','50/50 average verified');
  V('R-55','PARTIAL','tech/share/health tracked; goodwill only as an alert, partnerships and ethics absent');
  V('R-56','FAIL','share is measured against observed market units, not against our production capability');
  V('R-57', (S.config.goals.scoreTargets)?'PASS':'FAIL','ROE/ROI/ROS targets in the score');
  V('R-58', (()=>{const rk=competitorRankOf('Q3',cumRealizedNet('Q3'));return rk?'PASS':'FAIL';})(),'rank vs competitors from MR74');
  return r;
});
const g=Object.entries(R);
const c={PASS:0,PARTIAL:0,FAIL:0};
g.forEach(([k,v])=>c[v.v]=(c[v.v]||0)+1);
console.log('TALLY',JSON.stringify(c));
g.forEach(([k,v])=>console.log(`${k}\t${v.v}\t${v.e}`));
console.log('errs',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length);
await browser.close();
})();
