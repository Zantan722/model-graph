import type {Graph} from '../../lib/graph';
export function FlowNavigator({graph,selected,onSelect}:{graph:Graph;selected:string|null;onSelect:(id:string)=>void}){
 if(!graph.edges.length)return null;
 const index=graph.edges.findIndex(e=>e.id===selected),edge=graph.edges[index];
 const name=(id:string)=>graph.nodes.find(n=>n.id===id)?.name||id;
 return <details className="flow-navigator"><summary>逐步查看 Flow 關係{edge?` · ${index+1}/${graph.edges.length}`:''}</summary><p>依圖上的關係清單逐步定位；清單順序不代表實際執行順序。</p><div className="ai-actions"><button disabled={index<=0} onClick={()=>onSelect(graph.edges[index-1].id)}>上一條</button><button disabled={index===graph.edges.length-1} onClick={()=>onSelect(graph.edges[index+1].id)}>{index<0?'開始查看':'下一條'}</button></div><label>選擇關係<select aria-label="Flow 關係" value={edge?.id||''} onChange={e=>{if(e.target.value)onSelect(e.target.value);}}><option value="">尚未選取</option>{graph.edges.map((e,i)=><option key={e.id} value={e.id}>{i+1}. {name(e.source)} → {name(e.target)}：{e.label}</option>)}</select></label>{edge&&<p role="status">{name(edge.source)} → {name(edge.target)} · {edge.label}</p>}</details>;
}
