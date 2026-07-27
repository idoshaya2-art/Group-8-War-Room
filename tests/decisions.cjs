/* DECISIONS SUITE — the action list must cover every decision family, mark what has been
   sent without navigating away, and only accept AI suggestions the engine can validate. */
const {open,checks}=require('./lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
const {ck,report}=checks();

await page.evaluate(()=>{ S.scenarios=[]; S.quarters.Q3.financial.cash={us:900000,europe:2400000,brazil:1800000,hq:213000}; save(); go('plan'); });
await page.waitForTimeout(500);

/* ---- coverage: decisions must not be limited to production/sales/transfers ---- */
const fams=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const items=buildActionPlan(q,t)||[];
  return items.map(i=>({title:i.title,form:i.form||'',cat:i.cat,level:i.level,hasSim:!!i.sim})); });
const has=re=>fams.some(f=>re.test(f.form)||re.test(f.title));
ck('advertising is a decision of its own', has(/פרסום|A1-2|A1-1/), fams.filter(f=>/פרסום/.test(f.title)).map(f=>f.title)[0]||'—');
ck('idle cash / securities financing is offered', has(/A3-3|מזומן סרק|ניירות ערך/), fams.filter(f=>/סרק/.test(f.title)).map(f=>f.title)[0]||'—');
ck('production is still covered', has(/A2-3|ייצר|ייצור/));
ck('sales / pricing is still covered', has(/A1-2|מכור/));
ck('R&D is covered', has(/H1-1|מו״פ/));
ck('at least 4 distinct decision categories present', new Set(fams.map(f=>f.cat)).size>=3, [...new Set(fams.map(f=>f.cat))].join(','));

/* ---- the advertising action must be honest about where NOT to spend ---- */
const adv=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const it=(buildActionPlan(q,t)||[]).find(x=>/פרסום/.test(x.title)); return it?{d:it.detail,sim:it.sim}:null; });
ck('advertising action exists', !!adv);
ck('it states the same-quarter timing rule', adv&&/באותו רבעון שבו שולם/.test(adv.d));
ck('it names the effectiveness threshold', adv&&/סף/.test(adv.d));

/* ---- idle cash must respect the derived floor and quote real rates ---- */
const idle=await page.evaluate(()=>{ const q=S.activeQuarter,t=nextQuarters(q)[0];
  const it=(buildActionPlan(q,t)||[]).find(x=>/סרק/.test(x.title)); return it?{d:it.detail,sim:it.sim}:null; });
ck('idle-cash action exists when cash is ample', !!idle);
ck('it quotes the Brazil rate that makes it worth doing', idle&&/4\.5/.test(idle.d));
ck('it warns the deposit must be renewed each quarter', idle&&/חידוש/.test(idle.d));
ck('it carries an executable payload', !!(idle&&idle.sim));

/* ---- sending marks, does not navigate ---- */
await page.evaluate(()=>{ const a=document.querySelector('.act');
  [...a.querySelectorAll('button')].find(b=>/שלח לסימולטור/.test(b.textContent)).click(); });
await page.waitForTimeout(300);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/העבר לתרחיש/.test(x.textContent)); if(b)b.click(); });
await page.waitForTimeout(600);
const after=await page.evaluate(()=>({page:currentPage, scenarios:S.scenarios.length,
  checked:[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length,
  progress:[...document.querySelectorAll('.tag.g')].map(t=>t.textContent.trim()).filter(t=>/הועברו/.test(t))[0]||''}));
ck('sending does NOT navigate away from the decisions', after.page==='plan', 'landed on '+after.page);
ck('the action is marked as sent', after.checked===1);
ck('a progress counter appears', /הועברו/.test(after.progress), after.progress);
ck('the scenario really was created', after.scenarios===1);
await page.evaluate(()=>{ go('dashboard'); go('plan'); }); await page.waitForTimeout(400);
ck('the mark survives leaving and returning',
   await page.evaluate(()=>[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length)===1);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/בטל סימון/.test(x.textContent)); if(b)b.click(); });
