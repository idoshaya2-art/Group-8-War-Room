const {loadPW,APP}=require('./lib.cjs');
const { chromium } = loadPW();
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.goto(APP); await p.waitForTimeout(600);
const R=await p.evaluate(()=>{
  const out={pass:[],fail:[]};
  const ck=(name,cond,detail)=>(cond?out.pass:out.fail).push(name+(detail?' — '+detail:''));

  // --- guide-stated ORDERINGS must hold in the encoded rules ---
  const A=RULES.adv.elast, P=RULES.price.elast, G=RULES.goodwill.loss, T=RULES.adv.threshold;
  ck('§5.4 chip ad elasticity US>EU>BR', A.X.us>A.X.europe && A.X.europe>A.X.brazil);
  ck('§5.4 PC ad elasticity BR highest, US>EU', A.Y.brazil>A.Y.us && A.Y.us>A.Y.europe);
  ck('§5.4 all firm-level ad elasticities within [0.1,0.5]',
     [...Object.values(A.X),...Object.values(A.Y)].every(v=>v>=RULES.adv.bound[0]&&v<=RULES.adv.bound[1]));
  ck('§5.4 PC threshold several× the chip threshold, every region',
     ['us','europe','brazil'].every(r=>T.Y[r]>=3*T.X[r]));
  ck('§5.4 chip threshold: Brazil highest', T.X.brazil>T.X.us && T.X.brazil>T.X.europe);
  ck('§5.3 price elasticity |BR|>|EU|>|US| for both products',
     Math.abs(P.X.brazil)>Math.abs(P.X.europe)&&Math.abs(P.X.europe)>Math.abs(P.X.us)&&
     Math.abs(P.Y.brazil)>Math.abs(P.Y.europe)&&Math.abs(P.Y.europe)>Math.abs(P.Y.us));
  ck('§5.3 chips more price-elastic than PCs in every region',
     ['us','europe','brazil'].every(r=>Math.abs(P.X[r])>Math.abs(P.Y[r])));
  ck('§5.3 goodwill: Brazil PC == Brazil chip, and below US/EU PC',
     G.Y.brazil===G.X.brazil && G.Y.brazil<G.Y.us && G.Y.brazil<G.Y.europe);
  ck('§5.3 goodwill: chips < PCs in US and EU', G.X.us<G.Y.us && G.X.europe<G.Y.europe);
  ck('§5.2 cross-elasticity US>EU>BR',
     RULES.cross.chipVsPcPrice.us>RULES.cross.chipVsPcPrice.europe && RULES.cross.chipVsPcPrice.europe>RULES.cross.chipVsPcPrice.brazil);

  // --- §5.4 same-quarter effect must dominate the lagged tail EVERYWHERE ---
  const SQ=RULES.adv.sameQuarterShare;
  ck('§5.4 same-quarter share > 0.5 everywhere (paid quarter dominates)',
     [...Object.values(SQ.X),...Object.values(SQ.Y)].every(v=>v>0.5));
  ck('§5.4 lagged tail: US largest, Brazil smallest', (1-SQ.Y.us)>(1-SQ.Y.europe) && (1-SQ.Y.europe)>(1-SQ.Y.brazil));
  ck('§5.4 lagged tail greater for PCs than chips', ['us','europe','brazil'].every(r=>(1-SQ.Y[r])>(1-SQ.X[r])));

  // --- advResponse behaviour ---
  const th=advThreshold('europe','Y');
  const below=advResponse('europe','Y',th*0.3), at=advResponse('europe','Y',th), above=advResponse('europe','Y',th*3);
  ck('below threshold yields far less lift than above', (below.total-1) < (above.total-1)/5,
     `below=${(below.total-1).toFixed(4)} above=${(above.total-1).toFixed(4)}`);
  ck('response is monotonic in spend', below.total<=at.total && at.total<=above.total);
  ck('diminishing returns: doubling spend less than doubles lift',
     (advResponse('europe','Y',th*4).total-1) < 2*(advResponse('europe','Y',th*2).total-1));
  ck('now+next split matches total', Math.abs((above.now-1)+above.next-(above.total-1))<1e-9);
  ck('zero spend = no lift', advResponse('europe','Y',0).total===1);

  // --- recommendAdSpend: the answer to "on what basis?" ---
  const r1=recommendAdSpend('europe','Y',35000,130,70);
  const r2=recommendAdSpend('europe','Y',50,130,70);      // tiny volume -> not worth the threshold
  const r3=recommendAdSpend('europe','Y',35000,70,70);    // zero margin -> never worth it
  ck('healthy volume+margin -> positive budget at/above threshold', r1.spend>0 && r1.spend>=r1.threshold, 'spend='+r1.spend);
  ck('marginal return is positive at the chosen budget', r1.net>0, 'net='+r1.net);
  ck('tiny volume -> refuses to spend below-threshold money', r2.spend===0, 'spend='+r2.spend);
  ck('zero margin -> no advertising', r3.spend===0);
  ck('budget carries a stated reason', !!r1.why && r1.why.length>20);

  // --- the old hardcoded 6%-of-revenue must be gone ---
  ck('ad budget is no longer 6% of revenue', r1.spend!==Math.round(35000*130*0.06), 'engine='+r1.spend+' vs 6%='+Math.round(35000*130*0.06));

  // --- rules reach the AI ---
  const ctx=rulesContextText();
  ck('AI context states advertising works in the quarter it is paid', /באותו רבעון שבו הוא שולם/.test(ctx));
  ck('AI context carries elasticity bounds', /0\.1 ל-0\.5/.test(ctx));
  ck('AI context labels estimates as estimates', /אומדנים לכיול/.test(ctx));
  ck('full AI context includes the rules block', /כיצד הביקוש מגיב/.test(buildAIContext()));
  return out;
});
console.log('PASS '+R.pass.length+'  FAIL '+R.fail.length);
R.fail.forEach(f=>console.log('  ✗ '+f));
if(!R.fail.length) R.pass.forEach(f=>console.log('  ✓ '+f));
console.log('pageErrors:',errs);
await b.close();
process.exit((typeof R!=='undefined'&&R.fail&&R.fail.length)?1:0);
})();
