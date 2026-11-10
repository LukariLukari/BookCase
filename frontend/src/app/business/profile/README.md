# Personal profiles

`/business/profile` is shared by users and admins. The desktop sidebar, mobile
avatar/menu, and admin navigation link to it. Endpoints always derive the owner
from the signed token, never from a submitted user ID or role.

## Database rollout

Generate the Prisma client during the normal build. Before serving this feature,
apply `prisma/patches/2026-11-10-user-profile.sql` to the deployment database, or use
the existing schema synchronization workflow (`build:vercel` runs `prisma db push`).
The patch adds only the optional `UserProfile` table. Existing account rows and
credentials are preserved. No live database is modified by the test suite.

Avatars are cropped/re-encoded to 256 × 256 WebP in the browser and stored as
bounded raster data URLs in the profile. The API also accepts PNG/JPEG, validates
their signatures and caps decoded bytes at 256 KB. Original uploads are not kept.
This avoids requiring a new public bucket for private avatars.

Email changes require the current password; emails are not marked as verified.
Changing a password replaces its bcrypt hash but does not revoke existing JWTs.
Session revocation, email verification and two-factor authentication are separate
follow-up features.

Validation: `npm run test:profile`, TypeScript checking and ESLint on changed files.
