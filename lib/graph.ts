import { diagramTypes, kindNames, type DiagramType } from './diagram-types';
export type NodeKind = 'person' | 'system' | 'container' | 'component' | 'code' | 'database' | 'service' | 'external' | 'step' | 'decision' | 'start' | 'end' | 'participant' | 'source' | 'process' | 'sink' | 'state';
export type GraphNode = { id: string; name: string; description: string; technology: string; kind: NodeKind; x: number; y: number };
export type Edge = { id: string; source: string; target: string; label: string; messageType?: 'call' | 'return' };
export type Note = { id: string; nodeId: string; text: string; resolved: boolean };
export type SourceEvidence={target:string;path:string;startLine:number;endLine:number;excerpt:string};
export type Graph = { evidence?:SourceEvidence[]; nodes: GraphNode[]; edges: Edge[]; notes: Note[] };
export const uid = () => crypto.randomUUID();

export function initialGraph(level: string): Graph {
 if (level in diagramTypes && level !== 'c4') return initialDiagram(level as DiagramType);
 const names = level === 'Context' ? ['使用者','電商系統','金流服務','郵件服務'] : level === 'Container' ? ['使用者','Web Application','API Service','PostgreSQL','Redis Cache'] : level === 'Component' ? ['API Controller','Order Service','Payment Adapter','Order Repository'] : ['OrderController','OrderService','PaymentGateway','OrderRepository'];
 const positions = [[65,220],[365,220],[685,220],[685,455],[365,455]];
 const nodes = names.map((name,i):GraphNode => ({id:`n${i}`,name,description: ['瀏覽商品與建立訂單','提供系統主要操作介面','處理請求與核心業務邏輯','持久化儲存與外部整合','快取常用資料，降低存取延遲'][i],technology:level==='Container'?['Person','React · TypeScript','Node.js · REST','PostgreSQL','Redis'][i]:level==='Code'?'TypeScript':level,kind:level==='Code'?'code':level==='Component'?'component':i===0?'person':level==='Context'?'system':i>2?'database':'container',x:positions[i][0],y:positions[i][1]}));
 return {nodes,edges:nodes.slice(1).map((n,i)=>({id:`e${i}`,source:i===0?'n0':i===1?'n1':'n2',target:n.id,label:['使用','HTTPS / JSON','SQL · 讀寫','讀取 / 寫入'][i]})),notes:[]};
}
function initialDiagram(type: DiagramType): Graph {
 type Spec = [string,NodeKind,number,number,string];
 const specs: Record<string, Spec[]> = {
 architecture: [['Browser','person',40,180,'使用者端'],['API Gateway','service',370,180,'HTTPS · Routing'],['Order Service','service',700,180,'REST · Node.js'],['PostgreSQL','database',700,440,'訂單資料'],['Payment Provider','external',370,440,'外部金流']],
 workflow: [['開始','start',40,60,'Push to main'],['執行測試','step',370,60,'Build & test'],['測試通過？','decision',700,60,'檢查測試結果'],['部署正式環境','step',700,330,'Release'],['通知開發者','step',370,330,'修正後重試'],['結束','end',700,560,'Pipeline complete']],
 sequence: [['Browser','participant',40,60,'Client'],['API','participant',370,60,'Server'],['Database','participant',700,60,'Storage']],
 dataflow: [['應用事件','source',40,180,'JSON events'],['清理與驗證','process',370,180,'Validate · Transform'],['Data Warehouse','database',700,180,'分析資料'],['Dashboard','sink',700,440,'營運報表'],['異常事件','sink',370,440,'Rejected records']],
 lifecycle: [['開始','start',40,80,'建立訂單'],['待付款','state',370,80,'Pending'],['已付款','state',700,80,'Paid'],['配送中','state',700,330,'Shipping'],['已取消','state',370,330,'Cancelled'],['結束','end',700,590,'Closed']],
 };
 const nodes=specs[type].map(([name,kind,x,y,technology],i)=>({id:`n${i}`,name,kind,x,y,technology,description:''}));
 const links: Record<string, [number,number,string,('call'|'return')?][]> = {
 architecture:[[0,1,'HTTPS'],[1,2,'轉送請求'],[2,3,'SQL · 讀寫'],[2,4,'付款請求']],
 workflow:[[0,1,'提交程式碼'],[1,2,'測試結果'],[2,3,'通過'],[2,4,'失敗'],[4,1,'修正 / 重試'],[3,5,'部署完成']],
 sequence:[[0,1,'POST /login','call'],[1,2,'查詢使用者','call'],[2,1,'使用者資料','return'],[1,0,'200 OK · token','return']],
 dataflow:[[0,1,'原始事件'],[1,2,'有效事件'],[2,3,'彙總指標'],[1,4,'格式錯誤']],
 lifecycle:[[0,1,'訂單建立'],[1,2,'付款成功'],[1,4,'逾時 / 取消'],[2,3,'已出貨'],[3,5,'簽收'],[4,5,'關閉'],[1,1,'付款重試']],
 };
 return {nodes,edges:links[type].map(([s,t,label,messageType],i)=>({id:`e${i}`,source:`n${s}`,target:`n${t}`,label,...(messageType?{messageType}:{})})),notes:[]};
}
export function parseGraph(value: unknown): Graph {
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const str=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length<=max;
 const id=(v:unknown):v is string=>str(v,512)&&v.length>0;
 const coord=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1_000_000;
 if(!object(value)||!Array.isArray(value.nodes)||!Array.isArray(value.edges)||!Array.isArray(value.notes)||value.nodes.length>150||value.edges.length>500||value.notes.length>500)throw new Error('無效圖檔：最多 150 個節點、500 條關係與 500 則註解');
 const ids=new Set<string>(),edgeIds=new Set<string>(),noteIds=new Set<string>();
 const nodes:GraphNode[]=value.nodes.map(n=>{
  if(!object(n)||!id(n.id)||ids.has(n.id)||typeof n.kind!=='string'||!Object.hasOwn(kindNames,n.kind)||!str(n.name,2000)||!str(n.technology,4000)||!str(n.description,32000)||!coord(n.x)||!coord(n.y))throw new Error('節點格式不正確或內容超過上限');
  ids.add(n.id);return {id:n.id,name:n.name,technology:n.technology,description:n.description,kind:n.kind as NodeKind,x:n.x,y:n.y};
 });
 const edges:Edge[]=value.edges.map(e=>{
  if(!object(e)||!id(e.id)||edgeIds.has(e.id)||ids.has(e.id)||typeof e.source!=='string'||typeof e.target!=='string'||!ids.has(e.source)||!ids.has(e.target)||!str(e.label,4000)||(e.messageType!==undefined&&e.messageType!=='call'&&e.messageType!=='return'))throw new Error('關係格式不正確或內容超過上限');
  edgeIds.add(e.id);return {id:e.id,source:e.source,target:e.target,label:e.label,...(e.messageType?{messageType:e.messageType as 'call'|'return'}:{})};
 });
 const notes:Note[]=value.notes.map(n=>{
  if(!object(n)||!id(n.id)||noteIds.has(n.id)||typeof n.nodeId!=='string'||!ids.has(n.nodeId)||!str(n.text,32000)||typeof n.resolved!=='boolean')throw new Error('註解格式不正確或內容超過上限');
  noteIds.add(n.id);return {id:n.id,nodeId:n.nodeId,text:n.text,resolved:n.resolved};
 });
 const result:Graph={nodes,edges,notes};
 if(value.evidence!==undefined){
  if(!Array.isArray(value.evidence)||value.evidence.length>1000)throw new Error('來源摘錄格式錯誤');
  result.evidence=value.evidence.map(e=>{if(!object(e)||!str(e.target,5000)||!str(e.path,4096)||!str(e.excerpt,16000)||!Number.isInteger(e.startLine)||!Number.isInteger(e.endLine)||(e.startLine as number)<1||(e.endLine as number)<(e.startLine as number))throw new Error('來源摘錄格式錯誤');return {target:e.target,path:e.path,excerpt:e.excerpt,startLine:e.startLine as number,endLine:e.endLine as number};});
 }

 if(JSON.stringify(result).length>1_000_000)throw new Error('圖表內容超過 1 MB 上限');
 return result;
}
function inferKind(name:string,index:number,length:number,type:DiagramType):NodeKind {
 if(type==='sequence')return 'participant';
 if(type==='workflow'||type==='lifecycle'){
  if(/^(開始|起點|start)$/i.test(name))return 'start';
  if(/^(結束|終點|end)$/i.test(name))return 'end';
  return type==='lifecycle'?'state':/[?？]$/.test(name)?'decision':'step';
 }
 if(/database|sql|redis|warehouse|資料庫/i.test(name))return 'database';
 if(type==='dataflow')return index===0?'source':index===length-1?'sink':'process';
 return type==='c4'?'container':'service';
}
export function applyPrompt(graph: Graph, prompt: string, type: DiagramType = 'c4'): Graph {
 const g=structuredClone(graph);
 const chain=prompt.split(/\s*(?:->|→)\s*/).map(s=>s.trim()).filter(Boolean);
 if(chain.length>20)throw new Error('每次最多產生 20 個步驟');
 if(chain.length>1){
  const names=type==='sequence'?[...new Set(chain)]:chain;
  g.nodes=names.map((name,i)=>({id:uid(),name,description:'',technology:'',kind:inferKind(name,i,names.length,type),x:65+(type==='sequence'?i:i%3)*330,y:type==='sequence'?60:150+Math.floor(i/3)*240}));
  const visits=type==='sequence'?chain.map(name=>g.nodes[names.indexOf(name)]):g.nodes;
  g.edges=visits.slice(1).map((n,i)=>({id:uid(),source:visits[i].id,target:n.id,label:diagramTypes[type].relation,...(type==='sequence'?{messageType:'call' as const}:{})}));
  g.notes=[];return parseGraph(g);
 }
 const match=prompt.match(/^(?:新增|加入|增加|add)\s+(.+)$/i);
 if(match){if(g.nodes.length>=150)throw new Error('最多 150 個節點');g.nodes.push({id:uid(),name:match[1],description:'',technology:'',kind:inferKind(match[1],1,3,type),x:type==='sequence'?Math.max(0,...g.nodes.map(n=>n.x))+330:80+(g.nodes.length%3)*330,y:type==='sequence'?60:150+Math.floor(g.nodes.length/3)*240});return parseGraph(g);}
 throw new Error('本機模式支援「A → B → C」建立流程，或「新增 名稱」加入節點。自由文字生成需先接上 AI 服務。');
}

