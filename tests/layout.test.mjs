import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function moduleFor(path){const result=await build({entryPoints:[new URL(path,import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {layoutGraph,COLUMN,ROW,SEQUENCE_Y}=await moduleFor('../lib/layout.ts');
const {importPuml}=await moduleFor('../lib/puml.ts');
const {initialGraph,parseGraph,uid}=await moduleFor('../lib/graph.ts');

const NODE_W=240,NODE_H=132;
function overlaps(graph){
 let count=0;
 for(let i=0;i<graph.nodes.length;i++)for(let j=i+1;j<graph.nodes.length;j++){
  const a=graph.nodes[i],b=graph.nodes[j];
  if(Math.abs(a.x-b.x)<NODE_W&&Math.abs(a.y-b.y)<NODE_H)count++;
 }
 return count;
}
function crossings(graph){
 const by=new Map(graph.nodes.map(n=>[n.id,n]));
 const turn=(p,q,r)=>(r.y-p.y)*(q.x-p.x)>(q.y-p.y)*(r.x-p.x);
 const segs=graph.edges.filter(e=>e.source!==e.target).map(e=>({a:by.get(e.source),b:by.get(e.target)}));
 let count=0;
 for(let i=0;i<segs.length;i++)for(let j=i+1;j<segs.length;j++){
  const {a,b}=segs[i],{a:c,b:d}=segs[j];
  if(a===c||a===d||b===c||b===d)continue;
  if(turn(a,c,d)!==turn(b,c,d)&&turn(a,b,c)!==turn(a,b,d))count++;
 }
 return count;
}
const keys=[['architecture',''],['workflow',''],['sequence',''],['dataflow',''],['lifecycle',''],...['Context','Container','Component','Code'].map(l=>['c4',l])];

// Every canvas key must lay out, stay valid, and never stack two boxes on top of each other.
for(const [diagram,level] of keys){
 const graph=initialGraph(diagram==='c4'?level:diagram);
 const out=layoutGraph(graph,diagram);
 assert.doesNotThrow(()=>parseGraph(out),`${diagram} ${level} produced an invalid graph`);
 assert.equal(out.nodes.length,graph.nodes.length,`${diagram} ${level} lost nodes`);
 assert.deepEqual(out.nodes.map(n=>n.id),graph.nodes.map(n=>n.id),`${diagram} ${level} reordered nodes`);
 assert.deepEqual(out.edges,graph.edges,`${diagram} ${level} touched edges`);
 assert.equal(overlaps(out),0,`${diagram} ${level} overlapping boxes`);
 assert.ok(out.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)),`${diagram} ${level} non-finite coordinates`);
 // Same input, same coordinates: re-running must never shuffle a diagram the user already read.
 assert.deepEqual(layoutGraph(graph,diagram),out,`${diagram} ${level} is not deterministic`);
 // Laying out an already laid out graph is a no-op.
 assert.deepEqual(layoutGraph(out,diagram),out,`${diagram} ${level} is not idempotent`);
}

// Sequence lifelines share one y and spread along x in message order.
const seq=layoutGraph(initialGraph('sequence'),'sequence');
assert.ok(seq.nodes.every(n=>n.y===SEQUENCE_Y),'sequence lifelines must share a baseline');
assert.equal(new Set(seq.nodes.map(n=>n.x)).size,seq.nodes.length,'sequence lifelines must not share a column');

const puml=(body)=>importPuml(`@startuml\n${body}\n@enduml`).graph;

// A chain must come out as one node per column, in order.
const chain=puml('component A\ncomponent B\ncomponent C\nA --> B\nB --> C');
const chained=layoutGraph(chain,'architecture');
const columns=chained.nodes.map(n=>n.x);
assert.deepEqual(columns,[...columns].sort((a,b)=>a-b),'a chain must run left to right');
assert.equal(new Set(columns).size,3,'a chain must use one column per node');

// Cycles must still lay out: the back edge is reversed for layering only, never dropped.
const cyclic=puml('state A\nstate B\nstate C\nA --> B\nB --> C\nC --> A');
const broken=layoutGraph(cyclic,'lifecycle');
assert.equal(broken.nodes.length,3);
assert.equal(overlaps(broken),0,'cyclic graph overlapped');
assert.deepEqual(broken.edges,cyclic.edges,'cycle breaking must not remove edges');
assert.equal(new Set(broken.nodes.map(n=>n.x)).size,3,'a 3-cycle should still spread over three columns');

// Self loops and duplicate edges must not skew placement or crash.
const loops=puml('component A\ncomponent B\nA --> A\nA --> B\nA --> B');
assert.equal(overlaps(layoutGraph(loops,'architecture')),0,'self loop broke the layout');

// Disconnected nodes still need a home, and must not land on anyone.
const islands=puml('component A\ncomponent B\ncomponent C\ncomponent D\nA --> B');
assert.equal(overlaps(layoutGraph(islands,'architecture')),0,'isolated nodes overlapped');

// The point of the feature: fewer crossings than the import grid on a real diagram.
const real=puml(['component Browser','component Gateway','component Orders','database Store','component Payments','component Audit',
 'Browser --> Gateway','Gateway --> Orders','Orders --> Store','Orders --> Payments','Gateway --> Audit','Payments --> Store','Audit --> Store'].join('\n'));
const tidy=layoutGraph(real,'architecture');
assert.ok(crossings(tidy)<=crossings(real),`layout increased crossings: ${crossings(real)} -> ${crossings(tidy)}`);
assert.equal(overlaps(tidy),0);

assert.deepEqual(layoutGraph({nodes:[],edges:[],notes:[]},'architecture'),{nodes:[],edges:[],notes:[]},'empty graph should pass through');

// Notes and evidence ride along untouched.
const carried={nodes:[{id:'n1',name:'A',description:'',technology:'',kind:'service',x:0,y:0}],edges:[],notes:[{id:'c1',nodeId:'n1',text:'keep me',resolved:false}],evidence:[{target:'n1',path:'a.ts',startLine:1,endLine:2,excerpt:'x'}]};
const kept=layoutGraph(carried,'architecture');
assert.deepEqual(kept.notes,carried.notes,'notes must survive layout');
assert.deepEqual(kept.evidence,carried.evidence,'evidence must survive layout');

console.log('Layout tests passed: nine canvas keys, determinism, idempotence, cycles, self loops, islands, and crossing count.');
