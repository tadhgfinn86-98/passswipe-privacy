'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only bridge between the UI and the disk. Everything is an explicit,
// named call — the renderer gets no direct filesystem or Node access.
contextBridge.exposeInMainWorld('terminal', {
  isDesktop: true,
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  importData: () => ipcRenderer.invoke('data:import'),
  exportCsv: (csv, name) => ipcRenderer.invoke('data:exportCsv', csv, name),
  importCsv: () => ipcRenderer.invoke('data:importCsv'),
  revealDataFile: () => ipcRenderer.invoke('data:reveal'),
  appInfo: () => ipcRenderer.invoke('app:info'),
});
