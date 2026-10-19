import React, { useMemo, useState } from 'react';
import { FolderOpen, CalendarDays, Image, Video, ScanSearch, MoveRight, Undo2, AlertTriangle, HardDrive, Search, X } from 'lucide-react';

interface MediaFileVersion {
  name: string;
  rel: string;
  kind: 'photo' | 'video';
  size: number;
  date: string;
  dateSource: 'exif' | 'filename' | 'modified' | 'unknown';
}

interface ScanResult {
  rootId: string;
  root: string;
  total: number;
  photos: number;
  videos: number;
  undated: number;
  truncated: boolean;
  months: Array<{ month: string; photos: number; videos: number; bytes: number }>;
  files: MediaFileVersion[];
}

interface PreviewResult {
  mode: 'day' | 'month';
  total: number;
  folders: Array<{ dir: string; count: number }>;
}

interface ApplyResult {
  ok: boolean;
  undoId: string;
  moved: number;
  failed: number;
  failures: Array<{ from: string; to: string }>;
  folders: number;
}

function prettyBytes(n: number): string {
  if (!n) return '0 B';
  const steps = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < steps.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${steps[i]}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const idx = Number(m) - 1;
  return `${MONTH_NAMES[idx] ?? m} ${y}`;
}

const SOURCE_BADGE: Record<MediaFileVersion['dateSource'], { label: string; cls: string }> = {
  exif: { label: 'EXIF date', cls: 'bg-emerald-400/15 text-emerald-300' },
  filename: { label: 'From filename', cls: 'bg-blue-400/15 text-blue-300' },
  modified: { label: 'File date', cls: 'bg-amber-400/15 text-amber-300' },
  unknown: { label: 'No date', cls: 'bg-slate-400/15 text-slate-400' },
};

