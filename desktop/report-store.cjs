const fs=require('node:fs/promises');const path=require('node:path');
function validateReport(report){
 if(!report||report.version!==1||typeof report.id!=='string'||!/^[a-f0-9-]{36}$/.test(report.id)||typeof report.title!=='string'||typeof report.summary!=='string'||typeof report.project!=='string'||!Array.isArray(report.themes)||!report.coverage||!Array.isArray(report.coverage.read)||!Array.isArray(report.coverage.omitted))throw new Error('專案報告格式無效，原始檔案保留');
 for(const t of report.themes){if(!t||typeof t.id!=='string'||typeof t.title!=='string'||typeof t.question!=='string'||typeof t.rationale!=='string'||!Array.isArray(t.gaps)||!Array.isArray(t.stories))throw new Error('主題資料損壞');for(const s of t.stories){if(!s||typeof s.id!=='string'||typeof s.title!=='string'||!['architecture','workflow','sequence','dataflow','lifecycle','c4'].includes(s.diagram)||!Array.isArray(s.steps)||s.steps.some(step=>!step||typeof step.title!=='string'||typeof step.description!=='string'||!Array.isArray(step.evidence)||step.evidence.some(e=>!e||typeof e.path!=='string'||typeof e.excerpt!=='string'))||(s.source!==undefined&&typeof s.source!=='string'))throw new Error('Story 資料損壞');}}
 if(report.coverage.read.some(f=>!f||typeof f.path!=='string'||typeof f.sha256!=='string'))throw new Error('來源清單損壞');return report;
}
async function saveReport(directory,report){
 validateReport(report);const raw=JSON.stringify(report),archive=path.join(directory,'project-reports');await fs.mkdir(archive,{recursive:true});
 for(const destination of [path.join(archive,report.id+'.json'),path.join(directory,'last-project-report.json')]){const staging=destination+'.tmp';await fs.writeFile(staging,raw);await fs.rename(staging,destination);}
}
async function loadReport(directory){
 try{const report=validateReport(JSON.parse(await fs.readFile(path.join(directory,'last-project-report.json'),'utf8')));if(report.status==='running')report.status='interrupted';return report;}catch(error){if(error.code==='ENOENT')return null;throw error;}
}
module.exports={saveReport,loadReport,validateReport};