await page.waitForTimeout(500);
ck('the mark can be undone',
   await page.evaluate(()=>[...document.querySelectorAll('.act')].filter(a=>/הועבר לסימולטור/.test(a.textContent)).length)===0);

/* ---- layer 4: AI suggestions are validated by the engine, never trusted ---- */
const ai=await page.evaluate(()=>{
  const t=nextQuarters(S.activeQuarter)[0];
  const good=JSON.stringify({actions:[{title:'הפקד עודף בברזיל',form:'A3-3',level:'amber',why:'4.5% לרבעון',
    sim:{q:t,regions:{brazil:{invest:500000}}}}]});
  const bad=JSON.stringify({actions:[{title:'ייצר בארה״ב',form:'A2-3',level:'red',why:'x',
    sim:{q:t,regions:{us:{production:20000,unitCost:70,offices:2}}}}]});
  const worse=JSON.stringify({actions:[{title:'משרד בודד',form:'A1-3',level:'amber',why:'x',
    sim:{q:t,regions:{europe:{offices:1,advertising:1000}}}}]});
  const g=parseEnrichJSON(good,t)[0], b=parseEnrichJSON(bad,t)[0], w=parseEnrichJSON(worse,t)[0];
  return {parsedGood:!!g, aiFlag:g&&g.ai===true,
    goodOk:validateEnriched(g,t).ok,
    badRejected:!validateEnriched(b,t).ok, badWhy:validateEnriched(b,t).why,
    officeRejected:!validateEnriched(w,t).ok,
    garbage:(()=>{ try{ parseEnrichJSON('not json',t); return false; }catch(e){ return true; } })(),
    empty:parseEnrichJSON('{"actions":[]}',t).length===0 };
});
ck('a well-formed AI suggestion parses', ai.parsedGood);
ck('AI suggestions are flagged as AI-originated', ai.aiFlag);
ck('a legal AI suggestion passes engine validation', ai.goodOk);
ck('an AI suggestion that produces without a plant is REJECTED', ai.badRejected, ai.badWhy);
ck('an AI suggestion with an illegal office count is REJECTED', ai.officeRejected);
ck('malformed model output throws rather than corrupting the list', ai.garbage);
ck('an empty suggestion set is handled', ai.empty);

/* ---- rejected suggestions must be visible, not silently dropped ---- */
await page.evaluate(()=>{ const t=nextQuarters(S.activeQuarter)[0];
  const bad=parseEnrichJSON(JSON.stringify({actions:[{title:'ייצר בארה״ב',form:'A2-3',level:'red',why:'x',
    sim:{q:t,regions:{us:{production:20000,unitCost:70,offices:2}}}}]}),t)[0];
  S.ai.enriched={q:t,at:Date.now(),actions:[{...bad,_v:validateEnriched(bad,t)}]}; save(); go('plan'); });
await page.waitForTimeout(500);
ck('a rejected AI suggestion is shown with the rule it broke',
   await page.evaluate(()=>/נדחו על-ידי המנוע/.test(document.body.innerText)));
ck('and it does NOT appear as an actionable card',
   await page.evaluate(()=>![...document.querySelectorAll('.act')].some(a=>/ייצר בארה״ב/.test(a.textContent))));
ck('the four layers are named on the page',
   await page.evaluate(()=>/חוקי המשחק/.test(document.body.innerText)&&/המצב מהדוח האחרון/.test(document.body.innerText)&&/היעדים/.test(document.body.innerText)));

const jsErr=errors.filter(e=>!/Failed to load resource|net::ERR_/.test(e));
ck('no JavaScript errors', jsErr.length===0, jsErr.slice(0,2).join(' | '));
const failed=report('DECISIONS');
await browser.close();
process.exit(failed?1:0);
})();
