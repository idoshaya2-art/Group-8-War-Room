/* I-2 (what breaks first) and I-3 (the action above the fold).
   I-2 turns a red quarter from a verdict into a lever: which line causes the breach and what
   single change clears it. I-3 is measured the only way that means anything — the primary
   button's position against the viewport, not a word count of the text before it. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();

// ---------------- I-2
{
const {browser,page,errors}=await open();
const r=await page.evaluate(()=>{
  const out={};
  /* The seeded position — which mirrors the team's real end-of-Q3 — is NOT clean: with no plan at
     all it breaches in Q7, because HQ pays 5.5%/quarter on a 1,136,879 loan and nothing replenishes
     it. That is a correct finding and precisely what this panel is for, so it is asserted rather
     than treated as noise. The no-breach path needs a genuinely funded state. */
  const asSeeded=whatBreaksFirst('Q3',null);
  out.seeded={ ok:asSeeded.ok, q:asSeeded.q, negs:(asSeeded.negs||[]).map(n=>n.rid),
    movable:asSeeded.movable?asSeeded.movable.length:null };
  const keepCash={...S.quarters.Q3.financial.cash}, keepLoans=S.quarters.Q3.financial.loans;
  S.quarters.Q3.financial.cash={us:3000000,europe:5000000,brazil:3000000,hq:3000000};
  S.quarters.Q3.financial.loans=0;
  out.clean=whatBreaksFirst('Q3',null).ok;
  S.quarters.Q3.financial.cash=keepCash; S.quarters.Q3.financial.loans=keepLoans;
  // an unfunded plan against a high floor
  S.config.goals.floors={...S.config.goals.floors,Q4:9000000};
  const sc={id:'b',name:'b',base:'Q3',levers:{}};
  nextQuarters('Q3').forEach(q=>{ sc.levers[q]={rd:0,regions:{}};
    REGIONS.forEach(x=>sc.levers[q].regions[x.id]={production:0,unitCost:0,sales:0,advertising:0,invest:0,transferIn:0,product:'Y',model:'Standard',newFac:0,offices:0}); });
  Object.assign(sc.levers.Q4.regions.europe,{production:20000,unitCost:60,advertising:400000,newFac:1,offices:3});
  sc.levers.Q4.rd=300000;
  S.scenarios=[sc]; save();
  const w=whatBreaksFirst('Q3',sc.levers);
  out.big={ q:w.q, gap:w.gap, rounded:Number.isInteger(w.gap), enough:w.enough,
    items:w.items.map(i=>i.what), movable:w.movable.length, immovable:w.items.length-w.movable.length,
    sortedDesc:w.items.every((it,i)=>i===0||w.items[i-1].sf>=it.sf),
    single:w.single, combo:w.combo.length, movableTotal:w.movableTotal, negs:w.negs.length };
  // a small gap that ONE line can close
  S.config.goals.floors={...S.config.goals.floors,Q4:0};
  const sc2=JSON.parse(JSON.stringify(sc));
  Object.assign(sc2.levers.Q4.regions.europe,{production:0,unitCost:0,newFac:0,advertising:900000,offices:3});
  sc2.levers.Q4.rd=0;
  const w2=whatBreaksFirst('Q3',sc2.levers);
  out.small={ breach:!w2.ok, single:w2.single?w2.single.what:null, gap:w2.gap };
  return out;
});
ck('I-2 · a well-funded projection reports no breach, rather than inventing a culprit', r.clean===true);
ck('I-2 · the team\'s real Q3 position breaches at Q7 on loan interest alone, with nothing to cut',
  r.seeded.ok===false && r.seeded.q==='Q7' && r.seeded.negs.includes('hq') && r.seeded.movable===0,
  `breach at ${r.seeded.q}, deficit regions [${r.seeded.negs}], ${r.seeded.movable} movable lines`);
ck('I-2 · a breaching quarter is named with a rounded gap',
  r.big.q==='Q4' && r.big.rounded===true, `${r.big.q}, gap ${r.big.gap}`);
ck('I-2 · outflows are itemised, biggest first', r.big.items.length>=4 && r.big.sortedDesc===true,
  r.big.items.join(' · '));
ck('I-2 · movable spending is separated from what a decision cannot move',
  r.big.movable>0 && r.big.immovable>0, `${r.big.movable} movable, ${r.big.immovable} dragged`);
ck('I-2 · when even every movable line is not enough, it says so instead of proposing a fix',
  r.big.enough===false && r.big.single===null && r.big.movableTotal<r.big.gap,
  `movable ${r.big.movableTotal} vs gap ${r.big.gap}`);
ck('I-2 · regional deficits are listed separately from the unified floor', r.big.negs>0);
ck('I-2 · when one line does cover the gap, that line is named',
  r.small.breach===true && r.small.single!==null, `${r.small.single} closes ${r.small.gap}`);
ck('I-2 · no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
await browser.close();
}

