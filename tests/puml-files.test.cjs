const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {fileAccess}=require('../desktop/puml-files.cjs');
(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mg-files-'));try{
 const file=path.join(dir,'drawing.puml');await fs.writeFile(file,'original');
 const api=fileAccess({getWindow:()=>null,dialog:{showOpenDialog:async()=>({filePaths:[file]}),showSaveDialog:async()=>({filePath:path.join(dir,'copy.puml')})}});
 const doc=await api.open();await assert.rejects(api.prepare({id:'/etc/passwd',source:'bad'}),/失效/);
 const plan=await api.prepare({id:doc.id,source:'changed'});assert.equal(plan.before,'original');assert.equal(await fs.readFile(file,'utf8'),'original');
 await fs.writeFile(file,'external change');await assert.rejects(api.save(plan.token),/原檔已變更/);assert.equal(await fs.readFile(file,'utf8'),'external change');
 const fresh=await api.open(),next=await api.prepare({id:fresh.id,source:'new contents'}),saved=await api.save(next.token);assert.equal(saved.source,'new contents');assert.equal(await fs.readFile(file,'utf8'),'new contents');
 await assert.rejects(api.save(next.token),/失效/);
 const copy=await api.prepare({source:'copy'});await api.cancel(copy.token);await assert.rejects(api.save(copy.token));
 console.log('PUML native open, preview-before-write, opaque handles, external conflicts, save and cancellation passed.');
 }finally{await fs.rm(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
