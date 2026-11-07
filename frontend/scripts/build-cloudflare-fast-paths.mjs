import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinModules } from 'node:module';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = path.join(root, '.cloudflare');
await fs.mkdir(generated, { recursive: true });
async function files(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}

const apiRoot = path.join(root, 'src/app/api');
const routes = (await files(apiRoot)).filter(file => path.basename(file) === 'route.ts').map(file => ({
  file,
  pattern: ['api', ...path.relative(apiRoot, path.dirname(file)).split(path.sep).filter(Boolean)],
}));
routes.sort((a, b) => {
  const rank = route => route.pattern.reduce((score, part) => score + (part.startsWith('[...') ? 0 : part.startsWith('[') ? 10 : 100), 0);
  return rank(b) - rank(a);
});
const entry = `import { NextRequest } from '../cloudflare/next-server.mjs';
import { dispatchApi } from '../cloudflare/router.mjs';
const routes = [${routes.map(route => `{pattern:${JSON.stringify(route.pattern)},load:()=>import(${JSON.stringify('../' + path.relative(root, route.file).split(path.sep).join('/'))})}`).join(',\n')}];
export const fetch = request => dispatchApi(request, routes, NextRequest);`;
await fs.writeFile(path.join(generated, 'api-entry.mjs'), entry);
const options = {
  bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', minify: true,
  conditions: ['workerd', 'worker'], mainFields: ['module', 'main'],
  external: [...builtinModules, ...builtinModules.map(name => `node:${name}`), '*.wasm'],
  banner: { js: "import { createRequire as __createRequire } from 'node:module';const require=__createRequire(import.meta.url);" },
  alias: {
    'next/server': path.join(root, 'cloudflare/next-server.mjs'),
    '@opennextjs/cloudflare': path.join(root, 'cloudflare/context.mjs'),
  },
  metafile: true,
};
await build({ ...options, entryPoints: [path.join(generated, 'api-entry.mjs')], outfile: path.join(generated, 'api.mjs') })
  .then(result => fs.writeFile(path.join(generated, 'api.meta.json'), JSON.stringify(result.metafile)));
await build({ ...options, entryPoints: [path.join(root, 'cloudflare/read-api.mjs')], outfile: path.join(generated, 'read.mjs') })
  .then(result => fs.writeFile(path.join(generated, 'read.meta.json'), JSON.stringify(result.metafile)));
await fs.copyFile(path.join(root, 'node_modules/.prisma/client/query_compiler_bg.wasm'), path.join(generated, 'query_compiler_bg.wasm'));

const prerender = JSON.parse(await fs.readFile(path.join(root, '.next/prerender-manifest.json'), 'utf8'));
const buildId = (await fs.readFile(path.join(root, '.next/BUILD_ID'), 'utf8')).trim();
const assets = path.join(root, '.open-next/assets');
const pages = {};
for (const [route, info] of Object.entries(prerender.routes)) {
  if (info.initialRevalidateSeconds !== false || route.startsWith('/api/')) continue;
  const relative = route === '/' ? 'index' : route.slice(1);
  const source = path.join(root, '.next/server/app', relative);
  try { await fs.access(source + '.html'); } catch { continue; }
  let meta = {};
  try { meta = JSON.parse(await fs.readFile(source + '.meta', 'utf8')); } catch { /* Optional metadata. */ }
  const entry = { segments: {}, headers: meta.headers || {}, status: meta.status || 200 };
  async function copy(file, key) {
    const asset = `/__billy-pages/${buildId}/${relative}/${key}.data`;
    const target = path.join(assets, asset);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
    return asset;
  }
  entry.html = await copy(source + '.html', 'html');
  try { entry.rsc = await copy(source + '.rsc', 'rsc'); } catch { /* No RSC for non-page assets. */ }
  for (const segment of meta.segmentPaths || []) {
    entry.segments[segment] = await copy(path.join(source + '.segments', segment.slice(1) + '.segment.rsc'), 'segments/' + segment.slice(1));
  }
  pages[route] = entry;
}
await fs.writeFile(path.join(generated, 'pages.json'), JSON.stringify(pages));
console.log(`Lightweight Worker: ${routes.length} API routes, ${Object.keys(pages).length} static pages.`);
