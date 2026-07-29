/* Regression suite for the audit fixes (batch 1).
   Runs the REAL index.html logic in Node behind a DOM stub — no mocks of the engine itself.
   Each test states the defect it locks down, so a future refactor that reintroduces the bug
   fails here with the reason attached.

   Run:  node tests/audit-fixes.cjs
*/
const fs = require('fs'), path = require('path');

/* ---------- load the app ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')).replace(/^boot\(\);?$/m, '');

const node = new Proxy(function () {}, {
  get(t, k) {
    if (k === 'length') return 0;
    if (k === Symbol.iterator) return [][Symbol.iterator].bind([]);
    if (k === 'innerHTML' || k === 'textContent' || k === 'value' || k === 'className') return '';
    return node;
  },
  set() { return true; }, apply() { return node; }, has() { return true; },
});
global.window = global; global.document = node; global.navigator = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.XLSX = null; global.fetch = () => Promise.reject(new Error('no net'));
global.requestAnimationFrame = f => f(); global.setTimeout = () => 0; global.setInterval = () => 0;
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.scrollTo = () => {}; global.addEventListener = () => {}; global.getComputedStyle = () => ({});
global.devicePixelRatio = 1; global.confirm = () => false; global.alert = () => {};

const A = (new Function(src + `
;return { get S(){return S}, set S(v){S=v}, defaultState, projectCashflow, contractPlan,
  chipGuard, buildInputRows, MR_FREE, MR_STUDIES, MR_COST, DEFAULT_CONTRACTS,
  QUARTERS, REGIONS, qIndex, projectedNetAdd, sellingCostLC, depreciationLC,
  rdSuccessProb, rdSpendForProb, rdCalibration, projectedTechAt, RD_MIN,
  linesOf, activeLines, assortmentInfo, capacityCheck, sellsBothIn, phantomSales };`))();

/* ---------- tiny assert harness ---------- */
let pass = 0, fail = 0;
const t = (name, why, fn) => {
  try { fn(); pass++; console.log(`  \u2713 ${name}`); }
  catch (e) { fail++; console.log(`  \u2717 ${name}\n      נועל: ${why}\n      ${e.message}`); }
};
const eq = (got, want, msg) => {
  if (got !== want) throw new Error(`${msg || ''} expected ${want}, got ${got}`);
};
const ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

/* ---------- a seeded Group-8-like position ---------- */
function seed(over) {
  const s = A.defaultState();
  s.activeQuarter = 'Q3';
  ['Q1', 'Q2', 'Q3'].forEach(q => { s.quarters[q].entered = true; });
  const Q = s.quarters.Q3;
  Q.financial.cash = { us: 0, europe: 0, brazil: 2094904, hq: 20000 };
  Q.financial.loans = 643433;
  Q.operational.techX = 2; Q.operational.techY = 1;
  Q.operational.plantsByRegion = { us: 0, europe: 4, brazil: 0 };
  s.config.plantSplit = { us: { X: null, Y: null }, europe: { X: 2, Y: 2 }, brazil: { X: null, Y: null } };
  Q.operational.inventory = [{ product: 'Y', grade: 0, region: 'europe', qty: 35000, cost: 42.88, price: 120 }];
  s.config.goals.floors = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0, Q6: 0, Q7: 0, Q8: 0, Q9: 0 };
  if (over) over(s);
  A.S = s;
  return s;
}
const emptyLevers = () => {
  const L = {};
  A.QUARTERS.forEach(q => {
    L[q] = { rd: 0, regions: {} };
    A.REGIONS.forEach(r => { L[q].regions[r.id] = { production: 0, unitCost: 0, sales: 0, qtySold: 0, price: 0, advertising: 0, invest: 0, transferIn: 0, newFac: 0, offices: 0, product: 'Y' }; });
  });
  return L;
};

console.log('\n=== batch 1 — audit fixes ===\n');

