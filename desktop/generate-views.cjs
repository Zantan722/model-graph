const ai=require('./ai.cjs');
const {policyFor,validateDiagram}=require('./views.cjs');
function selectedViews(report,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>72||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))throw new Error('請選擇有效且不重複的視圖');
 const all=report.themes.flatMap(t=>t.views);
 if(ids.some(id=>!all.some(v=>v.id===id)))throw new Error('所選視圖不屬於此報告');
 return all.filter(v=>ids.includes(v.id)&&v.status!=='ready');
}
async function generateViews({report,ids,files,ask,signal,validatePuml,onProgress=()=>{},onCheckpoint=async()=>{}}){
 const selected=selectedViews(report,ids);if(!selected.length)return report;
 if(!report.snapshotAvailable)throw new Error('此報告沒有來源快照，請重新分析');
 const byPath=new Map(files.map(f=>[f.path,f]));
 report.status='generating';delete report.error;
 selected.forEach(v=>{v.status='queued';delete v.error;});
 await onCheckpoint(structuredClone(report));
 try{
  for(const view of selected){
   signal?.throwIfAborted();view.status='generating';
   onProgress({phase:'view',message:`產生所選視圖：${view.title}（${selected.indexOf(view)+1}/${selected.length}）`});await onCheckpoint(structuredClone(report));
   const names=[...new Set(view.content.items.flatMap(i=>i.evidence.map(e=>e.path)))];
   let failure;
   for(let attempt=0;attempt<2;attempt++){
    try{
     if(names.some(n=>!byPath.has(n)))throw new Error('視圖來源快照不完整，請重新分析');
     const prompt=ai.makePrompt({diagram:view.diagram,level:view.diagram==='c4'?view.level:'not-applicable',current:'@startuml\n@enduml',selection:'',prompt:`Draw ONLY this selected view. ${policyFor(view).guide} Preserve stable code identifiers and meaningful relationship labels; focus on this scope, avoid low-value decorative nodes. Structural elements are NOT story steps. VIEW: ${JSON.stringify(view)}. ${failure?`Repair previous invalid output: ${failure.message}. Previous draft: ${view.draftSource||''}`:''}`},names.map(n=>byPath.get(n)));
     const output=await ask(prompt);signal?.throwIfAborted();view.draftSource=output;
     const {source,parsed}=validateDiagram(output,view,validatePuml);
     view.source=source;view.status='ready';view.warnings=parsed.warnings;delete view.draftSource;failure=null;break;
    }catch(error){if(signal?.aborted)throw error;failure=error;}
   }
   if(failure){view.status='failed';view.error=failure.message;}
   await onCheckpoint(structuredClone(report));
  }
 }catch(error){report.error=error.message;report.status=signal?.aborted?'cancelled':'partial';}
 for(const view of selected){if(view.status==='queued')view.status='proposed';if(view.status==='generating'){view.status='failed';view.error='此圖在完成前中止，可重新勾選重試';}}
 if(report.status==='generating'){
  const allReady=report.themes.flatMap(t=>t.views).every(v=>v.status==='ready');
  report.status=selected.some(v=>v.status==='failed')?'partial':allReady?(report.themes.every(t=>['described','complete'].includes(t.status))?'complete':'partial'):'awaiting_selection';
 }
 await onCheckpoint(structuredClone(report));
 onProgress({phase:'done',message:`本批完成 ${selected.filter(v=>v.status==='ready').length}/${selected.length} 張；未選視圖保持未產生。`});return report;
}
module.exports={generateViews,selectedViews};
