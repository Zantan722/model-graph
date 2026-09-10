const { app, BrowserWindow, Menu, protocol, net, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveAsset } = require('./protocol.cjs');

const smoke = process.argv.includes('--smoke-test');
if (smoke) {
  // Test runs never read or overwrite the user's saved diagrams.
  const { mkdtempSync } = require('node:fs');
  app.setPath('userData', mkdtempSync(path.join(require('node:os').tmpdir(), 'model-graph-smoke-')));
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
  if (smoke) runSmoke(window);
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
      const saved = await downloadResult;
      if (!saved) throw new Error('PUML download failed');
      console.log('Desktop smoke test passed:', JSON.stringify({ ...result, pumlDownload: true, redoPreserved, aiBridge: true, unifiedComposer, providerSaved }));
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
