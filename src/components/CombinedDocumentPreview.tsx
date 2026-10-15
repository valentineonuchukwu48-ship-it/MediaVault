import React, { useRef, useState } from 'react';
import {
  Download,
  Printer,
  FileImage,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import { FacebookPost, ExportSettings } from '../types';
import { FacebookPostCard } from './FacebookPostCard';
import { ArchivalReportCard } from './ArchivalReportCard';
import { CoverSheet } from './CoverSheet';
import {
  generateCombinedPdf,
  exportSinglePostPdf,
  exportElementAsPng,
  GenerationProgress,
} from '../utils/pdfGenerator';

interface CombinedDocumentPreviewProps {
  posts: FacebookPost[];
  selectedIds: string[];
  activePostId: string | null;
  settings: ExportSettings;
}

export const CombinedDocumentPreview: React.FC<CombinedDocumentPreviewProps> = ({
  posts,
  selectedIds,
  activePostId,
  settings,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [viewMode, setViewMode] = useState<'combined' | 'active_only'>('combined');
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const coverSheetRef = useRef<HTMLDivElement>(null);
  const postElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Filter posts included in export
  const exportPosts = posts.filter((p) => selectedIds.includes(p.id));
  const activePost = posts.find((p) => p.id === activePostId) || exportPosts[0];

  const handleExportCombined = async () => {
    if (exportPosts.length === 0) return;
    setIsExporting(true);

    try {
      await generateCombinedPdf(exportPosts, settings, (prog) => setProgress(prog));
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  };

  const handleExportActiveSingle = async () => {
    if (!activePost) return;
    try {
      await exportSinglePostPdf(activePost, settings);
    } catch (err) {
      console.error('Single export failed:', err);
      alert('Failed to export single post.');
    }
  };

  const handleExportPng = async () => {
    if (!activePost) return;
    try {
      await exportElementAsPng(activePost, `facebook_post_${activePost.id}`);
    } catch (err) {
      console.error('PNG export failed:', err);
      alert('Failed to export PNG image.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (exportPosts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
          <Layers className="w-7 h-7 text-blue-400" />
        </div>
        <h3 className="text-base font-semibold text-slate-200">No Posts Selected for PDF</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Select at least one post from the post deck on the left to preview and generate your combined PDF document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Document Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center p-0.5 bg-slate-800 rounded-lg border border-slate-700/60 text-xs">
            <button
              onClick={() => setViewMode('combined')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'combined'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Full Deck ({exportPosts.length} Pages)
            </button>
            <button
              onClick={() => setViewMode('active_only')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                viewMode === 'active_only'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Post Focus
            </button>
          </div>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs pl-2 border-l border-slate-800">
            <button
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              className="p-1 hover:text-white hover:bg-slate-800 rounded"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] tabular-nums px-1">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="p-1 hover:text-white hover:bg-slate-800 rounded"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="p-1 hover:text-white hover:bg-slate-800 rounded text-[10px] font-mono ml-0.5"
              title="Reset Zoom"
            >
              100%
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
            title="Print or Save with System Print Dialog"
          >
            <Printer className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportPng}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/60"
            title="Download Active Post as High-Res PNG"
          >
            <FileImage className="w-4 h-4" />
          </button>

          {viewMode === 'active_only' ? (
            <button
              onClick={handleExportActiveSingle}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Active Post PDF</span>
            </button>
          ) : (
            <button
              onClick={handleExportCombined}
              disabled={isExporting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting ? 'Generating PDF...' : `Download Combined PDF (${exportPosts.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Toast */}
      {progress && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>{progress.message}</span>
          </div>
          <span className="font-mono text-[11px]">
            {progress.step} / {progress.total}
          </span>
        </div>
      )}

      {/* Document Viewport */}
      <div className="flex-1 overflow-auto p-6 lg:p-8 bg-slate-950/60 flex flex-col items-center">
        <div
          className="transition-transform duration-150 origin-top space-y-10 w-full max-w-2xl"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {/* Optional Cover Sheet */}
          {settings.includeCoverPage && viewMode === 'combined' && (
            <div
              ref={coverSheetRef}
              className="shadow-2xl ring-1 ring-slate-800 bg-white rounded-none print:shadow-none"
            >
              <CoverSheet posts={exportPosts} settings={settings} />
            </div>
          )}

          {/* Render Posts */}
          {exportPosts.map((post, index) => {
            // If active_only mode, only show active post
            if (viewMode === 'active_only' && activePost && post.id !== activePost.id) {
              return null;
            }

            return (
              <div
                key={post.id}
                ref={(el) => {
                  postElementsRef.current[index] = el;
                }}
                className="shadow-2xl ring-1 ring-slate-800/80 bg-white rounded-2xl overflow-hidden print:shadow-none print:ring-0 page-break-after"
              >
                {settings.theme === 'facebook_authentic' ? (
                  <FacebookPostCard
                    post={post}
                    settings={settings}
                    pageNumber={index + 1}
                    totalPages={exportPosts.length}
                  />
                ) : (
                  <ArchivalReportCard
                    post={post}
                    settings={settings}
                    pageNumber={index + 1}
                    totalPages={exportPosts.length}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
