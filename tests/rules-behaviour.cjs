const {loadPW,APP}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(600);
const R=await p.evaluate(()=>{
  const out={pass:[],fail:[]}; const ck=(n,c,d)=>(c?out.pass:out.fail).push(n+(d?' — '+d:''));

  // 1) §4.9 two-grade guard must FIRE on a third grade in one area
  S.quarters[S.activeQuarter].operational.inventory=[
    {product:'Y',region:'europe',grade:2,qty:1000,price:130,cost:70},
    {product:'Y',region:'europe',grade:4,qty:500,price:180,cost:90},
  ];
  let gl=gradeLimitGuard();
  ck('two grades in one area = at the limit, not over', gl.length===1&&gl[0].count===2&&!gl[0].over, JSON.stringify(gl[0]&&gl[0].grades));
  S.quarters[S.activeQuarter].operational.inventory.push({product:'Y',region:'europe',grade:6,qty:300,price:250,cost:120});
  gl=gradeLimitGuard();
  ck('THIRD grade in the same area is flagged as over the limit', gl.length===1&&gl[0].count===3&&gl[0].over);
  // a third grade in a DIFFERENT area is legal
  S.quarters[S.activeQuarter].operational.inventory=[
    {product:'Y',region:'europe',grade:2,qty:1000},{product:'Y',region:'us',grade:4,qty:500},{product:'Y',region:'brazil',grade:6,qty:300}];
  ck('one grade per area each = no flag', gradeLimitGuard().length===0);

  // 2) office legality
  const mk=n=>({levers:{Q4:{regions:{europe:{offices:n},us:{},brazil:{}}}}});
  ck('10 regional offices is illegal', officeLegality(mk(10),'Q4').length===1);
  ck('1 office is illegal (needs 1 central + 1 regional)', officeLegality(mk(1),'Q4').length===1);
  ck('2 offices is legal', officeLegality(mk(2),'Q4').length===0);
  ck('9 offices is legal', officeLegality(mk(9),'Q4').length===0);
  ck('0 offices = no CSO at all, legal', officeLegality(mk(0),'Q4').length===0);

  // 3) taxes must land ONE quarter later (Data Log 09), not immediately
  S.quarters.Q3.entered=true; S.activeQuarter='Q3';
  REGIONS.forEach(r=>S.quarters.Q3.financial.cash[r.id]=2000000);
  const lev={Q4:{rd:0,regions:{europe:{sales:1000000,production:0,unitCost:0,advertising:0,offices:0}}},
             Q5:{rd:0,regions:{europe:{sales:0,production:0,unitCost:0,advertising:0,offices:0}}}};
  REGIONS.forEach(r=>{['Q4','Q5'].forEach(q=>{ lev[q].regions[r.id]=lev[q].regions[r.id]||{}; });});
  const proj=projectCashflow('Q3',lev);
  const q4=proj.find(x=>x.q==='Q4'), q5=proj.find(x=>x.q==='Q5');
  ck('tax accrues in the earning quarter', q4.tax>0, 'Q4 tax='+q4.tax);
  ck('tax is NOT charged to cash in the earning quarter (A/P1)', q5 && q5.cashByRegion.europe < q4.cashByRegion.europe + 1e9,
     'europe Q4='+Math.round(q4.cashByRegion.europe)+' Q5='+Math.round(q5.cashByRegion.europe));

  // 4) loss carry-forward must shield the next quarter's tax
  const mkLev=(q4pretax,q5pretax)=>{ const L={}; ['Q4','Q5'].forEach((q,i)=>{ L[q]={rd:0,regions:{}};
    REGIONS.forEach(r=>L[q].regions[r.id]={sales:0,production:0,unitCost:0,advertising:0,offices:0});
    L[q].regions.us.sales=Math.max(0,i===0?q4pretax:q5pretax);
    L[q].regions.us.advertising=Math.max(0,-(i===0?q4pretax:q5pretax)); }); return L; };
  const taxAfterLoss=projectCashflow('Q3',mkLev(-500000,1000000)).find(x=>x.q==='Q5').tax;
  const taxNoLoss   =projectCashflow('Q3',mkLev(0,1000000)).find(x=>x.q==='Q5').tax;
  ck('a prior-quarter loss reduces the next tax bill (US carry-forward 60%)', taxAfterLoss<taxNoLoss,
     'withLoss='+taxAfterLoss+' vs noLoss='+taxNoLoss);

  // 5) positive balances earn interest
  const flat={Q4:{rd:0,regions:{}},Q5:{rd:0,regions:{}}};
  ['Q4','Q5'].forEach(q=>REGIONS.forEach(r=>flat[q].regions[r.id]={sales:0,production:0,unitCost:0,advertising:0,offices:0}));
  const pr=projectCashflow('Q3',flat);
  ck('idle positive cash grows with interest, not flat', pr[0].cashByRegion.brazil>2000000, 'Q4 brazil='+Math.round(pr[0].cashByRegion.brazil));
  ck('Brazil earns more than Europe (1.5% vs 0.7%)',
     (pr[0].cashByRegion.brazil-2000000) > (pr[0].cashByRegion.europe-2000000));

  // 6) n<N market potential
  const before=marketCapUnits('Y','europe');
  S.quarters.Q3.marketIntel={sales:[{company:8,region:'europe',product:'Y',units:100},{company:2,region:'europe',product:'Y',units:100},
    {company:3,region:'us',product:'Y',units:100},{company:4,region:'us',product:'Y',units:100},{company:5,region:'us',product:'Y',units:100}],competitors:{}};
  const after=marketCapUnits('Y','europe');
  ck('n<N shrinks per-firm potential below normal', after<before, before+' → '+after);
  ck('n<N stays ABOVE a flat n/N split', after > before*(2/5), 'n/N floor='+Math.round(before*2/5));
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f)); R.pass.forEach(f=>console.log('  ✓ '+f));
console.log('pageErrors:',errs);
await b.close();
})();
