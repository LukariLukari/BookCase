import { Client } from 'pg';
import { getRequestUser, verifyJwt } from '../src/lib/auth.ts';
import { getCloudflareContext } from './context.mjs';

async function query(text, values = []) {
  const { env } = getCloudflareContext();
  const client = new Client({ connectionString: env.HYPERDRIVE.connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    return await client.query(text, values);
  } finally { await client.end(); }
}
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Billy-Runtime': 'sql' } });

export async function readApi(request) {
  const pathname = new URL(request.url).pathname;
  try {
    if (pathname === '/api/health') {
      await query('SELECT 1');
      return json({ ok: true, database: 'postgresql', source: 'HYPERDRIVE' });
    }
    if (pathname === '/api/admin/registration-codes') {
      const user = getRequestUser(request);
      if (!user || user.role !== 'admin') return json({ detail: 'Bạn không có quyền quản trị.' }, 403);
      const result = await query(`SELECT "id", "code", "isUsed" AS is_used, "usedByUsername" AS used_by_username,
        "createdBy" AS created_by, "createdAt" AT TIME ZONE 'UTC' AS created_at
        FROM "RegistrationCode" ORDER BY "createdAt" DESC`);
      return json(result.rows);
    }
    if (pathname === '/api/backend/api/admin/users' || pathname === '/api/backend/admin/users') {
      const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      const payload = token ? verifyJwt(token) : null;
      if (!payload || typeof payload !== 'object') return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      const id = typeof payload.id === 'string' && payload.id ? payload.id : null;
      const sub = typeof payload.sub === 'string' ? payload.sub : null;
      if (!id && !sub) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      const result = await query(`WITH actor AS (
          SELECT "role" FROM "User" WHERE ($1::text IS NOT NULL AND "id" = $1)
            OR ($1::text IS NULL AND "username" = $2) LIMIT 1
        ) SELECT EXISTS(SELECT 1 FROM actor) AS authenticated,
          EXISTS(SELECT 1 FROM actor WHERE "role" = 'admin') AS allowed,
          COALESCE((SELECT json_agg(u ORDER BY u."createdAt" DESC) FROM (
            SELECT "id", "username", "email", "role", "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
              json_build_object(
                'products', (SELECT count(*) FROM "BusinessProduct" WHERE "userId" = users."id"),
                'orders', (SELECT count(*) FROM "BusinessOrder" WHERE "userId" = users."id"),
                'customers', (SELECT count(*) FROM "BusinessCustomer" WHERE "userId" = users."id"),
                'ledgers', (SELECT count(*) FROM "BusinessLedger" WHERE "userId" = users."id")
              ) AS "_count"
            FROM "User" users WHERE EXISTS(SELECT 1 FROM actor WHERE "role" = 'admin')
          ) u), '[]'::json) AS users`, [id, sub]);
      const row = result.rows[0];
      if (!row.authenticated) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      if (!row.allowed) return json({ detail: 'Bạn không có quyền quản trị.' }, 403);
      return json(row.users);
    }
    return null;
  } catch {
    console.error('Lightweight database read failed', { path: pathname });
    return json({ detail: 'Không thể tải dữ liệu. Vui lòng thử lại.' }, 503);
  }
}
