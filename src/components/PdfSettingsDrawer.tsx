import React from 'react';
import {
  FileText,
  Layout,
  QrCode,
  Shield,
  MessageSquare,
  ThumbsUp,
  BookOpen,
} from 'lucide-react';
import { ExportSettings, DocumentTheme, PageFormat, PageOrientation, PageMode } from '../types';

interface PdfSettingsDrawerProps {
  settings: ExportSettings;
  onChange: (updated: ExportSettings) => void;
}

export const PdfSettingsDrawer: React.FC<PdfSettingsDrawerProps> = ({ settings, onChange }) => {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-6 text-xs">
      <div>
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-1">
          <Layout className="w-4 h-4 text-blue-400" />
          <span>PDF Document Styling & Layout</span>
        </h3>
        <p className="text-slate-400 text-[11px]">
          Configure the appearance, page sizes, and verification markers for your combined PDF export.
        </p>
      </div>

      {/* Visual Theme Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          Document Visual Theme
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...settings, theme: 'facebook_authentic' })}
            className={`p-3 rounded-lg border text-left transition-all ${
              settings.theme === 'facebook_authentic'
                ? 'bg-blue-950/40 border-blue-500 text-white ring-1 ring-blue-500/30'
                : 'bg-slate-900/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="font-semibold text-xs mb-0.5">Facebook Authentic Card</div>
            <div className="text-[11px] text-slate-400 leading-snug">
              Authentic Facebook social feed look with avatars, reactions, and badges.
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange({ ...settings, theme: 'archival_dossier' })}
            className={`p-3 rounded-lg border text-left transition-all ${
              settings.theme === 'archival_dossier'
                ? 'bg-blue-950/40 border-blue-500 text-white ring-1 ring-blue-500/30'
                : 'bg-slate-900/60 border-slate-700/80 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="font-semibold text-xs mb-0.5">Official Archival Dossier</div>
            <div className="text-[11px] text-slate-400 leading-snug">
              Formal forensic report format with evidence exhibit headers and metadata tables.
            </div>
          </button>
        </div>
      </div>

      {/* Multi-Post Layout & Page Setup */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-slate-300 font-medium block mb-1">
            Pagination Mode
          </label>
          <select
            value={settings.pageMode}
            onChange={(e) => onChange({ ...settings, pageMode: e.target.value as PageMode })}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="page_per_post">One Post Per Page (Recommended)</option>
            <option value="continuous">Continuous Document Flow</option>
          </select>
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1">
            Paper Format
          </label>
          <select
            value={settings.pageFormat}
            onChange={(e) => onChange({ ...settings, pageFormat: e.target.value as PageFormat })}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="a4">A4 (Standard 210 × 297 mm)</option>
            <option value="letter">US Letter (8.5 × 11 in)</option>
            <option value="auto_card">Auto Card (Fit to Content)</option>
          </select>
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1">
            Orientation
          </label>
          <select
            value={settings.pageOrientation}
            onChange={(e) =>
              onChange({ ...settings, pageOrientation: e.target.value as PageOrientation })
            }
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
      </div>

      {/* Toggles for Inclusion */}
      <div className="space-y-2.5 pt-2 border-t border-slate-700/60">
        <label className="text-xs font-semibold text-slate-300 block">
          Document Elements & Verification
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeCoverPage}
              onChange={(e) => onChange({ ...settings, includeCoverPage: e.target.checked })}
              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
            />
            <div>
              <span className="font-medium text-slate-200 block text-xs">
                Cover Page & Table of Contents
              </span>
              <span className="text-[10px] text-slate-400 block">
                Inserts a front summary page listing all posts
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeQrCode}
              onChange={(e) => onChange({ ...settings, includeQrCode: e.target.checked })}
              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
            />
            <div>
              <span className="font-medium text-slate-200 block text-xs">
                Verification QR Codes
              </span>
              <span className="text-[10px] text-slate-400 block">
                Adds scannable code linking to live Facebook post
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeEngagement}
              onChange={(e) => onChange({ ...settings, includeEngagement: e.target.checked })}
              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
            />
            <div>
              <span className="font-medium text-slate-200 block text-xs">
                Engagement Counters
              </span>
              <span className="text-[10px] text-slate-400 block">
                Display Likes, Comments, and Share metrics
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-2.5 bg-slate-900/60 border border-slate-700/60 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeComments}
              onChange={(e) => onChange({ ...settings, includeComments: e.target.checked })}
              className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
            />
            <div>
              <span className="font-medium text-slate-200 block text-xs">
                Comments Section
              </span>
              <span className="text-[10px] text-slate-400 block">
                Show top discussion comments on the card
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Dossier Meta Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-700/60">
        <div>
          <label className="text-slate-300 font-medium block mb-1">
            Dossier Title
          </label>
          <input
            type="text"
            value={settings.archiveTitle}
            onChange={(e) => onChange({ ...settings, archiveTitle: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-slate-300 font-medium block mb-1">
            Archivist / Prepared By
          </label>
          <input
            type="text"
            value={settings.investigatorName}
            onChange={(e) => onChange({ ...settings, investigatorName: e.target.value })}
            className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
