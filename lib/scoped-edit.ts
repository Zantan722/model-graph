import {parseGraph,type Graph} from './graph';
/** Match stable IDs first, unique names second; preserve unselected content in local edits. */
export function mergeScopedEdit(current:Graph,incoming:Graph,selected:string):Graph{
 const mapping=new Map(incoming.nodes.map(n=>{const same=current.nodes.find(o=>o.id===n.id);const named=current.nodes.filter(o=>o.name===n.name);return [n.id,same?.id||(named.length===1?named[0].id:n.id)];}));
 const nodes=incoming.nodes.map(n=>({...n,id:mapping.get(n.id)!}));
 const edges=incoming.edges.map(e=>({...e,source:mapping.get(e.source)||e.source,target:mapping.get(e.target)||e.target}));
 const selectedEdge=current.edges.find(e=>e.id===selected),isNode=current.nodes.some(n=>n.id===selected);
 if(!isNode&&!selectedEdge)throw new Error('選取範圍已變更，請重新選取後再修改');
 if(selectedEdge){
  const exact=edges.find(e=>e.id===selectedEdge.id),matches=edges.filter(e=>e.source===selectedEdge.source&&e.target===selectedEdge.target);
  const replacement=exact||(matches.length===1?matches[0]:null);if(!replacement)throw new Error('模型沒有明確回傳所選關係，請預覽 PUML 後再套用');
  return parseGraph({...current,edges:current.edges.map(e=>e.id===selected?{...replacement,id:e.id}:e)});
 }
 const affected=(e:Graph['edges'][number])=>e.source===selected||e.target===selected;
 const result:Graph={nodes:current.nodes.map(n=>{const changed=nodes.find(v=>v.id===n.id);return n.id===selected&&changed?{...changed,x:n.x,y:n.y}:n;}),edges:[],notes:current.notes};
 result.nodes.push(...nodes.filter(n=>!current.nodes.some(o=>o.id===n.id)));
 const remaining=edges.filter(affected);
 for(const old of current.edges){if(!affected(old)){result.edges.push(old);continue;}const index=remaining.findIndex(e=>e.id===old.id||(e.source===old.source&&e.target===old.target&&e.label===old.label));if(index>=0)result.edges.push({...remaining.splice(index,1)[0],id:old.id});}
 result.edges.push(...remaining);
 result.notes=[...current.notes.filter(n=>n.nodeId!==selected),...incoming.notes.map(n=>({...n,nodeId:mapping.get(n.nodeId)||n.nodeId})).filter(n=>n.nodeId===selected)];
 result.evidence=[...(current.evidence||[]),...(incoming.evidence||[])];
 return parseGraph(result);
}
