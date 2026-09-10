const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('modelGraphAI',{
 folder:()=>ipcRenderer.invoke('ai:folder'),
 executable:()=>ipcRenderer.invoke('ai:executable'),
 check:(provider,custom)=>ipcRenderer.invoke('ai:check',provider,custom),
 generate:request=>ipcRenderer.invoke('ai:generate',request),
 cancel:()=>ipcRenderer.invoke('ai:cancel'),
});
