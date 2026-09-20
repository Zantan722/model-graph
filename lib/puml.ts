import { diagramTypes, kindNames, levels, type DiagramType } from './diagram-types';
import { parseGraph, uid, type Graph, type GraphNode, type NodeKind, type Edge } from './graph';

export type PumlIssue = { line: number; message: string };
export type PumlResult = { graph: Graph; diagram: DiagramType; level: string; errors: PumlIssue[]; warnings: PumlIssue[] };
const textOut = (s: string) => s.replace(/</g,'<U+003C>').replace(/\\/g,'<U+005C>').replace(/"/g,'<U+0022>').replace(/\r\n?|\n/g,'\\n');
const quoted = (s: string) => `"${textOut(s)}"`;
const textIn = (s: string) => s.replace(/\\n/g,'\n').replace(/\\"/g,'"').replace(/<U\+([\dA-F]{4,6})>/gi,(_,hex:string)=>{const point=parseInt(hex,16);return point<=0x10ffff?String.fromCodePoint(point):_;});
const bare = (s: string) => textIn(s.startsWith('"')&&s.endsWith('"')?s.slice(1,-1):s.startsWith('[')&&s.endsWith(']')?s.slice(1,-1):s);
const token = '(?:"(?:\\\\.|[^"\\\\])*"|\\[[^\\]\\r\\n]+\\]|[\\p{L}\\p{N}_.$]+)';

/** Canonical PUML. Comments carry editor-only properties, never replace parsed topology. */
export function exportPuml(graph: Graph, diagram: DiagramType, level='Container'): string {
 parseGraph(graph);
 const aliases=new Map(graph.nodes.map((n,i)=>[n.id,`mg_${i}`]));
 const lines=['@startuml',`' @modelgraph ${JSON.stringify({version:1,diagram,level})}`];
 if(graph.evidence?.length)for(const evidence of graph.evidence)lines.push(`' @modelgraph-evidence ${JSON.stringify(evidence)}`);
 if(diagram==='c4'&&level!=='Code')lines.push('!include <C4/C4_Component>');
 if(diagram!=='sequence'&&diagram!=='c4')lines.push('left to right direction');
 if(diagram==='workflow')lines.push("' Workflow exported as an explicit state graph to preserve arbitrary branches and loops.");
 for(const n of graph.nodes){
  const alias=aliases.get(n.id)!;
  lines.push(`' @modelgraph-node ${alias} ${JSON.stringify({id:n.id,kind:n.kind,x:n.x,y:n.y,technology:n.technology,description:n.description})}`);
  if(diagram==='c4'&&level!=='Code'){
   const fn=n.kind==='person'?'Person':n.kind==='system'?'System':n.kind==='external'?'System_Ext':n.kind==='database'?'ContainerDb':n.kind==='component'?'Component':'Container';
   const args=[alias,quoted(n.name),...(['Person','System','System_Ext'].includes(fn)?[quoted(n.description)]:[quoted(n.technology),quoted(n.description)])];
   lines.push(`${fn}(${args.join(', ')})`);
  }else if(diagram==='sequence')lines.push(`participant ${quoted(n.name)} as ${alias}`);
  else if(diagram==='lifecycle'||diagram==='workflow')lines.push(`state ${quoted(n.name)} as ${alias}${n.kind==='decision'?' <<choice>>':n.kind==='start'?' <<start>>':n.kind==='end'?' <<end>>':''}`);
  else{const type=n.kind==='person'?'actor':n.kind==='database'?'database':n.kind==='code'?'class':n.kind==='external'?'cloud':['source','sink','process'].includes(n.kind)?'rectangle':'component';lines.push(`${type} ${quoted(n.name)} as ${alias}`);}
 }
 lines.push('');
 for(const e of graph.edges){
  const a=aliases.get(e.source)!,b=aliases.get(e.target)!;
  lines.push(`' @modelgraph-edge ${JSON.stringify({id:e.id,...(e.messageType?{messageType:e.messageType}:{})})}`);
  lines.push(diagram==='c4'&&level!=='Code'?`Rel(${a}, ${b}, ${quoted(e.label)})`:`${a} ${e.messageType==='return'?'-->':diagram==='sequence'?'->':'-->'} ${b}${e.label?` : ${textOut(e.label)}`:''}`);
 }
 for(const n of graph.notes){lines.push(`' @modelgraph-note ${JSON.stringify({id:n.id,resolved:n.resolved})}`,`note right of ${aliases.get(n.nodeId)} : ${textOut(n.text)}`);}
 lines.push('@enduml');return lines.join('\n')+'\n';
}

export function importPuml(source: string, preferred: DiagramType|'auto'='auto'): PumlResult {
 const errors:PumlIssue[]=[],warnings:PumlIssue[]=[];
 const warn=(line:number,message:string)=>{if(warnings.length<100)warnings.push({line,message});};
 const fail=(line:number,message:string)=>{if(errors.length<100)errors.push({line,message});};
 
 let diagram:DiagramType='sequence',level='Container';
 const graph:Graph={nodes:[],edges:[],notes:[]};
 if(source.length>2_000_000)return {graph,diagram,level,errors:[{line:1,message:'PUML 上限 2 MB'}],warnings};
 const raw=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 if(raw.length>20000||raw.some(l=>l.length>64000))return {graph,diagram,level,errors:[{line:1,message:'最多 20,000 行，每行最多 64,000 字元'}],warnings};
 let header: {diagram?:DiagramType;level?:string}={};
 const metaLine=raw.find(l=>/^\s*' @modelgraph /.test(l));
 if(metaLine)try{const parsed=JSON.parse(metaLine.replace(/^\s*' @modelgraph /,''));if(!parsed||typeof parsed!=='object')throw new Error();header=parsed;}catch{warn(1,'無法讀取 Model Graph 圖表設定');}
 const body=raw.filter(l=>!/^\s*'/.test(l)).join('\n');
 if(typeof header.diagram==='string'&&Object.hasOwn(diagramTypes,header.diagram))diagram=header.diagram;
 else if(/^\s*(?:Person|System|Container|Component)(?:Db|_Ext)?\s*\(/m.test(body)||/!include[^\n]*C4_/i.test(body))diagram='c4';
 else if(/^\s*(?:start|stop|end)\s*$|^\s*:[^\n]*;\s*$|^\s*if\s*\(/m.test(body))diagram='workflow';
 else if(/^\s*state\b|\[\*\]/m.test(body))diagram='lifecycle';
 else if(/^\s*(?:component|rectangle|node|cloud|interface|class|package)\b|^\s*\[[^*]/m.test(body))diagram='architecture';
 if(preferred!=='auto')diagram=preferred;
 if(header.level&&levels.includes(header.level))level=header.level;
 else if(/C4_Component|^\s*Component\s*\(/m.test(body))level='Component';
 else if(/C4_Context/.test(body))level='Context';
 const names=new Map<string,GraphNode>();
 const nodeMeta=new Map<string,Partial<GraphNode>>();
 let edgeMeta:Partial<Edge>={},noteMeta:{id?:string;resolved?:boolean}={};
 const ensure=(alias:string,kind:NodeKind=diagram==='sequence'?'participant':diagram==='workflow'?'step':diagram==='lifecycle'?'state':diagram==='c4'?'system':'service',name?:string)=>{
  alias=bare(alias);
  const exists=names.get(alias);if(exists)return exists;
  const i=graph.nodes.length,meta=nodeMeta.get(alias)||{};
  const n:GraphNode={id:typeof meta.id==='string'?meta.id:uid(),kind:typeof meta.kind==='string'&&Object.hasOwn(kindNames,meta.kind)?meta.kind:kind,name:name===undefined?alias:bare(name),description:typeof meta.description==='string'?meta.description:'',technology:typeof meta.technology==='string'?meta.technology:'',x:Number.isFinite(meta.x)?meta.x!:60+(diagram==='sequence'?i:i%3)*330,y:Number.isFinite(meta.y)?meta.y!:diagram==='sequence'?60:100+Math.floor(i/3)*240};
  names.set(alias,n);graph.nodes.push(n);return n;
 };
 const addEdge=(a:GraphNode,b:GraphNode,label:string,returned=false,decoded=false)=>{graph.edges.push({id:typeof edgeMeta.id==='string'?edgeMeta.id:uid(),source:a.id,target:b.id,label:decoded?label:textIn(label),...(diagram==='sequence'?{messageType:returned?'return' as const:'call' as const}:edgeMeta.messageType?{messageType:edgeMeta.messageType}:{})});edgeMeta={};};
 let active=false,finished=false,blockComment=false,skinDepth=0;
 let frontier:{node:GraphNode;label:string}[]=[];
 type Branch={kind:'if'|'while';node:GraphNode;yes:{node:GraphNode;label:string}[];hasElse:boolean;line:number};
 const branches:Branch[]=[];
 const step=(name:string,kind:NodeKind)=>{const n=ensure(`activity_${graph.nodes.length}`,kind,quoted(name));for(const f of frontier)addEdge(f.node,n,f.label);frontier=kind==='end'?[]:[{node:n,label:''}];return n;};
 for(let i=0;i<raw.length;i++){
  let line=raw[i].trim();const at=i+1;
  if(errors.length>=100){fail(at,'錯誤過多，停止解析');break;}
  if(graph.nodes.length>150||graph.edges.length>500||graph.notes.length>500){fail(at,'超過 150 個節點或 500 條關係上限');break;}
  if(blockComment){if(line.includes("'/"))blockComment=false;continue;}
  if(line.startsWith("/'")){if(!line.slice(2).includes("'/"))blockComment=true;continue;}
  if(!line)continue;
  if(/^@startuml(?:\s+\S+)?$/i.test(line)){if(active||finished)fail(at,'一次只能匯入一個 @startuml 區塊');active=true;continue;}
  if(/^@enduml$/i.test(line)){if(!active)fail(at,'缺少 @startuml');active=false;finished=true;continue;}
  if(line.startsWith("'")){
   try{
    const evidence=line.match(/^' @modelgraph-evidence (.+)$/);if(evidence){(graph.evidence??=[]).push(JSON.parse(evidence[1]));continue;}
    let m=line.match(/^' @modelgraph-node (\S+) (.+)$/);if(m){nodeMeta.set(m[1],JSON.parse(m[2]));continue;}
    m=line.match(/^' @modelgraph-edge (.+)$/);if(m){const parsed=JSON.parse(m[1]);if(!parsed||typeof parsed!=='object')throw new Error();edgeMeta=parsed;continue;}
    m=line.match(/^' @modelgraph-note (.+)$/);if(m){const parsed=JSON.parse(m[1]);if(!parsed||typeof parsed!=='object')throw new Error();noteMeta=parsed;continue;}
   }catch{warn(at,'編輯器附加資料格式錯誤，將使用預設值');}continue;
  }
  if(!active){fail(at,'內容必須位於 @startuml 與 @enduml 之間');continue;}
  if(skinDepth){skinDepth+=(line.match(/\{/g)||[]).length-(line.match(/\}/g)||[]).length;continue;}
  if(/^skinparam\b/i.test(line)){warn(at,'skinparam 樣式不會套用到畫布，匯出會使用標準格式');skinDepth=(line.match(/\{/g)||[]).length-(line.match(/\}/g)||[]).length;continue;}
  if(/^!include\s+(?:<C4\/C4_(?:Context|Container|Component)>|https:\/\/raw\.githubusercontent\.com\/plantuml-stdlib\/C4-PlantUML\/(?:master|[\w.-]+)\/C4_(?:Context|Container|Component)\.puml)$/i.test(line))continue;
  if(/^!/.test(line)){fail(at,'尚未支援這個 include／前處理指令；不會執行或讀取外部檔案');continue;}
  if(/^(?:left to right direction|top to bottom direction|hide footbox|autonumber(?:\s+\d+(?:\s+\d+)?)?|LAYOUT_TOP_DOWN\(\)|LAYOUT_LEFT_RIGHT\(\)|SHOW_LEGEND\(\))$/i.test(line)){if(!/^left to right direction$/i.test(line))warn(at,'此版面／編號指令將由畫布的排列方式取代');continue;}
  if(/^(?:title|caption|footer|header)\s+.+$/i.test(line)){warn(at,'標題／頁首頁尾不會保留在畫布匯出中');continue;}
  if(/^note\b/i.test(line)){
   const m=line.match(new RegExp(`^note (?:right|left|top|bottom) of (${token})(?:\\s*:\\s*(.*))?$`,'iu'));
   if(!m){fail(at,'目前只支援綁定單一節點的 note right/left/top/bottom of');continue;}
   let content=m[2];if(content===undefined){const parts:string[]=[];while(i+1<raw.length&&!/^\s*end\s*note\s*$/i.test(raw[i+1]))parts.push(raw[++i]);if(i+1>=raw.length){fail(at,'note 缺少 end note');break;}i++;content=parts.join('\n');}
   const target=names.get(bare(m[1]));if(!target){fail(at,'註解的節點尚未宣告');continue;}
   graph.notes.push({id:typeof noteMeta.id==='string'?noteMeta.id:uid(),nodeId:target.id,text:textIn(content),resolved:noteMeta.resolved===true});noteMeta={};continue;
  }
  if(diagram==='workflow'){
   if(/^start$/i.test(line)){step('開始','start');continue;}
   if(/^(stop|end)$/i.test(line)){step('結束','end');continue;}
   if(line.startsWith(':')){while(!line.endsWith(';')&&i+1<raw.length&&!/^\s*@enduml/.test(raw[i+1]))line+='\n'+raw[++i];if(!line.endsWith(';'))fail(at,'活動步驟缺少結尾分號 ;');else step(textIn(line.slice(1,-1)),'step');continue;}
   let m=line.match(/^if\s*\((.*)\)\s*then(?:\s*\((.*)\))?$/i);
   if(m){const n=step(textIn(m[1]),'decision');branches.push({kind:'if',node:n,yes:[],hasElse:false,line:at});frontier=[{node:n,label:m[2]||'yes'}];continue;}
   m=line.match(/^else(?:\s*\((.*)\))?$/i);
   if(m){const b=branches.at(-1);if(!b||b.kind!=='if'||b.hasElse)fail(at,'else 找不到對應的 if');else{b.yes=frontier;b.hasElse=true;frontier=[{node:b.node,label:m[1]||'no'}];}continue;}
   if(/^endif$/i.test(line)){const b=branches.pop();if(!b||b.kind!=='if')fail(at,'endif 找不到對應的 if');else frontier=b.hasElse?[...b.yes,...frontier]:[...frontier,{node:b.node,label:'no'}];continue;}
   m=line.match(/^while\s*\((.*)\)(?:\s*is\s*\((.*)\))?$/i);
   if(m){const n=step(textIn(m[1]),'decision');branches.push({kind:'while',node:n,yes:[],hasElse:false,line:at});frontier=[{node:n,label:m[2]||'yes'}];continue;}
   m=line.match(/^endwhile(?:\s*\((.*)\))?$/i);
   if(m){const b=branches.pop();if(!b||b.kind!=='while')fail(at,'endwhile 找不到對應的 while');else{for(const f of frontier)addEdge(f.node,b.node,f.label);frontier=[{node:b.node,label:m[1]||'no'}];}continue;}
  }
  const macro=line.match(/^(Person(?:_Ext)?|System(?:Db|_Ext)?|Container(?:Db|_Ext)?|Component(?:Db|_Ext)?|Rel(?:_[LRUD])?)\((.*)\)$/i);
  if(macro){
   const args=splitArgs(macro[2]);if(!args){fail(at,'C4 巨集參數引號不完整');continue;}
   const fn=macro[1].toLowerCase();
   if(fn.startsWith('rel')){if(args.length<3||args.length>4){fail(at,'Rel 目前支援起點、終點、說明與可選技術');continue;}const a=names.get(bare(args[0])),b=names.get(bare(args[1]));if(!a||!b){fail(at,'Rel 的起點或終點尚未宣告');continue;}addEdge(a,b,bare(args[2])+(args[3]?` [${bare(args[3])}]`:''),false,true);}
   else {const detailed=/^(container|component)/.test(fn);if(args.length<2||args.length>(detailed?4:3)||args.some(a=>/^\$/.test(a))){fail(at,'目前支援 C4 的位置參數：alias、名稱、技術、描述');continue;}const kind:NodeKind=fn.includes('db')?'database':fn.startsWith('person')?'person':fn.startsWith('system')?'system':fn.startsWith('component')?'component':'container';const n=ensure(args[0],kind,args[1]);n.name=bare(args[1]);if(detailed)n.technology=bare(args[2]||'');n.description=bare(args[detailed?3:2]||'');if(fn.endsWith('_ext'))warn(at,'外部元素會保留內容，但目前畫布不呈現 C4 外部樣式');}
   continue;
  }
  const declaration=line.match(new RegExp(`^(participant|actor|boundary|control|entity|database|collections|queue|component|rectangle|node|cloud|interface|class|state)\\s+(${token})(?:\\s+as\\s+(${token}))?(?:\\s+<<([^>]+)>>)?$`,'iu'));
  const bracket=!declaration?line.match(new RegExp(`^(\\[[^\\]]+\\])(?:\\s+as\\s+(${token}))?$`,'u')):null;
  if(declaration||bracket){
   const [,type,first,second,stereo]=declaration||['','component',bracket![1],bracket![2],undefined];
   const reversed=second?.startsWith('"')&&!first.startsWith('"');const alias=second?(reversed?first:second):first,name=reversed?second:first;
   const kinds:Record<string,NodeKind>={actor:'person',database:'database',component:'service',rectangle:diagram==='dataflow'?'process':'service',node:'service',cloud:'external',interface:'service',class:'code',state:'state'};
   const kind:NodeKind=diagram==='sequence'?'participant':stereo==='choice'?'decision':stereo==='start'?'start':stereo==='end'?'end':kinds[type.toLowerCase()]||'service';
   if(stereo&&!['choice','start','end'].includes(stereo))warn(at,`stereotype <<${stereo}>> 不會保留`);
   const n=ensure(alias!,kind,name);n.name=bare(name!);if(!nodeMeta.get(bare(alias!))?.kind)n.kind=kind;continue;
  }
  const arrow=line.match(new RegExp(`^(${token}|\\[\\*\\])\\s*(<[-.]+|[-.]+(?:left|right|up|down)?[-.]*>{1,2})\\s*(${token}|\\[\\*\\])(?:\\s*:\\s*(.*))?$`,'iu'));
  if(arrow){
   let [,from,style,to,label='']=arrow;if(style.startsWith('<'))[from,to]=[to,from];
   const a=from==='[*]'?ensure('__start','start','開始'):ensure(from),b=to==='[*]'?ensure('__end','end','結束'):ensure(to);
   addEdge(a,b,label,style.startsWith('<')?style.length>2:style.startsWith('--')||style.includes('.'));continue;
  }
  const description=line.match(new RegExp(`^(${token})\\s*:\\s*(.+)$`,'u'));
  if(description&&diagram==='lifecycle'){const n=ensure(description[1]);n.description+=(n.description?'\n':'')+textIn(description[2]);continue;}
  fail(at,`尚未支援或語法不完整：${line.slice(0,100)}`);
 }
 if(active||!finished)fail(raw.length,'缺少 @enduml');
 if(blockComment)fail(raw.length,'區塊註解未關閉');
 if(skinDepth)fail(raw.length,'skinparam 區塊未關閉');
 for(const b of branches)fail(b.line,`${b.kind} 區塊未關閉`);
 if(!graph.nodes.length&&!errors.length)warn(1,'這是一張空白圖');
 try{const clean=parseGraph(graph);Object.assign(graph,clean);}catch(e){fail(1,(e as Error).message);}
 if(diagram==='workflow'&&!errors.length)warn(1,'匯出將轉為明確的 state 節點／箭頭語法，以保留畫布上的分支與迴圈；不保留原始 activity 排版');
 return {graph,diagram,level,errors,warnings};
}
function splitArgs(input:string):string[]|null {
 const args:string[]=[];let part='',inside=false,escaped=false;
 for(const c of input){if(c==='"'&&!escaped)inside=!inside;if(c===','&&!inside){args.push(part.trim());part='';}else part+=c;if(c==='\\'&&!escaped)escaped=true;else escaped=false;}
 if(inside)return null;args.push(part.trim());return args;
}

const MACRO_CALL=/^([\p{L}_][\p{L}\p{N}_]*)\((.*)\)(\s*\{)?$/u;
const RELATION=/^(?:Rel(?:_[LRUD])?\(|.*(?:-{1,2}\[?[#\w]*\]?-{0,2}>{1,2}|<-{1,2}|\.{2,}>))/;
const isMeta=(line:string)=>/^' @modelgraph/.test(line);

/** Layout only: never reorders or rewrites declarations, so a formatted file parses to the same graph. */
export function formatPuml(source: string): string {
 const raw=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n').map(l=>l.trim());
 const out:string[]=[];let depth=0,seenRelation=false,blank=false;
 const push=(line:string)=>out.push('  '.repeat(Math.max(0,depth))+line);
 // A @modelgraph comment carries the ids and coordinates of the line below it; a blank must go above the pair.
 const separate=()=>{let at=out.length;while(at>0&&isMeta(out[at-1].trim()))at--;if(at>0&&out[at-1]!=='')out.splice(at,0,'');};
 for(const line of raw){
  if(!line){blank=out.length>0;continue;}
  const macro=line.match(MACRO_CALL);
  const body=macro?`${macro[1]}(${(splitArgs(macro[2])??[macro[2]]).join(', ')})${macro[3]?' {':''}`:line;
  if(/^\}/.test(body))depth--;
  const relation=RELATION.test(body)&&!isMeta(body)&&!/^\}/.test(body);
  // Canonical export separates declarations from relations with one blank line; mirror it.
  if(relation&&!seenRelation&&out.length){separate();blank=false;}
  else if(blank)separate();
  blank=false;seenRelation||=relation;
  push(body);
  if(/\{$/.test(body))depth++;
 }
 return out.join('\n').replace(/\n{3,}/g,'\n\n').replace(/\s+$/,'')+'\n';
}
