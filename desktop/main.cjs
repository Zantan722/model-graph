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
const downloads = new Map();
const downloadWaiters = new Map();
function recordDownload(name, value) {
  downloads.set(name, value);
  const waiter = downloadWaiters.get(name);
  if (waiter) { downloadWaiters.delete(name); waiter(value); }
}
function awaitDownload(name, ms = 8000) {
  if (downloads.has(name)) return Promise.resolve(downloads.get(name));
  return new Promise(resolve => {
    downloadWaiters.set(name, resolve);
    setTimeout(() => { downloadWaiters.delete(name); resolve(downloads.get(name) || null); }, ms);
  });
}
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
 const timeout=setTimeout(()=>{console.error('Report smoke timed out');app.exit(1);},30000);
 win.webContents.once('did-finish-load',async()=>{
  try{
   const wait=()=>new Promise(r=>setTimeout(r,100)),js=code=>win.webContents.executeJavaScript(code);
   const until=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await wait();}throw new Error('View UI assertion failed: '+code);};
   await until(`document.querySelector('.workspace-view-tabs')!==null`);
   if(await js(`document.querySelector('.workspace').classList.contains('show-report')`))throw new Error('Restored report hijacked canvas');
   await js(`Array.from(document.querySelectorAll('.workspace-view-tabs button')).find(b=>b.textContent==='圖表清單').click()`);
   await until(`document.querySelectorAll('.report-workspace .story-card').length===4`);
   await js(`Array.from(document.querySelectorAll('.report-workspace button')).find(b=>b.textContent==='預覽／載入視圖').click()`);await wait();
   if(!await js(`document.querySelector('#puml-source').value.includes('登入成功')`))throw new Error('Legacy preview failed');
   await js(`document.querySelector('[aria-label="關閉 PUML 編輯器"]').click();Array.from(document.querySelectorAll('.report-workspace button')).find(b=>b.textContent==='帶回 Prompt 修改').click()`);await wait();
   if(!await js(`document.querySelector('[aria-label="圖表描述"]').value.includes('登入成功')`))throw new Error('Refinement failed');
   const {ipcMain}=require('electron');
   const report=require('./report-store.cjs').normalizeReport(JSON.parse(require('node:fs').readFileSync(path.join(app.getPath('userData'),'last-project-report.json'),'utf8')));
   report.id='00000000-0000-4000-8000-000000000002';report.status='awaiting_selection';report.snapshotAvailable=true;report.diagram='sequence';report.level='Container';delete report.legacy;
   const views=report.themes.flatMap(t=>t.views),originals=views.map(v=>v.source);
   views.forEach(v=>{delete v.legacy;delete v.source;v.content.kind='scenario';v.status='proposed';});
   let selectedRequest,finish,drawCalls=0;
   ipcMain.removeHandler('ai:folder');ipcMain.handle('ai:folder',()=>({name:'synthetic',files:[],skipped:0,limited:false}));
   ipcMain.removeHandler('ai:generate');ipcMain.handle('ai:generate',()=>({kind:'project',report,files:[]}));
   ipcMain.removeHandler('ai:generateViews');ipcMain.handle('ai:generateViews',(_event,r)=>{drawCalls++;selectedRequest=r;return new Promise(resolve=>{finish=resolve;});});
   await js(`Array.from(document.querySelectorAll('.ai-actions button')).find(b=>b.textContent==='選擇參考資料夾（選用）').click()`);await wait();
   await js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='先列出候選讓我選').click()`);
   await until(`document.querySelectorAll('.view-choice input:not(:disabled)').length===4`);
   if(drawCalls!==0||!await js(`Array.from(document.querySelectorAll('.view-choice input')).every(i=>!i.checked)&&Array.from(document.querySelectorAll('.view-selection-bar button')).find(b=>b.textContent==='產生所選 0 張圖').disabled`))throw new Error('Analysis auto-selected or generated diagrams');
   // Verify wrapping/overflow at desktop, tablet and narrow sizes using the actual renderer.
   for(const width of [1440,1024,768,600,375]){win.setContentSize(width,940);await wait();if(!await js(`document.documentElement.scrollWidth<=window.innerWidth`))throw new Error('Horizontal overflow at '+width);if([1440,375].includes(width))require('node:fs').writeFileSync(path.join(require('node:os').tmpdir(),`modelgraph-select-${width}.png`),(await win.webContents.capturePage()).toPNG());}
   win.setContentSize(1440,940);await wait();
   await js(`{const boxes=document.querySelectorAll('.view-choice input');boxes[0].click();boxes[2].click();}`);await wait();
   await js(`Array.from(document.querySelectorAll('.view-selection-bar button')).find(b=>b.textContent==='產生所選 2 張圖').click()`);
   for(let i=0;!selectedRequest&&i<60;i++)await wait();
   if(!selectedRequest||JSON.stringify(selectedRequest.viewIds)!==JSON.stringify([views[0].id,views[2].id]))throw new Error('Wrong selected view IDs');
   // Follow was paused by legacy preview; explicitly resume it for this batch.
   await js(`document.querySelector('.generated-flow-controls button').click()`);await wait();
   report.status='generating';views[0].status='ready';views[0].source=originals[0];
   const emit=()=>win.webContents.send('ai:progress',{runId:selectedRequest.runId,report:structuredClone(report)});emit();
   await until(`!document.querySelector('.workspace').classList.contains('show-report')&&document.querySelector('.edge text')?.textContent.includes('登入成功')`);
   await js(`document.querySelector('[data-node-id]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await wait();
   const edited=await js(`document.querySelector('[data-node-id]').getAttribute('transform')`);
   views[2].status='ready';views[2].source=originals[2];emit();await wait();
   if(!await js(`document.querySelector('[data-node-id]').getAttribute('transform')===${JSON.stringify(edited)}`))throw new Error('Manual edit overwritten');
   report.status='awaiting_selection';finish({kind:'project',report,files:[]});await wait();
   await js(`Array.from(document.querySelectorAll('.workspace-view-tabs button')).find(b=>b.textContent==='圖表清單').click()`);await wait();
   await until(`document.querySelectorAll('.view-choice input:not(:disabled)').length===2`);
   if(!await js(`Array.from(document.querySelectorAll('.view-choice input')).every(i=>!i.checked)`))throw new Error('Selection was not cleared');
   // Same analysis can be used for a later, smaller batch.
   await js(`document.querySelectorAll('.view-choice input')[1].click()`);await wait();
   await js(`Array.from(document.querySelectorAll('.view-selection-bar button')).find(b=>b.textContent==='產生所選 1 張圖').click()`);await wait();
   if(drawCalls!==2||selectedRequest.viewIds.length!==1||selectedRequest.viewIds[0]!==views[1].id)throw new Error('Later batch reran other views');
   finish({kind:'project',report,files:[]});await wait();
   await js(`Array.from(document.querySelectorAll('.workspace-view-tabs button')).find(b=>b.textContent==='圖表畫布').click()`);await wait();
   const flowIds=await js(`Array.from(document.querySelector('#completed-flow').options).map(o=>o.value).filter(Boolean)`);
   for(const id of [flowIds[1],flowIds[0]]){await js(`{const select=document.querySelector('#completed-flow');select.value=${JSON.stringify(id)};select.dispatchEvent(new Event('change',{bubbles:true}));}`);await wait();}
   if(!await js(`document.querySelector('[data-node-id]').getAttribute('transform')===${JSON.stringify(edited)}`))throw new Error('Edited diagram reverted when switching views');
   const fileSource=`@startuml\n' original comment\ncomponent "Local API" as api\n@enduml`;let prepared,saves=0;
   ipcMain.removeHandler('ai:openPuml');ipcMain.handle('ai:openPuml',()=>({id:'test-file',name:'repo.puml',source:fileSource}));
   ipcMain.removeHandler('ai:preparePuml');ipcMain.handle('ai:preparePuml',(_e,r)=>{prepared=r;return {token:'plan',name:'repo.puml',before:fileSource,after:r.source};});
   ipcMain.removeHandler('ai:savePuml');ipcMain.handle('ai:savePuml',()=>{saves++;return {id:'saved',name:'repo.puml',source:prepared.source};});
   await js(`Array.from(document.querySelectorAll('.puml-file-actions button')).find(b=>b.textContent==='開啟 PUML').click()`);await wait();
   if(!await js(`document.querySelector('#puml-source').value.includes('original comment')`))throw new Error('Native PUML open failed');
   await js(`document.querySelector('.puml-footer .primary').click()`);await wait();
   await js(`Array.from(document.querySelectorAll('.puml-file-actions button')).find(b=>b.textContent==='儲存 PUML').click()`);await wait();
   if(prepared.source!==fileSource||saves!==0)throw new Error('Original PUML text changed or saved before preview');
   for(const width of [1440,768,375]){win.setContentSize(width,940);await wait();if(!await js(`document.documentElement.scrollWidth<=window.innerWidth`))throw new Error('Save preview overflow');require('node:fs').writeFileSync(path.join(require('node:os').tmpdir(),`modelgraph-save-${width}.png`),(await win.webContents.capturePage()).toPNG());}
   await js(`Array.from(document.querySelectorAll('dialog button')).find(b=>b.textContent==='確認儲存').click()`);await wait();if(saves!==1)throw new Error('Save confirmation failed');
   console.log('Selective views Electron test passed:',JSON.stringify({legacyRestore:true,defaultSelection:0,selectedOnly:2,laterBatch:1,streamingSync:true,editPreserved:true,responsiveWidths:[1440,1024,768,600,375]}));clearTimeout(timeout);app.exit(0);
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
      // Canvas PUML is already canonical, so 格式化 must leave it byte for byte identical.
      const beforeFormat = await win.webContents.executeJavaScript(`document.querySelector('#puml-source').value`);
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.puml-actions button')).find(b => b.textContent.includes('格式化')).click()`);
      await new Promise(resolve => setTimeout(resolve, 120));
      const afterFormat = await win.webContents.executeJavaScript(`document.querySelector('#puml-source').value`);
      if (afterFormat !== beforeFormat) throw new Error('格式化 changed canonical canvas PUML');
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
      const storyMode=await win.webContents.executeJavaScript(`document.querySelector('[aria-label="操作方式"]')===null && !document.querySelector('.provider-settings').open`);
      await win.webContents.executeJavaScript(`(()=>{const select=document.querySelector('[aria-label="Flow 關係"]');select.value=select.options[1].value;select.dispatchEvent(new Event('change',{bubbles:true}));const input=document.querySelector('[aria-label="流程名稱"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Smoke flow');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await settle();
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='保存目前畫布').click()`);
      await settle();
      const flowSaved=await win.webContents.executeJavaScript(`JSON.parse(localStorage.getItem('modelgraph-flow-library-v1')).flows[0].title==='Smoke flow' && document.querySelectorAll('.edge.selected').length===1`);
      if(!storyMode||!flowSaved)throw new Error('Story mode or flow library/navigation failed');
      const saved = await awaitDownload('model-graph.puml');
      if (!saved || saved.state !== 'completed' || !saved.buffer.toString('utf8').includes('@startuml')) throw new Error('PUML download failed');
      // Image export: a node is still selected here, so this also covers clearing the highlight first.
      const clickExport = label => win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.export-options button')).find(b=>b.textContent.includes('${label}')).click()`);
      await clickExport('SVG'); await clickExport('PNG'); await clickExport('JPG');
      const [svgFile, pngFile, jpgFile] = await Promise.all([awaitDownload('model-graph-architecture.svg'), awaitDownload('model-graph-architecture.png'), awaitDownload('model-graph-architecture.jpg')]);
      for (const [name, file] of [['svg', svgFile], ['png', pngFile], ['jpg', jpgFile]]) {
        if (!file || file.state !== 'completed' || !file.buffer.length) throw new Error(`Image export failed: ${name}`);
      }
      const svgText = svgFile.buffer.toString('utf8');
      if (!svgText.includes('<svg') || !svgText.includes('viewBox=') || !svgText.includes('data-node-id')) throw new Error('Exported SVG is missing the graph');
      if (!svgText.includes('fill:') || !svgText.includes('font-family:')) throw new Error('Exported SVG lost its stylesheet');
      if (svgText.includes('class="port"') || svgText.includes('wire-preview')) throw new Error('Exported SVG kept editor-only handles');
      // #4c7c60 is the selected/focus-visible node stroke, #749887 the hover stroke. A node is
      // focused and hovered at this point, so this guards the detached-stage style resolution.
      if (svgText.includes('rgb(76, 124, 96)') || svgText.includes('rgb(116, 152, 135)')) throw new Error('Exported SVG baked in a selection, focus or hover highlight');
      if (!pngFile.buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) throw new Error('PNG export is not a PNG');
      if (!jpgFile.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) throw new Error('JPG export is not a JPEG');
      const imageExport = { svg: svgFile.buffer.length, png: pngFile.buffer.length, jpg: jpgFile.buffer.length };
      // Collapsing panels must widen the canvas and survive a reload.
      const canvasWidth = () => win.webContents.executeJavaScript(`document.querySelector('.graph-canvas').getBoundingClientRect().width`);
      const openWidth = await canvasWidth();
      await win.webContents.executeJavaScript(`document.querySelector('[aria-label="專注模式"]').click()`); await settle(); await settle();
      const focused = await win.webContents.executeJavaScript(`(()=>({cls:document.querySelector('.workspace').className,chrome:document.querySelector('.canvas-panel').className.includes('chrome-hidden'),peek:getComputedStyle(document.querySelector('.chrome-peek')).display,stored:localStorage.getItem('modelgraph-panels-v1'),type:Boolean(document.querySelector('#diagram-type')),flow:Boolean(document.querySelector('[aria-label="Flow 關係"]'))}))()`);
      const focusWidth = await canvasWidth();
      if (!focused.cls.includes('no-left') || !focused.cls.includes('no-right') || !focused.chrome) throw new Error('Focus mode did not collapse the panels');
      if (focused.peek === 'none') throw new Error('Collapsed chrome left no way back');
      if (!focused.type || !focused.flow) throw new Error('Collapsed chrome unmounted controls instead of hiding them');
      if (JSON.parse(focused.stored).left !== false) throw new Error('Panel state was not persisted');
      if (!(focusWidth > openWidth + 200)) throw new Error(`Focus mode did not widen the canvas: ${openWidth} -> ${focusWidth}`);
      await win.webContents.executeJavaScript(`document.querySelector('[aria-label="專注模式"]').click()`); await settle(); await settle();
      const restoredWidth = await canvasWidth();
      if (Math.abs(restoredWidth - openWidth) > 1) throw new Error(`Focus mode did not restore the layout: ${openWidth} -> ${restoredWidth}`);
      const panelCollapse = { openWidth: Math.round(openWidth), focusWidth: Math.round(focusWidth) };
      // The 檔案/檢視 menu items drive the renderer through aria-labels; verify that wiring end to end.
      const menu = Menu.getApplicationMenu();
      const item = id => { const found = menu.getMenuItemById(id); if (!found) throw new Error(`Menu item missing: ${id}`); return found; };
      item('focus-mode').click(); await settle(); await settle();
      if (!(await win.webContents.executeJavaScript(`document.querySelector('.workspace').className.includes('no-left')`))) throw new Error('檢視 → 專注模式 menu item did not reach the renderer');
      item('focus-mode').click(); await settle(); await settle();
      if (await win.webContents.executeJavaScript(`document.querySelector('.workspace').className.includes('no-left')`)) throw new Error('檢視 → 專注模式 menu item did not toggle back');
      item('export-jpg').click();
      const menuExport = await awaitDownload('model-graph-architecture.jpg');
      if (!menuExport || menuExport.state !== 'completed') throw new Error('檔案 → 匯出 JPG menu item did not produce a file');
      const menuWiring = { focusMode: true, exportJpg: menuExport.buffer.length };
      console.log('Desktop smoke test passed:', JSON.stringify({ ...result, pumlDownload: true, redoPreserved, aiBridge: true, unifiedComposer, providerSaved, storyMode, flowSaved, pumlFormat: true, imageExport, panelCollapse, menuWiring }));
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
        const name = item.getFilename();
        const destination = path.join(app.getPath('userData'), `smoke-${name}`);
        item.setSavePath(destination);
        item.once('done', (_event, state) => {
          const { readFileSync } = require('node:fs');
          try { recordDownload(name, { state, buffer: readFileSync(destination) }); }
          catch { recordDownload(name, { state: 'failed', buffer: Buffer.alloc(0) }); }
        });
      } else {
        item.setSaveDialogOptions({ title: '儲存圖檔', defaultPath: item.getFilename() });
        // Without this the renderer keeps claiming the export succeeded when nothing reached disk.
        item.once('done', (_doneEvent, state) => {
          if (state === 'completed' || state === 'cancelled') return;
          dialog.showErrorBox('儲存失敗', `${item.getFilename()} 沒有寫入完成（${state}）。請確認磁碟空間與資料夾權限後再試一次。`);
        });
      }
    });
    const clickControl = label => window?.webContents.executeJavaScript(`document.querySelector('[aria-label=${JSON.stringify(label)}]')?.click()`);
    const template = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: '檔案', submenu: [
        { label: '匯入圖檔…', accelerator: 'CmdOrCtrl+O', click: () => clickControl('匯入 JSON 或 PUML') },
        { type: 'separator' },
        { id: 'export-png', label: '匯出 PNG 圖片…', accelerator: 'CmdOrCtrl+S', click: () => clickControl('匯出 PNG') },
        { id: 'export-jpg', label: '匯出 JPG 圖片…', click: () => clickControl('匯出 JPG') },
        { id: 'export-svg', label: '匯出 SVG 向量圖…', accelerator: 'CmdOrCtrl+Shift+S', click: () => clickControl('匯出 SVG') },
        { id: 'export-json', label: '匯出 JSON 圖檔…', click: () => clickControl('匯出 JSON') },
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' }] },
      { role: 'editMenu' },
      { label: '檢視', submenu: [{ id: 'focus-mode', label: '專注模式', accelerator: 'CmdOrCtrl+\\', click: () => clickControl('專注模式') }, { type: 'separator' }, { role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
      { role: 'windowMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { console.error(error); app.exit(1); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
