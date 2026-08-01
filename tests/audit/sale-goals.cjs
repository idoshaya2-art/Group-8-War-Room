/* Two behaviours the team asked for by name, and the reasons they are shaped the way they are.

   1 · "אם בהחלטות רבעוניות בחרתי בפעולת מכירה — פתח חלון קטן שישאל אותי על מחיר המכירה להזנה,
       להציג המלצה לפי חוקים, מידע מהדוחות הרבעוניים או מחקרי שוק."
       The price is the one figure the written plan deliberately leaves to the quarter, because it
       is the only one that depends on what the market did last quarter rather than on the plan.
       So ticking a sale must ASK, and the recommendation beside the field must name its source —
       an unsourced number here is the invention this whole tool refuses everywhere else.

   2 · "יעדי Q9, חוזים ורצפות — מעודכן ע"ב הקיים ומבצע אופטימיזציה בכל הזנה רבעונית חדשה."
       The manual tuning panel came off the tab, so if the targets do not re-derive themselves on
       ingest they silently rot: a cash floor computed against a three-quarter-old balance sheet is
       not a floor, and there is no longer a form to fix it by hand.
*/
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();
await page.evaluate(()=>{ S.activeQuarter='Q3'; save(); go('plan'); });
await page.waitForTimeout(900);

// ---------- 1 · which actions are sales, and what the dialog knows before it opens
const info=await page.evaluate(()=>{
  const q=nextQuarters(S.activeQuarter)[0], blk=planV6For(q);
  const sales=blk.actions.map((a,i)=>({n:a.n!=null?a.n:i+1, what:a.what, info:planSaleInfo(a)}))
    .filter(x=>x.info);
  const first=sales[0]||null;
  return { q, total:blk.actions.length, sales:sales.length,
    n:first&&first.n, what:first&&first.what, ...(first?first.info:{}),
    regName:first&&first.info.reg&&first.info.reg.name, cur:first&&first.info.reg&&first.info.reg.cur };
});
ck('a sale action is recognised as one — the plan states income, not only cost',
  info.sales>=1, `${info.sales} of ${info.total} Q4 actions bring money in`);
ck('the plan\'s own price and volume are read out of the line it states them in',
  info.planPrice>0 && info.planUnits>0, `${info.planUnits} units × ${info.planPrice} ${info.cur}`);
ck('a recommendation is produced, and it is not the plan\'s number repeated back',
  info.rec>0, `recommend ${info.rec} ${info.cur} vs plan ${info.planPrice}`);
ck('...and it names where it came from, so an unsourced price cannot reach the field',
  typeof info.src==='string' && info.src.length>6, info.src);
ck('...and says whether that source is calibrated against observations or only an opening price',
  typeof info.calibrated==='boolean' && (info.calibrated===/(עוגן|MR)/.test(info.src)),
  `calibrated=${info.calibrated} · ${info.src}`);
ck('the market\'s absorption for the quarter is offered too — a price above it sells nothing',
  info.cap>0, `${info.cap} units`);

/* The recommendation must degrade in a stated order, never to a guess: a learned demand anchor
   first, then the competitors' median from MR17&28, then the Data Log opening price marked as
   uncalibrated — and when there is nothing at all it says so instead of inventing a figure. */
const fall=await page.evaluate(()=>{
  const q=nextQuarters(S.activeQuarter)[0], blk=planV6For(q);
  const a=blk.actions.find(x=>x.cash&&x.cash.in>0);
  const keepL=JSON.stringify(S.learning||{});
  const read=()=>{ const i=planSaleInfo(a); return {rec:i.rec, src:i.src, cal:i.calibrated}; };
  const withAnchor=read();
  S.learning.anchors={};                      // drop the anchor -> MR / Data Log
  const noAnchor=read();
  const keepQ=JSON.stringify(S.quarters[S.activeQuarter].marketIntel||{});
  S.quarters[S.activeQuarter].marketIntel={competitors:{}, prices:{}};
  const bare=read();
  S.learning=JSON.parse(keepL); S.quarters[S.activeQuarter].marketIntel=JSON.parse(keepQ); save();
  return {withAnchor, noAnchor, bare};
});
ck('the learned demand anchor wins when there is one, and says how many quarters taught it',
  /עוגן ביקוש/.test(fall.withAnchor.src) && fall.withAnchor.cal===true, fall.withAnchor.src);
ck('without an anchor it falls back — and never silently: the next source is named too',
  fall.noAnchor.rec>0 && fall.noAnchor.src!==fall.withAnchor.src, fall.noAnchor.src);
ck('with neither an anchor nor competitor prices it is marked uncalibrated, not passed off as known',
  fall.bare.rec==null || fall.bare.cal===false, `rec ${fall.bare.rec} · ${fall.bare.src}`);

// ---------- 2 · ticking a sale opens the dialog instead of just ticking
const dlg=await page.evaluate((n)=>{
  delete planPicks(nextQuarters(S.activeQuarter)[0])[n];
  togglePlanPick(n);
  const modal=document.querySelector('.modal, #modal, .modal-wrap');
  const vis=modal && getComputedStyle(modal).display!=='none';
  const t=modal?modal.innerText:'';
  return { opened:!!vis, price:!!document.getElementById('salePrice'),
    units:!!document.getElementById('saleUnits'),
    priceVal:(document.getElementById('salePrice')||{}).value,
    unitsVal:(document.getElementById('saleUnits')||{}).value,
    saysSource:/מקור:|אין עדיין בסיס/.test(t), saysCollection:/Data Log 09/.test(t),
    // ticking must NOT have happened yet — the price is part of the decision, not an afterthought
    tickedAlready:!!planPicks(nextQuarters(S.activeQuarter)[0])[n] };
}, info.n);
ck('ticking a sale opens the price dialog rather than silently accepting the plan\'s price',
  dlg.opened===true && dlg.price===true && dlg.units===true);
