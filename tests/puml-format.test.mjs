import assert from 'node:assert/strict';
import { build } from 'esbuild';
async function moduleFor(path){const result=await build({entryPoints:[new URL(path,import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {exportPuml,formatPuml,importPuml}=await moduleFor('../lib/puml.ts');
const {initialGraph}=await moduleFor('../lib/graph.ts');

// Canonical output is already the target layout, so formatting it must change nothing at all.
for(const [diagram,level] of [['architecture',''],['workflow',''],['sequence',''],['dataflow',''],['lifecycle',''],...['Context','Container','Component','Code'].map(l=>['c4',l])]){
 const graph=initialGraph(diagram==='c4'?level:diagram);
 graph.notes.push({id:'note1',nodeId:graph.nodes[0].id,text:'檢查這個節點',resolved:false});
 const source=exportPuml(graph,diagram,level||'Container');
 assert.equal(formatPuml(source),source,`format changed canonical ${diagram} ${level}`);
}

const messy=`@startuml
!include <C4/C4_Container>


  Person(analyst,"Data Analyst",   "Tag Author")
    System_Boundary(platform, "Tag Fab Platform") {
Container(spa,"Tag Fab UI","Angular 21 / Nx","操作 Entity, Dataset")
        ContainerDb(pg, "PostgreSQL","PostgreSQL",  "metadata")
  }
     Rel(analyst, spa,"操作","HTTPS")
Rel(spa,pg,"讀寫","JDBC")
@enduml`;
const formatted=formatPuml(messy);
const lines=formatted.split('\n');
assert.ok(lines.includes('Person(analyst, "Data Analyst", "Tag Author")'),'argument spacing not normalized');
assert.ok(lines.includes('  Container(spa, "Tag Fab UI", "Angular 21 / Nx", "操作 Entity, Dataset")'),'brace body not indented');
assert.ok(lines.includes('}'),'closing brace not dedented');
assert.ok(!/\n{3,}/.test(formatted),'blank runs not collapsed');
assert.ok(formatted.endsWith('\n')&&!/\n\n$/.test(formatted),'trailing blank lines kept');
assert.equal(formatPuml(formatted),formatted,'format is not idempotent');

// A comma inside a quoted argument is not an argument separator.
assert.ok(formatted.includes('"操作 Entity, Dataset"'),'quoted comma was treated as a separator');

// Without @modelgraph comments every parse mints fresh ids, so compare structure by node index.
function shape(graph){
 const index=new Map(graph.nodes.map((n,i)=>[n.id,i]));
 return {nodes:graph.nodes.map(({id,...rest})=>rest),edges:graph.edges.map(e=>({source:index.get(e.source),target:index.get(e.target),label:e.label,messageType:e.messageType})),notes:graph.notes.map(({id,nodeId,...rest})=>({...rest,node:index.get(nodeId)}))};
}
// Layout only: the same graph must come back, and the formatter must neither fix nor introduce errors.
for(const source of [messy,`@startuml\nComponent(a, "A", "T", "D")\nRel(a, b, "x")\n@enduml`]){
 const before=importPuml(source),after=importPuml(formatPuml(source));
 assert.deepEqual(shape(after.graph),shape(before.graph),'format changed the parsed graph');
 assert.equal(after.errors.length,before.errors.length,'format changed the error count');
}

// A @modelgraph comment carries the ids and coordinates of the line below it; nothing may split the pair.
const withMeta=`@startuml\n' @modelgraph {"version":1,"diagram":"architecture","level":"Container"}\n' @modelgraph-node mg_0 {"id":"n1","kind":"service","x":60,"y":100}\ncomponent "A" as mg_0\n' @modelgraph-node mg_1 {"id":"n2","kind":"service","x":390,"y":100}\ncomponent "B" as mg_1\n' @modelgraph-edge {"id":"e1"}\nmg_0 --> mg_1 : call\n@enduml`;
const metaLines=formatPuml(withMeta).split('\n');
for(let i=0;i<metaLines.length-1;i++)if(metaLines[i].startsWith("' @modelgraph"))assert.notEqual(metaLines[i+1],'',`blank line inserted after ${metaLines[i].slice(0,32)}`);
assert.deepEqual(importPuml(formatPuml(withMeta)).graph,importPuml(withMeta).graph,'editor metadata lost through format');

assert.equal(formatPuml(''),'\n','empty source should stay empty');

console.log('PUML format tests passed');
