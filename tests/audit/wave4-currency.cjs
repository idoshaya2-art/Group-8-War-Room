/* D-05 · F-08 / F-09 were left PARTIAL because the currency paths were not covered end to end.
   Every region has its own currency, its own collection schedule (Data Log 09), its own tax rate,
   its own positive- and negative-balance interest, and its own switchover threshold. This walks
   each one individually so a single wrong rate cannot hide inside a consolidated total. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

const blank=`(base)=>{ const lev={}; nextQuarters(base).forEach(q=>{ lev[q]={rd:0,regions:{}};
  REGIONS.forEach(r=>lev[q].regions[r.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,
    transferIn:0,transferOut:0,product:'Y',model:'Standard',newFac:0,offices:0}); }); return lev; }`;

// ---------- the consolidation identity, per region and per quarter
const ident=await page.evaluate((mk)=>{
  const blankLev=eval(mk);
  const lev=blankLev('Q3');
  lev.Q4.regions.europe.production=10000; lev.Q4.regions.europe.unitCost=50;
  lev.Q4.regions.europe.price=140; lev.Q4.regions.europe.qtySold=9000; lev.Q4.regions.europe.sales=1260000;
  lev.Q5.regions.brazil.production=5000; lev.Q5.regions.brazil.unitCost=60;
  lev.Q5.regions.brazil.price=900; lev.Q5.regions.brazil.qtySold=4000; lev.Q5.regions.brazil.sales=3600000;
  lev.Q6.regions.us.production=4000; lev.Q6.regions.us.unitCost=55;
  lev.Q6.regions.us.price=300; lev.Q6.regions.us.qtySold=3500; lev.Q6.regions.us.sales=1050000;
  const proj=projectCashflow('Q3',lev);
  let worst=0;
  proj.forEach(p=>{ const sum=REGIONS.reduce((a,r)=>a+p.cashByRegion[r.id]*fxRate(r.cur),0);
    worst=Math.max(worst, Math.abs(sum-p.unified)); });
  return { worst:+worst.toFixed(6), quarters:proj.length,
    fx:Object.fromEntries(REGIONS.map(r=>[r.cur,fxRate(r.cur)])) };
}, blank);
ck('D-05 · sum(region cash x fx) equals the unified figure in every projected quarter',
  ident.worst<0.001, `max |sum-unified| = ${ident.worst} over ${ident.quarters} quarters`);
ck('D-05 · every region currency has a rate', Object.values(ident.fx).every(v=>v>0), JSON.stringify(ident.fx));

// ---------- collection schedules: each region's own lag, summing to 100%
const coll=await page.evaluate(()=>{
  const p=S.config.params, out={};
  REGIONS.filter(r=>r.id!=='hq').forEach(r=>{ const s=p.collection[r.id]||[];
    out[r.id]={sched:s, sum:s.reduce((a,b)=>a+b,0)}; });
  return out;
});
Object.entries(coll).forEach(([rid,v])=>
  ck(`D-05 · ${rid} collection schedule sums to 100% (Data Log 09)`, v.sum===100, `${v.sched.join('/')} = ${v.sum}`));

/* One region at a time: revenue booked there must arrive there on that region's own schedule.
   Getting this check right took three attempts, and the engine was correct every time — worth
   recording, because each wrong version looked like a defect:
     1. Reading the cash DELTA as the collection. It is net of production and selling cost, and US
        selling cost is exactly 40/unit — so on a 10,000-unit sale at 100 the 40% collection and
        the selling cost cancel to almost exactly zero. That coincidence looked like "no collection".
     2. Asserting the deferred slices equal their nominal percentages. They cannot: Data Log 09
        defers tax by exactly one quarter, so the second quarter carries the collection MINUS the
        whole quarter's tax, and in Europe that is negative.
   The isolation below books revenue with zero units, so there is no selling cost, and reads the
   first quarter — before any deferred tax lands — against the schedule's immediate slice. */
