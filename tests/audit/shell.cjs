/* The app chrome: how much of the screen it costs, how loud it is allowed to be, and how many
   things may claim to be urgent at once.

   These are design rules, but they are not taste — each one is a measured regression:

   · The header ate 428px of an 844px phone before any content, because backup/restore/sync sat on
     every screen and wrapped onto two rows, the subtitle restated the tab you had already chosen,
     and the version string was printed twice. That is why the decisions tab kept failing an
     "above the fold" assertion that had nothing to do with the decisions tab.
   · The pager's "next tab" button was `primary`, making the least important action on the
     dashboard the loudest thing on it.
   · Three red alerts rendered at once and two of them appeared twice, so red stopped meaning
     "stop".
*/
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open({viewport:{width:1440,height:1000}});

/* Count what competes for attention, not what exists in the DOM: Chromium still reports an
   offsetParent for content inside a CLOSED <details>, so a button in a collapsed disclosure looks
   visible to a naive query. Asking the DOM whether an ancestor disclosure is shut is the only
   reliable test — the surfaces suite learned this the same way. */
const visiblePrimaries=()=>page.evaluate(()=>[...document.querySelectorAll('button.primary')]
  .filter(b=>b.offsetParent && !b.closest('details:not([open])'))
  .map(b=>b.innerText.trim().slice(0,26)||'(no label)'));

// ---------- primary is rare, and never spent on navigation
for(const [pg,cap] of [['dash',1],['decide',2],['submit',2],['data',2]]){
  await page.evaluate(p=>go(p),pg); await page.waitForTimeout(800);
  const p=await visiblePrimaries();
  ck(`primary stays rare on ${pg} — at most ${cap} on screen`, p.length<=cap, p.join(' | ')||'none');
}
await page.evaluate(()=>go('dash')); await page.waitForTimeout(700);
const pager=await page.evaluate(()=>{
  const t=document.querySelector('.tabnav'); if(!t) return null;
  const btns=[...t.querySelectorAll('button')];
  return { exists:true, primaries:btns.filter(b=>/\bprimary\b/.test(b.className)).length,
    labels:btns.map(b=>b.innerText.trim()) };
});
ck('the tab pager exists but is never the page\'s primary action',
  pager && pager.primaries===0, pager?pager.labels.join(' | '):'no pager');

// ---------- one alarm at a time, and each fact stated once
const reds=await page.evaluate(()=>{
  const q=S.activeQuarter, a=computeAlerts(q);
  const ns=document.querySelector('.ns-alert');
  const cardTitles=[...document.querySelectorAll('.content .alert')].map(x=>x.innerText.split('\n')[0].trim());
  const banner=[...document.querySelectorAll('.content .card')].find(x=>/מלאי מוגמר/.test(x.innerText));
  return { levels:a.map(x=>x.level+':'+x.key),
    redCount:a.filter(x=>x.level==='red').length,
    nsText:ns?ns.innerText.trim():null,
    cardTitles, hasBanner:!!banner,
    /* The strip carries ONE alert and the card lists them all, so the top one appears in both.
       That is a sticky summary above its own detail — normal, and useful once the card scrolls
       away. What was wrong was two full-weight RED blocks stating one fact: a hero banner and a
       red row inches apart. So what is asserted is that the strip never outranks the card by
       repeating something the page already shows as a banner, not that no text may ever recur. */
    stripAlsoBanner:!!ns && !!banner && /ללא מחיר/.test(ns.innerText) };
});
ck('a PROJECTED floor breach is amber, not red — its own title says "צפויה"',
  reds.levels.includes('amber:floor'), reds.levels.join(' · '));
ck('...so the dashboard no longer fires three reds at once', reds.redCount<=2,
  `${reds.redCount} red alerts`);
ck('the unpriced-stock banner is not repeated as a row in the alerts card beside it',
  !reds.hasBanner || !reds.cardTitles.some(t=>/ללא מחיר/.test(t)),
  reds.cardTitles.join(' | '));
ck('...nor in the north-star strip, which points at what you are NOT already looking at',
  !reds.hasBanner || !/ללא מחיר/.test(reds.nsText||''), reds.nsText);
ck('the strip and the banner never both carry the same red fact', reds.stripAlsoBanner===false,
  reds.nsText);
