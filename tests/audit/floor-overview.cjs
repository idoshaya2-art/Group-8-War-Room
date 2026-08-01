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
  const withAmort={ legal:has(/^מזומן שחייב להישאר במטה/), buffer:has(/כרית ביטחון/),
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
/* One HQ line, not two: holding the 100,000 cushion already satisfies the 20,000 legal minimum,
   so reserving both counted the same franc twice. The larger binds, and the line says which. */
ck('the HQ hold is the larger of the legal minimum and the team\'s cushion, counted once',
  fl.withAmort.legal===100000 && fl.withAmort.buffer===undefined,
  `hold ${fl.withAmort.legal}`);
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

/* The plants table said what the factories CAN make and the finished-goods banner said what is
   already made and unsold, and nothing on the page related the two — the reader had to do the
   division in their head to answer the question those numbers exist to answer together: is the
   next constraint the factory or the warehouse? Both relations come from figures already on the
   page, so what is asserted is the arithmetic, not the wording. */
const link=await page.evaluate(()=>{
  const q='Q3', Q=S.quarters[q];
  const keep=JSON.stringify({s:S.config.plantSplit, i:Q.operational.inventory,
    p:Q.operational.plantsByRegion, x:Q.operational.techX, y:Q.operational.techY});
  const set=(gx,gy,pcQty)=>{
    Q.operational.plantsByRegion={us:0,europe:4,brazil:0};
    S.config.plantSplit={us:{X:0,Y:0},europe:{X:2,Y:2},brazil:{X:0,Y:0}};
    Q.operational.inventory=pcQty?[{product:'Y',grade:gy,region:'europe',qty:pcQty,cost:70,price:0}]:[];
    Q.operational.techX=gx; Q.operational.techY=gy; S.activeQuarter=q; save();
    return plantOverview(q);
  };
  // the team's actual Q3 mix: 2 chip plants + 2 PC plants in Europe, 35,000 unsold Y0
  const real=set(2,0,35000);
  go('dash');
  const txt=[...document.querySelectorAll('.content .read')]
    .find(x=>/מפעלים וקיבולת/.test(x.innerText))?.innerText||'';
  // a grade pair the conversion table forbids
  const bad=set(0,5,0);
  // a mix where the chips genuinely ARE the constraint (X3->Y1 costs 1 chip? use a costly pair)
  const costly=set(0,2,0);   // chipPerPC[0][2] = 3 chips per PC
  const r=JSON.parse(keep);
  S.config.plantSplit=r.s; Q.operational.inventory=r.i; Q.operational.plantsByRegion=r.p;
  Q.operational.techX=r.x; Q.operational.techY=r.y; save();
  return { real:real.link, txt, badRatio:bad.link.ratio, costly:costly.link };
});
ck('capacity is plants × Data Log 03 on both lines', link.real.chipsForFullY===36000,
  `X 70,000 · Y 36,000 · full Y run eats ${link.real.chipsForFullY} chips`);
ck('the page names which line is the bottleneck, from the conversion ratio',
  link.real.chipBound===false && link.real.chipSpare===34000 &&
  /צוואר הבקבוק/.test(link.txt), `spare ${link.real.chipSpare} chips`);
ck('...and says the spare chip capacity is spare, not sellable computers',
  /34,000/.test(link.txt) && /36,000/.test(link.txt));
ck('the finished stock is stated in quarters of production, not just units',
  Math.abs(link.real.stockQuarters-35000/36000)<1e-9 && /רבעון ייצור/.test(link.txt),
  `${link.real.stockQuarters.toFixed(3)} quarters`);
ck('...and says plainly that producing more before selling it only adds carrying cost',
  /עלות אחזקה/.test(link.txt) && /DL-06/.test(link.txt));
/* The other two branches, which the team's own numbers do not currently exercise. */
ck('an incompatible grade pair is reported as unbuildable rather than as capacity',
  link.badRatio===0, `chipPerPC[0][5] = ${link.badRatio}`);
ck('when a PC run really would outrun the chip line, the chips are named as the bottleneck',
  link.costly.ratio===3 && link.costly.chipBound===true && link.costly.chipSpare<0,
  `ratio ${link.costly.ratio}:1 → needs ${link.costly.chipsForFullY} of 70,000`);

/* ---------------- the three unavoidable costs that were missing entirely */
const extra=await page.evaluate(()=>{
  const Q=S.quarters.Q3.financial;
  Q.supplierCredit=1136879; Q.cash.europe=-422999; save();
  const it=l=>{ const x=floorComponents('Q3').items.find(i=>new RegExp(l).test(i.label)); return x||null; };
  const sc=it('ריבית אשראי ספקים'), carry=it('דמי אחסנה'), neg=it('ריבית על יתרה שלילית');
  // and the discretionary lines must NOT be there — a floor is what you cannot decide away
  const adv=it('^פרסום'), varProd=it('חלק המזומן בעלות ייצור');
  const fc=floorComponents('Q3');
  return { sc:sc&&{sf:sc.sf,src:sc.src}, carry:carry&&{sf:carry.sf,src:carry.src}, neg:neg&&{sf:neg.sf,src:neg.src},
    adv:!!adv, varProd:!!varProd, totalIsMandatory:fc.total===fc.mandatory,
    rd:(floorComponents('Q3').items.find(i=>/מו״פ/.test(i.label))||{}).sf,
    carryExpect:Math.round(35000*DATALOG.carryingCostPerUnit.Y.europe*fxRate('EUR')),
    negExpect:Math.round(422999*(DATALOG.interest.negBalance.below.europe/100)*fxRate('EUR')),
    rdMin:DATALOG.rdMinPerQuarter.X };
});
ck('supplier credit is charged its Data Log 07 rate, with the band named',
  extra.sc && extra.sc.sf>0 && /Data Log 07/.test(extra.sc.src) && /מדרגת/.test(extra.sc.src),
  extra.sc && `${extra.sc.sf} SF`);
ck('stock carries a Data Log 06 charge, per unit and per region',
  extra.carry && extra.carry.sf===extra.carryExpect,
  extra.carry && `${extra.carry.sf} vs ${extra.carryExpect}`);
ck('...and it says out loud that this is the linear base, not the real accelerating charge',
  extra.carry && /היסוד הליניארי/.test(extra.carry.src));
ck('an area in overdraft is charged interest on it',
  extra.neg && extra.neg.sf===extra.negExpect, extra.neg && `${extra.neg.sf} vs ${extra.negExpect}`);
/* A floor is what you must pay whatever you decide. Advertising and planned production ARE the
   decision — they are costed in the list — so carrying them here too made the floor larger than
   the obligation it stands for, and left total and mandatory meaning different things. */
ck('advertising and planned production are no longer counted as floor',
  extra.adv===false && extra.varProd===false);
ck('...so the floor total IS the mandatory total, with no second meaning', extra.totalIsMandatory===true);
ck('R&D reserves only the legal minimum, since the planned spend is a ticked action',
  extra.rd===extra.rdMin, `${extra.rd} SF`);

/* ---------------- ticking a plan action moves the quarter's money */
await page.evaluate(()=>{ S.ui=S.ui||{}; S.ui.planPicks={}; save(); go('plan'); });
await page.waitForTimeout(700);
const tick=await page.evaluate(async()=>{
  const q='Q4';
  const read=()=>{ const m=[...document.querySelectorAll('.focus')].find(c=>/הכסף של Q/.test(c.textContent));
    return [...m.querySelectorAll('.ledger>div>b')]
      .map(b=>Number(b.textContent.replace(/[^\d-]/g,''))*(/−/.test(b.textContent)?-1:1)); };
  const none=read();
  togglePlanPick(7); await new Promise(r=>setTimeout(r,400));          // R&D, cost only
  const cost=read();
  togglePlanPick(11); await new Promise(r=>setTimeout(r,400));         // Europe sale, revenue
  const withSale=read();
  const p=planPickedCash(q);
  togglePlanPick(4); await new Promise(r=>setTimeout(r,400));          // Spitzer — already in the floor
  const withFloorItem=read();
  const pf=planPickedCash(q);
  return { none, cost, withSale, withFloorItem, gross:p.gross, inNow:p.inNow, inFloor:pf.inFloor,
    euroPct:DATALOG.collection.europe[0] };
});
ck('with nothing ticked the quarter costs nothing', tick.none[4]===0 && tick.none[0]+tick.none[1]+tick.none[2]===tick.none[3]);
ck('ticking a costed action moves the cost line and the total, and the ledger still sums',
  tick.cost[4]===-530000 && tick.cost[3]+tick.cost[4]===tick.cost[5],
  `cost line ${tick.cost[4]}`);
ck('ticking a sale adds only the part Data Log 09 collects THIS quarter',
  tick.withSale[1]===Math.round(tick.gross*tick.euroPct/100) && tick.withSale[1]===tick.inNow,
  `${tick.withSale[1]} of ${tick.gross} at ${tick.euroPct}%`);
ck('...and the ledger still adds up after it',
  tick.withSale[0]+tick.withSale[1]+tick.withSale[2]===tick.withSale[3] &&
  tick.withSale[3]+tick.withSale[4]===tick.withSale[5]);
/* The Spitzer instalment is already reserved in the floor. Ticking it must not charge it again —
   that is the same franc counted as unavoidable and as chosen. */
ck('an action whose cost is already in the floor adds nothing when ticked',
  tick.withFloorItem[4]===tick.withSale[4] && tick.inFloor>0,
  `cost line unchanged at ${tick.withFloorItem[4]}, ${tick.inFloor} SF recognised as floor`);

ck('no JavaScript errors',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('FLOOR & OVERVIEW — debt service, penalties, plants, currency')?1:0);
})();
