const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto');
const hash=s=>createHash('sha256').update(s).digest('hex');
function fileAccess({dialog,getWindow}){
 const documents=new Map(),plans=new Map();
 const valid=s=>typeof s==='string'&&Buffer.byteLength(s)<=2000000;
 return {
  async open(){const r=await dialog.showOpenDialog(getWindow(),{properties:['openFile'],filters:[{name:'PlantUML',extensions:['puml','plantuml','pu']}]});if(r.canceled)return null;
   const filename=await fs.realpath(r.filePaths[0]);if((await fs.stat(filename)).size>2000000)throw new Error('PUML 上限 2 MB');const source=await fs.readFile(filename,'utf8'),id=randomUUID();documents.set(id,{filename,hash:hash(source)});return {id,name:path.basename(filename),source};},
  async prepare(request){if(!request||!valid(request.source))throw new Error('PUML 內容無效或超過 2 MB');let doc=request.id&&documents.get(request.id);
   if(request.id&&!doc)throw new Error('檔案參考已失效，請重新開啟');
   if(!doc){const r=await dialog.showSaveDialog(getWindow(),{defaultPath:'diagram.puml',filters:[{name:'PlantUML',extensions:['puml']}]});if(r.canceled)return null;const filename=r.filePath;let before=null;try{before=await fs.readFile(filename,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}doc={filename,hash:before===null?null:hash(before)};}
   let before=null;try{before=await fs.readFile(doc.filename,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
   if((before===null?null:hash(before))!==doc.hash)throw new Error('原檔已被其他程式修改，請重新開啟或另存新檔');
   const token=randomUUID();plans.set(token,{...doc,source:request.source});return {token,name:path.basename(doc.filename),before:before||'',after:request.source};},
  async save(token){const plan=plans.get(token);if(!plan)throw new Error('儲存預覽已失效');let before=null;try{before=await fs.readFile(plan.filename,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
   if((before===null?null:hash(before))!==plan.hash)throw new Error('原檔已變更，未覆寫；請重新開啟或另存新檔');
   const staging=plan.filename+'.modelgraph-'+randomUUID()+'.tmp';try{await fs.writeFile(staging,plan.source,{flag:'wx',mode:0o600});await fs.rename(staging,plan.filename);}finally{await fs.rm(staging,{force:true});}
   plans.delete(token);const id=randomUUID();documents.set(id,{filename:plan.filename,hash:hash(plan.source)});return {id,name:path.basename(plan.filename),source:plan.source};},
  cancel(token){plans.delete(token);return true;}
 };
}
module.exports={fileAccess};
