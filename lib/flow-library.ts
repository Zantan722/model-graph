import {importPuml} from './puml';
export type SavedFlow={id:string;title:string;project:string;source:string;createdAt:string};
export const FLOW_LIBRARY_KEY='modelgraph-flow-library-v1';
export function parseFlowLibrary(raw:string):SavedFlow[]{
 if(raw.length>2000000)throw new Error('流程庫上限 2 MB');
 const value=JSON.parse(raw);
 if(!value||value.version!==1||!Array.isArray(value.flows)||value.flows.length>20)throw new Error('流程庫格式無效（最多 20 份）');
 const ids=new Set<string>();
 return value.flows.map((f:SavedFlow)=>{
  if(!f||typeof f.id!=='string'||!f.id||f.id.length>100||ids.has(f.id)||typeof f.title!=='string'||!f.title.trim()||f.title.length>120||typeof f.project!=='string'||f.project.length>300||typeof f.createdAt!=='string'||!Number.isFinite(Date.parse(f.createdAt))||typeof f.source!=='string'||f.source.length>500000)throw new Error('流程庫項目格式無效');
  const result=importPuml(f.source);if(result.errors.length)throw new Error(`流程「${f.title}」的 PUML 無法解析`);
  ids.add(f.id);return {id:f.id,title:f.title,project:f.project,source:f.source,createdAt:f.createdAt};
 });
}
export function serializeFlowLibrary(flows:SavedFlow[]):string{
 const raw=JSON.stringify({version:1,flows});parseFlowLibrary(raw);return raw;
}
