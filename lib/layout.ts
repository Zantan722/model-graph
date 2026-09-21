import {type Graph,type GraphNode} from './graph';
import {type DiagramType} from './diagram-types';

// Node boxes are 240x132; these steps keep the gutters the manual grid already used.
export const COLUMN=330,ROW=240,ORIGIN_X=60,ORIGIN_Y=100,SEQUENCE_Y=60;
const SWEEPS=4;

type Link={source:string;target:string};
/** Self loops and repeats carry no layout information and would skew every barycenter. */
function links(graph:Graph):Link[]{
 const seen=new Set<string>(),out:Link[]=[];
 for(const e of graph.edges){
  if(e.source===e.target)continue;
  const key=`${e.source}>${e.target}`;if(seen.has(key))continue;
  seen.add(key);out.push({source:e.source,target:e.target});
 }
 return out;
}
const group=(ids:string[])=>new Map(ids.map(id=>[id,[] as string[]]));

/** Depth-first back edges. Reversing them only for layering keeps cyclic workflows layerable. */
function acyclic(ids:string[],all:Link[]):Link[]{
 const out=group(ids);for(const l of all)out.get(l.source)!.push(l.target);
 const state=new Map(ids.map(id=>[id,0])),back=new Set<string>();
 const visit=(id:string)=>{
  state.set(id,1);
  for(const next of out.get(id)!){const s=state.get(next);if(s===1)back.add(`${id}>${next}`);else if(s===0)visit(next);}
  state.set(id,2);
 };
 for(const id of ids)if(state.get(id)===0)visit(id);
 return all.filter(l=>!back.has(`${l.source}>${l.target}`));
}

/** Longest path layering over a topological order; declaration order breaks every tie. */
function layers(ids:string[],dag:Link[]):string[][]{
 const out=group(ids),degree=new Map(ids.map(id=>[id,0]));
 for(const l of dag){out.get(l.source)!.push(l.target);degree.set(l.target,degree.get(l.target)!+1);}
 const queue=ids.filter(id=>!degree.get(id)),depth=new Map(ids.map(id=>[id,0]));
 for(let i=0;i<queue.length;i++){
  const id=queue[i];
  for(const next of out.get(id)!){
   depth.set(next,Math.max(depth.get(next)!,depth.get(id)!+1));
   degree.set(next,degree.get(next)!-1);if(!degree.get(next))queue.push(next);
  }
 }
 const rows:string[][]=[];
 for(const id of ids)(rows[depth.get(id)!]??=[]).push(id);
 for(let i=0;i<rows.length;i++)rows[i]??=[];
 return rows;
}

/** Median heuristic, alternating sweeps. Nodes with no neighbour in the reference layer hold still. */
function order(rows:string[][],dag:Link[]):void{
 const ids=rows.flat();
 const pred=group(ids),succ=group(ids);
 for(const l of dag){succ.get(l.source)!.push(l.target);pred.get(l.target)!.push(l.source);}
 const at=new Map<string,number>();
 const reindex=()=>rows.forEach(row=>row.forEach((id,i)=>at.set(id,i)));
 reindex();
 for(let sweep=0;sweep<SWEEPS;sweep++){
  const down=sweep%2===0,side=down?pred:succ;
  const sequence=down?rows.map((_,i)=>i):rows.map((_,i)=>rows.length-1-i);
  for(const index of sequence){
   const row=rows[index];
   const key=new Map(row.map(id=>{
    const near=side.get(id)!.map(other=>at.get(other)!).filter(v=>v!==undefined).sort((a,b)=>a-b);
    return [id,near.length?near[(near.length-1)>>1]:at.get(id)!];
   }));
   rows[index]=row.map((id,i)=>({id,i})).sort((a,b)=>key.get(a.id)!-key.get(b.id)!||a.i-b.i).map(v=>v.id);
   reindex();
  }
 }
}

function layered(graph:Graph):Map<string,{x:number;y:number}> {
 const ids=graph.nodes.map(n=>n.id);
 const dag=acyclic(ids,links(graph));
 const rows=layers(ids,dag);
 order(rows,dag);
 const tallest=Math.max(...rows.map(r=>r.length));
 const place=new Map<string,{x:number;y:number}>();
 rows.forEach((row,column)=>{
  const offset=((tallest-row.length)*ROW)/2;
  row.forEach((id,i)=>place.set(id,{x:ORIGIN_X+column*COLUMN,y:Math.round(ORIGIN_Y+offset+i*ROW)}));
 });
 return place;
}

/** Sequence lifelines only vary in x, so the goal is short messages, not fewer crossings. */
function sequence(graph:Graph):Map<string,{x:number;y:number}> {
 const all=links(graph);
 const first:string[]=[];
 for(const l of all)for(const id of [l.source,l.target])if(!first.includes(id))first.push(id);
 let best=[...first,...graph.nodes.map(n=>n.id).filter(id=>!first.includes(id))];
 const at=(list:string[])=>new Map(list.map((id,i)=>[id,i]));
 const cost=(list:string[])=>{const pos=at(list);return all.reduce((sum,l)=>sum+Math.abs(pos.get(l.source)!-pos.get(l.target)!),0);};
 let bestCost=cost(best);
 const near=group(best);
 for(const l of all){near.get(l.source)!.push(l.target);near.get(l.target)!.push(l.source);}
 for(let sweep=0;sweep<SWEEPS;sweep++){
  const pos=at(best);
  const key=new Map(best.map(id=>{
   const list=near.get(id)!.map(other=>pos.get(other)!).sort((a,b)=>a-b);
   return [id,list.length?list[(list.length-1)>>1]:pos.get(id)!];
  }));
  const next=best.map((id,i)=>({id,i})).sort((a,b)=>key.get(a.id)!-key.get(b.id)!||a.i-b.i).map(v=>v.id);
  const nextCost=cost(next);
  if(nextCost<bestCost){best=next;bestCost=nextCost;}else break;
 }
 return new Map(best.map((id,i)=>[id,{x:ORIGIN_X+i*COLUMN,y:SEQUENCE_Y}]));
}

/** Deterministic: the same graph always lands on the same coordinates. */
export function layoutGraph(graph:Graph,diagram:DiagramType):Graph{
 if(!graph.nodes.length)return graph;
 const place=diagram==='sequence'?sequence(graph):layered(graph);
 return {...graph,nodes:graph.nodes.map((n:GraphNode)=>({...n,...place.get(n.id)!}))};
}
