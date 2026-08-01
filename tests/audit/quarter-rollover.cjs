/* What actually changes when a new quarter is ingested.

   The question this suite answers is "is the chain connected, and does it re-derive?" — asked
   because a tool that shows Q3's floor against Q5's balance sheet is worse than one that shows
   nothing. Each assertion below names one link in that chain and checks it MOVED, not merely that
   it exists: a derived figure that is identical before and after an ingest is the failure mode,
   and it is invisible unless something measures both sides.

   It also pins the one place the chain is genuinely incomplete, so it cannot be forgotten:
   PLAN_V6's Q5 block carries thirteen actions and an itemised floor but no per-action economics.
*/
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

const snap=()=>page.evaluate(()=>{
  const q=S.activeQuarter, tq=nextQuarters(q)[0]||q;
  return { q, tq, entered:enteredQuarters().length,
    obs:S.learning.obs, confidence:S.learning.confidence,
    anchorKeys:Object.keys(S.learning.anchors||{}).sort().join(','),
    anchorQ:((S.learning.anchors||{})['europe|Y']||{}).q||null,
    techTarget:S.config.goals.techXTarget+'/'+S.config.goals.techYTarget,
    floorQ5:S.config.goals.floors.Q5||0,
    floorNow:Math.round(floorComponents(tq).total),
    cash:Math.round(unifiedCashOf(q)),
    score:+scoreProxy(null).value.toFixed(1),
    breaks:(()=>{ try{ const w=whatBreaksFirst(q,null); return w.ok?'none':w.q; }catch(e){ return 'ERR'; } })(),
    capX:capacityForProduct('X').units,
    split:JSON.stringify(S.config.plantSplit),
    snaps:((S.masterPlan||{}).snapshots||[]).length,
    ctx:buildAIContext(q).length };
});

const before=await snap();
ck('the fixture starts with three quarters in and Q4 as the target',
  before.entered===3 && before.tq==='Q4', `${before.entered} entered · target ${before.tq}`);

/* Ingest Q4 the way the app does it: applyParsed writes the report (and, importantly, carries the
   X/Y plant split into S.config.plantSplit — the capacity figures read the declaration, not the
   raw plant count), then confirmQuarter is the approval step that runs the learning and re-derives
   the targets. Parsing alone must not do any of that; that separation is asserted in ingest.cjs. */
await page.evaluate(()=>{
  S.ui=S.ui||{}; S.ui.ingestQ='Q4'; S.activeQuarter='Q4';
  applyParsed({ summary:'rollover fixture', mrCount:2, scan:{
    netProfit:1250000, revenue:8400000, retainedEarnings:-1100000, loans:520000,
    cash:{us:150000,europe:900000,brazil:1800000,hq:640000},
    techX:3, techY:2, rd:250000,
    plantsByRegion:{us:0,europe:4,brazil:1},
    plantsByProduct:{us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:1}} }});
  const Q=S.quarters.Q4;
  Q.operational.inventory=[{product:'Y',grade:2,region:'europe',qty:9000,cost:70,price:135}];
  Q.marketIntel.sales=[{region:'europe',product:'Y',company:8,units:14000},
                       {region:'europe',product:'Y',company:3,units:19000},
                       {region:'brazil',product:'Y',company:8,units:5000},
                       {region:'brazil',product:'Y',company:5,units:11000}];
  save();
});
const parsed=await snap();
ck('parsing alone does not mark the quarter entered — approval is a separate act',
  parsed.entered===3, `${parsed.entered} entered after parse`);
ck('...but the plant X/Y split travels with the report, so capacity stops being a question mark',
  parsed.capX>before.capX, `${before.capX} → ${parsed.capX} chips/quarter`);

await page.evaluate(()=>confirmQuarter()); await page.waitForTimeout(800);
await page.evaluate(()=>{ S.activeQuarter='Q4'; });
const after=await snap();

ck('confirming is what enters the quarter and moves the target forward',
  after.entered===4 && after.tq==='Q5', `${after.entered} entered · target ${after.tq}`);

