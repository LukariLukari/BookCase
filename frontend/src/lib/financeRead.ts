// All reads use bound values and one PostgreSQL snapshot. Never cache money data
// across requests: writes must be visible immediately to the next reader.
const actor = `actor AS (SELECT "id" FROM "User" WHERE "id" = $1)`;
const totals = `outgoing AS (
  SELECT "accountId", count(*)::int AS count,
    sum(CASE WHEN "type" = 'income' THEN "amount" WHEN "type" IN ('expense','transfer') THEN -"amount" ELSE 0 END) AS balance
  FROM "FinanceTransaction" WHERE "userId" = (SELECT "id" FROM actor) GROUP BY "accountId"
), incoming AS (
  SELECT "destinationAccountId", count(*)::int AS count, sum("amount") AS balance
  FROM "FinanceTransaction" WHERE "userId" = (SELECT "id" FROM actor) AND "type" = 'transfer' AND "destinationAccountId" IS NOT NULL GROUP BY "destinationAccountId"
)`;
const books = `COALESCE((SELECT json_agg(book ORDER BY book."createdAt" DESC) FROM (
  SELECT b."id", b."name", b."defaultCurrency", COALESCE(b."note", '') AS note, to_char(b."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
    COALESCE((SELECT json_agg(to_jsonb(account) - 'createdAt' ORDER BY account."createdAt") FROM (
      SELECT a."id", a."name", a."type", a."currency", a."openingBalance"::float8 AS "openingBalance", a."creditLimit"::float8 AS "creditLimit",
        (a."openingBalance" + COALESCE(o.balance, 0) + COALESCE(i.balance, 0))::float8 AS balance,
        (COALESCE(o.count, 0) + COALESCE(i.count, 0))::int AS "transactionCount",
        COALESCE((SELECT json_agg(edit ORDER BY edit."createdAt" DESC) FROM (
          SELECT e."id", e."previousName", e."newName", e."previousType", e."newType", e."previousCurrency", e."newCurrency",
            e."previousCreditLimit"::float8 AS "previousCreditLimit", e."newCreditLimit"::float8 AS "newCreditLimit",
            e."previousBalance"::float8 AS "previousBalance", e."newBalance"::float8 AS "newBalance", COALESCE(e."note", '') AS note,
            to_char(e."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
          FROM "MoneyAccountEdit" e WHERE e."accountId" = a."id" AND e."userId" = (SELECT "id" FROM actor) ORDER BY e."createdAt" DESC LIMIT 20
        ) edit), '[]'::json) AS "editHistory", a."createdAt"
      FROM "MoneyAccount" a LEFT JOIN outgoing o ON o."accountId" = a."id" LEFT JOIN incoming i ON i."destinationAccountId" = a."id"
      WHERE a."bookId" = b."id" AND a."userId" = (SELECT "id" FROM actor)
    ) account), '[]'::json) AS accounts
  FROM "ExpenseBook" b WHERE b."userId" = (SELECT "id" FROM actor)
) book), '[]'::json)`;
const categories = `COALESCE((SELECT json_agg(to_jsonb(category) - 'createdAt' ORDER BY category.type, category."createdAt") FROM (
  SELECT c."id", c."name", c."type", c."icon", c."color", COALESCE(u.count, 0)::int AS "usageCount", c."createdAt"
  FROM "FinanceCategory" c LEFT JOIN (
    SELECT "categoryId", count(*) AS count FROM "FinanceTransaction" WHERE "userId" = (SELECT "id" FROM actor) GROUP BY "categoryId"
  ) u ON u."categoryId" = c."id" WHERE c."userId" = (SELECT "id" FROM actor)
) category), '[]'::json)`;
const selectedBook = (fallback: boolean) => `selected_book AS (
  SELECT "id" FROM "ExpenseBook" WHERE "userId" = (SELECT "id" FROM actor) ${fallback ? '' : 'AND "id" = $2'}
  ORDER BY CASE WHEN "id" = $2 THEN 0 ELSE 1 END, "createdAt" DESC LIMIT 1
)`;
const transactions = `COALESCE((SELECT json_agg(item ORDER BY item.date DESC, item."createdAt" DESC, item.id DESC) FROM (
  SELECT t."id", t."type", t."amount"::float8 AS amount, t."currency", t."categoryId",
    COALESCE(NULLIF(c."name", ''), t."category") AS category, c."icon" AS "categoryIcon", c."color" AS "categoryColor",
    COALESCE(t."description", '') AS description, to_char(t."transactionDate", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS date, to_char(t."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt",
    json_build_object('id', a."id", 'name', a."name", 'type', a."type") AS account,
    CASE WHEN d."id" IS NULL THEN NULL ELSE json_build_object('id', d."id", 'name', d."name", 'type', d."type") END AS "destinationAccount"
  FROM "FinanceTransaction" t JOIN "MoneyAccount" a ON a."id" = t."accountId" AND a."userId" = t."userId"
  LEFT JOIN "MoneyAccount" d ON d."id" = t."destinationAccountId" AND d."userId" = t."userId"
  LEFT JOIN "FinanceCategory" c ON c."id" = t."categoryId" AND c."userId" = t."userId"
  WHERE t."userId" = (SELECT "id" FROM actor) AND t."bookId" = (SELECT "id" FROM selected_book)
) item), '[]'::json)`;

export type FinanceReadKind = 'bootstrap' | 'books' | 'categories' | 'transactions';
export function financeReadQuery(kind: FinanceReadKind, userId: string, bookId = '') {
  const withBooks = kind === 'bootstrap' || kind === 'books';
  const withTransactions = kind === 'bootstrap' || kind === 'transactions';
  const ctes = [actor, ...(withBooks ? [totals] : []), ...(withTransactions ? [selectedBook(kind === 'bootstrap')] : [])];
  const fields = [
    'EXISTS(SELECT 1 FROM actor) AS authenticated',
    ...(withBooks ? [`${books} AS books`] : []),
    ...(kind === 'bootstrap' || kind === 'categories' ? [`${categories} AS categories`] : []),
    ...(withTransactions ? ['(SELECT "id" FROM selected_book) AS "bookId"', `${transactions} AS transactions`] : []),
  ];
  return { text: `WITH ${ctes.join(', ')} SELECT ${fields.join(', ')}`, values: withTransactions ? [userId, bookId] : [userId] };
}

export type FinanceReadRow = { authenticated: boolean; bookId?: string | null; books?: unknown[]; categories?: unknown[]; transactions?: unknown[] };
export function financeReadResponse(kind: FinanceReadKind, row: FinanceReadRow) {
  if (!row.authenticated) return { status: 401, body: { detail: 'Phiên đăng nhập không hợp lệ.' } };
  if (kind === 'transactions' && !row.bookId) return { status: 404, body: { detail: 'Không tìm thấy sổ chi tiêu.' } };
  return { status: 200, body: kind === 'books' ? row.books : kind === 'categories' ? row.categories : kind === 'transactions' ? { transactions: row.transactions } : { bookId: row.bookId || '', books: row.books, categories: row.categories, transactions: row.transactions } };
}
