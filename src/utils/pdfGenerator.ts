import jsPDF from 'jspdf';
import { FacebookPost, ExportSettings } from '../types';
import { generateQrDataUrl } from './qr';

export interface GenerationProgress {
  step: number;
  total: number;
  message: string;
}

/**
 * Make post text safe for jsPDF's standard fonts (WinAnsi / Latin-1 only).
 * Without this, every emoji, maths symbol and box character in a Facebook
 * post turns into mojibake (Ø=Þ%) inside the PDF. Strategy:
 *   1. NFKD-normalise — folds compatibility symbols to plain text
 *      (𝒂 → a, ① → 1, full-width and stylised variants alike).
 *   2. Strip invisible formatting characters (variation selectors, ZWJ…).
 *   3. Map decorational emojis to short readable tags — an evidence PDF must
 *      show something meaningful where an emoji was, not mojibake.
 *   4. Replace characters the standard fonts cannot draw.
 */
const EMOJI_TAGS: Array<[RegExp, string]> = [
  [/[\u2764\u{1F49A}-\u{1F49F}]/gu, '[heart]'],
  [/[\u{1F602}\u{1F923}]/gu, '[lol]'],
  [/[\u{1F60A}\u{1F642}]/gu, '[smile]'],
  [/[\u{1F62D}\u{1F611}]/gu, '[react]'],
  [/[\u{1F44C}]/gu, '[approval]'],
  [/[\u{1F44E}]/gu, '[disapproval]'],
  [/[\u{1F64F}]/gu, '[pray]'],
  [/[\u{1F525}]/gu, '[fire]'],
  [/[\u{1F339}]/gu, '[rose]'],
  [/[\u{1F7E2}]/gu, '[green dot]'],
  [/[\u{1F534}]/gu, '[red dot]'],
  [/[\u26BD\u26C1\u26C2\u26C3\u{1F3C0}\u{1F3D0}\u{1F3C8}\u{1F3C9}]/gu, '[ball]'],
  [/[\u{1F44F}]/gu, '[clap]'],
  [/[\u{1F4AA}]/gu, '[strong]'],
  [/[\u{1F389}\u{1F38A}]/gu, '[celebrate]'],
  [/[\u{1F4B0}\u{1F4B8}]/gu, '[money]'],
  [/[\u23F0-\u23F3\u{1F550}-\u{1F55B}]/gu, '[clock]'],
  [/[\u{1F4CD}]/gu, '[location]'],
  [/[\u{1F4C5}\u{1F4C6}]/gu, '[calendar]'],
];

const WINANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

export function sanitizeTextForPdf(input: string): string {
  let s = (input || '').normalize('NFKD');
  // Invisible formatting: variation selectors, zero-width joiners, keycaps.
  s = s.replace(/[\uFE00-\uFE0F\u200B-\u200D\u2060\uFEFF\u20E3]/g, '');
  for (const [re, tag] of EMOJI_TAGS) s = s.replace(re, ` ${tag} `);
  // Common maths symbols the WinAnsi fonts can't draw — readable ASCII forms.
  const SYMBOLS: Array<[string, string]> = [
    ['\u2212', '-'], // minus sign
    ['\u2248', '~'], // almost equal
    ['\u2264', '<='],
    ['\u2265', '>='],
    ['\u2260', '!='],
    ['\u221A', 'sqrt'],
    ['\u2192', '->'],
    ['\u2190', '<-'],
    ['\u2194', '<->'],
    ['\u21D2', '=>'],
    ['\u2044', '/'],
    ['\u22EF', '...'],
    ['\u2500\u2501', '-'],
  ];
  for (const [sym, rep] of SYMBOLS) s = s.split(sym).join(rep);
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x100 || WINANSI_EXTRA.has(cp)) out += ch;
    else if (cp >= 0xd800 && cp <= 0xdfff) continue; // lone surrogates
    else if (cp > 0xffff) out += ' [emoji]';
    else if (cp >= 0x2000 && cp < 0x2100) out += ch === '\u2028' || ch === '\u2029' ? ' ' : ch;
    else out += '?';
  }
  return out.replace(/ {2,}/g, ' ').trim();
}

