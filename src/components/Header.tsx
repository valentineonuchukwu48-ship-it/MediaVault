import React from 'react';
import { Download, FileText, Video, Film, Zap, Sparkles, Key, MessageSquare, Images } from 'lucide-react';

interface HeaderProps {
  totalPosts: number;
  selectedCount: number;
  onExportCombined: () => void;
  isExporting: boolean;
  activeTab: 'preview' | 'queue' | 'settings';
  setActiveTab: (tab: 'preview' | 'queue' | 'settings') => void;
  appMode: 'media_vault' | 'video_studio' | 'pdf_dossier' | 'ai_chat';
  setAppMode: (mode: 'media_vault' | 'video_studio' | 'pdf_dossier' | 'ai_chat') => void;
  onOpenAiStudio?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalPosts,
  selectedCount,
  onExportCombined,
  isExporting,
  activeTab,
  setActiveTab,
  appMode,
  setAppMode,
  onOpenAiStudio,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Brand & App Mode Switcher (wraps on narrow screens) */}
      <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1 basis-full sm:basis-auto sm:flex-none">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-blue-500/20">
            f
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
              MediaVault &middot; Archive &amp; PDF
            </span>
            <span className="text-[11px] text-slate-400 font-mono tracking-tight -mt-0.5 whitespace-nowrap">
              Facebook posts &amp; videos — saved provably on your PC
            </span>
          </div>
        </div>

        {/* Studio Switcher Pill — horizontally scrollable when too wide for a phone */}
        <div className="flex items-center max-w-full overflow-x-auto no-scrollbar p-1 bg-slate-800 rounded-xl border border-slate-700/80 text-xs font-semibold">
          <div className="flex items-center gap-0 shrink-0">
          <button
            onClick={() => setAppMode('media_vault')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              appMode === 'media_vault'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Images className="w-3.5 h-3.5 text-cyan-300" />
            <span>Media Vault</span>
          </button>

          <button
            onClick={() => setAppMode('video_studio')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              appMode === 'video_studio'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-yellow-300" />
            <span>Video &amp; MP4 Merger</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-yellow-400/20 text-yellow-300 uppercase font-black tracking-wider">
              Fast
            </span>
          </button>

          <button
            onClick={() => setAppMode('pdf_dossier')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              appMode === 'pdf_dossier'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Post to PDF Dossier</span>
          </button>

          <button
            onClick={() => setAppMode('ai_chat')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              appMode === 'ai_chat'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
            <span>AI Chat</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-400/20 text-emerald-300 uppercase font-black tracking-wider">
              BYOK
            </span>
          </button>
          </div>
        </div>
      </div>

      {/* Zone 2: Sub navigation when in PDF mode */}
      {appMode === 'pdf_dossier' ? (
        <nav className="hidden lg:flex items-center gap-2 p-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Combined Document</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-mono tabular-nums">
              {selectedCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'queue'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            Post Deck ({totalPosts})
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            PDF Styling &amp; Format
          </button>
        </nav>
      ) : (
        <div className="hidden md:flex items-center gap-3 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            Instant MP4 extraction &middot; Concat Demuxer &middot; FFmpeg 4.4
          </span>
        </div>
      )}

      {/* Zone 3: CTA Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        {onOpenAiStudio && (
          <button
            onClick={onOpenAiStudio}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600/90 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-all flex items-center gap-1.5 whitespace-nowrap border border-indigo-400/30"
            title="Open AI Studio (Configure API Key, Model ID & Run AI)"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span className="hidden sm:inline">AI Studio</span>
            <span className="sm:hidden">AI</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 text-white uppercase font-bold tracking-wider">
              BYOK
            </span>
          </button>
        )}

        {appMode === 'pdf_dossier' ? (
          <button
            onClick={onExportCombined}
            disabled={selectedCount === 0 || isExporting}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm shadow-blue-600/30 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download Combined PDF ({selectedCount})</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => {
              const mergeBtn = document.querySelector('button:has(svg.text-yellow-300)') as HTMLButtonElement;
              if (mergeBtn) mergeBtn.click();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-lg shadow-sm shadow-blue-600/30 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Fast Merge into 1 MP4</span>
          </button>
        )}
      </div>
    </header>
  );
};
