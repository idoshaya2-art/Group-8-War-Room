/* Real boot test. Loads index.html in a DOM, runs the app's own boot(), navigates every
   page, opens the modals, and fails on any uncaught error or console.error.
   This is what "does it actually work" means — the Node harness in audit-fixes.cjs only
   exercises pure functions and cannot see a render that throws.

   Run:  node tests/boot-smoke.cjs            (needs: npm i jsdom)
*/
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
// Test-only shim: `const`/`let` at the top level of a classic script are script-scoped, not
// window properties, so the suite cannot reach the engine without exporting it. Injected into
// the SAME script block (a separate tag would not see the bindings). The shipped file is
// untouched — this happens only in memory, here.
const EXPORTS = `
;window.__T={get S(){return S},set S(v){S=v},PAGES,REGIONS,QUARTERS,go,fxRate,nextQuarters,
  buildInputRows,renderChecklist,projectCashflow,chipGuard,contractPlan,scoreProxy,
  newScenario:window.newScenario,setLever:window.setLever,setLeverPrice:window.setLeverPrice,
  setLeverQty:window.setLeverQty,openMRCatalog:window.openMRCatalog,closeModal:window.closeModal,
  openGoalOptimizer:window.openGoalOptimizer,sensitivity:window.sensitivity};
`;
const cut = html.lastIndexOf('</script>');
html = html.slice(0, cut) + EXPORTS + html.slice(cut);

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/',
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    w.scrollTo = () => {};
    w.print = () => {};
    w.fetch = () => Promise.reject(new Error('offline in test'));
    w.HTMLCanvasElement.prototype.getContext = () => ({
      scale() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
      fill() {}, fillRect() {}, fillText() {}, arc() {}, closePath() {}, save() {}, restore() {},
      setLineDash() {}, createLinearGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }),
      set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set font(v) {}, set textAlign(v) {},
    });
    w.addEventListener('error', e => errors.push('uncaught: ' + (e.error ? e.error.stack : e.message)));
    w.addEventListener('unhandledrejection', e => errors.push('rejection: ' + e.reason));
    const ce = w.console.error;
    w.console.error = (...a) => { errors.push('console.error: ' + a.join(' ')); ce.apply(w.console, a); };
  },
});

const w = new Proxy(dom.window, { get(t,k){ const T=t.__T||{}; return (k in T)?T[k]:t[k]; }, set(t,k,v){ const T=t.__T||{}; if(k in T){T[k]=v;return true;} t[k]=v; return true; } });

function step(label, fn) {
  const before = errors.length;
  try { fn(); } catch (e) { errors.push(`${label}: threw ${e.message}`); }
  const added = errors.slice(before);
  console.log(`  ${added.length ? '\u2717' : '\u2713'} ${label}${added.length ? '\n      ' + added.join('\n      ') : ''}`);
  return added.length === 0;
}

setTimeout(() => {
  console.log('\n=== boot smoke ===\n');
  let allOk = true;

  allOk &= step('boot + initial render', () => {
    if (!w.S) throw new Error('state S was never created');
    if (!w.document.querySelector('#content')) throw new Error('#content missing');
  });

  // seed a realistic position so pages have something to render
  allOk &= step('seed a Q3 position', () => {
    ['Q1', 'Q2', 'Q3'].forEach(q => { w.S.quarters[q].entered = true; });
    const Q = w.S.quarters.Q3;
    Q.financial.cash = { us: 0, europe: 0, brazil: 2094904, hq: 20000 };
    Q.financial.loans = 643433; Q.financial.supplierCredit = 424170;
    Q.financial.netProfit = -499768; Q.financial.revenue = 1200000;
    Q.financial.totalEquity = 5570000; Q.financial.totalAssets = 9000000;
    Q.financial.retainedEarnings = -2429293;
    Q.operational.techX = 2; Q.operational.techY = 1; Q.operational.rd = 0;
    Q.operational.plantsByRegion = { us: 0, europe: 4, brazil: 0 };
    Q.operational.inventory = [
      { product: 'Y', grade: 0, region: 'europe', qty: 35000, cost: 42.88, price: 120 },
      { product: 'X', grade: 2, region: 'europe', qty: 30000, cost: 8, price: 41 },
    ];
    w.S.config.plantSplit = { us: { X: null, Y: null }, europe: { X: 2, Y: 2 }, brazil: { X: null, Y: null } };
    w.S.activeQuarter = 'Q3';
  });

  const pages = w.PAGES.map(p => p.id);
  pages.forEach(id => { allOk &= step(`render page: ${id}`, () => w.go(id)); });

  allOk &= step('create a scenario and render the simulator', () => {
    w.go('sim');            // the button lives on the simulator page
    w.newScenario();
    if (!w.S.scenarios.length) throw new Error('scenario not created');
  });

  allOk &= step('set price / qty levers', () => {
    const sc = w.S.scenarios[0], q = w.nextQuarters(w.S.activeQuarter)[0];
    w.setLeverPrice(sc.id, q, 'europe', '135');
    w.setLeverQty(sc.id, q, 'europe', '12000');
    w.setLever(sc.id, q, 'production', 'europe', '15000');
    w.setLever(sc.id, q, 'unitCost', 'europe', '42.88');
  });

  allOk &= step('exported A1-2 price equals the price lever (fix #72)', () => {
    const sc = w.S.scenarios[0], q = w.nextQuarters(w.S.activeQuarter)[0];
    const rows = w.buildInputRows(q, sc);
    const a12 = rows.find(r => r.form === 'A1-2');
    if (!a12) throw new Error('no A1-2 row');
    if (a12.value !== 135) throw new Error(`expected 135, got ${a12.value}`);
  });

  allOk &= step('checklist renders with the new chip guard', () => {
    const sc = w.S.scenarios[0], q = w.nextQuarters(w.S.activeQuarter)[0];
    const box = w.document.createElement('div');
    w.renderChecklist(box, q, sc);
    if (!box.innerHTML.length) throw new Error('checklist rendered empty');
  });

  allOk &= step('cashflow projection is arithmetically closed per region', () => {
    const proj = w.projectCashflow('Q3', null);
    proj.forEach(p => {
      let u = 0;
      w.REGIONS.forEach(r => { u += p.cashByRegion[r.id] * w.fxRate(r.cur); });
      if (Math.abs(u - p.unified) > 1) throw new Error(`${p.q}: unified ${p.unified} != sum ${u}`);
    });
  });

  allOk &= step('MR catalog modal opens', () => { w.openMRCatalog(); w.closeModal(); });
  allOk &= step('goal optimizer panel opens', () => { w.go('goals'); w.openGoalOptimizer(); });
  allOk &= step('sensitivity runs', () => { w.go('sim'); w.sensitivity(); });
  allOk &= step('quarter switch + cumulative view', () => {
    w.S.cumulative = true; w.go('dashboard');
    w.S.cumulative = false; w.S.activeQuarter = 'Q2'; w.go('dashboard');
    w.S.activeQuarter = 'Q3'; w.go('dashboard');
  });

  console.log(`\n${errors.length ? errors.length + ' error(s)' : 'no runtime errors'} · ${allOk ? 'PASS' : 'FAIL'}\n`);
  process.exit(allOk && !errors.length ? 0 : 1);
}, 300);