const perRegion=await page.evaluate((mk)=>{
  const blankLev=eval(mk); const out={}; const REVENUE=1000000;
  REGIONS.filter(r=>r.id!=='hq').forEach(r=>{
    const withSale=blankLev('Q3'), without=blankLev('Q3');
    withSale.Q4.regions[r.id].sales=REVENUE;   // revenue only: zero units => zero selling cost
    const a=projectCashflow('Q3',withSale), b=projectCashflow('Q3',without);
    const cum=a.map((p,i)=>Math.round(p.cashByRegion[r.id]-b[i].cashByRegion[r.id]));
    const arrivals=cum.map((d,i)=>i?d-cum[i-1]:d);
    out[r.id]={ sched:S.config.params.collection[r.id], arrivals, cum, revenue:REVENUE,
      taxRate:DATALOG.tax[r.id] };
  });
  return out;
}, blank);
Object.entries(perRegion).forEach(([rid,v])=>{
  const immediate=v.revenue*v.sched[0]/100;
  ck(`D-05 · ${rid} collects its own ${v.sched[0]}% in the sale quarter, before tax defers`,
    v.arrivals[0]>=immediate && (v.arrivals[0]-immediate)/immediate<0.02,
    `arrived ${v.arrivals[0]} vs ${Math.round(immediate)} (+interest on the positive balance)`);
  const lastSlice=v.sched.filter(x=>x>0).length;      // 2 for the US, 3 for EU and Brazil
  ck(`D-05 · ${rid} is still settling in quarter ${lastSlice} of its ${v.sched.join('/')} schedule`,
    Math.abs(v.arrivals[lastSlice-1])>1000, `arrivals ${v.arrivals.slice(0,3).join(', ')}`);
  // after the schedule ends only interest should move the balance, never another revenue slice
  const tail=v.arrivals[lastSlice], smallestSlice=v.revenue*Math.min(...v.sched.filter(x=>x>0))/100;
  ck(`D-05 · ${rid} receives no further revenue once its schedule ends — only interest`,
    Math.abs(tail)<smallestSlice*0.1, `quarter ${lastSlice+1} moved by ${tail}`);
  // and the whole sale, net of that region's tax, has landed by then
  const expected=v.revenue*(1-v.taxRate/100);
  ck(`D-05 · ${rid} has collected the sale net of its ${v.taxRate}% tax by the end of the schedule`,
    Math.abs(v.cum[lastSlice-1]-expected)/expected<0.05,
    `cumulative ${v.cum[lastSlice-1]} vs ${Math.round(expected)}`);
});

// ---------- negative balances are charged, and step up above each region's switchover
const neg=await page.evaluate(()=>{
  const out={};
  REGIONS.forEach(r=>{
    const below=DATALOG.interest.negBalance.below[r.id], above=DATALOG.interest.negBalance.above[r.id];
    const sw=DATALOG.interest.supplierCredit.switchover[r.id];
    out[r.id]={below, above, sw, stepsUp:above>below};
  });
  return out;
});
Object.entries(neg).forEach(([rid,v])=>
  ck(`D-05 · ${rid} charges more above its switchover than below it (Data Log 07)`,
    v.stepsUp===true, `below ${v.below}% · above ${v.above}% · switchover ${v.sw}`));

// ---------- a deficit in one region is a breach even when the consolidated total looks fine
const seg=await page.evaluate((mk)=>{
  const blankLev=eval(mk); const lev=blankLev('Q3');
  // spend heavily in the US only, while the group holds plenty of cash elsewhere
  S.quarters.Q3.financial.cash={us:50000, europe:9000000, brazil:0, hq:500000};
  Object.assign(lev.Q4.regions.us,{production:40000,unitCost:200});
  const proj=projectCashflow('Q3',lev); const p=proj[0];
  return { unified:Math.round(p.unified), us:Math.round(p.cashByRegion.us),
    negRegions:p.negRegions, breach:p.breach };
}, blank);
ck('D-05 · a single-region deficit is a breach even with a healthy consolidated total',
  seg.us<0 && seg.unified>0 && seg.negRegions.includes('us') && seg.breach===true,
  `unified ${seg.unified} with US at ${seg.us}, negRegions [${seg.negRegions}]`);

// ---------- tax is regional, and lands one quarter later (Data Log 09)
const tax=await page.evaluate((mk)=>{
  const blankLev=eval(mk); const out={};
  ['us','europe','brazil'].forEach(rid=>{
    const lev=blankLev('Q3');
    Object.assign(lev.Q4.regions[rid],{production:1000,unitCost:1,price:1000,qtySold:1000,sales:1000000});
    const proj=projectCashflow('Q3',lev);
    out[rid]={rate:DATALOG.tax[rid], taxQ4:Math.round(proj[0].tax), taxQ5:Math.round(proj[1].tax)};
  });
  return out;
}, blank);
ck('D-05 · the three selling regions carry three different tax rates (Data Log 07)',
  tax.us.rate!==tax.europe.rate && tax.europe.rate!==tax.brazil.rate,
  `US ${tax.us.rate}% · EU ${tax.europe.rate}% · BR ${tax.brazil.rate}%`);
ck('D-05 · an identical pre-tax profit is taxed differently by region',
  new Set([tax.us.taxQ4,tax.europe.taxQ4,tax.brazil.taxQ4]).size===3,
  `US ${tax.us.taxQ4} · EU ${tax.europe.taxQ4} · BR ${tax.brazil.taxQ4}`);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('WAVE 4 — currency, collection and tax paths (D-05)')?1:0);
})();
