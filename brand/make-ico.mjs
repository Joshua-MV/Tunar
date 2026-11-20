#!/usr/bin/env node
/**
 * Builds icon.ico with the right artwork per size: the small Y fork (thicker, inner waves only)
 * at 16 and 24 px, the full icon from 32 px up. Each size is a PNG stored inside the .ico.
 *
 *   node brand/make-ico.mjs <out.ico> <16.png> <24.png> <32.png> <48.png> <64.png> <256.png>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [out, ...pngs] = process.argv.slice(2);
const images = pngs.map((p) => {
  const data = readFileSync(p);
  return { data, width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
});
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + 16 * images.length;
const entries = images.map(({ data, width, height }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(width >= 256 ? 0 : width, 0);
  e.writeUInt8(height >= 256 ? 0 : height, 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(data.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync(out, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]));
console.log(`Wrote ${out} (${images.map((i) => i.width).join(', ')} px)`);
