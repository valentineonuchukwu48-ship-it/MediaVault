/**
 * Zero-trust verifier bundle.
 *
 * Generates a SINGLE self-contained HTML file that embeds the whole sealed
 * chain and re-implements the verification algorithm from scratch, in the
 * browser, using WebCrypto. Nothing is trusted from the app itself:
 *
 *   1. contentHash — SHA-256 of the NFC-normalized post text
 *   2. entry hash  — SHA-256 of the canonical (sorted-key) serialization of
 *                    the whole entry body
 *   3. linkage     — every prevHash equals the previous entry's hash
 *
 * Recipients (journalists, lawyers, courts) open the file without installing
 * anything and get a plain VERIFIED / BROKEN verdict. The page can also
 * verify a stranger's chain.ndjson via drag & drop — it is a universal
 * verifier, not a viewer for this one export.
 *
 * Deliberately does NOT import from vaultStore: the verifier is an
 * independent re-derivation (that is the entire point), and the rendering
 * environment is a browser, not Node.
 */
import { VaultEntry, loadChain } from './vaultStore';

const GENESIS = 'GENESIS';
const FORMAT_VERSION = 1;

interface VerifierCorpus {
  app: string;
  formatVersion: number;
  genesis: string;
  exportedAt: string;
  entries: VaultEntry[];
  notice: string;
}

function canonicalCorpus(): string {
  const corpus: VerifierCorpus = {
    app: 'Ultimate Media Vault — ProsperChild Technology, Nigeria',
    formatVersion: FORMAT_VERSION,
    genesis: GENESIS,
    exportedAt: new Date().toISOString(),
    entries: loadChain().slice(), // oldest → newest, in chain order
    notice:
      'Verification is performed by this page using Web Crypto SHA-256. ' +
      'Every hash is recomputed from the entry payloads; nothing is taken on faith.',
  };
  // Escape '<' so a malicious post text can never close the embedding <script>.
  return JSON.stringify(corpus).replace(/</g, '\\u003c');
}

export function buildVerifierPage(): string {
  return VERIFIER_HTML.replace('__FGC_CORPUS__', canonicalCorpus());
}

