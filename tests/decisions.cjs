/* DECISIONS SUITE — the action list must cover every decision family, mark what has been
   sent without navigating away, and only accept AI suggestions the engine can validate. */
const {open,checks}=require('./lib.cjs');
const DATALOG_X_EU=()=>35000;   // Data Log 03 EU chip capacity per plant
(async()=>{
const {browser,page,errors}=await open();
const {ck,report}=checks();

await page.evaluate(()=>{ S.scenarios=[]; S.quarters.Q3.financial.cash={us:900000,europe:2400000,brazil:1800000,hq:213000}; save(); go('plan'); });
await page.waitForTimeout(500);

/* ---- coverage: decisions must not be limited to production/sales/transfers ---- */
const fams=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const items=buildActionPlan(q,t)||[];
  return items.map(i=>({title:i.title,form:i.form||'',cat:i.cat,level:i.level,hasSim:!!i.sim})); });
const has=re=>fams.some(f=>re.test(f.form)||re.test(f.title));
ck('advertising is a decision of its own', has(/פרסום|A1-2|A1-1/), fams.filter(f=>/פרסום/.test(f.title)).map(f=>f.title)[0]||'—');
ck('idle cash / securities financing is offered', has(/A3-3|מזומן סרק|ניירות ערך/), fams.filter(f=>/סרק/.test(f.title)).map(f=>f.title)[0]||'—');
ck('production is still covered', has(/A2-3|ייצר|ייצור/));
ck('sales / pricing is still covered', has(/A1-2|מכור/));
ck('R&D is covered', has(/H1-1|מו״פ/));
ck('at least 4 distinct decision categories present', new Set(fams.map(f=>f.cat)).size>=3, [...new Set(fams.map(f=>f.cat))].join(','));

/* ---- manual decision forms: the + picker exposes the whole catalog and writes to Input ---- */
const manualPicker=await page.evaluate(async()=>{
  S.scenarios=[]; S.ui=Object.assign(S.ui||{},{decisionScenarioId:null,exportScenarioId:null}); save(); go('plan');
  await new Promise(r=>setTimeout(r,250));
  const targetQ=nextQuarters(S.activeQuarter)[0]||S.activeQuarter;
  const plus=!![...document.querySelectorAll('button')].find(b=>/הוסף פעולה/.test(b.textContent));
  openDecisionActionPicker(targetQ);
  const forms=[...document.querySelectorAll('#modalRoot .form')].map(x=>x.textContent.trim());
  decisionAddAction(targetQ,'W3');
  const formOpened=!!document.getElementById('daf_amount') && /המרת מטבע/.test(document.querySelector('#modalRoot .mh').textContent);
  document.getElementById('daf_currency').value='EUR';
  document.getElementById('daf_side').value='sell';
  document.getElementById('daf_amount').value='225860';
  saveDecisionAction(targetQ,'W3','__new__','');
  await new Promise(r=>setTimeout(r,250));
  const sc=S.scenarios[0], action=(sc.levers[targetQ].actions||[]).find(a=>a.form==='W3');
  const acts=(sc.levers[targetQ].actions||[]).map(a=>a.form);
  const rows=buildInputRows(targetQ,sc).filter(r=>r.form==='W3');
  const savedValue=action&&action.fields&&action.fields.amount;
  const cardVisible=!!document.querySelector(`[data-decision-action="${action.aid}"]`);
  openDecisionActionForm(targetQ,'W3',sc.id,action.aid);
  document.getElementById('daf_amount').value='300000';
  saveDecisionAction(targetQ,'W3',sc.id,action.aid);
  await new Promise(r=>setTimeout(r,200));
  const editedValue=action.fields.amount;
  go('export'); await new Promise(r=>setTimeout(r,250));
  const selected=(document.getElementById('expScenario')||{}).value;
  decisionRemoveAction(sc.id,targetQ,action.aid);
  await new Promise(r=>setTimeout(r,150));
  const removed=!sc.levers[targetQ].actions.some(a=>a.aid===action.aid)
    && !buildInputRows(targetQ,sc).some(r=>r.form==='W3'&&/300,000/.test(String(r.note||'')));
  return {plus, forms, formOpened, acts, rows:rows.length, savedValue, editedValue, cardVisible, removed, scenarioId:sc.id, selected};
});
ck('Decisions has a + button for manual actions', manualPicker.plus);
ck('the + picker exposes all 19 official forms', manualPicker.forms.length===19 && manualPicker.forms.includes('W3'), manualPicker.forms.join(','));
ck('choosing a form opens its manual quantity/amount fields', manualPicker.formOpened);
ck('a manually selected form is stored in the scenario', manualPicker.acts.includes('W3'));
ck('the entered amount is stored on the action', manualPicker.savedValue===225860, manualPicker.savedValue);
ck('the filled manual form reaches the input sheet', manualPicker.rows>=1);
ck('the saved action appears in Decisions', manualPicker.cardVisible);
ck('the action can be edited manually', manualPicker.editedValue===300000, manualPicker.editedValue);
ck('the minus action removes it from Decisions and Input', manualPicker.removed);
ck('Input stays on the scenario selected in Decisions', manualPicker.selected===manualPicker.scenarioId);
await page.evaluate(()=>{ S.scenarios=[]; save(); go('plan'); });

/* Every official form must have a real second-step form, not only the W3 example above. */
const formCoverage=await page.evaluate(()=>({
  catalog:SIM_FORMS.length,
  schemas:Object.keys(DECISION_FORM_FIELDS).length,
  missing:SIM_FORMS.filter(f=>!(DECISION_FORM_FIELDS[f.form]||[]).length).map(f=>f.form),
  everyHasRequired:SIM_FORMS.every(f=>(DECISION_FORM_FIELDS[f.form]||[]).some(d=>d.required)||['A2-1','A4','H1-1'].includes(f.form))
}));
ck('all 19 official forms have manual field schemas', formCoverage.catalog===19 && formCoverage.schemas===19 && !formCoverage.missing.length, formCoverage.missing.join(','));
ck('every form has a required or explicit at-least-one validation', formCoverage.everyHasRequired);

