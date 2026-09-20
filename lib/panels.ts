export type Panels={top:boolean;left:boolean;right:boolean};
export const PANELS_KEY='modelgraph-panels-v1';
export const ALL_OPEN:Panels={top:true,left:true,right:true};
export const ALL_CLOSED:Panels={top:false,left:false,right:false};
export const allClosed=(panels:Panels)=>!panels.top&&!panels.left&&!panels.right;

/** Never let a corrupt value hide the whole UI; fall back to everything open. */
export function loadPanels(raw:string|null):Panels{
 if(!raw)return ALL_OPEN;
 try{
  const data=JSON.parse(raw);
  if(!data||typeof data!=='object'||Array.isArray(data))return ALL_OPEN;
  const pick=(key:keyof Panels)=>typeof data[key]==='boolean'?data[key] as boolean:true;
  return {top:pick('top'),left:pick('left'),right:pick('right')};
 }catch{return ALL_OPEN;}
}
export function storePanels(storage:Pick<Storage,'setItem'>,panels:Panels){
 try{storage.setItem(PANELS_KEY,JSON.stringify(panels));}catch{/* layout preference is disposable */}
}
export function workspaceClass(panels:Panels,report:boolean):string{
 return ['workspace',report?'show-report':'',panels.left?'':'no-left',panels.right?'':'no-right'].filter(Boolean).join(' ');
}
