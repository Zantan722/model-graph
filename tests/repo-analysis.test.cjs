const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const ai=require('../desktop/ai.cjs');const {analyzeRepository,parsePlan}=require('../desktop/repo-analysis.cjs');const {saveReport,loadReport}=require('../desktop/report-store.cjs');
const {importPuml}=require('../desktop-app/diagram-parser.cjs');
const makeStory=(title,source)=>({title,summary:title+'的實際分支',trigger:'API request',diagram:'sequence',level:'Container',uncertainty:'外部系統未驗證',steps:[{title:'接收',description:'接收請求',evidence:[{path:source,startLine:1,endLine:2}]},{title:'結果',description:'回傳分支結果',evidence:[{path:source,startLine:3,endLine:4}]}]});
(async()=>{
 const root=await fs.realpath(path.resolve('tests/fixtures/thematic-repo'));const manifest=await ai.scanFolder(root);
 const plan={title:'Shop 主題地圖',summary:'登入與結帳是兩個不同能力',themes:[{title:'登入',question:'trace login authentication',rationale:'身分驗證',paths:['src/session.js']},{title:'結帳',question:'trace checkout inventory and payment',rationale:'訂單交易',paths:['src/orders.js']}]};
 assert.throws(()=>parsePlan(JSON.stringify({...plan,themes:[{...plan.themes[0],paths:['../outside']}]}),manifest.files));
 const run=async(cancel=false,failOne=false)=>{
  const rounds=new Map();let repaired=0,reviews=0;const progress=[],snapshots=[];const controller=new AbortController();
  const ask=async prompt=>{
   if(prompt.startsWith('ROLE: Repository analyst.')){assert.match(prompt,/Shop example/);return JSON.stringify(plan);}
   if(prompt.startsWith('ROLE: Scoped repository explorer.')){
    const login=prompt.includes('question: trace login');const count=rounds.get(login)||0;rounds.set(login,count+1);
    return JSON.stringify({action:count?'finish':'continue',read:count?[]:[login?'src/users.js':'src/services.js'],search:count?[]:[{query:login?'issueSession':'releaseStock',prefix:'src/',offset:0}],findings:'追查呼叫與回傳結果',gaps:['外部環境未知']});
   }
   if(prompt.startsWith('Analyze the supplied repository')){
    const login=prompt.includes('ACTIVE THEME ONLY: 登入.');const own=[makeStory(login?'登入成功':'結帳成功',login?'src/session.js':'src/orders.js'),makeStory(login?'登入拒絕':'付款拒絕',login?'src/session.js':'src/orders.js')];
    if(prompt.includes('EDITORIAL REVIEW:')){reviews++;return JSON.stringify({stories:own});}
    return JSON.stringify({stories:own});
   }
   if(prompt.startsWith('Create a software engineering diagram.')){
    if(failOne&&prompt.includes('付款拒絕'))return '@startuml\n!include /outside.puml\n@enduml';
    if(prompt.includes('付款拒絕')&&!repaired++){return '@startuml\nparticipant A\nalt bad\nA -> B\nend\n@enduml';}
    return '@startuml\nparticipant Client\nparticipant API\nClient -> API : request\nAPI --> Client : result\n@enduml';
   }
   throw new Error('Unexpected analysis phase');
  };
  const report=await analyzeRepository({root,manifest,request:{prompt:'分析主題',diagram:'sequence'},ask,signal:controller.signal,validatePuml:importPuml,onProgress:e=>progress.push(e),onCheckpoint:async r=>{snapshots.push(r);if(cancel&&r.themes.some(t=>t.stories.some(s=>s.flowStatus==='ready')))controller.abort();}});
  return {report,progress,snapshots,reviews,repaired};
 };
 const {report,progress,reviews,repaired}=await run();assert.equal(report.status,'complete');assert.equal(report.themes.length,2);assert.equal(reviews,2);assert.ok(repaired>=2);assert.equal(report.themes.flatMap(t=>t.stories).filter(s=>s.flowStatus==='ready').length,4);assert.ok(progress.some(e=>e.phase==='search'));assert.ok(report.coverage.read.some(f=>f.path==='src/users.js'));assert.ok(report.coverage.read.every(f=>f.sha256.length===64));
 const partial=(await run(false,true)).report;assert.equal(partial.status,'partial');assert.equal(partial.themes.flatMap(t=>t.stories).filter(s=>s.flowStatus==='ready').length,3);assert.equal(partial.themes.flatMap(t=>t.stories).filter(s=>s.flowStatus==='failed').length,1);
 const cancelled=(await run(true)).report;assert.equal(cancelled.status,'cancelled');assert.ok(cancelled.themes.flatMap(t=>t.stories).some(s=>s.flowStatus==='ready'),'completed flows survive cancellation');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-report-test-'));
 try{await saveReport(directory,report);assert.equal((await loadReport(directory)).themes.length,2);await assert.rejects(saveReport(directory,{...report,id:'../../outside'}));assert.equal((await loadReport(directory)).id,report.id);await saveReport(directory,{...report,status:'running'});assert.equal((await loadReport(directory)).status,'interrupted');await fs.writeFile(path.join(directory,'last-project-report.json'),'{broken');await assert.rejects(loadReport(directory));assert.equal(await fs.readFile(path.join(directory,'last-project-report.json'),'utf8'),'{broken');}finally{await fs.rm(directory,{recursive:true,force:true});}
 console.log('Thematic read/search, editorial review, four independent flows, PUML repair, cancellation preservation and atomic report storage passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
