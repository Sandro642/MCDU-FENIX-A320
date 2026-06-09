const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fenix', {
  check: (host) => ipcRenderer.invoke('check-fenix', host),
  localIps: () => ipcRenderer.invoke('get-local-ip')
});
