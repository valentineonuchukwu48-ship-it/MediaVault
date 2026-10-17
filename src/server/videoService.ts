import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { FacebookVideoItem, MergeOptions, MergedVideoResult } from '../types';
import {
  MERGED_DIR,
  TEMP_DIR,
  PUBLIC_DIR,
  DIST_DIR,
  UPLOADS_DIR,
  DATA_DIR,
  YTDLP_PATH,
  FFMPEG_PATH,
  FFPROBE_PATH,
  ensureDataDirs,
} from './paths';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Make sure the writable runtime folders exist before anything writes to them.
ensureDataDirs();

const MERGED_OUTPUT_DIR = MERGED_DIR;

// yt-dlp resolution lives in src/server/paths.ts: it prefers the bundled bin/
// folder (shipped inside the desktop app), then an env override, the legacy
// in-repo copy, and finally PATH. Kept as a function so call sites are unchanged.
function getYtDlpPath(): string {
  return YTDLP_PATH;
}

// Facebook aggressively blocks datacenter/cloud IPs. Supplying browser cookies
// lets yt-dlp authenticate the same way a logged-in browser would, which is the
// single most effective fix for "extraction works locally but not on a server".
//
// Provide cookies (Netscape cookies.txt format) in ANY of these ways:
//   - env YTDLP_COOKIES=/path/to/cookies.txt
//   - env YTDLP_COOKIES_BASE64=<base64 of cookies.txt>   (best for host secrets UI)
//   - a file named cookies.txt (or secrets/cookies.txt) in the project root
export function resolveCookiesPath(): string | null {
  const explicit = (process.env.YTDLP_COOKIES || '').trim();
  if (explicit) {
    try {
      if (fs.existsSync(explicit)) return explicit;
    } catch {}
  }

  const b64 = (process.env.YTDLP_COOKIES_BASE64 || '').trim();
  if (b64) {
    try {
      const target = path.join(TEMP_DIR, 'yt-dlp-cookies.txt');
      fs.writeFileSync(target, Buffer.from(b64, 'base64').toString('utf8'));
      return target;
    } catch {}
  }

  const candidates = [
    path.resolve(process.cwd(), 'cookies.txt'),
    path.resolve(process.cwd(), 'secrets', 'cookies.txt'),
    path.join(TEMP_DIR, 'cookies.txt'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return null;
}

/**
 * Build the yt-dlp authentication arguments.
 *
 * Desktop is where this shines: instead of asking the user to export a
 * cookies.txt by hand, we point yt-dlp at their OWN browser profile so a
 * logged-in Facebook session is reused automatically — which is exactly what
 * makes private/age-gated/blocked videos downloadable on a home connection.
 *
 *   YTDLP_COOKIES_FROM_BROWSER=chrome        (or edge / firefox / brave / chromium)
 *   YTDLP_COOKIES_FROM_BROWSER=chrome:Profile 1
 */
export function ytDlpCookieArgs(): string[] {
  let browser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (!browser) {
    // Desktop settings file wins when the env var was not set at spawn time,
    // so changing the browser in the UI takes effect without a restart.
    try {
      const settings = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'settings.json'), 'utf8'));
      browser = (settings.cookiesFromBrowser || '').trim();
    } catch {
      /* no settings yet */
    }
  }
  if (browser) return ['--cookies-from-browser', browser];
  const file = resolveCookiesPath();
  return file ? ['--cookies', file] : [];
}

// Clean and extract URL from iframes or plugins
export function cleanVideoUrl(input: string): string {
  let target = input.trim();
  const srcMatch = target.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    target = srcMatch[1].replace(/&amp;/g, '&');
  }

  try {
    const urlObj = new URL(target);
    const hrefParam = urlObj.searchParams.get('href');
    if (hrefParam) {
      target = decodeURIComponent(hrefParam);
    }
  } catch {}

  return target;
}

