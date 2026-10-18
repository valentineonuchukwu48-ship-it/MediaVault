/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { FacebookPost, ExportSettings } from './types';
import { Header } from './components/Header';
import { UrlInputBar } from './components/UrlInputBar';
import { PostQueueList } from './components/PostQueueList';
import { PostEditor } from './components/PostEditor';
import { PdfSettingsDrawer } from './components/PdfSettingsDrawer';
import { CombinedDocumentPreview } from './components/CombinedDocumentPreview';
import { BackgroundMusicPlayer } from './components/BackgroundMusicPlayer';
import { VideoMergeStudio } from './components/VideoMergeStudio';
import { AiAssistantModal } from './components/AiAssistantModal';
import { ChatPage } from './components/ChatPage';
import { DesktopPanel } from './components/DesktopPanel';
import { MobileInstallBar } from './components/MobileInstallBar';
import { generateCombinedPdf, exportSinglePostPdf } from './utils/pdfGenerator';
import { Layers } from 'lucide-react';

const initialPosts: FacebookPost[] = [
  {
    id: '122129387847098460',
    url: 'https://web.facebook.com/photo?fbid=122129387847098460&set=pcb.122129389287098460',
    authorName: 'Obiajulu Onuchukwu',
    authorHandle: '@obiajulu.onuchukwu',
    authorAvatar: '/src/assets/images/fb_author_avatar_1791644771333.jpg',
    isVerified: true,
    postDate: 'October 10, 2026 at 11:42 AM',
    postContent:
      'Mathematics & Logic Problem Set Solutions:\n\n8. Socks Probability: You own thirteen pairs of socks, all different, and all jumbled in a drawer. How many must you pull out to guarantee having a matching pair?\nAnswer: (d) 14 socks.\n\n9. Gold/Silver Concentration: 20 gram ring with 60% gold. How much gold must be added to reach 80% gold?\nAnswer: (e) 20 grams.\n\n10 & 11. Referee card game permutations and elimination logic puzzle.\n\nFull step-by-step solutions in attached worksheet.',
    images: ['/src/assets/images/fb_math_worksheet_1791646396764.jpg'],
    likesCount: 342,
    commentsCount: 47,
    sharesCount: 19,
    privacy: 'public',
    isProtected: false,
    extractedSource: 'sample_template',
    fetchedAt: new Date().toISOString(),
    comments: [
      {
        id: 'c1',
        author: 'Sarah Jenkins',
        text: 'The explanation for problem 9 with the gold concentration formula was so clear!',
        time: '2h',
        likes: 12,
      },
      {
        id: 'c2',
        author: 'David Chen',
        text: 'Problem 8 pigeonhole principle classic! Always 13 + 1 = 14.',
        time: '1h',
        likes: 5,
      },
    ],
  },
  {
    id: '122129389287098460',
    url: 'https://web.facebook.com/photo?fbid=122129389287098460&set=pcb.122129389287098460',
    authorName: 'Global Tech Summit 2026',
    authorHandle: '@globaltechsummit',
    isVerified: true,
    postDate: 'October 9, 2026 at 3:15 PM',
    postContent:
      'What an inspiring day exploring the future of technology, impact, and design ethics! Grateful for our brilliant speakers and engaged participants from over 45 countries. 🎙️💡 #TechSummit2026 #Innovation #Keynote',
    images: ['/src/assets/images/fb_post_keynote_1791644787103.jpg'],
    likesCount: 820,
    commentsCount: 94,
    sharesCount: 65,
    privacy: 'public',
    isProtected: false,
    extractedSource: 'sample_template',
    fetchedAt: new Date().toISOString(),
    comments: [
      {
        id: 'c3',
        author: 'Marcus Vance',
        text: 'Best session of the week! The insights on architecture were spot on.',
        time: '3h',
        likes: 18,
      },
    ],
  },
];

