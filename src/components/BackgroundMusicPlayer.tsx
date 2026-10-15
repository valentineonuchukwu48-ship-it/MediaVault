import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Sparkles,
  Download,
  RefreshCw,
  X,
  Radio,
} from 'lucide-react';
import { ambientMusic } from '../utils/audioSynth';

export const BackgroundMusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'lofi' | 'cinematic' | 'celebrate' | 'piano'>('lofi');
  const [volume, setVolume] = useState<number>(0.3);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Lyria AI state
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('Gentle cinematic acoustic background track for celebrating milestones');
  const [aiModel, setAiModel] = useState<'clip' | 'pro'>('clip');
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [lyricsText, setLyricsText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (generatedAudioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    if (isPlaying) {
      ambientMusic.stop();
      setIsPlaying(false);
    } else {
      ambientMusic.start(activePreset);
      ambientMusic.setVolume(isMuted ? 0 : volume);
      setIsPlaying(true);
    }
  };

  const handlePresetChange = (preset: 'lofi' | 'cinematic' | 'celebrate' | 'piano') => {
    setActivePreset(preset);
    if (generatedAudioUrl && audioRef.current) {
      audioRef.current.pause();
      setGeneratedAudioUrl(null);
    }
    if (isPlaying) {
      ambientMusic.start(preset);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    ambientMusic.setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      ambientMusic.setVolume(volume);
      if (audioRef.current) audioRef.current.volume = volume;
    } else {
      setIsMuted(true);
      ambientMusic.setVolume(0);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  };

  // Generate Music via Lyria endpoint
  const handleGenerateLyria = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const storedKey = localStorage.getItem('facestudio_gemini_api_key') || localStorage.getItem('fb_dossier_ai_key') || '';
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          modelType: aiModel,
          apiKey: storedKey || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate music track with Lyria');
      }

      // Convert base64 to Blob URL
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.mimeType || 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);

      setGeneratedAudioUrl(audioUrl);
      setLyricsText(data.lyrics || null);
      ambientMusic.stop();

      // Play generated track
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
      setShowAiModal(false);
    } catch (err: any) {
      console.error('Lyria generation error:', err);
      setAiError(err.message || 'Music generation failed. You can enjoy the built-in ambient synth modes.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between gap-3 text-xs shadow-md">
      {/* Hidden audio element for generated Lyria tracks */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        loop
        className="hidden"
      />

      {/* Left: Player status & Play/Pause */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlay}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/30'
              : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
          title={isPlaying ? 'Pause Background Music' : 'Play Background Music'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <Music className="w-3.5 h-3.5 text-amber-400" />
            <span>Background Music</span>
            {isPlaying && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400 font-mono">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> Playing
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-none">
            {generatedAudioUrl ? 'Lyria AI Custom Track' : `Ambient Synth (${activePreset})`}
          </span>
        </div>
      </div>

      {/* Middle: Ambient Presets */}
      {!generatedAudioUrl && (
        <div className="hidden md:flex items-center gap-1 p-0.5 bg-slate-800/80 rounded-lg border border-slate-700/60 text-[11px]">
          {(['lofi', 'cinematic', 'celebrate', 'piano'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={`px-2 py-0.5 rounded capitalize transition-colors ${
                activePreset === preset
                  ? 'bg-amber-500/20 text-amber-300 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      {/* Right: AI Generate Button & Volume Slider */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowAiModal(true)}
          className="px-2.5 py-1 bg-gradient-to-r from-amber-500/20 to-blue-500/20 hover:from-amber-500/30 hover:to-blue-500/30 border border-amber-500/40 rounded-lg text-amber-300 hover:text-amber-200 font-medium text-[11px] flex items-center gap-1 transition-all"
          title="Generate custom background track with Lyria AI"
        >
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Lyria AI</span>
        </button>

        {/* Volume controls */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
          <button onClick={toggleMute} className="hover:text-slate-200 p-0.5">
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
        </div>
      </div>

      {/* Lyria Music Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-sm text-white">Generate Background Music</span>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateLyria} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Music Description / Mood
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Uplifting cinematic track with piano and strings for celebrating achievements"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Model Duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAiModel('clip')}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      aiModel === 'clip'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold">Lyria Clip (30s)</div>
                    <div className="text-[10px] text-slate-400">lyria-3-clip-preview</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiModel('pro')}
                    className={`p-2 rounded-lg border text-left text-xs ${
                      aiModel === 'pro'
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold">Lyria Pro (Full Track)</div>
                    <div className="text-[10px] text-slate-400">lyria-3-pro-preview</div>
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs">
                  {aiError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingAi || !aiPrompt.trim()}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isGeneratingAi ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating with Lyria...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Music</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
