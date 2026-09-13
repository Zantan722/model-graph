const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('modelGraphAI',{
 openPuml:()=>ipcRenderer.invoke('ai:openPuml'),
 preparePuml:request=>ipcRenderer.invoke('ai:preparePuml',request),
 savePuml:token=>ipcRenderer.invoke('ai:savePuml',token),
 cancelPuml:token=>ipcRenderer.invoke('ai:cancelPuml',token),
 report:()=>ipcRenderer.invoke('ai:report'),
 onProgress:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('ai:progress',listener);return ()=>ipcRenderer.removeListener('ai:progress',listener);},
 folder:()=>ipcRenderer.invoke('ai:folder'),
 executable:()=>ipcRenderer.invoke('ai:executable'),
 check:(provider,custom)=>ipcRenderer.invoke('ai:check',provider,custom),
 generateViews:request=>ipcRenderer.invoke('ai:generateViews',request),
 generate:request=>ipcRenderer.invoke('ai:generate',request),
 cancel:()=>ipcRenderer.invoke('ai:cancel'),
});
