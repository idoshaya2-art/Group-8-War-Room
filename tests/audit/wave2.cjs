/* Wave 2 of the audit findings, now that the real sources are in hand:
   R-34 (CORRECTED — was encoded backwards), R-10, R-32, R-49, I-1, I-5, H-2.
   Every rule asserted here is quoted from the INTOPIA guide PDF or the course booklet. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

const r=await page.evaluate(()=>{
  const o={};
  // ---- R-34 · the correction. The guide: "loans are not available UNTIL the Bank has a sense for
  // how the industry is developing" — so the EARLY quarters are closed, not the late ones.
  o.r34={ closedEarly:RULES.finance.citiLoan.earlyQuartersClosed.slice(),
    bondsFrom:RULES.finance.bonds.fromQuarter,
    noOldWindow:typeof RULES.finance.loanWindow==='undefined',
    hasSrc:['citiLoan','bonds','areaBankLoan','loanVsSecurities','interCompanyLoan'].every(k=>RULES.finance[k].src===true),
    mentionsNoPrepay:/אין פירעון מוקדם/.test(RULES.finance.citiLoan.note),
    mentionsScaleDown:/תקוצץ אוטומטית/.test(RULES.finance.areaBankLoan.note),
    mentionsSecuritiesSale:/תמכור אותו אוטומטית|ימכור את הני״ע/.test(RULES.finance.loanVsSecurities.note) };
  // ---- R-32 · price constraints that the sources actually fix
  o.r32={ brazilCap:DATALOG.maxPCPriceY0toY3,
    steps:{Y:DATALOG.minPriceChange.Y, X:DATALOG.minPriceChange.X},
    keys:['integralUnitsOnly','brazilPCCap','interCompanyMinimum','plantSaleMinimum','componentDefault','inertiaAndResentment']
      .every(k=>typeof RULES.pricing[k]==='string' && RULES.pricing[k].length>20) };
  // ---- R-49 · what makes an agreement enforceable
  o.r49={ h6:RULES.agreements.h6Fields.length, sale:RULES.agreements.saleTemplate.length,
    coop:RULES.agreements.coopTemplate.length,
    expediting:/expediting/.test(RULES.agreements.expediting),
    thousandUnits:RULES.agreements.h6Fields.some(f=>/אלפי/.test(f)),
    standing3000:/3,000 יחידות/.test(RULES.agreements.standingContract),
    w1Threshold:/SF 200,000/.test(RULES.agreements.serviceFees),
    lowerGrade:/דרגה נמוכה מתאימה/.test(RULES.agreements.lowerGradeFallback) };
  // ---- R-10 · a CSO change takes a quarter
  o.r10={ hasRule:/רק בסוף הרבעון/.test(RULES.offices.changeTakesAQuarter),
    twoQ:/שני רבעונים/.test(RULES.offices.twoQuartersToEfficiency) };
  // ---- I-1 · unverified capacity figures are named, and only the unsourced ones
  o.i1={ flagged:Object.entries(CAPACITY_UNVERIFIED).flatMap(([p,m])=>Object.keys(m).map(r=>p+'-'+r)).sort(),
    printedAreSilent:[capUnverified('X','us'),capUnverified('Y','us'),capUnverified('Y','europe')],
    wrapsWithMarker:/class="unver"/.test(capacityFigure('X','europe')),
    leavesSourcedPlain:!/class="unver"/.test(capacityFigure('X','us')) };
  // ---- I-5 · MR29+MR30 are cheap; the booklet's cost column is what we hold
  o.i5={ mr29:MR_COST('MR29'), mr30:MR_COST('MR30'), mr24:MR_COST('MR24'), mr81:MR_COST('MR81'),
    mr3:MR_COST('MR3'), free:[MR_COST('MR17'),MR_COST('MR28'),MR_COST('MR74')] };
  // ---- H-2 · MR74 free unconditionally per the booklet; no instructor question left
  o.h2={ note:mrFreeNoteFor('Q5'), noAskInstructor:!/ודאו מול המרצה/.test(mrFreeNoteFor('Q5')),
    saysFree:/חינם/.test(mrFreeNoteFor('Q5')),
    conflictsQuoted:MR_FREE_CONFLICTS.every(c=>c.claim.length>40) };
  return o;
});

ck('R-34 · the early quarters are the closed ones, not Q1 alone',
  JSON.stringify(r.r34.closedEarly)==='["Q1","Q2"]', r.r34.closedEarly.join(','));
ck('R-34 · the backwards loanWindow rule is gone', r.r34.noOldWindow===true);
ck('R-34 · every finance rule is marked as sourced (no needsSource left)', r.r34.hasSrc===true);
ck('R-34 · bonds open from Q2', r.r34.bondsFrom==='Q2');
ck('R-34 · no-prepayment, auto-scale-down and the securities auto-sale are all encoded',
  r.r34.mentionsNoPrepay && r.r34.mentionsScaleDown && r.r34.mentionsSecuritiesSale);

ck('R-32 · the Brazil Y0-Y3 price ceiling is BRL 1,400', r.r32.brazilCap===1400);
ck('R-32 · minimum price steps match the guide (PC 5/10/20, chip 1/1/10)',
  r.r32.steps.Y.us===5 && r.r32.steps.Y.europe===10 && r.r32.steps.Y.brazil===20 &&
  r.r32.steps.X.us===1 && r.r32.steps.X.europe===1 && r.r32.steps.X.brazil===10);
ck('R-32 · all six pricing constraints are encoded as text, not invented as a band', r.r32.keys===true);

ck('R-49 · the H6 field list is complete', r.r49.h6===8, `${r.r49.h6} fields`);
ck('R-49 · H6 quantities are flagged as THOUSANDS of units', r.r49.thousandUnits===true);
ck('R-49 · the expediting clause is encoded — a shortfall is forced completion, not a breach',
  r.r49.expediting===true);
ck('R-49 · the lower-grade fallback (booklet clause 5) is encoded as a legal route',
  r.r49.lowerGrade===true);
ck('R-49 · standing contract threshold (3,000 units x 3 quarters)', r.r49.standing3000===true);
ck('R-49 · W1 service fees above SF 200,000 need advance approval', r.r49.w1Threshold===true);
ck('R-49 · both booklet templates are itemised', r.r49.sale>=8 && r.r49.coop>=5,
  `sale ${r.r49.sale} · coop ${r.r49.coop}`);

ck('R-10 · a sales-organisation change takes effect only at quarter end', r.r10.hasRule===true);
ck('R-10 · the two-quarter efficiency rule is encoded', r.r10.twoQ===true);

ck('I-1 · exactly the three figures absent from the printed page are flagged',
  JSON.stringify(r.i1.flagged)==='["X-brazil","X-europe","Y-brazil"]', r.i1.flagged.join(','));
ck('I-1 · the three printed figures are NOT flagged',
  r.i1.printedAreSilent.every(x=>x===null));
ck('I-1 · an unverified figure renders with the marker', r.i1.wrapsWithMarker===true);
ck('I-1 · a sourced figure renders plain', r.i1.leavesSourcedPlain===true);

ck('I-5 · MR29 + MR30 together cost 7K, per the booklet cost column',
  r.i5.mr29===2 && r.i5.mr30===5, `${r.i5.mr29} + ${r.i5.mr30}`);
ck('I-5 · MR24 (optimal output) and MR81 (office optimisation) carry booklet prices',
  r.i5.mr24===24 && r.i5.mr81===60);
ck('I-5 · MR3 is priced, not free — the booklet overrides the guide here', r.i5.mr3===10);
ck('H-2 · the three free studies are free', JSON.stringify(r.i5.free)==='[0,0,0]');
ck('H-2 · MR74 is stated free in a non-annual quarter, with no instructor question left',
  r.h2.saysFree && r.h2.noAskInstructor, r.h2.note.replace(/<[^>]+>/g,'').slice(0,80));
ck('H-2 · both source conflicts are recorded with quoted wording', r.h2.conflictsQuoted===true);

// ---- R-10 as an actual guard, not just rule text
const guard=await page.evaluate(()=>{
  const tq=nextQuarters(S.activeQuarter)[0];
  S.quarters[S.activeQuarter].operational.offices=2;
  const mk=(offices)=>{ const sc={id:'t',name:'t',base:S.activeQuarter,levers:{}};
    sc.levers[tq]={rd:0,regions:{}};
    REGIONS.forEach(x=>sc.levers[tq].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0});
    Object.assign(sc.levers[tq].regions.europe,{offices, qtySold:9000, price:140, sales:1260000});
    return sc; };
  return { opening:officeTimingGuard(mk(6),tq).length, sameCount:officeTimingGuard(mk(2),tq).length,
           detail:(officeTimingGuard(mk(6),tq)[0]||{}).why||'' };
});
ck('R-10 · opening offices and booking the volume in the same quarter is caught',
  guard.opening===1, guard.detail.replace(/<[^>]+>/g,'').slice(0,70));
ck('R-10 · keeping the same office count raises nothing', guard.sameCount===0);

// ---- the new rule text actually reaches the screen
await page.evaluate(()=>go('intel')); await page.waitForTimeout(800);
const shown=await page.evaluate(()=>{
  const d=[...document.querySelectorAll('details')].find(x=>/כללים שנוספו מהמדריך/.test(x.textContent));
  if(d) d.open=true;
  const t=document.body.innerText;
  return { hasSection:!!d, expediting:/expediting/.test(t), citi:/CitiBank/.test(t),
    cso:/רק בסוף הרבעון/.test(t), brl:/1,400/.test(t), mr24:/MR24/.test(t) };
});
ck('the new rules are rendered, not just encoded', shown.hasSection===true);
ck('the expediting clause is visible on screen', shown.expediting===true);
ck('the corrected financing rule is visible on screen', shown.citi===true);
ck('the CSO timing rule is visible on screen', shown.cso===true);
ck('the optimal-vs-maximal capacity note points at MR24', shown.mr24===true);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('WAVE 2 — rules sourced from the guide and booklet')?1:0);
})();
