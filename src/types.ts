export interface FacebookComment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  time?: string;
  likes?: number;
}

export interface FacebookPost {
  id: string;
  url: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  isVerified?: boolean;
  postDate: string;
  postContent: string;
  images: string[];
  likesCount?: number;
  commentsCount?: number;
  sharesCount?: number;
  reactions?: {
    like?: number;
    love?: number;
    care?: number;
    haha?: number;
    wow?: number;
    sad?: number;
    angry?: number;
  };
  privacy: 'public' | 'friends' | 'only_me';
  isProtected?: boolean;
  extractedSource?: 'live_scrape' | 'og_crawler' | 'sample_template' | 'manual' | 'url_params' | 'embed_plugin' | 'embed_code' | 'demo';
  iframeCode?: string;
  embedUrl?: string;
  fetchedAt: string;
  comments?: FacebookComment[];
}

export type DocumentTheme = 'facebook_authentic' | 'archival_dossier' | 'clean_editorial';
export type PageFormat = 'a4' | 'letter' | 'auto_card';
export type PageOrientation = 'portrait' | 'landscape';
export type PageMode = 'page_per_post' | 'continuous';

export interface ExportSettings {
  theme: DocumentTheme;
  pageFormat: PageFormat;
  pageOrientation: PageOrientation;
  pageMode: PageMode;
  includeCoverPage: boolean;
  includeQrCode: boolean;
  includeComments: boolean;
  includeEngagement: boolean;
  includeWatermark: boolean;
  archiveTitle: string;
  investigatorName: string;
  notes: string;
}

export interface FacebookVideoItem {
  id: string;
  sourceUrl: string;
  title: string;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  videoUrlHd?: string;
  videoUrlSd?: string;
  audioUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  formatNote?: string;
  fetchedAt: string;
  isCustomUpload?: boolean;
}

export type MergeResolution = '1080p' | '720p' | 'vertical_reel' | 'match_first';
export type MergeAspectRatio = '16:9' | '9:16' | '1:1' | 'auto';

export interface MergeOptions {
  resolution: MergeResolution;
  aspectRatio: MergeAspectRatio;
  fps: number;
  transition: 'none' | 'crossfade';
  quality: 'fast' | 'high';
  normalizeAudio: boolean;
}

export interface MergedVideoResult {
  jobId: string;
  filename: string;
  downloadUrl: string;
  streamUrl: string;
  duration: number;
  fileSizeBytes: number;
  resolution: string;
  videoCount: number;
  createdAt: string;
}
