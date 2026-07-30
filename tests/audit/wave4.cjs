/* Wave 4 · R-15 (R&D continuity and the reset after each patent), R-16 (duds), R-17 (licensing),
   R-24 (the utilisation cost curve and MR24), R-25 (methods improvement), R-47 (triangulating
   estimate ranges), R-53 (partnerships in the score). Every rule quoted from the guide PDF. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---------- R-15 · the reset is the behaviour, not just the wording
const rd=await page.evaluate(()=>{
  S.quarters.Q3.operational.techX=0;
  const mk=(amount,gapAt)=>{ const lev={}; nextQuarters('Q3').forEach(q=>{ lev[q]={rd:0,rdX:(q===gapAt?0:amount),rdY:0,regions:{}};
      REGIONS.forEach(x=>lev[q].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0}); });
    return lev; };
  const min=DATALOG.rdMinPerQuarter.X;
  const steady=techPathRamped('Q3',mk(min)), gapped=techPathRamped('Q3',mk(min,'Q5'));
  return { needFirst:rdQuartersForNextGrade(0), needLater:rdQuartersForNextGrade(3),
    threeGrades:rdQuartersForGrades(3,0),
    steadyQ6:steady.Q6.X, steadyQ9:steady.Q9.X, gappedQ9:gapped.Q9.X,
    rampIsEstimate:RD_RAMP.src===false, hasNote:/מתאפסת/.test(RULES.rdProgram.resetAfterPatent),
    usesRamped:(()=>{ const rows=rollingPlan('Q3',mk(min)); return rows.find(r=>r.q==='Q6').tech.X===steady.Q6.X; })() };
});
ck('R-15 · a steady spend does NOT yield a grade every quarter',
  rd.steadyQ6<3, `X at Q6 = ${rd.steadyQ6} (one-per-quarter would be 3)`);
ck('R-15 · three grades cost more than three quarters of funding',
  rd.threeGrades>3, `${rd.threeGrades} funded quarters for 3 grades`);
ck('R-15 · later grades ramp faster than the first, as the guide says',
  rd.needLater<=rd.needFirst, `first ${rd.needFirst} · later ${rd.needLater}`);
ck('R-15 · a single unfunded quarter restarts the ramp and costs grades by Q9',
  rd.gappedQ9<rd.steadyQ9, `steady ${rd.steadyQ9} vs gapped ${rd.gappedQ9}`);
ck('R-15 · the rolling plan uses the ramped path, not the optimistic one', rd.usesRamped===true);
ck('R-15 · the ramp rate is labelled an estimate — the guide gives the reset, not a rate',
  rd.rampIsEstimate===true);
ck('R-15 · the reset rule is encoded in words as well', rd.hasNote===true);

// ---------- R-24 · the parabola, and no invented optimum
const util=await page.evaluate(()=>{
  delete S.config.optimalCapacity;
  const before=optimalCapacity('X','europe');
  S.config.optimalCapacity={X:{europe:26000}};
  const after=optimalCapacity('X','europe');
  const z=(u)=>u?u.zone:null;
  const r={ beforeKnown:before.known, afterKnown:after.known, afterUnits:after.units,
    low:z(utilisationPosition('X','europe',12000,1)), at:z(utilisationPosition('X','europe',26000,1)),
    above:z(utilisationPosition('X','europe',31000,1)), over:z(utilisationPosition('X','europe',40000,1)),
    curveQuoted:/פרבולה/.test(RULES.utilisation.curve), pointsAtMR24:/MR24/.test(RULES.utilisation.mrForOptimal) };
  setOptimalCapacity('X','europe','');
  r.clearedBackToEstimate=optimalCapacity('X','europe').known===false;
  return r;
});
ck('R-24 · optimal capacity is NOT claimed as known until MR24 is entered',
  util.beforeKnown===false && util.afterKnown===true);
ck('R-24 · the entered MR24 figure is what the engine then uses', util.afterUnits===26000);
ck('R-24 · clearing the field returns to the estimate rather than a stale number',
  util.clearedBackToEstimate===true);
ck('R-24 · all four zones of the parabola are distinguished',
  util.low==='well-below' && util.at==='optimal' && util.above==='above-optimal' && util.over==='over-max',
  `${util.low} · ${util.at} · ${util.above} · ${util.over}`);
ck('R-24 · the curve is quoted and points at the study that measures it',
  util.curveQuoted && util.pointsAtMR24);

// ---------- R-47 · intersecting estimate ranges
const tri=await page.evaluate(()=>({
  one:intersectRanges([{low:20000,high:40000}]),
  two:intersectRanges([{low:20000,high:40000},{low:28000,high:36000}]),
  dis:intersectRanges([{low:10000,high:15000},{low:20000,high:30000}]),
  none:intersectRanges([]),
  orderAgain:/להזמין את אותו מחקר שוב/.test(RULES.mrTriangulation.orderAgainNarrows),
  items:RULES.mrTriangulation.estimateItems.includes(24) && RULES.mrTriangulation.estimateItems.includes(31) }));
ck('R-47 · two ranges intersect to something narrower than either',
  tri.two.low===28000 && tri.two.high===36000 && tri.two.narrowedBy===12000,
  `${tri.two.low}-${tri.two.high}, narrowed by ${tri.two.narrowedBy}`);
ck('R-47 · a single range is reported as such, with the guide\'s remedy',
  tri.one.n===1 && /שוב/.test(tri.one.note));
ck('R-47 · non-intersecting ranges are read as the market moving, not as a bad study',
  tri.dis.disjoint===true && /הגודל עצמו השתנה/.test(tri.dis.note));
ck('R-47 · no ranges returns null rather than a fabricated interval', tri.none===null);
ck('R-47 · the estimate item list and the order-again remedy are encoded',
  tri.orderAgain && tri.items);

// ---------- R-53 · partnerships carry weight, and absence is not a penalty
const part=await page.evaluate(()=>{
  const keepC=S.config.contracts, keepA=S.config.agreements;
  S.config.contracts=[]; S.config.agreements=[];
  const none={score:partnershipScore(), pot:+scoreProxy(null).potentialHalf.toFixed(2)};
  S.config.agreements=[{kind:'supply',counterparty:2},{kind:'license',counterparty:5},{kind:'loan',counterparty:7}];
  const many={score:partnershipScore(), pot:+scoreProxy(null).potentialHalf.toFixed(2)};
  S.config.agreements=[{kind:'supply',counterparty:2}];
  const one={score:partnershipScore(), pot:+scoreProxy(null).potentialHalf.toFixed(2)};
  S.config.contracts=keepC; S.config.agreements=keepA;
  return {none, one, many, criterionQuoted:/systems-building/.test(RULES.partnerships.criterion)};
});
ck('R-53 · with nothing recorded the component is absent, not zero',
  part.none.score===null, `potential half ${part.none.pot}`);
ck('R-53 · a broad network scores higher than a single agreement',
  part.many.score.score>part.one.score.score,
  `one ${part.one.score.score.toFixed(2)} vs three ${part.many.score.score.toFixed(2)}`);
ck('R-53 · breadth is what is rewarded — distinct partners and distinct kinds',
  part.many.score.partners===3 && part.many.score.kinds.length===3);
ck('R-53 · a broad network raises the potential half above the single-agreement case',
  part.many.pot>part.one.pot, `one ${part.one.pot} vs three ${part.many.pot}`);
ck('R-53 · the criterion is quoted from the guide', part.criterionQuoted===true);

// ---------- R-16 / R-17 / R-25 · encoded with their asymmetries, not as slogans
const text=await page.evaluate(()=>({
  dudAsymmetry:/אינו בהכרח dud כשהוא מוטמע/.test(RULES.lemonRisk.asymmetry),
  halfMarket:/כמחצית/.test(RULES.lemonRisk.laggingPcHalvesChipMarket),
  noRate:/אינו נוקב בהסתברות/.test(RULES.lemonRisk.exists),
  licenceRestricted:/מייצר בלבד/.test(RULES.licensing.fullVsRestricted),
  licenceSkips:/לדלג על דרגות/.test(RULES.licensing.negotiable),
  methodsLocal:/אינו ניתן להעברה/.test(RULES.methodsImprovement.notTransferable),
  methodsAuto:/מוחל אוטומטית/.test(RULES.methodsImprovement.what),
  allSourced:['rdProgram','lemonRisk','licensing','methodsImprovement','utilisation','mrTriangulation','partnerships']
    .every(k=>RULES[k].src===true) }));
ck('R-16 · the dud asymmetry is encoded — a chip dud does not condemn the PC', text.dudAsymmetry);
ck('R-16 · the lagging-PC half-market rule is encoded', text.halfMarket);
ck('R-16 · no probability is invented for a rate the guide does not give', text.noRate);
ck('R-17 · licensing is stated as the only way to skip grades', text.licenceSkips);
ck('R-17 · restricted vs unrestricted licence is distinguished', text.licenceRestricted);
ck('R-25 · methods improvement is local, non-tradeable and auto-applied',
  text.methodsLocal && text.methodsAuto);
ck('all seven wave-4 rule blocks are marked as sourced', text.allSourced===true);

// ---------- it reaches the screen
await page.evaluate(()=>go('intel')); await page.waitForTimeout(800);
const shown=await page.evaluate(()=>{
  const d=[...document.querySelectorAll('details')].find(x=>/כללים שנוספו מהמדריך/.test(x.textContent));
  if(d) d.open=true;
  const t=document.body.innerText;
  return { reset:/מתאפסת/.test(t), dud:/dud/i.test(t), methods:/שיפור שיטות|שיפור תהליך/.test(t),
    parabola:/פרבולה/.test(t), triangulation:/חיתוך/.test(t), partnerships:/systems-building/.test(t) };
});
ck('the R&D reset rule is visible on screen', shown.reset===true);
ck('the dud/lemon risk is visible on screen', shown.dud===true);
ck('methods improvement is visible on screen', shown.methods===true);
ck('the utilisation parabola is visible on screen', shown.parabola===true);
ck('the range-intersection column is present', shown.triangulation===true);
ck('the partnership criterion is visible on screen', shown.partnerships===true);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('WAVE 4 — R&D, duds, licensing, utilisation, methods, triangulation, partnerships')?1:0);
})();
