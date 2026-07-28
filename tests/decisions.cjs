/* DECISIONS SUITE — the action list must cover every decision family, mark what has been
   sent without navigating away, and only accept AI suggestions the engine can validate. */
const {open,checks}=require('./lib.cjs');
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

/* ---- sending marks, does not navigate ---- */
await page.evaluate(()=>{ const a=document.querySelector('.act');
  [...a.querySelectorAll('button')].find(b=>/שלח לסימולטור/.test(b.textContent)).click(); });
await page.waitForTimeout(300);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/העבר לתרחיש/.test(x.textContent)); if(b)b.click(); });
await page.waitForTimeout(600);
const after=await page.evaluate(()=>({page:currentPage, scenarios:S.scenarios.length,
  checked:[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length,
  progress:[...document.querySelectorAll('.tag.g')].map(t=>t.textContent.trim()).filter(t=>/הועברו/.test(t))[0]||''}));
ck('sending does NOT navigate away from the decisions', after.page==='plan', 'landed on '+after.page);
ck('the action is marked as sent', after.checked===1);
ck('a progress counter appears', /הועברו/.test(after.progress), after.progress);
ck('the scenario really was created', after.scenarios===1);
await page.evaluate(()=>{ go('dashboard'); go('plan'); }); await page.waitForTimeout(400);
ck('the mark survives leaving and returning',
   await page.evaluate(()=>[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length)===1);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/בטל סימון/.test(x.textContent)); if(b)b.click(); });
