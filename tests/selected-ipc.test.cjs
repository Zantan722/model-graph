const assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const store=require('../desktop/report-store.cjs'),actualAI=require('../desktop/ai.cjs');const {parseViews}=require('../desktop/views.cjs');
const parser=require('../desktop-app/diagram-parser.cjs');
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-selected-ipc-'));
 const handlers=new Map(),frame={url:'modelgraph://app/'},events=[];const win={isDestroyed:()=>false,webContents:{mainFrame:frame,send:(_name,e)=>events.push(e)}};
 const event={sender:win.webContents,senderFrame:frame};let modelCalls=0,lastInput='',discoveryMode=false;const reads=[];
 const realLoad=Module._load;
 Module._load=function(name,...args){
  if(name==='electron')return {app:{getPath:()=>directory},ipcMain:{handle:(n,fn)=>handlers.set(n,fn)},dialog:{}};
  if(name==='./diagram-parser.cjs')return parser;
  if(name==='./ai.cjs')return {...actualAI,discover:async()=>'/fake/codex',generationArgs:()=>[],readSelection:async(...args)=>{reads.push(...args[2]);return actualAI.readSelection(...args);},run:async(_e,_a,input)=>{modelCalls++;lastInput=input;if(discoveryMode&&input.startsWith('Select only files'))return JSON.stringify(['src/session.js']);return '@startuml\ncomponent A\ncomponent B\nA --> B : imports\n@enduml';}};
  return realLoad.call(this,name,...args);
 };
 try{
  require('../desktop/ai-ipc.cjs').installAI(()=>win);
  const files=[{path:'module.ts',content:'export const A = B;'}];
  const req={diagram:'architecture',level:'Container'};
  const views=parseViews(JSON.stringify({views:[{title:'Modules',summary:'A depends on B',purpose:'Explain dependency',scope:'Module imports',diagram:'architecture',content:{kind:'structure',items:[{id:'A',type:'element',title:'A',description:'Module A',evidence:[{path:'module.ts',startLine:1,endLine:1}]}]},uncertainty:'No runtime claim'}]}),files,req);
  const report={version:2,id:'00000000-0000-4000-8000-000000000011',createdAt:new Date().toISOString(),project:'test',title:'Modules',summary:'Description',status:'awaiting_selection',snapshotAvailable:true,...req,coverage:{indexed:1,excluded:0,read:[{path:'module.ts',sha256:createHash('sha256').update(files[0].content).digest('hex')}],omitted:[]},themes:[{id:'t',title:'Modules',question:'Structure',rationale:'Imports',gaps:[],views}]};
  await store.saveReport(directory,report);await store.saveSources(directory,{reportId:report.id,files},report);
  const payload={reportId:report.id,viewIds:[views[0].id],provider:'codex',custom:'',model:'',runId:'run-1'};
  const invoke=(r,e=event)=>handlers.get('ai:generateViews')(e,r);
  await assert.rejects(invoke(payload,{sender:{},senderFrame:frame}),/來源/);
  await assert.rejects(invoke({...payload,reportId:'../../outside'}),/ID/);
  await assert.rejects(invoke({...payload,viewIds:['unknown']}),/不屬/);
  await assert.rejects(invoke({...payload,viewIds:[]}),/選擇/);assert.equal(modelCalls,0);
  const result=await invoke({...payload,source:'IGNORE',files:[{path:'/etc/passwd'}]});
  assert.equal(result.report.themes[0].views[0].status,'ready');assert.equal(modelCalls,1);assert.match(lastInput,/export const A = B/);assert.ok(!lastInput.includes('/etc/passwd'));
  assert.ok(events.some(e=>e.report?.themes[0].views[0].status==='ready'));
  await invoke(payload);assert.equal(modelCalls,1,'already generated views are not rerun');
  const other=structuredClone(report);other.id='00000000-0000-4000-8000-000000000012';await store.saveReport(directory,other);
  await assert.rejects(invoke({...payload,reportId:other.id}),/快照/);assert.equal(modelCalls,1);
  const discovery=structuredClone(report);discovery.id='00000000-0000-4000-8000-000000000013';discovery.discovery=true;
  await store.saveReport(directory,discovery);await store.saveSources(directory,{reportId:discovery.id,files},discovery);
  await store.saveContext(directory,{reportId:discovery.id,root:await fs.realpath('tests/fixtures/thematic-repo')});
  discoveryMode=true;const before=modelCalls;
  const discovered=await invoke({...payload,reportId:discovery.id,root:'/etc',files:['/etc/passwd']});
  assert.equal(modelCalls-before,2);assert.deepEqual(reads,['src/session.js']);assert.equal(discovered.report.themes[0].views[0].status,'ready');assert.deepEqual(discovered.files,['src/session.js']);assert.ok(!lastInput.includes('/etc/passwd'));
  console.log('Selected-view IPC validates sender/IDs, uses native snapshots, ignores client sources, checkpoints and skips ready views.');
 }finally{Module._load=realLoad;await fs.rm(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
