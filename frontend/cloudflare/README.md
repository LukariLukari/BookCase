# Cloudflare Free runtime

`npm run build:cloudflare` builds Next.js/OpenNext, then generates lightweight API
and static-page artifacts in `.cloudflare/`. Deploy with
`npm run deploy:cloudflare`. Always rebuild after changing route handlers.

The custom entry point serves only pages marked permanently static by Next's
prerender manifest, including their RSC and segment-prefetch artifacts. Other
page requests fall back to OpenNext. Private API responses are never cached.

API handlers retain their existing authorization, validation, and transaction
logic. A build-time alias replaces the small `next/server` surface they use
(Response.json, binary Response, and Request.nextUrl) with native Web APIs.
If a route begins using other Next-specific server features, extend and test
the compatibility layer before using that route in the lightweight dispatcher.

Health, registration-code listing, and admin account listing use read-only,
parameterized PostgreSQL queries through Hyperdrive to avoid Prisma compiler
overhead. Account listing still checks the actor's current database role.
No credentials are stored in source files, and sockets are closed per request.

Checks: `npm run test:cloudflare`, `npm run test:db`, `npm run test:vouchers`,
`npx tsc --noEmit`, and `wrangler deploy --dry-run`.

The Free CPU quota is still a platform limit. Warm smoke tests reached 0–3 ms
for static pages, denied admin requests, and SELECT 1. Cold requests measured
33–58 ms. These results do not guarantee that authenticated queries, password
hashing, exports, or large data sets remain under the Free quota.
