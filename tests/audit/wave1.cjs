/* Regression for wave 1 of the audit findings: D-04, D-06, D-07, D-08, R-34, R-56.
   Each check asserts the measured behaviour the fix was verified against. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---- R-56 · a share target is capped by what the plants can produce
const r56=await page.evaluate(()=>{
  const out={};
  S.quarters.Q3.marketIntel.sales=[{company:8,region:'europe',product:'Y',units:9000},
    {company:2,region:'europe',product:'Y',units:400000},{company:5,region:'europe',product:'Y',units:400000}];
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:1,Y:1},brazil:{X:0,Y:0}};
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:2,brazil:0};
  out.bind={cap:+shareCapacityCeiling().pct.toFixed(2), ...(({shareIdeal,q9Share,shareCapped})=>({shareIdeal,q9Share,shareCapped}))(recommendGoals())};
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:0,Y:0},brazil:{X:0,Y:0}};
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:0,brazil:0};
  out.none={cap:shareCapacityCeiling().pct, q9Share:recommendGoals().q9Share,
    cur:+(marketShareScore('Q3').share*100).toFixed(2)};
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:4,brazil:0}; S.config.plantSplit=null;
  out.unknown={cap:shareCapacityCeiling(), capShare:recommendGoals().capShare};
  return out;
});
ck('R-56 · the capacity ceiling binds a 2x-fair-share target down',
  r56.bind.shareCapped===true && r56.bind.q9Share<r56.bind.shareIdeal,
  `ideal ${r56.bind.shareIdeal}% → ${r56.bind.q9Share}% (ceiling ${r56.bind.cap}%)`);
ck('R-56 · no plants ⇒ target floors at the share we already hold, not at 0',
  r56.none.cap===0 && r56.none.q9Share>=Math.floor(r56.none.cur),
  `ceiling 0 · target ${r56.none.q9Share}% vs held ${r56.none.cur}%`);
ck('R-56 · an undeclared plant split returns null rather than a guess',
  r56.unknown.cap===null && r56.unknown.capShare===null);

/* R-34's checks used to live here and asserted `RULES.finance.loanWindow.openQuarters === ['Q1']`.
   Reading the guide showed that rule was backwards — "loans are not available UNTIL the Bank has a
   sense for how the industry is developing", so the EARLY quarters are the closed ones. Keeping
   these assertions would have pinned the bug in place. They are replaced by the corrected checks in
   wave2.cjs, which assert the sourced behaviour instead. Deliberately not re-stated here. */
await page.evaluate(()=>{
  S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:4,brazil:0};
});

// ---- D-04 · every Q9 target says what drives it
const d04=await page.evaluate(()=>({
  cum:goalDriver('cumProfitTarget'), score:goalDriver('q9Score'),
  share:goalDriver('q9Share'), tech:goalDriver('techXTarget'), roe:goalDriver('roe') }));
ck('D-04 · a competitor-anchored profit target says so', /המתחרה המוביל|הקצב שלנו/.test(d04.cum));
ck('D-04 · the Q9 score target is declared as a manual aspiration', /שאיפה שהצוות קבע/.test(d04.score));
ck('D-04 · the tech target is declared as a physical ceiling', /תקרה פיזית/.test(d04.tech));
ck('D-04 · every driver string is non-empty', [d04.cum,d04.score,d04.share,d04.tech,d04.roe].every(s=>s&&s.length>10));

// ---- D-08 · per-form and per-value copy on the submission sheet
const d08=await page.evaluate(()=>{
  const tq=nextQuarters(S.activeQuarter)[0];
  const sc={id:uid(),name:'t',base:S.activeQuarter,levers:{},createdAt:Date.now()};
  sc.levers[tq]={rd:120000,regions:{}};
  REGIONS.forEach(x=>sc.levers[tq].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0});
  ['us','europe','brazil'].forEach(rid=>Object.assign(sc.levers[tq].regions[rid],
    {production:10000,unitCost:50,price:140,qtySold:9000,sales:1260000,advertising:60000,offices:2}));
  S.scenarios=[sc]; save(); return buildInputRows(tq,sc).length;
});
await page.evaluate(()=>go('export')); await page.waitForTimeout(700);
const sheet=await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')];
  return { value:b.filter(x=>/העתק את הערך/.test(x.title||'')).length,
    group:b.filter(x=>/כל שדות/.test(x.title||'')).length,
    all:b.some(x=>/כל הגיליון/.test(x.textContent)) }; });
ck('D-08 · one copy button per sheet row', sheet.value===d08, `${sheet.value} buttons / ${d08} rows`);
ck('D-08 · a copy button for every form that has more than one field', sheet.group>=3, `${sheet.group} form groups`);
ck('D-08 · a copy-everything button', sheet.all===true);
const copied=await page.evaluate(async()=>{ try{ await copyText('123','x'); return true; }catch(e){ return false; } });
ck('D-08 · the copy path does not throw where clipboard access is unavailable', copied===true);

// ---- D-07 · thumb-sized controls, still no horizontal overflow
await page.setViewportSize({width:390,height:844});
const pages=['dashboard','plan','sim','export','financials','ingest'];
let small=0, over=0;
for(const p of pages){ await page.evaluate(k=>go(k),p); await page.waitForTimeout(400);
  const m=await page.evaluate(()=>({ s:[...document.querySelectorAll('button')]
      .filter(b=>{const r=b.getBoundingClientRect(); return r.width>0 && r.height<32;}).length,
    o:document.documentElement.scrollWidth-document.documentElement.clientWidth }));
  small+=m.s; over+=m.o; }
ck('D-07 · no button under 32px on a phone, across all six pages', small===0, `${small} found`);
ck('D-07 · the min-height did not introduce horizontal overflow', over===0, `${over}px`);

ck('no JavaScript errors during any of the above',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('WAVE 1 — audit findings')?1:0);
})();
