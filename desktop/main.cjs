const { app, BrowserWindow, Menu, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveAsset } = require('./protocol.cjs');

const smoke = process.argv.includes('--smoke-test');
const reportSmoke = smoke && process.argv.includes('--smoke-report');
if (smoke) {
  // Test runs never read or overwrite the user's saved diagrams.
  const { mkdtempSync } = require('node:fs');
  app.setPath('userData', mkdtempSync(path.join(require('node:os').tmpdir(), 'model-graph-smoke-')));
}
if(reportSmoke){
  const {writeFileSync}=require('node:fs');
  const story=(id,title)=>({id,title,summary:title,diagram:'sequence',level:'Container',trigger:'測試事件',uncertainty:'測試資料',steps:[{title:'輸入',description:'接收事件',evidence:[{path:'example.ts',startLine:1,endLine:1,excerpt:'input()'}]},{title:'結果',description:'回傳結果',evidence:[{path:'example.ts',startLine:2,endLine:2,excerpt:'return result'}]}],flowStatus:'ready',source:'@startuml\nparticipant Client\nparticipant API\nClient -> API : '+title+'\n@enduml'});
  writeFileSync(path.join(app.getPath('userData'),'last-project-report.json'),JSON.stringify({version:1,id:'00000000-0000-4000-8000-000000000001',createdAt:new Date().toISOString(),project:'synthetic',title:'測試專案主題報告',summary:'兩個主題與四份獨立 Flow',status:'complete',coverage:{indexed:2,excluded:0,read:[],omitted:[]},themes:['登入','結帳'].map((title,i)=>({id:'t'+i,title,question:title+'問題',rationale:'不同業務能力',status:'complete',gaps:[],stories:[story('s'+i+'a',title+'成功'),story('s'+i+'b',title+'失敗')]}))}));
}
app.setName('Model Graph');
protocol.registerSchemesAsPrivileged([
  { scheme: 'modelgraph', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let window;
const cancelAI = require('./ai-ipc.cjs').installAI(() => window);
app.on('before-quit', cancelAI);
let downloadResult;
let finishDownload;
if (smoke) downloadResult = new Promise(resolve => { finishDownload = resolve; });
function createWindow() {
  window = new BrowserWindow({
    title: 'Model Graph', width: 1440, height: 940, minWidth: 360, minHeight: 600,
    backgroundColor: '#f8f9fa', show: !smoke,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.on('closed', () => { cancelAI(); window = null; });
  window.loadURL('modelgraph://app/').catch(error => {
    if (smoke) { console.error(error); app.exit(1); }
    else dialog.showErrorBox('無法開啟 Model Graph', error.message);
  });
  if (reportSmoke) runReportSmoke(window);else if (smoke) runSmoke(window);
}

async function runReportSmoke(win){
 const timeout=setTimeout(()=>{console.error('Report smoke timed out');app.exit(1);},20000);
 win.webContents.once('did-finish-load',async()=>{
  try{
   const wait=()=>new Promise(r=>setTimeout(r,100));
   let loaded=false;for(let i=0;i<100;i++){loaded=await win.webContents.executeJavaScript(`document.querySelectorAll('.report-workspace .theme-section').length===2 && document.querySelectorAll('.report-workspace .story-card').length===4`);if(loaded)break;await wait();}
   if(!loaded)throw new Error('Report did not restore two themes and four flows');
   await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.report-workspace button')).find(b=>b.textContent==='预览／載入 Flow'||b.textContent==='預覽／載入 Flow').click()`);await wait();
   const preview=await win.webContents.executeJavaScript(`document.querySelector('#puml-source').value.includes('登入成功')`);if(!preview)throw new Error('Wrong flow selected');
   await win.webContents.executeJavaScript(`document.querySelector('[aria-label="關閉 PUML 編輯器"]').click();Array.from(document.querySelectorAll('.report-workspace button')).find(b=>b.textContent==='帶回 Prompt 修改').click()`);await wait();
   const refine=await win.webContents.executeJavaScript(`document.querySelector('[aria-label="分析模式"]').value==='diagram' && document.querySelector('[aria-label="圖表描述"]').value.includes('登入成功') && !document.querySelector('.workspace').classList.contains('show-report')`);
   if(!refine)throw new Error('Flow refinement did not load into canvas and prompt');
   // Exercise the real preload/progress bridge with synthetic completions; no model calls.
   const {ipcMain}=require('electron');
   const report=JSON.parse(require('node:fs').readFileSync(path.join(app.getPath('userData'),'last-project-report.json'),'utf8'));
   report.id='00000000-0000-4000-8000-000000000002';report.status='running';
   const stories=report.themes.flatMap(t=>t.stories);
   const originals=stories.map(s=>s.source);stories.forEach(s=>{s.flowStatus='pending';delete s.source;});
   let request,finish;
   ipcMain.removeHandler('ai:folder');ipcMain.handle('ai:folder',()=>({name:'synthetic',files:[],skipped:0,limited:false}));
   ipcMain.removeHandler('ai:generate');ipcMain.handle('ai:generate',(_event,r)=>{request=r;return new Promise(resolve=>{finish=resolve;});});
   const js=code=>win.webContents.executeJavaScript(code);
   const until=async code=>{for(let i=0;i<60;i++){if(await js(code))return;await wait();}throw new Error('Canvas sync assertion failed: '+code);};
   await js(`Array.from(document.querySelectorAll('.generated-flow-controls button')).find(b=>b.textContent.includes('自動同步')).click();Array.from(document.querySelectorAll('.ai-actions button')).find(b=>b.textContent==='選擇專案資料夾').click()`);await wait();
   await js(`document.querySelector('[aria-label="產生圖表"]').click()`);
   for(let i=0;!request&&i<60;i++)await wait();if(!request)throw new Error('Synthetic run did not start');
   const emit=()=>win.webContents.send('ai:progress',{runId:request.runId,report:structuredClone(report)});
   emit();await wait();
   stories[0].flowStatus='ready';stories[0].source=originals[0];emit();
   await until(`document.querySelector('.edge text')?.textContent.includes('登入成功') && !document.querySelector('.workspace').classList.contains('show-report')`);
   stories[1].flowStatus='ready';stories[1].source=originals[1];emit();
   await until(`document.querySelector('.edge text')?.textContent.includes('登入失敗') && document.querySelector('#completed-flow').options.length===3`);
   // A user's edit pauses following; repeated checkpoints must not replay old diagrams.
   await js(`document.querySelector('[data-node-id]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await wait();
   const edited=await js(`document.querySelector('[data-node-id]').getAttribute('transform')`);
   stories[2].flowStatus='ready';stories[2].source=originals[2];emit();await wait();
   if(!await js(`document.querySelector('.edge text')?.textContent.includes('登入失敗') && document.querySelector('[data-node-id]').getAttribute('transform')===${JSON.stringify(edited)}`))throw new Error('Progress overwrote manual edits');
   await js(`document.querySelector('.generated-flow-controls button').click()`);
   await until(`document.querySelector('.edge text')?.textContent.includes('結帳成功')`);
   await js(`document.querySelector('[aria-label="復原"]').click()`);await wait();
   if(!await js(`document.querySelector('[data-node-id]').getAttribute('transform')===${JSON.stringify(edited)}`))throw new Error('Undo did not preserve the edited canvas');
   emit();await wait();
   if(!await js(`document.querySelector('.edge text')?.textContent.includes('登入失敗')`))throw new Error('Duplicate checkpoint replayed');
   report.status='cancelled';finish({kind:'project',report,files:[]});await wait();
   await until(`!document.querySelector('[aria-label="產生圖表"]').disabled`);
   // Single-diagram generation uses the same automatic application path.
   await js(`{const select=document.querySelector('[aria-label="分析模式"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'diagram');select.dispatchEvent(new Event('change',{bubbles:true}));}`);await wait();
   ipcMain.removeHandler('ai:generate');ipcMain.handle('ai:generate',()=>({kind:'diagram',source:originals[3],files:[]}));
   await js(`document.querySelector('[aria-label="產生圖表"]').click()`);
   await until(`document.querySelector('.edge text')?.textContent.includes('結帳失敗')`);
   ipcMain.removeHandler('ai:generate');ipcMain.handle('ai:generate',()=>({kind:'diagram',source:'@startuml\\n!include /bad\\n@enduml',files:[]}));
   await until(`!document.querySelector('[aria-label="產生圖表"]').disabled`);
   await js(`document.querySelector('[aria-label="產生圖表"]').click()`);await wait();
   if(!await js(`document.querySelector('.edge text')?.textContent.includes('結帳失敗')`))throw new Error('Invalid PUML overwrote canvas');
   console.log('Thematic report desktop test passed:',JSON.stringify({themes:2,flows:4,restored:true,preview,refine,streamingSync:true,editPreserved:true,undo:true,singleSync:true}));clearTimeout(timeout);app.exit(0);
  }catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}
 });
}

async function runSmoke(win) {
  const timeout = setTimeout(() => { console.error('Desktop smoke test timed out'); app.exit(1); }, 20000);
  win.webContents.on('render-process-gone', (_, details) => { console.error(details); app.exit(1); });
  win.webContents.on('console-message', (_event, _level, message) => {
    if (String(message).includes('Error')) console.error(message);
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const started = Date.now();
        const poll = () => {
          const nodes = document.querySelectorAll('[data-node-id]');
          if (nodes.length && document.querySelector('#diagram-type')) {
            const puml = document.querySelector('[aria-label="開啟 PUML 匯入匯出"]');
            puml.click();
            setTimeout(() => {
              const editor = document.querySelector('#puml-source');
              if (!editor || !editor.value.includes('@startuml')) return reject(new Error('PUML editor did not open'));
              localStorage.setItem('desktop-smoke', 'ok');
              Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('下載原始碼')).click();
              resolve({ title: document.title, nodes: nodes.length,
                diagramTypes: document.querySelector('#diagram-type').options.length,
                puml: true, storage: localStorage.getItem('desktop-smoke'),
                nodeIsolated: typeof window.require === 'undefined', secure: window.isSecureContext });
            }, 100);
          } else if (Date.now() - started > 10000) reject(new Error('Renderer failed to mount'));
          else setTimeout(poll, 50);
        }; poll();
      })`);
      if (result.diagramTypes !== 6 || !result.nodeIsolated || !result.secure) throw new Error(JSON.stringify(result));
      await win.webContents.executeJavaScript(`document.querySelector('[aria-label="關閉 PUML 編輯器"]').click()`);
      const position = await win.webContents.executeJavaScript(`(() => { const n=document.querySelector('[data-node-id]'); const r=n.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
      const move=(type,x,y)=>win.webContents.sendInputEvent({type,x,y,button:'left',clickCount:1});
      const settle=()=>new Promise(resolve=>setTimeout(resolve,80));
      move('mouseMove',position.x,position.y);move('mouseDown',position.x,position.y);await settle();
      move('mouseMove',position.x+40,position.y+25);await settle();move('mouseUp',position.x+40,position.y+25);await settle();
      await win.webContents.executeJavaScript(`document.querySelector('[aria-label="復原"]').click()`);await settle();
      move('mouseMove',position.x,position.y);move('mouseDown',position.x,position.y);move('mouseUp',position.x,position.y);await settle();
      const aiBridge=await win.webContents.executeJavaScript(`(async()=>{if(!window.modelGraphAI)return false;return await window.modelGraphAI.cancel();})()`);
      if(!aiBridge)throw new Error('AI preload bridge unavailable');
      const unifiedComposer=await win.webContents.executeJavaScript(`document.querySelectorAll('[aria-label="產生圖表"]').length===1 && document.querySelectorAll('[aria-label="圖表描述"]').length===1 && document.querySelector('[aria-label="產圖提供者"]').options.length===3`);
      if(!unifiedComposer)throw new Error('Expected a single prompt and generation action');
      const providerSaved=await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('[aria-label="產圖提供者"]');if(select.value!=='codex')return false;select.value='claude';select.dispatchEvent(new Event('change',{bubbles:true}));if(localStorage.getItem('modelgraph-ai-provider')!=='claude')return false;select.value='codex';select.dispatchEvent(new Event('change',{bubbles:true}));return localStorage.getItem('modelgraph-ai-provider')==='codex';})()`);
      if(!providerSaved)throw new Error('Provider preference did not persist');
      const redoPreserved=await win.webContents.executeJavaScript(`!document.querySelector('[aria-label="重做"]').disabled`);
      if(!redoPreserved)throw new Error('Selecting a node cleared redo history');
      const storyMode=await win.webContents.executeJavaScript(`document.querySelector('[aria-label="分析模式"]').querySelector('option[value="project"]')!==null`);
      await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('[aria-label="Flow 關係"]');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));const input=document.querySelector('[aria-label="流程名稱"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Smoke flow');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await settle();
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存目前畫布').click()`);
      await settle();
      const flowSaved=await win.webContents.executeJavaScript(`JSON.parse(localStorage.getItem('modelgraph-flow-library-v1')).flows[0].title==='Smoke flow' && document.querySelectorAll('.edge.selected').length===1`);
      if(!storyMode||!flowSaved)throw new Error('Story mode or flow library/navigation failed');
      const saved = await downloadResult;
      if (!saved) throw new Error('PUML download failed');
      console.log('Desktop smoke test passed:', JSON.stringify({ ...result, pumlDownload: true, redoPreserved, aiBridge: true, unifiedComposer, providerSaved, storyMode, flowSaved }));
      clearTimeout(timeout); app.exit(0);
    } catch (error) { console.error(error); clearTimeout(timeout); app.exit(1); }
  });
}

if (!smoke && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(() => {
    const root = path.join(__dirname, 'renderer');
    protocol.handle('modelgraph', request => {
      const asset = resolveAsset(request.url, root);
      if (!asset) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(asset).href);
    });
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item) => {
      if (smoke) {
        const destination = path.join(app.getPath('userData'), 'test-export.puml');
        item.setSavePath(destination);
        item.once('done', (_event, state) => {
          const { readFileSync } = require('node:fs');
          try { finishDownload(state === 'completed' && readFileSync(destination, 'utf8').includes('@startuml')); }
          catch { finishDownload(false); }
        });
      } else item.setSaveDialogOptions({ title: '儲存圖檔', defaultPath: item.getFilename() });
    });
    const template = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: '檔案', submenu: [{ label: '匯入圖檔…', accelerator: 'CmdOrCtrl+O', click: () => window?.webContents.executeJavaScript(`document.querySelector('[aria-label="匯入 JSON 或 PUML"]')?.click()`) }, { type: 'separator' }, { role: process.platform === 'darwin' ? 'close' : 'quit' }] },
      { role: 'editMenu' },
      { label: '檢視', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
      { role: 'windowMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