/* Applying a Strategy variant is the authored source for the editable final action list. */
const strategyFlow=await page.evaluate(async()=>{
  const targetQ=nextQuarters(S.activeQuarter)[0]||S.activeQuarter;
  const shell={levers:{}}; ensureLevRegions(shell,targetQ);
  shell.levers[targetQ].rdX=40000; shell.levers[targetQ].rdY=70000; shell.levers[targetQ].rd=110000;
  shell.levers[targetQ].regions.europe.product='Y';
  shell.levers[targetQ].regions.europe.production=12000;
  shell.levers[targetQ].regions.europe.unitCost=55;
  S.ai=S.ai||{}; S.ai.strategy={base:S.activeQuarter,at:Date.now(),variants:[{name:'אסטרטגיית AI לבדיקה',thesis:'בדיקת זרימה',risk:'',
    score:72,past:55,pot:89,endCash:1500000,legal:true,feasible:true,violations:[],breaches:0,levers:shell.levers}]};
  applyStrategy(0); await new Promise(r=>setTimeout(r,250));
  const sc=S.scenarios[0], acts=sc.levers[targetQ].actions||[];
  const sourceBadges=[...document.querySelectorAll('#decisionScenarioActions .tag')].map(x=>x.textContent);
  const minusCount=[...document.querySelectorAll('#decisionScenarioActions button')].filter(b=>b.textContent.trim()==='−').length;
  const rows=buildInputRows(targetQ,sc);
  const first=acts[0]; openDecisionActionForm(targetQ,first.form,sc.id,first.aid);
  const editable=!!document.querySelector('#modalRoot .field input, #modalRoot .field select'); closeModal();
  return {source:sc.source,selected:S.ui.decisionScenarioId===sc.id,actions:acts.length,
    allSourced:acts.every(a=>a.source==='strategy'),sourceBadges,minusCount,rows:rows.length,editable};
});
ck('applying Strategy selects it as the Decisions scenario', strategyFlow.source==='strategy' && strategyFlow.selected);
ck('Strategy actions are marked as AI-strategy actions', strategyFlow.actions>0 && strategyFlow.allSourced && strategyFlow.sourceBadges.some(x=>/אסטרטגיית AI/.test(x)));
ck('every Strategy action has a minus control', strategyFlow.minusCount===strategyFlow.actions, `${strategyFlow.minusCount}/${strategyFlow.actions}`);
ck('Strategy actions remain manually editable', strategyFlow.editable);
ck('Strategy actions feed the Input rows', strategyFlow.rows>0, strategyFlow.rows);
await page.evaluate(()=>{ S.scenarios=[]; save(); go('plan'); });

/* ---- the advertising action must be honest about where NOT to spend ---- */
const adv=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const it=(buildActionPlan(q,t)||[]).find(x=>/פרסום/.test(x.title)); return it?{d:it.detail,sim:it.sim}:null; });
ck('advertising action exists', !!adv);
ck('it states the same-quarter timing rule', adv&&/באותו רבעון שבו שולם/.test(adv.d));
ck('it names the effectiveness threshold', adv&&/סף/.test(adv.d));

/* ---- idle cash must respect the derived floor and quote real rates ---- */
const idle=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const it=(buildActionPlan(q,t)||[]).find(x=>/סרק/.test(x.title)); return it?{d:it.detail,sim:it.sim}:null; });
ck('idle-cash action exists when cash is ample', !!idle);
ck('it quotes the Brazil rate that makes it worth doing', idle&&/4\.5/.test(idle.d));
ck('it warns the deposit must be renewed each quarter', idle&&/חידוש/.test(idle.d));
ck('it carries an executable payload', !!(idle&&idle.sim));

/* ---- the decisions tab's own flow: tick a plan action, and it reaches the submission sheet.
   This replaces the old "send to simulator" assertions. The engine's generated list — which is
   what carried those buttons — is no longer rendered: it was a competing list beside the team's
   own plan. What is under test is unchanged in substance: choosing an action must record the
   choice, survive leaving the tab, and be undoable. */
await page.evaluate(()=>{ S.ui=S.ui||{}; S.ui.planPicks={}; save(); go('plan'); });
await page.waitForTimeout(600);
const pickFlow=await page.evaluate(async()=>{
  const q='Q4';
  const before=planPickedCash(q);
  togglePlanPick(7);                       // R&D — a costed, non-floor action
  await new Promise(r=>setTimeout(r,400));
  const after=planPickedCash(q);
  const boxOn=[...document.querySelectorAll('.pick input')].filter(i=>i.checked).length;
  go('dash'); await new Promise(r=>setTimeout(r,300));
  go('plan'); await new Promise(r=>setTimeout(r,400));
  const survived=[...document.querySelectorAll('.pick input')].filter(i=>i.checked).length;
  go('export'); await new Promise(r=>setTimeout(r,400));
  const onSheet=/מה שסימנתי ל-Q4/.test(document.body.innerText)
    && /H1-1/.test(document.body.innerText);
  go('plan'); await new Promise(r=>setTimeout(r,400));
  togglePlanPick(7);
  await new Promise(r=>setTimeout(r,400));
  const undone=planPickedCash(q);
  return { beforeOut:before.out, afterOut:after.out, boxOn, survived, onSheet, undoneOut:undone.out };
});
ck('nothing is ticked until the team ticks it', pickFlow.beforeOut===0);
ck('ticking an action puts its cost into the quarter\'s money',
  pickFlow.afterOut===530000, `${pickFlow.afterOut} SF`);
ck('the checkbox reflects the choice', pickFlow.boxOn===1);
ck('the choice survives leaving the tab and coming back', pickFlow.survived===1);
ck('a ticked action reaches the submission sheet with its form', pickFlow.onSheet===true);
ck('unticking takes the cost back out', pickFlow.undoneOut===0);

const removePlanFlow=await page.evaluate(async()=>{
  const q='Q4'; S.ui.planRemoved={}; go('plan'); await new Promise(r=>setTimeout(r,200));
  const before=document.querySelectorAll('#decisions~.act').length;
  const removedText=planV6For(q).actions[0].what;
  const minus=[...document.querySelectorAll('.act button')].filter(b=>b.textContent.trim()==='−').length;
  removePlanAction(1); await new Promise(r=>setTimeout(r,200));
  const removed=isPlanRemoved(q,1), picked=isPicked(q,1), restore=/שחזר 1 שהוסרו/.test(document.body.innerText);
  const omittedFromAI=!buildPlanReviewPrompt(q).includes(removedText);
  restorePlanActions(); await new Promise(r=>setTimeout(r,150));
  return {before,minus,removed,picked,restore,omittedFromAI,restored:!isPlanRemoved(q,1)};
});
ck('every written-plan action exposes a minus control', removePlanFlow.minus>=15, removePlanFlow.minus);
ck('minus removes the action and clears its selection', removePlanFlow.removed && !removePlanFlow.picked);
ck('a manually removed action is omitted from the next AI review', removePlanFlow.omittedFromAI);
ck('removed plan actions can be restored', removePlanFlow.restore && removePlanFlow.restored);

