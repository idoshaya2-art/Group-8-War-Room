const {loadPW,APP}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(700);
const R=await p.evaluate(async()=>{
  const out={pass:[],fail:[]}; const ck=(n,c,d)=>(c?out.pass:out.fail).push(n+(d?' — '+d:''));
  localStorage.setItem('intopia_ai_key_anthropic','sk-ant-test');
  S.activeQuarter='Q3'; S.quarters.Q3.entered=true;
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:1,brazil:0};
  S.quarters.Q3.operational.techX=3; S.quarters.Q3.operational.techY=1;
  REGIONS.forEach(r=>S.quarters.Q3.financial.cash[r.id]=1500000);

  // 1) horizon really reaches Q9
  const h=planHorizon('Q3');
  ck('planning horizon is Q4..Q9 (6 quarters), not 3', h.length===6 && h[5]==='Q9', h.join(','));
  go('sim'); newScenario();
  ck('a new scenario carries all 6 quarters', Object.keys(S.scenarios[S.scenarios.length-1].levers).length===6);

  // 2) strict parsing of untrusted model output
  const good=JSON.stringify({variants:[{name:'מו״פ כבד',thesis:'t',risk:'r',quarters:{Q4:{rd:150000,regions:{europe:{production:15000,price:135,qtySold:12000,advertising:60000,offices:2}}}}}]});
  let v=parseStrategyJSON('```json\n'+good+'\n```',h);
  ck('parses JSON wrapped in a code fence', v.length===1 && v[0].levers.Q4.rd===150000);
  ck('derives sales from price x qty (never trusts a reported revenue)', v[0].levers.Q4.regions.europe.sales===135*12000);
  ck('fills every horizon quarter even if the model skipped some', Object.keys(v[0].levers).length===6);
  v=parseStrategyJSON('בטח! הנה: '+good+' בהצלחה',h);
  ck('tolerates prose around the JSON', v.length===1);
  // hostile / malformed input must throw, not corrupt state
  let threw=0; ['not json at all','{}','{"variants":[]}'].forEach(t=>{ try{ parseStrategyJSON(t,h); }catch(e){ threw++; } });
  ck('rejects garbage and empty variant lists', threw===3, threw+'/3');
  const nasty=JSON.stringify({variants:[{name:'x'.repeat(200),quarters:{Q4:{rd:-500,regions:{europe:{production:'abc',price:-99,qtySold:1e9,newFac:99,offices:-4}}}}}]});
  v=parseStrategyJSON(nasty,h); const g=v[0].levers.Q4.regions.europe;
  ck('coerces negatives/NaN to 0 and clamps newFac', v[0].levers.Q4.rd===0&&g.production===0&&g.price===0&&g.newFac<=3&&g.offices===0);
  ck('truncates an overlong name', v[0].name.length<=40);

  // 3) the engine, not the model, judges the variant
  const legal=parseStrategyJSON(JSON.stringify({variants:[{name:'חוקי',thesis:'t',quarters:Object.fromEntries(h.map(q=>[q,
    {rd:120000,regions:{europe:{production:15000,unitCost:70,price:135,qtySold:14000,advertising:60000,offices:2}}}]))}]}),h);
  const sLegal=scoreStrategyVariant(legal[0],'Q3');
  ck('engine returns its own score, not the model\'s', typeof sLegal.score==='number'&&sLegal.score>0, 'score='+sLegal.score.toFixed(1));
  // production in a region with no plant must be caught
  const bad=parseStrategyJSON(JSON.stringify({variants:[{name:'ללא מפעל',thesis:'t',quarters:{Q4:
    {rd:120000,regions:{us:{production:20000,unitCost:70,price:155,qtySold:20000,offices:2}}}}}]}),h);
  const sBad=scoreStrategyVariant(bad[0],'Q3');
  ck('rejects producing where there is no plant', !sBad.legal && sBad.violations.some(x=>/ללא מפעל/.test(x)), sBad.violations[0]);
  // illegal office count
  const off=parseStrategyJSON(JSON.stringify({variants:[{name:'משרד בודד',thesis:'t',quarters:{Q4:
    {rd:120000,regions:{europe:{production:1000,unitCost:70,price:135,qtySold:500,offices:1}}}}}]}),h);
  ck('rejects a single sales office', !scoreStrategyVariant(off[0],'Q3').legal);
  // overselling supply
  const over=parseStrategyJSON(JSON.stringify({variants:[{name:'מכירת יתר',thesis:'t',quarters:{Q4:
    {rd:120000,regions:{europe:{production:1000,unitCost:70,price:135,qtySold:90000,offices:2}}}}}]}),h);
  const sOver=scoreStrategyVariant(over[0],'Q3');
  ck('rejects selling more than supply', !sOver.legal && sOver.violations.some(x=>/מכירה/.test(x)));
  // sub-minimum R&D
  const rd=parseStrategyJSON(JSON.stringify({variants:[{name:'מו״פ חסר',thesis:'t',quarters:{Q4:
    {rd:5000,regions:{europe:{production:1000,unitCost:70,price:135,qtySold:500,offices:2}}}}}]}),h);
  ck('rejects R&D below the legal minimum', !scoreStrategyVariant(rd[0],'Q3').legal);

  // 4) applying a variant creates a real, editable scenario
  S.ai.strategy={base:'Q3',at:Date.now(),variants:[sLegal]};
  go('sim'); const before=S.scenarios.length; applyStrategy(0);
  ck('applying a variant creates a scenario spanning the horizon',
     S.scenarios.length===before+1 && Object.keys(S.scenarios[0].levers).length===6);
  ck('applied scenario carries editable action cards', (S.scenarios[0].levers.Q4.actions||[]).length>0,
     'actions='+(S.scenarios[0].levers.Q4.actions||[]).length);

  // 5) context handed to the model states the constraints it must respect
  const ctx=strategyContext('Q3',h);
  ck('context lists every quarter to plan', h.every(q=>ctx.includes(q)));
  ck('context states which regions have plants', /מפעלים לפי אזור/.test(ctx));
  ck('context names the weaker scoring half', /המחצית החלשה/.test(ctx));
  ck('context carries price anchors + ad thresholds', /סף פרסום/.test(ctx)&&/עוגן מחיר/.test(ctx));
  ck('context includes the behavioural rule book', /כיצד הביקוש מגיב/.test(ctx));
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f)); R.pass.forEach(f=>console.log('  ✓ '+f));
console.log('pageErrors:',errs);
await b.close();
})();