export function sequenceHeaderY(graph:Graph):number{return Math.min(60,...graph.nodes.map(n=>n.y));}
export function edgeGeometry(graph:Graph,edge:Edge,index:number,sequence:boolean){
 const a=graph.nodes.find(n=>n.id===edge.source)!,b=graph.nodes.find(n=>n.id===edge.target)!;
 if(sequence){const y=sequenceHeaderY(graph)+210+index*66,ax=a.x+120,bx=b.x+120;return {d:ax===bx?`M${ax},${y} h65 v28 h-65`:`M${ax},${y} H${bx}`,x:ax===bx?ax+40:(ax+bx)/2,y:y-12};}
 if(a.id===b.id)return {d:`M${a.x+90},${a.y} C${a.x+30},${a.y-90} ${a.x+210},${a.y-90} ${a.x+150},${a.y}`,x:a.x+120,y:a.y-63};
 const horizontal=Math.abs(b.x-a.x)>Math.abs(b.y-a.y),forward=horizontal?b.x>a.x:b.y>a.y;
 const ax=a.x+(horizontal?(forward?240:0):120),ay=a.y+(horizontal?66:(forward?132:0)),bx=b.x+(horizontal?(forward?0:240):120),by=b.y+(horizontal?66:(forward?0:132));
 return {d:horizontal?`M${ax},${ay} C${(ax+bx)/2},${ay} ${(ax+bx)/2},${by} ${bx},${by}`:`M${ax},${ay} C${ax},${(ay+by)/2} ${bx},${(ay+by)/2} ${bx},${by}`,x:(ax+bx)/2,y:(ay+by)/2-12};
}