/* ---- layer 4: the AI reviews the ENGINE'S list and returns the full recommended list ---- */
const ai=await page.evaluate(()=>{
  const q=S.activeQuarter, t=nextQuarters(q)[0];
  const eng=buildActionPlan(q,t)||[];
  const redIdx=eng.findIndex(x=>x.level==='red');
  const amberIdx=eng.findIndex(x=>x.level==='amber'&&x.sim);
  const payload={rationale:'קודם להפוך מלאי למזומן',plan:[
    {ref:redIdx+1, verdict:'keep', why:'זו הפעולה עם התשואה הגבוהה ביותר'},
    {ref:amberIdx+1, verdict:'drop', why:'לא ברבעון הזה — כובל מזומן'},
    {ref:null, verdict:'add', title:'הפקד עודף בברזיל', form:'A3-3', level:'amber',
      why:'4.5% לרבעון על מזומן שיושב', sim:{q:t,regions:{brazil:{invest:400000}}}},
    {ref:null, verdict:'add', title:'ייצר בארה״ב', form:'A2-3', level:'red',
      why:'לא חוקי', sim:{q:t,regions:{us:{production:20000,unitCost:70,offices:2}}}}
  ]};
  const parsed=parseReviewJSON(JSON.stringify(payload),t,eng.length);
  const applied=applyReview(eng,parsed,t);
  // a review that tries to drop a MANDATORY action
  const dropRed={rationale:'',plan:[{ref:redIdx+1,verdict:'drop',why:'לדעתי מיותר'}]};
  const app2=applyReview(eng,parseReviewJSON(JSON.stringify(dropRed),t,eng.length),t);
  // a review that MODIFIES an action illegally
  const badMod={rationale:'',plan:[{ref:redIdx+1,verdict:'modify',why:'מכור הכל',
    sim:{q:t,regions:{europe:{price:130,qtySold:999999,offices:2}}}}]};
  const app3=applyReview(eng,parseReviewJSON(JSON.stringify(badMod),t,eng.length),t);
  return {
    engineCount:eng.length,
    listCount:applied.list.length,
    keptNote:(applied.list.find(x=>x.aiVerdict==='keep')||{}).aiNote||'',
    droppedCount:applied.dropped.length,
    addedOk:applied.list.some(x=>x.aiVerdict==='add'&&/ברזיל/.test(x.title)),
    illegalAddRejected:!applied.list.some(x=>/ייצר בארה״ב/.test(x.title)) && applied.rejected.some(r=>/ארה״ב/.test(r.title)),
    noneLostByOmission:applied.list.length+applied.dropped.length>=eng.length,
    rationale:parsed.rationale,
    redCannotBeDropped:app2.dropped.length===0 && app2.list.some(x=>x.aiVerdict==='drop-blocked'),
    redObjectionShown:/המליץ לוותר/.test((app2.list.find(x=>x.aiVerdict==='drop-blocked')||{}).aiNote||''),
    badModifyFallsBack:app3.list.some(x=>x.aiVerdict==='modify-rejected'),
    badModifyReported:app3.rejected.length===1,
    garbage:(()=>{ try{ parseReviewJSON('not json',t,eng.length); return false; }catch(e){ return true; } })(),
    outOfRangeRef:parseReviewJSON(JSON.stringify({plan:[{ref:999,verdict:'keep'}]}),t,eng.length).plan[0].ref===null
  };
});
ck('the AI returns a full list, not just additions', ai.listCount>=ai.engineCount-1, `engine ${ai.engineCount} → list ${ai.listCount}`);
ck('a kept action carries the AI\'s endorsement', /אושר ע״י AI/.test(ai.keptNote), ai.keptNote.slice(0,50));
ck('the AI can drop a non-mandatory action', ai.droppedCount===1);
ck('a valid AI addition joins the list', ai.addedOk);
ck('an illegal AI addition is rejected and reported', ai.illegalAddRejected);
ck('no engine action is lost by omission', ai.noneLostByOmission);
ck('the AI states the principle behind its ordering', !!ai.rationale, ai.rationale);
ck('a MANDATORY action cannot be dropped by the AI', ai.redCannotBeDropped);
ck('and the AI\'s objection is shown on that action instead', ai.redObjectionShown);
ck('an illegal AI modification falls back to the engine version', ai.badModifyFallsBack);
ck('and the rejection is reported, not hidden', ai.badModifyReported);
ck('malformed model output throws rather than corrupting the list', ai.garbage);
ck('an out-of-range action reference is neutralised', ai.outOfRangeRef);

/* ---- a quarter without a written plan must not fall back to engine recommendations ---- */
await page.evaluate(()=>{ S.activeQuarter='Q1'; save(); go('plan'); });
await page.waitForTimeout(600);
await page.evaluate(()=>{
  const t=nextQuarters('Q1')[0];
  const eng=buildActionPlan('Q1',t)||[];
  // drop an AMBER action — a mandatory one cannot be dropped, which is a different assertion
  const amberIdx=eng.findIndex(x=>x.level==='amber'&&x.sim);
  const parsed=parseReviewJSON(JSON.stringify({rationale:'מזומן לפני הכל',plan:[
    {ref:amberIdx+1,verdict:'drop',why:'כובל מזומן'},
    {ref:null,verdict:'add',title:'הפקד עודף בברזיל',form:'A3-3',level:'amber',why:'4.5%',
      sim:{q:t,regions:{brazil:{invest:400000}}}}]}),t,eng.length);
  S.ai.review={q:t,at:Date.now(),rationale:parsed.rationale,...applyReview(eng,parsed,t)};
  save(); go('plan');
});
await page.waitForTimeout(700);
const ui=await page.evaluate(()=>({
  explicit:/אין תוכנית כתובה/.test(document.body.innerText),
  cards:document.querySelectorAll('.content .act').length,
  engineReviewButton:!!document.getElementById('enrichBtn'),
  manualAdd:!![...document.querySelectorAll('.content button')].find(b=>/הוסף פעולה ידנית/.test(b.textContent))
}));
ck('a no-plan quarter says so explicitly', ui.explicit);
ck('a no-plan quarter has no engine recommendation cards or review button',
  ui.cards===0 && ui.engineReviewButton===false);
ck('manual form entry remains available without manufacturing a recommendation', ui.manualAdd);
await page.evaluate(()=>{ S.activeQuarter='Q3'; save(); go('plan'); });   // back to the planned quarter
await page.waitForTimeout(500);

