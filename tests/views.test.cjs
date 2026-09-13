const assert=require('node:assert/strict');
const {types,policyFor,parseViews,validateDiagram}=require('../desktop/views.cjs');
const {importPuml}=require('../desktop-app/diagram-parser.cjs');
const files=[{path:'code.js',content:'const a = 1;\nconst b = a;'}];
for(const diagram of types){
 const req={diagram,level:'Container'},p=policyFor(req);
 const item={id:'a',type:p.items[0],title:'A',description:'A description',evidence:[{path:'code.js',startLine:1,endLine:2}]};
 const v={title:'Example',summary:'Description',purpose:'Question',scope:'Scope',diagram,level:'Container',content:{kind:p.kind,items:[item]},uncertainty:'Unknown',...(p.kind==='scenario'?{trigger:'Request'}:{})};
 const parse=v=>parseViews(JSON.stringify({views:[v]}),files,req);
 assert.equal(parse(v)[0].status,'proposed');
 assert.throws(()=>parse({...v,diagram:diagram==='architecture'?'sequence':'architecture'}));
 assert.throws(()=>parse({...v,content:{...v.content,items:[{...item,evidence:[{path:'missing',startLine:1,endLine:1}]}]}}));
 if(p.kind!=='scenario')assert.throws(()=>parse({...v,trigger:'Fake story'}));
 if(diagram==='c4')assert.throws(()=>parse({...v,level:'Component'}));
}
const seq='@startuml\nparticipant A\nparticipant B\nA -> B : call\n@enduml';
const arch='@startuml\ncomponent A\ndatabase B\nA --> B : stores\n@enduml';
const state='@startuml\nstate A\nstate B\nA --> B : event\n@enduml';
for(const [diagram,source] of [['sequence',seq],['architecture',arch],['dataflow',arch],['workflow',state],['lifecycle',state]])assert.equal(validateDiagram(source,{diagram,level:'Container'},importPuml).parsed.diagram,diagram);
assert.throws(()=>validateDiagram(seq.replace('@startuml',`@startuml\n' @modelgraph {"diagram":"architecture"}`),{diagram:'architecture',level:'Container'},importPuml));
for(const [level,macro] of [['Context','System'],['Container','Container'],['Component','Component']]){
 assert.equal(validateDiagram(`@startuml\n${macro}(a, "A", "Desc")\n@enduml`,{diagram:'c4',level},importPuml).parsed.level,level);
}
assert.equal(validateDiagram('@startuml\nclass A\n@enduml',{diagram:'c4',level:'Code'},importPuml).parsed.level,'Code');
assert.throws(()=>validateDiagram('@startuml\nComponent(a, "A", "Desc")\n@enduml',{diagram:'c4',level:'Context'},importPuml));
assert.throws(()=>validateDiagram(arch,{diagram:'sequence',level:'Container'},importPuml));
console.log('Six typed view policies, evidence, structural schema and strict PUML/C4 level checks passed.');
