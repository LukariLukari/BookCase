import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('# Generate once per environment. Keep these values stable and private.');
console.log(`WEB_PUSH_PUBLIC_KEY=${keys.publicKey}`);
console.log(`WEB_PUSH_PRIVATE_KEY=${keys.privateKey}`);
console.log('WEB_PUSH_SUBJECT=mailto:replace-with-your-real-email@example.com');
console.log(`CRON_SECRET=${randomBytes(32).toString('hex')}`);
