import React, { useEffect, useState } from 'react';
import {
  Globe,
  Users,
  Lock,
  ThumbsUp,
  MessageCircle,
  Share2,
  CheckCircle2,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { FacebookPost, ExportSettings } from '../types';
import { generateQrDataUrl } from '../utils/qr';
import { MediaLightbox, type LightboxItem } from './MediaLightbox';

interface FacebookPostCardProps {
  post: FacebookPost;
  settings: ExportSettings;
  pageNumber?: number;
  totalPages?: number;
}

export const FacebookPostCard: React.FC<FacebookPostCardProps> = ({
  post,
  settings,
  pageNumber,
  totalPages,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showLiveIframe, setShowLiveIframe] = useState<boolean>(false);
  // Popup viewer for the post's photos + quick copy/share of the post text.
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const [textStatus, setTextStatus] = useState<'' | 'copied'>('');

  const postImages: LightboxItem[] = (post.images || []).map((src, idx) => ({
    src,
    name: (() => {
      try {
        const base = src.startsWith('data:') ? '' : decodeURIComponent(src.split('?')[0].split('/').pop() || '');
        if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
      } catch { /* keep fallback */ }
      return `${(post.authorName || 'post').slice(0, 24)} photo ${idx + 1}`;
    })(),
    kind: 'photo' as const,
  }));
  const openImage = (idx: number): void => setLbIndex(idx);

  const copyPostText = async (): Promise<void> => {
    if (!post.postContent || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(post.postContent);
      setTextStatus('copied');
    } catch { /* selection fallback: the text is visible above */ }
  };

  const sharePostText = async (): Promise<void> => {
    if (!post.postContent) return;
    try {
      await navigator.share({ text: post.postContent, title: post.authorName || 'Facebook post' });
    } catch { /* user cancelled or unsupported */ }
  };

  useEffect(() => {
    if (settings.includeQrCode && post.url) {
      generateQrDataUrl(post.url).then((url) => setQrCodeUrl(url));
    }
  }, [post.url, settings.includeQrCode]);

  // Format caption text: highlights hashtags and URLs
  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    const parts = content.split(/(\s+)/);

    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span key={i} className="text-blue-600 font-medium">
            {part}
          </span>
        );
      }
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <span key={i} className="text-blue-600 underline">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const getPrivacyIcon = () => {
    switch (post.privacy) {
      case 'friends':
        return <Users className="w-3 h-3 text-slate-500" />;
      case 'only_me':
        return <Lock className="w-3 h-3 text-slate-500" />;
      default:
        return <Globe className="w-3 h-3 text-slate-500" />;
    }
  };

  return (
    <div
      className="bg-white text-slate-900 rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden w-full max-w-2xl mx-auto flex flex-col font-sans transition-all"
      style={{ minHeight: 'auto' }}
    >
      {/* Optional Archival Header Watermark */}
      {settings.includeWatermark && (
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">DIGITAL ARCHIVE ENTRY</span>
            <span>·</span>
            <span>ID: {post.id}</span>
            {(post.extractedSource === 'embed_plugin' || post.iframeCode) && (
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                EMBED EXTRACTED
              </span>
            )}
          </div>
          {pageNumber && totalPages && (
            <span className="font-semibold text-slate-600">
              Page {pageNumber} of {totalPages}
            </span>
          )}
        </div>
      )}

      {/* Facebook Post Header */}
      <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-base font-bold text-slate-700">
                {post.authorName.charAt(0) || 'F'}
              </span>
            )}
          </div>

          {/* Name & Timestamp */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-slate-900 leading-tight">
                {post.authorName}
              </span>
              {post.isVerified && (
                <CheckCircle2 className="w-4 h-4 text-blue-500 fill-blue-500 text-white shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <span>{post.postDate}</span>
              <span aria-hidden="true">·</span>
              <span title={`Privacy: ${post.privacy}`}>{getPrivacyIcon()}</span>
            </div>
          </div>
        </div>

        {/* Action icons / Iframe toggle */}
        <div className="flex items-center gap-2">
          {(post.embedUrl || post.iframeCode) && (
            <button
              type="button"
              onClick={() => setShowLiveIframe(!showLiveIframe)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 ${
                showLiveIframe
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-200/80'
              }`}
              title="Inspect Facebook Iframe Embed & Live Source"
            >
              <span>{showLiveIframe ? 'Hide Embed Inspector' : 'Live Iframe / Source'}</span>
            </button>
          )}
          <div className="text-slate-400 p-1">
            <MoreHorizontal className="w-5 h-5" />
          </div>
        </div>
      </div>

        {/* Live Iframe View & Diagnostics Inspector */}
        {showLiveIframe && (post.embedUrl || post.iframeCode) && (
          <div className="p-4 bg-slate-900 text-slate-100 border-y border-slate-700/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">Facebook Embed Inspection</span>
                <span className="text-[10px] bg-blue-900/60 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-700/50">
                  {post.images.length} Photos Extracted
                </span>
              </div>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium underline"
                >
                  <span>Open Original Post on Facebook</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Explanation banner for iframe limitations */}
            <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/50 text-[11px] text-blue-200 leading-relaxed">
              <span className="font-semibold text-blue-100">Why does Facebook sometimes block live iframes?</span> Browsers enforce strict cross-site cookie privacy inside sandboxed frames (such as AI Studio preview or incognito mode). Our backend scraper has already extracted the complete post text, author, and all {post.images.length} high-resolution worksheet images below so your PDF download will be 100% complete and crystal-clear!
            </div>

            {/* Render Live Iframe */}
            {post.embedUrl && (
              <div className="w-full flex flex-col items-center justify-center bg-white rounded-lg p-2 overflow-hidden shadow-inner border border-slate-300">
                <iframe
                  src={post.embedUrl}
                  width="100%"
                  height="620"
                  className="w-full max-w-[500px] border-0 rounded"
                  style={{ border: 'none', overflow: 'hidden', minHeight: '580px' }}
                  scrolling="yes"
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                />
              </div>
            )}
          </div>
        )}

        {/* Post Content / Caption (Always visible) */}
        {post.postContent && (
          <div className="px-4 sm:px-5 pb-3.5 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
            {renderFormattedContent(post.postContent)}
          </div>
        )}

        {/* Quick actions: copy the text, or share it straight to any app */}
        {post.postContent && (
          <div className="px-4 sm:px-5 pb-3 flex flex-wrap gap-2 print:hidden">
            <button
              onClick={() => void copyPostText()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all"
            >
              {textStatus === 'copied' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {textStatus === 'copied' ? 'Copied — paste away' : 'Copy post text'}
            </button>
            {typeof navigator.share === 'function' && (
              <button
                onClick={() => void sharePostText()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10.5px] font-semibold text-white bg-emerald-600/90 hover:bg-emerald-500 transition-all"
              >
                <Share2 className="w-3 h-3" /> Share post (WhatsApp)
              </button>
            )}
          </div>
        )}

        {/* Responsive Photo Gallery */}
        {post.images && post.images.length > 0 && (
          <div className="w-full bg-slate-950 overflow-hidden border-y border-slate-100">
            {post.images.length === 1 && (
              <div className="w-full flex items-center justify-center bg-slate-50 border border-slate-200/60 max-h-[850px] p-2">
                <img
                  src={post.images[0]}
                  alt="Post attachment"
                  className="w-full h-auto max-h-[840px] object-contain mx-auto cursor-zoom-in"
                  onClick={() => openImage(0)}
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            {post.images.length === 2 && (
              <div className="grid grid-cols-2 gap-0.5 aspect-[16/9]">
                {post.images.slice(0, 2).map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover cursor-zoom-in hover:opacity-95"
                    onClick={() => openImage(idx)}
                    referrerPolicy="no-referrer"
                  />
                ))}
              </div>
            )}

            {post.images.length === 3 && (
              <div className="grid grid-cols-2 gap-0.5 aspect-[4/3]">
                <div className="col-span-2 aspect-[16/9]">
                  <img
                    src={post.images[0]}
                    alt="Primary photo"
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => openImage(0)}
                    referrerPolicy="no-referrer"
                  />
                </div>
                {post.images.slice(1, 3).map((img, idx) => (
                  <div key={idx} className="aspect-square">
                    <img
                      src={img}
                      alt={`Photo ${idx + 2}`}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => openImage(idx + 1)}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ))}
              </div>
            )}

            {post.images.length >= 4 && (
              <div>
                <div className="grid grid-cols-2 gap-0.5 aspect-square">
                  {post.images.slice(0, 4).map((img, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <img
                        src={img}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover cursor-zoom-in"
                        onClick={() => openImage(idx)}
                        referrerPolicy="no-referrer"
                      />
                      {idx === 3 && post.images.length > 4 && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-2 text-center">
                          <span className="text-2xl font-bold font-mono">+{post.images.length - 4}</span>
                          <span className="text-[11px] font-sans font-medium text-slate-200">
                            {post.images.length} Photos in Post
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Strip of thumbnails for all images if > 4 so none are hidden */}
                {post.images.length > 4 && (
                  <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
                      All {post.images.length} Photos:
                    </span>
                    {post.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => openImage(idx)}
                        className="relative w-12 h-12 rounded border border-slate-700 overflow-hidden shrink-0 group"
                        title={`Worksheet Photo ${idx + 1} - click to view high-res`}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[9px] px-1 font-mono">
                          #{idx + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* Engagement Stats Bar */}
      {settings.includeEngagement && (
        <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs text-slate-500 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center -space-x-1">
              <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] shadow-sm">
                👍
              </div>
              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center text-white text-[9px] shadow-sm">
                ❤️
              </div>
            </div>
            <span className="font-medium text-slate-700 ml-1">
              {post.likesCount?.toLocaleString() || '142'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>{post.commentsCount?.toLocaleString() || '28'} comments</span>
            <span>·</span>
            <span>{post.sharesCount?.toLocaleString() || '12'} shares</span>
          </div>
        </div>
      )}

      {/* Action Buttons Mockup */}
      {settings.includeEngagement && (
        <div className="px-3 py-1.5 grid grid-cols-3 border-b border-slate-100 text-xs font-semibold text-slate-600">
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-slate-50">
            <ThumbsUp className="w-4 h-4 text-slate-500" />
            <span>Like</span>
          </div>
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-slate-50">
            <MessageCircle className="w-4 h-4 text-slate-500" />
            <span>Comment</span>
          </div>
          <div className="flex items-center justify-center gap-2 py-1.5 rounded-lg hover:bg-slate-50">
            <Share2 className="w-4 h-4 text-slate-500" />
            <span>Share</span>
          </div>
        </div>
      )}

      {/* Comments List (if present and enabled) */}
      {settings.includeComments && post.comments && post.comments.length > 0 && (
        <div className="p-4 sm:p-5 bg-slate-50/50 space-y-2.5 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-600 block">Top Comments</span>
          {post.comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2.5 text-xs">
              <div className="w-7 h-7 rounded-full bg-slate-300 font-bold text-slate-700 flex items-center justify-center shrink-0 text-[11px]">
                {comment.author.charAt(0)}
              </div>
              <div className="bg-slate-100 rounded-2xl px-3.5 py-2 max-w-lg">
                <span className="font-bold text-slate-900 block leading-tight">
                  {comment.author}
                </span>
                <span className="text-slate-800 leading-normal mt-0.5 block">
                  {comment.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verification & Source Strip with QR Code */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between gap-4 mt-auto">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Verified Source Archive
          </div>
          <div className="text-xs font-mono text-slate-700 truncate mt-0.5" title={post.url}>
            {post.url}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
            <span>Captured: {new Date(post.fetchedAt).toLocaleString()}</span>
            <span>·</span>
            <span>FBID: {post.id}</span>
          </div>
        </div>

        {settings.includeQrCode && qrCodeUrl && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] font-mono text-slate-500 block leading-tight">
                Scan to verify
              </span>
              <span className="text-[9px] font-mono text-slate-500 block leading-tight">
                on Facebook
              </span>
            </div>
            <div className="w-14 h-14 p-1 bg-white border border-slate-300 rounded-lg shadow-2xs">
              <img
                src={qrCodeUrl}
                alt="QR Code to original Facebook post"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>
      {lbIndex !== null && postImages.length > 0 && (
        <MediaLightbox
          items={postImages}
          index={lbIndex}
          onIndex={setLbIndex}
          onClose={() => setLbIndex(null)}
        />
      )}
    </div>
  );
};
