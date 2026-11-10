// Route integration tests use an isolated database double and real bcrypt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import bcrypt from 'bcryptjs';

function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Buffer, Date, Set, require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const helpers = load('lib/accountProfile.ts');
const originalHash = await bcrypt.hash('original-password', 4);
function fixture(role = 'user') {
  const users = new Map([
    ['owner', { id: 'owner', username: 'owner', email: null, role, password_hash: originalHash, createdAt: new Date('2026-01-01T00:00:00Z'), profile: null }],
    ['other', { id: 'other', username: 'other', email: 'other@example.com', role: 'user', password_hash: originalHash, createdAt: new Date(), profile: null }],
  ]);
  let writes = 0;
  let conflict = false;
  function selectUser({ where, select }) {
    const user = users.get(where.id);
    return user ? Object.fromEntries(Object.keys(select).map(key => [key, structuredClone(user[key])])) : null;
  }
  const prisma = {
    user: {
      findUnique: async args => selectUser(args),
      findUniqueOrThrow: async args => { const row = selectUser(args); assert.ok(row); return row; },
      updateMany: async ({ where, data }) => {
        assert.equal(where.id, 'owner');
        const user = users.get(where.id);
        if (conflict || !user || where.password_hash !== user.password_hash) return { count: 0 };
        if (data.email && [...users.values()].some(row => row.id !== where.id && row.email === data.email)) throw Object.assign(new Error('duplicate'), { code: 'P2002' });
        writes++; Object.assign(user, data); return { count: 1 };
      },
    },
    userProfile: { upsert: async ({ where, create, update }) => {
      assert.equal(where.userId, 'owner');
      writes++;
      const user = users.get(where.userId);
      user.profile = user.profile ? { ...user.profile, ...update } : { displayName: '', phone: '', bio: '', avatarDataUrl: null, passwordChangedAt: null, ...create };
      return user.profile;
    } },
    $transaction: async run => {
      const snapshot = structuredClone(users);
      try { return await run(prisma); }
      catch (error) { users.clear(); for (const entry of snapshot) users.set(...entry); throw error; }
    },
  };
  function routes(authenticated = true) {
    const imports = {
      'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
      'bcryptjs': bcrypt,
      '@/lib/auth': { getRequestUser: () => authenticated ? { id: 'owner', role } : null },
      '@/lib/db': { prisma }, '@/lib/accountProfile': helpers,
    };
    return { ...load('app/api/account/profile/route.ts', imports), ...load('app/api/account/password/route.ts', imports) };
  }
  return { routes, users, writes: () => writes, conflict: () => { conflict = true; } };
}
const request = (method, body) => new Request('https://test.local/api/account/profile', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const passwordBody = (overrides = {}) => ({ currentPassword: 'original-password', newPassword: 'a-new-password', confirmPassword: 'a-new-password', ...overrides });

test('All profile and password endpoints require authentication', async () => {
  const f = fixture(); const routes = f.routes(false);
  assert.equal((await routes.GET(request('GET'))).status, 401);
  assert.equal((await routes.PATCH(request('PATCH', { displayName: 'Test' }))).status, 401);
  assert.equal((await routes.POST(request('POST', passwordBody()))).status, 401);
  assert.equal(f.writes(), 0);
});

test('Existing users and admins load profiles without a profile row or leaked credentials', async () => {
  for (const role of ['user', 'admin']) {
    const f = fixture(role); const response = await f.routes().GET(request('GET'));
    const body = await response.json();
    assert.equal(body.id, 'owner'); assert.equal(body.role, role); assert.equal(body.avatarDataUrl, null);
    assert.equal(body.displayName, ''); assert.equal(body.email, null);
    assert.equal('password_hash' in body, false);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('Profile edits and avatar removal affect only the authenticated account', async () => {
  const f = fixture(); const otherBefore = structuredClone(f.users.get('other'));
  let response = await f.routes().PATCH(request('PATCH', { displayName: '  Lan  ', phone: '+84 912 345 678', bio: 'Xin chào', avatarDataUrl: null }));
  assert.equal(response.status, 200);
  const body = await response.json(); assert.equal(body.displayName, 'Lan'); assert.equal(body.bio, 'Xin chào');
  assert.deepEqual(f.users.get('other'), otherBefore);
  response = await f.routes().PATCH(request('PATCH', { bio: '' }));
  assert.equal(response.status, 200); assert.equal((await response.json()).displayName, 'Lan');
});

test('Reject attempts to change identity or elevate roles, invalid inputs, JSON and oversized bodies', async () => {
  const f = fixture(); const routes = f.routes();
  for (const body of [{ role: 'admin' }, { id: 'other', displayName: 'Stolen' }, { username: 'admin' }, { displayName: 'a'.repeat(81) }, { phone: 'invalid' }, { email: 'invalid' }, { bio: 10 }, [], null]) {
    assert.equal((await routes.PATCH(request('PATCH', body))).status, 400);
  }
  assert.equal((await routes.PATCH(new Request('https://test.local', { method: 'PATCH', body: '{bad' }))).status, 400);
  assert.equal((await routes.PATCH(request('PATCH', { bio: 'a'.repeat(360_001) }))).status, 400);
  assert.equal(f.writes(), 0);
});

test('Email changes require the current password and enforce uniqueness atomically', async () => {
  const f = fixture(); const routes = f.routes();
  assert.equal((await routes.PATCH(request('PATCH', { email: 'new@example.com' }))).status, 400);
  assert.equal((await routes.PATCH(request('PATCH', { email: 'new@example.com', currentPassword: 'wrong' }))).status, 400);
  const duplicate = await routes.PATCH(request('PATCH', { email: 'other@example.com', displayName: 'Not saved', currentPassword: 'original-password' }));
  assert.equal(duplicate.status, 409); assert.equal(f.users.get('owner').profile, null);
  const response = await routes.PATCH(request('PATCH', { email: ' NEW@Example.com ', currentPassword: 'original-password' }));
  assert.equal(response.status, 200); assert.equal((await response.json()).email, 'new@example.com');
});

test('Raster avatar validation rejects remote URLs, SVG, fake formats and excess bytes', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=';
  assert.equal(helpers.validateAvatar(png), png); assert.equal(helpers.validateAvatar(null), null);
  for (const avatar of ['https://example.com/avatar.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,aGVsbG8=', `data:image/png;base64,${'A'.repeat(350_000)}`, 12]) {
    assert.throws(() => helpers.validateAvatar(avatar), helpers.ProfileInputError);
  }
});

test('Password validation rejects wrong, mismatched, reused and bcrypt-truncated passwords', async () => {
  const f = fixture(); const routes = f.routes();
  for (const body of [passwordBody({ currentPassword: 'wrong' }), passwordBody({ confirmPassword: 'different' }), passwordBody({ newPassword: 'short', confirmPassword: 'short' }), passwordBody({ newPassword: 'original-password', confirmPassword: 'original-password' }), passwordBody({ newPassword: '😀'.repeat(19), confirmPassword: '😀'.repeat(19) }), { ...passwordBody(), userId: 'other' }]) {
    assert.equal((await routes.POST(request('POST', body))).status, 400);
  }
  assert.equal(f.writes(), 0);
});

test('Password changes store a real hash, invalidate the old password and return no hash', async () => {
  const f = fixture('admin');
  const response = await f.routes().POST(request('POST', passwordBody()));
  assert.equal(response.status, 200);
  const hash = f.users.get('owner').password_hash;
  assert.notEqual(hash, 'a-new-password'); assert.equal(await bcrypt.compare('a-new-password', hash), true);
  assert.equal(await bcrypt.compare('original-password', hash), false);
  assert.equal(f.users.get('other').password_hash, originalHash);
  const body = await response.json(); assert.ok(body.passwordChangedAt); assert.equal('password_hash' in body, false);
  assert.equal((await f.routes().GET(request('GET')).then(response => response.json())).passwordChangedAt, body.passwordChangedAt);
});

test('Concurrent credential changes do not overwrite another password or save a stale email', async () => {
  const f = fixture(); f.conflict(); const routes = f.routes();
  assert.equal((await routes.POST(request('POST', passwordBody()))).status, 400);
  assert.equal((await routes.PATCH(request('PATCH', { email: 'new@example.com', currentPassword: 'original-password' }))).status, 400);
  assert.equal(f.users.get('owner').password_hash, originalHash); assert.equal(f.writes(), 0);
});

test('Deleted accounts cannot use an otherwise valid token', async () => {
  const f = fixture(); f.users.delete('owner'); const routes = f.routes();
  assert.equal((await routes.GET(request('GET'))).status, 401);
  assert.equal((await routes.PATCH(request('PATCH', { displayName: 'Test' }))).status, 401);
  assert.equal((await routes.POST(request('POST', passwordBody()))).status, 401);
});