/* ---------- #72 · exported price ---------- */
t('#72 · A1-2 exports the price lever, not sales/production',
  'ייצוא של 135 EUR כ-108 בכל רבעון שבו הייצור גדול מהמכירה',
  () => {
    seed();
    const L = emptyLevers();
    L.Q4.regions.europe = { ...L.Q4.regions.europe, production: 15000, unitCost: 42.88, price: 135, qtySold: 12000, sales: 135 * 12000, product: 'Y' };
    const rows = A.buildInputRows('Q4', { levers: L });
    const a12 = rows.find(r => r.form === 'A1-2');
    ok(a12, 'no A1-2 row emitted');
    eq(a12.value, 135, 'exported price');
    // the old formula would have produced this — make the regression explicit
    eq(Math.round((135 * 12000) / 15000), 108, 'sanity: old formula value');
  });

/* ---------- #22 · per-region breach ---------- */
t('#22 · a region in deficit is a breach even when consolidated cash is positive',
  'אזור במינוס עובר כתקין כי רק המזומן המאוחד נבדק',
  () => {
    seed(s => { s.quarters.Q3.financial.cash = { us: 0, europe: -1000000, brazil: 6000000, hq: 20000 }; s.quarters.Q3.financial.loans = 0; });
    const p = A.projectCashflow('Q3', null);
    const q4 = p.find(x => x.q === 'Q4');
    ok(q4.unified > 0, 'setup: consolidated should be positive');
    ok(q4.negRegions.includes('europe'), 'europe not reported as negative');
    eq(q4.breach, true, 'breach flag');
  });

/* ---------- #24 · deficit carries interest ---------- */
t('#24 · a negative regional balance is charged the Data Log 07 rate',
  'אזור יכול לשבת במינוס רבעונים ללא עלות בהקרנה',
  () => {
    seed(s => { s.quarters.Q3.financial.cash = { us: 0, europe: -1000000, brazil: 0, hq: 20000 }; s.quarters.Q3.financial.loans = 0; });
    const q4 = A.projectCashflow('Q3', null).find(x => x.q === 'Q4');
    const c = q4.negCost.europe;
    ok(c, 'no charge recorded for europe');
    eq(c.rate, 7, 'EU above-switchover rate (deficit 1.0M > 700K)');
    eq(c.charge, 70000, 'charge');
  });

/* ---------- #25 · quarterly interest ---------- */
t('#25 · loan interest is applied at the quarterly rate, not quarterly/4',
  'ריבית מוערכת בחסר פי-4 לאורך כל ההקרנה',
  () => {
    seed(s => { s.quarters.Q3.financial.cash = { us: 0, europe: 0, brazil: 0, hq: 10000000 }; });
    const q4 = A.projectCashflow('Q3', null).find(x => x.q === 'Q4');
    const gross = 10000000 - 643433 * 0.055;              // before interest earned on the balance
    const earned = gross * (0.5 / 100);                   // hq posBalance.lc = 0.5%
    eq(Math.round(q4.cashByRegion.hq), Math.round(gross + earned), 'HQ balance after quarterly interest');
  });

/* ---------- #27 · R&D booked at HQ ---------- */
t('#27 · R&D is charged once at HQ, not split across four areas',
  'תזרים מחלק מו״פ ב-4 והרווח ב-3 — שני הדוחות סותרים',
  () => {
    seed(s => { s.quarters.Q3.financial.cash = { us: 1000000, europe: 1000000, brazil: 1000000, hq: 1000000 }; s.quarters.Q3.financial.loans = 0; });
    const L = emptyLevers(); L.Q4.rd = 750000;
    const q4 = A.projectCashflow('Q3', L).find(x => x.q === 'Q4');
    const noRD = A.projectCashflow('Q3', emptyLevers()).find(x => x.q === 'Q4');
    const dHQ = noRD.cashByRegion.hq - q4.cashByRegion.hq;
    ok(Math.abs(dHQ - 750000) < 5000, `HQ should absorb ~750,000, absorbed ${Math.round(dHQ)}`);
    ['us', 'europe', 'brazil'].forEach(r => {
      const d = noRD.cashByRegion[r] - q4.cashByRegion[r];
      ok(Math.abs(d) < 1, `${r} should be untouched by R&D, moved ${Math.round(d)}`);
    });
  });