export const MediaOrganizer: React.FC = () => {
  const [dir, setDir] = useState('');
  const [quickPicks, setQuickPicks] = useState<Array<{ label: string; path: string }>>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState<PreviewResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState('');
  const [undoing, setUndoing] = useState(false);
  // Search — instant client-side filtering over the scan index.
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    if (!scan) return null;
    const needle = query.trim().toLowerCase();
    if (!needle && !dateFrom && !dateTo) return null;
    const matched = scan.files.filter((f) => {
      if (needle && !f.name.toLowerCase().includes(needle) && !f.rel.toLowerCase().includes(needle)) return false;
      const day = f.date.slice(0, 10);
      if (dateFrom && (!day || day < dateFrom)) return false;
      if (dateTo && (!day || day > dateTo)) return false;
      return true;
    });
    matched.sort((a, b) => b.date.localeCompare(a.date));
    return { items: matched, shown: matched.slice(0, 600) };
  }, [scan, query, dateFrom, dateTo]);

  const thumbsByMonth = useMemo(() => {
    if (!scan) return new Map<string, string[]>();
    const map = new Map<string, string[]>();
    for (const file of scan.files) {
      if (!file.date) continue;
      const month = file.date.slice(0, 7);
      if (file.kind !== 'photo') continue;
      const list = map.get(month) || [];
      if (list.length < 6) list.push(file.rel);
      map.set(month, list);
    }
    return map;
  }, [scan]);

  React.useEffect(() => {
    fetch('/api/media/defaults')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setQuickPicks(Array.isArray(d?.quickPicks) ? d.quickPicks : []))
      .catch(() => {});
  }, []);

  const doScan = async (target?: string) => {
    const dirToScan = target ?? dir;
    if (target) setDir(target);
    if (!dirToScan.trim()) {
      setScanError('Type or pick a folder first — e.g. your Downloads or Pictures folder.');
      return;
    }
    setScanning(true);
    setScanError('');
    setScan(null);
    setPreview(null);
    setApplyResult(null);
    try {
      const res = await fetch('/api/media/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: dirToScan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setScan(data as ScanResult);
    } catch (err) {
      setScanError(String((err as Error).message || err));
    } finally {
      setScanning(false);
    }
  };

  const doPreview = async (mode: 'day' | 'month') => {
    if (!scan) return;
    setPreview(null);
    try {
      const res = await fetch('/api/media/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId: scan.rootId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data as PreviewResult);
      setConfirmOpen(data as PreviewResult);
    } catch (err) {
      setScanError(String((err as Error).message || err));
    }
  };

  const doApply = async (mode: 'day' | 'month') => {
    if (!scan || !confirmOpen) return;
    setApplying(true);
    setApplyError('');
    try {
      const res = await fetch('/api/media/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId: scan.rootId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Organize failed');
      setApplyResult(data as ApplyResult);
      setConfirmOpen(null);
      setPreview(null);
      // Refresh the scan so the timeline reflects the new structure.
      const target = scan.root;
      setScan(null);
      await doScan(target);
    } catch (err) {
      setApplyError(String((err as Error).message || err));
    } finally {
      setApplying(false);
    }
  };

  const doUndo = async () => {
    if (!applyResult?.undoId) return;
    setUndoing(true);
    setApplyError('');
    try {
      const res = await fetch('/api/media/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undoId: applyResult.undoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Undo failed');
      setApplyResult(null);
      if (scan) await doScan(scan.root);
    } catch (err) {
      setApplyError(String((err as Error).message || err));
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="w-full space-y-5 pb-16">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-900/60 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-cyan-300" />
          </span>
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-lg font-bold text-white">Media Vault — arrange by date</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Point Ultimate Media Vault at any folder of photos &amp; videos. Everything is timed (EXIF → filename → file date) and filed into
              clean dated folders — with a full undo, always.
            </p>
          </div>
        </div>
      </div>

      {/* Folder picker */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <FolderOpen className="w-3.5 h-3.5 text-cyan-300" /> Choose the folder to organise
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void doScan(); }}
            placeholder="e.g. C:\Users\you\Downloads"
            className="flex-1 min-w-[260px] px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          />
          <button
            onClick={() => void doScan()}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 transition-all"
          >
            <ScanSearch className="w-4 h-4" /> {scanning ? 'Scanning…' : 'Scan folder'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPicks.map((q) => (
            <button
              key={q.path}
              onClick={() => void doScan(q.path)}
              disabled={scanning}
              title={q.path}
              className="px-2.5 py-1 rounded-full text-[10.5px] bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-cyan-600/60 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>
        {scanError && (
          <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {scanError}
          </p>
        )}
      </div>

      {/* Summary */}
      {scan && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: <Image className="w-4 h-4 text-cyan-300" />, label: 'Photos', value: scan.photos.toLocaleString() },
            { icon: <Video className="w-4 h-4 text-indigo-300" />, label: 'Videos', value: scan.videos.toLocaleString() },
            { icon: <HardDrive className="w-4 h-4 text-amber-300" />, label: 'Total size', value: prettyBytes(scan.files.reduce((s, f) => s + f.size, 0)) },
            { icon: <CalendarDays className="w-4 h-4 text-slate-300" />, label: 'Months with content', value: String(scan.months.length) },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
              <p className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                {card.icon} {card.label}
              </p>
              <p className="text-lg font-bold text-white mt-1 font-mono">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {scan && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Search className="w-3.5 h-3.5 text-cyan-300" /> Search by name or by date
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search file or folder name — e.g. WA0011, holiday, IMG_2030…"
              className="flex-1 min-w-[220px] px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
            <label className="text-[10.5px] text-slate-400 flex items-center gap-1.5">
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [color-scheme:dark]"
              />
            </label>
            <label className="text-[10.5px] text-slate-400 flex items-center gap-1.5">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:ring-2 focus:ring-cyan-500/50 [color-scheme:dark]"
              />
            </label>
            {(query || dateFrom || dateTo) && (
              <button
                onClick={() => { setQuery(''); setDateFrom(''); setDateTo(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] text-slate-400 hover:text-white bg-slate-800 border border-slate-700"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search results */}
      {scan && filtered && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
              Results — {filtered.items.length.toLocaleString()} match{filtered.items.length === 1 ? '' : 'es'}
            </h2>
          </div>
          {filtered.items.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">Nothing matches — try a different name or a wider date range.</p>
          )}
          {filtered.items.length > 600 && (
            <p className="text-[10.5px] text-slate-500 pt-2">Showing the 600 newest of {filtered.items.length.toLocaleString()} matches.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 max-h-[480px] overflow-y-auto pr-1">
            {filtered.shown.map((f) => {
              const badge = SOURCE_BADGE[f.dateSource];
              return (
                <div key={f.rel} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5">
                  {f.kind === 'photo' ? (
                    <img
                      src={`/api/media/file?rootId=${scan.rootId}&p=${encodeURIComponent(f.rel)}`}
                      alt=""
                      loading="lazy"
                      className="h-14 w-14 rounded-lg object-cover border border-slate-700/60 shrink-0"
                    />
                  ) : (
                    <span className="h-14 w-14 rounded-lg bg-indigo-950/60 border border-indigo-800/50 shrink-0 flex items-center justify-center">
                      <Video className="w-5 h-5 text-indigo-300/80" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold text-white truncate" title={f.name}>{f.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{f.date ? f.date.replace('T', ' ').slice(0, 19) : 'no date'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      <span className="text-[9.5px] text-slate-500">{prettyBytes(f.size)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      {scan && !filtered && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-800">
            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-100 uppercase tracking-wider">
              <CalendarDays className="w-4 h-4 text-cyan-400" /> Timeline — newest first
            </h2>
            <div className="flex flex-wrap gap-2 no-scrollbar">
              <button
                onClick={() => void doPreview('month')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all"
              >
                <MoveRight className="w-3.5 h-3.5" /> Arrange by month
              </button>
              <button
                onClick={() => void doPreview('day')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-all"
              >
                <MoveRight className="w-3.5 h-3.5" /> Arrange by day
              </button>
            </div>
          </div>

          {scan.months.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">No dated photos or videos found. Try another folder.</p>
          )}

          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {scan.months.map((m) => (
              <div key={m.month} className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-800/60">
                  <p className="text-sm font-bold text-white">{monthLabel(m.month)}</p>
                  <p className="text-[10.5px] text-slate-400 font-mono">
                    {m.photos} photo{m.photos === 1 ? '' : 's'} · {m.videos} video{m.videos === 1 ? '' : 's'} · {prettyBytes(m.bytes)}
                  </p>
                </div>
                <div className="flex gap-2 p-3 overflow-x-auto no-scrollbar">
                  {(thumbsByMonth.get(m.month) || []).map((rel) => (
                    <img
                      key={rel}
                      src={`/api/media/file?rootId=${scan.rootId}&p=${encodeURIComponent(rel)}`}
                      alt=""
                      loading="lazy"
                      className="h-20 w-20 rounded-lg object-cover border border-slate-700/60 shrink-0"
                    />
                  ))}
                  {Array.from({ length: m.videos }).slice(0, 3).map((_, i) => (
                    <span
                      key={`v${i}`}
                      className="h-20 w-20 rounded-lg bg-indigo-950/60 border border-indigo-800/50 shrink-0 flex items-center justify-center"
                    >
                      <Video className="w-6 h-6 text-indigo-300/80" />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview result summary */}
      {preview && !confirmOpen && (
        <div className="rounded-xl border border-cyan-700/40 bg-cyan-950/30 p-4 text-xs text-slate-300">
          Preview ready: <b className="text-white">{preview.total.toLocaleString()}</b> files would move into{' '}
          <b className="text-white">{preview.folders.length.toLocaleString()}</b> {preview.mode === 'month' ? 'monthly' : 'daily'} folders.
          Confirm to make your choice.
        </div>
      )}

      {/* Result / undo */}
      {applyResult && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-4 space-y-2">
          <p className="text-xs text-slate-300">
            ✅ Moved <b className="text-white">{applyResult.moved.toLocaleString()}</b> files into{' '}
            <b className="text-white">{applyResult.folders}</b> folders
            {applyResult.failed > 0 && <> · {applyResult.failed} failed</>}. Everything lands under <span className="font-mono">By Date\…</span> inside
            your folder.
          </p>
          {applyResult.failures.length > 0 && (
            <p className="text-[10.5px] text-slate-500 font-mono">{applyResult.failures.map((f) => f.from).slice(0, 3).join(' · ')}</p>
          )}
          <button
            onClick={() => void doUndo()}
            disabled={undoing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" /> {undoing ? 'Undoing…' : 'Undo this organise'}
          </button>
        </div>
      )}
      {applyError && (
        <p className="text-[11px] text-rose-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {applyError}
        </p>
      )}

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConfirmOpen(null)}>
          <div className="max-w-lg w-full rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Arrange {confirmOpen.total.toLocaleString()} files by {confirmOpen.mode}?</h3>
            <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
              Files move into <span className="font-mono text-slate-300">By Date\{confirmOpen.mode === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'}\</span> folders.
              Nothing is deleted, nothing is uploaded, and every move is undoable with one click. Collisions are renamed — never overwritten.
            </p>
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 space-y-1">
              {confirmOpen.folders.slice(0, 12).map((f) => (
                <p key={f.dir} className="text-[10.5px] font-mono text-slate-400">
                  {f.dir.replace(/.*By Date\\/, 'By Date\\')} — {f.count} file{f.count === 1 ? '' : 's'}
                </p>
              ))}
              {confirmOpen.folders.length > 12 && (
                <p className="text-[10.5px] text-slate-500">…and {confirmOpen.folders.length - 12} more folders</p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setConfirmOpen(null)} className="px-3 py-1.5 rounded-lg text-[11px] text-slate-300 hover:text-white">
                Cancel
              </button>
              <button
                onClick={() => void doApply(confirmOpen.mode)}
                disabled={applying}
                className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
              >
                {applying ? 'Arranging…' : `Arrange ${confirmOpen.total.toLocaleString()} files`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
