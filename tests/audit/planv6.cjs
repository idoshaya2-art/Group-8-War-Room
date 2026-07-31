/* The written plan (v6) as the baseline of the decisions tab.

   What is being pinned here is not "the plan is right" — the plan is the team's, and the tool has
   no standing to bless it. What is pinned is that every line the team wrote is shown with an
   HONEST verdict beside it:
     · a check that reads the Data Log agrees with the Data Log, not with the prose;
     · a check that cannot be run reports `na`, and `na` is never dressed up as approval;
     · where the plan and the Data Log genuinely disagree, the tool says so instead of going quiet.
   The last one matters most: the Europe channel cost is the one place where v6's arithmetic is
   materially better for Europe than Data Log 04 allows, and a later edit must not soften it. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---------------- the structure itself
const st=await page.evaluate(()=>({
  version:PLAN_V6_VERSION,
  q4Actions:PLAN_V6.quarters.Q4.actions.length,
  q5Actions:PLAN_V6.quarters.Q5.actions.length,
  q4Floor:PLAN_V6.quarters.Q4.floorTotal,
  q5Floor:PLAN_V6.quarters.Q5.floorTotal,
  grades:PLAN_V6.grades.map(g=>g.q),
  risks:PLAN_V6.risks.length,
  corrections:PLAN_V6.corrections.length,
  // the floor line items must sum to something close to the total the plan states, or the
  // breakdown on screen is decoration rather than the derivation it claims to be
  q4Sum:PLAN_V6.quarters.Q4.floor.reduce((a,r)=>a+(r[2]||0),0),
  steadyFallback:planV6For('Q7').key, q4Key:planV6For('Q4').key, q9Key:planV6For('Q9').key,
}));
ck('the plan is loaded as structure at version 6', st.version===6);
ck('Q4 carries all fifteen chronological actions', st.q4Actions===15, `${st.q4Actions}`);
ck('Q5 carries all thirteen', st.q5Actions===13, `${st.q5Actions}`);
ck('the grade schedule covers Q4→Q9', st.grades.join(',')==='Q4,Q5,Q6,Q7,Q8,Q9', st.grades.join(','));
ck('all eight risk triggers and all seven data corrections are present',
  st.risks===8 && st.corrections===7, `${st.risks} risks, ${st.corrections} corrections`);
ck('the Q4 floor breakdown sums to the total the plan states',
  Math.abs(st.q4Sum-st.q4Floor)<=1000, `${st.q4Sum} vs ${st.q4Floor}`);
ck('Q4 and Q5 have their own chronology; from Q6 the plan is one steady state',
  st.q4Key==='Q4' && st.steadyFallback==='steady' && st.q9Key==='steady',
  `Q4→${st.q4Key} · Q7→${st.steadyFallback} · Q9→${st.q9Key}`);

// ---------------- the Data Log is the referee, not the prose
const dl=await page.evaluate(()=>{
  const g=id=>{ const v=planV6Check(id); return {state:v.state, txt:v.txt}; };
  return { freight:g('freightBrazil'), supplier:g('supplierInterest'), pair:g('chipPair'),
    carryCmp:g('carryCompare'), rdFloors:g('rdFloors'), priceCap:g('brazilPriceCap'),
    bonds:g('brazilBonds'), hq:g('hqTransfer'), spitzer:g('spitzer'), channel:g('channelCost'),
    // the same numbers, read straight out of the engine, so the assertion is not circular
    freightLC:freightCostLC('europe','brazil','Y',14000,'surface'),
    supplierRate:DATALOG.interest.supplierCredit.below.europe,
    x3y1:DATALOG.chipPerPC[3][1], x2y2:DATALOG.chipPerPC[2][2],
    euSellY:DATALOG.sellingCostPerUnit.yOnly.europe, euSellBoth:DATALOG.sellingCostPerUnit.xyY.europe,
    brSell:DATALOG.sellingCostPerUnit.yOnly.brazil, maxBRL:DATALOG.maxPCPriceY0toY3 };
});
ck('Data Log 05 · the 270,000 EUR freight line is reproduced by the engine, not restated',
  dl.freightLC===270000 && dl.freight.state==='ok', `engine says ${dl.freightLC} EUR`);
ck('Data Log 07 · the 28,508 EUR supplier-credit interest is 6% of 475,139, and the engine agrees',
  dl.supplierRate===6 && dl.supplier.state==='ok');
ck('Data Log 02 · the plan\'s "efficient pairs" really are 1:1, and Y2-on-X2 really costs two chips',
  dl.x3y1===1 && dl.x2y2===2 && dl.pair.state==='ok');
ck('Data Log 06 · correction 7 holds in francs — Brazil is the cheapest place to hold PCs',
  dl.carryCmp.state==='ok', dl.carryCmp.txt.slice(0,90));
ck('Data Log 06 · the R&D figures the plan calls "floors" are the legal floors',
  dl.rdFloors.state==='ok');
ck('Data Log 04/10 · every Brazilian price in the plan sits under the 1,400 BRL cap',
  dl.maxBRL===1400 && dl.priceCap.state==='ok');
ck('Data Log 07 · repaying 6% credit before buying 4.5% bonds is the order the numbers give',
  dl.bonds.state==='ok');
ck('the 400,000 EUR → 600,000 SF transfer is checked against the live FX rate', dl.hq.state==='ok');
ck('the Spitzer schedule the plan reverse-engineered is arithmetically consistent at 2%/quarter',
  /לוח הסילוקין עקבי/.test(dl.spitzer.txt), dl.spitzer.txt.slice(0,80));

// ---------------- the finding: the plan's Europe channel cost is below what Data Log 04 allows
ck('the Europe channel cost is reported as CONTRADICTING the Data Log, not quietly accepted',
  dl.channel.state==='block', `verdict: ${dl.channel.state}`);
ck('...and the contradiction names both Data Log rates and the per-quarter size of the gap',
  /40/.test(dl.channel.txt) && /33/.test(dl.channel.txt) && /22,000/.test(dl.channel.txt),
  dl.channel.txt.slice(0,120));
ck('...while the Brazil figure in the same table is confirmed rather than lumped in with it',
  dl.brSell===160 && dl.channel.txt.includes('80 SF לברזיל'));

// ---------------- honesty of the verdicts themselves
const hon=await page.evaluate(()=>{
  const noCheck=planV6Check(null);
  const missing=planV6Check('no-such-check-id');
  // a check that throws must degrade to `na`, never to a green tick
  const oldFn=PLAN_V6_CHECKS.spitzer;
  PLAN_V6_CHECKS.spitzer=()=>{ throw new Error('boom'); };
  const thrown=planV6Check('spitzer');
  PLAN_V6_CHECKS.spitzer=oldFn;
  const states=new Set(PLAN_V6.quarters.Q4.actions.map(a=>planV6Check(a.check).state));
  return {noCheck:noCheck.state, missing:missing.state, thrown:thrown.state,
    thrownTxt:thrown.txt, states:[...states],
    tally:planV6Tally(PLAN_V6.quarters.Q4.actions),
    naLabel:PLAN_V6_STATES.na.label};
});
ck('an action with no engine measure reports "not checked", not "matches"',
  hon.noCheck==='na' && hon.naLabel==='לא נבדק');
ck('an unknown check id degrades to "not checked" rather than passing silently', hon.missing==='na');
ck('a check that throws degrades to "not checked" and says why',
  hon.thrown==='na' && /boom/.test(hon.thrownTxt), hon.thrownTxt.slice(0,60));
ck('the Q4 tally accounts for every action exactly once',
  hon.tally.ok+hon.tally.warn+hon.tally.block+hon.tally.na===15,
  JSON.stringify(hon.tally));
ck('the seeded position produces a mix of verdicts, not a uniform green',
  hon.states.length>=3, hon.states.join(','));

// ---------------- verdicts that must react to the real state, not to the text
const live=await page.evaluate(()=>{
  const out={};
  out.loansSeeded=planV6Check('noNewLoans').state;          // seed carries 1,136,879 SF
  out.brazilCashSeeded=planV6Check('brazilCash').state;     // seed carries 95,000 BRL
  out.stockSeeded=planV6Check('stockAllocation').state;     // seed carries exactly 35,000 PCs
  out.capacitySeeded=planV6Check('capacityY').state;        // no X/Y plant split declared
  const keepLoans=S.quarters.Q3.financial.loans, keepCash=S.quarters.Q3.financial.cash.brazil;
  S.quarters.Q3.financial.loans=643433;
  S.quarters.Q3.financial.cash.brazil=2094904;
  out.loansAtSpitzer=planV6Check('noNewLoans').state;
  out.brazilCashReal=planV6Check('brazilCash').state;
  S.config.plantSplit={europe:{X:2,Y:2}};
  out.capacityDeclared=planV6Check('capacityY');
  S.quarters.Q3.financial.loans=keepLoans; S.quarters.Q3.financial.cash.brazil=keepCash;
  S.config.plantSplit={};
  return out;
});
ck('the zero-new-loans red line is breached by the seeded 1,136,879 SF of debt',
  live.loansSeeded==='block');
ck('...and is satisfied once debt is exactly the Spitzer balance the plan keeps',
  live.loansAtSpitzer==='ok');
ck('the Brazil extraction is blocked at 95,000 BRL and clears at the real 2,094,904',
  live.brazilCashSeeded==='block' && live.brazilCashReal==='ok');
ck('the 35,000 PCs the allocation table spends are the 35,000 actually in stock',
  live.stockSeeded==='ok');
ck('capacity is "not checked" until the X/Y plant split is declared, then measured',
  live.capacitySeeded==='na' && live.capacityDeclared.state==='ok',
  `undeclared ${live.capacitySeeded} → declared ${live.capacityDeclared.state}`);
ck('...and the declared 2+2 Europe split gives exactly the 36,000 the plan allocates',
  /36,000/.test(live.capacityDeclared.txt), live.capacityDeclared.txt.slice(0,90));

// ---------------- planDeltas now speaks v6
const del=await page.evaluate(()=>{
  S.quarters.Q3.entered=true;
  const rows=planDeltas();
  return rows.map(r=>({topic:r.topic, planned:r.planned, now:r.now, changed:r.changed}));
});
ck('the plan-vs-actual table uses the v6 floor anchor, not v5\'s',
  del.some(r=>/2,942,061/.test(r.planned)) && !del.some(r=>/2,135,269/.test(r.planned)));
ck('the debt row states v6\'s actual position — zero NEW loans, Spitzer amortised',
  del.some(r=>r.topic==='חוב' && /שפיצר/.test(r.planned)));
ck('the PC grade row follows v6 in deferring Y2 to Q6',
  del.some(r=>/דרגת מחשב/.test(r.topic) && /Q6/.test(r.planned)));
ck('Brazil absorption is now one of the tracked anchors',
  del.some(r=>/ברזיל/.test(r.topic) && /14,000/.test(r.planned)));

/* ---------------- where it renders.
   The plan is a baseline to check decisions against, not a decision itself, so it lives in the
   decisions tab's background disclosure — below the money block and below the engine's own list,
   and closed until asked for. That ordering is the assertion: the plan must never push the
   decisions down the page, and it must never replace them. */
