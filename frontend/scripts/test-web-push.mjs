/* No real database, push service, environment secrets or device is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import webpush from 'web-push';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(file, imports = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  }, Date, Intl, URL, Buffer, TextEncoder, Set, Map, console: { error() {} }, ...globals }, { filename: file });
  return exports;
}
const util = load('src/lib/subscriptions.ts');
const reminders = load('src/lib/subscriptionReminders.ts', { './subscriptions': util });
class SubscriptionError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const response = (value, options = {}) => new Response(JSON.stringify(value), { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
const next = { NextResponse: { json: response } };
const subscriptionServer = { SubscriptionError, subscriptionUnauthorized: () => response({ detail: 'Unauthorized' }, { status: 401 }) };
const keys = webpush.generateVAPIDKeys();
const env = () => ({ WEB_PUSH_PUBLIC_KEY: keys.publicKey, WEB_PUSH_PRIVATE_KEY: keys.privateKey, WEB_PUSH_SUBJECT: 'mailto:owner@example.com', CRON_SECRET: 'test-cron-secret' });
const deviceKeys = { p256dh: crypto.createECDH('prime256v1').generateKeys().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') };
const registration = (name = 'one', daysBefore = 3) => ({ subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/${name}`, keys: deviceKeys }, daysBefore });

const equal = (a, b) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'AND') return value.every(part => matches(row, part));
    if (key === 'OR') return value.some(part => matches(row, part));
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).every(([operator, operand]) => {
      if (operator === 'gt') return row[key] > operand;
      if (operator === 'lt') return row[key] < operand;
      if (operator === 'lte') return row[key] <= operand;
      if (operator === 'not') return !equal(row[key], operand);
      throw new Error(`Unexpected operator ${operator}`);
    });
    return equal(row[key], value);
  });
}
function fixture(environment = env()) {
  let devices = [], sequence = 0;
  const plans = [], sent = [];
  const failures = new Map();
  const model = {
    findUnique: async ({ where }) => devices.find(row => matches(row, where)) || null,
    findFirst: async ({ where }) => devices.find(row => matches(row, where)) || null,
    findMany: async ({ where, take }) => devices.filter(row => matches(row, where)).sort((a, b) => a.id.localeCompare(b.id)).slice(0, take),
    count: async ({ where }) => devices.filter(row => matches(row, where)).length,
    upsert: async ({ where, create, update }) => {
      const existing = devices.find(row => matches(row, where));
      if (existing) { Object.assign(existing, update, { updatedAt: new Date() }); return existing; }
      const row = { id: `device-${String(++sequence).padStart(3, '0')}`, lastSentDate: null, lockedUntil: null, lastTestAt: null, updatedAt: new Date(), ...create };
      devices.push(row); return row;
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      devices = devices.map(row => matches(row, where) ? (count++, { ...row, ...data, updatedAt: new Date() }) : row);
      return { count };
    },
    deleteMany: async ({ where }) => { const before = devices.length; devices = devices.filter(row => !matches(row, where)); return { count: before - devices.length }; },
  };
  const prisma = { subscriptionPushDevice: model, customerSubscription: { count: async ({ where }) => plans.filter(row => matches(row, where)).length } };
  const sender = { ...webpush, sendNotification: async (subscription, payload, options) => {
    const status = failures.get(subscription.endpoint);
    if (status) throw { statusCode: status };
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload), options });
  } };
  const server = load('src/lib/webPushServer.ts', { 'node:crypto': crypto, 'web-push': sender, './db': { prisma }, './subscriptions': util, './subscriptionReminders': reminders, './subscriptionServer': subscriptionServer }, { process: { env: environment } });
  const auth = { getRequestUser: request => ['alice', 'bob'].includes(request.headers.get('authorization')?.slice(7)) ? { id: request.headers.get('authorization').slice(7) } : null };
  const api = load('src/app/api/sales/subscriptions/push/route.ts', { 'next/server': next, '@/lib/auth': auth, '@/lib/db': { prisma }, '@/lib/subscriptionServer': subscriptionServer, '@/lib/webPushServer': server });
  const cron = load('src/app/api/cron/subscription-reminders/route.ts', { 'node:crypto': crypto, 'next/server': next, '@/lib/webPushServer': server, '@/lib/subscriptionServer': subscriptionServer }, { process: { env: environment } });
  const request = (method, data, user = 'alice') => new Request('https://billy.example/api/sales/subscriptions/push', { method, headers: user ? { Authorization: `Bearer ${user}` } : {}, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const enroll = async (name = 'one', user = 'alice', days = 3) => { const result = await api.PUT(request('PUT', registration(name, days), user)); assert.equal(result.status, 200, await result.clone().text()); return devices.find(row => row.endpoint.endsWith(`/${name}`)); };
  return { server, api, cron, request, enroll, devices: () => devices, plans, sent, failures };
}

test('Endpoint validation rejects SSRF, credentials, lookalikes and non-provider URLs', () => {
  const { server } = fixture();
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://fcm.googleapis.com.evil.test/x', 'https://evil.push.apple.com.evil.test/x', 'https://name:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'file:///etc/passwd', 'https://fcm.googleapis.com/x#fragment']) assert.throws(() => server.validatePushEndpoint(endpoint));
  for (const endpoint of ['https://fcm.googleapis.com/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2.notify.windows.com/x']) assert.equal(server.validatePushEndpoint(endpoint), endpoint);
  assert.throws(() => server.validatePushRegistration({ ...registration(), daysBefore: -1 }));
  assert.throws(() => server.validatePushRegistration({ ...registration(), subscription: { endpoint: registration().subscription.endpoint, keys: { auth: 'bad', p256dh: 'bad' } } }));
});

test('All device methods require authentication; config only exposes the public key', async () => {
  const { api, request } = fixture();
  for (const method of ['GET', 'PUT', 'POST', 'DELETE']) assert.equal((await api[method](request(method, method === 'GET' ? undefined : {}, ''))).status, 401);
  const result = await api.GET(request('GET'));
  assert.deepEqual(await result.json(), { publicKey: keys.publicKey });
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal((await fixture({}).api.GET(request('GET'))).status, 503);
  const mismatched = { ...env(), WEB_PUSH_PRIVATE_KEY: webpush.generateVAPIDKeys().privateKey };
  assert.equal((await fixture(mismatched).api.GET(request('GET'))).status, 503);
});

test('Registration validates input, updates settings and scopes status/test/delete to the owner', async () => {
  const { api, request, enroll, devices } = fixture();
  const device = await enroll();
  await enroll('one', 'alice', 7);
  assert.equal(devices().length, 1);
  assert.equal(devices()[0].daysBefore, 7);
  const body = { endpoint: device.endpoint, action: 'status' };
  assert.equal((await api.POST(request('POST', body, 'bob')).then(r => r.json())).enabled, false);
  assert.equal((await api.POST(request('POST', { ...body, action: 'test' }, 'bob'))).status, 404);
  await api.DELETE(request('DELETE', body, 'bob'));
  assert.equal(devices().length, 1);
  assert.equal((await api.PUT(request('PUT', { ...registration(), subscription: { ...registration().subscription, keys: { ...deviceKeys, auth: crypto.randomBytes(16).toString('base64url') } } }))).status, 409);
  await api.DELETE(request('DELETE', body));
  assert.equal(devices().length, 0);
  assert.equal((await api.PUT(request('PUT', { ...registration(), daysBefore: '3' }))).status, 400);
});

test('Test notifications use the server and are rate limited; dead endpoints are removed', async () => {
  const { api, request, enroll, sent, failures, devices } = fixture();
  const device = await enroll();
  const body = { action: 'test', endpoint: device.endpoint };
  assert.equal((await api.POST(request('POST', body))).status, 200);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.TTL, 300);
  assert.equal((await api.POST(request('POST', body))).status, 429);
  const dead = await enroll('dead'); failures.set(dead.endpoint, 410);
  assert.equal((await api.POST(request('POST', { ...body, endpoint: dead.endpoint }))).status, 410);
  assert.equal(devices().length, 1);
});

test('Daily dispatch includes lead dates/overdue, ignores processed plans and isolates users', async () => {
  const { enroll, plans, server, sent } = fixture();
  await enroll(); await enroll('bob-device', 'bob');
  plans.push(...[
    ['active', '2026-11-01'], ['active', '2026-11-04'], ['active', '2026-10-01'],
    ['active', '2026-11-05'], ['cancelled', '2026-11-01'], ['renewed', '2026-11-01'],
  ].map(([status, date]) => ({ userId: 'alice', status, cancelDate: new Date(`${date}T00:00:00Z`) })));
  const result = await server.dispatchSubscriptionPush(new Date('2026-11-01T02:00:00Z'));
  assert.equal(result.sent, 1);
  assert.equal(sent.length, 1);
  assert.match(sent[0].payload.body, /Có 3 gói/);
  assert.equal(sent[0].options.TTL, 86400);
  assert.equal((await server.dispatchSubscriptionPush(new Date('2026-11-01T03:00:00Z'))).sent, 0);
  assert.equal((await server.dispatchSubscriptionPush(new Date('2026-11-02T02:00:00Z'))).sent, 1);
});

test('Overlapping cron runs lease a device once; transient errors release leases for retry', async () => {
  const { enroll, plans, server, sent, failures, devices } = fixture();
  const device = await enroll();
  plans.push({ userId: 'alice', status: 'active', cancelDate: new Date('2026-11-01T00:00:00Z') });
  const now = new Date('2026-11-01T02:00:00Z');
  failures.set(device.endpoint, 503);
  assert.equal((await server.dispatchSubscriptionPush(now)).failed, 1);
  assert.equal(devices()[0].lockedUntil, null);
  assert.equal(devices()[0].lastSentDate, null);
  failures.clear();
  await Promise.all([server.dispatchSubscriptionPush(now), server.dispatchSubscriptionPush(now)]);
  assert.equal(sent.length, 1);
  assert.equal(devices()[0].lastSentDate, '2026-11-01');
});

test('Expired cron registrations are deleted and the cron secret is mandatory', async () => {
  const { enroll, plans, server, failures, devices, cron } = fixture();
  const device = await enroll(); failures.set(device.endpoint, 404);
  plans.push({ userId: 'alice', status: 'active', cancelDate: new Date('2026-11-01T00:00:00Z') });
  assert.equal((await server.dispatchSubscriptionPush(new Date('2026-11-01T02:00:00Z'))).expired, 1);
  assert.equal(devices().length, 0);
  const req = secret => new Request('https://billy.example/api/cron/subscription-reminders', { headers: { Authorization: `Bearer ${secret}` } });
  assert.equal((await cron.GET(req('wrong'))).status, 401);
  assert.equal((await cron.GET(req('test-cron-secret'))).status, 200);
  assert.equal((await fixture({ ...env(), CRON_SECRET: '' }).cron.GET(req(''))).status, 401);
});

test('Service worker handles push/fallback and never follows a URL supplied in a push', async () => {
  const handlers = {}, shown = [], opened = [];
  vm.runInNewContext(fs.readFileSync(path.join(root, 'public/subscription-reminders-sw.js'), 'utf8'), { URL, self: {
    location: { origin: 'https://billy.example' }, addEventListener: (name, handler) => { handlers[name] = handler; },
    registration: { showNotification: async (...args) => { shown.push(args); } },
    clients: { matchAll: async () => [], openWindow: url => { opened.push(url); } },
  } });
  for (const data of [{ json: () => ({ title: 'Reminder', body: 'Body', url: 'https://evil.test' }) }, { json: () => { throw new Error(); } }, null]) {
    let pending;
    handlers.push({ data, waitUntil: promise => { pending = promise; } }); await pending;
  }
  assert.equal(shown.length, 3);
  assert.equal(shown[0][0], 'Reminder');
  assert.equal(shown[1][0], 'Billy · Nhắc hủy gói');
  let pending;
  handlers.notificationclick({ notification: { close() {} }, waitUntil: promise => { pending = promise; } }); await pending;
  assert.deepEqual(opened, ['https://billy.example/business/subscriptions']);
});

test('Logout revokes the browser subscription even if server deletion fails', async () => {
  let unsubscribed = false;
  const client = load('src/lib/webPushClient.ts', {}, {
    navigator: { serviceWorker: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ endpoint: registration().subscription.endpoint, unsubscribe: async () => { unsubscribed = true; } }) } }) } },
    fetch: async () => new Response(JSON.stringify({ detail: 'Offline' }), { status: 503 }), AbortSignal,
  });
  await assert.rejects(client.stopDevicePush('alice'));
  assert.equal(unsubscribed, true);
});
