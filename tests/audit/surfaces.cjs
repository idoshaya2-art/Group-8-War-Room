/* The three surface levels and the colour grammar.
   Nothing here checks that the page is pretty — it checks the two rules that make it legible:
   a box means "you act here" and so must stay rare, and a colour carries one meaning.
   Behaviour tests cannot catch a restyle that quietly turns everything back into a card. */
const {open,checks}=require('../lib.cjs');
(async()=>{
const {ck,report}=checks();
const {browser,page,errors}=await open({viewport:{width:1400,height:1000}});
await page.evaluate(()=>go('plan')); await page.waitForTimeout(900);

const m=await page.evaluate(()=>{
  const c=document.querySelector('.content');
  const chromeCards=[...c.querySelectorAll('.card')].filter(x=>!x.closest('.secbody'));
  return {
    focus:c.querySelectorAll('.focus').length,
    read:c.querySelectorAll('.read').length,
    ref:c.querySelectorAll('details.ref').length,
    chromeCards:chromeCards.length,
    chromeCardText:chromeCards.map(x=>x.innerText.trim().slice(0,40)),
    decisionCards:c.querySelectorAll('.act').length,
    focusText:[...c.querySelectorAll('.focus')].map(x=>x.innerText.trim().split('\n')[0].slice(0,30)),
    eyebrows:c.querySelectorAll('.eyebrow').length,
    headings:c.querySelectorAll('.rh, h2, h3').length,
    // a .read must not look like a box
    readIsUnboxed:[...c.querySelectorAll('.read')].every(x=>{
      const s=getComputedStyle(x);
      return s.borderTopWidth==='1px' && s.borderLeftWidth==='0px' && s.borderRightWidth==='0px'
        && s.backgroundImage==='none';
    }),
    // the level-1 accent edge must come from the semantic vars, not a raw colour
    sigVars:['--sig-block','--sig-warn','--sig-ok','--sig-ai','--sig-act']
      .map(v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim()).filter(Boolean).length,
  };
});

ck('a box is rare — at most three level-1 surfaces outside the decision list',
  m.focus<=3 && m.focus>=1, `${m.focus}: ${m.focusText.join(' | ')}`);
ck('the page chrome carries no cards of its own any more',
  m.chromeCards===0, m.chromeCardText.join(' | ') || 'none');
ck('level 2 exists and is genuinely unboxed — a rule on top, no side borders, no panel fill',
  m.read>=3 && m.readIsUnboxed===true, `${m.read} read sections`);
ck('reference material is collapsed to level 3', m.ref>=1, `${m.ref} ref sections`);
ck('the decision cards are untouched by the restyle', m.decisionCards>=5, `${m.decisionCards} decisions`);
ck('every level-1 surface says what it is before it says what it holds',
  m.eyebrows>=2, `${m.eyebrows} eyebrows`);
ck('all five semantic colour variables are defined', m.sigVars===5, `${m.sigVars}/5`);

/* The score is the number the whole page hangs on. It appeared twice — once in the north-star bar
   and once in a hero box directly beneath it — with a jump button under each. */
const dup=await page.evaluate(()=>{
  const t=document.querySelector('.content').innerText;
  const jump=[...document.querySelectorAll('.content button')].filter(b=>/ההחלטות|החלטות חובה/.test(b.textContent) && /↓/.test(b.textContent));
  return { jumpButtons:jump.length, jumpLabels:jump.map(b=>b.textContent.trim()) };
});
ck('one jump-to-decisions button, not two stacked',
  dup.jumpButtons===1, dup.jumpLabels.join(' | '));

/* Same page, phone. The levels must survive the narrow viewport rather than collapse into a stack
   of identical blocks. */
await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>go('plan')); await page.waitForTimeout(700);
const ph=await page.evaluate(()=>({
  focus:document.querySelectorAll('.content .focus').length,
  read:document.querySelectorAll('.content .read').length,
  overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth
}));
ck('the levels hold on a phone', ph.focus>=1 && ph.read>=3, `focus ${ph.focus} · read ${ph.read}`);
ck('no horizontal overflow on a phone', ph.overflowX===0, `${ph.overflowX}px`);

ck('no JavaScript errors', errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).length===0,
  errors.filter(e=>!/net::ERR|Failed to load|clipboard/i.test(e)).slice(0,2).join(' | '));
await browser.close();
process.exit(report('SURFACES — three levels and the colour grammar')?1:0);
})();
