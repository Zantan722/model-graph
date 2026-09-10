const assert=require('node:assert/strict');
const Module=require('node:module');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const actualAI=require('../desktop/ai.cjs');
let root;const inputs=[];
const handlers=new Map();
const frame={url:'modelgraph://app/'};
const win={webContents:{mainFrame:frame}};
const event={sender:win.webContents,senderFrame:frame};
let resolveRun;let pending=false;
const realLoad=Module._load;
Module._load=function(name,...args){
 if(name==='electron')return {ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[root]})}};
 if(name==='./ai.cjs')return {...actualAI,discover:async()=>'/fake/codex',generationArgs:()=>[],run:async(_exe,_args,_input,options)=>{
   inputs.push(_input);
   if(_input.startsWith('Select source files'))return '["README.md"]';
   if(!pending)return '@startuml\ncomponent "API" as api\n@enduml';
   return new Promise((resolve,reject)=>{resolveRun=resolve;options.signal.addEventListener('abort',()=>reject(new Error('cancelled')));});
 }};
 return realLoad.call(this,name,...args);
};
const {installAI}=require('../desktop/ai-ipc.cjs');Module._load=realLoad;
installAI(()=>win);
const invoke=(name,payload,ev=event)=>handlers.get('ai:'+name)(ev,payload);
const req={provider:'codex',custom:'',model:'',prompt:'API',current:'@startuml\n@enduml',diagram:'architecture',level:'Container',selection:'',files:[]};
(async()=>{
 await assert.rejects(invoke('generate',req,{sender:{},senderFrame:frame}),/來源/);
 await assert.rejects(invoke('generate',req,{sender:win.webContents,senderFrame:{url:frame.url}}),/來源/);
 await assert.rejects(invoke('generate',{...req,provider:'shell'}),/參數/);
 const result=await invoke('generate',req);assert.match(result.source,/@modelgraph/);assert.match(result.source,/API/);
 root=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-project-test-'));
 try{
 await fs.writeFile(path.join(root,'README.md'),'Project API calls the database.');
 await invoke('folder');
 const project=await invoke('generate',{...req,prompt:'Draw database calls',useFolder:true});
 assert.deepEqual(project.files,['README.md']);
 assert.match(inputs.at(-2),/Draw database calls/);
 assert.match(inputs.at(-1),/Project API calls the database/);
 assert.match(inputs.at(-1),/Draw database calls/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
 pending=true;const first=invoke('generate',req);while(!resolveRun)await new Promise(r=>setTimeout(r,5));
 await assert.rejects(invoke('generate',req),/已有/);
 await invoke('cancel');await assert.rejects(first,/cancelled/);
 pending=false;assert.match((await invoke('generate',req)).source,/API/);
 console.log('AI IPC sender isolation, input validation, generation, metadata, single flight and cancellation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
