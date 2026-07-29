const {open}=require('../lib.cjs');
(async()=>{
const {browser,page,errors}=await open();
const R=await page.evaluate(()=>{
  const out={};
  out.pages=PAGES.map(p=>({id:p.id,name:p.name,sub:p.sub}));
  out.forms=(typeof INTOPIA_FORMS!=='undefined')?INTOPIA_FORMS.map(f=>f.code||f.form||f.id):null;
  out.simForms=(typeof SIM_FORMS!=='undefined')?SIM_FORMS.map(f=>f.form):null;
  // decision fields the engine can produce a value for
  const q=S.activeQuarter,t=nextQuarters(q)[0];
  go('sim'); if(!S.scenarios.length) newScenario();
  const lev=S.scenarios[0].levers[t];
  out.leverFields=Object.keys(lev.regions.europe||{});
  out.rowsEmitted=(typeof buildInputRows==='function')?[...new Set(buildInputRows(t,S.scenarios[0]).map(r=>r.form))]:null;
  // data sources
  out.dataSources={
    hardcoded:['DATALOG','RULES','MR_STUDIES','MR_COST','DEFAULT_CONTRACTS','PLAN_DOC'].filter(k=>typeof window[k]!=='undefined'||eval('typeof '+k)!=='undefined'),
    userInput:['quarters[].financial','quarters[].operational','config.goals','config.contracts','config.plantSplit','scenarios[].levers'],
    ingested:['Balance Sheet','Income Statement','Management Info','Currency','MR74','MR17&28'],
    ai:['S.ai.chat','S.ai.strategy','S.ai.review'],
  };
  out.counts={pages:PAGES.length, leverFields:out.leverFields.length,
    formsInCatalog:(out.simForms||[]).length, formsEmitted:(out.rowsEmitted||[]).length,
    mrStudies:(typeof MR_STUDIES!=='undefined')?MR_STUDIES.length:null,
    rulesKeys:(typeof RULES!=='undefined')?Object.keys(RULES).length:null};
  return out;
});
console.log(JSON.stringify(R,null,1));
console.log('errs',errors.filter(e=>!/net::ERR|Failed to load/.test(e)).length);
await browser.close();
})();
