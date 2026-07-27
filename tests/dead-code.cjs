/* DEAD-CODE SCAN — finds functions that are defined and never called.
   Added because two such functions (sellOptionsCard, planTxt) were found by hand in v8.6.
   One of them was where an estimate marker had been placed, so the marker never appeared:
   dead code is not just weight, it silently swallows work. */
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
const js=src.match(/<script>([\s\S]*)<\/script>/)[1];

const defined=new Set();
// plain declarations and window-assigned handlers
for(const m of js.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) defined.add(m[1]);
for(const m of js.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function|\([^)]*\)\s*=>)/gm)) defined.add(m[1]);

const dead=[];
for(const name of defined){
  // count references that are not the definition itself
  const esc=name.replace(/[$]/g,'\\$');
  // \b does not work for identifiers like $ and $$, so use explicit lookarounds
  const refs=[...js.matchAll(new RegExp('(?<![\\w$])'+esc+'(?![\\w$])','g'))].length;
  const defs=[...js.matchAll(new RegExp('(?:function\\s+|const\\s+|let\\s+|var\\s+)'+esc+'(?![\\w$])','g'))].length;
  // also count uses from HTML attributes (onclick="foo()") outside the script block
  const html=src.replace(js,'');
  const htmlRefs=[...html.matchAll(new RegExp('(?<![\\w$])'+esc+'\\s*\\(','g'))].length;
  if(refs-defs<=0 && htmlRefs===0) dead.push(name);
}
// window.* handlers are called from inline onclick strings inside template literals — those
// live inside the script block, so the reference count above already covers them.
const ignore=new Set(['loadPlaywright']);
const real=dead.filter(d=>!ignore.has(d));

console.log('\n=== DEAD CODE ===');
if(!real.length){ console.log('PASS 1  FAIL 0\n  ✓ no unreferenced functions'); process.exit(0); }
console.log(`PASS 0  FAIL 1\n  ✗ ${real.length} function(s) defined but never referenced:`);
real.forEach(d=>console.log('     · '+d));
process.exit(1);
