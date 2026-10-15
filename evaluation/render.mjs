// Optional offline regeneration: sharp is already included by Next.js in the lockfile.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
const dataset = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
for (const receipt of dataset.receipts) {
  const lines = readFileSync(new URL(receipt.transcript, import.meta.url), 'utf8').trimEnd().split('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="${80 + lines.length * 36}"><rect width="100%" height="100%" fill="white"/>${lines.map((line,i) => `<text x="24" y="${48+i*36}" font-family="monospace" font-size="22" fill="black">${escape(line)}</text>`).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(new URL(receipt.image, import.meta.url).pathname);
}