/* ---------------- I-3 · the first action must be reachable without scrolling.

   The finding has not changed; the mechanism that satisfies it has. The original fix bolted a
   duplicate "next action" strip above a wall of thirteen orientation sections. The tab has since
   been cut down to what it is for — the money, then the list, then one closed disclosure holding
   everything that explains rather than decides — so the first decision's own send button is now
   above the fold by construction, and the duplicate strip was deleted rather than kept.

   These assertions therefore measure the SAME thing they always did (a button's position against
   the viewport, on both form factors) and drop only the two that described the strip itself. A
   jump link is no longer asserted because there is nothing left to jump past: the list starts
   within one screen of the top. */
for(const vp of [{width:1400,height:1000,name:'desktop'},{width:390,height:844,name:'phone'}]){
  const {browser,page,errors}=await open({viewport:{width:vp.width,height:vp.height}});
  await page.evaluate(()=>go('plan')); await page.waitForTimeout(900);
  const m=await page.evaluate(()=>{
    const btn=[...document.querySelectorAll('button')].find(b=>/^⚡?\s*שלח לסימולטור/.test(b.textContent.trim()));
    const card=document.querySelector('.content .act');
    // The money block is the one level-1 surface left, and it is what the tab was asked to lead
    // with: cash, expected income, floor, what the chosen actions cost.
    const money=[...document.querySelectorAll('.focus')].find(c=>/הכסף של Q/.test(c.textContent));
    const list=document.getElementById('decisionsTop');
    if(!btn||!money||!list) return {found:false};
    const rb=btn.getBoundingClientRect();
    return { found:true, top:Math.round(rb.top), vh:window.innerHeight,
      aboveFold:rb.top>=0 && rb.bottom<=window.innerHeight,
      cardTop: card?Math.round(card.getBoundingClientRect().top):null,
      // everything this tab puts above the first card, independent of the app chrome around it
      ownHeight: card?Math.round(card.getBoundingClientRect().top-money.getBoundingClientRect().top):null,
      moneyFirst: money.getBoundingClientRect().top < list.getBoundingClientRect().top,
      // nothing narrative may sit between the money and the list
      listTop: Math.round(list.getBoundingClientRect().top),
      // the four figures the tab was asked to lead with
      hasFour:['מזומן זמין','הכנסה צפויה','רצפה מחייבת','עלות הפעולות'].every(t=>money.textContent.includes(t)) };
  });
  /* Desktop has room for the whole first card, so the button itself is the right measure. A
     390x844 phone spends 497px on app chrome before any content, and a decision card is ~280px
     tall, so no card's button can clear the fold there — asserting it would only be satisfiable
     by hiding the card's contents. The finding is that the top decision is REACHABLE without
     hunting; on a phone that means its card begins on the first screen. */
  if(vp.name==='desktop')
    ck('I-3 · the first decision\'s own send button is above the fold on desktop',
      m.found && m.aboveFold===true, `top ${m.top} of ${m.vh}px`);
  else
    ck('I-3 · the first decision card begins on the first screen on phone',
      m.found && m.cardTop!=null && m.cardTop<m.vh, `card top ${m.cardTop} of ${m.vh}px`);
  /* The check above is an OUTCOME, and the app chrome is most of its budget — a longer version
     string in the sidebar has already been enough to wrap a line and push it over. So measure
     what this tab actually controls as well, otherwise a chrome edit fails an assertion about
     the decisions tab and sends the next reader to the wrong file. */
  ck(`I-3 · the tab's own content above the list stays within its budget on ${vp.name}`,
    m.found && m.ownHeight<=300, `${m.ownHeight}px of chrome-independent height (money block + header)`);
  ck(`I-3 · the money block leads, and the decision list starts within one screen on ${vp.name}`,
    m.moneyFirst===true && m.listTop<m.vh, `list at ${m.listTop} of ${m.vh}px`);
  ck(`I-3 · the money block carries all four figures the tab is for, on ${vp.name}`, m.hasFour===true);
  ck(`I-3 · no JavaScript errors on ${vp.name}`,
    errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0);
  await browser.close();
}

// ---------------- the anchor still exists, and the list is still the full list
{
const {browser,page}=await open();
await page.evaluate(()=>go('plan')); await page.waitForTimeout(800);
const a=await page.evaluate(()=>({ anchor:!!document.getElementById('decisionsTop'),
  decisionsStillListed:[...document.querySelectorAll('button')].filter(b=>/שלח לסימולטור/.test(b.textContent)).length,
  // the background material was moved, not deleted — a closed disclosure at the end holds it
  background:[...document.querySelectorAll('details.sec')].some(d=>/רקע — למה זו הרשימה/.test(d.textContent) && !d.open) }));
ck('I-3 · the in-page anchor still exists', a.anchor===true);
ck('I-3 · the full decision list is rendered, not a summary of it',
  a.decisionsStillListed>1, `${a.decisionsStillListed} send buttons on the page`);
ck('I-3 · the orientation material still exists, in one disclosure that starts closed',
  a.background===true);
await browser.close();
}
process.exit(report('WAVE 5 — what breaks first (I-2) and the action above the fold (I-3)')?1:0);
})();