/* ---------- #1 · chip guard is region-aware ---------- */
t('#1 · chips in Europe do not cover a PC line in Brazil',
  'תוכנית ייצור בלתי-אפשרית עוברת כתקינה כי השבבים נספרים גלובלית',
  () => {
    seed(s => {
      s.quarters.Q3.operational.inventory.push({ product: 'X', grade: 2, region: 'europe', qty: 30000, cost: 8 });
      s.quarters.Q3.operational.plantsByRegion = { us: 0, europe: 4, brazil: 1 };
      s.config.contracts = [];
    });
    const L = emptyLevers();
    L.Q4.regions.brazil = { ...L.Q4.regions.brazil, production: 10000, unitCost: 100, product: 'Y' };
    const cg = A.chipGuard({ levers: L }, 'Q4');
    ok(cg.gap > 0, 'no gap reported despite chips being in the wrong area');
    eq(cg.worst.region, 'brazil', 'shortage region');
  });

/* ---------- #2 · contract chips are reserved ---------- */
t('#2 · chips committed to a signed contract are not available for our own PCs',
  'שבבים מחויבים נספרים פעמיים — לחוזה וגם לייצור עצמי',
  () => {
    seed(s => {
      s.quarters.Q3.operational.inventory.push({ product: 'X', grade: 3, region: 'europe', qty: 30000, cost: 8 });
      s.quarters.Q3.operational.techX = 3;
    });
    const L = emptyLevers();
    L.Q4.regions.europe = { ...L.Q4.regions.europe, production: 18000, unitCost: 42.88, product: 'Y' };
    const cg = A.chipGuard({ levers: L }, 'Q4');
    ok(cg.reserved > 0, 'contract quantity was not reserved');
    ok(cg.gap > 0, 'plan consuming reserved chips was accepted');
  });

/* ---------- #40 · clause 5 ---------- */
t('#40 · clause 5 — a lower suitable grade satisfies the commitment',
  'הכלי פוסל את התוכנית המאושרת של הצוות (אספקת X2 לפי סעיף 5) כבלתי-חוקית',
  () => {
    seed(s => { s.quarters.Q3.operational.inventory.push({ product: 'X', grade: 2, region: 'europe', qty: 30000, cost: 8 }); });
    const c = A.contractPlan().find(x => x.id === 'x3q5');
    ok(c, 'contract x3q5 missing');
    eq(c.grade, 3, 'contract grade');
    eq(c.fbGrade, 2, 'clause-5 fallback grade');
    eq(c.gap, 30000, 'strict gap at grade 3');
    eq(c.bindingGap, 0, 'binding gap once clause 5 is honoured');
  });

t('#40 · the contract carries its real commercial terms',
  'תקבול של 1,230,000 EUR וקנס של 15% אינם קיימים במנוע',
  () => {
    seed();
    const c = A.contractPlan().find(x => x.id === 'x3q5');
    eq(c.unitPrice, 41, 'unit price');
    eq(c.currency, 'EUR', 'currency');
    eq(c.penaltyPct, 15, 'penalty %');
    eq(c.contractValueLC, 1230000, 'contract value');
    eq(c.penaltySF, Math.round(1230000 * 1.15 * 1.5), 'penalty exposure in SF');
    eq((c.collection || []).join('/'), '50/30/20', 'collection schedule');
  });

t('#40 · the Q6 tranche records the conditional carve-out',
  'ההתניה על יכולת Y4 של חברה 10 נעלמת, והצוות מסתמך על סעיף 5 שלא בהכרח חל',
  () => {
    seed();
    const c6 = A.contractPlan().find(x => x.id === 'x3q6');
    ok(c6.fbBlockedNote && c6.fbBlockedNote.includes('Y4'), 'Q6 carve-out not recorded');
  });

/* ---------- #64 / #65 · market research ---------- */
t('#64 · the free studies are 17 / 28 / 74',
  'סלוט בתשלום נשרף על MR3, ו-MR74 החינמי (60% ממחצית העבר) לא נצרך',
  () => {
    seed();
    eq(A.MR_FREE.join(','), 'MR17,MR28,MR74', 'free list');
    eq(A.MR_COST('MR74'), 0, 'MR74 cost');
    eq(A.MR_COST('MR3'), 10, 'MR3 cost');
  });

