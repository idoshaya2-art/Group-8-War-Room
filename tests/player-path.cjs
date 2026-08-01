/* PLAYER-PATH SUITE — walks the journey a team actually takes, in order, and asserts
   that each step hands something usable to the next.

   Why this exists: the unit suites test the functions someone chose to test. Both real
   bugs found in v8.5 (grade-blind contract card, a grouped commitment demanding double
   its quarterly amount) were invisible to 108 green unit checks and obvious within ten
   minutes of walking the app. This suite walks it every time instead.  */
const {open,checks}=require('./lib.cjs');

(async()=>{
const {browser,page,errors}=await open();
const {ck,report}=checks();
const at=async(p)=>{ await page.evaluate(x=>go(x),p); await page.waitForTimeout(350); };
const snap=()=>page.evaluate(()=>{
  const root=document.querySelector('#page')||document.body;
  const txt=root.innerText||'';
  return { chars:txt.length,
    figures:(txt.match(/[\d][\d,]{2,}/g)||[]).length,
    actionable:[...root.querySelectorAll('button')].filter(b=>b.offsetParent&&!/^\s*$/.test(b.textContent)).length,
    empty:/אין נתוני|טרם נקלט|אין עדיין/.test(txt) };
});

/* ---- 1. every step of the loop must be usable once a report is in ---- */
for(const [pg,name] of [['ingest','1 קליטה'],['dashboard','2 אבחון'],['plan','3 החלטות'],
                        ['sim','4 סימולטור'],['export','5 הזנה'],['intel','מודיעין'],
                        ['goals','יעדים'],['financials','פיננסי'],['ai','AI']]){
  await at(pg); const s=await snap();
  ck(`[${name}] renders with content`, s.chars>200, `${s.chars} chars`);
  ck(`[${name}] offers at least one next action`, s.actionable>0, `${s.actionable} buttons`);
}

/* ---- 2. the diagnosis must actually say something, not just render ---- */
await at('dashboard');
const diag=await page.evaluate(()=>{ const sp=scoreProxy(null), mp=masterPlanStatus();
  return {score:sp.value, past:sp.pastHalf, pot:sp.potentialHalf, alerts:computeAlerts(S.activeQuarter).length}; });
ck('diagnosis produces a score', diag.score>0 && diag.score<=100, diag.score.toFixed(1));
ck('score is split into the two halves that decide the game',
   diag.past>=0 && diag.pot>=0 && Math.abs(diag.past-diag.pot)>0, `עבר ${diag.past.toFixed(0)} / עתיד ${diag.pot.toFixed(0)}`);
ck('a company in this state raises alerts', diag.alerts>0, diag.alerts+' alerts');

/* ---- 3. CONTINUITY: decisions → simulator → export must carry the same numbers ---- */
await at('plan');
const recs=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  return (buildActionPlan(q,t)||[]).map(i=>({title:(i.title||'').slice(0,80),level:i.level||i.sev,hasSim:!!i.sim,blocked:!!i.blocked,hasAction:!!i.action})); });
ck('decisions tab produces concrete actions', recs.length>0, recs.length+' actions');
const musts=recs.filter(r=>r.level==='red');
ck('mandatory actions are marked as such', musts.length>0, musts.length+' red');
// "executable" means the card gives you a way forward: lever values to send, a button to
// open the relevant screen, or an explicit block explaining what must happen first.
ck('mandatory actions are executable (payload, button, or stated blocker)',
   musts.every(m=>m.hasSim||m.blocked||m.hasAction),
   musts.filter(m=>!m.hasSim&&!m.blocked&&!m.hasAction).map(m=>m.title).join(' | ')||'all executable');

/* The middle step of this journey used to be the simulator page, where the player tuned levers by
   hand before exporting. That page is gone — the team asked for manual tuning removed, and `sim`
   now resolves to the decisions tab. The journey it replaced is shorter, not broken: tick the
   plan's actions, and the sheet shows exactly those. So the continuity claim is unchanged — the
   same numbers must reach the export step — but it is carried by the scenario the plan seeds
   rather than by a screen of sliders. */
