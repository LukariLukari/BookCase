import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const path = relative => new URL(relative, import.meta.url);
const source = path('../branding/billy-cat-v2-original.jpg');
const icons = path('../public/icons/');
await fs.mkdir(icons, { recursive: true });

// Trim excess white canvas for a 1.5x larger mascot; preserve the original artwork.
const crop = { left: 184, top: 168, width: 688, height: 688 };
const png = size => sharp(fileURLToPath(source)).rotate().extract(crop).resize(size, size, { fit: 'contain', background: '#ffffff' }).toColourspace('srgb').png().toBuffer();
const sizes = [16, 32, 48, 64, 180, 192, 512, 1024];
const buffers = new Map();
for (const size of sizes) {
  const buffer = await png(size);
  buffers.set(size, buffer);
  await fs.writeFile(path(`../public/icons/billy-cat-v3-${size}.png`), buffer);
}

// iOS file convention and the conventional URL used by older home-screen clients.
await fs.writeFile(path('../src/app/apple-icon.png'), buffers.get(180));
await fs.writeFile(path('../public/apple-touch-icon.png'), buffers.get(180));
// Keep existing notification URLs working with the same new identity.
for (const size of [192, 512]) await fs.writeFile(path(`../public/icons/billy-${size}.png`), buffers.get(size));

// Leave extra safe margin for launchers that apply a circular mask.
const maskable = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } })
  .composite([{ input: await png(400), left: 56, top: 56 }]).png().toBuffer();
await fs.writeFile(path('../public/icons/billy-cat-v3-maskable-512.png'), maskable);

// An ICO directory containing PNG frames supports small browser tabs and Windows.
const faviconSizes = [16, 32, 48, 64];
// ICO PNG frames must be RGBA for Next.js' image decoder, even with opaque art.
const faviconFrames = await Promise.all(faviconSizes.map(size => sharp(buffers.get(size)).ensureAlpha().png().toBuffer()));
const header = Buffer.alloc(6 + 16 * faviconSizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconSizes.length, 4);
let offset = header.length;
faviconSizes.forEach((size, index) => {
  const frame = faviconFrames[index], entry = 6 + index * 16;
  header[entry] = header[entry + 1] = size;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await fs.writeFile(path('../src/app/favicon.ico'), Buffer.concat([header, ...faviconFrames]));
await fs.writeFile(path('../src/app/opengraph-image.png'), buffers.get(1024));
console.log('Generated Billy cat icons, iOS touch icon, maskable icon, favicon and link preview.');