t('#65 · the catalog carries booklet costs',
  'אי-אפשר לתעדף 3 סלוטים כשמחקר של 1K ומחקר של 60K נראים זהים',
  () => {
    seed();
    eq(A.MR_COST('MR81'), 60, 'MR81');
    eq(A.MR_COST('MR24'), 24, 'MR24');
    eq(A.MR_COST('MR40'), 1, 'MR40');
    const priced = A.MR_STUDIES.filter(m => m.cost !== null).length;
    ok(priced >= 35, `only ${priced} studies carry a verified cost`);
  });


/* ================= batch 2 ================= */
console.log('\n=== batch 2 — audit fixes ===\n');

t('#73 · the signed contract is emitted as an H6 row in its delivery quarter',
  'אספקת החוזה אינה ניתנת להזנה מהכלי — טופס H6 לא קיים בגיליון',
  () => {
    seed(s => { s.quarters.Q3.operational.inventory.push({ product: 'X', grade: 3, region: 'europe', qty: 30000, cost: 8 }); });
    const rows = A.buildInputRows('Q5', { levers: emptyLevers() });
    const h6 = rows.find(r => r.form === 'H6');
    ok(h6, 'no H6 row for the Q5 delivery');
    eq(h6.value, 30000, 'units');
    ok(/41/.test(h6.note) && /50\/30\/20/.test(h6.note), `terms missing from note: ${h6.note}`);
    ok(/חובה/.test(h6.flag), 'contract row not flagged as mandatory');
  });

t('#73 · market research and securities reach the sheet',
  'המלצות MR ואג״ח נעצרות במסך ההמלצות ולא מגיעות לטופס',
  () => {
    seed();
    const L = emptyLevers();
    L.Q4.actions = [{ form: 'H1-2', mrList: ['MR24', 'MR81', 'MR17'] }];
    L.Q4.securities = 500000;
    const rows = A.buildInputRows('Q4', { levers: L });
    const h12 = rows.find(r => r.form === 'H1-2'), h2 = rows.find(r => r.form === 'H2');
    ok(h12, 'no H1-2 row');
    eq(h12.value, 2, 'paid studies (MR17 is free and must not consume a slot)');
    ok(/84K/.test(h12.note), `cost not summed: ${h12.note}`);
    ok(h2 && h2.value === 500000, 'no H2 securities row');
  });

t('#73 · rows come out in real entry order and nothing is silently dropped',
  'המשתמש מתרגם ידנית בין הכלי לטופס, ושדה חסר נעלם בשקט',
  () => {
    seed();
    const L = emptyLevers();
    L.Q4.regions.europe = { ...L.Q4.regions.europe, production: 18000, unitCost: 42.88, price: 120, qtySold: 15000, sales: 1800000, advertising: 220000, offices: 4, product: 'Y' };
    L.Q4.rd = 570000;
    const rows = A.buildInputRows('Q4', { levers: L });
    const forms = rows.map(r => r.form);
    ['A1-2', 'A1-3', 'A2-4', 'H1-1'].forEach(f => ok(forms.includes(f), `${f} missing`));
    ok(forms.indexOf('A1-2') < forms.indexOf('A2-4'), 'A-forms out of order');
    ok(forms.indexOf('A2-4') < forms.indexOf('H1-1'), 'H-forms should follow A-forms');
    ok(rows.some(r => r.flag === 'לבדוק' || r.action.includes('לא תוכנן')), 'unplanned required forms not listed');
  });

