'use strict';

/**
 * FacebookGrabContents — desktop shell (Electron main process).
 *
 * Responsibilities
 *  - show a branded splash with a live progress bar while the engine boots
 *  - start the bundled Express engine as an isolated child process
 *  - wait for a real health check, then reveal the main window
 *  - expose a tiny, safe API to the UI (open folders, settings, updates)
 *  - keep everything writable inside the per-user data directory
 */

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const IS_DEV = !app.isPackaged;
const PROJECT_ROOT = path.join(__dirname, '..');
const APP_NAME = 'FacebookGrabContents';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
function resolveRoots() {
  if (app.isPackaged) {
    // asar is disabled, so the app is a plain folder under resources/.
    const root = path.join(process.resourcesPath, 'app');
    return {
      appRoot: root,
      distDir: path.join(root, 'dist'),
      publicDir: path.join(root, 'public'),
      binDir: path.join(process.resourcesPath, 'bin'),
      serverEntry: path.join(root, 'build', 'server.mjs'),
      splash: path.join(root, 'electron', 'splash.html'),
    };
  }
  return {
    appRoot: PROJECT_ROOT,
    distDir: path.join(PROJECT_ROOT, 'dist'),
    publicDir: path.join(PROJECT_ROOT, 'public'),
    binDir: path.join(PROJECT_ROOT, 'bin'),
    serverEntry: path.join(PROJECT_ROOT, 'build', 'server.mjs'),
    splash: path.join(PROJECT_ROOT, 'electron', 'splash.html'),
  };
}

const ROOTS = resolveRoots();
const DATA_DIR = path.join(app.getPath('userData'), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* best effort */
  }
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  ensureDir(DATA_DIR);
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch {
    /* ignore */
  }
  return next;
}

// ---------------------------------------------------------------------------
// Engine lifecycle
// ---------------------------------------------------------------------------
let engine = null;
let enginePort = 0;
let mainWindow = null;
let splashWindow = null;
let quitting = false;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function engineEnv(port) {
  const settings = readSettings();
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    HOST: '127.0.0.1',
    FGC_DESKTOP: '1',
    FGC_APP_ROOT: ROOTS.appRoot,
    FGC_DATA_DIR: DATA_DIR,
    FGC_BIN_DIR: ROOTS.binDir,
    FGC_DIST_DIR: ROOTS.distDir,
    FGC_PUBLIC_DIR: ROOTS.publicDir,
  };
  if (settings.cookiesFromBrowser) env.YTDLP_COOKIES_FROM_BROWSER = settings.cookiesFromBrowser;
  if (settings.cookiesFile) env.YTDLP_COOKIES = settings.cookiesFile;
  if (settings.geminiApiKey) env.GEMINI_API_KEY = settings.geminiApiKey;
  return env;
}

function setProgress(pct, label) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('startup:progress', { pct, label });
  }
}

function startEngine(port) {
  const child = spawn(process.execPath, [ROOTS.serverEntry], {
    cwd: ROOTS.appRoot,
    env: engineEnv(port),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.on('data', (d) => process.stdout.write(`[engine] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[engine] ${d}`));
  child.on('exit', (code) => {
    engine = null;
    if (!quitting && code !== 0) {
      dialog.showErrorBox(
        `${APP_NAME} — engine stopped`,
        `The background engine exited unexpectedly (code ${code}).\n\nTry restarting the app.`
      );
    }
  });
  return child;
}

function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) return reject(new Error(`Engine did not become ready within ${timeoutMs}ms`));
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 2000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else setTimeout(attempt, 350);
      });
      req.on('error', () => setTimeout(attempt, 350));
      req.on('timeout', () => {
        req.destroy();
        setTimeout(attempt, 350);
      });
    };
    attempt();
  });
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    resizable: false,
    show: false,
    center: true,
    backgroundColor: '#0b1020',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  splashWindow.loadFile(ROOTS.splash);
  splashWindow.once('ready-to-show', () => splashWindow.show());
  return splashWindow;
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b1020',
    title: APP_NAME,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  // Keep the author credit in the OS title bar, even though the page sets its
  // own <title> once it loads.
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(`${APP_NAME} — by ProsperChild Technology`);
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
    mainWindow.show();
    mainWindow.focus();
  });

  // Never navigate the app window away; open real links in the OS browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open data folder', click: () => shell.openPath(DATA_DIR) },
        { label: 'Open downloads folder', click: () => shell.openPath(path.join(DATA_DIR, 'merged_outputs')) },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: `About ${APP_NAME}`, click: () => showAbout() },
        { label: 'Check for updates…', click: () => checkForUpdates(true) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: `About ${APP_NAME}`,
    message: `${APP_NAME} ${app.getVersion()}`,
    detail:
      `Facebook post archiver + video downloader/merger.\n\n` +
      `Created by Valentine Onuchukwu\n` +
      `ProsperChild Technology — Nigeria\n` +
      `✉  valentineonuchukwu@gmail.com\n` +
      `☕  https://flutterwave.com/donate/fysqhtbnfznn\n\n` +
      `Engine: 127.0.0.1:${enginePort}\nData folder: ${DATA_DIR}\n` +
      `Electron ${process.versions.electron} · Chromium ${process.versions.chrome} · Node ${process.versions.node}`,
    buttons: ['OK'],
  });
}