await page.evaluate(()=>go('decide')); await page.waitForTimeout(900);
const ui=await page.evaluate(()=>{
  const c=document.querySelector('.content');
  const plan=[...c.querySelectorAll('.read')].find(b=>/התוכנית הכתובה/.test(b.textContent));
  if(!plan) return {found:false};
  const bg=plan.closest('details.sec');
  return {found:true,
    marks:plan.querySelectorAll('.pv6').length,
    // nested disclosures inside the plan block start shut
    openTables:[...plan.querySelectorAll('details[open]')].length,
    insideBackground: !!bg && !bg.open,
    listAbove: document.getElementById('decisionsTop').getBoundingClientRect().top
             < plan.getBoundingClientRect().top,
    decisionCards: c.querySelectorAll('.act').length,
    // the verdict marker must not be a pill — that is what the surfaces suite polices
    pillsInside:plan.querySelectorAll('.tag').length,
    naPresent:plan.querySelectorAll('.pv6.na').length};
});
ck('the plan renders on the decisions tab', ui.found===true);
ck('every action shows a verdict marker', ui.found && ui.marks>=15, `${ui.marks} markers`);
ck('it sits inside the background disclosure, which starts closed', ui.insideBackground===true);
ck('the engine\'s own decision list stays above it and is not replaced by it',
  ui.listAbove===true && ui.decisionCards>=5, `${ui.decisionCards} decision cards above the plan`);