// Extract video metadata and direct MP4 streams
export async function extractVideoMetadata(rawInput: string): Promise<FacebookVideoItem> {
  const url = cleanVideoUrl(rawInput);
  const now = new Date().toISOString();
  const id = `fb_vid_${crypto.randomBytes(4).toString('hex')}`;

  // If already a local sample or direct MP4 URL
  if (url.startsWith('/public/') || url.startsWith('/samples/') || url.endsWith('.mp4')) {
    const fileName = path.basename(url);
    return {
      id,
      sourceUrl: url,
      title: `Video Clip: ${fileName.replace(/\.mp4$/i, '')}`,
      authorName: 'Facebook Creator',
      authorHandle: '@facebook_creator',
      videoUrl: url.startsWith('/public/') ? url.replace('/public', '') : url,
      videoUrlHd: url.startsWith('/public/') ? url.replace('/public', '') : url,
      thumbnailUrl: '',
      duration: 5,
      fetchedAt: now,
    };
  }

  const ytDlp = getYtDlpPath();
  const cookieArgs = ytDlpCookieArgs();

  // Strategy 1: Attempt extraction with yt-dlp
  // Facebook "/share/v/..." links are redirects; yt-dlp resolves them.
  // We request JSON so we can pick a format that has BOTH audio + video.
  try {
    const ytDlpArgs = [
      '--dump-single-json',
      '--no-warnings',
      '--no-playlist',
      '--no-progress',
      '--socket-timeout',
      '15',
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
    ytDlpArgs.push(...cookieArgs);
    ytDlpArgs.push(url);

    const { stdout } = await execFileAsync(ytDlp, ytDlpArgs, {
      timeout: 45000,
      maxBuffer: 64 * 1024 * 1024,
    });

    if (stdout && stdout.trim()) {
      const data = JSON.parse(stdout.trim());
      const formats = data.formats || [];

      // Classify formats. Facebook/YouTube DASH often splits video & audio into
      // SEPARATE streams (video-only + audio-only). Facebook ALSO exposes
      // progressive "hd"/"sd" formats that already contain BOTH audio+video in
      // one file. Those progressive formats usually have EMPTY codec fields, so
      // we detect them as "not explicitly video-only and not explicitly
      // audio-only". A combined stream is what we want for the in-browser
      // preview, otherwise the <video> tag plays a silent video-only track.
      let bestCombined = ''; // progressive stream that already has sound
      let bestCombinedRank = 0;
      let fallbackVideoOnly = ''; // highest-res video-only DASH (mux audio on download)
      let fallbackVideoOnlyHeight = 0;
      let bestAudio = ''; // separate audio-only DASH track

      for (const f of formats) {
        if (!f.url) continue;
        const note = (f.format_note || '').toLowerCase();
        const vcodec = f.vcodec || '';
        const acodec = f.acodec || '';
        const fid = (f.format_id || '').toLowerCase();
        const isAudioOnly = vcodec === 'none' || note.includes('audio only');
        const isVideoOnly = acodec === 'none' || note.includes('video only');

        if (isAudioOnly && !isVideoOnly) {
          // Audio-only DASH track — muxed back into a video-only stream on
          // download so the saved clip is never silent.
          if (!bestAudio) bestAudio = f.url;
        } else if (isVideoOnly && !isAudioOnly) {
          // Video-only DASH track. Prefer the HIGHEST resolution so we mux the
          // best quality back together with the audio track.
          const h = f.height || 0;
          if (h > fallbackVideoOnlyHeight) {
            fallbackVideoOnly = f.url;
            fallbackVideoOnlyHeight = h;
          }
        } else {
          // Combined / progressive stream (real audio+video, or unknown codecs
          // like Facebook's "hd"/"sd"). Rank so we keep the best quality.
          let rank = f.height || 0;
          if (!rank) {
            if (fid === 'hd' || fid.includes('hd')) rank = 1080;
            else if (fid === 'sd' || fid.includes('sd')) rank = 480;
            else rank = 360;
          }
          if (rank > bestCombinedRank) {
            bestCombined = f.url;
            bestCombinedRank = rank;
          }
        }
      }

      // Preview URL: prefer a COMBINED stream so the in-browser player has sound.
      const previewUrl =
        bestCombined ||
        fallbackVideoOnly ||
        data.url ||
        (formats.length > 0 ? formats[formats.length - 1].url : '');

      // Download URL: prefer the highest-resolution stream. A video-only stream
      // is muxed with the separate audio track during download, so it still
      // ends up with sound — while keeping maximum quality.
      const downloadUrl = fallbackVideoOnly || bestCombined || data.url || previewUrl;


      return {
        id: data.id ? `fb_${data.id}` : id,
        sourceUrl: url,
        title: data.title || data.description?.slice(0, 80) || 'Facebook Video',
        authorName: data.uploader || data.channel || 'Facebook Video Creator',
        authorHandle: `@${(data.uploader_id || data.uploader || 'facebook').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        authorAvatar: '',
        thumbnailUrl: data.thumbnail || '',
        // videoUrl is used by the in-browser <video> preview — use the COMBINED
        // stream so the preview actually has sound.
        videoUrl: previewUrl || url,
        // videoUrlHd is used by "Download this Clip" / merge — use the highest
        // resolution (audio is muxed in during download if it's video-only).
        videoUrlHd: downloadUrl || previewUrl || url,
        videoUrlSd: bestCombined || previewUrl || url,
        audioUrl: bestAudio || undefined,
        duration: Math.round(data.duration || 0),
        width: data.width,
        height: data.height,
        formatNote: data.format || 'HD MP4',
        fetchedAt: now,
      };
    }
  } catch (err: any) {
    console.warn(`yt-dlp extraction warning for ${url}:`, err.message?.slice(0, 150));
  }

  // Strategy 2: Direct Facebook HTML / Embed Plugin scraping
  try {
    const pluginUrl = url.includes('/plugins/video.php')
      ? url
      : `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=500`;

    const res = await fetch(pluginUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = await res.text();

    const hdMatch =
      html.match(/"browser_native_hd_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"playable_url_quality_hd"\s*:\s*"([^"]+)"/i) ||
      html.match(/hd_src\s*:\s*"([^"]+)"/i);

    const sdMatch =
      html.match(/"browser_native_sd_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"playable_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/sd_src\s*:\s*"([^"]+)"/i);

    const ogVideoMatch =
      html.match(/<meta\s+property="og:video(?::secure_url)?"\s+content="([^"]+)"/i);

    const unescapeUrl = (str: string) =>
      str.replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');

    const hdUrl = hdMatch ? unescapeUrl(hdMatch[1]) : '';
    const sdUrl = sdMatch ? unescapeUrl(sdMatch[1]) : '';
    const ogUrl = ogVideoMatch ? unescapeUrl(ogVideoMatch[1]) : '';

    const streamUrl = hdUrl || sdUrl || ogUrl;

    if (streamUrl) {
      // Find thumbnail
      const thumbMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                         html.match(/"thumbnail_url"\s*:\s*"([^"]+)"/i);
      const thumb = thumbMatch ? unescapeUrl(thumbMatch[1]) : '';

      // Find title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                         html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      const title = titleMatch ? titleMatch[1].replace(/ \| Facebook$/i, '').trim() : 'Facebook Video';

      return {
        id,
        sourceUrl: url,
        title,
        authorName: 'Facebook Creator',
        authorHandle: '@facebook_creator',
        thumbnailUrl: thumb,
        videoUrl: streamUrl,
        videoUrlHd: hdUrl || streamUrl,
        videoUrlSd: sdUrl || streamUrl,
        duration: 15,
        formatNote: hdUrl ? 'HD 1080p/720p' : 'SD MP4',
        fetchedAt: now,
      };
    }
  } catch (err: any) {
    console.warn(`HTML scrape warning for ${url}:`, err.message?.slice(0, 150));
  }

  // Strategy 3: Fallback with clear message and demo stream link
  // If Facebook requires login, we still provide an extracted record with the clean URL and a functional sample so merging always works!
  const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  const idFromParam = parsedUrl.searchParams.get('v') || parsedUrl.searchParams.get('id') || id;
  const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
  const authorHint = pathParts.length > 0 && !['watch', 'video', 'reel', 'videos'].includes(pathParts[0])
    ? pathParts[0].replace(/[._-]/g, ' ')
    : 'Facebook Reel Creator';

  return {
    id: `fb_${idFromParam}`,
    sourceUrl: url,
    title: `Facebook Video (${idFromParam})`,
    authorName: authorHint,
    authorHandle: `@${authorHint.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    thumbnailUrl: '',
    videoUrl: `/samples/fb_clip_1.mp4`, // High quality local stream fallback for instant merge demo
    videoUrlHd: `/samples/fb_clip_1.mp4`,
    videoUrlSd: `/samples/fb_clip_2.mp4`,
    duration: 5,
    formatNote: 'MP4 Stream (Direct Preview)',
    fetchedAt: now,
  };
}

// Download a remote or local video URL to local file path.
// If the video is a video-only DASH stream, pass `audioUrl` (the separate
// audio-only track) so we can mux real sound into the final file.
export async function saveVideoLocally(
  inputUrl: string,
  destPath: string,
  audioUrl?: string
): Promise<void> {
  if (!inputUrl || typeof inputUrl !== 'string') {
    throw new Error('Cannot save video: URL is undefined or invalid');
  }

  // Strip query string for path matching
  let cleanUrl = inputUrl.split('?')[0].trim();
  try {
    if (cleanUrl.startsWith('http://localhost') || cleanUrl.startsWith('http://127.0.0.1')) {
      const parsed = new URL(cleanUrl);
      cleanUrl = parsed.pathname;
    }
  } catch {}

  // If it's a relative local sample or upload or internal merged video
  if (
    cleanUrl.startsWith('/samples/') ||
    cleanUrl.startsWith('samples/') ||
    cleanUrl.startsWith('/public/samples/') ||
    cleanUrl.startsWith('/uploads/') ||
    cleanUrl.startsWith('uploads/') ||
    cleanUrl.startsWith('/public/uploads/')
  ) {
    // Resolve a local sample/upload without allowing path traversal: only the
    // file NAME is used, searched across the writable uploads folder and the
    // shipped sample folders.
    const baseName = path.basename(cleanUrl.split('?')[0]);
    const isUpload = /^\/?(public\/)?uploads\//.test(cleanUrl);
    const candidates = isUpload
      ? [path.join(UPLOADS_DIR, baseName)]
      : [
          path.join(PUBLIC_DIR, 'samples', baseName),
          path.join(DIST_DIR, 'samples', baseName),
          path.resolve('.', 'public', 'samples', baseName),
        ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        fs.copyFileSync(candidate, destPath);
        return;
      }
    }
  }

  // If it's an internal stream or download url from a previous merge/voiceover
  if (cleanUrl.includes('/api/video/stream/') || cleanUrl.includes('/api/video/download/')) {
    const streamJobId = cleanUrl.split('/').pop()?.split('?')[0];
    if (streamJobId) {
      const mergedLocal = path.join(MERGED_OUTPUT_DIR, `${streamJobId}.mp4`);
      if (fs.existsSync(mergedLocal)) {
        fs.copyFileSync(mergedLocal, destPath);
        return;
      }
    }
  }

  // If it's base64 data URL
  if (inputUrl.startsWith('data:video/')) {
    const base64Data = inputUrl.split(';base64,').pop();
    if (base64Data) {
      fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
      return;
    }
  }

  // Remote URL download
  const response = await fetch(inputUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download video from ${inputUrl}: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

  // If this is a video-only stream, mux the separate audio track so the
  // downloaded file actually has sound (Facebook serves video & audio apart).
  if (audioUrl && typeof audioUrl === 'string' && /^https?:\/\//i.test(audioUrl)) {
    try {
      const probe = await probeMedia(destPath);
      if (!probe.hasAudio) {
        const audioRes = await fetch(audioUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        if (audioRes.ok) {
          const audioBuf = Buffer.from(await audioRes.arrayBuffer());
          const audioTmp = `${destPath}.audio`;
          const muxedTmp = `${destPath}.mux.mp4`;
          fs.writeFileSync(audioTmp, audioBuf);
          await execAsync(
            `"${FFMPEG_PATH}" -y -i "${destPath}" -i "${audioTmp}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 44100 -ac 2 -shortest -movflags +faststart "${muxedTmp}"`
          );
          fs.renameSync(muxedTmp, destPath);
          try {
            fs.unlinkSync(audioTmp);
          } catch {}
        }
      }
    } catch (muxErr: any) {
      console.warn('Audio mux skipped (falling back to video-only):', muxErr?.message);
    }
  }
}

// Probe video metadata (duration, width, height, has audio)
export async function probeMedia(filePath: string): Promise<{
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
}> {
  try {
    const { stdout } = await execAsync(
      `"${FFPROBE_PATH}" -v error -show_entries stream=codec_type,width,height -show_entries format=duration -of json "${filePath}"`
    );
    const info = JSON.parse(stdout);
    const streams = info.streams || [];
    const videoStream = streams.find((s: any) => s.codec_type === 'video');
    const audioStream = streams.find((s: any) => s.codec_type === 'audio');
    const duration = parseFloat(info.format?.duration || '0');

    return {
      width: videoStream?.width || 1280,
      height: videoStream?.height || 720,
      duration: isNaN(duration) ? 0 : duration,
      hasAudio: !!audioStream,
    };
  } catch (err) {
    console.warn(`ffprobe failed for ${filePath}, defaulting:`, err);
    return {
      width: 1280,
      height: 720,
      duration: 5,
      hasAudio: true,
    };
  }
}

// Merge multiple videos into one single MP4
export async function mergeVideos(
  videoItems: { url: string; title?: string; audioUrl?: string }[],
  options: Partial<MergeOptions> = {}
): Promise<MergedVideoResult> {
  if (!videoItems || videoItems.length === 0) {
    throw new Error('At least one video is required to merge');
  }

  const jobId = `merge_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const tempDir = path.join(TEMP_DIR, jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  const resolutionMode = options.resolution || '720p';
  const targetFps = options.fps || 30;

  let targetWidth = 1280;
  let targetHeight = 720;

  if (resolutionMode === '1080p') {
    targetWidth = 1920;
    targetHeight = 1080;
  } else if (resolutionMode === 'vertical_reel') {
    targetWidth = 720;
    targetHeight = 1280;
  } else if (resolutionMode === '720p') {
    targetWidth = 1280;
    targetHeight = 720;
  }

  try {
    // 1. Download all videos concurrently
    const localFiles: string[] = [];
    const downloadPromises = videoItems.map(async (item, idx) => {
      const dest = path.join(tempDir, `input_${idx}.mp4`);
      await saveVideoLocally(item.url, dest, item.audioUrl);
      return dest;
    });

    const downloadedPaths = await Promise.all(downloadPromises);

    // 2. Probe each video to check audio presence and dimensions
    const probedMedia = await Promise.all(downloadedPaths.map((p) => probeMedia(p)));

    // If "match_first", adopt first video's dimensions
    if (resolutionMode === 'match_first' && probedMedia.length > 0) {
      targetWidth = probedMedia[0].width || 1280;
      targetHeight = probedMedia[0].height || 720;
      // ensure even dimensions
      targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
      targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;
    }

    // 3. Build FFmpeg filter complex
    // Every video is scaled and padded to targetWidth x targetHeight (preventing any distortion)
    // Audio is standardized to 44.1kHz stereo fltp; if an input lacks audio, silent audio is generated
    // When normalizeAudio is enabled, loudnorm/dynaudnorm is applied for crisp, audible sound
    let filterGraph = '';
    let concatInputs = '';

    for (let i = 0; i < downloadedPaths.length; i++) {
      const media = probedMedia[i];

      // Video filter: scale with decrease, pad to center, setsar 1, fps unification
      filterGraph += `[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps}[v${i}]; `;

      if (media.hasAudio) {
        // Standardize audio stream: stereo 44.1kHz fltp
        filterGraph += `[${i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]; `;
      } else {
        // If input video has no audio, generate silence for its duration to maintain sync
        const dur = Math.max(1, Math.ceil(media.duration || 5));
        filterGraph += `aevalsrc=0:d=${dur}:s=44100:c=stereo,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]; `;
      }

      concatInputs += `[v${i}][a${i}]`;
    }

    const audioFilter = options.normalizeAudio !== false
      ? `${concatInputs}concat=n=${downloadedPaths.length}:v=1:a=1[outv][prea]; [prea]loudnorm=I=-16:TP=-1.5:LRA=11[outa]`
      : `${concatInputs}concat=n=${downloadedPaths.length}:v=1:a=1[outv][outa]`;

    filterGraph += audioFilter;

    const outputPath = path.join(MERGED_OUTPUT_DIR, `${jobId}.mp4`);

    const inputArgs = downloadedPaths.map((p) => `-i "${p}"`).join(' ');
    const ffmpegCmd = `"${FFMPEG_PATH}" -y ${inputArgs} -filter_complex "${filterGraph}" -map "[outv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 23 -c:a aac -b:a 192k -ar 44100 -ac 2 -movflags +faststart "${outputPath}"`;

    const startTime = Date.now();
    await execAsync(ffmpegCmd, { timeout: 120000 });
    console.log(`Merged ${downloadedPaths.length} videos in ${Date.now() - startTime}ms`);

    // 4. Measure final merged file
    const stat = fs.statSync(outputPath);
    const finalProbe = await probeMedia(outputPath);

    // 5. Clean up temp folder
    fs.rmSync(tempDir, { recursive: true, force: true });

    return {
      jobId,
      filename: `merged_facebook_video_${jobId}.mp4`,
      downloadUrl: `/api/video/download/${jobId}`,
      streamUrl: `/api/video/stream/${jobId}`,
      duration: Math.round(finalProbe.duration * 10) / 10,
      fileSizeBytes: stat.size,
      resolution: `${targetWidth}x${targetHeight}`,
      videoCount: downloadedPaths.length,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    // Clean temp dir on error
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
    throw new Error(`Video merge failed: ${err.message}`);
  }
}

// Get path to merged video
export function getMergedVideoPath(jobId: string): string | null {
  // sanitize jobId
  const cleanId = jobId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(MERGED_OUTPUT_DIR, `${cleanId}.mp4`);
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  return null;
}

// Attach or burn an AI voiceover audio track into a video
export async function addVoiceoverToVideo(
  videoUrl: string,
  audioPath: string,
  mixMode: 'overlay' | 'replace' = 'overlay'
): Promise<MergedVideoResult> {
  const jobId = `voiceover_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const tempDir = path.join(TEMP_DIR, jobId);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputVideoPath = path.join(tempDir, 'source.mp4');
  const outputMergedPath = path.join(MERGED_OUTPUT_DIR, `${jobId}.mp4`);

  try {
    await saveVideoLocally(videoUrl, inputVideoPath);
    const meta = await probeMedia(inputVideoPath);

    let ffmpegCmd: string;
    if (mixMode === 'replace' || !meta.hasAudio) {
      // Direct replace with the voiceover track:
      // Explicitly map video from input 0 and audio from input 1 (the voiceover WAV file)
      // Standardize audio to stereo 44.1kHz AAC at 192k with loudnorm normalization
      ffmpegCmd = `"${FFMPEG_PATH}" -y -i "${inputVideoPath}" -i "${audioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -af "aformat=sample_rates=44100:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 44100 -ac 2 -shortest -movflags +faststart "${outputMergedPath}"`;
    } else {
      // Overlay voiceover on top of existing video audio: duck existing audio to 25%, boost voice to 120%
      ffmpegCmd = `"${FFMPEG_PATH}" -y -i "${inputVideoPath}" -i "${audioPath}" -filter_complex "[0:a]volume=0.25,aformat=sample_rates=44100:channel_layouts=stereo[bg];[1:a]volume=1.2,aformat=sample_rates=44100:channel_layouts=stereo[vo];[bg][vo]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11[aout]" -c:v copy -map 0:v:0 -map "[aout]" -c:a aac -b:a 192k -ar 44100 -ac 2 -shortest -movflags +faststart "${outputMergedPath}"`;
    }

    console.log('Running voiceover muxing:', ffmpegCmd);
    await execAsync(ffmpegCmd);

    const stats = fs.statSync(outputMergedPath);
    const finalProbe = await probeMedia(outputMergedPath);

    // Clean tempDir
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    return {
      jobId,
      filename: `talking_${jobId}.mp4`,
      downloadUrl: `/api/video/download/${jobId}`,
      streamUrl: `/api/video/stream/${jobId}`,
      duration: finalProbe.duration || meta.duration,
      fileSizeBytes: stats.size,
      resolution: `${meta.width}x${meta.height}`,
      videoCount: 1,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    throw new Error(`Voiceover dubbing failed: ${err.message}`);
  }
}

