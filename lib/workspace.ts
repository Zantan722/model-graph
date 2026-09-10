import { diagramKeys } from './diagram-types';
import { initialGraph, parseGraph, type Graph } from './graph';
export const STORAGE_KEY='model-graph-v2';
export type WorkspaceLoad={graphs:Record<string,Graph>;raw:string|null;sourceKey:string;problems:string[]};
export function loadWorkspace(storage:Pick<Storage,'getItem'>):WorkspaceLoad {
 const graphs=Object.fromEntries(diagramKeys.map(key=>[key,initialGraph(key)]));
 let raw:string|null=null,sourceKey=STORAGE_KEY;
 try {
  raw=storage.getItem(STORAGE_KEY);
  if(raw===null){sourceKey='model-graph-v1';raw=storage.getItem(sourceKey);}
  if(raw===null)return {graphs,raw,sourceKey,problems:[]};
  const data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('儲存格式不正確');
  const problems:string[]=[];
  for(const key of diagramKeys){
   if(!Object.hasOwn(data,key))continue;
   try{graphs[key]=parseGraph(data[key]);}catch{problems.push(key);}
  }
  return {graphs,raw,sourceKey,problems};
 }catch{return {graphs,raw,sourceKey,problems:['無法讀取本機資料']};}
}
export function backupRecovery(storage:Pick<Storage,'setItem'|'getItem'>,recovery:WorkspaceLoad):string {
 if(recovery.raw===null)throw new Error('無法取得原始資料，請先匯出目前各張圖檔');
 const key=`model-graph-recovery-${crypto.randomUUID()}`;
 storage.setItem(key,recovery.raw);
 if(storage.getItem(key)!==recovery.raw)throw new Error('備份驗證失敗');
 return key;
}
