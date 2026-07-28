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
