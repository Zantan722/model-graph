const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {scanFolder,readSelection,parseFileSelection}=require('../desktop/ai.cjs');
(async()=>{
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'modelgraph-unlimited-test-')));
 try{
  const contents='程式碼內容\n'.repeat(20000)+'END_OF_SOURCE';
  await fs.writeFile(path.join(root,'large.ts'),contents);
  for(let start=0;start<1005;start+=50)await Promise.all(Array.from({length:Math.min(50,1005-start)},(_,i)=>fs.writeFile(path.join(root,`file-${start+i}.ts`),'export const data = 1;')));
  const deep=path.join(root,...Array(20).fill('nested'));await fs.mkdir(deep,{recursive:true});await fs.writeFile(path.join(deep,'deep.md'),'Deep source');
  await fs.writeFile(path.join(root,'token-service.ts'),'export function createToken() {}');
  const listing=await scanFolder(root);assert.equal(listing.files.length,1008);assert.equal(listing.limited,false);
  const selected=parseFileSelection(JSON.stringify(listing.files.map(f=>f.path)),listing.files);assert.equal(selected.length,1008);
  const read=await readSelection(root,listing.files,selected);assert.equal(read.length,1008);
  assert.equal(read.find(f=>f.path==='large.ts').content,contents,'large source must never be truncated');
  assert.ok(Buffer.byteLength(contents)>240000);
  assert.ok(read.some(f=>f.content==='Deep source'));
  await assert.rejects(readSelection(root,listing.files,['../outside.ts']));
  const c=new AbortController();c.abort();await assert.rejects(scanFolder(root,c.signal),/abort/i);await assert.rejects(readSelection(root,listing.files,selected,c.signal),/abort/i);
  console.log('Sources above 240 KB, 64 KB/file, 60 selected files, 1000 scanned files and depth 16 pass without truncation; scope and cancellation retained.');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