ck('the tables inside the plan start collapsed — the actions are the point',
  ui.openTables===0, `${ui.openTables} open`);
ck('verdicts are markers, not pills, so the pill budget still means something',
  ui.pillsInside<=3, `${ui.pillsInside} pills inside the plan block`);
ck('"not checked" appears rather than being hidden', ui.naPresent>0, `${ui.naPresent}`);
/* ---------------- the plan IS the list.
   The tab used to lead with buildActionPlan()'s output — a well-sourced list, but not the one the
   team wrote. Being handed someone else's fifteen items while holding your own is the complication
   this tab exists to remove, so the written plan is now the page's decision list and the engine's
   own list is a second opinion below it. What must not happen is the engine's MANDATORY findings
   going quiet just because they are not in the written plan. */
const asList=await page.evaluate(()=>{
  const c=document.querySelector('.content');
  const cards=[...c.querySelectorAll('.act')];
  const visible=cards.filter(a=>!a.closest('details:not([open])'));
  const engineWrap=[...c.querySelectorAll('details.sec')].find(d=>/מה המנוע היה מציע מעצמו/.test(d.textContent));
  const planTitles=PLAN_V6.quarters.Q4.actions.map(a=>a.what);
  return { visible:visible.length,
    total:cards.length,
    firstThree:visible.slice(0,3).map(a=>a.innerText.split('\n').filter(Boolean)[1]||''),
    allFromPlan:visible.every(a=>planTitles.some(t=>a.textContent.includes(t))),
    header:(document.getElementById('decisions')||{}).textContent||'',
    engineHidden: !!engineWrap && !engineWrap.open,
    engineCards: engineWrap?engineWrap.querySelectorAll('.act').length:0,
    aiButton:!![...c.querySelectorAll('button')].find(b=>/בדוק עם AI|בדוק מחדש/.test(b.textContent)) };
});
ck('the page\'s decision list is the written plan, not the engine\'s list',
  asList.visible===15 && asList.allFromPlan===true, `${asList.visible} visible cards`);