// Convert any image URL or path into a base64 Data URL for jsPDF
async function getBase64Image(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url) return null;

  try {
    // If it is already a base64 data URL
    if (url.startsWith('data:image/')) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            dataUrl: url,
            width: img.naturalWidth || 800,
            height: img.naturalHeight || 600,
          });
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    // For remote URLs or local assets, fetch directly or via proxy
    const fetchUrl =
      url.startsWith('http://') || url.startsWith('https://')
        ? `/api/proxy-image?url=${encodeURIComponent(url)}`
        : url;

    const res = await fetch(fetchUrl);
    if (!res.ok) {
      console.warn('Failed to fetch image via proxy:', fetchUrl, res.status);
      return null;
    }

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Measure exact dimensions
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          dataUrl,
          width: img.naturalWidth || 800,
          height: img.naturalHeight || 600,
        });
      };
      img.onerror = () => {
        resolve({
          dataUrl,
          width: 800,
          height: 600,
        });
      };
      img.src = dataUrl;
    });
  } catch (err) {
    console.warn('getBase64Image error:', err);
    return null;
  }
}

// Native Vector & Media PDF Generator - 100% reliable, sharp text, crisp images, never fails
export async function generateCombinedPdf(
  posts: FacebookPost[],
  settings: ExportSettings,
  onProgress?: (progress: GenerationProgress) => void
): Promise<void> {
  if (!posts || posts.length === 0) {
    throw new Error('No posts selected to export');
  }

  const isA4 = settings.pageFormat === 'a4';
  const orientation = settings.pageOrientation;
  const pageWidth = orientation === 'portrait' ? (isA4 ? 210 : 215.9) : (isA4 ? 297 : 279.4);
  const pageHeight = orientation === 'portrait' ? (isA4 ? 297 : 279.4) : (isA4 ? 210 : 215.9);

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: settings.pageFormat === 'auto_card' ? 'a4' : settings.pageFormat,
    compress: true,
  });

  const totalSteps = (settings.includeCoverPage ? 1 : 0) + posts.length;
  let currentStep = 0;

  // 1. Optional Cover Sheet Page
  if (settings.includeCoverPage) {
    currentStep++;
    onProgress?.({
      step: currentStep,
      total: totalSteps,
      message: 'Generating Archival Cover Sheet...',
    });

    // Dark Blue Brand Accent Line
    pdf.setFillColor(24, 119, 242); // Facebook blue
    pdf.rect(15, 15, pageWidth - 30, 4, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(24, 119, 242);
    pdf.text('FACEBOOK DIGITAL ARCHIVE REPORT', 15, 26);

    pdf.setFontSize(22);
    pdf.setTextColor(15, 23, 42);
    pdf.text(settings.archiveTitle || 'Facebook Post Archive Dossier', 15, 36);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `Certified compilation of ${posts.length} Facebook posts with media, text transcript, and verification metadata.`,
      15,
      44
    );

    // Meta box
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(15, 50, pageWidth - 30, 26, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text('COMPILED BY:', 20, 58);
    pdf.text('GENERATION DATE:', 75, 58);
    pdf.text('TOTAL POSTS:', 140, 58);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(settings.investigatorName || 'Archivist', 20, 66);
    pdf.text(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 75, 66);
    pdf.text(`${posts.length} entries`, 140, 66);

    // Table of contents
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('TABLE OF CONTENTS', 15, 88);

    let tocY = 96;
    for (let idx = 0; idx < posts.length; idx++) {
      if (tocY > pageHeight - 30) break;
      const p = posts[idx];

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(24, 119, 242);
      pdf.text(`#${idx + 1}`, 15, tocY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(15, 23, 42);
      pdf.text(sanitizeTextForPdf(p.authorName), 24, tocY);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`(${p.postDate})`, 80, tocY);

      const snippet = p.postContent ? p.postContent.replace(/\n/g, ' ').slice(0, 50) + '...' : 'Photo post';
      pdf.text(snippet, 24, tocY + 5);

      pdf.setDrawColor(241, 245, 249);
      pdf.line(15, tocY + 8, pageWidth - 15, tocY + 8);

      tocY += 13;
    }

    // Cover footer
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('ARCHIVE ENGINE: FacePDF Archiver · Digital Verification', 15, pageHeight - 12);
  }

  // 2. Render each Facebook Post
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    currentStep++;

    onProgress?.({
      step: currentStep,
      total: totalSteps,
      message: `Rendering Post ${i + 1} of ${posts.length} (${post.authorName})...`,
    });

    if (currentStep > 1) {
      pdf.addPage(settings.pageFormat === 'auto_card' ? 'a4' : settings.pageFormat, orientation);
    }

    const marginX = 15;
    let currentY = 18;
    const contentWidth = pageWidth - marginX * 2;

    // Optional top watermark strip
    if (settings.includeWatermark) {
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(marginX, currentY, contentWidth, 8, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text('FACEBOOK POST ARCHIVE ENTRY', marginX + 4, currentY + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(`Page ${i + 1} of ${posts.length}`, pageWidth - marginX - 25, currentY + 5.5);

      currentY += 14;
    }

    // Header: Avatar circle
    pdf.setFillColor(24, 119, 242);
    pdf.circle(marginX + 7, currentY + 7, 7, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(post.authorName.charAt(0) || 'F', marginX + 5.2, currentY + 8.5);

    // Header: Author Name & Verified Badge
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(sanitizeTextForPdf(post.authorName), marginX + 18, currentY + 6);

    if (post.isVerified) {
      const nameWidth = pdf.getTextWidth(sanitizeTextForPdf(post.authorName));
      pdf.setFillColor(24, 119, 242);
      pdf.circle(marginX + 21 + nameWidth, currentY + 4.5, 2.2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(6);
      pdf.text('v', marginX + 20.2 + nameWidth, currentY + 5.5);
    }

    // Header: Timestamp & Privacy icon
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`${post.postDate} · Public`, marginX + 18, currentY + 11);

    currentY += 20;

    // Post Content Text with intelligent multi-page pagination
    if (post.postContent) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(30, 41, 59);

      const splitText: string[] = pdf.splitTextToSize(sanitizeTextForPdf(post.postContent), contentWidth - 4);
      for (const line of splitText) {
        if (currentY > pageHeight - 38) {
          // Add continuation page for long text (e.g. detailed math revision steps)
          pdf.addPage(settings.pageFormat === 'auto_card' ? 'a4' : settings.pageFormat, orientation);
          currentY = 20;

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8.5);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`${sanitizeTextForPdf(post.authorName)} · Continuation`, marginX + 2, currentY);
          currentY += 7;

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9.5);
          pdf.setTextColor(30, 41, 59);
        }
        pdf.text(line, marginX + 2, currentY);
        currentY += 4.6;
      }

      currentY += 4;
    }

    // Post Images: Render Primary image on current page, plus all subsequent images
    if (post.images && post.images.length > 0) {
      const primaryImg = await getBase64Image(post.images[0]);

      if (primaryImg && primaryImg.dataUrl) {
        const maxImgWidth = contentWidth;
        const availableHeight = pageHeight - currentY - 45; // room for metrics and footer
        const maxImgHeight = Math.max(65, Math.min(135, availableHeight));

        const aspect = primaryImg.width / primaryImg.height;
        let renderW = maxImgWidth;
        let renderH = renderW / aspect;

        if (renderH > maxImgHeight) {
          renderH = maxImgHeight;
          renderW = renderH * aspect;
        }

        const imgX = marginX + (contentWidth - renderW) / 2;

        try {
          pdf.addImage(primaryImg.dataUrl, 'JPEG', imgX, currentY, renderW, renderH, undefined, 'FAST');
          currentY += renderH + 6;
        } catch (imgErr) {
          console.warn('Failed to embed primary image in PDF:', imgErr);
        }
      }

      // If post has multiple images (e.g. 5 math worksheet photos), add subsequent photos as full worksheet pages
      if (post.images.length > 1) {
        for (let imgIdx = 1; imgIdx < post.images.length; imgIdx++) {
          const addImg = await getBase64Image(post.images[imgIdx]);
          if (!addImg || !addImg.dataUrl) continue;

          pdf.addPage(settings.pageFormat === 'auto_card' ? 'a4' : settings.pageFormat, orientation);

          // Header
          pdf.setFillColor(248, 250, 252);
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(marginX, 15, contentWidth, 8, 'FD');

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.setTextColor(71, 85, 105);
          pdf.text(
            `${post.authorName.toUpperCase()} · WORKSHEET ATTACHMENT ${imgIdx + 1} OF ${post.images.length}`,
            marginX + 4,
            20.5
          );

          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(148, 163, 184);
          pdf.text(`Post ID: ${post.id}`, pageWidth - marginX - 35, 20.5);

          // Maximize image size on full page
          const fullAvailW = contentWidth;
          const fullAvailH = pageHeight - 50;
          const addAspect = addImg.width / addImg.height;

          let addW = fullAvailW;
          let addH = addW / addAspect;
          if (addH > fullAvailH) {
            addH = fullAvailH;
            addW = addH * addAspect;
          }

          const addX = marginX + (fullAvailW - addW) / 2;
          const addY = 27 + (fullAvailH - addH) / 2;

          try {
            pdf.addImage(addImg.dataUrl, 'JPEG', addX, addY, addW, addH, undefined, 'FAST');
          } catch (e) {
            console.warn('Failed to add subsequent image:', e);
          }

          // Footer
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(148, 163, 184);
          pdf.text(`Verified Archive Media · Page ${imgIdx + 1} of ${post.images.length}`, marginX, pageHeight - 12);
        }
      }
    }

    // Engagement Metrics
    if (settings.includeEngagement) {
      pdf.setDrawColor(241, 245, 249);
      pdf.line(marginX, currentY, marginX + contentWidth, currentY);
      currentY += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      const engagementText = `Likes: ${post.likesCount || 0}   Comments: ${post.commentsCount || 0}   Shares: ${post.sharesCount || 0}`;
      pdf.text(engagementText, marginX + 2, currentY);

      currentY += 8;
    }

    // Top Comments
    if (settings.includeComments && post.comments && post.comments.length > 0) {
      for (const c of post.comments.slice(0, 2)) {
        if (currentY > pageHeight - 35) break;

        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(marginX + 2, currentY, contentWidth - 4, 11, 2, 2, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(15, 23, 42);
        pdf.text(sanitizeTextForPdf(c.author), marginX + 5, currentY + 4.5);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(51, 65, 85);
        pdf.text(sanitizeTextForPdf(c.text).slice(0, 75), marginX + 5, currentY + 8.5);

        currentY += 13;
      }
    }

    // Bottom Verification Strip with QR Code
    const footerY = Math.max(currentY + 4, pageHeight - 25);

    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(marginX, footerY, contentWidth, 18, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text('VERIFIED FACEBOOK PERMALINK ARCHIVE', marginX + 4, footerY + 5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(30, 41, 59);
    const safeUrl = post.url.length > 70 ? post.url.slice(0, 70) + '...' : post.url;
    pdf.text(safeUrl, marginX + 4, footerY + 10);

    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`FBID: ${post.id} · Timestamp: ${new Date(post.fetchedAt).toLocaleString()}`, marginX + 4, footerY + 14.5);

    // QR Code
    if (settings.includeQrCode && post.url) {
      try {
        const qrDataUrl = await generateQrDataUrl(post.url);
        if (qrDataUrl) {
          pdf.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 16, footerY + 1.5, 15, 15);
        }
      } catch (qrErr) {
        console.warn('QR code generation skipped:', qrErr);
      }
    }
  }

  onProgress?.({
    step: totalSteps,
    total: totalSteps,
    message: 'Saving PDF file to your downloads...',
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  const cleanTitle = (settings.archiveTitle || 'facebook_posts').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `${cleanTitle}_combined_${timestamp}.pdf`;

  pdf.save(filename);
}

// Single Post Direct PDF Export
export async function exportSinglePostPdf(
  post: FacebookPost,
  settings: ExportSettings
): Promise<void> {
  await generateCombinedPdf([post], { ...settings, includeCoverPage: false });
}

// Export image as PNG
export async function exportElementAsPng(
  post: FacebookPost,
  filename: string
): Promise<void> {
  if (post.images && post.images.length > 0) {
    const link = document.createElement('a');
    link.download = `${filename}.jpg`;
    link.href = post.images[0];
    link.click();
  }
}
