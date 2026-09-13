const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const ai=require('../desktop/ai.cjs'),{analyzeRepository,parsePlan}=require('../desktop/repo-analysis.cjs');
const {generateViews,selectedViews}=require('../desktop/generate-views.cjs');
const {saveReport,loadReport,saveSources,loadSources,normalizeReport}=require('../desktop/report-store.cjs');
const {importPuml}=require('../desktop-app/diagram-parser.cjs');
const makeView=(title,source)=>({title,summary:title+'的實際分支',purpose:'辨識呼叫與結果',scope:'此情境',trigger:'API request',diagram:'sequence',level:'Container',uncertainty:'外部系統未驗證',content:{kind:'scenario',items:[{id:'receive',type:'step',title:'接收',description:'接收請求',evidence:[{path:source,startLine:1,endLine:2}]},{id:'result',type:'step',title:'結果',description:'回傳結果',evidence:[{path:source,startLine:3,endLine:4}]}]}});
const source='@startuml\nparticipant Client\nparticipant API\nClient -> API : request\nAPI --> Client : result\n@enduml';
(async()=>{
 const root=await fs.realpath(path.resolve('tests/fixtures/thematic-repo')),manifest=await ai.scanFolder(root);
 const plan={title:'Shop',summary:'登入與結帳',themes:[{title:'登入',question:'trace login',rationale:'身分驗證',paths:['src/session.js']},{title:'結帳',question:'trace checkout',rationale:'訂單',paths:['src/orders.js']}]};
 assert.throws(()=>parsePlan(JSON.stringify({...plan,themes:[{...plan.themes[0],paths:['../outside']}]}),manifest.files));
 const rounds=new Map();let reviews=0,drawCalls=0,snapshot;const progress=[];
 const report=await analyzeRepository({root,manifest,request:{prompt:'分析主題',diagram:'sequence',level:'Container'},onSources:s=>{snapshot=s;},onProgress:e=>progress.push(e),ask:async prompt=>{
  if(prompt.startsWith('ROLE: Repository analyst.'))return JSON.stringify(plan);
  if(prompt.startsWith('ROLE: Scoped repository explorer.')){const login=prompt.includes('question: trace login'),count=rounds.get(login)||0;rounds.set(login,count+1);return JSON.stringify({action:count?'finish':'continue',read:count?[]:[login?'src/users.js':'src/services.js'],search:count?[]:[{query:login?'issueSession':'releaseStock',prefix:'src/',offset:0}],findings:'追查呼叫',gaps:[]});}
  if(prompt.startsWith('ROLE: View analyst.')){if(prompt.includes('EDITORIAL REVIEW:'))reviews++;const login=prompt.includes('ACTIVE THEME ONLY: 登入.');return JSON.stringify({views:[makeView(login?'登入成功':'結帳成功',login?'src/session.js':'src/orders.js'),makeView(login?'登入拒絕':'付款拒絕',login?'src/session.js':'src/orders.js')]});}
  drawCalls++;throw new Error('Analysis must not generate diagrams');
 }});
 assert.equal(drawCalls,0);assert.equal(report.status,'awaiting_selection');assert.equal(reviews,2);assert.ok(progress.some(e=>e.phase==='search'));
 const all=report.themes.flatMap(t=>t.views);assert.equal(all.length,4);assert.ok(all.every(v=>v.status==='proposed'&&!v.source));
 assert.throws(()=>selectedViews(report,[]));assert.throws(()=>selectedViews(report,['outside']));assert.throws(()=>selectedViews(report,[all[0].id,all[0].id]));
 const original=structuredClone(report);
 await generateViews({report,ids:[all[0].id,all[2].id],files:snapshot.files,validatePuml:importPuml,ask:async()=>{drawCalls++;return source;}});
 assert.equal(drawCalls,2);assert.equal(report.status,'awaiting_selection');assert.deepEqual(all.map(v=>v.status),['ready','proposed','ready','proposed']);
 await generateViews({report,ids:[all[0].id],files:snapshot.files,validatePuml:importPuml,ask:async()=>{throw new Error('Ready view must not rerun');}});
 await generateViews({report,ids:[all[1].id],files:snapshot.files,validatePuml:importPuml,ask:async()=>source});assert.equal(all[1].status,'ready');assert.equal(all[3].status,'proposed');
 const failed=structuredClone(original);let attempts=0;
 await generateViews({report:failed,ids:all.slice(0,2).map(v=>v.id),files:snapshot.files,validatePuml:importPuml,ask:async()=>++attempts<=2?'@startuml\n!include /outside\n@enduml':source});
 assert.equal(failed.status,'partial');assert.deepEqual(failed.themes[0].views.map(v=>v.status),['failed','ready']);
 const cancelled=structuredClone(original),controller=new AbortController();
 await generateViews({report:cancelled,ids:all.map(v=>v.id),files:snapshot.files,signal:controller.signal,validatePuml:importPuml,ask:async()=>source,onCheckpoint:r=>{if(r.themes[0].views[0].status==='ready')controller.abort();}});
 assert.equal(cancelled.status,'cancelled');assert.deepEqual(cancelled.themes.flatMap(t=>t.views).map(v=>v.status),['ready','proposed','proposed','proposed']);
 const withGap=structuredClone(original);withGap.themes.push({id:'empty',title:'Unknown',question:'Unknown',rationale:'Missing evidence',status:'partial',gaps:['No evidence'],views:[]});
 await generateViews({report:withGap,ids:all.map(v=>v.id),files:snapshot.files,validatePuml:importPuml,ask:async()=>source});assert.equal(withGap.status,'partial','No waiting for selections when all available views are ready');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-report-test-'));
 try{
  await saveReport(directory,report);await saveSources(directory,snapshot,report);
  const restored=await loadReport(directory,report.id);assert.equal(restored.version,2);assert.equal((await loadSources(directory,restored)).length,snapshot.files.length);
  await assert.rejects(loadReport(directory,'../../outside'));
  await fs.writeFile(path.join(directory,'project-sources',report.id+'.json'),JSON.stringify({...snapshot,files:snapshot.files.map((f,i)=>i?f:{...f,content:'changed'})}));await assert.rejects(loadSources(directory,report),/指紋/);
  const legacy=JSON.parse(await fs.readFile('tests/fixtures/codex-live-report.json','utf8'));await saveReport(directory,legacy);const before=await fs.readFile(path.join(directory,'last-project-report.json'),'utf8');const migrated=await loadReport(directory);assert.equal(migrated.version,2);assert.equal(migrated.snapshotAvailable,false);assert.equal(migrated.themes[0].views[0].source,legacy.themes[0].stories[0].source);assert.equal(await fs.readFile(path.join(directory,'last-project-report.json'),'utf8'),before);
  await fs.writeFile(path.join(directory,'last-project-report.json'),'{broken');await assert.rejects(loadReport(directory));assert.equal(await fs.readFile(path.join(directory,'last-project-report.json'),'utf8'),'{broken');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
 console.log('Two-phase analysis, explicit selection, later batches, failure/cancel, snapshots, corruption and legacy restore passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