ck('...and says so in its header', /התוכנית שלי/.test(asList.header), asList.header.slice(0,50));
ck('the engine\'s own list still exists, as a second opinion that starts closed',
  asList.engineHidden===true && asList.engineCards>0, `${asList.engineCards} engine cards, collapsed`);
ck('one button checks the plan with the AI', asList.aiButton===true);

// mandatory engine findings the plan does not cover must be promoted back to the surface
const gaps=await page.evaluate(()=>{
  const blk=planV6For('Q4');
  const eng=buildActionPlan('Q3','Q4')||[];
  const real=planGaps(eng, blk);
  // a red item on a form the plan DOES use must not be promoted (it is already covered)
  const covered=planGaps([{level:'red', form:'A3-1 (Transfers)', title:'כבר בתוכנית'}], blk);
  // a red item on a form the plan does not use must be
  const uncovered=planGaps([{level:'red', form:'H2 (Securities)', title:'לא בתוכנית'}], blk);
  // an amber item is never promoted — this section is for obligations, not suggestions
  const amber=planGaps([{level:'amber', form:'H2 (Securities)', title:'רק מומלץ'}], blk);
  // and a blocked one is not actionable yet
  const blocked=planGaps([{level:'red', blocked:'תלוי במו״פ', form:'H2', title:'חסום'}], blk);
  return { real:real.map(x=>x.title), covered:covered.length, uncovered:uncovered.length,
    amber:amber.length, blocked:blocked.length };
});
ck('an obligation on a form the plan already uses is NOT repeated', gaps.covered===0);
ck('an obligation on a form the plan never touches IS surfaced', gaps.uncovered===1);
ck('merely recommended engine actions are not promoted — only obligations', gaps.amber===0);
ck('a blocked obligation is not presented as something to do now', gaps.blocked===0);

