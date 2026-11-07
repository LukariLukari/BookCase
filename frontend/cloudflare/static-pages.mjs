export async function serveStaticPage(request, assets, pages) {
  if (!['GET', 'HEAD'].includes(request.method) || request.headers.has('next-action')) return null;
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, '') || '/';
  const page = pages[pathname];
  if (!page) return null;
  const rsc = request.headers.get('rsc') === '1';
  const segment = request.headers.get('next-router-segment-prefetch');
  const file = rsc ? (segment ? page.segments[segment] : page.rsc) : page.html;
  if (!file) return null;
  const headers = new Headers(page.headers);
  // Framework cache tags are internal, and should never be exposed to browsers.
  headers.delete('x-next-cache-tags');
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('Vary', 'RSC, Next-Router-Segment-Prefetch');
  headers.set('X-Billy-Runtime', 'static');
  if (page.status >= 300 && page.status < 400) return new Response(null, { status: page.status, headers });
  const target = new URL(file, url);
  const response = await assets.fetch(new Request(target, { method: request.method }));
  if (!response.ok) return null;
  headers.set('Content-Type', rsc ? 'text/x-component' : 'text/html; charset=utf-8');
  return new Response(request.method === 'HEAD' ? null : response.body, { status: page.status || 200, headers });
}
