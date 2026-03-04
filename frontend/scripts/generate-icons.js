import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcPath = resolve(__dirname, '../public/comanda_icon.png');
const outDir = resolve(__dirname, '../public/icons');

const srcBuffer = readFileSync(srcPath);

const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon-180x180.png', size: 180 },
];

for (const { name, size } of sizes) {
  await sharp(srcBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, name));
  console.log(`Generated ${name}`);
}

console.log('Done!');
