const fs=require('node:fs/promises');const path=require('node:path');const {createHash}=require('node:crypto');
const {types,levels,policyFor}=require('./views.cjs');
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const text=v=>typeof v==='string';
function validateReport(report){
 if(!report||![1,2].includes(report.version)||!validId(report.id)||!text(report.title)||!text(report.summary)||!text(report.project)||!Array.isArray(report.themes)||!report.coverage||!Array.isArray(report.coverage.read)||!Array.isArray(report.coverage.omitted))throw new Error('專案報告格式無效，原始檔案保留');
 const ids=new Set();
 for(const t of report.themes){
  const views=report.version===1?t?.stories:t?.views;
  if(!t||!text(t.id)||!text(t.title)||!text(t.question)||!text(t.rationale)||!Array.isArray(t.gaps)||!Array.isArray(views))throw new Error('主題資料損壞');
  for(const v of views){
   const items=report.version===1?v?.steps:v?.content?.items;
   if(!v||!text(v.id)||ids.has(v.id)||!text(v.title)||!types.includes(v.diagram)||!Array.isArray(items)||items.some(i=>!i||!text(i.title)||!text(i.description)||!Array.isArray(i.evidence)||i.evidence.some(e=>!e||!text(e.path)||!text(e.excerpt)))||(v.source!==undefined&&!text(v.source)))throw new Error('視圖資料損壞');
   for(const key of ['seedPaths','sourcePaths'])if(v[key]!==undefined&&(!Array.isArray(v[key])||v[key].some(p=>typeof p!=='string')))throw new Error('圖表來源欄位無效');
   ids.add(v.id);
   if(report.version===2){
    if(!text(v.summary)||!text(v.purpose)||!text(v.scope)||!text(v.uncertainty)||!levels.includes(v.level)||!['proposed','queued','generating','ready','failed'].includes(v.status))throw new Error('視圖欄位無效');
    if(!v.legacy&&(v.content.kind!==policyFor(v).kind||v.diagram!==report.diagram||v.diagram==='c4'&&v.level!==report.level))throw new Error('視圖圖種不符');
   }
  }
 }
 if(report.coverage.read.some(f=>!f||!text(f.path)||!text(f.sha256)))throw new Error('來源清單損壞');return report;
}
function normalizeReport(input){
 const report=structuredClone(validateReport(input));
 if(report.version===1){
  report.version=2;report.snapshotAvailable=false;report.legacy=true;
  report.themes=report.themes.map(t=>{const {stories,...rest}=t;return {...rest,views:stories.map(s=>{
   const {steps,flowStatus,...view}=s;
   return {...view,summary:s.summary||'',purpose:s.summary||s.title,scope:'舊版情境分析',uncertainty:s.uncertainty||'舊版報告',level:levels.includes(s.level)?s.level:'Container',legacy:true,status:s.source?'ready':'failed',content:{kind:'legacy',items:steps.map((i,n)=>({...i,id:`legacy-${n}`,type:'step'}))}};
  })};});
 }
 if(['running','generating'].includes(report.status)){report.status='interrupted';for(const v of report.themes.flatMap(t=>t.views)){if(v.status==='queued')v.status='proposed';if(v.status==='generating'){v.status='failed';v.error='上次產圖已中斷，可重新選擇';}}}
 return report;
}
async function atomic(destination,raw){const staging=destination+'.tmp';await fs.writeFile(staging,raw,{mode:0o600});await fs.rename(staging,destination);}
async function saveReport(directory,report){
 validateReport(report);const raw=JSON.stringify(report),archive=path.join(directory,'project-reports');await fs.mkdir(archive,{recursive:true});
 for(const destination of [path.join(archive,report.id+'.json'),path.join(directory,'last-project-report.json')])await atomic(destination,raw);
}
async function loadReport(directory,id){
 if(id!==undefined&&!validId(id))throw new Error('報告 ID 無效');
 try{return normalizeReport(JSON.parse(await fs.readFile(id?path.join(directory,'project-reports',id+'.json'):path.join(directory,'last-project-report.json'),'utf8')));}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
function validateSources(snapshot,report){
 if(!snapshot||snapshot.reportId!==report.id||!Array.isArray(snapshot.files))throw new Error('來源快照不符');
 const hashes=new Map(report.coverage.read.map(f=>[f.path,f.sha256]));const seen=new Set();
 for(const file of snapshot.files){if(!file||typeof file.path!=='string'||typeof file.content!=='string'||seen.has(file.path)||hashes.get(file.path)!==createHash('sha256').update(file.content).digest('hex'))throw new Error('來源快照與分析指紋不符，請重新分析');seen.add(file.path);}
 if(seen.size!==hashes.size)throw new Error('來源快照不完整');return snapshot.files;
}
async function saveSources(directory,snapshot,report){validateSources(snapshot,report);const dir=path.join(directory,'project-sources');await fs.mkdir(dir,{recursive:true});await atomic(path.join(dir,report.id+'.json'),JSON.stringify(snapshot));}
async function loadSources(directory,report){if(!validId(report.id))throw new Error('報告 ID 無效');try{return validateSources(JSON.parse(await fs.readFile(path.join(directory,'project-sources',report.id+'.json'),'utf8')),report);}catch(error){if(error.code==='ENOENT')throw new Error('找不到來源快照，請重新分析');throw error;}}
module.exports={saveReport,loadReport,validateReport,normalizeReport,saveSources,loadSources};

async function saveContext(directory,context){
 if(!validId(context.reportId)||!path.isAbsolute(context.root))throw new Error('資料夾參考無效');
 const dir=path.join(directory,'project-contexts');await fs.mkdir(dir,{recursive:true});await atomic(path.join(dir,context.reportId+'.json'),JSON.stringify(context));
}
async function loadContext(directory,id){
 if(!validId(id))throw new Error('圖表清單 ID 無效');
 const value=JSON.parse(await fs.readFile(path.join(directory,'project-contexts',id+'.json'),'utf8'));
 if(value.reportId!==id||typeof value.root!=='string'||!path.isAbsolute(value.root))throw new Error('資料夾參考無效');
 if(await fs.realpath(value.root)!==value.root)throw new Error('資料夾位置已變更，請重新選擇資料夾並列出候選圖');
 return value;
}
module.exports.saveContext=saveContext;module.exports.loadContext=loadContext;
