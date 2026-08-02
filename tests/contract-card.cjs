const {loadPW,APP,CHROME}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:CHROME});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(700);
const R=await p.evaluate(()=>{
  const out={pass:[],fail:[]}; const ck=(n,c,d)=>(c?out.pass:out.fail).push(n+(d?' — '+d:''));
  S.activeQuarter='Q3'; S.quarters.Q3.entered=true;
  S.quarters.Q3.operational.plantsByRegion={us:0,europe:2,brazil:0};
  S.quarters.Q3.operational.techX=3;
  const card=()=>buildActionPlan('Q3','Q4').find(i=>/התחייבות/.test(i.title||''));
  // wrong-grade stock must NOT count
  S.quarters.Q3.operational.inventory=[{product:'X',grade:0,region:'europe',qty:30000}];
  let c=card();
  ck('card still demands production despite 30,000 X0 in stock', !!c, c?c.title:'(no card — grade bug)');
  ck('card asks for the Q5 tranche only, not the grouped 60,000', c&&/30,000/.test(c.title)&&!/^.*60,000 עד Q5/.test(c.title), c&&c.title);
  ck('card names the real total separately', c&&/מתוך 60,000/.test(c.title), c&&c.title);
  ck('card spells out the delivery schedule', c&&/לוח האספקה בפועל/.test(c.detail));
  ck('card warns against producing it all up front', c&&/אל תייצר את הכל מראש/.test(c.detail));
  ck('card says production must happen in Q4', c&&/הייצור חייב להתבצע ב-Q4/.test(c.detail), (c&&(c.detail.match(/הייצור חייב להתבצע ב-\w+/)||[])[0])||'');
  // right grade clears the first tranche
  S.quarters.Q3.operational.inventory=[{product:'X',grade:3,region:'europe',qty:30000}];
  c=card();
  ck('30,000 X3 rolls the card on to the Q6 tranche', c && /30,000 עד Q6/.test(c.title), c?c.title:'(no card)');
  ck('and its production deadline becomes Q5', c && /הייצור חייב להתבצע ב-Q5/.test(c.detail));
  S.quarters.Q3.operational.inventory=[{product:'X',grade:3,region:'europe',qty:60000}];
  ck('60,000 X3 covers both tranches — no card at all', !card());
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f)); R.pass.forEach(f=>console.log('  ✓ '+f));
console.log('pageErrors:',errs);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
