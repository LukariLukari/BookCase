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

function actorClaims(request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const payload = token ? verifyJwt(token) : null;
  if (!payload || typeof payload !== 'object') return null;
  const id = typeof payload.id === 'string' && payload.id ? payload.id : null;
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  return id || sub ? { id, sub } : null;
}

export async function readApi(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
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
      const claims = actorClaims(request);
      if (!claims) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
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
          ) u), '[]'::json) AS users`, [claims.id, claims.sub]);
      const row = result.rows[0];
      if (!row.authenticated) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      if (!row.allowed) return json({ detail: 'Bạn không có quyền quản trị.' }, 403);
      return json(row.users);
    }
  } catch {
    console.error('Lightweight database read failed', { path: pathname });
    return json({ detail: 'Không thể tải dữ liệu. Vui lòng thử lại.' }, 503);
  }

  try {
    if (pathname === '/api/backend/api/business/ledgers' || pathname === '/api/backend/business/ledgers') {
      const claims = actorClaims(request);
      if (!claims) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      const result = await query(`WITH actor AS (
          SELECT "id" FROM "User" WHERE ($1::text IS NOT NULL AND "id" = $1)
            OR ($1::text IS NULL AND "username" = $2) LIMIT 1
        ),
        order_Rollup AS (
          SELECT o."ledgerId",
            count(*)::int AS order_count,
            COALESCE(sum(COALESCE(items.subtotal, 0) + o."shippingFee" - o."discount"), 0)::float8 AS revenue,
            COALESCE(sum(COALESCE(items.subtotal, 0) + o."shippingFee" - o."discount" - COALESCE(items.capital, 0) - o."shippingCost" - o."otherFee"), 0)::float8 AS order_profit
          FROM "BusinessOrder" o
          LEFT JOIN LATERAL (
            SELECT sum(i."quantity" * i."unitPrice") AS subtotal,
                   sum(i."quantity" * i."unitCost") AS capital
            FROM "BusinessOrderItem" i WHERE i."orderId" = o."id"
          ) items ON true
          WHERE o."userId" = (SELECT "id" FROM actor) AND o."status" <> 'cancelled'
          GROUP BY o."ledgerId"
        ),
        expense_rollup AS (
          SELECT e."ledgerId", COALESCE(sum(e."amount"), 0)::float8 AS expenses
          FROM "BusinessExpense" e
          WHERE e."userId" = (SELECT "id" FROM actor)
          GROUP BY e."ledgerId"
        )
        SELECT EXISTS(SELECT 1 FROM actor) AS authenticated,
          COALESCE((SELECT json_agg(row_data ORDER BY row_data.created_at DESC) FROM (
            SELECT l."id", l."userId" AS user_id, l."name", l."month", l."openingCash" AS opening_cash,
              l."note", l."isClosed" AS is_closed,
              COALESCE(oroll.order_count, 0) AS order_count,
              COALESCE(oroll.revenue, 0) AS revenue,
              COALESCE(oroll.order_profit, 0) - COALESCE(eroll.expenses, 0) AS profit,
              l."createdAt" AT TIME ZONE 'UTC' AS created_at
            FROM "BusinessLedger" l
            LEFT JOIN order_Rollup oroll ON oroll."ledgerId" = l."id"
            LEFT JOIN expense_rollup eroll ON eroll."ledgerId" = l."id"
            WHERE l."userId" = (SELECT "id" FROM actor)
          ) row_data), '[]'::json) AS ledgers`, [claims.id, claims.sub]);
      const row = result.rows[0];
      if (!row?.authenticated) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      return json(row.ledgers);
    }

    const reportMatch = pathname.match(/^\/api\/backend\/(?:api\/)?business\/reports\/([^/]+)$/);
    if (reportMatch) {
      const ledgerId = decodeURIComponent(reportMatch[1]);
      const claims = actorClaims(request);
      if (!claims) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      const result = await query(`WITH actor AS (
          SELECT "id" FROM "User" WHERE ($1::text IS NOT NULL AND "id" = $1)
            OR ($1::text IS NULL AND "username" = $2) LIMIT 1
        ),
        ledger AS (
          SELECT "id", "userId" FROM "BusinessLedger"
          WHERE "id" = $3 AND "userId" = (SELECT "id" FROM actor) LIMIT 1
        ),
        order_calc AS (
          SELECT o."id",
            to_char(o."orderedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            o."shippingFee"::float8 AS shipping_fee,
            o."shippingCost"::float8 AS shipping_cost,
            o."discount"::float8 AS discount,
            o."otherFee"::float8 AS other_fee,
            COALESCE(items.subtotal, 0)::float8 AS subtotal,
            COALESCE(items.capital, 0)::float8 AS capital,
            COALESCE(items.units, 0)::int AS units,
            (COALESCE(items.subtotal, 0) + o."shippingFee" - o."discount")::float8 AS total,
            (COALESCE(items.subtotal, 0) + o."shippingFee" - o."discount" - COALESCE(items.capital, 0) - o."shippingCost" - o."otherFee")::float8 AS profit
          FROM "BusinessOrder" o
          LEFT JOIN LATERAL (
            SELECT sum(i."quantity" * i."unitPrice") AS subtotal,
                   sum(i."quantity" * i."unitCost") AS capital,
                   sum(i."quantity") AS units
            FROM "BusinessOrderItem" i WHERE i."orderId" = o."id"
          ) items ON true
          WHERE o."ledgerId" = (SELECT "id" FROM ledger)
            AND o."userId" = (SELECT "id" FROM actor)
            AND o."status" <> 'cancelled'
        ),
        totals AS (
          SELECT
            count(*)::int AS order_count,
            COALESCE(sum(total), 0)::float8 AS revenue,
            COALESCE(sum(subtotal - discount), 0)::float8 AS net_revenue,
            COALESCE(sum(capital), 0)::float8 AS capital_cost,
            COALESCE(sum(shipping_cost), 0)::float8 AS shipping_cost,
            COALESCE(sum(other_fee), 0)::float8 AS other_order_fee,
            COALESCE(sum(units), 0)::int AS sold_units
          FROM order_calc
        ),
        exp_totals AS (
          SELECT COALESCE(sum("amount"), 0)::float8 AS operating_expense
          FROM "BusinessExpense"
          WHERE "ledgerId" = (SELECT "id" FROM ledger) AND "userId" = (SELECT "id" FROM actor)
        ),
        stock_totals AS (
          SELECT COALESCE(sum("stockQuantity"), 0)::int AS stock_units,
                 COALESCE(sum("stockQuantity" * "unitCost"), 0)::float8 AS stock_value
          FROM "BusinessProduct"
          WHERE "userId" = (SELECT "id" FROM actor) AND "isActive" = true AND "trackStock" = true
        ),
        daily_rows AS (
          SELECT day AS date, count(*)::int AS orders, sum(total)::float8 AS revenue, sum(profit)::float8 AS profit
          FROM order_calc GROUP BY day ORDER BY day ASC
        ),
        top_rows AS (
          SELECT i."productId" AS product_id, max(i."productName") AS name,
                 sum(i."quantity")::int AS quantity,
                 sum(i."quantity" * i."unitPrice")::float8 AS revenue
          FROM "BusinessOrderItem" i
          JOIN order_calc o ON o."id" = i."orderId"
          GROUP BY i."productId"
          ORDER BY sum(i."quantity") DESC
          LIMIT 10
        ),
        expense_rows AS (
          SELECT "id", "category", "amount"::float8 AS amount, "note", "spentAt" AT TIME ZONE 'UTC' AS spent_at
          FROM "BusinessExpense"
          WHERE "ledgerId" = (SELECT "id" FROM ledger) AND "userId" = (SELECT "id" FROM actor)
          ORDER BY "spentAt" DESC
        )
        SELECT
          EXISTS(SELECT 1 FROM actor) AS authenticated,
          EXISTS(SELECT 1 FROM ledger) AS found,
          (SELECT row_to_json(t) FROM totals t) AS totals,
          (SELECT operating_expense FROM exp_totals) AS operating_expense,
          (SELECT row_to_json(s) FROM stock_totals s) AS stock,
          COALESCE((SELECT json_agg(d) FROM daily_rows d), '[]'::json) AS daily,
          COALESCE((SELECT json_agg(tp) FROM top_rows tp), '[]'::json) AS top_products,
          COALESCE((SELECT json_agg(er) FROM expense_rows er), '[]'::json) AS expenses`, [claims.id, claims.sub, ledgerId]);
      const row = result.rows[0];
      if (!row?.authenticated) return json({ detail: 'Phiên đăng nhập đã hết hạn.' }, 401);
      if (!row?.found) return json({ detail: 'Không tìm thấy sổ.' }, 404);
      const t = row.totals || { order_count: 0, revenue: 0, net_revenue: 0, capital_cost: 0, shipping_cost: 0, other_order_fee: 0, sold_units: 0 };
      const s = row.stock || { stock_units: 0, stock_value: 0 };
      const operating = Number(row.operating_expense || 0);
      const grossProfit = t.net_revenue - t.capital_cost;
      const netProfit = t.revenue - t.capital_cost - t.shipping_cost - t.other_order_fee - operating;
      return json({
        revenue: t.revenue,
        net_revenue: t.net_revenue,
        capital_cost: t.capital_cost,
        shipping_cost: t.shipping_cost,
        other_order_fee: t.other_order_fee,
        operating_expense: operating,
        gross_profit: grossProfit,
        net_profit: netProfit,
        profit_after_inventory: netProfit - s.stock_value,
        profit: netProfit,
        order_count: t.order_count,
        sold_units: t.sold_units,
        average_order_value: t.order_count ? Math.round(t.revenue / t.order_count) : 0,
        stock_units: s.stock_units,
        stock_value: s.stock_value,
        daily: row.daily,
        top_products: row.top_products,
        expenses: row.expenses,
      });
    }

    if (pathname === '/api/sales/customers') {
      const user = getRequestUser(request);
      if (!user) return json({ detail: 'Phiên đăng nhập không hợp lệ.' }, 401);
      const q = url.searchParams.get('q')?.trim() || null;
      const like = q ? `%${q}%` : null;
      const result = await query(`SELECT
          c."id", c."name", c."phone", c."email", c."socialLink" AS social_link,
          c."address", c."tags", c."note",
          COALESCE(stats.order_count, 0)::int AS order_count,
          COALESCE(stats.total_spent, 0)::float8 AS total_spent,
          stats.last_order_at,
          c."createdAt" AT TIME ZONE 'UTC' AS created_at
        FROM "BusinessCustomer" c
        LEFT JOIN LATERAL (
          SELECT
            count(*)::int AS order_count,
            max(o."orderedAt" AT TIME ZONE 'UTC') AS last_order_at,
            COALESCE(sum(CASE WHEN o."status" <> 'cancelled' THEN COALESCE(items.subtotal, 0) + o."shippingFee" - o."discount" ELSE 0 END), 0)::float8 AS total_spent
          FROM "BusinessOrder" o
          LEFT JOIN LATERAL (
            SELECT sum(i."quantity" * i."unitPrice") AS subtotal
            FROM "BusinessOrderItem" i WHERE i."orderId" = o."id"
          ) items ON true
          WHERE o."customerId" = c."id"
        ) stats ON true
        WHERE c."userId" = $1
          AND ($2::text IS NULL OR c."name" ILIKE $2 OR c."phone" LIKE $2 OR c."email" ILIKE $2)
        ORDER BY c."updatedAt" DESC`, [user.id, like]);
      return json(result.rows);
    }

    return null;
  } catch (err) {
    console.error('Fast SQL read fallback to Prisma', { path: pathname, err });
    return null;
  }
}
