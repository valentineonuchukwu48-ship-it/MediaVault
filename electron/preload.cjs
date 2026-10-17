'use strict';

/**
 * Preload bridge. Exposes a deliberately small, typed surface to the renderer
 * over contextBridge — the UI never gets raw Node/Electron access.
 */
const { contextBridge, ipcRenderer } = require('electron');

const api = {
  isDesktop: true,
  platform: process.platform,

  getVersion: () => ipcRenderer.invoke('app:version'),
  getEngineInfo: () => ipcRenderer.invoke('app:engineInfo'),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  openOutputFolder: () => ipcRenderer.invoke('app:openOutputFolder'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),

  /** Import a cookies.txt file (login fallback when browser cookies are locked). */
  pickCookiesFile: () => ipcRenderer.invoke('cookies:pick'),
  clearCookies: () => ipcRenderer.invoke('cookies:clear'),

  /** Subscribe to update progress. Returns an unsubscribe function. */
  onUpdate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update:status', handler);
    return () => ipcRenderer.removeListener('update:status', handler);
  },

  /** Subscribe to startup progress (splash only). */
  onStartupProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('startup:progress', handler);
    return () => ipcRenderer.removeListener('startup:progress', handler);
  },
};

contextBridge.exposeInMainWorld('desktop', api);
