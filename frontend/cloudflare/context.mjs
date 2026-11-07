export function getCloudflareContext() {
  const context = globalThis[Symbol.for('__cloudflare-context__')];
  if (!context) throw new Error('No Cloudflare request context');
  return context;
}