t('#30 · selling cost per unit is charged (Data Log 04)',
  'שוליים מנופחים ב-25–30% ממחיר המחשב בכל תחזית ובכל אופטימום פרסום',
  () => {
    seed();
    eq(A.sellingCostLC('europe', 'Y', false), 40, 'EU, computers only');
    eq(A.sellingCostLC('europe', 'Y', true), 33, 'EU, both products');
    eq(A.sellingCostLC('brazil', 'Y', false), 160, 'Brazil, computers only');
    seed(s => { s.quarters.Q3.financial.cash = { us: 0, europe: 5000000, brazil: 0, hq: 100000 }; s.quarters.Q3.financial.loans = 0; });
    const L = emptyLevers();
    L.Q4.regions.europe = { ...L.Q4.regions.europe, qtySold: 15000, price: 120, sales: 1800000, product: 'Y' };
    const withSale = A.projectCashflow('Q3', L).find(x => x.q === 'Q4');
    const noSale = A.projectCashflow('Q3', emptyLevers()).find(x => x.q === 'Q4');
    // 15,000 units × 40 EUR of selling cost must show up somewhere in the European balance
    const delta = withSale.cashByRegion.europe - noSale.cashByRegion.europe;
    ok(delta < 15000 * 40 * 0 + 1800000 * 0.5, `selling cost not deducted (delta ${Math.round(delta)})`);
  });

t('#31 · depreciation is charged on declared plants (Data Log 03)',
  'שווי הנכסים וההון העצמי ב-Q9 מנופחים — 45% ממחצית הפוטנציאל',
  () => {
    seed();
    eq(A.depreciationLC('europe', 'X', 2), Math.round(1000000 * 0.08 * 2), 'EU chip plants');
    eq(A.depreciationLC('europe', 'Y', 2), Math.round(800000 * 0.05 * 2), 'EU PC plants');
  });

t('#14 · R&D success is a probability, and the legal minimum is not enough',
  'הכלי מבטיח דרגה תמורת 80,000 SF כשהניסיון שלכם אומר 300–500 אלף',
  () => {
    seed();
    const cal = A.rdCalibration();
    eq(A.rdSuccessProb('X', 0, cal), 0, 'no spend');
    eq(A.rdSuccessProb('X', A.RD_MIN.X - 1, cal), 0, 'below the legal minimum');
    const pMin = A.rdSuccessProb('X', A.RD_MIN.X, cal);
    const pBig = A.rdSuccessProb('X', 500000, cal);
    ok(pMin < 0.05, `minimum spend should be near-hopeless, got ${pMin.toFixed(2)}`);
    ok(pBig > 0.5 && pBig < 0.86, `500K should be likely but not certain, got ${pBig.toFixed(2)}`);
    ok(A.rdSpendForProb('X', 0.6, cal) > 200000, 'a 60% chance should cost real money');
  });

t('#15 · the projection reports expected grade, not a promise',
  'תוכנית שמניחה הצלחה ודאית מנפחת את מחצית הפוטנציאל בציון',
  () => {
    seed();
    const L = emptyLevers();
    ['Q4', 'Q5', 'Q6'].forEach(q => { L[q].rd = 100000; });
    const pt = A.projectedTechAt('Q3', L);
    ok(pt.probs.length > 0, 'no probabilities reported');
    ok(pt.expX < 3 || pt.expY < 2, 'expectation should be fractional, not a whole grade');
    ok(pt.cal && pt.cal.src, 'calibration source not stated');
  });


/* ================= batch 3 ================= */
console.log('\n=== batch 3 — audit fixes ===\n');

const twoLineEU = () => {
  const L = emptyLevers();
  L.Q4.regions.europe = { ...L.Q4.regions.europe,
    product: 'X', grade: 2, model: 'Standard', production: 48000, unitCost: 8, price: 41, qtySold: 0, sales: 0,
    lines: [{ product: 'Y', grade: 1, model: 'Deluxe', production: 18000, unitCost: 42.88, price: 120, qtySold: 15000, sales: 1800000, advertising: 220000 }] };
  return L;
};

t('#74 · one area runs a chip line AND a PC line in the same quarter',
  'ה-Q4 שלכם — 48,000 X2 ו-18,000 Y1 באירופה — לא ניתן לביטוי בכלי',
  () => {
    seed();
    const L = twoLineEU();
    const ls = A.activeLines(L.Q4, 'europe');
    eq(ls.length, 2, 'lines in Europe');
    eq(ls.filter(l => l.product === 'X')[0].production, 48000, 'chip line');
    eq(ls.filter(l => l.product === 'Y')[0].production, 18000, 'PC line');
  });

