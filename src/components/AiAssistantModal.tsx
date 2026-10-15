import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Key,
  Cpu,
  Sliders,
  Send,
  Bot,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Video,
  ListPlus,
  RefreshCw,
  Eye,
  EyeOff,
  Wand2,
  MessageSquare,
  Flame,
  Volume2,
  Camera,
  SwitchCamera,
  Paperclip,
  X,
} from 'lucide-react';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  postContext?: any;
  videoQueueContext?: any;
}

const POPULAR_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Default / Ultra Fast)', desc: 'General text, analysis, instant summaries' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (Complex Reasoning)', desc: 'Deep logic, scriptwriting, advanced analysis' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (High Throughput)', desc: 'Lowest latency for high frequency prompts' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', desc: 'Always points to the latest Flash release' },
];

// AI Providers. Gemini uses the native SDK; every other entry is OpenAI-compatible
// and only needs a key + base URL + model ID. Free tiers noted where known.
// Free key directory: https://github.com/open-free-llm-api/awesome-freellm-apis
const AI_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini (native)',
    baseUrl: '',
    openaiCompatible: false,
    free: true,
    keyUrl: 'https://aistudio.google.com/apikey',
    models: POPULAR_MODELS.map((m) => m.id),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (many free models)',
    baseUrl: 'https://openrouter.ai/api/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://openrouter.ai/keys',
    models: [
      'deepseek/deepseek-chat',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ],
  },
  {
    id: 'groq',
    name: 'Groq (ultra-fast free tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://console.groq.com/keys',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM (free credits)',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://build.nvidia.com/',
    models: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'qwen/qwen2.5-72b-instruct'],
  },
  {
    id: 'cerebras',
    name: 'Cerebras (fast free tier)',
    baseUrl: 'https://api.cerebras.ai/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://cloud.cerebras.ai/',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
  },
  {
    id: 'together',
    name: 'Together AI (free models)',
    baseUrl: 'https://api.together.xyz/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://api.together.ai/',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  },
  {
    id: 'fireworks',
    name: 'Fireworks AI (free tier)',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://fireworks.ai/',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
  },
  {
    id: 'mistral',
    name: 'Mistral AI (free tier)',
    baseUrl: 'https://api.mistral.ai/v1',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://console.mistral.ai/',
    models: ['mistral-small-latest', 'open-mistral-nemo'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    openaiCompatible: true,
    free: false,
    keyUrl: 'https://platform.deepseek.com/',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'openai',
    name: 'OpenAI (or any OpenAI-compatible)',
    baseUrl: 'https://api.openai.com/v1',
    openaiCompatible: true,
    free: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible endpoint',
    baseUrl: '',
    openaiCompatible: true,
    free: true,
    keyUrl: 'https://github.com/open-free-llm-api/awesome-freellm-apis',
    models: [],
  },
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  postContext,
  videoQueueContext,
}) => {
  // Provider & credentials state
  const [provider, setProvider] = useState<string>(() => localStorage.getItem('facestudio_ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('facestudio_gemini_api_key') || '');
  const [baseUrl, setBaseUrl] = useState<string>(() => localStorage.getItem('facestudio_ai_base_url') || '');
  const [modelId, setModelId] = useState<string>(() => localStorage.getItem('facestudio_gemini_model_id') || 'gemini-3.8-flash');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [showKey, setShowKey] = useState(false);

  const activeProvider = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];

  // Live list of models fetched from the provider for the entered key.
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsMessage, setModelsMessage] = useState<string>('');

  // When the provider changes, auto-fill its base URL and a sensible default model.
  const handleProviderChange = (id: string) => {
    setProvider(id);
    setAvailableModels([]);
    setModelsMessage('');
    const preset = AI_PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setBaseUrl(preset.baseUrl);
    if (preset.models.length > 0) {
      setModelId(preset.models[0]);
    } else if (id === 'gemini') {
      setModelId('gemini-3.8-flash');
    }
  };

  // Fetch the models this key can actually use from the provider.
  const handleListModels = async () => {
    setLoadingModels(true);
    setModelsMessage('');
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider, baseUrl: baseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to list models');
      }
      const list: string[] = data.models || [];
      setAvailableModels(list);
      setModelsMessage(list.length ? `Found ${list.length} model(s). Pick one below.` : 'No models returned by this provider.');
      if (list.length > 0) setModelId(list[0]);
    } catch (err: any) {
      setAvailableModels([]);
      setModelsMessage(err.message || 'Could not list models.');
    } finally {
      setLoadingModels(false);
    }
  };

  // ---- Image attach: file / paste / camera helpers ----
  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr: File[] = Array.isArray(files) ? files : Array.from(files);
    arr.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachedImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing: 'environment' | 'user') => {
    setCameraError('');
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setFacingMode(facing);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access in your browser.'
          : 'Could not access the camera. Make sure a camera is connected.'
      );
    }
  };

  const openCamera = () => {
    setCameraOpen(true);
    startCamera('environment');
  };

  const closeCamera = () => {
    stopCamera();
    setCameraOpen(false);
    setCameraError('');
  };

  const switchCamera = () => {
    startCamera(facingMode === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setAttachedImages((prev) => [...prev, canvas.toDataURL('image/jpeg', 0.92)]);
    closeCamera();
  };

  const removeAttached = (idx: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePasteImages = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      addFiles(files);
      e.preventDefault();
    }
  };

  // Connection testing
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');

  // Prompting & Chat state
  const [prompt, setPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [responseOutput, setResponseOutput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ role: 'user' | 'model'; text: string; timestamp: string; images?: string[] }>>([
    {
      role: 'model',
      text: "👋 Hi! I'm your Facebook Media & Content AI assistant. You can provide your Gemini API Key & Model ID here, or test analyzing video scripts, generating viral captions, resolving audio issues, or summarizing post archives.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Attached images (from file / paste / camera) sent with the next prompt.
  const [attachedImages, setAttachedImages] = useState<string[]>([]);

  // Camera capture state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist settings
  useEffect(() => {
    if (apiKey) localStorage.setItem('facestudio_gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (modelId) localStorage.setItem('facestudio_gemini_model_id', modelId);
  }, [modelId]);

  useEffect(() => {
    localStorage.setItem('facestudio_ai_provider', provider);
  }, [provider]);

  useEffect(() => {
    if (baseUrl) localStorage.setItem('facestudio_ai_base_url', baseUrl);
  }, [baseUrl]);

  if (!isOpen) return null;

  // Test API Key & Model Connection
  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage(`Pinging ${activeProvider.name} with model ${modelId}...`);

    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          modelId: modelId.trim(),
          provider,
          baseUrl: baseUrl.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Connection failed');
      }

      setTestStatus('success');
      setTestMessage(`Connected successfully to ${data.modelUsed} (${provider})!`);
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Verification failed. Check API key, base URL & model ID.');
    }
  };

  // Submit Prompt to AI
  const handleSendPrompt = async (customText?: string) => {
    const textToSend = customText ?? prompt;
    const sentImages = attachedImages.length ? [...attachedImages] : undefined;
    if ((!textToSend.trim() && !sentImages) || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);

    const newHistory = [
      ...history,
      {
        role: 'user' as const,
        text: textToSend,
        images: sentImages,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setHistory(newHistory);
    setPrompt('');
    setAttachedImages([]);

    // Context packet
    const contextPacket = {
      currentVideoQueueCount: videoQueueContext?.length || 0,
      videoQueueTitles: videoQueueContext?.map((v: any) => v.title) || [],
      activePostTitle: postContext?.postContent?.slice(0, 200) || '',
      activePostAuthor: postContext?.authorName || '',
    };

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          modelId: modelId.trim(),
          provider,
          baseUrl: baseUrl.trim(),
          prompt: textToSend,
          temperature,
          images: sentImages,
          contextData: contextPacket,
          systemInstruction:
            'You are an expert AI Media Assistant specialized in social media video production, Facebook Reels, viral captions, video editing tips, and content archiving. Be concise, highly practical, and formatted cleanly in markdown.',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AI generation failed');
      }

      setResponseOutput(data.text);
      setHistory([
        ...newHistory,
        {
          role: 'model' as const,
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing AI prompt');
      setHistory([
        ...newHistory,
        {
          role: 'model' as const,
          text: `⚠️ **Error:** ${err.message || 'Could not generate response. Please verify your API Key and Model ID.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  // Pre-configured Quick Action prompts
  const quickActions = [
    {
      title: 'Analyze Audio & Video Sync',
      icon: <Volume2 className="w-3.5 h-3.5 text-blue-500" />,
      prompt: 'Check best practices for ensuring stereo sound and loudnorm audio levels when merging multiple Facebook video MP4s.',
    },
    {
      title: 'Generate Viral Reel Titles',
      icon: <Flame className="w-3.5 h-3.5 text-orange-500" />,
      prompt: 'Write 5 catchy, high-engagement Facebook Reel titles and hashtag sets for the merged video sequence.',
    },
    {
      title: 'Create Reel Script & Outline',
      icon: <Wand2 className="w-3.5 h-3.5 text-purple-500" />,
      prompt: 'Write a cohesive 30-second narration script linking the video clips in our queue together seamlessly.',
    },
    {
      title: 'Summarize Post For PDF Dossier',
      icon: <FileText className="w-3.5 h-3.5 text-emerald-500" />,
      prompt: 'Summarize the active Facebook post and draft an executive briefing note for the PDF archive.',
    },
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI Studio &amp; Gemini Assistant</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Custom Key &amp; Model
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plug in your own API Key, pick any Model ID, and apply AI to your Facebook videos and posts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        {/* Modal Body: Settings Header + Chat / Output Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* API Key & Model Configuration Box */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-purple-500" />
                BYOK (Bring Your Own Key) &amp; Model Configuration
              </span>
              <a
                href="https://github.com/open-free-llm-api/awesome-freellm-apis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-indigo-500 hover:text-indigo-600 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Free LLM API keys &rarr;
              </a>
            </div>

            {/* Provider Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                <span>AI Provider</span>
                <span className="text-[10px] text-slate-400">Gemini or any OpenAI-compatible model</span>
              </label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.free ? '  • free tier' : ''}
                  </option>
                ))}
              </select>
              {activeProvider.keyUrl && (
                <a
                  href={activeProvider.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[10px] text-indigo-500 hover:underline"
                >
                  Get a {activeProvider.name.split(' ')[0]} API key &rarr;
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span>API Key</span>
                  <span className="text-[10px] text-slate-400">{provider === 'gemini' ? 'Optional: defaults to env' : 'Required'}</span>
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'gemini' ? 'AIzaSy... (leave blank to use default)' : 'sk-... / your provider key'}
                    className="w-full pl-3 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model ID Selector / Custom Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span>Model ID</span>
                  <span className="text-[10px] text-indigo-500 font-medium">Customizable</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder={provider === 'gemini' ? 'gemini-3.8-flash' : 'e.g. llama-3.3-70b-versatile'}
                    className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleListModels}
                    disabled={loadingModels}
                    title="Fetch the models your key can use"
                    className="px-2.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap disabled:opacity-50 flex items-center gap-1"
                  >
                    {loadingModels ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ListPlus className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">List</span>
                  </button>
                  {(() => {
                    const merged = Array.from(new Set([...(availableModels || []), ...activeProvider.models]));
                    return merged.length > 0 ? (
                      <select
                        value={modelId}
                        onChange={(e) => setModelId(e.target.value)}
                        className="px-2 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-300 font-medium max-w-[170px] truncate"
                      >
                        {merged.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    ) : null;
                  })()}
                </div>
                {modelsMessage && (
                  <p className={`text-[10px] ${availableModels.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {modelsMessage}
                  </p>
                )}
              </div>
            </div>

            {/* Base URL (only for OpenAI-compatible providers) */}
            {activeProvider.openaiCompatible && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  <span>Base URL (OpenAI-compatible endpoint)</span>
                  <span className="text-[10px] text-slate-400">Auto-filled &middot; editable</span>
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                >
                  {testStatus === 'testing' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Model...</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="w-3.5 h-3.5" />
                      <span>Test Model Connection</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5 text-xs">
                  <Sliders className="w-3 h-3 text-slate-400 ml-2" />
                  <span className="text-slate-500">Temp:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-16 h-1.5 accent-indigo-600 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-slate-600 dark:text-slate-400">{temperature}</span>
                </div>
              </div>

              {testStatus !== 'idle' && (
                <div
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    testStatus === 'success'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : testStatus === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {testStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {testStatus === 'error' && <AlertCircle className="w-3.5 h-3.5" />}
                  <span>{testMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Prompt Chips */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Quick AI Tasks
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => handleSendPrompt(qa.prompt)}
                  disabled={isGenerating}
                  className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-xl text-left transition flex items-center gap-2.5 group shadow-sm disabled:opacity-50"
                >
                  <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:scale-110 transition">
                    {qa.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {qa.title}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{qa.prompt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat History & Output */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                AI Conversation &amp; Results
              </span>
              {history.length > 1 && (
                <button
                  onClick={() =>
                    setHistory([
                      {
                        role: 'model',
                        text: 'Conversation reset.',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      },
                    ])
                  }
                  className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
                >
                  Clear History
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {history.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 text-xs leading-relaxed ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm space-y-1.5 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                      <span>{msg.role === 'user' ? 'You' : `Gemini (${modelId})`}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className="whitespace-pre-wrap font-sans text-xs">{msg.text}</div>

                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt="attachment"
                            className="max-h-20 rounded-lg border border-white/30 dark:border-slate-700"
                          />
                        ))}
                      </div>
                    )}

                    {msg.role === 'model' && msg.text.length > 50 && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => handleCopy(msg.text)}
                          className="text-[10px] text-slate-400 hover:text-indigo-500 flex items-center gap-1 font-medium"
                        >
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isGenerating && (
                <div className="flex gap-3 text-xs justify-start items-center">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-500 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-bounce" />
                    <span>Thinking with {modelId}...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Prompt Input Box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="attached" className="h-16 rounded-lg border border-slate-300 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => removeAttached(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white hover:bg-slate-700 flex items-center justify-center"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
              className="p-2.5 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl border border-slate-300 dark:border-slate-700 shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openCamera}
              title="Scan with camera"
              className="p-2.5 text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-400 rounded-xl border border-slate-300 dark:border-slate-700 shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onPaste={handlePasteImages}
              placeholder={`Ask AI anything, or attach / scan an image (using ${modelId})...`}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            <button
              type="submit"
              disabled={(!prompt.trim() && attachedImages.length === 0) || isGenerating}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-md shadow-indigo-600/20 flex items-center gap-2 text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Generate</span>
            </button>
          </form>
        </div>

        {/* Camera capture modal */}
        {cameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-500" /> Scan with camera
                </h3>
                <button type="button" onClick={closeCamera} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative bg-black aspect-video">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                    <p className="text-sm text-red-300">{cameraError}</p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={switchCamera}
                  title="Switch camera"
                  className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5"
                >
                  <SwitchCamera className="w-4 h-4" /> Flip
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!!cameraError}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-full flex items-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  <Camera className="w-4 h-4" /> Capture
                </button>
                <button type="button" onClick={closeCamera} className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg">
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center pb-3">
                Point your camera at a document or photo, then tap Capture.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