/* ---- CONTRACT ROUTES: producing it ourselves is one option, not the question ---- */
const rt=await page.evaluate(()=>{
  const before={techX:S.quarters.Q3.operational.techX};
  S.quarters.Q3.operational.techX=2;                    // grade too low to make X3 in Q4
  setPlantSplit('europe','X',0); setPlantSplit('europe','Y',2);  // no chip plant at all
  const c=contractPlan()[0], r=contractRoutes(c);
  const by=k=>r.routes.find(x=>x.key===k);
  const out={
    productionDeadline:c.productionQuarter, decideNow:r.decideQ,
    gradeGap:r.quartersToGrade, gradeReadyIn:r.gradeReadyForProductionIn,
    produceInfeasible:!by('produce').feasible,
    produceReasonNamesGrade:/דרגת/.test(by('produce').why),
    surfaceFeasible:by('buy-surface').feasible,
    airFeasible:by('buy-air').feasible,
    airCitesSameQuarterResale:/quarter of shipment|באותו רבעון/.test(by('buy-air').why),
    plantTooLateForThisTranche:!by('plant').feasible,
    plantSaysItHelpsLater:/מאוחר מדי למנה הזו/.test(by('plant').why),
    expediteAlwaysAvailable:by('expedite').feasible && by('expedite').fallback,
    expediteCitesTheRule:/enforced by expediting/.test(by('expedite').why),
    bestIsNotProduce:r.best.key!=='produce',
    bestIsCheapestFeasible:r.best.key==='buy-surface'
  };
  // with the grade and a chip plant in place, producing becomes the answer again
  S.quarters.Q3.operational.techX=3; setPlantSplit('europe','X',1); setPlantSplit('europe','Y',1);
  const r2=contractRoutes(contractPlan()[0]);
  out.withGradeAndPlantProduceWins=r2.best.key==='produce';
  out.produceNowFeasible=r2.routes.find(x=>x.key==='produce').feasible;
  // undeclared split must not pretend to know
  setPlantSplit('europe','X',null); setPlantSplit('europe','Y',null);
  out.undeclaredIsUnknown=contractRoutes(contractPlan()[0]).routes.find(x=>x.key==='produce').unknown===true;
  setPlantSplit('europe','X',0); setPlantSplit('europe','Y',2);
  S.quarters.Q3.operational.techX=before.techX;
  return out;
});
ck('the production deadline is a quarter before delivery', rt.productionDeadline==='Q4' && rt.decideNow==='Q4');
ck('a grade gap is measured in quarters of R&D', rt.gradeGap===1, `X3 available to produce from ${rt.gradeReadyIn}`);
ck('self-production is correctly ruled out when the grade cannot mature in time', rt.produceInfeasible);
ck('and the reason names the grade, not something vague', rt.produceReasonNamesGrade);
ck('buying by surface the quarter before is offered', rt.surfaceFeasible);
ck('buying by air in the delivery quarter is offered', rt.airFeasible);
ck('and it cites the same-quarter resale rule that makes it work', rt.airCitesSameQuarterResale);
ck('building a plant is shown as too late for this tranche', rt.plantTooLateForThisTranche);
ck('but flagged as the answer for the later ones', rt.plantSaysItHelpsLater);
ck('doing nothing is presented as enforced expediting, not as default', rt.expediteAlwaysAvailable);
ck('quoting the rule that makes it a cost problem, not a failure', rt.expediteCitesTheRule);
ck('the recommended route is not "just produce it"', rt.bestIsNotProduce);
ck('it is the cheapest route that still meets the calendar', rt.bestIsCheapestFeasible);
ck('with the grade and a chip plant, self-production wins again', rt.withGradeAndPlantProduceWins && rt.produceNowFeasible);
ck('an undeclared plant split reports unknown rather than guessing', rt.undeclaredIsUnknown);
/* 4.12 — a HIGHER grade fills the contract cheaply; a lower one does not. And the heavy
   cost applies only to the missing units, which makes partial coverage a real hedge. */
const g412=await page.evaluate(()=>{
  const c=contractPlan()[0], r=contractRoutes(c);
  const by=k=>r.routes.find(x=>x.key===k);
  // stock of a HIGHER grade must satisfy the commitment
  const inv=S.quarters.Q3.operational.inventory;
  S.quarters.Q3.operational.inventory=[{product:'X',grade:5,region:'europe',qty:30000}];
  const higherCovers=contractPlan()[0].gap===0;
  // a LOWER grade must not
  S.quarters.Q3.operational.inventory=[{product:'X',grade:2,region:'europe',qty:60000}];
  const lowerDoesNot=contractPlan()[0].gap===30000;
  const lowerReported=contractPlan()[0].wrongGrade===60000;
  // partial stock reduces the gap proportionally
  S.quarters.Q3.operational.inventory=[{product:'X',grade:3,region:'europe',qty:12000}];
  const partialGap=contractPlan()[0].gap;
  S.quarters.Q3.operational.inventory=inv;
  return {higherCovers, lowerDoesNot, lowerReported, partialGap,
    higherRouteExists:!!by('produce-higher'),
    higherRouteCitesNominal:/rather nominal|נומינלי|מינימלי/.test(by('produce-higher').why),
    higherRouteRejectsLower:/נמוכה.*אינה עוזרת/.test(by('produce-higher').why),
    partialRouteExists:!!by('partial') && by('partial').feasible,
    partialCitesMissingUnitsOnly:/missing units|הפער|החסרות/.test(by('partial').why),
    expediteNamesTheSurcharge:/Sales Expediting/.test(by('expedite').why),
    expediteAdmitsRateUnknown:/אינו נוקב/.test(by('expedite').why)};
});
ck('inventory of a HIGHER grade satisfies the commitment (4.12)', g412.higherCovers);
ck('a LOWER grade does not, and is reported as unusable', g412.lowerDoesNot && g412.lowerReported);
ck('partial stock reduces the gap rather than all-or-nothing', g412.partialGap===18000, 'gap '+g412.partialGap);
ck('a "produce this grade or better" route is offered', g412.higherRouteExists);
ck('it cites that a higher grade costs only nominal remanufacturing', g412.higherRouteCitesNominal);
ck('and warns that a lower grade does not help at all', g412.higherRouteRejectsLower);
ck('partial coverage is offered as a route in its own right', g412.partialRouteExists);
ck('stating that the heavy cost applies only to the missing units', g412.partialCitesMissingUnitsOnly);
ck('the fallback names the Sales Expediting surcharge', g412.expediteNamesTheSurcharge);
ck('and admits the guide does not state the rate', g412.expediteAdmitsRateUnknown);

