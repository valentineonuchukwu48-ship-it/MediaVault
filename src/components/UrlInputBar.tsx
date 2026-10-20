import React, { useState } from 'react';
import {
  Download,
  Plus,
  Link2,
  ListPlus,
  Sparkles,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  FileDown,
  Code,
  Layers,
} from 'lucide-react';
import { FacebookPost } from '../types';

interface UrlInputBarProps {
  onGrabAndDownloadPdf: (url: string) => Promise<void>;
  onGrabUrl: (url: string) => Promise<boolean | FacebookPost | null>;
  onBatchGrab: (urls: string[]) => Promise<void>;
  onGrabMultipleEmbedsAndDownloadPdf: (embedsText: string) => Promise<void>;
  onAddMultipleEmbedsToDeck: (embedsText: string) => Promise<void>;
  onUploadImageAndExportPdf: (file: File, authorName?: string, caption?: string) => Promise<void>;
  isLoading: boolean;
  totalPosts: number;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  onGrabAndDownloadPdf,
  onGrabUrl,
  onBatchGrab,
  onGrabMultipleEmbedsAndDownloadPdf,
  onAddMultipleEmbedsToDeck,
  onUploadImageAndExportPdf,
  isLoading,
  totalPosts,
}) => {
  const [activeMode, setActiveMode] = useState<'single_url' | 'embed_codes' | 'image_upload' | 'batch_urls'>('single_url');
  const [url, setUrl] = useState('');
  const [batchUrlsText, setBatchUrlsText] = useState('');
  const [embedsText, setEmbedsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Image upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imgAuthor, setImgAuthor] = useState('Facebook User');
  const [imgCaption, setImgCaption] = useState('Attached Facebook post photo');

  const samplePromptUrl =
    'https://web.facebook.com/photo?fbid=122129387847098460&set=pcb.122129389287098460';

  const sampleSingleEmbed =
    '<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2Fphoto.php%3Ffbid%3D122129387847098460%26set%3Da.122094722013098460%26type%3D3&show_text=true&width=500" width="500" height="607" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>';

  const sampleMultipleEmbeds = `<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2Fphoto.php%3Ffbid%3D122129387847098460%26set%3Da.122094722013098460%26type%3D3&show_text=true&width=500" width="500" height="607" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>

<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid026qCZjyMPykurmChj4enoTW4fr8JmZGWSTnXbGUg1vaRnzPDRGvpXj5hLMdJQH2j3l%26id%3D61595184959939&show_text=true&width=500" width="500" height="213" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;

  const handleInstantDownload = async () => {
    setError(null);
    const targetUrl = url.trim();
    if (!targetUrl) {
      setError('Please paste a Facebook post URL or embed code first');
      return;
    }
    // If multiple iframes or URLs are present, batch extract
    if ((targetUrl.match(/<iframe/gi) || []).length > 1) {
      await onGrabMultipleEmbedsAndDownloadPdf(targetUrl);
    } else {
      await onGrabAndDownloadPdf(targetUrl);
    }
  };

  const handleAddToDeckOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetUrl = url.trim();
    if (!targetUrl) {
      setError('Please enter a Facebook post URL or embed code');
      return;
    }
    const success = await onGrabUrl(targetUrl);
    if (success) {
      setUrl('');
    }
  };

  const handleEmbedsDownloadCombined = async () => {
    setError(null);
    if (!embedsText.trim()) {
      setError('Please paste at least one Facebook embed code');
      return;
    }
    await onGrabMultipleEmbedsAndDownloadPdf(embedsText.trim());
  };

  const handleEmbedsAddToDeck = async () => {
    setError(null);
    if (!embedsText.trim()) {
      setError('Please paste at least one Facebook embed code');
      return;
    }
    await onAddMultipleEmbedsToDeck(embedsText.trim());
    setEmbedsText('');
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const lines = batchUrlsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError('Please paste at least one Facebook URL');
      return;
    }

    const validUrls = lines.filter(
      (l) => l.includes('facebook.com') || l.includes('fb.watch') || l.includes('<iframe')
    );

    if (validUrls.length === 0) {
      setError('No valid Facebook URLs detected');
      return;
    }

    await onBatchGrab(validUrls);
    setBatchUrlsText('');
    setActiveMode('single_url');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setImagePreview(loadEvt.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConvertImageToPdf = async () => {
    if (!uploadedFile) {
      setError('Please choose an image file first');
      return;
    }
    setError(null);
    await onUploadImageAndExportPdf(uploadedFile, imgAuthor, imgCaption);
  };

  const handleQuickLoadPromptUrl = async () => {
    setUrl(samplePromptUrl);
    setError(null);
    await onGrabAndDownloadPdf(samplePromptUrl);
  };

  const handleQuickLoadSampleEmbed = () => {
    setEmbedsText(sampleSingleEmbed);
    setActiveMode('embed_codes');
    setError(null);
  };

  const handleQuickLoadMultipleEmbeds = () => {
    setEmbedsText(sampleMultipleEmbeds);
    setActiveMode('embed_codes');
    setError(null);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 shadow-sm">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between gap-1 mb-3 pb-2.5 border-b border-slate-700/60">
        <div className="flex flex-wrap items-center gap-1 p-0.5 bg-slate-900/80 rounded-lg border border-slate-700/60 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveMode('single_url');
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeMode === 'single_url'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Facebook URL</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('embed_codes');
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeMode === 'embed_codes'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Embed Code(s)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('image_upload');
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeMode === 'image_upload'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Upload Image to PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode('batch_urls');
              setError(null);
            }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeMode === 'batch_urls'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Batch URLs</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Single URL with Instant Download & Queue Options */}
      {activeMode === 'single_url' && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Paste Facebook Post URL or Embed Iframe (e.g. https://web.facebook.com/...)"
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Instant Download Button */}
            <button
              type="button"
              onClick={handleInstantDownload}
              disabled={isLoading || !url.trim()}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              title="Grabs the Facebook post and immediately downloads the PDF file"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Downloading PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download Post to PDF Now</span>
                </>
              )}
            </button>

            {/* Secondary: Add to Deck for Combining */}
            <button
              type="button"
              onClick={handleAddToDeckOnly}
              disabled={isLoading || !url.trim()}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0"
              title="Adds post to queue deck without immediately downloading, so you can append more URLs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Deck</span>
            </button>
          </div>

          {/* Quick link button for user prompt link */}
          <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
            <span>Quick Demos:</span>
            <button
              type="button"
              onClick={handleQuickLoadPromptUrl}
              className="px-2.5 py-1 bg-slate-750 hover:bg-slate-700 text-blue-300 hover:text-white rounded-md border border-slate-600/60 transition-colors flex items-center gap-1.5 font-mono text-[11px]"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Sample: grab a post live</span>
            </button>
          </div>
        </div>
      )}

      {/* Mode 2: Multi Embed Codes */}
      {activeMode === 'embed_codes' && (
        <div className="space-y-3">
          <div>
            <textarea
              rows={4}
              value={embedsText}
              onChange={(e) => {
                setEmbedsText(e.target.value);
                if (error) setError(null);
              }}
              placeholder={`Paste one or multiple Facebook embed codes (<iframe ...></iframe>):\n\n<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2Fpermalink.php%3Fstory_fbid%3Dpfbid...&width=500" ...></iframe>\n\n<iframe src="https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fweb.facebook.com%2Fphoto%3Ffbid...&width=500" ...></iframe>`}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Supports multiple iframe embed codes. All post texts, equations, and images will be extracted and appended into your PDF!
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleQuickLoadSampleEmbed}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-700 hover:border-blue-500/50 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Sample 1 Embed (Olympiad)</span>
              </button>
              <button
                type="button"
                onClick={handleQuickLoadMultipleEmbeds}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-slate-900/60 px-2.5 py-1 rounded-md border border-slate-700 hover:border-emerald-500/50 transition-colors"
              >
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>Sample Multi-Embeds (2 Posts)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEmbedsAddToDeck}
                disabled={isLoading || !embedsText.trim()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Embeds to Deck</span>
              </button>

              <button
                type="button"
                onClick={handleEmbedsDownloadCombined}
                disabled={isLoading || !embedsText.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing Embeds...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All Embeds to PDF Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: Upload Image / Screenshot & Convert to PDF */}
      {activeMode === 'image_upload' && (
        <div className="space-y-3">
          <label className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/50">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-h-36 rounded-lg object-contain border border-slate-700"
                />
                <span className="text-[11px] text-blue-400 font-medium">Click to change image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Choose or drop Facebook post image
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Supports screenshots, photos, PNG, JPG (or press Ctrl+V anywhere!)
                  </span>
                </div>
              </div>
            )}
          </label>

          {uploadedFile && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder="Author Name"
                value={imgAuthor}
                onChange={(e) => setImgAuthor(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
              />
              <input
                type="text"
                placeholder="Caption / Notes"
                value={imgCaption}
                onChange={(e) => setImgCaption(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleConvertImageToPdf}
            disabled={isLoading || !uploadedFile}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Converting to PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Convert Uploaded Image to PDF</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Mode 4: Batch URLs */}
      {activeMode === 'batch_urls' && (
        <form onSubmit={handleBatchSubmit} className="space-y-3">
          <textarea
            rows={4}
            value={batchUrlsText}
            onChange={(e) => {
              setBatchUrlsText(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`Paste multiple Facebook links (one per line):\nhttps://web.facebook.com/photo?fbid=122129387847098460&set=pcb.122129389287098460\nhttps://www.facebook.com/posts/1022938192847`}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isLoading || !batchUrlsText.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5"
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Append All to PDF Deck</span>
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="mt-2.5 p-2.5 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