/* A breach in the quarter you are standing in is a different thing, and must stay red.
   `projectCashflow` deliberately does NOT read S.config.goals.floors — a breach there is also
   triggered by a negative region, and re-pointing it would move every projection the suite pins.
   So the way to force a present-quarter breach is to empty the quarter's cash, not to raise the
   goal; raising the goal changes nothing here and would have made this assertion pass or fail for
   a reason unrelated to what it is testing. */
const nowBreach=await page.evaluate(()=>{
  const q=S.activeQuarter, keep=JSON.stringify(S.quarters[q].financial.cash);
  REGIONS.forEach(r=>S.quarters[q].financial.cash[r.id]=-50000);
  S.quarters[q].financial.consolidated=0; save();
  const a=computeAlerts(q).find(x=>x.key==='floor');
  S.quarters[q].financial.cash=JSON.parse(keep); save();
  return a?{level:a.level, title:a.title}:null;
});
ck('cash ALREADY below the floor is red, and says so in the present tense',
  nowBreach && nowBreach.level==='red' && /כבר/.test(nowBreach.title) && !/צפויה/.test(nowBreach.title),
  nowBreach?`${nowBreach.level} · ${nowBreach.title}`:'no floor alert');

// ---------- the rare actions live behind one menu
const menu=await page.evaluate(()=>{
  const m=document.getElementById('moreMenu'), b=document.getElementById('btnMore');
  const closed=m?m.hidden:null;
  if(b) b.click();
  const openNow=m?!m.hidden:null;
  const items=m?[...m.querySelectorAll('button')].map(x=>x.id):[];
  document.body.click();                                  // click-away must close it
  return { closed, openNow, items, closedAgain:m?m.hidden:null };
});
ck('backup and restore are behind the ⋯ menu, not on every screen',
  menu.items.includes('btnExportData') && menu.items.includes('btnImportData'), menu.items.join(','));
ck('...the menu starts closed, opens on click, and closes on a click away',
  menu.closed===true && menu.openNow===true && menu.closedAgain===true,
  `${menu.closed} → ${menu.openNow} → ${menu.closedAgain}`);

// ---------- what the chrome costs on a phone
await page.setViewportSize({width:390,height:844});
for(const pg of ['dash','decide','submit']){
  await page.evaluate(p=>go(p),pg); await page.waitForTimeout(800);
  const m=await page.evaluate(()=>{
    const c=document.querySelector('.content');
    const bar=document.querySelector('.topbar');
    return { top:Math.round(c.getBoundingClientRect().top),
      topbarH:bar?Math.round(bar.getBoundingClientRect().height):null,
      subHidden:bar?getComputedStyle(bar.querySelector('.sub')).display==='none':null,
      pagerHidden:(()=>{ const t=document.querySelector('.tabnav');
        return !t || getComputedStyle(t).display==='none'; })(),
      overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth };
  });
  /* 428px was the measured cost before this pass; 320 leaves room for the header to grow a little
     without silently eating the screen again. If this fails, look at what was added to the top of
     the app, not at the tab that reported it. */
  ck(`[phone ${pg}] the chrome above the content stays under 320px`, m.top<=320, `${m.top}px`);
  ck(`[phone ${pg}] the header is a single row`, m.topbarH!=null && m.topbarH<=64, `${m.topbarH}px`);
  ck(`[phone ${pg}] no horizontal overflow`, m.overflowX===0, `${m.overflowX}px`);
  if(pg==='dash'){
    ck('[phone] the subtitle is dropped — it restates the tab you already chose', m.subHidden===true);
    ck('[phone] the pager is dropped — the nav strip already reaches every tab', m.pagerHidden===true);
  }
}
/* ...and the desktop header keeps both, because there the space is not contested. */
await page.setViewportSize({width:1440,height:1000});
await page.evaluate(()=>go('dash')); await page.waitForTimeout(700);
const desk=await page.evaluate(()=>({
  sub:getComputedStyle(document.querySelector('.topbar .sub')).display!=='none',
  pager:(()=>{ const t=document.querySelector('.tabnav'); return !!t && getComputedStyle(t).display!=='none'; })(),
  qsel:!!document.querySelector('.topbar .qsel select') }));
ck('on desktop the subtitle and the pager are still there', desk.sub===true && desk.pager===true,
  `sub ${desk.sub} · pager ${desk.pager}`);
ck('the quarter selector stays in the header on both — it is the one control every tab needs',
  desk.qsel===true);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('SHELL — what the chrome costs and how loud it may be')?1:0);
})();
