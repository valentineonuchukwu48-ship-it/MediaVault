import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Radar, Plus, RefreshCw, Trash2, X, Edit3, Trash, ShieldCheck, HelpCircle } from 'lucide-react';

interface RadarTask {
  postId: string;
  url: string;
  baselineHash: string | null;
  status: 'ok' | 'edited' | 'deleted' | 'unknown';
  lastChecked: string | null;
  consecutiveMisses: number;
}

interface RadarEvent {
  type: 'RADAR_EDIT' | 'RADAR_DELETE';
  postId: string;
  seq?: number;
  at: string;
  detail: string;
}

const STATUS_STYLE: Record<RadarTask['status'], { chip: string; label: string }> = {
  ok: { chip: 'bg-emerald-500/15 text-emerald-300', label: 'watching · intact' },
  edited: { chip: 'bg-amber-500/15 text-amber-300', label: 'EDITED' },
  deleted: { chip: 'bg-rose-500/15 text-rose-300', label: 'DELETED' },
  unknown: { chip: 'bg-slate-500/15 text-slate-300', label: 'checking…' },
};

/**
 * Deletion Radar — floating control for the app's "button that presses
 * itself". Paste a Facebook URL once; the engine keeps re-checking it
 * anonymously and every open window (this PC AND phones over Wi-Fi) gets a
 * live alert if it changes or disappears. The sealed original stays in the
 * Evidence Vault no matter what Facebook does afterwards.
 */
export const DeletionRadar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tasks, setTasks] = useState<RadarTask[]>([]);
  const [events, setEvents] = useState<RadarEvent[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unseen, setUnseen] = useState(0);
  const seenCountRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/radar/tasks');
      if (!res.ok) return;
      const data = await res.json();
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      /* engine restarting */
    }
  }, []);

  // Live alerts while the panel is open; badge counts while it's closed.
  useEffect(() => {
    refresh();
    let poll: ReturnType<typeof setInterval> | null = null;
    const source = new EventSource('/api/radar/stream');
    source.onmessage = (msg) => {
      try {
        const evt = JSON.parse(msg.data) as { type?: string };
        if (evt.type === 'RADAR_EDIT' || evt.type === 'RADAR_DELETE') {
          if (!openRef.current) setUnseen((n) => n + 1);
          refresh();
        }
      } catch {
        /* keep-alive frame */
      }
    };
    source.onerror = () => {
      // Fallback for flaky SSE (mobile browsers) — gentle polling.
      if (!poll) poll = setInterval(() => { if (!openRef.current) refresh(); }, 60_000);
    };
    source.onopen = () => {
      if (poll) { clearInterval(poll); poll = null; }
    };
    return () => {
      source.close();
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
    if (open) setUnseen(0);
  }, [open]);

  const watch = async () => {
    if (!urlInput.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/radar/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not add this link');
      } else {
        setUrlInput('');
        await refresh();
      }
    } catch {
      setError('Engine not reachable — try again.');
    }
    setBusy(false);
  };

  const unwatch = async (postId: string) => {
    await fetch(`/api/radar/tasks/${encodeURIComponent(postId)}`, { method: 'DELETE' }).catch(() => {});
    refresh();
  };

  const checkNow = async () => {
    setBusy(true);
    try {
      await fetch('/api/radar/run', { method: 'POST' });
      await refresh();
    } catch {}
    setBusy(false);
  };

  // The history endpoint only ever stores real alerts — HELLO frames are
  // transient stream connectors and never persisted server-side.
  const alertCount = events.length;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Deletion Radar"
        className="no-print fixed bottom-5 left-5 z-[60] flex items-center gap-2 px-3.5 py-2.5 rounded-full text-white text-xs font-semibold shadow-lg shadow-emerald-900/40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all border border-white/15"
      >
        <Radar className="w-4 h-4" />
        <span className="hidden sm:inline">Radar</span>
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">
            {unseen}
          </span>
        )}
      </button>

      {open && (
        <div className="no-print fixed bottom-20 left-5 z-[61] w-[400px] max-w-[94vw] rounded-2xl border border-slate-700/70 bg-slate-900/97 backdrop-blur-xl shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Radar className="w-4 h-4 text-emerald-300" />
              <span className="text-sm font-semibold text-white">Deletion Radar</span>
              {alertCount > 0 && (
                <span className="text-[10px] font-mono text-rose-300">{alertCount} alert{alertCount === 1 ? '' : 's'}</span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-[11px] leading-relaxed text-slate-400">
              Paste a Facebook post URL — the engine re-checks it quietly on a schedule. If it's{' '}
              <span className="text-amber-300 font-medium">edited</span> or{' '}
              <span className="text-rose-300 font-medium">deleted</span>, your original stays safe in
              the Evidence Vault and this PC plus any phone on Wi-Fi gets the alert. You don't have
              to remember a thing.
            </p>

            {/* Watch input */}
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && watch()}
                placeholder="https://facebook.com/post-de-matter…"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700/60 text-slate-100 text-xs placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={watch}
                disabled={busy || !urlInput.trim()}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Watch
              </button>
            </div>
            {error && <p className="text-[11px] text-rose-300">{error}</p>}

            {/* Watches */}
            {tasks.length > 0 && (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {tasks.map((t) => {
                  const style = STATUS_STYLE[t.status];
                  return (
                    <div key={t.postId} className="rounded-xl border border-slate-700/60 bg-slate-800/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9.5px] font-bold tracking-wide ${style.chip}`}>
                            {t.status === 'edited' ? <Edit3 className="w-3 h-3 mr-1" /> : t.status === 'deleted' ? <Trash className="w-3 h-3 mr-1" /> : t.status === 'unknown' ? <HelpCircle className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                            {style.label}
                          </span>
                          <p className="mt-1 text-[11px] text-slate-400 font-mono truncate" title={t.url}>
                            {t.url.replace(/^https?:\/\/(www\.)?/, '')}
                          </p>
                          <p className="text-[10px] text-slate-600">
                            last checked: {t.lastChecked ? new Date(t.lastChecked).toLocaleTimeString() : 'never'}
                          </p>
                        </div>
                        <button
                          onClick={() => unwatch(t.postId)}
                          title="Stop watching (vault keeps the sealed history)"
                          className="shrink-0 text-slate-500 hover:text-rose-300 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Recent alerts */}
            {events.length > 0 && (
              <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Recent alerts</p>
                {events.slice(0, 6).map((e, i) => (
                  <div key={`${e.postId}-${i}`} className="flex items-start gap-2 text-[11px]">
                    {e.type === 'RADAR_DELETE' ? (
                      <Trash className="w-3.5 h-3.5 text-rose-300 mt-0.5 shrink-0" />
                    ) : (
                      <Edit3 className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
                    )}
                    <p className="text-slate-400">
                      <span className="text-slate-300 font-medium">{e.postId}</span> · {e.detail}{' '}
                      <span className="text-slate-600">({new Date(e.at).toLocaleString()})</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            {tasks.length === 0 && (
              <p className="text-[11px] text-slate-500">
                Nothing watched yet. Seal posts as usual — then paste their URLs here to make sure
                nobody can quietly erase the record without you knowing.
              </p>
            )}

            <button
              onClick={checkNow}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-medium transition-colors border border-slate-700/60"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Checking…' : 'Check now'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