// ---------------------------------------------------------------------------
// Auto-update (no-op unless packaged and a release exists)
// ---------------------------------------------------------------------------
function checkForUpdates(interactive) {
  if (!app.isPackaged) {
    if (interactive) dialog.showMessageBox({ type: 'info', message: 'Updates are only checked in the installed build.' });
    return;
  }
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return;
  }

  // Unpacked (--dir) builds have no app-update.yml, so electron-updater would
  // throw an ENOENT into the console. Stay quiet in that case.
  if (!fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'))) {
    if (interactive) {
      dialog.showMessageBox({ type: 'info', message: 'This build has no update channel configured.' });
    }
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update:status', { state: 'available', version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update:status', { state: 'downloaded', version: info.version });
    dialog
      .showMessageBox({
        type: 'info',
        message: `Update ${info.version} is ready`,
        detail: 'Restart now to install it?',
        buttons: ['Restart', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) autoUpdater.quitAndInstall();
      });
  });
  autoUpdater.on('error', () => {
    if (interactive && mainWindow) mainWindow.webContents.send('update:status', { state: 'error' });
  });
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  ensureDir(DATA_DIR);
  setProgress(8, 'Preparing…');

  if (!fs.existsSync(ROOTS.serverEntry)) {
    dialog.showErrorBox(
      `${APP_NAME} — not built`,
      `The engine bundle is missing:\n${ROOTS.serverEntry}\n\nRun "npm run build" first.`
    );
    app.quit();
    return;
  }

  enginePort = await getFreePort();
  setProgress(22, 'Starting background engine…');
  engine = startEngine(enginePort);

  setProgress(48, 'Warming up media tools…');
  try {
    await waitForHealth(enginePort, 45000);
  } catch (err) {
    setProgress(100, 'Failed');
    dialog.showErrorBox(`${APP_NAME} — startup failed`, String(err && err.message ? err.message : err));
    app.quit();
    return;
  }

  setProgress(86, 'Loading interface…');
  createMainWindow(enginePort);
  setProgress(100, 'Ready');

  setTimeout(() => checkForUpdates(false), 4000);
}

// ---------------------------------------------------------------------------
// IPC — small, explicit surface for the renderer
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:engineInfo', () => ({ port: enginePort, dataDir: DATA_DIR, packaged: app.isPackaged }));
  ipcMain.handle('app:openDataFolder', () => shell.openPath(DATA_DIR));
  ipcMain.handle('app:openOutputFolder', () => shell.openPath(path.join(DATA_DIR, 'merged_outputs')));
  ipcMain.handle('app:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^https?:/i.test(url)) return shell.openExternal(url);
    return false;
  });
  ipcMain.handle('settings:get', () => readSettings());
  ipcMain.handle('settings:set', (_e, patch) => {
    const saved = writeSettings(patch || {});
    // Cookie/browser choice only needs an engine restart if the user wants it now;
    // the engine also reads settings.json live for cookie lookups.
    return saved;
  });

  // Import a Netscape-format cookies.txt exported from the browser. This is the
  // reliable fallback when Chrome 127+'s App-Bound Encryption blocks
  // --cookies-from-browser ("Could not copy Chrome cookie database").
  ipcMain.handle('cookies:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: 'Select a cookies.txt file',
      properties: ['openFile'],
      filters: [
        { name: 'Cookies file', extensions: ['txt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    const src = result.filePaths[0];
    try {
      const dest = path.join(DATA_DIR, 'cookies.txt');
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.copyFileSync(src, dest);
      writeSettings({ cookiesFile: dest });
      return { ok: true, path: dest, name: path.basename(src) };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });

  ipcMain.handle('cookies:clear', () => {
    const dest = path.join(DATA_DIR, 'cookies.txt');
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* already gone */
    }
    writeSettings({ cookiesFile: '' });
    return { ok: true };
  });

  ipcMain.handle('app:checkForUpdates', () => checkForUpdates(true));
}

// ---------------------------------------------------------------------------
// App wiring
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerIpc();
    createSplash();
    buildMenu();
    boot();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && enginePort) createMainWindow(enginePort);
    });
  });

  app.on('window-all-closed', () => {
    app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    if (engine && !engine.killed) {
      try {
        engine.kill();
      } catch {
        /* ignore */
      }
    }
  });
}
