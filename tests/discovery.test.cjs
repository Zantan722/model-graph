const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const ai=require('../desktop/ai.cjs'),{discoverViews}=require('../desktop/repo-analysis.cjs');
const {generateViews}=require('../desktop/generate-views.cjs'),store=require('../desktop/report-store.cjs');
const {importPuml}=require('../desktop-app/diagram-parser.cjs');
(async()=>{
 const root=await fs.realpath('tests/fixtures/thematic-repo'),manifest=await ai.scanFolder(root),dir=await fs.mkdtemp(path.join(os.tmpdir(),'drawing-first-'));
 let calls=0,snapshot,context;const read=[];const original=ai.readSelection;
 ai.readSelection=async(...args)=>{read.push(...args[2]);return original(...args);};
 try{
  const report=await discoverViews({root,manifest,request:{diagram:'architecture',level:'Container',prompt:'模組架構'},ask:async prompt=>{
   calls++;assert.ok(!prompt.includes('issueSession'));return JSON.stringify({title:'模組圖',summary:'可選的範圍',themes:[{title:'驗證模組',question:'驗證依賴',rationale:'登入模組依賴',paths:['src/session.js']},{title:'訂單模組',question:'訂單依賴',rationale:'結帳模組依賴',paths:['src/orders.js']}]});
  },onContext:c=>{context=c;return store.saveContext(dir,c);},onSources:(s,r)=>{snapshot=s;return store.saveSources(dir,s,r);},onCheckpoint:r=>store.saveReport(dir,r)});
  assert.equal(calls,1);assert.ok(read.every(p=>!p.includes('/')));assert.equal(report.themes.length,2);assert.ok(report.themes.every(t=>!t.views[0].source&&t.views[0].content.items.length===0));
  assert.equal((await store.loadContext(dir,report.id)).root,root);assert.equal((await store.loadSources(dir,report)).length,snapshot.files.length);assert.equal(context.reportId,report.id);
  const resolved=[];await generateViews({report,ids:[report.themes[0].views[0].id],files:snapshot.files,resolveFiles:async v=>{resolved.push(v.id);return ai.readSelection(root,manifest.files,v.seedPaths);},ask:async prompt=>{calls++;assert.ok(!prompt.includes('releaseStock'));return '@startuml\ncomponent Session\ncomponent Users\nSession --> Users : lookup\n@enduml';},validatePuml:importPuml});
  assert.deepEqual(resolved,[report.themes[0].views[0].id]);assert.equal(calls,2);assert.ok(!read.includes('src/orders.js'));assert.equal(report.themes[0].views[0].status,'ready');assert.equal(report.themes[1].views[0].status,'proposed');
  let failedCalls=0;await generateViews({report,ids:[report.themes[1].views[0].id],files:[],resolveFiles:async()=>[],ask:async()=>{failedCalls++;throw new Error('CLI timeout');},validatePuml:importPuml});
  assert.equal(failedCalls,1,'Do not repeat an execution failure');assert.equal(report.themes[1].views[0].status,'failed');
  await assert.rejects(store.loadContext(dir,'../../escape'),/ID/);
  console.log('Drawing-first discovery: one overview call, no implementation before selection, only selected scope read/drawn, native folder binding and persistence passed.');
 }finally{ai.readSelection=original;await fs.rm(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
