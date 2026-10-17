/**
 * Publish the GitHub Release for the current tag with clean notes.
 *
 * electron-builder (--publish always) uploads the installers and creates the
 * release as a DRAFT; this script finds that draft, sets a proper title and
 * body (rendered from .github/release-template.md), and makes it public.
 *
 * Env:
 *   GITHUB_TOKEN  a token with contents:write
 *   RELEASE_TAG   the tag being released, e.g. v1.2.3
 */
import fs from 'node:fs';

const REPO = 'valentineonuchukwu48-ship-it/facebookgrabcontents';
const TEMPLATE = new URL('../.github/release-template.md', import.meta.url);

const token = process.env.GITHUB_TOKEN;
const tag = process.env.RELEASE_TAG;

if (!token || !tag) {
  console.error('[publish-release] GITHUB_TOKEN and RELEASE_TAG are required');
  process.exit(1);
}
// workflow_dispatch runs on a branch, not a tag — nothing to do there.
if (!/^v\d/.test(tag)) {
  console.log(`[publish-release] "${tag}" is not a version tag; skipping`);
  process.exit(0);
}

const version = tag.replace(/^v/, '');
const body = fs.readFileSync(TEMPLATE, 'utf8').replaceAll('{{VERSION}}', version);
const name = `${tag} — FacebookGrabContents`;

const api = (path, opts = {}) =>
  fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'facebookgrabcontents-release',
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

// The draft electron-builder created for this tag (drafts carry a tag_name).
const releases = await api('/releases?per_page=100').then(async (r) => {
  if (!r.ok) throw new Error(`could not list releases: HTTP ${r.status}`);
  return r.json();
});
const existing = releases.find((r) => r.tag_name === tag);

const res = existing
  ? await api(`/releases/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name, body, draft: false, prerelease: false }),
    })
  : await api('/releases', {
      method: 'POST',
      body: JSON.stringify({ tag_name: tag, name, body, draft: false, prerelease: false }),
    });

const data = await res.json();
if (!res.ok) {
  console.error(`[publish-release] failed: HTTP ${res.status}`, data);
  process.exit(1);
}

console.log(`[publish-release] published ${data.tag_name} (assets: ${data.assets.length})`);
console.log(`[publish-release] ${data.html_url}`);
