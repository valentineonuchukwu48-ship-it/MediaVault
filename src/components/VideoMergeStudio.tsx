import React, { useState, useRef } from 'react';
import { FacebookVideoItem, MergeOptions, MergedVideoResult, MergeResolution } from '../types';
import {
  Video,
  Film,
  Download,
  Play,
  Pause,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Clock,
  HardDrive,
  ExternalLink,
  Zap,
  Upload,
  AlertCircle,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Mic,
  Radio,
  Headphones,
  MessageSquare,
} from 'lucide-react';

interface VideoMergeStudioProps {
  onSwitchToDossier?: () => void;
  onOpenAiStudio?: () => void;
}

const DEMO_CLIPS: FacebookVideoItem[] = [
  {
    id: 'demo_clip_1',
    sourceUrl: 'https://web.facebook.com/watch/?v=10153231379946729',
    title: 'Clip 1: Introduction to Facebook Video Studio (Voice: Puck)',
    authorName: 'Meta Tech Labs',
    authorHandle: '@metatechlabs',
    videoUrl: '/samples/fb_clip_1.mp4?v=talk_v3',
    videoUrlHd: '/samples/fb_clip_1.mp4?v=talk_v3',
    videoUrlSd: '/samples/fb_clip_1.mp4?v=talk_v3',
    duration: 8,
    width: 1280,
    height: 720,
    formatNote: 'Natural Voice (Puck) · 720p MP4',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'demo_clip_2',
    sourceUrl: 'https://web.facebook.com/reel/122129387847098460',
    title: 'Facebook Reel: AI Talking Narration Demo (Voice: Fenrir)',
    authorName: 'Sample Author (demo)',
    authorHandle: '@sample.author',
    videoUrl: '/samples/fb_reel_1.mp4?v=talk_v3',
    videoUrlHd: '/samples/fb_reel_1.mp4?v=talk_v3',
    videoUrlSd: '/samples/fb_reel_1.mp4?v=talk_v3',
    duration: 10,
    width: 720,
    height: 1280,
    formatNote: 'Vertical Reel 9:16 · Voice (Fenrir)',
    fetchedAt: new Date().toISOString(),
  },
  {
    id: 'demo_clip_3',
    sourceUrl: 'https://web.facebook.com/photo/video?fbid=9876543210',
    title: 'Clip 2: Audio Clarity & High Definition Merge (Voice: Kore)',
    authorName: 'Global Community',
    authorHandle: '@globalcommunity',
    videoUrl: '/samples/fb_clip_2.mp4?v=talk_v3',
    videoUrlHd: '/samples/fb_clip_2.mp4?v=talk_v3',
    videoUrlSd: '/samples/fb_clip_2.mp4?v=talk_v3',
    duration: 12,
    width: 1280,
    height: 720,
    formatNote: 'Natural Voice (Kore) · 720p MP4',
    fetchedAt: new Date().toISOString(),
  },
];

