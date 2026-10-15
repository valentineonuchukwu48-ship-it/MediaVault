import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Trash2,
  Plus,
  Image as ImageIcon,
  X,
  Settings2,
  Key,
  Cpu,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Paperclip,
  Camera,
  SwitchCamera,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // data URLs
  streaming?: boolean;
  error?: boolean;
}

// Same provider presets as the AI Studio, kept in sync for BYOK chat.
const AI_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini (native)', baseUrl: '', openaiCompatible: false, free: true, keyUrl: 'https://aistudio.google.com/apikey', models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'] },
  { id: 'openrouter', name: 'OpenRouter (many free models)', baseUrl: 'https://openrouter.ai/api/v1', openaiCompatible: true, free: true, keyUrl: 'https://openrouter.ai/keys', models: ['deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-2.0-flash-exp:free', 'qwen/qwen-2.5-72b-instruct:free'] },
  { id: 'groq', name: 'Groq (ultra-fast free tier)', baseUrl: 'https://api.groq.com/openai/v1', openaiCompatible: true, free: true, keyUrl: 'https://console.groq.com/keys', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  { id: 'nvidia', name: 'NVIDIA NIM (free credits)', baseUrl: 'https://integrate.api.nvidia.com/v1', openaiCompatible: true, free: true, keyUrl: 'https://build.nvidia.com/', models: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1'] },
  { id: 'cerebras', name: 'Cerebras (fast free tier)', baseUrl: 'https://api.cerebras.ai/v1', openaiCompatible: true, free: true, keyUrl: 'https://cloud.cerebras.ai/', models: ['llama-3.3-70b', 'llama3.1-8b'] },
  { id: 'together', name: 'Together AI (free models)', baseUrl: 'https://api.together.xyz/v1', openaiCompatible: true, free: true, keyUrl: 'https://api.together.ai/', models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo'] },
  { id: 'mistral', name: 'Mistral AI (free tier)', baseUrl: 'https://api.mistral.ai/v1', openaiCompatible: true, free: true, keyUrl: 'https://console.mistral.ai/', models: ['mistral-small-latest', 'open-mistral-nemo'] },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', openaiCompatible: true, free: false, keyUrl: 'https://platform.deepseek.com/', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { id: 'openai', name: 'OpenAI (or compatible)', baseUrl: 'https://api.openai.com/v1', openaiCompatible: true, free: false, keyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  { id: 'custom', name: 'Custom OpenAI-compatible endpoint', baseUrl: '', openaiCompatible: true, free: true, keyUrl: 'https://github.com/open-free-llm-api/awesome-freellm-apis', models: [] },
];

const uid = () => Math.random().toString(36).slice(2, 10);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Small markdown renderer: fenced code, inline code, bold/italic, headings,
// bullet lists, and paragraphs. No external dependencies.
const renderMarkdown = (text: string) => {
  const blocks: string[] = [];
  let src = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _lang, code) => {
    blocks.push(code);
    return `\u0000BLOCK${blocks.length - 1}\u0000`;
  });

  const inline = (s: string) => {
    let out = escapeHtml(s);
    out = out.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[0.85em] font-mono">$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return out;
  };

  const lines = src.split('\n');
  let html = '';
  let inList = false;
  for (const line of lines) {
    const blockMatch = line.match(/\u0000BLOCK(\d+)\u0000/);
    if (blockMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<pre class="my-2 p-3 rounded-lg bg-slate-900 text-slate-100 overflow-x-auto text-[12px] leading-relaxed"><code>${escapeHtml(blocks[Number(blockMatch[1])])}</code></pre>`;
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = Math.min(heading[1].length + 2, 6);
      html += `<h${level} class="font-bold mt-2 mb-1">${inline(heading[2])}</h${level}>`;
      continue;
    }
    const listItem = line.match(/^\s*[-*]\s+(.*)$/);
    if (listItem) {
      if (!inList) { html += '<ul class="list-disc pl-5 my-1 space-y-0.5">'; inList = true; }
      html += `<li>${inline(listItem[1])}</li>`;
      continue;
    }
    if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p class="my-1">${inline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
};

interface ChatPageProps {
  onExit?: () => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onExit }) => {
  const [provider, setProvider] = useState<string>(() => localStorage.getItem('facestudio_ai_provider') || 'gemini');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('facestudio_gemini_api_key') || '');
  const [baseUrl, setBaseUrl] = useState<string>(() => localStorage.getItem('facestudio_ai_base_url') || '');
  const [modelId, setModelId] = useState<string>(() => localStorage.getItem('facestudio_gemini_model_id') || 'gemini-3.8-flash');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [showSettings, setShowSettings] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsNote, setModelsNote] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera capture state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const activeProvider = AI_PROVIDERS.find((p) => p.id === provider) || AI_PROVIDERS[0];

  useEffect(() => { localStorage.setItem('facestudio_ai_provider', provider); }, [provider]);
  useEffect(() => { if (apiKey) localStorage.setItem('facestudio_gemini_api_key', apiKey); }, [apiKey]);
  useEffect(() => { if (baseUrl) localStorage.setItem('facestudio_ai_base_url', baseUrl); }, [baseUrl]);
  useEffect(() => { if (modelId) localStorage.setItem('facestudio_gemini_model_id', modelId); }, [modelId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleProviderChange = (id: string) => {
    setProvider(id);
    setAvailableModels([]);
    setModelsNote('');
    const preset = AI_PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setBaseUrl(preset.baseUrl);
    if (preset.models.length > 0) setModelId(preset.models[0]);
    else if (id === 'gemini') setModelId('gemini-3.8-flash');
  };

  const addFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr: File[] = Array.isArray(files) ? files : Array.from(files);
    arr.forEach((file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPendingImages((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
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

  const handleListModels = async () => {
    setModelsNote('');
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), provider, baseUrl: baseUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to list models');
      const list: string[] = data.models || [];
      setAvailableModels(list);
      setModelsNote(list.length ? `Found ${list.length} model(s).` : 'No models returned — type a Model ID manually.');
      if (list.length > 0) setModelId(list[0]);
    } catch (err: any) {
      setAvailableModels([]);
      setModelsNote(err.message || 'Could not list models.');
    }
  };

  const newChat = () => {
    setMessages([]);
    setPendingImages([]);
    setInput('');
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ---- Camera capture ----
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
      // Wait for the <video> to mount before attaching.
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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPendingImages((prev) => [...prev, dataUrl]);
    closeCamera();
  };

  // Stop the camera if the component unmounts.
  useEffect(() => {
    return () => stopCamera();
  }, []);


  const sendMessage = async () => {
    const text = input.trim();
    if ((!text && pendingImages.length === 0) || isStreaming) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      images: pendingImages.length ? [...pendingImages] : undefined,
    };
    const assistantId = uid();
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '', streaming: true };

    // Build the history to send (exclude the empty streaming placeholder).
    const historyForApi = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images,
    }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setPendingImages([]);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim(),
          modelId: modelId.trim(),
          temperature,
          messages: historyForApi,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `Request failed (HTTP ${res.status})`);
      }

      const reader = (res.body as any).getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let acc = '';

      const appendDelta = (delta: string) => {
        acc += delta;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            if (json.error) throw new Error(json.error);
            if (json.delta) appendDelta(json.delta);
          } catch (parseErr: any) {
            if (parseErr?.message && !String(parseErr.message).includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)));
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, streaming: false, error: true, content: m.content || `⚠️ ${err.message || 'Something went wrong.'}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const onTextareaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const mergedModels = Array.from(new Set([...(availableModels || []), ...activeProvider.models]));


  return (
    <div className="flex flex-col h-[calc(100vh-72px)] bg-slate-950 text-slate-100">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">AI Chat Studio</h2>
            <p className="text-[11px] text-slate-400 truncate">
              {activeProvider.name} &middot; <span className="font-mono">{modelId || 'no model'}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={newChat}
            className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> New chat
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 border ${showSettings ? 'bg-indigo-600 text-white border-indigo-400/40' : 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700'}`}
          >
            <Settings2 className="w-3.5 h-3.5" /> Settings
          </button>
          {onExit && (
            <button onClick={onExit} className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white rounded-lg">
              Exit
            </button>
          )}
        </div>
      </div>


      {/* Settings drawer */}
      {showSettings && (
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Provider</label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.free ? '  • free tier' : ''}
                  </option>
                ))}
              </select>
              {activeProvider.keyUrl && (
                <a href={activeProvider.keyUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-[10px] text-indigo-400 hover:underline">
                  Get a key &rarr;
                </a>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1"><Key className="w-3 h-3" /> API Key</span>
                <span className="text-[10px] text-slate-500">{provider === 'gemini' ? 'optional (uses env)' : 'required'}</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider === 'gemini' ? 'leave blank to use server key' : 'paste your key'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button type="button" onClick={() => setShowKey((s) => !s)} className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 text-[10px]">
                  {showKey ? 'hide' : 'show'}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                <Cpu className="w-3 h-3" /> Model ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="type or pick a model"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleListModels}
                  className="px-2.5 py-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 whitespace-nowrap"
                >
                  List
                </button>
                {mergedModels.length > 0 && (
                  <select
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    className="px-2 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 max-w-[160px] truncate"
                  >
                    {mergedModels.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
              {modelsNote && <p className="text-[10px] text-slate-400">{modelsNote}</p>}
            </div>

            {activeProvider.openaiCompatible && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400">Base URL</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Temperature</span>
                <span className="font-mono text-slate-300">{temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>
      )}


      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Start a conversation</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                Plug in your API key in <span className="text-indigo-400 font-medium">Settings</span>, pick a model, then ask anything.
                You can also attach or paste an image for vision models.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {['Explain a concept simply', 'Write a catchy caption', 'Summarize this image', 'Debug my code'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-slate-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-1">
                    {m.images.map((img, i) => (
                      <img key={i} src={img} alt="attachment" className="max-h-40 rounded-lg border border-slate-700" />
                    ))}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : m.error
                      ? 'bg-red-950/60 border border-red-800 text-red-200 rounded-tl-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {m.role === 'assistant' ? (
                    <div
                      className="prose-invert max-w-none [&_a]:text-indigo-300"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content || (m.streaming ? '…' : '')) }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                  {m.streaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 align-middle bg-indigo-400 animate-pulse rounded-sm" />
                  )}
                </div>
                {m.role === 'assistant' && !m.streaming && m.content && (
                  <button
                    onClick={() => copyMessage(m.content)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 self-start"
                  >
                    <Copy className="w-3 h-3" /> copy
                  </button>
                )}
              </div>
              {m.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Input */}
      <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {pendingImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingImages.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="pending" className="h-16 rounded-lg border border-slate-700" />
                  <button
                    onClick={() => setPendingImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-950 border border-slate-600 text-slate-300 hover:text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-slate-950 border border-slate-700 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
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
              className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg shrink-0"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openCamera}
              title="Scan with camera"
              className="p-2 text-slate-400 hover:text-indigo-400 rounded-lg shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder="Send a message…  (Enter to send, Shift+Enter for new line, paste an image)"
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-500 focus:outline-none max-h-40 py-2"
            />
            <button
              onClick={sendMessage}
              disabled={isStreaming || (!input.trim() && pendingImages.length === 0)}
              title="Send"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shrink-0"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 text-center mt-1.5">
            AI can make mistakes. Verify important info. Keys stay in your browser.
          </p>
        </div>
      </div>

      {/* Camera capture modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" /> Scan with camera
              </h3>
              <button onClick={closeCamera} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-black aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {cameraError && (
                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  <p className="text-sm text-red-300">{cameraError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <button
                onClick={switchCamera}
                title="Switch camera"
                className="px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5"
              >
                <SwitchCamera className="w-4 h-4" /> Flip
              </button>
              <button
                onClick={capturePhoto}
                disabled={!!cameraError}
                className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-full flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Camera className="w-4 h-4" /> Capture
              </button>
              <button
                onClick={closeCamera}
                className="px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-slate-500 text-center pb-3">
              Point your camera at a document or photo, then tap Capture.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

