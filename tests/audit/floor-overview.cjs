/* The floor is what you must be able to pay whatever happens, and the dashboard's standing facts.

   The floor used to count interest but not the principal beside it, treated the legal 20,000 SF
   HQ minimum as if it were a working buffer, and ignored a penalty on a commitment whose
   production deadline had already gone by. All three are unavoidable and none of them were there.

   The plant read-out exists because it is what the team asks each other in the room — how many
   plants, where, making what, and how many units a quarter that buys. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---------------- the amortisation, derived rather than typed
const am=await page.evaluate(()=>{
  const set=(a,b,c)=>{ S.quarters.Q1.financial.loans=a; S.quarters.Q2.financial.loans=b;
    S.quarters.Q3.financial.loans=c; save(); };
  const keep=[S.quarters.Q1.financial.loans,S.quarters.Q2.financial.loans,S.quarters.Q3.financial.loans];
  // the team's own three balances
  set(883490,764650,643433);
  const real=loanAmortisation();
  set(500000,600000,700000);          // borrowing, not repaying
  const rising=loanAmortisation();
  set(900000,800000,700000);          // straight line — no interest, so not a Spitzer schedule
  const linear=loanAmortisation();
  set(900000,100000,90000);           // erratic
  const erratic=loanAmortisation();
  set(0,0,0);
  const none=loanAmortisation();
  set(keep[0],keep[1],keep[2]);
  return { real, rising:!!rising, linear, erratic:!!erratic, none:!!none };
});
ck('a constant-payment loan is derived from three balances, with no field to fill in',
  am.real && Math.abs(am.real.payment-136510)<=2 && Math.abs(am.real.rate-0.02)<0.0005,
  am.real?`payment ${am.real.payment}, rate ${(am.real.rate*100).toFixed(2)}%`:'null');
ck('...and it splits into the principal and the interest that make it up',
  am.real && am.real.principal+am.real.interest===am.real.payment &&
  Math.abs(am.real.interest-12869)<=2, am.real?`${am.real.principal} + ${am.real.interest}`:'null');
ck('...citing the balances it was derived from, so the claim is checkable',
  am.real && /883,490/.test(am.real.src) && /643,433/.test(am.real.src), am.real&&am.real.src.slice(0,60));
ck('a rising balance is not read as a repayment schedule', am.rising===false);
ck('a series with no implied interest is rejected rather than fitted',
  am.linear===null || am.linear===false, JSON.stringify(am.linear));
ck('an erratic series is rejected', am.erratic===false);
ck('no debt at all yields no schedule', am.none===false);

// ---------------- what the floor now reserves
const fl=await page.evaluate(()=>{
  S.quarters.Q1.financial.loans=883490; S.quarters.Q2.financial.loans=764650;
  S.quarters.Q3.financial.loans=643433; save();
  const fc=floorComponents('Q3');
  const has=re=>fc.items.find(i=>re.test(i.label));
  const withAmort={ legal:has(/מינימום חוקי/), buffer:has(/כרית ביטחון/),
    debt:has(/החזר הלוואה/), interestOnly:has(/^ריבית על חוב/) };
  // break the series and the floor must fall back to interest only, and say so
  S.quarters.Q1.financial.loans=0; S.quarters.Q2.financial.loans=0; save();
  const fb=floorComponents('Q3');
  const fallback={ debt:fb.items.find(i=>/החזר הלוואה/.test(i.label)),
    interestOnly:fb.items.find(i=>/^ריבית על חוב/.test(i.label)) };
  S.quarters.Q1.financial.loans=883490; S.quarters.Q2.financial.loans=764650; save();
  return { withAmort:{ legal:withAmort.legal&&withAmort.legal.sf, buffer:withAmort.buffer&&withAmort.buffer.sf,
      debt:withAmort.debt&&withAmort.debt.sf, debtSrc:withAmort.debt&&withAmort.debt.src,
      interestOnly:!!withAmort.interestOnly },
    fallback:{ debt:!!fallback.debt, interestOnly:!!fallback.interestOnly,
      src:fallback.interestOnly&&fallback.interestOnly.src },
    everyItemSourced:floorComponents('Q3').items.every(i=>i.sf>0) };
});
ck('the legal HQ minimum and the team\'s own cushion are separate lines, not one merged number',
  fl.withAmort.legal===20000 && fl.withAmort.buffer===100000,
  `legal ${fl.withAmort.legal} · buffer ${fl.withAmort.buffer}`);
ck('the floor reserves the whole loan payment, not only its interest',
  Math.abs(fl.withAmort.debt-136511)<=2 && fl.withAmort.interestOnly===false,
  `${fl.withAmort.debt} SF`);
ck('...and names where the schedule came from', /נגזר ממאזני/.test(fl.withAmort.debtSrc||''));
ck('with no derivable schedule it falls back to interest and says that is all it is',
  fl.fallback.debt===false && fl.fallback.interestOnly===true &&
  /לא נמצאה סדרת מאזנים/.test(fl.fallback.src||''), fl.fallback.src);

// penalty exposure: only once production can no longer close the gap
const pen=await page.evaluate(()=>{
  const read=()=>{ const it=floorComponents('Q3').items.find(i=>/חשיפת קנס/.test(i.label));
    return it?it.sf:0; };
  const keep=JSON.parse(JSON.stringify(S.config.contracts||[]));
  // a commitment whose production quarter is still ahead — the cost of meeting it is production,
  // and charging a penalty as well would bill the same obligation twice
  S.config.contracts=[{product:'X',grade:3,qty:30000,deliveryQuarter:'Q5',price:41,currency:'EUR',penaltyPct:15}];
  save(); const ahead=read();
  // the same commitment once its production deadline has gone by
  S.config.contracts=[{product:'X',grade:3,qty:30000,deliveryQuarter:'Q3',price:41,currency:'EUR',penaltyPct:15}];
  save(); const passed=read();
  S.config.contracts=keep; save();
  return {ahead, passed, expected:Math.round(30000*41*1.15*1.5)};
});
ck('a commitment still in time is not charged a penalty on top of its production cost',
  pen.ahead===0, `${pen.ahead} SF`);
ck('once the production deadline has passed, the penalty is reserved at price + the contract %',
  Math.abs(pen.passed-pen.expected)<=2, `${pen.passed} SF vs ${pen.expected} expected`);

// ---------------- the plant and capacity read-out
const po=await page.evaluate(()=>{
  S.config.plantSplit={europe:{X:2,Y:2}}; save();
  const declared=plantOverview('Q3');
  S.config.plantSplit={}; save();
  const undeclared=plantOverview('Q3');
  return { declared:{ x:declared.totX, y:declared.totY, plants:declared.plants, warn:declared.anyUndeclared },
    undeclared:{ x:undeclared.totX, y:undeclared.totY, warn:undeclared.anyUndeclared },
    dlX:DATALOG.capacity.X.europe, dlY:DATALOG.capacity.Y.europe };
});
ck('capacity is plants × the Data Log figure, not an estimate',
  po.declared.x===2*po.dlX && po.declared.y===2*po.dlY,
  `X ${po.declared.x} = 2×${po.dlX} · Y ${po.declared.y} = 2×${po.dlY}`);
ck('...which is the 70,000 chips and 36,000 computers the plan is built on',
  po.declared.x===70000 && po.declared.y===36000);
ck('an undeclared X/Y split reports no capacity and flags itself, rather than guessing one',
  po.undeclared.x===0 && po.undeclared.y===0 && po.undeclared.warn===true);

// ---------------- currency is stated wherever money is
await page.evaluate(()=>{ S.config.plantSplit={europe:{X:2,Y:2}}; save(); go('plan'); });
await page.waitForTimeout(800);
const cur=await page.evaluate(()=>{
  const money=[...document.querySelectorAll('.focus')].find(c=>/הכסף של Q/.test(c.textContent));
  const vals=[...money.querySelectorAll('.ledger>div>b')].map(b=>b.textContent.trim());
  return { vals, allSF:vals.every(v=>/SF$/.test(v)) };
});
ck('every line of the money ledger states its currency', cur.allSF===true, cur.vals.join(' | '));

await page.evaluate(()=>go('dash')); await page.waitForTimeout(800);
const dash=await page.evaluate(()=>{
  const c=document.querySelector('.content');
  const det=[...c.querySelectorAll('details')];
  const demand=det.find(d=>/מנוע הביקוש/.test((d.querySelector('summary')||{}).textContent||''));
  const regionTable=[...c.querySelectorAll('table')].find(t=>/במטבע מקומי/.test(t.textContent));
  return { demandExists:!!demand, demandOpen:demand?demand.open:null,
    hasPlants:/מפעלים וקיבולת ייצור/.test(c.innerText),
    hasRegionCash:!!regionTable,
    // each region's cash row must carry its own currency code AND the SF equivalent
    regionRowsLabelled: regionTable
      ? [...regionTable.querySelectorAll('tbody tr')].slice(0,4)
          .every(tr=>/(USD|EUR|BRL|CHF)/.test(tr.textContent) && /SF/.test(tr.textContent))
      : false,
    kpisLabelled:['מזומן מאוחד (SF)','רווח נקי (SF)','חוב (SF)'].every(t=>c.innerText.includes(t)) };
});
ck('the elasticity engine is folded on the dashboard', dash.demandExists===true && dash.demandOpen===false);
ck('the dashboard states plants and the capacity they buy', dash.hasPlants===true);
ck('...and cash per region, each in its own currency with the SF equivalent beside it',
  dash.hasRegionCash===true && dash.regionRowsLabelled===true);
ck('the headline KPIs name their currency', dash.kpisLabelled===true);

ck('no JavaScript errors',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('FLOOR & OVERVIEW — debt service, penalties, plants, currency')?1:0);
})();
