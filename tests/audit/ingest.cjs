/* Which quarter a report is loaded INTO.

   The panel used to be titled with S.activeQuarter — the quarter the selector at the top happened
   to be showing — and applyParsed wrote there too. With Q1–Q3 already in, that meant the panel
   said "load Q3" when the report you were waiting for was Q4's, and a Q4 file dropped in that
   state silently overwrote Q3. The target is now an explicit, visible choice that defaults to the
   first quarter with no report.

   Not covered here: the ordering inside handleFile (activeQuarter must move BEFORE parseWorkbook,
   because parseWorkbook writes market research as it goes). SheetJS loads from a CDN and there is
   no network in this sandbox, so a real file drop cannot be exercised — asserted by construction
   in the code comment instead, and flagged here so the gap is known rather than assumed away. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open();

// ---------------- the target
const t=await page.evaluate(()=>{
  const out={};
  out.entered=enteredQuarters();
  out.viewing=S.activeQuarter;
  out.target=ingestTarget();
  out.next=nextReportQuarter();
  // an explicit override wins over the default
  S.ui=S.ui||{}; S.ui.ingestQ='Q6';
  out.overridden=ingestTarget();
  // a nonsense value falls back rather than corrupting the write
  S.ui.ingestQ='NOT_A_QUARTER';
  out.garbage=ingestTarget();
  S.ui.ingestQ=null;
  out.cleared=ingestTarget();
  return out;
});
ck('the seed has Q1–Q3 loaded and sits on Q3', t.entered.join(',')==='Q1,Q2,Q3' && t.viewing==='Q3',
  `${t.entered.join(',')} · viewing ${t.viewing}`);
ck('the ingest target is the first quarter with NO report, not the one being viewed',
  t.target==='Q4' && t.target!==t.viewing, `target ${t.target}, viewing ${t.viewing}`);
ck('an explicit choice overrides the default', t.overridden==='Q6');
ck('a stored value that is not a quarter falls back instead of writing somewhere invalid',
  t.garbage==='Q4', t.garbage);
ck('clearing the choice returns to the next missing report', t.cleared==='Q4');

// ---------------- the write lands in the target, and leaves the viewed quarter alone
const w=await page.evaluate(()=>{
  const before={ q3:S.quarters.Q3.financial.netProfit, q4:S.quarters.Q4.financial.netProfit,
    q3tech:S.quarters.Q3.operational.techX };
  // exactly what handleFile does before parsing
  const tq=ingestTarget(); S.activeQuarter=tq; S.cumulative=false;
  applyParsed({scan:{netProfit:4242, techX:7, cash:{europe:999}}});
  const after={ q3:S.quarters.Q3.financial.netProfit, q4:S.quarters.Q4.financial.netProfit,
    q3tech:S.quarters.Q3.operational.techX, q4tech:S.quarters.Q4.operational.techX,
    q4cash:S.quarters.Q4.financial.cash.europe, active:S.activeQuarter,
    q4entered:S.quarters.Q4.entered };
  return {before, after};
});
ck('the parsed report is written into the target quarter', w.after.q4===4242 && w.after.q4tech===7,
  `Q4 netProfit ${w.after.q4}, techX ${w.after.q4tech}`);
ck('the quarter that was on screen is left untouched',
  w.after.q3===w.before.q3 && w.after.q3tech===w.before.q3tech,
  `Q3 netProfit ${w.before.q3}→${w.after.q3}`);
ck('the app moves to the quarter just loaded, so the rest of the screen shows it',
  w.after.active==='Q4');
ck('parsing a file does NOT mark the quarter as entered — that is the confirm step',
  w.after.q4entered!==true, `entered=${w.after.q4entered}`);

// ---------------- confirming is what completes it
const cf=await page.evaluate(()=>{
  S.ui=S.ui||{}; S.ui.ingestQ='Q4';
  confirmQuarter();
  return { entered:S.quarters.Q4.entered, pendingCleared:!S.ui.ingestQ, nextTarget:ingestTarget() };
});
ck('confirming marks the quarter entered', cf.entered===true);
ck('...clears the pending choice, so the panel offers the next missing report',
  cf.pendingCleared===true && cf.nextTarget==='Q5', `next target ${cf.nextTarget}`);

// ---------------- the panel itself
await page.evaluate(()=>{ // back to a clean pre-ingest state for the UI checks
  S.quarters.Q4.entered=false; S.quarters.Q4.financial.netProfit=0;
  S.quarters.Q4.operational.techX=0; S.activeQuarter='Q3'; S.ui.ingestQ=null; save();
});
await page.evaluate(()=>go('data')); await page.waitForTimeout(900);
const ui=await page.evaluate(()=>{
  const panel=[...document.querySelectorAll('.card')].find(x=>/קליטת דוח תוצאות/.test(x.textContent));
  const sel=panel?panel.querySelector('select'):null;
  const verify=document.getElementById('verifyWrap');
  return { titled:panel?/קליטת דוח תוצאות — Q4/.test(panel.innerText):false,
    saysViewing:panel?/הבורר למעלה מציג את/.test(panel.innerText):false,
    listsLoaded:panel?/Q1 · Q2 · Q3/.test(panel.innerText):false,
    selectValue:sel?sel.value:null, selectOptions:sel?sel.options.length:0,
    verifyExists:!!verify, verifyClosed:verify?!verify.open:null,
    verifyHasFields:verify?verify.querySelectorAll('input').length:0 };
});
ck('the panel is titled with the quarter it will write into', ui.titled===true);
ck('...says plainly that the selector above controls the view, not the write', ui.saysViewing===true);
ck('...and lists which reports are already loaded', ui.listsLoaded===true);
ck('the target is changeable from the panel, across all nine quarters',
  ui.selectValue==='Q4' && ui.selectOptions===9, `${ui.selectValue} of ${ui.selectOptions}`);

/* The manual form was asked to be gone from view, not gone. It is the confirmation step of an
   import and the only in-app way to fix a figure the parser misread, so it is collapsed. */
ck('the manual entry form still exists', ui.verifyExists===true && ui.verifyHasFields>10,
  `${ui.verifyHasFields} fields`);
ck('...but starts closed instead of filling the tab with number inputs', ui.verifyClosed===true);

const opened=await page.evaluate(()=>{
  const v=document.getElementById('verifyWrap'); v.open=true;
  return { fields:v.querySelectorAll('input').length,
    confirmBtn:[...v.querySelectorAll('button')].some(b=>/אשר|נקלט/.test(b.textContent)) };
});
ck('opening it gives back the full editable form', opened.fields>10, `${opened.fields} fields`);

ck('no JavaScript errors',
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('INGEST — which quarter a report is loaded into')?1:0);
})();