export const VERIFIER_HTML = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<title>Zero-Trust Verifier — Ultimate Media Vault Evidence Vault</title>',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<style>',
  ':root{--bg:#0b1020;--panel:#111a2e;--line:#223052;--text:#f1f5f9;--muted:#94a3b8;--ok:#34d399;--bad:#fb7185;--warn:#fbbf24;--accent:#6366f1}',
  '*{box-sizing:border-box}body{margin:0;padding:24px 16px 80px;background:var(--bg);color:var(--text);font:14px/1.5 "Plus Jakarta Sans",-apple-system,"Segoe UI",Roboto,sans-serif}',
  '.wrap{max-width:980px;margin:0 auto}',
  'h1{font-size:20px;margin:0 0 4px}h1 .shield{color:var(--accent)}',
  '.sub{color:var(--muted);font-size:12px;margin-bottom:20px}',
  '.verdict{border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:18px 0;background:var(--panel);font-size:15px;font-weight:600}',
  '.verdict.ok{border-color:#14532d55;color:var(--ok)}',
  '.verdict.bad{border-color:#7f1d1d55;color:var(--bad)}',
  '.verdict .meta{display:block;font-weight:400;color:var(--muted);font-size:12px;margin-top:6px}',
  '.drop{border:2px dashed var(--line);border-radius:14px;padding:16px;text-align:center;color:var(--muted);font-size:12px;cursor:pointer}',
  '.drop.drag{border-color:var(--accent);color:var(--text)}',
  'table{width:100%;border-collapse:collapse;margin-top:22px;font-size:12.5px}',
  'th{color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-size:10px;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}',
  'td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}',
  'td.hash{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:var(--muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  'td.preview{color:var(--muted);max-width:320px}',
  '.chip{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;letter-spacing:.05em}',
  '.SEAL{background:#14532d66;color:var(--ok)}.EDIT_DETECTED{background:#78350f66;color:var(--warn)}.DELETE_DETECTED{background:#7f1d1d66;color:var(--bad)}.NOTE{background:#1e3a8a66;color:#93c5fd}',
  '.tick{font-weight:700}.tick.y{color:var(--ok)}.tick.n{color:var(--bad)}',
  '.bad-row{background:#7f1d1d22 !important}',
  'details{margin-top:18px}summary{cursor:pointer;color:var(--muted);font-size:12px}',
  'pre{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto;font-size:11px;color:var(--muted)}',
  '.how{color:var(--muted);font-size:12px;margin-top:26px;border-top:1px solid var(--line);padding-top:14px}',
  '.footer{color:#475569;font-size:11px;margin-top:28px;text-align:center}',
  '</style>',
  '</head>',
  '<body>',
  '<div class="wrap">',
  '<h1><span class="shield">&#128737;</span> Zero-Trust Verifier</h1>',
  '<div class="sub">Ultimate Media Vault Evidence Vault — independent re-verification in your browser. No network calls, no installation, no trust in the app that produced this file.</div>',
  '<div class="verdict" id="verdict">Verifying&hellip;<span class="meta" id="verdict-meta"></span></div>',
  '<div class="drop" id="drop">Or drop / pick another <b>chain.ndjson</b> to verify it instead &mdash; drop the file here or click to choose.</div>',
  '<input id="chainFile" type="file" accept="text/plain,.ndjson,.txt" style="display:none">',
  '<table id="results"><thead><tr><th>Seq</th><th>When</th><th>Type</th><th>Post</th><th>Content</th><th>Content hash</th><th>Entry hash</th><th>Link</th></tr></thead><tbody></tbody></table>',
  '<details><summary>How this verification works (independent of the app)</summary>',
  '<pre id="how-text"></pre></details>',
  '<div class="how">',
  'This page recomputes, with the platform\u2019s own Web Crypto (SHA-256):',
  '(1) each entry\u2019s <b>contentHash</b> from the normalized stored text;',
  '(2) each entry\u2019s <b>hash</b> over the canonical (sorted-key) serialization of its full body; and',
  '(3) the <b>chain</b>: every entry must declare the previous entry\u2019s hash as its previousHash.',
  'Any single byte of tampering anywhere in history breaks every check after it and is displayed above.',
  '</div>',
  '<div class="footer">Ultimate Media Vault &mdash; ProsperChild Technology, Nigeria &middot; Valentine Onuchukwu &middot; valentineonuchukwu@gmail.com</div>',
  '</div>',
  '<script id="fgc-corpus">window.FGC_CORPUS=__FGC_CORPUS__;</script>',
  '<script id="fgc-verifier-js">',
  '\'use strict\';',
  'var GENESIS = "GENESIS";',
  'function canonical(v){',
  '  if (v === null || typeof v !== "object") return JSON.stringify(v);',
  '  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";',
  '  var keys = Object.keys(v).sort();',
  '  return "{" + keys.map(function(k){ return JSON.stringify(k) + ":" + canonical(v[k]); }).join(",") + "}";',
  '}',
  'function normalizeContent(s){ return (s || "").normalize("NFC").replace(/\\s+/g, " ").trim(); }',
  'function toHex(buf){ var a = new Uint8Array(buf); var out = []; for (var i = 0; i < a.length; i++) out.push(a[i].toString(16).padStart(2, "0")); return out.join(""); }',
  'function sha256(text){ return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(toHex); }',
  'async function verifyEntry(e, prevExpected) {',
  '  var body = { seq: e.seq, prevHash: e.prevHash, timestamp: e.timestamp, type: e.type, postId: e.postId, url: e.url, contentHash: e.contentHash, snapshot: e.snapshot };',
  '  var contentOk = (await sha256(normalizeContent(e.snapshot && e.snapshot.postContent || ""))) === e.contentHash;',
  '  var entryOk; try { entryOk = (await sha256(canonical(body))) === e.hash; } catch (err) { entryOk = false; }',
  '  var linkOk = e.prevHash === prevExpected;',
  '  return { contentOk: contentOk, entryOk: entryOk, linkOk: linkOk };',
  '}',
  'function rowFor(entry, checks, broken){',
  '  var tr = document.createElement("tr");',
  '  if (broken) tr.className = "bad-row";',
  '  function td(html, cls){ var td = document.createElement("td"); if (cls) td.className = cls; td.innerHTML = html; tr.appendChild(td); }',
  '  function tick(ok){ return ok ? \'<span class="tick y">&#10003;</span>\' : \'<span class="tick n">&#10007;</span>\'; }',
  '  td(String(entry.seq));',
  '  td(String((entry.timestamp || "").replace("T", " ").slice(0, 19)));',
  '  td(\'<span class="chip \' + entry.type + \'">\' + entry.type + \'</span>\');',
  '  td(String(entry.postId || "").replace(/</g, "&lt;"));',
  '  td(String((entry.snapshot && entry.snapshot.postContent || "").slice(0, 90)).replace(/</g, "&lt;") + "&hellip;", "preview");',
  '  td(tick(checks.contentOk), "hash");',
  '  td(tick(checks.entryOk), "hash");',
  '  td(tick(checks.linkOk), "hash");',
  '  return tr;',
  '}',
  'async function run() {',
  '  var corpus = window.FGC_CORPUS;',
  '  var tbody = document.querySelector("#results tbody");',
  '  var verdict = document.getElementById("verdict");',
  '  var meta = document.getElementById("verdict-meta");',
  '  tbody.textContent = "";',
  '  var entries = Array.isArray(corpus.entries) ? corpus.entries : [];',
  '  var prev = GENESIS, broken = false, okCount = 0, firstBreak = 0, firstReason = "";',
  '  for (var i = 0; i < entries.length; i++) {',
  '    var e = entries[i];',
  '    var checks = await verifyEntry(e, prev);',
  '    var isBroken = !checks.contentOk || !checks.entryOk || !checks.linkOk || broken;',
  '    var rowElement = rowFor(e, checks, isBroken); tbody.appendChild(rowElement);',
  '    if (!broken && isBroken) { broken = true; firstBreak = e.seq; firstReason = !checks.linkOk ? "Broken chain link" : (!checks.entryOk ? "Entry hash mismatch (content tampered)" : "Content hash mismatch"); }',
  '    if (!isBroken) okCount++;',
  '    prev = e.hash;',
  '  }',
  '  verdict.classList.remove("ok", "bad");',
  '  if (entries.length === 0) { verdict.innerHTML = "Nothing to verify — this bundle contains no entries."; }',
  '  else if (!broken) {',
  '    verdict.classList.add("ok");',
  '    verdict.innerHTML = "&#10003; " + okCount + " / " + entries.length + " entries VERIFIED";',
  '    meta.textContent = "All content hashes match · all entry hashes recomputed correctly · chain links intact · exported " + corpus.exportedAt.replace("T", " ").slice(0, 19) + " UTC";',
  '  } else {',
  '    verdict.classList.add("bad");',
  '    verdict.innerHTML = "&#10007; TAMPERING DETECTED";',
  '    meta.textContent = "First break at entry #" + firstBreak + " — " + firstReason + ". Everything after it is untrustworthy.";',
  '  }',
  '  document.getElementById("how-text").textContent = "Genesis: " + GENESIS + " · Canonical form: sorted-key compact JSON · entryHash = SHA-256(canonical(body)) · contentHash = SHA-256(normalize(snapshot.postContent)) · exported by " + corpus.app;',
  '}',
  'function loadExternal(text) {',
  '  var entries = [];',
  '  text.split("\\n").forEach(function (line) {',
  '    var t = line.trim(); if (!t) return;',
  '    try { entries.push(JSON.parse(t)); } catch (e) { /* torn last line */ }',
  '  });',
  '  window.FGC_CORPUS = { app: "external chain.ndjson", formatVersion: 1, genesis: GENESIS, exportedAt: new Date().toISOString(), entries: entries, notice: "" };',
  '  run();',
  '}',
  'var input = document.getElementById("chainFile");',
  'var drop = document.getElementById("drop");',
  'drop.addEventListener("dragover", function (ev) { ev.preventDefault(); drop.classList.add("drag"); });',
  'drop.addEventListener("dragleave", function () { drop.classList.remove("drag"); });',
  'drop.addEventListener("drop", function (ev) { ev.preventDefault(); drop.classList.remove("drag"); var f = ev.dataTransfer.files[0]; if (f) { var r = new FileReader(); r.onload = function () { loadExternal(String(r.result)); }; r.readAsText(f); } });',
  'drop.addEventListener("click", function () { input.click(); });',
  'input.addEventListener("change", function () { if (input.files[0]) { var r = new FileReader(); r.onload = function () { loadExternal(String(r.result)); }; r.readAsText(input.files[0]); } });',
  'run();',
  '</script>',
  '</body>',
  '</html>',
].join('\n');