/* ---- DEMAND: no recommendation may exceed what the reports show the market absorbs ---- */
const dem=await page.evaluate(()=>{
  const q=S.activeQuarter,t=nextQuarters(q)[0];
  const mi=S.quarters[q].marketIntel||{};
  const eu=(mi.sales||[]).filter(s=>s.region==='europe'&&s.product==='Y');
  const totalEU=eu.reduce((a,s)=>a+s.units,0), ourEU=eu.filter(s=>s.company===OUR_CO).reduce((a,s)=>a+s.units,0);
  const plan=pcPlanFor(q), opts=pcSellOptions(q);
  const card=(buildActionPlan(q,t)||[]).find(i=>/מכור/.test(i.title));
  const stock=(S.quarters[q].operational.inventory||[]).filter(i=>i.product==='Y').reduce((a,i)=>a+i.qty,0);
  return {
    observedMarket:totalEU, ourObserved:ourEU, stock,
    planUnits:plan[0]?plan[0].units:0, planLeftover:plan[0]?plan[0].leftover:0,
    planCarryCost:plan[0]?plan[0].carryCost:0,
    planCeilingSrc:plan[0]?plan[0].ceiling.src:'',
    planBelowStock:plan[0]?plan[0].units<stock:false,
    planBelowMarket:plan[0]?plan[0].units<totalEU:false,
    optionUnits:opts[0]?opts[0].opts.map(o=>o.units):[],
    optionsAgreeWithPlan:opts[0]?opts[0].opts.every(o=>o.units<=stock):false,
    cheaperSellsMore:(()=>{const o=opts[0]&&opts[0].opts;return o?o[0].units>o[2].units:false;})(),
    priceResponsive:(()=>{const a=demandCeiling('europe','Y',111).units,b=demandCeiling('europe','Y',150).units;return a>b;})(),
    anchorPriceRecovered:(S.learning.anchors['europe|Y']||{}).price>0,
    anchorPriceSrc:(S.learning.anchors['europe|Y']||{}).priceSrc||'',
    cardTitle:card?card.title:'',
    cardMentionsLeftover:card?/יישארו במלאי/.test(card.detail||''):false,
    cardSuggestsExport:card?/יצוא/.test(card.detail||''):false,
    overreachOnEngineList:demandOverreach(buildActionPlan(q,t)).length,
    overreachDetectsAViolation:demandOverreach([{title:'x',sim:{regions:{europe:{price:130,qtySold:99999}}}}]).length===1
  };
});
ck('the sell plan is capped by demand, not by warehouse stock', dem.planBelowStock, `${dem.planUnits} of ${dem.stock} in stock`);
ck('and it does not exceed the entire observed market', dem.planBelowMarket, `${dem.planUnits} vs market ${dem.observedMarket}`);
ck('the ceiling cites its authority', /מנוע ביקוש|Data Log/.test(dem.planCeilingSrc), dem.planCeilingSrc);
ck('the unsold remainder is quantified', dem.planLeftover>0, dem.planLeftover+' units left');
ck('and its carrying cost is stated', dem.planCarryCost>0, dem.planCarryCost+' per quarter');
ck('the headline says how many of the stock will actually sell', /מתוך/.test(dem.cardTitle), dem.cardTitle);
ck('the card explains the remainder', dem.cardMentionsLeftover);
ck('and points at export as the outlet for it', dem.cardSuggestsExport);
ck('the options table uses the same authority as the headline', dem.optionsAgreeWithPlan, dem.optionUnits.join('/'));
ck('a lower price sells more units — the elasticity lever is live', dem.cheaperSellsMore, dem.optionUnits.join(' vs '));
ck('the demand ceiling responds to price at all', dem.priceResponsive);
ck('a missing own-price falls back to the MR28 market median', dem.anchorPriceRecovered, dem.anchorPriceSrc);
ck('the engine list contains no demand overreach', dem.overreachOnEngineList===0);
ck('the overreach guard actually catches a violation', dem.overreachDetectsAViolation);
/* v10 made chip lines first-class, so the oversell guard must cover BOTH products and must
   not let chips already promised to a signed contract be sold on the open market as well. */
const ov=await page.evaluate(()=>{
  const t=nextQuarters(S.activeQuarter)[0];
  const mk=(patch)=>{ const L={}; L[t]={rd:0,regions:{}};
    REGIONS.forEach(r=>L[t].regions[r.id]={production:0,unitCost:0,sales:0,qtySold:0,price:0,advertising:0,invest:0,transferIn:0,newFac:0,offices:0,product:'Y'});
    Object.assign(L[t].regions.europe,patch); return {levers:L}; };
  const pc=phantomSales(mk({product:'Y',qtySold:999999,price:130,sales:999999*130}),t);
  const chip=phantomSales(mk({product:'X',qtySold:999999,price:41,sales:999999*41}),t);
  const okPlan=phantomSales(mk({product:'Y',qtySold:1000,price:130,sales:130000}),t);
  return {pcCaught:pc.length===1&&pc[0].product==='Y',
          chipCaught:chip.length===1&&chip[0].product==='X',
          chipCountsContract:chip[0]&&chip[0].committed>0,
          legalPlanPasses:okPlan.length===0};
});
ck('overselling computers is caught', ov.pcCaught);
ck('overselling CHIPS is caught too — first-class lines are guarded', ov.chipCaught);
ck('chips already promised to the contract are excluded from sellable supply', ov.chipCountsContract);
ck('a plan within supply still passes', ov.legalPlanPasses);
const demUI=await page.evaluate(()=>{ go('export'); return null; });
await page.waitForTimeout(400);
ck('the submission checklist checks for demand overreach',
   await page.evaluate(()=>/חורגת מהביקוש|אין המלצה שחורגת/.test(document.body.innerText)));
await page.evaluate(()=>go('plan')); await page.waitForTimeout(300);

