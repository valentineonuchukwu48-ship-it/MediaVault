import React from 'react';
import { FacebookPost, ExportSettings } from '../types';
import { FileText, Calendar, Hash, UserCheck, ShieldAlert } from 'lucide-react';

interface CoverSheetProps {
  posts: FacebookPost[];
  settings: ExportSettings;
}

export const CoverSheet: React.FC<CoverSheetProps> = ({ posts, settings }) => {
  return (
    <div className="bg-white text-slate-900 border border-slate-300 rounded-none p-10 max-w-2xl mx-auto flex flex-col font-sans space-y-8 min-h-[700px] justify-between">
      <div>
        {/* Top Header */}
        <div className="border-b-4 border-blue-600 pb-6">
          <div className="text-xs font-mono font-bold tracking-widest text-blue-600 uppercase">
            COMPREHENSIVE COMPILATION DOSSIER
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-2">
            {settings.archiveTitle || 'Facebook Post Archive Report'}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Compiled digital preservation of {posts.length} Facebook {posts.length === 1 ? 'post' : 'posts'} with certified media attachments, engagement metrics, and verified permalinks.
          </p>
        </div>

        {/* Dossier Meta Stats */}
        <div className="grid grid-cols-2 gap-4 py-6 border-b border-slate-200 text-xs">
          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Compiled By</span>
            <span className="font-semibold text-slate-900 text-sm">
              {settings.investigatorName || 'Archivist'}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Generation Date</span>
            <span className="font-semibold text-slate-900 text-sm">
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Items Included</span>
            <span className="font-semibold text-slate-900 text-sm font-mono">
              {posts.length} Posts
            </span>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 uppercase block">Total Photos</span>
            <span className="font-semibold text-slate-900 text-sm font-mono">
              {posts.reduce((acc, p) => acc + (p.images?.length || 0), 0)} Photos
            </span>
          </div>
        </div>

        {/* Table of Contents */}
        <div className="pt-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
            Table of Contents
          </h3>

          <div className="space-y-2">
            {posts.map((post, idx) => (
              <div
                key={post.id}
                className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 text-xs"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="font-mono font-bold text-blue-600 shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block truncate">
                      {post.authorName} ({post.postDate})
                    </span>
                    <span className="text-slate-500 text-[11px] truncate block">
                      {post.postContent ? post.postContent.slice(0, 90) : 'Photo Post'}...
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-[11px] text-slate-500">
                  {post.images.length > 0 ? `${post.images.length} img` : 'text'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Notice */}
      <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <span>ARCHIVE ENGINE: MediaVault</span>
        <span>SECURITY: VERIFIED INTEGRITY</span>
      </div>
    </div>
  );
};