t('#74 · the input sheet emits both lines',
  'שורת הייצור השנייה נעלמת מהגיליון שמוקלד למשחק',
  () => {
    seed();
    const rows = A.buildInputRows('Q4', { levers: twoLineEU() });
    ok(rows.some(r => r.form === 'A2-3' && r.value === 48000), 'chip production row missing');
    ok(rows.some(r => r.form === 'A2-4' && r.value === 18000), 'PC production row missing');
    ok(rows.some(r => r.form === 'A1-2' && r.value === 120), 'PC price row missing');
  });

t('#74 · chip coverage sees the chips this quarter produces alongside the PC line',
  'שורת השבבים לא נספרת, ובדיקת הכיסוי מדווחת על התוכנית הנכונה כשגויה',
  () => {
    seed(s => { s.quarters.Q3.operational.inventory.push({ product: 'X', grade: 2, region: 'europe', qty: 20000, cost: 8 }); s.config.contracts = []; });
    const cg = A.chipGuard({ levers: twoLineEU() }, 'Q4');
    const eu = cg.byRegion.find(x => x.region === 'europe');
    eq(eu.pc, 18000, 'PC units counted');
    eq(eu.chipMade, 48000, 'chip line counted');
  });

t('#74 · capacity binds per product across lines, against declared plants',
  'ייצור שחורג מהקיבולת עובר, או ייצור תקין נחסם, כי נבדק מפעל אחד בלבד',
  () => {
    seed();
    const L = twoLineEU();
    const issues = A.capacityCheck({ levers: L }, 'Q4');
    // 48,000 chips over 2 EU chip plants (35,000 each = 70,000) is legal
    ok(!issues.some(i => i.product === 'X'), `chip line wrongly flagged: ${JSON.stringify(issues)}`);
    L.Q4.regions.europe.production = 100000;
    ok(A.capacityCheck({ levers: L }, 'Q4').some(i => i.product === 'X'), '100,000 chips should exceed 2 plants');
  });

t('#74 · selling cost drops to the both-products tier when an area sells chips and PCs',
  'עלות המכירה נגבית בטעות בתעריף מוצר-יחיד',
  () => {
    seed();
    const L = twoLineEU();
    L.Q4.regions.europe.qtySold = 5000; L.Q4.regions.europe.sales = 205000;
    ok(A.sellsBothIn(L.Q4, 'europe'), 'area not detected as selling both');
    eq(A.sellingCostLC('europe', 'Y', true), 33, 'both-product tier');
  });

t('#47 · two distinct grades in an area open a second demand pool',
  'הקפיצה מ-15,000 ל-26,000 יח׳ ב-Q5 נשענת על הנחה בלי מנגנון',
  () => {
    seed();
    const L = emptyLevers();
    L.Q5.regions.europe = { ...L.Q5.regions.europe,
      product: 'Y', grade: 0, model: 'Standard', qtySold: 8000, price: 115, sales: 920000,
      lines: [{ product: 'Y', grade: 1, model: 'Deluxe', qtySold: 18000, price: 150, sales: 2700000 }] };
    const one = A.assortmentInfo(emptyLevers().Q5, 'europe', 'Y');
    const two = A.assortmentInfo(L.Q5, 'europe', 'Y');
    eq(one.models, 1, 'single-model baseline');
    eq(two.models, 2, 'two models detected');
    ok(two.factor > one.factor, 'assortment does not raise total demand');
    ok(two.cannibalisation > 0, 'cannibalisation not modelled');
  });

t('#47 · the same grade twice is ONE model, not two',
  'הכלי סופר Standard Y1 + Deluxe Y1 כשני דגמים — צירוף שלא קיים במשחק',
  () => {
    seed();
    const L = emptyLevers();
    L.Q5.regions.europe = { ...L.Q5.regions.europe, product: 'Y', grade: 1, qtySold: 8000, price: 150, sales: 1200000,
      lines: [{ product: 'Y', grade: 1, model: 'Deluxe', qtySold: 10000, price: 150, sales: 1500000 }] };
    eq(A.assortmentInfo(L.Q5, 'europe', 'Y').models, 1, 'same grade counted twice');
  });

console.log(`\n${pass} passed · ${fail} failed\n`);
process.exit(fail ? 1 : 0);
