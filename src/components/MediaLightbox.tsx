import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Share2, Download, ChevronLeft, ChevronRight, X, Video } from 'lucide-react';export interface LightboxItem {
  /** Full-size image/video URL. Absolute http(s) Facebook URLs are auto-proxied. */
  src: string;
  name: string;
  kind: 'photo' | 'video';
}

interface MediaLightboxProps {
  items: LightboxItem[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/**
 * Route any media URL through the same-origin proxy so it can be drawn to
 * canvas (copy) / fetched as a blob (share & save) without CORS trouble.
 */
function resolveUrl(url: string): string {
  if (url.startsWith('data:') || url.startsWith('/')) return url;
  if (url.startsWith(location.origin)) return url;
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

/** Convert any browser-decodable image blob to PNG for the clipboard. */
async function toPngBlob(blob: Blob): Promise<Blob | null> {
  if (blob.type === 'image/png') return blob;
  try {
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = objUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(objUrl);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('canvas.toBlob produced nothing'))), 'image/png')
    );
  } catch {
    return null;
  }
}

/**
 * Fullscreen media popup used by Media Vault search results and post cards.
 * Copy → paste into WhatsApp / anywhere.  Share → native share sheet
 * (WhatsApp on Android/desktop share).  Save → browser "Save as" dialog for
 * any folder.  ←/→ flip through the current result set, Esc closes.
 */
export const MediaLightbox: React.FC<MediaLightboxProps> = ({ items, index, onIndex, onClose }) => {
  const [status, setStatus] = useState<'' | 'copying' | 'copied' | 'copy-failed' | 'sharing' | 'share-unsupported' | 'downloading' | 'download-failed'>('');
  const item = items[index];

  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [item, index, items.length, onIndex, onClose]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 2600);
    return () => clearTimeout(t);
  }, [status]);

  const fetchBlob = useCallback(async (url: string): Promise<Blob> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    return await res.blob();
  }, []);

  const doCopy = async (): Promise<void> => {
  if (!item || item.kind !== 'photo' || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;
    setStatus('copying');
    try {
      // ClipboardItem accepts a Promise so the copy keeps user-gesture rights.
      const pngPromise = fetchBlob(resolveUrl(item.src)).then(async (b) => {
        const png = await toPngBlob(b);
        if (!png) throw new Error('image could not be re-encoded');
        return png;
      });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngPromise })]);
      setStatus('copied');
    } catch {
      setStatus('copy-failed');
    }
  };

  const doShare = async (): Promise<void> => {
    if (!item) return;
    const shareFile = async (): Promise<File> => {
      const blob = await fetchBlob(resolveUrl(item.src));
      return new File([blob], item.name, { type: blob.type || (item.kind === 'video' ? 'video/mp4' : 'image/jpeg') });
    };
    try {
      if (typeof navigator.canShare !== 'function') throw new Error('unsupported');
      const file = await shareFile(); // build first so canShare sees real files
      if (!navigator.canShare({ files: [file] })) throw new Error('unsupported');
      await navigator.share({ files: [file], title: item.name });
      // no status change — the OS sheet closing is feedback enough
      void 0;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') { setStatus(''); return; }
      setStatus('share-unsupported');
    }
  };

  const doSave = async (): Promise<void> => {
    if (!item) return;
    setStatus('downloading');
    try {
      const blob = await fetchBlob(resolveUrl(item.src));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = item.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
      setStatus('');
    } catch {
      setStatus('download-failed');
    }
  };

  if (!item) return null;
  const isPhoto = item.kind === 'photo';

  return (
    <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex flex-col" onClick={onClose}>
      {/* Title bar */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {!isPhoto && <Video className="w-4 h-4 text-indigo-300 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{item.name}</p>
          <p className="text-[10px] text-slate-400">
            {index + 1} of {items.length} · {isPhoto ? 'picture' : 'video'} · click outside or press Esc to close
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative p-4" onClick={onClose}>
        {index > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index - 1); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Previous"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {index < items.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); onIndex(index + 1); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            aria-label="Next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div className="max-h-full max-w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {isPhoto ? (
            <img src={resolveUrl(item.src)} alt={item.name} className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" />
          ) : (
            <video src={resolveUrl(item.src)} controls autoPlay className="max-h-full max-w-full rounded-lg shadow-2xl bg-black" />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 px-4 py-3.5 bg-slate-950/80 border-t border-slate-800" onClick={(e) => e.stopPropagation()}>
        {isPhoto && (
          <button
            onClick={() => void doCopy()}
            disabled={status === 'copying'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60 transition-all"
          >
            {status === 'copied' ? <Check className="w-4 h-4" /> : status === 'copy-failed' ? <X className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {status === 'copied' ? 'Copied — paste it anywhere' : status === 'copying' ? 'Copying…' : status === 'copy-failed' ? 'Copy failed — use Save' : 'Copy picture'}
          </button>
        )}
        <button
          onClick={() => void doShare()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600/90 hover:bg-emerald-500 transition-all"
        >
          <Share2 className="w-4 h-4" /> Share (e.g. WhatsApp)
        </button>
        <button
          onClick={() => void doSave()}
          disabled={status === 'downloading'}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 transition-all"
        >
          <Download className="w-4 h-4" />
          {status === 'downloading' ? 'Saving…' : status === 'download-failed' ? 'Save failed — try again' : 'Save to folder'}
        </button>
        {status === 'share-unsupported' && (
          <span className="text-[10.5px] text-amber-300">Sharing isn't available here — Copy or Save works instead.</span>
        )}
        {!isPhoto && (
          <span className="text-[10.5px] text-slate-500">Videos play right here — Share or Save to send them on.</span>
        )}
      </div>
    </div>
  );
};
