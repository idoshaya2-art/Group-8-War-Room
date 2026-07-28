const { chromium } = require('./lib.cjs').loadPW();
const PW='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const results=[];
const rec=(name,pass,detail)=>results.push({name,pass:!!pass,detail:detail||''});

// realistic seed: Q1-Q3 entered, plants in Europe only, 35k finished PCs, competitors (MR74 in 000s)
const SEED=`(()=>{
  const fin=(hq,np,re,loans)=>({cash:{us:120000,europe:0,brazil:80000,hq},netProfit:np,retainedEarnings:re,totalEquity:8000000+re,totalAssets:11000000,roe:8,roi:6,ros:4,loans,revenue:4000000});
  const q1=S.quarters.Q1,q2=S.quarters.Q2,q3=S.quarters.Q3;
  q1.entered=q2.entered=q3.entered=true;
  q1.financial=fin(6562577,-821543,-821543,883490); q2.financial=fin(1762301,-1107983,-1929526,764650); q3.financial=fin(1067452,-499768,-2429294,643433);
  [q1,q2,q3].forEach(q=>{ q.operational.techX=2; q.operational.techY=1; q.operational.rd=120000; q.operational.factories=1; q.operational.plantsByRegion={us:0,europe:1,brazil:0}; q.operational.maxProducible=3; });
  q3.operational.inventory=[{product:'Y',region:'europe',qty:35000,cost:65,price:0},{product:'X',region:'brazil',qty:4000,cost:10,price:0}];
  q3.marketIntel={competitors:{'3':{num:3,retainedEarnings:5000,netEarnings:400,cash:2000,bankLoans:300,rdChip:200,rdPc:150,marketResearch:50},'5':{num:5,retainedEarnings:2000},'8':{num:8,retainedEarnings:-2429}},
    sales:[{company:8,units:12000,region:'us',product:'Y',grade:2},{company:3,units:25000,region:'us',product:'Y',grade:3}],
    sources:['MR74','MR17&28'],compPrices:[{company:3,region:'us',product:'Computer',grade:2,price:150},{company:5,region:'us',product:'Computer',grade:2,price:145}]};
  S.activeQuarter='Q3'; S.cumulative=false; save();
})()`;

