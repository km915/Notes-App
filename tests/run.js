// run.js — runs every *.test.js file in this folder. `npm test` in the tests folder.
const fs=require('fs');
let pass=0,fail=0;
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+m)};
(async()=>{
 const only=process.argv[2];
 for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')&&(!only||f.includes(only)))){
  console.log(f);
  try{await require('./'+f)(ok)}catch(e){fail++;console.log('  FAIL crashed:',e&&e.stack||e)}
 }
 console.log(`\n${pass} passed, ${fail} failed`);
 process.exit(fail?1:0);
})();