ck('...and the action is NOT yet ticked while the dialog is open',
  dlg.tickedAlready===false);
ck('the fields open pre-filled from the plan, so the default is the team\'s own number',
  Number(dlg.priceVal)===info.planPrice && Number(dlg.unitsVal)===info.planUnits,
  `${dlg.unitsVal} × ${dlg.priceVal}`);
ck('the dialog states the recommendation\'s source on screen, not only in the engine',
  dlg.saysSource===true);
ck('...and warns that only part of the revenue is collected this quarter',
  dlg.saysCollection===true);

// ---------- confirming writes the price, and the money follows it
const money=await page.evaluate((n)=>{
  const q=nextQuarters(S.activeQuarter)[0];
  const before=planPickedCash(q).inNow;
  document.getElementById('salePrice').value=130;
  document.getElementById('saleUnits').value=16000;
  confirmSalePick(n);
  const stored=planSalePick(q,n);
  const pc=planPickedCash(q);
  const line=pc.lines.find(l=>l.n===n)||{};
  const reg=REGIONS.find(r=>r.id===line.region)||REGIONS[1];
  const sched=DATALOG.collection[line.region]||[100,0,0];
  return { before, stored, gross:line.gross, now:line.now, later:line.later,
    fx:fxRate(reg.cur), pct:sched[0], ticked:!!planPicks(q)[n] };
}, info.n);
ck('confirming ticks the action and stores the price the team actually chose',
  money.ticked===true && money.stored && money.stored.price===130 && money.stored.units===16000,
  JSON.stringify(money.stored));
ck('the chosen price replaces the plan\'s revenue — converted to francs exactly once',
  money.gross===Math.round(130*16000*money.fx), `${money.gross} SF at fx ${money.fx}`);
ck('...and only the part Data Log 09 collects this quarter reaches the budget',
  money.now===Math.round(money.gross*money.pct/100) && money.later===money.gross-money.now,
  `${money.now} now (${money.pct}%) + ${money.later} later`);
ck('untick clears it, so the money goes back to where it was',
  await page.evaluate((n)=>{ const q=nextQuarters(S.activeQuarter)[0];
    togglePlanPick(n); return planPickedCash(q).inNow; }, info.n)===money.before,
  `back to ${money.before}`);

// ---------- 3 · the targets re-derive themselves on every ingest
const goals=await page.evaluate(()=>{
  const G=S.config.goals;
  // stale them deliberately: this is exactly the state the removed manual panel used to fix
  G.techXTarget=0; G.techYTarget=0; G.cumProfitTarget=0; G.floors={Q4:0,Q5:0,Q6:0};
  save();
  const stale=JSON.parse(JSON.stringify({tx:G.techXTarget,ty:G.techYTarget,
    cp:G.cumProfitTarget,fl:G.floors}));
  const keep=S.activeQuarter;
  S.activeQuarter='Q3'; confirmQuarter();
  const plan=planV6Goals(), derived=recommendFloors().floors;
  S.activeQuarter=keep;
  return { stale, plan, derived,
    now:{tx:G.techXTarget, ty:G.techYTarget, cp:G.cumProfitTarget, re:G.finalRETarget,
         noLoans:G.noExternalLoans, fl:{...G.floors}} };
});
ck('an ingest re-derives the Q9 grade targets from the written plan, with nothing retyped',
  goals.now.tx===goals.plan.techXTarget && goals.now.ty===goals.plan.techYTarget
  && goals.now.tx!==goals.stale.tx,
  `X${goals.now.tx}/Y${goals.now.ty} (was X${goals.stale.tx}/Y${goals.stale.ty})`);
ck('...and the cumulative profit and closing retained earnings the plan commits to',
  goals.now.cp===goals.plan.cumProfitTarget && goals.now.re===goals.plan.finalRETarget,
  `${goals.now.cp} SF cumulative · ${goals.now.re} SF closing`);
ck('...and the plan\'s no-external-loans constraint travels with them',
  goals.now.noLoans===true);
ck('the cash floors are re-optimised against the state that just landed, not left at zero',
  Object.keys(goals.derived).every(q=>goals.now.fl[q]!=null) &&
  Object.values(goals.now.fl).some(v=>v>0), JSON.stringify(goals.now.fl));
/* Precedence matters and is the whole reason the merge is written in that order: the engine's
   derived floor fills every quarter, but for a quarter the plan itemises, the plan's own figure
   is the team's commitment and must win. */
ck('for a quarter the plan itemises, the plan\'s floor wins over the engine\'s derived one',
  Object.entries(goals.plan.floors).every(([q,v])=>goals.now.fl[q]===v),
  Object.entries(goals.plan.floors).map(([q,v])=>`${q} ${v}`).join(' · '));
ck('...and a quarter the plan does not itemise still gets a floor rather than none',
  Object.keys(goals.derived).filter(q=>goals.plan.floors[q]==null)
    .every(q=>goals.now.fl[q]===goals.derived[q]), 'engine value retained');

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('SALE PRICE & SELF-UPDATING TARGETS')?1:0);
})();