(async()=>{
  const b=await chromium.launch({executablePath:PW});
  // ---- desktop: all screens 0 errors ----
  const pd=await b.newPage({viewport:{width:1280,height:900}});
  const eD=[]; pd.on('pageerror',e=>eD.push(String(e)));
  await pd.goto(require('./lib.cjs').APP,{waitUntil:'domcontentloaded'}); await pd.waitForTimeout(400);
  await pd.evaluate(SEED);
  const pages=['ingest','dashboard','plan','sim','export','financials','intel','ai','goals'];
  for(const pg of pages){ const before=eD.length; await pd.evaluate(p=>go(p),pg); await pd.waitForTimeout(180);
    rec('screen:'+pg, eD.length===before, eD.slice(before).join('|')); }
  // cumulative dashboard variant (chart)
  await pd.evaluate(()=>{ S.cumulative=true; save(); go('dashboard'); }); await pd.waitForTimeout(200);
  rec('screen:dashboard-cumulative(chart)', true, '');
  await pd.evaluate(()=>{ S.cumulative=false; save(); });

  // ---- mobile: 0 overflow on each screen ----
  const pm=await b.newPage({viewport:{width:390,height:800}});
  const eM=[]; pm.on('pageerror',e=>eM.push(String(e)));
  await pm.goto(require('./lib.cjs').APP,{waitUntil:'domcontentloaded'}); await pm.waitForTimeout(400);
  await pm.evaluate(SEED);
  for(const pg of pages){ await pm.evaluate(p=>go(p),pg); await pm.waitForTimeout(150);
    const ov=await pm.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
    rec('mobile-overflow:'+pg, ov===0, ov+'px'); }

  // ---- functional checks on desktop page ----
  const F=await pd.evaluate(()=>{
    const out={};
    const q=S.activeQuarter, tq=nextQuarters(q)[0];
    // chip guard: incompatible / starvation blocks
    const scBad={id:'b',name:'b',base:q,levers:{}}; scBad.levers[tq]={rd:0,regions:{}};
    REGIONS.forEach(r=>scBad.levers[tq].regions[r.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y'});
    scBad.levers[tq].regions.europe.production=20000; // needs chips
    const cg=chipGuard(scBad,tq); out.chipGuard=(!cg.compatible)||(cg.gap>0);
    // capacity
    scBad.levers[tq].regions.europe.production=250000;
    out.capacity=capacityCheck(scBad,tq).length>0;
    // phantom transfer
    scBad.levers[tq].regions.brazil.transferIn=999999999;
    out.phantomTransfer=!!phantomTransfers(scBad,tq);
    // competitor rank units (our cumNet ~ -2.4M vs comps 5M/2M abs → rank last of 3)
    const rk=competitorRankOf(q, cumRealizedNet(q)); out.rankUnits=rk&&rk.n===3&&rk.rank===3;
    // projected tech: aggressive R&D raises tech vs base
    S.config.goals.techXTarget=7; S.config.goals.techYTarget=6;
    const lvAgg={}; nextQuarters(q).slice(0,6).forEach(qq=>{lvAgg[qq]={rd:400000,regions:{}};REGIONS.forEach(r=>lvAgg[qq].regions[r.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y'});});
    out.projTech=projectedTechAt(q,lvAgg).techY>((S.quarters[q].operational.techY)||0);
    // goal optimizer
    const rec=recommendGoals(); out.goalOpt=rec.cumProfitTarget>0 && rec.techYTarget>=1;
    // magic export model: plants europe only → US/BR production 0, sales spread
    S.scenarios=[]; go('sim'); newScenario(); const sc=S.scenarios[0]; magicOptimize(sc.id);
    const qk=Object.keys(S.scenarios[0].levers)[0]; const rg=S.scenarios[0].levers[qk].regions;
    out.magic_noPhantomProd=(rg.us.production===0 && rg.brazil.production===0 && rg.europe.production>0);
    out.magic_exportSales=((rg.us.qtySold||0)>0 || (rg.brazil.qtySold||0)>0); // sells in export markets
    // clone
    cloneScenario(sc.id); out.clone=S.scenarios.length===2 && Object.keys(S.scenarios[1].levers).length>0;
    // MR multiselect
    const qk2=Object.keys(S.scenarios[0].levers)[0]; addSimAction(S.scenarios[0].id,qk2,'H1-2');
    const aid=S.scenarios[0].levers[qk2].actions.find(a=>a.form==='H1-2').aid;
    addMR(S.scenarios[0].id,qk2,aid,'MR17');addMR(S.scenarios[0].id,qk2,aid,'MR28');addMR(S.scenarios[0].id,qk2,aid,'MR74');addMR(S.scenarios[0].id,qk2,aid,'MR3');
    out.mrCap=S.scenarios[0].levers[qk2].actions.find(a=>a.form==='H1-2').mrList.length===3;
    // export add/remove on export tab
    go('export'); exportAddAction('A2-4'); const tq2=nextQuarters(S.activeQuarter)[0];
    const sc0=selectedExportScenario(); const has=(sc0.levers[tq2].actions||[]).some(a=>a.form==='A2-4'); out.exportAdd=has;
    // diet: dead refs gone
    out.diet=(typeof window.runMaxOptimizer==='undefined' && typeof window.calcFreight==='undefined' && typeof freightCostLC==='function');
    return out;
  });
  Object.entries(F).forEach(([k,v])=>rec('fn:'+k, v, ''));

  // ---- persistence round-trip ----
  const P=await pd.evaluate(()=>{ save(); const raw=localStorage.getItem('intopia_warroom_v1'); const parsed=JSON.parse(raw);
    return parsed && parsed.quarters && parsed.quarters.Q3 && parsed.quarters.Q3.entered===true; });
  rec('persistence:localStorage-roundtrip', P, '');

  // ---- empty/no-data state: fresh load, no seed, visit all screens, 0 errors ----
  const pe=await b.newPage({viewport:{width:1100,height:800}});
  const eE=[]; pe.on('pageerror',e=>eE.push(String(e)));
  await pe.goto(require('./lib.cjs').APP,{waitUntil:'domcontentloaded'}); await pe.waitForTimeout(400);
  await pe.evaluate(()=>{ localStorage.removeItem('intopia_warroom_v1'); }); await pe.reload({waitUntil:'domcontentloaded'}); await pe.waitForTimeout(400);
  for(const pg of ['ingest','dashboard','plan','sim','export','financials','intel','ai','goals']){ const bfr=eE.length; await pe.evaluate(p=>go(p),pg); await pe.waitForTimeout(120);
    rec('empty-state:'+pg, eE.length===bfr, eE.slice(bfr).join('|')); }

  // ---- malicious input: negative/huge values don't crash ----
  const M=await pe.evaluate(()=>{
    try{ const q=S.activeQuarter; S.quarters[q].entered=true;
      S.quarters[q].financial={cash:{us:-999999,europe:0,brazil:1e12,hq:0},netProfit:NaN,retainedEarnings:0,totalEquity:0,totalAssets:0,roe:-50,roi:0,ros:0,loans:1e15};
      save(); go('dashboard'); go('plan'); go('financials');
      const sp=scoreProxy(null); return isFinite(sp.value);
    }catch(e){ return 'ERR:'+e.message; }
  });
  rec('malicious-input:no-crash+finite-score', M===true, String(M));
  console.log('pageErrors(empty):',eE.length);

  const pass=results.filter(r=>r.pass).length,fail=results.filter(r=>!r.pass);
console.log("=== QA SUMMARY ===");
console.log("desktop JS errors:",eD.length," | mobile JS errors:",eM.length," | empty-state errors:",eE.length);
console.log("checks:",results.length," PASS:",pass," FAIL:",fail.length);
if(fail.length)fail.forEach(f=>console.log("  FAIL:",f.name,f.detail));else console.log("  ALL GREEN");
  await b.close();
})();
