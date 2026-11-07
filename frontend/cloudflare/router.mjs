export function matchRoute(pattern, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const segment = pattern[i];
    if (segment.startsWith('[...')) {
      if (i >= parts.length) return null;
      params[segment.slice(4, -1)] = parts.slice(i).map(decodeURIComponent);
      return params;
    }
    if (i >= parts.length) return null;
    if (segment.startsWith('[')) params[segment.slice(1, -1)] = decodeURIComponent(parts[i]);
    else if (segment !== parts[i]) return null;
  }
  return pattern.length === parts.length ? params : null;
}

export async function dispatchApi(request, routes, RequestClass) {
  try {
    const pathname = new URL(request.url).pathname;
    for (const route of routes) {
      const params = matchRoute(route.pattern, pathname);
      if (!params) continue;
      const handlers = await route.load();
      const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].filter(method => typeof handlers[method] === 'function');
      if (methods.includes('GET') && !methods.includes('HEAD')) methods.push('HEAD');
      if (!methods.includes('OPTIONS')) methods.push('OPTIONS');
      const method = request.method === 'HEAD' && !handlers.HEAD ? 'GET' : request.method;
      if (request.method === 'OPTIONS' && !handlers.OPTIONS) return new Response(null, { status: 204, headers: { Allow: methods.join(', ') } });
      if (!handlers[method]) return new Response(null, { status: 405, headers: { Allow: methods.join(', ') } });
      const response = await handlers[method](new RequestClass(request), { params: Promise.resolve(params) });
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Billy-Runtime', 'api');
      return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers });
    }
    return Response.json({ detail: 'Đường dẫn API không tồn tại.' }, { status: 404 });
  } catch (error) {
    if (error instanceof URIError) return Response.json({ detail: 'Đường dẫn không hợp lệ.' }, { status: 400 });
    console.error('API handler failed', { code: typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR' });
    return Response.json({ detail: 'Không thể xử lý dữ liệu. Vui lòng thử lại.' }, { status: 500 });
  }
}
