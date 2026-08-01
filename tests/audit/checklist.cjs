/* The pre-submit checklist, and the dashboard's reading order.

   "כרגע מרגיש שסתם מסומן וי ללא הקשר לפעולות שנבחרו" — and that reading was correct. Most of
   these checks read `sc.levers[targetQ]`, while `planAddToSheet` puts FORM CODES into the sheet
   with no numbers in them. An empty lever set oversells nothing and exceeds no capacity, so every
   check passed: a tick meaning "there was nothing to check" was drawn identically to a tick
   meaning "checked, and fine". Same fault as reading `na` as approval, fixed the same way — three
   states, and "ready to submit" may only be said when nothing is open AND nothing went unchecked.

   What is asserted here is the DISTINCTION, not the wording: that an unexercised check cannot
   render as a pass, that each unticked row says what it means and what is missing, and that a
   ticked action walks open → na → ok as it is actually carried through to the sheet.
*/
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

const state=l=>l; // documentation: 'done' = ok, 'na' = not checked, '' = open
const read=()=>page.evaluate(()=>{
  const box=document.getElementById('checklist');
  const li=[...box.querySelectorAll('li')];
  const cls=l=>{ const c=l.querySelector('.check').className;
    return /done/.test(c)?'ok':(/na/.test(c)?'na':'open'); };
  const rows=li.map(l=>({s:cls(l), t:(l.innerText.split('\n')[0]||'').trim(),
    action:/#\d+ ·/.test(l.innerText),
    what:/מה זה אומר:/.test(l.innerText), need:/מה חסר:/.test(l.innerText),
    needTxt:((l.innerText.match(/מה חסר: ([^\n]*)/)||[])[1]||''),
    fix:!!l.querySelector('button[onclick^="planAddToSheet"]')}));
  return {rows, summary:box.innerText.trim().split('\n').pop(),
    glyphs:[...new Set(li.map(l=>l.querySelector('.check').textContent.trim()))]};
});

// ---------- nothing ticked: the checklist must not read as a clean bill of health
await page.evaluate(()=>{ S.activeQuarter='Q3'; S.scenarios=[]; S.ui={...(S.ui||{}),planPicks:{}};
  save(); go('export'); });
await page.waitForTimeout(900);
const none=await read();
ck('with no scenario, the lever-based checks report NOT CHECKED rather than passing',
  none.rows.some(r=>r.s==='na'), `${none.rows.filter(r=>r.s==='na').length} of ${none.rows.length} rows unchecked`);
ck('...and the summary refuses to say "ready" on the strength of checks that never ran',
  !/מוכן להגשה/.test(none.summary) && /לא נבדק/.test(none.summary), none.summary);
ck('...and it says out loud that this is not an approval',
  /זה אינו אישור/.test(none.summary) || /פריטים פתוחים/.test(none.summary), none.summary);
ck('the tab says plainly that nothing was ticked, instead of listing actions that do not exist',
  await page.evaluate(()=>/לא סומנה אף פעולה/.test(document.getElementById('checklist').innerText)));
ck('every row that is not a pass explains what it means and what is missing',
  none.rows.filter(r=>r.s!=='ok').every(r=>r.what&&r.need),
  none.rows.filter(r=>r.s!=='ok'&&!(r.what&&r.need)).map(r=>r.t).join(' | ')||'all explained');
ck('a passing row stays quiet — the explanation is for what is open, not a wall of prose',
  none.rows.filter(r=>r.s==='ok').every(r=>!r.what), 'no rationale under a tick');
/* The three states must be distinguishable without reading: ✓ / ✗ / — . An empty box for "failed"
   and an empty box for "never ran" is the ambiguity this whole rewrite exists to remove. */
ck('the three states are drawn differently, not two states and a hope',
  none.glyphs.length>=2 && none.glyphs.includes('—'), none.glyphs.join(' '));

