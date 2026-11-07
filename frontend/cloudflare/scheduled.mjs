// Keep the scheduler small; the service binding runs the existing authenticated
// reminder dispatcher with its own request context and database connections.
export async function runSubscriptionSchedule(env) {
  if (!env.CRON_SECRET || !env.WORKER_SELF_REFERENCE) {
    throw new Error('Subscription reminder scheduler is not configured');
  }
  const response = await env.WORKER_SELF_REFERENCE.fetch(new Request(
    'https://billy.internal/api/cron/subscription-reminders',
    { headers: { Authorization: `Bearer ${env.CRON_SECRET}` } },
  ));
  // Consume the response without logging private headers, endpoints or errors.
  await response.arrayBuffer();
  if (!response.ok) throw new Error(`Subscription reminder dispatch failed (${response.status})`);
}