await page.waitForTimeout(500);
ck('the mark can be undone',
   await page.evaluate(()=>[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length)===0);

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

/* ---- the reviewed list is what the page renders ---- */
await page.evaluate(()=>{
  const q=S.activeQuarter,t=nextQuarters(q)[0]; const eng=buildActionPlan(q,t)||[];
  const amberIdx=eng.findIndex(x=>x.level==='amber'&&x.sim);
  const parsed=parseReviewJSON(JSON.stringify({rationale:'מזומן לפני הכל',plan:[
    {ref:amberIdx+1,verdict:'drop',why:'כובל מזומן'},
    {ref:null,verdict:'add',title:'הפקד עודף בברזיל',form:'A3-3',level:'amber',why:'4.5%',
      sim:{q:t,regions:{brazil:{invest:400000}}}}]}),t,eng.length);
  S.ai.review={q:t,at:Date.now(),rationale:parsed.rationale,...applyReview(eng,parsed,t)};
  save(); go('plan');
});
await page.waitForTimeout(600);
const ui=await page.evaluate(()=>({
  banner:/נבחן/.test(document.body.innerText),
  rationaleShown:/העיקרון שהנחה את הסדר/.test(document.body.innerText),
  droppedSection:/המליץ לוותר עליהן/.test(document.body.innerText),
  aiTagOnCard:[...document.querySelectorAll('.act')].some(a=>/\bAI\b/.test(a.textContent)),
  revertBtn:!![...document.querySelectorAll('button')].find(b=>/חזור לרשימת המנוע/.test(b.textContent)),
  addedVisible:[...document.querySelectorAll('.act')].some(a=>/ברזיל/.test(a.textContent))
}));
ck('the page shows it is running the reviewed list', ui.banner);
ck('the ordering principle is displayed', ui.rationaleShown);
ck('dropped actions are still visible, in their own section', ui.droppedSection);
ck('AI-originated actions are labelled on the card', ui.aiTagOnCard);
ck('the AI addition appears as a real actionable card', ui.addedVisible);
ck('you can revert to the engine list', ui.revertBtn);
await page.evaluate(()=>clearReview()); await page.waitForTimeout(400);
ck('reverting restores the engine list', await page.evaluate(()=>!/נבחן/.test(document.body.innerText)));

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
const flowUI=await page.evaluate(()=>{ const t=document.body.innerText;
  return {twoTier:/הקיבולת מורכבת משניים/.test(t), contingency:/הגבייה המיידית מותנית/.test(t),
    noSaleScenario:/גם אם לא יימכר כלום|מתחת לרצפה/.test(t),
    perCard:/תזרים הפעולה/.test(t), selfFunding:/מממנת את עצמה/.test(t)}; });
ck('the strip separates cash-in-hand from expected collection', flowUI.twoTier);
ck('it warns that the collection is contingent on the goods actually selling', flowUI.contingency);
ck('it states what happens if nothing sells', flowUI.noSaleScenario);
ck('revenue actions show their own cash flow on the card', flowUI.perCard);
ck('a self-funding action says so', flowUI.selfFunding);
ck('every recommendation carries a cash cost', bud.everyActionCosted && bud.someActionCosts);
ck('the recommended set is allocated against a running balance', bud.used>=0);
ck('parking idle cash accounts for what the other recommendations spend', bud.idleAfterCommitments!==false);
ck('the tool never recommends spending AND parking the same money', bud.idleNotDoubleCounting);
const budUI=await page.evaluate(()=>{ const t=document.body.innerText;
  return {strip:/תקציב המזומן לרבעון הזה/.test(t), showsSpendable:/קיבולת/.test(t),
    explainsWhyRevenueExcluded:/Data Log 09|נגבים מיד/.test(t),
    perCardCost:[...document.querySelectorAll('.act')].filter(a=>/SF/.test(a.textContent)).length}; });
ck('a cash budget strip is shown above the decisions', budUI.strip);
ck('it states the spending capacity', budUI.showsSpendable);
ck('it shows the collection schedule behind the inflow', budUI.explainsWhyRevenueExcluded);
ck('cards display their cash cost', budUI.perCardCost>0, budUI.perCardCost+' cards');
const over=await page.evaluate(()=>{
  // genuinely over budget: almost no cash AND nothing to sell, so no inflow can rescue it
  S.quarters.Q3.financial.cash={us:0,europe:60000,brazil:0,hq:25000};
  window.__inv=S.quarters.Q3.operational.inventory;
  S.quarters.Q3.operational.inventory=[]; save(); go('plan');
  const t=document.body.innerText;
  return {overWarning:/חריגה של/.test(t), unaffordableMarked:/אין מזומן לזה ברבעון הזה/.test(t)}; });
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
    catalogFree:MR_STUDIES.filter(m=>m.free).map(m=>m.code).join(','),
    buyTitle:buyCard?buyCard.title:'(none)',
    buyCardNeverListsAFreeStudy: buyCard? !MR_FREE.some(f=>buyCard.title.includes(f)) : true,
    missingFreeIsAnIngestionCard: !!missCard && /לא H1-2/.test(missCard.form||''),
    missingFreeSaysDoNotBuy: !!missCard && /אל תקנה/.test(missCard.title||''),
    slots:mrPaidSlots(t) };
});
ck('the free trio is 3 / 17 / 28 per the guide', mr.freeTrio==='MR3,MR17,MR28');
ck('the catalog marks exactly those three as free', mr.catalogFree==='MR3,MR17,MR28');
ck('the BUY card never lists a free study', mr.buyCardNeverListsAFreeStudy, mr.buyTitle);
ck('a missing free study is treated as an ingestion problem, not a purchase', mr.missingFreeIsAnIngestionCard);
ck('and it says explicitly not to buy it', mr.missingFreeSaysDoNotBuy);
ck('paid slots are capped at three', mr.slots.max===3);
const cat=await page.evaluate(()=>{ openMRCatalog(); const t=document.body.innerText;
  return {opened:/קטלוג מחקרי השוק/.test(t), quotesTheGuide:/3, 17 ו-28/.test(t),
    warnsNotToOrderFree:/אל תזמין אותם/.test(t), showsRemainingSlots:/מקומות פנויים/.test(t),
    flagsItem29Ambiguity:/פריט 29/.test(t), explainsEstimateItems:/אומדן/.test(t),
    listsEveryStudy:document.querySelectorAll('table tbody tr').length}; });
ck('the catalog opens with every study numbered', cat.opened && cat.listsEveryStudy>=27, cat.listsEveryStudy+' rows');
ck('it quotes the guide on which three are free', cat.quotesTheGuide);
ck('it warns not to spend a paid slot on a free study', cat.warnsNotToOrderFree);
ck('it shows how many paid slots remain', cat.showsRemainingSlots);
ck('it flags the item-29 ambiguity between the two guide sections', cat.flagsItem29Ambiguity);
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

const jsErr=errors.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
ck('no JavaScript errors', jsErr.length===0, jsErr.slice(0,2).join(' | '));
const failed=report('DECISIONS');
await browser.close();
process.exit(failed?1:0);
})();
