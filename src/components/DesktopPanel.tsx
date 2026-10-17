import React, { useEffect, useState } from 'react';
import { Monitor, FolderOpen, Download, RefreshCw, Cookie, X, Cpu, Check, Coffee, Upload, Trash2 } from 'lucide-react';
import {
  getDesktop,
  isDesktop,
  COOKIE_BROWSERS,
  DesktopSettings,
  EngineInfo,
  UpdateStatus,
} from '../desktop';

const SUPPORT_URL = 'https://flutterwave.com/donate/fysqhtbnfznn';

/**
 * Floating desktop control panel. Only renders inside the packaged Electron
 * shell; in a plain browser it returns null and stays out of the way.
 */
export const DesktopPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [settings, setSettings] = useState<DesktopSettings>({});
  const [browser, setBrowser] = useState('');
  const [cookiesFile, setCookiesFile] = useState('');
  const [saved, setSaved] = useState(false);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    const bridge = getDesktop();
    if (!bridge) return;
    bridge.getVersion().then(setVersion).catch(() => {});
    bridge.getEngineInfo().then(setEngine).catch(() => {});
    bridge
      .getSettings()
      .then((s) => {
        setSettings(s);
        setBrowser(s.cookiesFromBrowser || '');
        setCookiesFile(s.cookiesFile || '');
      })
      .catch(() => {});
    const off = bridge.onUpdate((status) => setUpdate(status));
    return off;
  }, []);

  // Other parts of the UI (e.g. a failed extraction) can ask the panel to open.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('fgc:open-desktop', handler);
    return () => window.removeEventListener('fgc:open-desktop', handler);
  }, []);

  if (!isDesktop()) return null;

  const save = async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    await bridge.setSettings({ cookiesFromBrowser: browser });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const openSupport = () => {
    const bridge = getDesktop();
    if (bridge) bridge.openExternal(SUPPORT_URL);
    else window.open(SUPPORT_URL, '_blank', 'noopener');
  };

  const importCookies = async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    const res = await bridge.pickCookiesFile();
    if (res.ok && res.path) {
      setCookiesFile(res.path);
      setSettings((s) => ({ ...s, cookiesFile: res.path }));
    }
  };

  const clearCookies = async () => {
    const bridge = getDesktop();
    if (!bridge) return;
    await bridge.clearCookies();
    setCookiesFile('');
    setSettings((s) => ({ ...s, cookiesFile: '' }));
  };

  const cookieFileName = cookiesFile ? cookiesFile.split(/[\\/]/).pop() : '';

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Desktop options"
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 px-3.5 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg shadow-indigo-900/40 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 transition-all border border-white/15 no-print"
      >
        <Monitor className="w-4 h-4" />
        <span className="hidden sm:inline">Desktop</span>
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[61] w-[360px] max-w-[92vw] rounded-2xl border border-slate-700/70 bg-slate-900/97 backdrop-blur-xl shadow-2xl shadow-black/50 no-print">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-cyan-300" />
              <span className="text-sm font-semibold text-white">Desktop</span>
              {version && <span className="text-[10px] font-mono text-slate-400">v{version}</span>}
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Storage */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Storage</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => getDesktop()?.openOutputFolder()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-300" />
                  Downloads
                </button>
                <button
                  onClick={() => getDesktop()?.openDataFolder()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-300" />
                  Data folder
                </button>
              </div>
            </div>

            {/* Facebook login via browser cookies */}
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Cookie className="w-3.5 h-3.5" /> Facebook login
              </p>
              <select
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {COOKIE_BROWSERS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <p className="text-[10.5px] leading-relaxed text-slate-500">
                Reuses your own logged-in browser session — the most reliable fix for private or blocked
                videos. No files to export.
              </p>
              <button
                onClick={save}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Saved
                  </>
                ) : (
                  'Save login setting'
                )}
              </button>

              {/* cookies.txt fallback — Chrome/Edge lock their cookie DB */}
              <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
                <p className="text-[10.5px] leading-relaxed text-slate-500">
                  Chrome or Edge replying <em>“Could not copy cookie database”</em>? Those browsers lock
                  it with App-Bound Encryption. Import a{' '}
                  <span className="text-slate-400 font-medium">cookies.txt</span> instead — it takes
                  priority and just works.
                </p>
                {cookieFileName && (
                  <p className="flex items-center gap-1.5 text-[10.5px] text-emerald-300">
                    <Check className="w-3 h-3" /> Using {cookieFileName}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={importCookies}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-300" /> Import cookies.txt
                  </button>
                  <button
                    onClick={clearCookies}
                    disabled={!cookiesFile}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-300" /> Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Engine + updates */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              {engine && (
                <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-mono">
                  <Cpu className="w-3.5 h-3.5" /> engine :{engine.port} · {engine.packaged ? 'packaged' : 'dev'}
                </p>
              )}
              <p className="text-[10px] text-slate-600 leading-relaxed">
                FacebookGrabContents — by Valentine Onuchukwu
                <br />
                ProsperChild Technology, Nigeria
                <br />
                valentineonuchukwu@gmail.com
              </p>
              <button
                onClick={openSupport}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-colors border border-amber-400/30"
              >
                <Coffee className="w-3.5 h-3.5" /> Buy me a coffee
              </button>
              <button
                onClick={() => getDesktop()?.checkForUpdates()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Check for updates
              </button>
              {update && (
                <p className="text-[10.5px] text-slate-400">
                  {update.state === 'available' && `Update ${update.version} found — downloading…`}
                  {update.state === 'downloaded' && `Update ${update.version} ready — restart to install.`}
                  {update.state === 'error' && 'Update check failed.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