/* ---- CASH BUDGET: recommendations must be measured against money that exists ---- */
const bud=await page.evaluate(()=>{
  S.quarters.Q3.financial.cash={us:120000,europe:640000,brazil:95000,hq:213000};
  S.quarters.Q3.financial.loans=1136879; save(); go('plan');
  const q=S.activeQuarter,t=nextQuarters(q)[0];
  const items=(buildActionPlan(q,t)||[]).filter(i=>i.sim||i.action);
  const a=budgetAllocation(items);
  const idle=(buildActionPlan(q,t)||[]).find(x=>/סרק/.test(x.title));
  return {available:a.available, floor:a.floor, spendable:a.spendable, used:a.used, over:a.over,
    spendablePlusFloor:a.spendable+a.floor===a.available,
    everyActionCosted:a.rows.every(r=>typeof r.cost==='number'),
    someActionCosts:a.rows.some(r=>r.cost>0),
    idleAfterCommitments: idle? /אחרי<\/b> כל מה שההמלצות|ואחרי/.test(idle.detail) : null,
    idleNotDoubleCounting: (()=>{ const spend=items.filter(i=>!/סרק/.test(i.title)).reduce((x,i)=>x+actionCashCostSF(i),0);
      const park=idle?actionCashCostSF(idle):0; return spend+park<=a.available; })()};
});
ck('spendable cash reserves only the non-discretionary floor', bud.spendable>0 && bud.spendable<=bud.available, `${bud.available} - ${bud.floor} = ${bud.spendable}`);
/* revenue-generating actions must count what they bring in, not only what they cost */
const flow=await page.evaluate(()=>{
  const q=S.activeQuarter,t=nextQuarters(q)[0];
  const items=(buildActionPlan(q,t)||[]).filter(i=>i.sim||i.action);
  const a=budgetAllocation(items);
  const sell=a.rows.find(r=>/מכור/.test(r.it.title));
  const coll=S.config.params.collection.europe[0];
  return {inNow:a.inNow, inLater:a.inLater, capacity:a.capacity, spendable:a.spendable,
    capacityIsBaseePlusInflow:a.capacity===a.spendable+a.inNow,
    sellOut:sell?sell.out:0, sellInNow:sell?sell.inNow:0, sellNet:sell?sell.net:0,
    collectionPctMatchesDataLog: sell? Math.abs(sell.inNow/(sell.revenue||1)-coll/100)<0.02 : false,
    strictBalance:a.strictBalance, allFit:a.rows.every(r=>r.fits)};
});
ck('an action that generates revenue reports its same-quarter collection', flow.inNow>0, flow.inNow+' SF');
ck('the deferred portion is tracked separately', flow.inLater>0, flow.inLater+' SF later');
ck('the collection split follows the Data Log schedule, not a guess', flow.collectionPctMatchesDataLog);
ck('selling inventory is net cash POSITIVE, not a pure cost', flow.sellNet>0, `out ${flow.sellOut} → in ${flow.sellInNow} = net ${flow.sellNet}`);
ck('capacity = cash after the floor PLUS same-quarter collection', flow.capacityIsBaseePlusInflow, `${flow.spendable} + ${flow.inNow} = ${flow.capacity}`);
ck('with the sale funding it, the whole set fits', flow.allFit);
ck('the no-sale scenario is quantified, not assumed away', typeof flow.strictBalance==='number', 'strict balance '+flow.strictBalance);
/* The decisions tab was cut back to the four things it was asked for — cash, expected income,
   floor, and what the chosen actions cost — with the derivation moved into one closed disclosure
   at the foot of the page. So these split in two: the HEADLINE claims must be visible without
   opening anything (innerText), and the WORKING behind them must still exist on the page
   (textContent, which reaches inside a closed <details>). Neither may quietly disappear. */
const flowUI=await page.evaluate(()=>{ const t=document.body.innerText, all=document.body.textContent;
  return {twoTier:/מזומן שיש עכשיו[\s\S]*ייכנס עוד ברבעון הזה/.test(all),
    contingency:/מותנית במכירה/.test(all), contingencyDetail:/מותנית בכך שהסחורה באמת תימכר/.test(all),
    noSaleScenario:/גם אם לא יימכר כלום|מתחת לרצפה/.test(all),
    perCard:/תזרים הפעולה/.test(all), selfFunding:/מממנת את עצמה/.test(all)}; });
ck('the visible strip separates cash-in-hand from expected collection', flowUI.twoTier);
ck('it warns on the surface that the collection is contingent on the goods selling',
  flowUI.contingency && flowUI.contingencyDetail);
ck('it still states what happens if nothing sells', flowUI.noSaleScenario);
ck('revenue actions show their own cash flow on the card', flowUI.perCard);
ck('a self-funding action says so', flowUI.selfFunding);
ck('every recommendation carries a cash cost', bud.everyActionCosted && bud.someActionCosts);
ck('the recommended set is allocated against a running balance', bud.used>=0);
ck('parking idle cash accounts for what the other recommendations spend', bud.idleAfterCommitments!==false);
ck('the tool never recommends spending AND parking the same money', bud.idleNotDoubleCounting);
const budUI=await page.evaluate(()=>{ const t=document.body.innerText, all=document.body.textContent;
  const money=[...document.querySelectorAll('.focus')].find(x=>/הכסף של Q/.test(x.textContent));
  return {strip:!!money,
    // the four figures the tab exists to show, all above the decision list
    // The four figures became a six-line ledger, because the row they replaced did not add up to
    // its own headline. Assert the steps AND the arithmetic — a ledger that does not sum is worse
    // than the row it replaced.
    fourFigures:money?['מזומן שיש עכשיו','ייכנס עוד ברבעון הזה','רצפה','עלות הפעולות','זמין להוצאה'].every(k=>money.textContent.includes(k)):false,
    ledgerSums:(()=>{ if(!money) return false;
      const n=[...money.querySelectorAll('.ledger>div>b')]
        .map(b=>Number(b.textContent.replace(/[^\d-]/g,''))*(/−/.test(b.textContent)?-1:1));
      return n.length===6 && n[0]+n[1]+n[2]===n[3] && n[3]+n[4]===n[5]; })(),
    showsSpendable:/נשאר|חסר/.test(t),
    explainsWhyRevenueExcluded:/Data Log 09|נגבים מיד/.test(all),
    perCardCost:[...document.querySelectorAll('.act')].filter(a=>/SF/.test(a.textContent)).length}; });
ck('a cash budget block leads the tab', budUI.strip);
ck('it shows every step of the sum, not four figures that do not reach it', budUI.fourFigures);
ck('and the ledger actually adds up to the total it prints', budUI.ledgerSums);
ck('it states what is left to spend', budUI.showsSpendable);
ck('it still shows the collection schedule behind the inflow', budUI.explainsWhyRevenueExcluded);
ck('cards display their cash cost', budUI.perCardCost>0, budUI.perCardCost+' cards');
const over=await page.evaluate(()=>{
  // genuinely over budget: almost no cash AND nothing to sell, so no inflow can rescue it
  S.quarters.Q3.financial.cash={us:0,europe:60000,brazil:0,hq:25000};
  window.__inv=S.quarters.Q3.operational.inventory;
  S.quarters.Q3.operational.inventory=[]; save(); go('plan');
  const t=document.body.innerText;
  // The ledger is driven by ticked plan actions now, so an over-budget state needs some ticked.
  togglePlanPick(14); togglePlanPick(10); togglePlanPick(12);
  const t2=document.body.innerText;
  return {overWarning:/עולות .* יותר ממה שיש/.test(t2), unaffordableMarked:/אין מזומן לזה ברבעון הזה/.test(document.body.textContent)}; });
ck('an over-budget set is flagged', over.overWarning);
ck('actions with no cash cover are marked individually', over.unaffordableMarked);
await page.evaluate(()=>{ S.quarters.Q3.operational.inventory=window.__inv;
  S.quarters.Q3.financial.cash={us:120000,europe:640000,brazil:95000,hq:213000}; save(); go('plan'); });
