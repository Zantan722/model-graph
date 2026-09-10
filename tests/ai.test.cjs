const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {scanFolder,readSelection,run,generationArgs,makePrompt,parseFileSelection}=require('../desktop/ai.cjs');
(async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-ai-test-')));
 try{
  await fs.writeFile(path.join(root,'README.md'),'# App\nAPI uses database.');
  await fs.writeFile(path.join(root,'.env'),'SECRET=abc');
  await fs.mkdir(path.join(root,'node_modules'));await fs.writeFile(path.join(root,'node_modules','x.js'),'excluded');
  await fs.writeFile(path.join(root,'large.txt'),'x'.repeat(65000));
  await fs.symlink('/etc/passwd',path.join(root,'linked.txt'));
  const listing=await scanFolder(root);assert.deepEqual(listing.files.map(f=>f.path),['README.md']);
  assert.deepEqual(parseFileSelection('["README.md"]',listing.files),['README.md']);
  assert.throws(()=>parseFileSelection('["../secret.txt"]',listing.files));
  assert.throws(()=>parseFileSelection('[]',listing.files));
  assert.throws(()=>parseFileSelection('["README.md","README.md"]',listing.files));
  const files=await readSelection(root,listing.files,['README.md']);assert.match(files[0].content,/API/);
  await assert.rejects(readSelection(root,listing.files,['../etc/passwd']));
  await assert.rejects(readSelection(root,listing.files,['README.md','README.md']));
  await fs.unlink(path.join(root,'README.md'));await fs.symlink('/etc/passwd',path.join(root,'README.md'));
  await assert.rejects(readSelection(root,listing.files,['README.md']));
  assert.match(makePrompt({prompt:'Diagram'},files),/API uses database/);
  for(const p of ['claude','codex'])assert.ok(!generationArgs(p).some(x=>x.includes('dangerously')));
  assert.ok(generationArgs('claude').includes('--safe-mode'));
  assert.ok(generationArgs('codex').includes('read-only'));
  const literal='$(touch /tmp/never-run-modelgraph); `echo nope`';
  const output=await run(process.execPath,['-e','process.stdin.pipe(process.stdout)'],literal);assert.equal(output,literal);
  await assert.rejects(run(process.execPath,['-e','process.exit(7)'],''),/7/);
  await assert.rejects(run(process.execPath,['-e','setTimeout(()=>{},10000)'],'',{timeout:50}),/逾時/);
  const c=new AbortController();const pending=run(process.execPath,['-e','setTimeout(()=>{},10000)'],'',{signal:c.signal});c.abort();await assert.rejects(pending,/取消/);
  console.log('AI safety, source selection, process output, failure, timeout and cancellation tests passed.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
