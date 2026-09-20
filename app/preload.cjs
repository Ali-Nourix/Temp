const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  defaults: () => ipcRenderer.invoke('defaults'),
  pickInputs: (kind) => ipcRenderer.invoke('pick-inputs', kind),
  pickOutput: () => ipcRenderer.invoke('pick-output'),
  convert: (request) => ipcRenderer.invoke('convert', request),
  cancel: () => ipcRenderer.invoke('cancel'),
  openFolder: (folder) => ipcRenderer.invoke('open-folder', folder),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onRunStarted: (handler) => ipcRenderer.on('run-started', (_event, data) => handler(data)),
  onProgress: (handler) => ipcRenderer.on('run-progress', (_event, outcome) => handler(outcome)),
});
