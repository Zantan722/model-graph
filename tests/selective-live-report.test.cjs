const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {validateReport}=require('../desktop/report-store.cjs'),{validateDiagram}=require('../desktop/views.cjs'),{importPuml}=require('../desktop-app/diagram-parser.cjs');
for(const diagram of ['architecture','sequence']){
 const report=validateReport(JSON.parse(fs.readFileSync(`tests/fixtures/codex-selective-${diagram}.json`,'utf8')));
 const views=report.themes.flatMap(t=>t.views),ready=views.filter(v=>v.status==='ready');
 assert.ok(views.length>=2);assert.equal(ready.length,1);assert.ok(views.every(v=>v.diagram===diagram));assert.ok(views.filter(v=>v.status!=='ready').every(v=>v.status==='proposed'&&!v.source));
 for(const s of report.coverage.read){const text=fs.readFileSync(path.join('tests/fixtures/thematic-repo',s.path),'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),s.sha256);}
 for(const v of views)for(const item of v.content.items)for(const e of item.evidence){const lines=fs.readFileSync(path.join('tests/fixtures/thematic-repo',e.path),'utf8').split('\n');assert.equal(e.excerpt,lines.slice(e.startLine-1,e.endLine).join('\n'));}
 const parsed=validateDiagram(ready[0].source,ready[0],importPuml).parsed;
 assert.ok(parsed.graph.nodes.length>=2);assert.ok(parsed.graph.edges.length>=1);
 if(diagram==='architecture'){assert.ok(views.every(v=>v.content.kind==='structure'&&!v.trigger));assert.ok(views.some(v=>v.content.items.some(i=>i.type==='relationship')));}
 else assert.ok(views.every(v=>v.content.kind==='scenario'&&v.trigger));
 console.log(`Live ${diagram}: ${views.length} descriptions, exactly one generated diagram, others untouched; hashes, citations and syntax verified.`);
}
