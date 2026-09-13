// Explicit live integration: only the synthetic fixture is sent to Codex/Claude.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const ai=require('../desktop/ai.cjs');const {analyzeRepository}=require('../desktop/repo-analysis.cjs');const {generateViews}=require('../desktop/generate-views.cjs');
(async()=>{
 if(process.env.MODELGRAPH_LIVE_TEST!=='1')throw new Error('Set MODELGRAPH_LIVE_TEST=1 for model calls');
 const {importPuml}=require('../desktop-app/diagram-parser.cjs');
 const provider=process.env.MODELGRAPH_TEST_PROVIDER||'codex',exe=await ai.discover(provider),root=path.resolve('tests/fixtures/thematic-repo');
 const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-live-views-'));
 try{for(const diagram of ['architecture','sequence']){
  let files=[],drawCalls=0;
  const ask=prompt=>{if(prompt.startsWith('Create a software engineering diagram.'))drawCalls++;return ai.run(exe,ai.generationArgs(provider),prompt,{cwd,timeout:180000});};
  const out=`/tmp/modelgraph-live-${diagram}-views.json`;
  const report=await analyzeRepository({root,manifest:await ai.scanFolder(root),request:{diagram,level:'Container',prompt:diagram==='architecture'?'分析此專案的整體模組架構，以及登入或訂單子系統的結構。依實際依賴與責任整理視圖說明，不要成功／失敗 Story。':'分析登入及訂單，列出有來源的不同呼叫情境。先整理说明，不產圖。'},ask,onSources:s=>{files=s.files;},onProgress:e=>console.log(diagram+': '+e.message),onCheckpoint:r=>fs.writeFile(out,JSON.stringify(r,null,2))});
  assert.equal(drawCalls,0);const views=report.themes.flatMap(t=>t.views);assert.ok(views.length>=2,'Expected independent views');
  assert.ok(views.every(v=>v.status==='proposed'&&!v.source&&v.diagram===diagram));
  if(diagram==='architecture'){assert.ok(views.every(v=>!v.trigger&&v.content.kind==='structure'));assert.ok(views.some(v=>v.content.items.some(i=>i.type==='relationship')),'Architecture lost module dependencies');}
  const selected=views[0];
  await generateViews({report,ids:[selected.id],files,ask,validatePuml:importPuml,onProgress:e=>console.log(diagram+': '+e.message),onCheckpoint:r=>fs.writeFile(out,JSON.stringify(r,null,2))});
  assert.equal(selected.status,'ready',selected.error);assert.ok(views.slice(1).every(v=>v.status==='proposed'&&!v.source));
  console.log(JSON.stringify({diagram,proposals:views.length,selected:1,ready:views.filter(v=>v.status==='ready').length,drawCalls,output:out}));
 }}finally{await fs.rm(cwd,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
