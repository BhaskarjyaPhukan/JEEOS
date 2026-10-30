const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ascentApp', {
  // title bar: the page tells the app which colours the window buttons should use
  setTitleBar: (bg, fg, page) => ipcRenderer.send('titlebar', bg, fg, page),
  // automatic backup
  backupNow: (text, label) => ipcRenderer.invoke('bk:now', text, label),
  backupInfo: () => ipcRenderer.invoke('bk:info'),
  backupChoose: () => ipcRenderer.invoke('bk:choose'),
  backupOpen: () => ipcRenderer.invoke('bk:open'),
  backupRead: (name) => ipcRenderer.invoke('bk:read', name),
  backupPickFile: () => ipcRenderer.invoke('bk:pick'),
  backupQuiet: (text) => ipcRenderer.sendSync('bk:quiet', text),
  // app updates
  updateState: () => ipcRenderer.invoke('update:state'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, st) => { try { cb(st); } catch (e) {} })
});