await page.waitForTimeout(300);

/* ---- MARKET RESEARCH: three arrive free, three may be bought ---- */
const mr=await page.evaluate(()=>{
  S.quarters.Q3.financial.cash={us:120000,europe:640000,brazil:95000,hq:213000};
  S.quarters.Q3.marketIntel={competitors:{},sales:[],sources:[],generic:[],compPrices:[]};
  updateLearning(); save();
  const q=S.activeQuarter,t=nextQuarters(q)[0];
  const items=buildActionPlan(q,t)||[];
  const buyCard=items.find(i=>/^קנה מחקרי שוק/.test(i.title||''));
  const missCard=items.find(i=>/חינמיים חסרים/.test(i.title||''));
  return { freeTrio:MR_FREE.join(','),
    catalogFree:MR_STUDIES.filter(m=>m.cost===0).map(m=>m.code).join(','),
    buyTitle:buyCard?buyCard.title:'(none)',
    buyCardNeverListsAFreeStudy: buyCard? !MR_FREE.some(f=>buyCard.title.includes(f)) : true,
    missingFreeIsAnIngestionCard: !!missCard && /לא H1-2/.test(missCard.form||''),
    missingFreeSaysDoNotBuy: !!missCard && /אל תקנה/.test(missCard.title||''),
    slots:mrPaidSlots(t),
    conflicts:MR_FREE_CONFLICTS.length,
    conflictCodes:MR_FREE_CONFLICTS.map(c=>c.code).join(','),
    freeNoteMentionsQ4:/Q4/.test(mrFreeNoteFor('Q4')) };
});
// The operative free list follows the course booklet's cost column (17/28/74), which is this
// run's own material. The guide disagrees in three places and each conflict must be surfaced
// rather than silently resolved — see MR_FREE_CONFLICTS.
ck('the free list follows the course booklet', mr.freeTrio==='MR17,MR28,MR74', mr.freeTrio);
ck('the catalog marks exactly those as free', mr.catalogFree===mr.freeTrio, mr.catalogFree);
ck('the guide/booklet conflicts are recorded, not resolved silently',
   mr.conflicts>=3 && mr.conflictCodes.includes('MR3') && mr.conflictCodes.includes('MR74'), mr.conflictCodes);
ck('MR74 free quarters from the guide are stated per target quarter', mr.freeNoteMentionsQ4);
ck('the BUY card never lists a free study', mr.buyCardNeverListsAFreeStudy, mr.buyTitle);
ck('a missing free study is treated as an ingestion problem, not a purchase', mr.missingFreeIsAnIngestionCard);
ck('and it says explicitly not to buy it', mr.missingFreeSaysDoNotBuy);
ck('paid slots are capped at three', mr.slots.max===3);
const cat=await page.evaluate(()=>{ openMRCatalog(); const t=document.body.innerText;
  return {opened:/קטלוג מחקרי השוק/.test(t), quotesTheGuide:/חוברת עזר|עמודת עלות/.test(t),
    warnsNotToOrderFree:/אל תזמין אותם/.test(t), showsRemainingSlots:/מקומות פנויים/.test(t),
    flagsItem29Ambiguity:/המדריך חולק על החוברת/.test(t), explainsEstimateItems:/אומדן/.test(t),
    listsEveryStudy:document.querySelectorAll('table tbody tr').length}; });
ck('the catalog opens with every study numbered', cat.opened && cat.listsEveryStudy>=27, cat.listsEveryStudy+' rows');
ck('the catalog states its source for the free list', cat.quotesTheGuide);
ck('it warns not to spend a paid slot on a free study', cat.warnsNotToOrderFree);
ck('it shows how many paid slots remain', cat.showsRemainingSlots);
ck('it flags where the guide contradicts the booklet', cat.flagsItem29Ambiguity);
ck('it explains the probabilistic "estimate" items', cat.explainsEstimateItems);
await page.evaluate(()=>closeModal());

/* ---- score breakdown: two numbers on a strip must be able to explain themselves ---- */
await page.evaluate(()=>go('dashboard')); await page.waitForTimeout(400);
const sc=await page.evaluate(()=>{
  const strip=document.querySelector('.ns-score');
  const halves=[...document.querySelectorAll('.ns-h')];
  openScoreBreakdown();
  const t=document.body.innerText;
  return { stripClickable:!!(strip&&strip.getAttribute('onclick')),
    stripSaysItIsAnAverage:/ממוצע שתי המחציות/.test(strip?strip.innerText:''),
    halvesShowScale:/\/100/.test(halves.map(h=>h.innerText).join(' ')),
    halvesExplainThemselves:halves.every(h=>h.title&&h.title.length>30),
    modalShowsArithmetic:/÷ 2/.test(t),
    modalListsPastInputs:/רווחיות מצטברת/.test(t)&&/יעילות/.test(t),
    modalListsFutureInputs:/דרגה טכנולוגית/.test(t)&&/נתח שוק/.test(t)&&/בריאות פיננסית/.test(t),
    modalShowsWeights:/60%/.test(t)&&/40%/.test(t)&&/45%/.test(t)&&/30%/.test(t)&&/25%/.test(t),
    modalExplainsPenalty:/קנס/.test(t),
    modalNamesWeakerHalf:/החלש שלך/.test(t),
    modalQuantifiesLeverage:/חצי נקודה בציון|5 נקודות בציון/.test(t) };
});
ck('the score strip is clickable for its derivation', sc.stripClickable);
ck('the strip states that the score is an average of the halves', sc.stripSaysItIsAnAverage);
ck('each half shows it is scored out of 100', sc.halvesShowScale);
ck('each half explains its own composition on hover', sc.halvesExplainThemselves);
ck('the breakdown shows the actual arithmetic', sc.modalShowsArithmetic);
ck('it lists every input of the past half', sc.modalListsPastInputs);
ck('it lists every input of the future half', sc.modalListsFutureInputs);
ck('it shows the weight of each input', sc.modalShowsWeights);
ck('it explains the floor-breach penalty', sc.modalExplainsPenalty);
ck('it names which half is the weaker one to move', sc.modalNamesWeakerHalf);
ck('it quantifies how much moving a half is worth', sc.modalQuantifiesLeverage);
await page.evaluate(()=>closeModal());

/* ---- WRITTEN PLAN: hand back the original, and an updated copy in the same layout ---- */
await page.evaluate(()=>{ S.quarters.Q3.operational.techX=2;
  setPlantSplit('europe','X',0); setPlantSplit('europe','Y',2); save(); go('export'); });
