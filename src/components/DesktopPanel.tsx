import React, { useEffect, useState } from 'react';
import { Monitor, FolderOpen, Download, RefreshCw, Cookie, X, Cpu, Check, Coffee, Upload, Trash2, Smartphone, Wifi, ShieldCheck, Anchor, FileSpreadsheet, Hourglass, ExternalLink } from 'lucide-react';
import {
  getDesktop,
  isDesktop,
  COOKIE_BROWSERS,
  DesktopSettings,
  EngineInfo,
  UpdateStatus,
  PhoneConnectResult,
} from '../desktop';
import { generateQrDataUrl } from '../utils/qr';

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
  const [phoneConnect, setPhoneConnect] = useState(false);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [vaultInfo, setVaultInfo] = useState<{ entries: number; integrity: string } | null>(null);
  const [stampsInfo, setStampsInfo] = useState<{ entries: number; stamped: number; anchored: number; pending: number } | null>(null);
  const [stampBusy, setStampBusy] = useState('');
  const [stampMsg, setStampMsg] = useState('');

  const refreshStamps = async () => {
    try {
      const res = await fetch('/api/vault/stamps');
      if (!res.ok) return;
      const info = await res.json();
      setStampsInfo(info.overview || null);
    } catch {
      /* engine offline */
    }
  };

  const saveBlob = async (url: string, filename: string) => {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 4000);
    return true;
  };

  // Ask the engine what LAN URL it currently serves (empty while disabled).
  const refreshLanInfo = async () => {
    try {
      const res = await fetch('/api/lan-info');
      if (!res.ok) return;
      const info = await res.json();
      setPhoneConnect(!!info.enabled);
      setLanUrls(Array.isArray(info.urls) ? info.urls : []);
      setPairCode(info.pairCode || '');
      setQrUrl(info.urls && info.urls[0] ? await generateQrDataUrl(info.urls[0]) : '');
    } catch {
      /* engine may be mid-restart; the toggle re-queries */
    }
  };

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
    refreshLanInfo();
    refreshStamps();
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => setVaultInfo(info?.vault || null))
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

  // Full corpus + independent re-verification code in one portable HTML file.
  const downloadVerifier = async () => {
    try {
      const res = await fetch('/api/vault/verifier');
      if (!res.ok) return;
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `mediavault-verifier-${stamp}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 4000);
    } catch {
      /* engine unreachable — nothing sensible to do inside the panel */
    }
  };

  // ---- Court-grade time proof (public Bitcoin anchoring) ----
  const stampNow = async () => {
    if (stampBusy) return;
    setStampBusy('stamp');
    setStampMsg('');
    try {
      const res = await fetch('/api/vault/stamp', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setStampMsg(res.ok && data.success ? `Submitted ${data.stamped} entr${data.stamped === 1 ? 'y' : 'ies'} to the public calendar — Bitcoin anchor lands within a few hours.` : data.error || 'Submission failed — try again.');
      await refreshStamps();
    } catch {
      setStampMsg('Engine unreachable — try again.');
    }
    setStampBusy('');
  };

  const upgradeReceipts = async () => {
    if (stampBusy) return;
    setStampBusy('upgrade');
    setStampMsg('');
    try {
      const res = await fetch('/api/vault/stamp/upgrade', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStampMsg(data.pending > 0 ? `${data.pending} still pending — the calendars publish Bitcoin anchors in batches; check again later or let the app upgrade silently.` : `All ${data.anchored} receipt${data.anchored === 1 ? '' : 's'} anchored in Bitcoin blocks.`);
      } else {
        setStampMsg(data.error || 'Upgrade failed — try again later.');
      }
      await refreshStamps();
    } catch {
      setStampMsg('Engine unreachable — try again.');
    }
    setStampBusy('');
  };

  const downloadTimeProofZip = async () => {
    if (stampBusy) return;
    setStampBusy('zip');
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let ok = false;
    try {
      ok = await saveBlob('/api/vault/stamps/download-all', `mediavault-time-proof-${day}.zip`);
    } catch {
      ok = false;
    }
    if (!ok) setStampMsg('Nothing stamped yet — anchor the vault first.');
    setStampBusy('');
  };

  const exportRecordsCsv = async () => {
    if (stampBusy) return;
    setStampBusy('csv');
    let ok = false;
    try {
      ok = await saveBlob('/api/vault/export.csv', `mediavault-records-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      ok = false;
    }
    if (!ok) setStampMsg('Export failed — is the engine running?');
    setStampBusy('');
  };

  const cookieFileName = cookiesFile ? cookiesFile.split(/[\\/]/).pop() : '';

  const togglePhoneConnect = async () => {
    const bridge = getDesktop();
    if (!bridge || phoneBusy) return;
    setPhoneBusy(true);
    setPhoneError('');
    const next = !phoneConnect;
    try {
      const res: PhoneConnectResult = await bridge.setPhoneConnect(next);
      if (res.ok) {
        setPhoneConnect(next);
        await refreshLanInfo();
      } else {
        setPhoneError(res.error || 'Could not restart the engine. Try restarting the app.');
      }
    } catch (err: any) {
      setPhoneError(String(err?.message || err) || 'Failed to change Phone Connect.');
    }
    setPhoneBusy(false);
  };

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
        <div className="fixed bottom-20 right-5 z-[61] w-[360px] max-w-[92vw] max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-700/70 bg-slate-900/97 backdrop-blur-xl shadow-2xl shadow-black/50 no-print">
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

            {/* Evidence Vault — integrity + zero-trust verifier */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Evidence vault
              </p>
              {vaultInfo && (
                <p className={`flex items-center gap-1.5 text-[11px] ${vaultInfo.integrity === 'valid' ? 'text-emerald-300' : 'text-rose-300'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {vaultInfo.entries} sealed entr{vaultInfo.entries === 1 ? 'y' : 'ies'} · chain {vaultInfo.integrity}
                </p>
              )}
              <button
                onClick={downloadVerifier}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
              >
                <Download className="w-3.5 h-3.5 text-emerald-300" /> Download zero-trust verifier
              </button>
              <p className="text-[10.5px] leading-relaxed text-slate-500">
                One portable <span className="text-slate-400">.html</span> file: anyone can open it
                (lawyer, court, journalist) and re-verify every sealed archive themselves — in their
                browser, with no install, no account, no trust in this app.
              </p>

              {/* Court-grade time proof — public Bitcoin anchoring (v1.4.0) */}
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    <Anchor className="w-3.5 h-3.5" /> Court-grade time proof
                  </p>
                  {stampsInfo && stampsInfo.stamped > 0 && (
                    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                      stampsInfo.pending > 0
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}>
                      {stampsInfo.pending > 0 ? <Hourglass className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                      {stampsInfo.anchored}/{stampsInfo.stamped} anchored
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-500">
                  Stamps every sealed entry into the <span className="text-slate-300">free public Bitcoin calendar</span>
                  {' '}— anyone can prove your archive existed on a real date with official tools,
                  without trusting this app.
                </p>
                <button
                  onClick={stampNow}
                  disabled={!!stampBusy}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  {stampBusy === 'stamp' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting to public calendar…
                    </>
                  ) : (
                    <>
                      <Anchor className="w-3.5 h-3.5" /> Anchor vault to Bitcoin calendar (free)
                    </>
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={upgradeReceipts}
                    disabled={!!stampBusy || !stampsInfo?.pending}
                    title="Upgrade pending receipts to Bitcoin-block attestations"
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-[11px] font-medium transition-colors border border-slate-700/60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-300 ${stampBusy === 'upgrade' ? 'animate-spin' : ''}`} />
                    Upgrade receipts
                  </button>
                  <button
                    onClick={downloadTimeProofZip}
                    disabled={!!stampBusy || !stampsInfo?.stamped}
                    title="Download every receipt + preimage + how-to-verify guide (ZIP)"
                    className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-[11px] font-medium transition-colors border border-slate-700/60"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-300" /> Time-proof ZIP
                  </button>
                </div>
                {stampMsg && (
                  <p className="text-[10.5px] leading-relaxed text-amber-200/90">{stampMsg}</p>
                )}
              </div>

              {/* Records export for spreadsheets */}
              <button
                onClick={exportRecordsCsv}
                disabled={!!stampBusy}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
              >
                {stampBusy === 'csv' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-300 animate-spin" /> Exporting…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-300" /> Export records to Excel (CSV)
                  </>
                )}
              </button>
              <p className="text-[10.5px] text-slate-500">
                Every archived post, date, URL, engagement numbers and hashes in one auditable
                spreadsheet — including each entry&apos;s public Bitcoin-anchor status.
              </p>
            </div>

            {/* Phone Connect — installable mobile app over Wi-Fi */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Smartphone className="w-3.5 h-3.5" /> Phone connect
              </p>
              <p className="text-[10.5px] leading-relaxed text-slate-500">
                Mobile app mode: share this app over your Wi-Fi so the same
                mediavault experience opens (and installs) on Android and iPhone.
              </p>
              <button
                onClick={togglePhoneConnect}
                disabled={phoneBusy}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-semibold transition-colors disabled:opacity-60 ${
                  phoneConnect
                    ? 'bg-red-600/80 hover:bg-red-700'
                    : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500'
                }`}
              >
                {phoneConnect ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5" /> {phoneBusy ? 'Disconnecting…' : 'Stop sharing to phones'}
                  </>
                ) : phoneBusy ? (
                  'Starting…'
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5" /> Share to my phone
                  </>
                )}
              </button>

              {phoneError && (
                <p className="text-[10.5px] text-rose-300 leading-relaxed">{phoneError}</p>
              )}

              {phoneConnect && (
                <div className="space-y-2 rounded-xl border border-slate-700/60 bg-slate-800/60 p-3">
                  {qrUrl ? (
                    <div className="flex justify-center">
                      <img src={qrUrl} alt="Scan to open mediavault on your phone" className="rounded-lg border border-slate-700" width={176} height={176} />
                    </div>
                  ) : (
                    <p className="text-[10.5px] text-amber-300 text-center leading-relaxed">
                      No LAN address found. Is this PC connected to Wi-Fi / Ethernet?
                    </p>
                  )}
                  {lanUrls.length > 0 && (
                    <p className="text-center text-[11px] font-mono text-cyan-300 break-all">
                      {lanUrls[0].replace(/\/\?pair=[0-9]+$/, '').replace(/^https?:\/\//, '')}
                    </p>
                  )}
                  {pairCode && (
                    <p className="text-center text-[10.5px] text-slate-400">
                      Pairing code: <span className="font-mono font-semibold text-amber-300 tracking-widest">{pairCode}</span>
                      <span className="text-slate-600"> (Android APK users type this after connecting)</span>
                    </p>
                  )}
                  <p className="text-[10.5px] leading-relaxed text-slate-400">
                    1. Keep this app running and connect your phone to{' '}
                    <span className="font-semibold text-slate-300">the same Wi-Fi</span>.
                  </p>
                  <p className="text-[10.5px] leading-relaxed text-slate-400">
                    2. Point your phone camera at the code — the app opens in your
                    phone's browser.
                  </p>
                  <p className="text-[10.5px] leading-relaxed text-slate-400">
                    3. To install it like a real app: browser menu (⋮ on Android, Share→Add on
                    iPhone) → <span className="font-semibold text-slate-300">Add to Home screen</span>.
                  </p>
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Windows may ask to allow the app through the firewall the first
                    time — choose <span className="text-slate-400">Allow on private networks</span>.
                    Only devices on your own Wi-Fi can reach this address.
                  </p>
                </div>
              )}
            </div>

            {/* Engine + updates */}
            <div className="space-y-2 border-t border-slate-800 pt-3">
              {engine && (
                <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-mono">
                  <Cpu className="w-3.5 h-3.5" /> engine :{engine.port} · {engine.packaged ? 'packaged' : 'dev'}
                </p>
              )}
              <p className="text-[10px] text-slate-600 leading-relaxed">
                mediavault — by Valentine Onuchukwu
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
