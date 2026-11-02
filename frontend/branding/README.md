# Billy app identity

`billy-cat-v2-original.jpg` is the current artwork supplied by the owner. Use this
as the source for the website, installed web app and future native app icons.
The previous `billy-cat-original.jpg` remains as an archived source.

Regenerate platform assets from the frontend directory:

```sh
node scripts/generate-app-icons.mjs
```

The script preserves the artwork and creates PNGs from 16 to 1024 pixels,
an iOS 180px touch icon, a 512px maskable icon, a multi-size favicon,
and the link preview image. The 1024px PNG is the master export for future
app packaging. Existing notification icon URLs also use this artwork.
The generator crops the excess white canvas to 688px square, making the mascot
approximately 1.5 times larger. The source artwork remains unchanged. The
maskable variant adds safe padding for circular launcher masks. Current public
assets use the `billy-cat-v3-` prefix so clients fetch the enlarged artwork.

The root layout explicitly declares the versioned 180px `apple-touch-icon`.
`src/app/apple-icon.png` and `public/apple-touch-icon.png` provide conventional
fallback routes. Versioned public filenames avoid reusing the old PWA icon
URLs. On Vercel the metadata base uses the deployment's production domain;
set `NEXT_PUBLIC_SITE_URL` when hosting elsewhere. An existing iOS shortcut may need to be
removed and added again after deployment to pick up the new artwork.
