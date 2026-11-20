#!/usr/bin/env node
/**
 * Renders the Microsoft Store art (art.html) to PNG with Microsoft Edge in headless mode.
 *
 *   node brand/store-art/render.mjs
 *
 * Writes poster-art-1440x2160.png (9:16 poster art) and box-art-2160x2160.png (1:1 box art)
 * next to this file. Upload them in Partner Center > Store listings > Store logos.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const edge = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);
if (!edge) throw new Error('Microsoft Edge was not found.');

const page = pathToFileURL(path.join(here, 'art.html')).href;
const profile = mkdtempSync(path.join(os.tmpdir(), 'tunar-art-'));
for (const [layout, w, h, file] of [
  ['poster', 1440, 2160, 'poster-art-1440x2160.png'],
  ['box', 2160, 2160, 'box-art-2160x2160.png'],
]) {
  const out = path.join(here, file);
  const r = spawnSync(edge, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--user-data-dir=${profile}`, '--virtual-time-budget=3000', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, `--screenshot=${out}`, `${page}?layout=${layout}`,
  ], { stdio: 'ignore' });
  if (r.status !== 0 || !existsSync(out)) throw new Error(`Rendering ${file} failed`);
  console.log(`Wrote ${out}`);
}
rmSync(profile, { recursive: true, force: true });
