import React, { useEffect, useState } from 'react';
import { Smartphone, X, Download } from 'lucide-react';
import { getDesktop } from '../desktop';

const DISMISS_KEY = 'fgc_mobile_bar_dismissed_v1';

function isPhone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const apple = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || apple;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  return (navigator as any).standalone === true;
}

/**
 * Slim install banner shown only on phones, when the app is running as a
 * plain browser tab on the engine served over Wi-Fi. When Chrome offers the
 * real install prompt (PWA eligible) it drives that; otherwise it gives
 * one-tap of the "Add to Home screen" instruction and can be dismissed for
 * good.
 */
export const MobileInstallBar: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    if (getDesktop()) return; // never inside the Electron shell
    if (isStandalone()) return; // already installed
    if (!isPhone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {}
    if (dismissed) return;

    setVisible(true);
    const onInstallable = () => setInstallable(true);
    const onInstalled = () => setVisible(false);
    window.addEventListener('fgc:installable', onInstallable);
    window.addEventListener('fgc:installed', onInstalled);
    return () => {
      window.removeEventListener('fgc:installable', onInstallable);
      window.removeEventListener('fgc:installed', onInstalled);
    };
  }, []);

  const install = async () => {
    const event = (window as any).__fgcInstallEvent;
    if (!event) return;
    event.prompt();
    const choice = await event.userChoice?.catch?.(() => null);
    if (choice?.outcome === 'accepted') setVisible(false);
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {}
  };

  if (!visible) return null;

  return (
    <div className="no-print fixed bottom-3 left-3 right-3 z-[70] rounded-xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/50">
      <div className="flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-cyan-300 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-snug">
            Install Ultimate Media Vault on your phone
          </p>
          {installable ? (
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              Add the full desktop experience as an app icon on your home screen.
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
              Open your browser menu <span className="text-slate-300 font-medium">(⋮ top-right on Chrome)</span> and
              choose <span className="text-slate-300 font-medium">“Add to Home screen”</span>.
            </p>
          )}
        </div>
        {installable && (
          <button
            onClick={install}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-[11px] font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Install
          </button>
        )}
        <button onClick={dismiss} className="shrink-0 text-slate-500 hover:text-white transition-colors" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
