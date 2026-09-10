// Explicit opt-in integration test: sends only the checked-in synthetic fixture to the selected CLI.
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const ai=require('../desktop/ai.cjs');const {analyzeRepository}=require('../desktop/repo-analysis.cjs');
(async()=>{
 if(process.env.MODELGRAPH_LIVE_TEST!=='1')throw new Error('Set MODELGRAPH_LIVE_TEST=1 to authorize CLI model requests');
 const provider=process.env.MODELGRAPH_TEST_PROVIDER||'codex';
 const root=await fs.realpath(path.resolve('tests/fixtures/thematic-repo'));
 const executable=await ai.discover(provider);const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-live-'));
 const {importPuml}=require('../desktop-app/diagram-parser.cjs');
 try{
  const report=await analyzeRepository({root,manifest:await ai.scanFolder(root),request:{provider,prompt:'請分析使用者登入與訂單結帳這兩個主題，各至少區分成功與失敗兩個 Story，產生獨立循序圖。只依據實際程式碼，不補不存在的功能。',diagram:'sequence'},ask:prompt=>ai.run(executable,ai.generationArgs(provider),prompt,{cwd,timeout:180000}),validatePuml:importPuml,onProgress:event=>console.log(event.phase+': '+event.message),onCheckpoint:report=>fs.writeFile('/tmp/modelgraph-live-analysis.json',JSON.stringify(report,null,2))});
  for(const theme of report.themes){if(theme.title.includes('登入')&&theme.stories.some(s=>s.title.includes('結帳')))throw new Error('Checkout story leaked into login theme');if(theme.title.includes('結帳')&&theme.stories.some(s=>s.title.includes('登入')))throw new Error('Login story leaked into checkout theme');}
  const flows=report.themes.flatMap(t=>t.stories);const unique=new Set(flows.filter(s=>s.flowStatus==='ready').map(s=>{const g=importPuml(s.source).graph;const names=new Map(g.nodes.map(n=>[n.id,n.name]));return JSON.stringify({nodes:g.nodes.map(n=>[n.kind,n.name]),edges:g.edges.map(e=>[names.get(e.source),names.get(e.target),e.label])});}));const summary={uniqueFlows:unique.size,status:report.status,themes:report.themes.length,flows:flows.length,ready:flows.filter(s=>s.flowStatus==='ready').length,read:report.coverage.read.length};console.log(JSON.stringify(summary));
  if(summary.themes<2||summary.ready<4||summary.ready!==summary.flows||summary.uniqueFlows<4)throw new Error('Expected two themes and at least four validated flows');
 }finally{await fs.rm(cwd,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