const defaultSettings: ExportSettings = {
  theme: 'facebook_authentic',
  pageFormat: 'a4',
  pageOrientation: 'portrait',
  pageMode: 'page_per_post',
  includeCoverPage: true,
  includeQrCode: true,
  includeComments: true,
  includeEngagement: true,
  includeWatermark: true,
  archiveTitle: 'Facebook Post Archive Dossier',
  investigatorName: 'Digital Archiving Unit',
  notes: 'Certified social media capture.',
};

export default function App() {
  const [posts, setPosts] = useState<FacebookPost[]>(initialPosts);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialPosts.map((p) => p.id));
  const [activePostId, setActivePostId] = useState<string | null>(initialPosts[0].id);
  const [editingPost, setEditingPost] = useState<FacebookPost | null>(null);
  const [settings, setSettings] = useState<ExportSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'queue' | 'settings'>('preview');
  const [appMode, setAppMode] = useState<'video_studio' | 'pdf_dossier' | 'ai_chat'>('video_studio');
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);

  // Reference to export combined PDF
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Global paste handler for instant screenshot or link paste (Ctrl+V)
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            const file = items[i].getAsFile();
            if (file) {
              handleUploadImageAndExportPdf(
                file,
                'Obiajulu Onuchukwu',
                'Facebook photo worksheet upload'
              );
              return;
            }
          }
        }
      }

      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('facebook.com') || text.includes('fb.watch'))) {
        handleGrabAndDownloadPdf(text.trim());
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Trigger real download from the current rendered posts
  const triggerExportCombined = async () => {
    setIsLoading(true);
    try {
      const selectedPosts = posts.filter((p) => selectedIds.includes(p.id));
      const targetPosts = selectedPosts.length > 0 ? selectedPosts : posts;

      if (targetPosts.length === 0) {
        throw new Error('No posts available to export');
      }

      await generateCombinedPdf(targetPosts, settings);
    } catch (err) {
      console.error('Export error:', err);
      alert('PDF generation in progress. Please check your browser downloads.');
    } finally {
      setIsLoading(false);
    }
  };

  // Grab single URL & add to deck
  const handleGrabUrl = async (url: string): Promise<FacebookPost | null> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

      const data = await response.json();
      if (data.success && data.post) {
        const newPost = data.post as FacebookPost;
        const exists = posts.some((p) => p.id === newPost.id);
        if (exists) {
          newPost.id = `${newPost.id}_${Date.now().toString().slice(-4)}`;
        }

        setPosts((prev) => [newPost, ...prev]);
        setSelectedIds((prev) => [newPost.id, ...prev]);
        setActivePostId(newPost.id);
        return newPost;
      }
      return null;
    } catch (err) {
      console.error('Error grabbing Facebook post:', err);
      alert('Unable to grab Facebook post. You can also upload a screenshot to convert to PDF.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Instant Grab & Download to PDF
  const handleGrabAndDownloadPdf = async (url: string): Promise<void> => {
    setIsLoading(true);
    try {
      const newPost = await handleGrabUrl(url);
      if (!newPost) return;

      // Switch to preview tab so user sees their new post
      setActiveTab('preview');

      // Export the new post directly without relying on stale state
      await exportSinglePostPdf(newPost, settings);
    } catch (err) {
      console.error('Instant download error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Upload an image / screenshot and convert directly to PDF
  const handleUploadImageAndExportPdf = async (
    file: File,
    authorName = 'Obiajulu Onuchukwu',
    caption = 'Uploaded Facebook Post / Photo'
  ): Promise<void> => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const newPost: FacebookPost = {
        id: `upload_${Date.now()}`,
        url: 'https://web.facebook.com/photo?fbid=122129387847098460',
        authorName: authorName.trim() || 'Obiajulu Onuchukwu',
        authorHandle: `@${(authorName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        authorAvatar: '/src/assets/images/fb_author_avatar_1791644771333.jpg',
        isVerified: true,
        postDate: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        postContent: caption.trim() || 'Facebook photo worksheet upload',
        images: [dataUrl],
        likesCount: 142,
        commentsCount: 18,
        sharesCount: 7,
        privacy: 'public',
        isProtected: false,
        extractedSource: 'manual',
        fetchedAt: new Date().toISOString(),
      };

      setPosts((prev) => [newPost, ...prev]);
      setSelectedIds((prev) => [newPost.id, ...prev]);
      setActivePostId(newPost.id);
      setActiveTab('preview');

      // Wait 350ms for React DOM to render new post and images
      await new Promise((res) => setTimeout(res, 400));
      await exportSinglePostPdf(newPost, settings);
    } catch (err) {
      console.error('Image upload & PDF error:', err);
      alert('Failed to convert uploaded image to PDF. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle multiple embed codes and immediately download combined PDF
  const handleGrabMultipleEmbedsAndDownloadPdf = async (embedsText: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-multiple-embeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedsText }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extract embeds: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.posts) && data.posts.length > 0) {
        const newPosts = data.posts as FacebookPost[];
        const newIds = newPosts.map((p) => p.id);

        setPosts((prev) => [...newPosts, ...prev]);
        setSelectedIds((prev) => [...newIds, ...prev]);
        setActivePostId(newPosts[0].id);
        setActiveTab('preview');

        // Immediately export all new posts combined
        await generateCombinedPdf(newPosts, settings);
      } else {
        alert('No embed codes could be extracted. Please check the iframe code.');
      }
    } catch (err: any) {
      console.error('Multiple embeds error:', err);
      alert('Unable to extract embed codes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle multiple embed codes and add to deck without downloading yet
  const handleAddMultipleEmbedsToDeck = async (embedsText: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-multiple-embeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embedsText }),
      });

      if (!response.ok) {
        throw new Error(`Failed to extract embeds: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.posts) && data.posts.length > 0) {
        const newPosts = data.posts as FacebookPost[];
        const newIds = newPosts.map((p) => p.id);

        setPosts((prev) => [...newPosts, ...prev]);
        setSelectedIds((prev) => [...newIds, ...prev]);
        setActivePostId(newPosts[0].id);
      } else {
        alert('No embed codes could be extracted.');
      }
    } catch (err) {
      console.error('Error adding embeds to deck:', err);
      alert('Unable to extract embed codes.');
    } finally {
      setIsLoading(false);
    }
  };

  // Batch grab multiple URLs
  const handleBatchGrab = async (urls: string[]): Promise<void> => {
    setIsLoading(true);
    const addedIds: string[] = [];
    const newPosts: FacebookPost[] = [];

    for (const u of urls) {
      try {
        const response = await fetch('/api/fetch-facebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: u }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.post) {
            const p = data.post as FacebookPost;
            p.id = `${p.id}_${Date.now().toString().slice(-4)}`;
            newPosts.push(p);
            addedIds.push(p.id);
          }
        }
      } catch (e) {
        console.error('Failed to grab batch url:', u, e);
      }
    }

    if (newPosts.length > 0) {
      setPosts((prev) => [...newPosts, ...prev]);
      setSelectedIds((prev) => [...addedIds, ...prev]);
      setActivePostId(newPosts[0].id);
    }
    setIsLoading(false);
  };

  const handleToggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setPosts((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === posts.length - 1) return;
    setPosts((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleDeletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    if (activePostId === id) {
      const remaining = posts.filter((p) => p.id !== id);
      setActivePostId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleDuplicatePost = (post: FacebookPost) => {
    const clone: FacebookPost = {
      ...post,
      id: `${post.id}_copy_${Date.now().toString().slice(-4)}`,
      fetchedAt: new Date().toISOString(),
    };
    setPosts((prev) => [clone, ...prev]);
    setSelectedIds((prev) => [clone.id, ...prev]);
    setActivePostId(clone.id);
  };

  const handleSaveEditedPost = (updated: FacebookPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navigation */}
      <Header
        totalPosts={posts.length}
        selectedCount={selectedIds.length}
        onExportCombined={triggerExportCombined}
        isExporting={isLoading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        appMode={appMode}
        setAppMode={setAppMode}
        onOpenAiStudio={() => setIsAiModalOpen(true)}
      />

      {/* Music Bar Strip */}
      <div className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <BackgroundMusicPlayer />
      </div>

      {/* Main Workspace based on Studio Mode */}
      {appMode === 'ai_chat' ? (
        <ChatPage onExit={() => setAppMode('video_studio')} />
      ) : appMode === 'video_studio' ? (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8">
          <VideoMergeStudio
            onSwitchToDossier={() => setAppMode('pdf_dossier')}
            onOpenAiStudio={() => setIsAiModalOpen(true)}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
          {/* Left Column: URL Grabber & Queue */}
          <div className="w-full lg:w-[480px] shrink-0 space-y-5 flex flex-col">
          <UrlInputBar
            onGrabAndDownloadPdf={handleGrabAndDownloadPdf}
            onGrabUrl={handleGrabUrl}
            onBatchGrab={handleBatchGrab}
            onGrabMultipleEmbedsAndDownloadPdf={handleGrabMultipleEmbedsAndDownloadPdf}
            onAddMultipleEmbedsToDeck={handleAddMultipleEmbedsToDeck}
            onUploadImageAndExportPdf={handleUploadImageAndExportPdf}
            isLoading={isLoading}
            totalPosts={posts.length}
          />

          {/* Tab switcher for mobile */}
          <div className="flex md:hidden p-1 bg-slate-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-1.5 rounded-md ${
                activeTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Document Preview
            </button>
            <button
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-1.5 rounded-md ${
                activeTab === 'queue' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Post Deck ({posts.length})
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-1.5 rounded-md ${
                activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              Settings
            </button>
          </div>

          {/* Post Deck List */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Post Deck Queue
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Order determines PDF pages
              </span>
            </div>

            <PostQueueList
              posts={posts}
              selectedIds={selectedIds}
              activePostId={activePostId}
              onSelectPost={(id) => {
                setActivePostId(id);
                setActiveTab('preview');
              }}
              onToggleSelectId={handleToggleSelectId}
              onSelectAll={() => setSelectedIds(posts.map((p) => p.id))}
              onDeselectAll={() => setSelectedIds([])}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onDeletePost={handleDeletePost}
              onDuplicatePost={handleDuplicatePost}
              onOpenEdit={(post) => setEditingPost(post)}
            />
          </div>

          {/* PDF Styling Drawer */}
          <div className="hidden lg:block">
            <PdfSettingsDrawer settings={settings} onChange={setSettings} />
          </div>
        </div>

        {/* Right Column: Live Document Preview */}
        <div
          ref={previewContainerRef}
          className={`flex-1 flex flex-col min-w-0 min-h-[600px] lg:min-h-[820px] ${
            activeTab === 'queue' && 'hidden md:flex'
          }`}
        >
          {activeTab === 'settings' ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
              <PdfSettingsDrawer settings={settings} onChange={setSettings} />
            </div>
          ) : (
            <CombinedDocumentPreview
              posts={posts}
              selectedIds={selectedIds}
              activePostId={activePostId}
              settings={settings}
            />
          )}
        </div>
      </main>
      )}

      {/* Post Editor Drawer / Modal */}
      {editingPost && (
        <PostEditor
          post={editingPost}
          onSave={handleSaveEditedPost}
          onClose={() => setEditingPost(null)}
        />
      )}

      {/* AI Assistant Modal (Custom API Key & Model ID Studio) */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        postContext={posts.find((p) => p.id === activePostId)}
      />

      {/* Author credit */}
      <footer className="no-print mt-10 mb-4 text-center text-[11px] leading-relaxed text-slate-500">
        <p className="font-semibold tracking-wide text-slate-400">
          FacebookGrabContents · by Valentine Onuchukwu
        </p>
        <p>
          ProsperChild Technology — Nigeria ·{' '}
          <span className="text-slate-400">valentineonuchukwu@gmail.com</span>
        </p>
      </footer>

      {/* Desktop-only controls (folders, browser cookies, updates) */}
      <DesktopPanel />
      {/* Mobile: "install this app" prompt when opened on a phone */}
      <MobileInstallBar />
    </div>
  );
}