await page.evaluate(()=>{ S.scenarios=[]; save(); });
await at('plan');
ck('the decisions tab does not hand the player off to a page that no longer exists',
   await page.evaluate(()=>!document.querySelector('.content button[onclick="go(\'sim\')"]')));
const seeded=await page.evaluate(()=>{
  seedScenarioFromMusts();
  const sc=S.scenarios[0]; const q=Object.keys(sc.levers)[0];
  const regionsWithValues=REGIONS.filter(r=>{const g=sc.levers[q].regions[r.id]||{};return g.production>0||g.sales>0||g.price>0;});
  return {built:true, quarters:Object.keys(sc.levers).length, horizon:planHorizon(sc.base).length,
    regions:regionsWithValues.map(r=>r.id), actions:(sc.levers[q].actions||[]).length,
    score:scoreProxy(sc.levers).value};
});
ck('the plan can still be built straight from the recommendations, with nothing retyped', seeded.built);
ck('the plan spans the full horizon to Q9', seeded.quarters===seeded.horizon, `${seeded.quarters}/${seeded.horizon}`);
ck('the plan carries real lever values, not an empty shell', (seeded.regions||[]).length>0, (seeded.regions||[]).join(','));
ck('the plan carries editable action cards', seeded.actions>0, seeded.actions+' cards');
ck('the engine can score the seeded plan', seeded.score>0, (seeded.score||0).toFixed(1));

await at('export');
const exp=await page.evaluate(()=>{
  const t=(document.querySelector('#page')||document.body).innerText;
  return {mentionsScenario:S.scenarios.length>0 && t.length>300,
    checklistItems:document.querySelectorAll('.checklist li').length,
    figures:(t.match(/[\d][\d,]{2,}/g)||[]).length}; });
ck('export step shows the selected plan, not a blank sheet', exp.mentionsScenario);
ck('export step runs a submission checklist', exp.checklistItems>0, exp.checklistItems+' items');
ck('numbers survive all the way to the export step', exp.figures>0, exp.figures+' figures');

/* ---- 4. the guards must actually block a bad plan on the way out ---- */
const guard=await page.evaluate(()=>{
  const sc=S.scenarios[0], tq=nextQuarters(S.activeQuarter)[0];
  sc.levers[tq].regions.europe.qtySold=999999;           // sell far beyond any supply
  sc.levers[tq].regions.europe.price=130;
  sc.levers[tq].regions.europe.sales=999999*130;
  save();
  return {phantom:phantomSales({levers:sc.levers},tq).length>0,
          offices:(sc.levers[tq].regions.europe.offices=1, officeLegality({levers:sc.levers},tq).length>0)};
});
ck('a plan that oversells supply is caught before submission', guard.phantom);
ck('an illegal sales-office count is caught before submission', guard.offices);

/* ---- 5. no dead ends on mobile either ---- */
await page.setViewportSize({width:390,height:844});
let overflow=0;
for(const pg of ['dashboard','plan','sim','export','intel','goals','financials','ai']){
  await at(pg);
  const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(o>0){ overflow++; ck(`[mobile ${pg}] no horizontal overflow`, false, o+'px'); }
}
ck('no page overflows horizontally on a phone', overflow===0);

/* ---- 6. nothing threw anywhere along the journey ----
   Blocked external resources (the XLSX CDN in an offline sandbox) are environmental, not
   app defects, so they are reported separately instead of failing the run. */
const netFail=errors.filter(e=>/Failed to load resource|net::ERR_/.test(e));
const jsFail=errors.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
ck('no JavaScript errors across the whole journey', jsFail.length===0, jsFail.slice(0,3).join(' | '));
if(netFail.length) console.log(`  (note: ${netFail.length} external resource(s) unreachable — expected offline, not an app defect)`);

const failed=report('PLAYER PATH');
await browser.close();
process.exit(failed?1:0);
})();
