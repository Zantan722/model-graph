import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
async function moduleFor(path){const result=await build({entryPoints:[new URL(path,import.meta.url).pathname],bundle:true,format:'esm',platform:'node',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const {exportPuml,importPuml}=await moduleFor('../lib/puml.ts');
const {initialGraph}=await moduleFor('../lib/graph.ts');
mkdirSync('/tmp/model-graph-puml-validation',{recursive:true});
for(const [diagram,level] of [['architecture',''],['workflow',''],['sequence',''],['dataflow',''],['lifecycle',''],...['Context','Container','Component','Code'].map(l=>['c4',l])]){
 const graph=initialGraph(diagram==='c4'?level:diagram);
 graph.notes.push({id:'comment1',nodeId:graph.nodes[0].id,text:'確認這個節點\n第二行',resolved:true});
 const source=exportPuml(graph,diagram,level||'Container');
 const back=importPuml(source);
 assert.deepEqual(back.errors,[],`${diagram} ${level}: ${JSON.stringify(back.errors)}`);
 assert.equal(back.diagram,diagram);
 assert.deepEqual(back.graph,graph,`${diagram} round trip`);
 writeFileSync(`/tmp/model-graph-puml-validation/${diagram}-${level||'sample'}.puml`,source);
}
let p=importPuml('@startuml\nparticipant "使用者" as User\nparticipant API\nUser -> API : hello\nAPI --> User : response\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.diagram,'sequence');assert.equal(p.graph.edges[1].messageType,'return');assert.equal(p.graph.nodes[0].name,'使用者');
p=importPuml('@startuml\ncomponent "Web App" as web\ndatabase DB\nweb --> DB : query\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.diagram,'architecture');assert.equal(p.graph.nodes[1].kind,'database');
p=importPuml('@startuml\n[*] --> Pending\nPending --> Paid : paid\nPaid --> [*]\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.diagram,'lifecycle');assert.equal(p.graph.nodes[0].kind,'start');assert.equal(p.graph.nodes.at(-1).kind,'end');
p=importPuml('@startuml\nstart\n:測試;\nif (通過？) then (yes)\n:部署;\nelse (no)\n:通知;\nendif\nstop\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.diagram,'workflow');assert.equal(p.graph.nodes.filter(n=>n.kind==='decision').length,1);assert.equal(p.graph.edges.length,6);
p=importPuml('@startuml\nstart\nwhile (有資料？) is (yes)\n:處理;\nendwhile (no)\nstop\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.graph.edges.length,4);
p=importPuml('@startuml\n!include <C4/C4_Container>\nPerson(user, "User")\nContainer(api, "API", "Node.js", "desc, with comma")\nRel(user, api, "calls")\n@enduml');
assert.deepEqual(p.errors,[]);assert.equal(p.diagram,'c4');assert.equal(p.graph.nodes[1].description,'desc, with comma');
for(const source of ['@startuml\nparticipant A\nalt yes\nA -> B\nend\n@enduml','@startuml\n!include /etc/passwd\n@enduml','@startuml\nstate A {\nstate B\n}\n@enduml','@startuml\nstart\nif (x) then (yes)\n:a;\n@enduml','@startuml\nA -> B'])assert.ok(importPuml(source).errors.length>0,source);
const special=initialGraph('sequence');special.nodes[0].name='中文 "quotes" \\n @enduml';special.edges[0].label='line 1\nline 2 "quote"';special.notes=[{id:'note1',nodeId:special.nodes[0].id,text:'end note\n@enduml\n!include secret',resolved:false}];
assert.deepEqual(importPuml(exportPuml(special,'sequence')).graph,special);
const edited=exportPuml(initialGraph('architecture'),'architecture').replace('"Browser"','"Changed"');assert.equal(importPuml(edited).graph.nodes[0].name,'Changed','PUML edits override metadata');
console.log('PUML checks passed: nine round trips, external syntax, branches/loops, C4 macros, escaping, unsupported syntax, and source edits.');
const literal=initialGraph('Container');literal.nodes[0].name='<U+0022> literal';literal.edges[0].label='literal \\n and <U+0041>';assert.deepEqual(importPuml(exportPuml(literal,'c4')).graph,literal);
assert.doesNotThrow(()=>importPuml("@startuml\n' @modelgraph null\n' @modelgraph-edge null\nA -> B\n' @modelgraph-note null\nnote right of A : test\n@enduml"));
const reordered=importPuml('@startuml\nA --> DB\ncomponent A\ndatabase DB\n@enduml');assert.equal(reordered.graph.nodes[1].kind,'database');

// Boundaries are visual grouping only: parse through them, keep the contents, never invent a node.
const boundary=importPuml('@startuml\n!include <C4/C4_Container>\nPerson(user, "User")\nSystem_Boundary(platform, "Platform") {\nContainer(api, "API", "Node.js", "inner")\nContainerDb(db, "DB", "Postgres", "store")\n}\nRel(user, api, "calls")\nRel(api, db, "reads")\n@enduml');
assert.deepEqual(boundary.errors,[],JSON.stringify(boundary.errors));
assert.equal(boundary.graph.nodes.length,3,'boundary must not add or drop nodes');
assert.equal(boundary.graph.edges.length,2,'relations across a boundary must survive');
assert.ok(boundary.warnings.some(w=>w.line===4&&w.message.includes('邊界群組')),'boundary should warn that the group is not drawn');
for(const name of ['Enterprise_Boundary','System_Boundary','Container_Boundary','Boundary'])
 assert.deepEqual(importPuml(`@startuml\n!include <C4/C4_Container>\n${name}(b, "B") {\nPerson(u, "U")\n}\n@enduml`).errors,[],name);
const nested=importPuml('@startuml\n!include <C4/C4_Container>\nEnterprise_Boundary(e, "E") {\nSystem_Boundary(s, "S") {\nPerson(u, "U")\n}\n}\n@enduml');
assert.deepEqual(nested.errors,[]);assert.equal(nested.graph.nodes.length,1,'nested boundaries must still yield one node');
for(const source of ['@startuml\n!include <C4/C4_Container>\nSystem_Boundary(b, "B") {\nPerson(u, "U")\n@enduml','@startuml\n!include <C4/C4_Container>\nPerson(u, "U")\n}\n@enduml'])
 assert.ok(importPuml(source).errors.length>0,`unbalanced boundary braces should fail: ${source}`);
console.log('Boundary checks passed: transparent grouping, four macro names, nesting, and unbalanced braces.');