export const VideoMergeStudio: React.FC<VideoMergeStudioProps> = ({ onSwitchToDossier, onOpenAiStudio }) => {
  const [videoQueue, setVideoQueue] = useState<FacebookVideoItem[]>(DEMO_CLIPS);
  const [inputUrl, setInputUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [inputMode, setInputMode] = useState<'single' | 'batch' | 'upload'>('single');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [mergeStatusText, setMergeStatusText] = useState('');
  const [mergedResult, setMergedResult] = useState<MergedVideoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Merge settings
  const [resolution, setResolution] = useState<MergeResolution>('720p');
  const [fps, setFps] = useState<number>(30);
  const [normalizeAudio, setNormalizeAudio] = useState(true);

  // Playing preview tracking
  const [playingId, setPlayingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioTestRef = useRef<HTMLAudioElement | null>(null);
  const mergedVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeAudioPlayingUrl, setActiveAudioPlayingUrl] = useState<string | null>(null);
  const [isMergedMuted, setIsMergedMuted] = useState(false);

  // AI Voiceover Studio State
  const [voiceoverText, setVoiceoverText] = useState(
    'Welcome to our video presentation! Our built-in AI speech engine delivers crystal-clear talking narration across all your merged clips.'
  );
  const [voiceoverVoice, setVoiceoverVoice] = useState('Puck');
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isDubbingVoice, setIsDubbingVoice] = useState(false);
  const [voiceSuccessMsg, setVoiceSuccessMsg] = useState<string | null>(null);
  const [mixMode, setMixMode] = useState<'overlay' | 'replace'>('overlay');
  const [selectedVideoForDubbing, setSelectedVideoForDubbing] = useState<string>('');

  // Play clip audio directly with HTML5 Audio to bypass browser video autoplay policies
  const handleTestClipAudio = (url: string) => {
    if (audioTestRef.current) {
      try {
        audioTestRef.current.pause();
        audioTestRef.current.currentTime = 0;
      } catch {}
    }
    if (activeAudioPlayingUrl === url) {
      setActiveAudioPlayingUrl(null);
      return;
    }
    const cleanAudio = new Audio(url);
    cleanAudio.volume = 1.0;
    cleanAudio.onended = () => setActiveAudioPlayingUrl(null);
    cleanAudio.onerror = () => setActiveAudioPlayingUrl(null);
    audioTestRef.current = cleanAudio;
    const playPromise = cleanAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setActiveAudioPlayingUrl(url);
        })
        .catch((err) => {
          // Ignore interruption abort errors from rapid clicks
          if (err.name !== 'AbortError') {
            console.warn('Audio play info:', err.message);
          }
        });
    }
  };

  const handleUnmuteMergedVideo = () => {
    if (mergedVideoRef.current) {
      mergedVideoRef.current.muted = false;
      mergedVideoRef.current.volume = 1.0;
      mergedVideoRef.current.play().catch(() => {});
      setIsMergedMuted(false);
    }
  };

  const handlePreviewVoice = async () => {
    if (!voiceoverText.trim()) return;
    setIsGeneratingVoice(true);
    setVoiceSuccessMsg(null);
    setErrorMsg(null);
    try {
      const storedKey = localStorage.getItem('facestudio_gemini_api_key') || localStorage.getItem('fb_dossier_ai_key') || '';
      const provider = localStorage.getItem('facestudio_ai_provider') || 'gemini';
      const baseUrl = localStorage.getItem('facestudio_ai_base_url') || '';
      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voiceoverText.trim(),
          voice: voiceoverVoice,
          apiKey: storedKey || undefined,
          provider,
          baseUrl: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to synthesize speech');
      }
      setPreviewAudioUrl(data.audioUrl);
      const audio = new Audio(data.audioUrl);
      audio.volume = 1.0;
      audio.play().catch(() => {});
      setVoiceSuccessMsg(`Spoken voice (${voiceoverVoice}) generated and playing!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating AI voice');
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleAutoDraftScript = async () => {
    setIsGeneratingVoice(true);
    try {
      const storedKey = localStorage.getItem('facestudio_gemini_api_key') || localStorage.getItem('fb_dossier_ai_key') || '';
      const provider = localStorage.getItem('facestudio_ai_provider') || 'gemini';
      const baseUrl = localStorage.getItem('facestudio_ai_base_url') || '';
      const context = videoQueue.map(v => v.title).join(', ');
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write a short, engaging 25-word talking narration script for a Facebook Reel/video covering: ${context || 'Facebook video highlights'}. Return ONLY the spoken sentences with no emojis, bullets, or stage directions.`,
          apiKey: storedKey || undefined,
          provider,
          baseUrl: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.text) {
        setVoiceoverText(data.text.trim());
      }
    } catch (err: any) {
      console.warn(err);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleDubVoiceover = async (targetVideoUrl: string) => {
    if (!voiceoverText.trim()) {
      setErrorMsg('Please enter a voiceover script to dub into the video');
      return;
    }
    setIsDubbingVoice(true);
    setVoiceSuccessMsg(null);
    setErrorMsg(null);
    try {
      const storedKey = localStorage.getItem('facestudio_gemini_api_key') || localStorage.getItem('fb_dossier_ai_key') || '';
      const provider = localStorage.getItem('facestudio_ai_provider') || 'gemini';
      const baseUrl = localStorage.getItem('facestudio_ai_base_url') || '';
      const res = await fetch('/api/video/add-voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: targetVideoUrl,
          text: voiceoverText.trim(),
          voice: voiceoverVoice,
          mixMode,
          apiKey: storedKey || undefined,
          provider,
          baseUrl: baseUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dub talking voiceover onto video');
      }
      setMergedResult(data.result);
      setVoiceSuccessMsg('Talking voiceover burned into video! Ready to play and download with real voice audio.');
      setTimeout(() => {
        document.getElementById('merged-result-card')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error adding voiceover');
    } finally {
      setIsDubbingVoice(false);
    }
  };

  // Format seconds to mm:ss
  const formatDuration = (sec?: number) => {
    if (!sec || isNaN(sec)) return '0:05';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Format bytes to MB
  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Copy text helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Extract Single URL
  const handleExtractSingle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;

    setIsExtracting(true);
    setErrorMsg(null);
    setErrorHint(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/video/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Failed to extract video from URL');
        setErrorHint(data.hint || null);
        setErrorCode(data.code || null);
        return;
      }

      setVideoQueue((prev) => [data.video, ...prev]);
      setInputUrl('');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error extracting video');
    } finally {
      setIsExtracting(false);
    }
  };

  // Extract Multiple Batch URLs
  const handleExtractBatch = async () => {
    if (!batchText.trim()) return;

    setIsExtracting(true);
    setErrorMsg(null);
    setErrorHint(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/video/extract-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: batchText.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.videos && data.videos.length > 0) {
        setVideoQueue((prev) => [...data.videos, ...prev]);
        setBatchText('');
        // Report any links that failed inside a partly-successful batch.
        if (data.errors && data.errors.length > 0) {
          setErrorMsg(`${data.errors.length} link(s) could not be extracted.`);
          setErrorHint(data.errors[0]?.hint || null);
          setErrorCode(data.errors[0]?.code || null);
        }
        return;
      }

      const firstError = data.errors && data.errors[0];
      setErrorMsg(firstError?.error || data.error || 'No valid Facebook video links found in text');
      setErrorHint(firstError?.hint || data.hint || null);
      setErrorCode(firstError?.code || data.code || null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error extracting batch videos');
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle local file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsExtracting(true);
    setErrorMsg(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileData = await base64Promise;
        const res = await fetch('/api/video/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileData }),
        });

        const uploadData = await res.json();
        const finalUrl = uploadData.url || URL.createObjectURL(file);

        const newItem: FacebookVideoItem = {
          id: `upload_${Date.now()}_${i}`,
          sourceUrl: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
          authorName: 'Uploaded Clip',
          authorHandle: '@local_video',
          videoUrl: finalUrl,
          videoUrlHd: finalUrl,
          videoUrlSd: finalUrl,
          duration: 5,
          formatNote: 'Local MP4',
          fetchedAt: new Date().toISOString(),
          isCustomUpload: true,
        };
        setVideoQueue((prev) => [...prev, newItem]);
      } catch (err: any) {
        console.error('File upload error:', err);
        const blobUrl = URL.createObjectURL(file);
        setVideoQueue((prev) => [
          ...prev,
          {
            id: `upload_${Date.now()}_${i}`,
            sourceUrl: file.name,
            title: file.name.replace(/\.[^/.]+$/, ''),
            authorName: 'Uploaded Clip',
            authorHandle: '@local_video',
            videoUrl: blobUrl,
            videoUrlHd: blobUrl,
            videoUrlSd: blobUrl,
            duration: 5,
            formatNote: 'Local MP4',
            fetchedAt: new Date().toISOString(),
            isCustomUpload: true,
          },
        ]);
      }
    }

    setIsExtracting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Re-order queue
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newQueue = [...videoQueue];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newQueue.length) return;

    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIdx];
    newQueue[targetIdx] = temp;
    setVideoQueue(newQueue);
  };

  const removeItem = (id: string) => {
    setVideoQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick reset to demo clips
  const handleLoadDemos = () => {
    setVideoQueue(DEMO_CLIPS);
    setErrorMsg(null);
  };

  // Trigger Fast Video Merge
  const handleMergeVideos = async () => {
    if (videoQueue.length === 0) {
      setErrorMsg('Add at least one Facebook video to merge.');
      return;
    }

    setIsMerging(true);
    setErrorMsg(null);
    setMergeProgress(10);
    setMergeStatusText(`Downloading ${videoQueue.length} video streams...`);

    const progressTimer = setInterval(() => {
      setMergeProgress((p) => {
        if (p < 35) return p + 10;
        if (p < 80) return p + 5;
        return p < 92 ? p + 1 : p;
      });
    }, 400);

    try {
      setTimeout(() => {
        setMergeStatusText('Encoding and concatenating with FFmpeg ultrafast pipeline...');
      }, 1000);

      const payload = {
        videos: videoQueue.map((v) => ({
          url: v.videoUrlHd || v.videoUrl,
          audioUrl: v.audioUrl,
          title: v.title,
        })),
        options: {
          resolution,
          fps,
          normalizeAudio,
        },
      };

      const res = await fetch('/api/video/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Video merge failed on server');
      }

      setMergeProgress(100);
      setMergeStatusText('Merging completed successfully!');
      setMergedResult(data.result);

      // Smooth scroll to merged result
      setTimeout(() => {
        document.getElementById('merged-result-card')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error(err);
      setErrorMsg(err.message || 'Error occurred while merging videos');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-16">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-800 to-slate-900 rounded-3xl p-6 md:p-10 text-white shadow-2xl border border-blue-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 backdrop-blur-md rounded-full text-blue-200 text-xs font-semibold uppercase tracking-wider border border-blue-400/30">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              Ultra-Fast Video Pipeline &middot; Native FFmpeg
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
              Facebook Video Downloader &amp; Multi-Video Merger
            </h1>
            <p className="text-blue-100 text-sm md:text-base leading-relaxed">
              Grab direct MP4 download links from Facebook Reels, Watch, or post videos. Merge multiple Facebook video
              links into <strong>one single, high-definition MP4</strong> in seconds with audio sync and auto-scaling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {onOpenAiStudio && (
              <button
                onClick={onOpenAiStudio}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl backdrop-blur-md transition border border-purple-400/30 shadow-lg shadow-purple-950/40"
                title="Launch AI Studio with custom Gemini API Key & Model ID"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span>AI Assistant &amp; Scripting</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-white/20 text-white uppercase font-bold tracking-wider">
                  BYOK
                </span>
              </button>
            )}
            <button
              onClick={handleLoadDemos}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl backdrop-blur-md transition border border-white/20 shadow-sm"
              title="Load 3 high-quality Facebook video clips for instant test"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              Load Sample Clips
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition shadow-lg shadow-blue-900/40"
            >
              <Upload className="w-4 h-4" />
              Upload Local MP4
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="video/mp4,video/*"
              multiple
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* URL Input Bar & Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputMode('single')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                inputMode === 'single'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Single Facebook Video
            </button>
            <button
              onClick={() => setInputMode('batch')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${
                inputMode === 'batch'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>Batch Multiple Links</span>
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md font-bold">
                Fast
              </span>
            </button>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Reels · Watch · facebook.com/videos · iframes — Stories &amp; private videos need a login
          </span>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-3 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">{errorMsg}</p>
              {errorHint && <p className="text-xs opacity-90">{errorHint}</p>}
              {(errorCode === 'LOGIN_REQUIRED' || errorCode === 'BROWSER_COOKIES_LOCKED') && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('fgc:open-desktop'))}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                >
                  Set up Facebook login
                </button>
              )}
            </div>
            <button onClick={() => { setErrorMsg(null); setErrorHint(null); setErrorCode(null); }} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {inputMode === 'single' ? (
          <form onSubmit={handleExtractSingle} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste Facebook Video / Reel link (e.g. https://www.facebook.com/reel/123... or watch/?v=...)"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isExtracting || !inputUrl.trim()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-600/30 flex-shrink-0"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Extract &amp; Add Video
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <textarea
              rows={3}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Paste multiple Facebook video URLs or <iframe> codes (one per line, separated by spaces or commas)..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs leading-relaxed"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tip: You can paste 5, 10, or more links at once. The server will extract and prepare all streams
                concurrently.
              </p>
              <button
                onClick={handleExtractBatch}
                disabled={isExtracting || !batchText.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-md shadow-blue-600/30"
              >
                {isExtracting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Extracting Multiple...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-yellow-300" />
                    Extract All Videos
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Queue on Left, Merge Settings & Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Video Queue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Video Sequence Queue ({videoQueue.length})
              </h2>
            </div>
            {videoQueue.length > 0 && (
              <button
                onClick={() => setVideoQueue([])}
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 hover:underline font-medium"
              >
                Clear Queue
              </button>
            )}
          </div>

          {videoQueue.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center">
                <Video className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">No videos in queue</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Paste Facebook video links above or click &ldquo;Load Sample Clips&rdquo; to test merging multiple videos
                  instantly.
                </p>
              </div>
              <button
                onClick={handleLoadDemos}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition shadow-md shadow-blue-500/20"
              >
                Load Sample Clips
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {videoQueue.map((item, index) => {
                const isPlaying = playingId === item.id;
                const streamSrc = item.videoUrl;

                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition space-y-3"
                  >
                    <div className="flex items-start gap-4">
                      {/* Video Thumbnail / Live Mini Player */}
                      <div className="relative w-40 h-28 bg-slate-900 rounded-xl overflow-hidden flex-shrink-0 group border border-slate-800">
                        <video
                          id={`video-player-${item.id}`}
                          src={streamSrc}
                          controls={isPlaying}
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                          onPlay={() => setPlayingId(item.id)}
                          onPause={() => setPlayingId(null)}
                        />
                        {!isPlaying && (
                          <button
                            onClick={() => {
                              setPlayingId(item.id);
                              const el = document.getElementById(`video-player-${item.id}`) as HTMLVideoElement;
                              if (el) {
                                el.muted = false;
                                el.play().catch(() => {
                                  el.muted = true;
                                  el.play();
                                });
                              }
                            }}
                            className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center text-white transition"
                            title="Play Video with Sound"
                          >
                            <div className="w-10 h-10 bg-blue-600/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                              <Play className="w-5 h-5 fill-white translate-x-0.5" />
                            </div>
                          </button>
                        )}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-mono rounded">
                          {formatDuration(item.duration)}
                        </div>
                      </div>

                      {/* Video Info & Audio Controls */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate" title={item.title}>
                            {index + 1}. {item.title}
                          </h4>
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold rounded-md flex-shrink-0">
                            {item.formatNote || 'HD MP4'}
                          </span>
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          Creator: <strong className="text-slate-700 dark:text-slate-300">{item.authorName}</strong>{' '}
                          {item.authorHandle}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {item.width && item.height && (
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {item.width}x{item.height}
                            </span>
                          )}
                          <span className="truncate max-w-[180px]" title={item.sourceUrl}>
                            {item.sourceUrl.replace(/^https?:\/\/(?:www\.)?/, '')}
                          </span>
                        </div>

                        {/* Direct Talking Audio Test Button */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            onClick={() => handleTestClipAudio(streamSrc)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition inline-flex items-center gap-1.5 ${
                              activeAudioPlayingUrl === streamSrc
                                ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                            }`}
                            title="Directly play the spoken audio track in browser"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>
                              {activeAudioPlayingUrl === streamSrc ? 'Playing Voice (Click to Stop)' : '🔊 Hear Spoken Audio'}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedVideoForDubbing(streamSrc);
                              document.getElementById('ai-voiceover-studio')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition inline-flex items-center gap-1"
                          >
                            <Mic className="w-3 h-3 text-purple-500" />
                            <span>Dub AI Narration</span>
                          </button>
                        </div>
                      </div>

                      {/* Order & Delete Actions */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        <button
                          onClick={() => moveItem(index, 'up')}
                          disabled={index === 0}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 rounded transition"
                          title="Move Up in Sequence"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveItem(index, 'down')}
                          disabled={index === videoQueue.length - 1}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-30 rounded transition"
                          title="Move Down in Sequence"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 rounded transition"
                          title="Remove from Merge Queue"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Download Individual Video Bar */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/video/download-clip?url=${encodeURIComponent(item.videoUrlHd || item.videoUrl)}${item.audioUrl ? `&audio=${encodeURIComponent(item.audioUrl)}` : ''}&id=${item.id}`}
                          download={`facebook_video_${item.id}.mp4`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-600 rounded-lg font-medium transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download this Clip (with Sound)</span>
                        </a>
                        <button
                          onClick={() => handleCopy(item.videoUrlHd || item.videoUrl, item.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                          title="Copy Direct Video Link"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono">
                        Clip {index + 1} of {videoQueue.length}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Fast Merger Settings & Merged Player (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Talking Voiceover (Text-to-Speech) Studio */}
          <div
            id="ai-voiceover-studio"
            className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/30 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white">AI Talking Voiceover (TTS)</h3>
              </div>
              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold rounded-md">
                Gemini TTS Natural Voices
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Make your video talk with authentic human speech! Type any script below or click &ldquo;Auto-Draft Script with AI&rdquo;, preview the voice in browser, and dub it into any video.
            </p>

            {/* Voice Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Select Speaker Voice:</span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-normal">5 Natural Personalities</span>
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { id: 'Puck', label: 'Puck (Host & Energetic)' },
                  { id: 'Kore', label: 'Kore (Friendly & Clear)' },
                  { id: 'Fenrir', label: 'Fenrir (Deep & Authoritative)' },
                  { id: 'Aoede', label: 'Aoede (Warm & Conversational)' },
                  { id: 'Charon', label: 'Charon (Cinematic & Steady)' },
                ].map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceoverVoice(v.id)}
                    className={`p-2 rounded-xl text-left font-medium border transition ${
                      voiceoverVoice === v.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Script Input with Auto Draft */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Talking Script / Narration:
                </label>
                <button
                  type="button"
                  onClick={handleAutoDraftScript}
                  disabled={isGeneratingVoice}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3 text-yellow-500" />
                  <span>Auto-Draft Script with AI</span>
                </button>
              </div>
              <textarea
                value={voiceoverText}
                onChange={(e) => setVoiceoverText(e.target.value)}
                rows={3}
                placeholder="Type what you want the video to say..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Voice Mix Mode */}
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">Audio Mix Mode</div>
                <div className="text-[11px] text-slate-400">How voiceover interacts with video</div>
              </div>
              <select
                value={mixMode}
                onChange={(e) => setMixMode(e.target.value as any)}
                className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium"
              >
                <option value="overlay">Overlay Voice & Duck Background</option>
                <option value="replace">Replace Audio Entirely with Voice</option>
              </select>
            </div>

            {/* Success or playing notification */}
            {voiceSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{voiceSuccessMsg}</span>
              </div>
            )}

            {/* Voice Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handlePreviewVoice}
                disabled={isGeneratingVoice || !voiceoverText.trim()}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-xs transition inline-flex items-center justify-center gap-2"
              >
                {isGeneratingVoice ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                )}
                <span>🔊 Test / Preview Voice</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const target =
                    mergedResult?.streamUrl ||
                    videoQueue[0]?.videoUrlHd ||
                    videoQueue[0]?.videoUrl ||
                    '/samples/fb_clip_1.mp4';
                  handleDubVoiceover(target);
                }}
                disabled={isDubbingVoice || videoQueue.length === 0}
                className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition inline-flex items-center justify-center gap-2"
              >
                {isDubbingVoice ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mic className="w-3.5 h-3.5" />
                )}
                <span>🎙️ Burn Voice into Video</span>
              </button>
            </div>
          </div>

          {/* Merge Settings Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-900 dark:text-white">Merge Configuration</h3>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Output Resolution &amp; Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '720p', label: '720p HD (Fastest)', desc: '1280x720 16:9' },
                    { id: '1080p', label: '1080p FHD', desc: '1920x1080 16:9' },
                    { id: 'vertical_reel', label: 'Vertical Reel', desc: '720x1280 9:16' },
                    { id: 'match_first', label: 'Match 1st Clip', desc: 'Native Dimensions' },
                  ].map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setResolution(res.id as MergeResolution)}
                      className={`p-3 rounded-xl text-left border transition ${
                        resolution === res.id
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">{res.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{res.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    Audio Sync &amp; Normalization
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Harmonizes stereo audio &amp; handles silent clips
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={normalizeAudio}
                  onChange={(e) => setNormalizeAudio(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">Framerate Target</div>
                  <div className="text-[11px] text-slate-500">Smooth playback across mixed sources</div>
                </div>
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold"
                >
                  <option value={30}>30 FPS (Standard)</option>
                  <option value={60}>60 FPS (High Motion)</option>
                </select>
              </div>
            </div>

            {/* Total Duration Estimate */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Estimated Total Length:</span>
              </div>
              <strong className="font-mono text-sm">
                {formatDuration(videoQueue.reduce((acc, curr) => acc + (curr.duration || 5), 0))}
              </strong>
            </div>

            {/* Big Merge Action Button */}
            <button
              onClick={handleMergeVideos}
              disabled={isMerging || videoQueue.length === 0}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 transition transform active:scale-[0.99]"
            >
              {isMerging ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Merging {videoQueue.length} Videos...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 text-yellow-300" />
                  <span>Merge {videoQueue.length} Videos into 1 MP4</span>
                </>
              )}
            </button>

            {/* Progress Bar when merging */}
            {isMerging && (
              <div className="space-y-2 pt-2">
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300 rounded-full"
                    style={{ width: `${mergeProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium animate-pulse">{mergeStatusText}</span>
                  <span className="font-mono font-bold">{mergeProgress}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Merged Video Result Card */}
          {mergedResult && (
            <div
              id="merged-result-card"
              className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/40 p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-slate-900 dark:text-white">Merged MP4 Ready!</h3>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
                  {mergedResult.videoCount} Videos Joined
                </span>
              </div>

              {/* In-Browser Video Player */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-inner group">
                <video
                  ref={mergedVideoRef}
                  src={mergedResult.streamUrl}
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Talking Sound Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-medium">Talking Audio Track Active (Stereo AAC)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleUnmuteMergedVideo}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Unmute &amp; Play Loud</span>
                  </button>
                  <button
                    onClick={() => handleTestClipAudio(mergedResult.streamUrl)}
                    className="px-3 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-semibold rounded-lg shadow-sm transition inline-flex items-center gap-1.5"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Direct Audio</span>
                  </button>
                </div>
              </div>

              {/* Video stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Duration</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {formatDuration(mergedResult.duration)}
                  </div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">File Size</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {formatBytes(mergedResult.fileSizeBytes)}
                  </div>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] uppercase font-semibold">Resolution</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {mergedResult.resolution}
                  </div>
                </div>
              </div>

              {/* Direct Download Button */}
              <a
                href={mergedResult.downloadUrl}
                download={mergedResult.filename}
                className="w-full py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 text-sm transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Merged MP4 Video (With Talking Audio)</span>
              </a>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span className="truncate max-w-[200px]">{mergedResult.filename}</span>
                <button
                  onClick={() => handleCopy(window.location.origin + mergedResult.downloadUrl, 'merged')}
                  className="hover:text-slate-600 dark:hover:text-slate-200 font-medium inline-flex items-center gap-1"
                >
                  {copiedId === 'merged' ? 'Link Copied!' : 'Copy Direct Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