// --- the demand engine
ck('the demand engine counts the new observation',
  after.obs===before.obs+1 && after.confidence>before.confidence,
  `${before.obs}→${after.obs} obs · confidence ${before.confidence}→${after.confidence}`);
ck('...and re-anchors on the quarter that just landed, not the one it learned last time',
  after.anchorQ==='Q4' && before.anchorQ!=='Q4', `${before.anchorQ} → ${after.anchorQ}`);
ck('...picking up a market it had never seen before',
  after.anchorKeys!==before.anchorKeys, `${before.anchorKeys} → ${after.anchorKeys}`);

// --- goals and floors, which have no manual editor any more
ck('the Q9 targets are re-derived from the written plan on ingest',
  after.techTarget!==before.techTarget || after.techTarget==='4/3',
  `${before.techTarget} → ${after.techTarget}`);
ck('the cash floors are re-derived, so a floor is never measured against an old balance sheet',
  after.floorNow!==before.floorNow, `${before.floorNow} → ${after.floorNow}`);
ck('...and the plan\'s own floor is installed for a quarter the plan itemises',
  after.floorQ5>0, `Q5 floor ${after.floorQ5}`);

// --- everything derived at render time
ck('the money follows the new report', after.cash!==before.cash, `${before.cash} → ${after.cash}`);
ck('the score is recomputed against the new state', after.score!==before.score,
  `${before.score} → ${after.score}`);
ck('the projection re-runs, so "what breaks first" can move',
  after.breaks!==before.breaks || after.breaks==='none', `${before.breaks} → ${after.breaks}`);
ck('the AI fact pack is rebuilt from the new quarter', after.ctx>0 && after.ctx!==before.ctx,
  `${before.ctx} → ${after.ctx} chars`);
ck('a master-plan snapshot is taken, so the next forecast has something to be scored against',
  after.snaps>before.snaps, `${before.snaps} → ${after.snaps}`);

/* ---- the honest gap.
   Q5 is in the plan as a list, not as economics. Ticking all thirteen of its actions moves the
   ledger by nothing, and line 5 would read "cost of what I ticked: 0" as though the quarter were
   free. The engine cannot invent those figures — they are the team's to state — so what it must
   do is say so, which is what is asserted here. If Q5 ever gains real `cash` entries, the first
   two assertions flip and this block is what tells the next reader to delete the notice. */
const q5=await page.evaluate(()=>{
  const blk=planV6For('Q5'), picks=planPicks('Q5');
  blk.actions.forEach((a,i)=>picks[a.n!=null?a.n:i+1]=true); save();
  const cash=planPickedCash('Q5');
  go('plan');
  const f=document.querySelector('.content .focus');
  // U+2212 first: stripping non-ASCII before converting it silently turns every negative positive.
  const vals=[...f.querySelectorAll('.ledger b')].map(b=>Number(b.innerText.replace(/−/g,'-').replace(/[^\d.-]/g,''))||0);
  return { actions:blk.actions.length, costed:blk.actions.filter(a=>a.cash).length,
    picked:cash.picked, out:cash.out, inNow:cash.inNow,
    warns:/אין כלכלה מתומחרת/.test(f.innerText), label:/לא תומחר/.test(f.innerText),
    sums:(vals[0]+vals[1]+vals[2]===vals[3]) && (vals[3]+vals[4]===vals[5]), vals };
});
ck('Q5 is in the plan as a list of actions', q5.actions>=13, `${q5.actions} actions`);
ck('...but none of them carry costed economics, so ticking them all moves the ledger by nothing',
  q5.costed===0 && q5.picked===q5.actions && q5.out===0 && q5.inNow===0,
  `${q5.costed} costed · ticked ${q5.picked} · out ${q5.out} · in ${q5.inNow}`);
ck('so the tab SAYS the quarter is unpriced instead of printing 0 as if it were free',
  q5.warns===true && q5.label===true);
ck('...and the ledger still adds up, because the caveat is in the label, not where a number goes',
  q5.sums===true, JSON.stringify(q5.vals));

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('QUARTER ROLLOVER — what re-derives when a report lands')?1:0);
})();