// ---------- a ticked action walks open -> na -> ok
const row=()=>page.evaluate(()=>{
  const l=[...document.querySelectorAll('#checklist li')].find(x=>/#2 ·/.test(x.innerText));
  if(!l) return null;
  const c=l.querySelector('.check').className;
  return {s:/done/.test(c)?'ok':(/na/.test(c)?'na':'open'),
    need:((l.innerText.match(/מה חסר: ([^\n]*)/)||[])[1]||''),
    fix:!!l.querySelector('button[onclick^="planAddToSheet"]')};
});
await page.evaluate(()=>{ const q=nextQuarters('Q3')[0]; planPicks(q)[2]=true; save(); go('export'); });
await page.waitForTimeout(800);
const r1=await row();
ck('a ticked action gets its own row in the checklist — this is the sync that was missing',
  !!r1, 'action #2 is listed');
ck('...and it is OPEN while its form has not been added to the sheet', r1.s==='open', r1.need);
ck('...naming the form that is missing, not just "incomplete"', /A3-3/.test(r1.need), r1.need);
ck('...and offering the one-click fix beside it', r1.fix===true);

await page.evaluate(()=>planAddToSheet(1)); await page.waitForTimeout(700);
await page.evaluate(()=>go('export')); await page.waitForTimeout(700);
const r2=await row();
ck('adding the form moves it off OPEN — the checklist tracks the sheet, not a stored flag',
  r2.s!=='open', `now ${r2.s}`);
ck('...but it is NOT a pass yet: the form is present with empty fields, so it reports NOT CHECKED',
  r2.s==='na', r2.need);
ck('...and says which form is still blank', /A3-3/.test(r2.need), r2.need);

await page.evaluate(()=>{ const q=nextQuarters('Q3')[0];
  S.scenarios[0].levers[q].actions.find(a=>a.form==='A3-3').amount=338790; save(); go('export'); });
await page.waitForTimeout(800);
const r3=await row();
ck('filling the field is what finally makes it a pass', r3.s==='ok', `state ${r3.s}`);

/* Per-FORM, not per-quarter. A quarter-wide "are there any numbers?" test turns a currency
   exchange green because a production figure was typed somewhere else — a false tick of exactly
   the kind being removed. */
const perForm=await page.evaluate(()=>{
  const q=nextQuarters('Q3')[0], lv=S.scenarios[0].levers[q];
  planPicks(q)[5]=true; save();                       // a second action, its own form
  const blk=planV6For(q), a=blk.actions.find((x,i)=>(x.n!=null?x.n:i+1)===5);
  const codes=planFormCodes(a);
  if(codes.length) codes.forEach(f=>addSimAction(S.scenarios[0].id,q,f));
  save(); go('plan'); go('export');
  const l=[...document.querySelectorAll('#checklist li')].find(x=>/#5 ·/.test(x.innerText));
  return {codes, has:!!l, s:l?(/done/.test(l.querySelector('.check').className)?'ok'
    :(/na/.test(l.querySelector('.check').className)?'na':'open')):null,
    otherFilled:(lv.actions.find(z=>z.form==='A3-3')||{}).amount};
});
ck('a second action stays unchecked even though another form in the same quarter IS filled',
  perForm.s!=='ok', `#5 is ${perForm.s} while A3-3 holds ${perForm.otherFilled}`);

/* ---------- the dashboard reading order, on BOTH dashboards.
   There are two renderers — `bodyDashboard` for a single quarter and `renderCumulativeDashboard`
   for "מצטבר" — and the standing tables were moved in only one of them the first time. Anyone
   looking at the cumulative view saw the old order and reported, correctly, that nothing had
   changed. So the assertion runs against both, by the same measurement. */
const measure=async()=>{ await page.waitForTimeout(900); return page.evaluate(()=>{
  const c=document.querySelector('.content');
  const top=el=>el?Math.round(el.getBoundingClientRect().top+window.scrollY):null;
  const find=re=>[...c.querySelectorAll('.read, .kpis, .grid, .card')].find(x=>re.test(x.innerText));
  return { kpis:top(c.querySelector('.kpis')), alerts:top(find(/נורות אזהרה/)),
    plants:top(find(/מפעלים וקיבולת ייצור/)), cash:top(find(/מזומן לפי אזור/)) }; }); };

await page.evaluate(()=>{ S.cumulative=false; go('dash'); });
const dash=await measure();
ck('the dashboard still carries both standing tables', dash.plants!=null && dash.cash!=null,
  `plants ${dash.plants} · cash ${dash.cash}`);
ck('the headline figures come first', dash.kpis<dash.alerts, `kpis ${dash.kpis} · alerts ${dash.alerts}`);
ck('plants and regional cash sit BELOW the general figures, as asked',
  dash.alerts<dash.plants && dash.plants<dash.cash,
  `alerts ${dash.alerts} → plants ${dash.plants} → cash ${dash.cash}`);

await page.evaluate(()=>{ S.cumulative=true; go('dash'); });
const cum=await measure();
ck('the CUMULATIVE dashboard carries them too', cum.plants!=null && cum.cash!=null,
  `plants ${cum.plants} · cash ${cum.cash}`);
ck('...and in the same order — this is the view that made the first move look like no change',
  cum.kpis<cum.plants && cum.plants<cum.cash,
  `kpis ${cum.kpis} → plants ${cum.plants} → cash ${cum.cash}`);
await page.evaluate(()=>{ S.cumulative=false; save(); });

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('CHECKLIST — three states, tied to the ticked actions')?1:0);
})();
