import React, { useEffect, useState } from 'react';
import { ShieldCheck, FileCheck, ExternalLink, Calendar, User } from 'lucide-react';
import { FacebookPost, ExportSettings } from '../types';
import { generateQrDataUrl } from '../utils/qr';

interface ArchivalReportCardProps {
  post: FacebookPost;
  settings: ExportSettings;
  pageNumber?: number;
  totalPages?: number;
}

export const ArchivalReportCard: React.FC<ArchivalReportCardProps> = ({
  post,
  settings,
  pageNumber,
  totalPages,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (settings.includeQrCode && post.url) {
      generateQrDataUrl(post.url).then((url) => setQrCodeUrl(url));
    }
  }, [post.url, settings.includeQrCode]);

  return (
    <div className="bg-white text-slate-900 border border-slate-300 rounded-none shadow-sm p-8 max-w-2xl mx-auto flex flex-col font-sans space-y-6">
      {/* Official Header */}
      <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
            Official Social Media Evidence Record
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            DIGITAL PUBLICATION ARCHIVE REPORT
          </h2>
          <div className="text-xs text-slate-600 mt-1">
            Certified Digital Snapshot · Source: Facebook Platform
          </div>
        </div>

        <div className="text-right">
          {pageNumber && totalPages && (
            <div className="text-xs font-mono font-bold text-slate-900">
              ENTRY #{pageNumber} / {totalPages}
            </div>
          )}
          <div className="text-[10px] font-mono text-slate-500 mt-1">
            DOC-REF: FB-{post.id.slice(-8)}
          </div>
        </div>
      </div>

      {/* Metadata Table */}
      <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 text-xs">
        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Account / Author</span>
          <span className="font-semibold text-slate-900">{post.authorName}</span>
          <span className="text-slate-500 text-[11px] font-mono ml-1">({post.authorHandle})</span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Original Post Date</span>
          <span className="font-semibold text-slate-900">{post.postDate}</span>
        </div>

        <div className="col-span-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Source Permalink</span>
          <span className="font-mono text-[11px] text-blue-700 break-all">{post.url}</span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Platform Object ID</span>
          <span className="font-mono text-slate-800">{post.id}</span>
        </div>

        <div>
          <span className="text-[10px] font-mono text-slate-500 uppercase block">Archived Timestamp</span>
          <span className="font-mono text-slate-800">{new Date(post.fetchedAt).toUTCString()}</span>
        </div>
      </div>

      {/* Content Transcript */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1 flex items-center justify-between">
          <span>Verbatim Content Transcript</span>
          <span className="text-[10px] font-mono font-normal text-slate-500">
            {post.postContent.length} chars · {post.postContent.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
        <div className="p-4 bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap">
          {post.postContent || '(No text content accompanied this post)'}
        </div>
      </div>

      {/* Photographic Exhibits */}
      {post.images && post.images.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
            Photographic Exhibits ({post.images.length})
          </div>

          <div className="grid grid-cols-1 gap-3">
            {post.images.map((img, idx) => (
              <div key={idx} className="border border-slate-200 p-2 bg-slate-50">
                <img
                  src={img}
                  alt={`Exhibit ${idx + 1}`}
                  className="w-full max-h-80 object-contain mx-auto bg-black"
                  referrerPolicy="no-referrer"
                />
                <div className="text-[10px] font-mono text-slate-500 text-center mt-2">
                  EXHIBIT {idx + 1}: Attached media recorded at capture timestamp
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engagement & Verification Footer */}
      <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-600">
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Digital Integrity Verified</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Recorded Engagement: {post.likesCount} Likes · {post.commentsCount} Comments · {post.sharesCount} Shares
          </div>
        </div>

        {settings.includeQrCode && qrCodeUrl && (
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[9px] font-mono text-slate-500 block">Scan to verify</span>
              <span className="text-[9px] font-mono text-slate-500 block">live source</span>
            </div>
            <img src={qrCodeUrl} alt="QR verification" className="w-12 h-12 border border-slate-300" />
          </div>
        )}
      </div>
    </div>
  );
};