// ---------------- the AI review of the plan, parsed defensively
const pr=await page.evaluate(()=>{
  const good=parsePlanReview(JSON.stringify({rationale:'סביר',
    actions:[{n:1,verdict:'fix',why:'מזומן ברזיל נמוך',fix:'העבר 1M בלבד'},
             {n:2,verdict:'nonsense',why:'x'},
             {n:99,verdict:'ok',why:'מחוץ לטווח'},
             {n:3,verdict:'blocked',why:'<img src=x onerror="window.__pw=1">'}],
    missing:[{what:'<b>אספקת החוזה</b>',why:'סעיף 5'}]}), 15);
  let threw=null; try{ parsePlanReview('לא JSON בכלל',15); }catch(e){ threw=e.message; }
  return { keys:Object.keys(good.byN), v1:good.byN[1], v2:good.byN[2],
    hasOutOfRange:!!good.byN[99], v3why:good.byN[3].why,
    missingWhat:good.missing[0].what, threw };
});
ck('a verdict outside the action range is dropped rather than mis-attached',
  pr.hasOutOfRange===false && pr.keys.join(',')==='1,2,3', pr.keys.join(','));
ck('an unknown verdict word falls back to "ok" rather than breaking the render',
  pr.v2.verdict==='ok');
ck('a fix instruction is kept alongside its verdict',
  pr.v1.verdict==='fix' && /1M/.test(pr.v1.fix));
ck('model output is escaped where it enters — the XSS lesson applies here too',
  /^&lt;img/.test(pr.v3why) && /^&lt;b&gt;/.test(pr.missingWhat), pr.v3why.slice(0,30));
ck('a non-JSON answer raises rather than silently producing an empty review',
  typeof pr.threw==='string' && pr.threw.length>0, pr.threw);

// the AI's verdicts must actually reach the cards
const rendered=await page.evaluate(async()=>{
  S.ai=S.ai||{};
  S.ai.planReview={q:'Q4', at:Date.now(), rationale:'בדיקה', missing:[],
    byN:{1:{verdict:'blocked',why:'אין מזומן בברזיל',fix:null},
         2:{verdict:'ok',why:'תקין',fix:null}}};
  save(); go('plan');
  await new Promise(r=>setTimeout(r,700));
  const cards=[...document.querySelectorAll('.content .act')].filter(a=>!a.closest('details:not([open])'));
  return { first:cards[0].className, firstHasAI:/אין מזומן בברזיל/.test(cards[0].textContent),
    second:cards[1].className, rationaleShown:/סיכום ה-AI/.test(document.body.innerText) };
});
ck('an AI verdict appears on the action it belongs to', rendered.firstHasAI===true);
ck('a blocked verdict colours the card red', /red/.test(rendered.first), rendered.first);
ck('an approved one does not', !/red/.test(rendered.second), rendered.second);
ck('the AI\'s summary line is shown above the list', rendered.rationaleShown===true);

ck('no JavaScript errors',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.slice(0,2).join(' | '));

await browser.close();
process.exit(report('PLAN v6 — the written plan as a checked baseline')?1:0);
})();
