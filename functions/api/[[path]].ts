/**
 * Cloudflare Pages Function — proxies API traffic to the Node backend.
 *
 * The full app (FFmpeg + yt-dlp + writable disk) cannot run on Cloudflare's
 * edge runtime, so this function lets the STATIC frontend live on Cloudflare
 * Pages (free) while every dynamic call is forwarded to the deployed backend.
 *
 * Configure the backend URL as a Pages environment variable:
 *
 *   API_BACKEND_URL = https://your-backend.onrender.com
 *
 * Because the browser only ever talks to the Pages origin, the frontend needs
 * no changes and there is no CORS involved. The Origin/Referer headers are
 * dropped so the backend's same-origin guard treats this as server-to-server.
 */

interface Env {
  API_BACKEND_URL?: string;
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const backend = (context.env.API_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!backend) {
    return new Response(
      JSON.stringify({ error: 'API_BACKEND_URL is not configured for this Pages project.' }),
      { status: 502, headers: { 'content-type': 'application/json' } }
    );
  }

  const incoming = new URL(context.request.url);
  const target = backend + incoming.pathname + incoming.search;

  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.set('x-forwarded-host', incoming.host);

  const method = context.request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';

  const upstream = await fetch(target, {
    method,
    headers,
    body: hasBody ? context.request.body : undefined,
    redirect: 'manual',
  });

  const outHeaders = new Headers(upstream.headers);
  // Body framing may change at the edge; let the runtime set these.
  outHeaders.delete('content-length');
  outHeaders.delete('content-encoding');

  return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
};
