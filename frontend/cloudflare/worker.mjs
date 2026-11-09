import { runWithCloudflareRequestContext } from '../.open-next/cloudflare/init.js';
import pages from '../.cloudflare/pages.json';
import { serveStaticPage } from './static-pages.mjs';
import { runSubscriptionSchedule } from './scheduled.mjs';

const worker = {
  async scheduled(_controller, env) {
    await runSubscriptionSchedule(env);
  },
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/api/')) {
      return runWithCloudflareRequestContext(request, env, ctx, async () => {
        if (request.method === 'GET') {
          const read = await import('../.cloudflare/read.mjs');
          const fastResponse = await read.readApi(request);
          if (fastResponse) return fastResponse;
        }
        const api = await import('../.cloudflare/api.mjs');
        return api.fetch(request);
      });
    }
    const response = await serveStaticPage(request, env.ASSETS, pages);
    if (response) return response;
    // Keep the full Next.js handler for requests not covered by the static build.
    const next = await import('../.open-next/worker.js');
    return next.default.fetch(request, env, ctx);
  },
};

export default worker;
