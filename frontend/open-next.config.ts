import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Account-specific sales and finance APIs do not use the shared incremental cache.
export default defineCloudflareConfig();