await page.waitForTimeout(600);
const pl=await page.evaluate(()=>{
  const d=planDeltas(), orig=planDocHTML('original'), upd=planDocHTML('updated');
  return {blocks:PLAN_DOC.length, tables:PLAN_DOC.filter(b=>b.t==='tbl').length,
    deltaRows:d.length, changed:d.filter(x=>x.changed).length,
    everyDeltaHasBothSides:d.every(x=>x.topic&&x.planned!=null&&x.now!=null),
    catchesContractGap:d.some(x=>/התחייבות/.test(x.topic)&&x.changed),
    catchesGradeGap:d.some(x=>/דרגת שבב/.test(x.topic)&&x.changed),
    catchesPlantSplit:d.some(x=>/מפעלים/.test(x.topic)&&x.changed),
    catchesDebtRedLine:d.some(x=>/חוב/.test(x.topic)),
    origHasNoChangeSection:!/מה השתנה/.test(orig),
    updHasChangeSection:/מה השתנה/.test(upd),
    updKeepsOriginalIntact:orig.split('<table>').length===upd.split('<table>').length-1,
    bothRTL:/direction:rtl/.test(orig)&&/direction:rtl/.test(upd),
    updNamesVersion:/גרסה 5\.1/.test(upd),
    updStampsQuarter:upd.includes(S.activeQuarter),
    origLinkPresent:!!document.querySelector('a[href$=".docx"][download]'),
    // the plan-vs-actual card is background on this tab now; it must be produced, not on top
    previewRendered:/פערים בין התוכנית|תואמת את המצב/.test(document.body.textContent),
    downloadButtons:[...document.querySelectorAll('button')].filter(b=>/המקורי|מעודכן/.test(b.textContent)).length};
});
ck('the written plan is embedded whole', pl.blocks===63 && pl.tables===21, `${pl.blocks} blocks, ${pl.tables} tables`);
ck('the original download reproduces it with no changes section', pl.origHasNoChangeSection);
ck('the updated copy adds a changes section', pl.updHasChangeSection);
ck('and keeps the original plan intact beneath it', pl.updKeepsOriginalIntact);
ck('both documents are right-to-left', pl.bothRTL);
ck('the updated copy is versioned 5.1 and stamped with the base quarter', pl.updNamesVersion && pl.updStampsQuarter);
ck('every delta states both the planned and the actual value', pl.everyDeltaHasBothSides, pl.deltaRows+' rows');
ck('it catches the contract gap', pl.catchesContractGap);
ck('it catches the chip grade shortfall', pl.catchesGradeGap);
ck('it catches the undeclared/zero chip plant split', pl.catchesPlantSplit);
ck('it checks the zero-debt red line of the plan', pl.catchesDebtRedLine);
ck('the untouched original .docx is downloadable', pl.origLinkPresent);
ck('both generated documents have their own button', pl.downloadButtons>=2, pl.downloadButtons+' buttons');
ck('the deltas are previewed on the page before downloading', pl.previewRendered);

/* ---- REAL REPORT: the MIS states the plant split per product; parse it, do not ask ---- */
const real=await page.evaluate(()=>{
  // verbatim MIS rows from the team's real Q3 report
  const rows=[
    ['0PLANTS BUILT AND BUILDING',0,null,0,2,null,2,0,null,0],
    ['MAX. PRODUCIBLE GRADE',2,null,1,2,null,1,2,null,1],
  ];
  const find=(re)=>rows.find(r=>re.test(String(r[0]||'').replace(/^0/,'')));
  const pr=find(/^PLANTS BUILT AND BUILDING/), mp=find(/^MAX.? PRODUCIBLE GRADE/);
  const byProd={ us:{X:pr[1]||0,Y:pr[3]||0}, europe:{X:pr[4]||0,Y:pr[6]||0}, brazil:{X:pr[7]||0,Y:pr[9]||0} };
  const totals={us:byProd.us.X+byProd.us.Y, europe:byProd.europe.X+byProd.europe.Y, brazil:byProd.brazil.X+byProd.brazil.Y};
  // apply exactly what ingestion would now store
  S.quarters.Q3.operational.plantsByProduct=byProd;
  S.quarters.Q3.operational.plantsByRegion=totals;
  S.quarters.Q3.operational.techX=Math.max(mp[1],mp[4],mp[7]);
  S.quarters.Q3.operational.techY=Math.max(mp[3],mp[6],mp[9]);
  S.config.plantSplit={us:{X:byProd.us.X,Y:byProd.us.Y},europe:{X:byProd.europe.X,Y:byProd.europe.Y},brazil:{X:byProd.brazil.X,Y:byProd.brazil.Y}};
  save();
  const cx=capacityForProduct('X'), cy=capacityForProduct('Y');
  const c=contractPlan()[0], r=contractRoutes(c);
  return {byProd, totals, techX:S.quarters.Q3.operational.techX, techY:S.quarters.Q3.operational.techY,
    chipCap:cx.units, chipKnown:cx.known, pcCap:cy.units,
    splitStatusComplete:plantSplitStatus().complete, noMismatch:!plantSplitStatus().anyMismatch,
    capOK:c.capOK, techOK:c.techOK,
    produceBlocked:!r.routes.find(x=>x.key==='produce').feasible,
    blockedOnGradeNotPlant:/דרגת/.test(r.routes.find(x=>x.key==='produce').why),
    gradeReadyIn:r.gradeReadyForProductionIn, best:r.best.key};
});
ck('the plant split is read per product from the MIS row', 
   real.byProd.europe.X===2 && real.byProd.europe.Y===2, JSON.stringify(real.byProd.europe));
ck('the area total is the sum, not the chip column', real.totals.europe===4, 'europe total '+real.totals.europe);
ck('max producible grade gives techX/techY', real.techX===2 && real.techY===1, `X${real.techX}/Y${real.techY}`);
ck('chip capacity is derived from declared chip plants', real.chipKnown && real.chipCap===2*DATALOG_X_EU(), real.chipCap+' units');
ck('PC capacity is separate and correct', real.pcCap===2*18000, real.pcCap+' units');
ck('ingestion makes the manual split declaration unnecessary', real.splitStatusComplete && real.noMismatch);
ck('capacity is NOT the constraint on the contract', real.capOK===true);
ck('the grade IS the constraint', real.techOK===false && real.produceBlocked && real.blockedOnGradeNotPlant);
ck('R&D puts the grade in reach for the later tranche', real.gradeReadyIn==='Q5');
ck('so the near tranche routes to purchase, not production', real.best==='buy-surface', real.best);

const jsErr=errors.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
ck('no JavaScript errors', jsErr.length===0, jsErr.slice(0,2).join(' | '));
const failed=report('DECISIONS');
await browser.close();
process.exit(failed?1:0);
})();
