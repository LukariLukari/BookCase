import test from 'node:test';
import assert from 'node:assert/strict';
import { runSubscriptionSchedule } from '../cloudflare/scheduled.mjs';

test('Scheduled reminders use only the internal binding and require their secret', async () => {
  await assert.rejects(runSubscriptionSchedule({}), /not configured/);
  let called = 0;
  const env = { CRON_SECRET: 'test-only-secret', WORKER_SELF_REFERENCE: { fetch: async request => {
    called++;
    assert.equal(new URL(request.url).pathname, '/api/cron/subscription-reminders');
    assert.equal(request.headers.get('authorization'), 'Bearer test-only-secret');
    assert.equal(request.method, 'GET');
    return Response.json({ sent: 0 });
  } } };
  await runSubscriptionSchedule(env);
  assert.equal(called, 1);
  env.WORKER_SELF_REFERENCE.fetch = async () => new Response('private provider failure', { status: 503 });
  await assert.rejects(runSubscriptionSchedule(env), error => {
    assert.match(error.message, /503/);
    assert.doesNotMatch(error.message, /private|test-only-secret/);
    return true;
  });
});
