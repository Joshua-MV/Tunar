#!/usr/bin/env node
/**
 * Tunar launcher.
 *   npm.cmd run build      Build the Windows installers for the Microsoft Store.
 *   npm.cmd run open       Open the app. Rebuilds it first whenever the code has changed.
 *   npm.cmd run shortcut   Add "Tunar" to the Start menu (Windows search finds it). It opens the
 *                          app the same way, so it always runs the latest code.
 *   npm.cmd run dev        For editing the code: the app with live reload as you save.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tauriDir = path.join(here, 'src-tauri');
const cargoBin = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin');
const PATH = `${cargoBin}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`;
const env = { ...process.env, PATH, Path: PATH };
const say = (m) => console.log('\x1b[1;35m[tuner]\x1b[0m', m);
const fail = (m) => {
  console.error('\x1b[1;31m[tuner]\x1b[0m', m);
  process.exit(1);
};
const run = (cmd) => {
  const r = spawnSync(cmd, { cwd: here, stdio: 'inherit', shell: true, env });
  if (r.status !== 0) fail(`Command failed: ${cmd}`);
};

if (!existsSync(path.join(here, 'node_modules'))) {
  say('Installing packages (first run only, a few minutes)...');
  run('npm install');
}
const tauri = `node "${path.join(here, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')}"`;
const exe = path.join(tauriDir, 'target', 'release', 'tunar.exe');
const mode = process.argv[2] ?? 'build';

/** Newest change time under the given files/folders (skipping build output). */
function newest(paths) {
  let t = 0;
  const walk = (p) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (!st.isDirectory()) return void (t = Math.max(t, st.mtimeMs));
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (['node_modules', 'target', 'gen', 'dist'].includes(e.name) || e.name.startsWith('.')) continue;
      walk(path.join(p, e.name));
    }
  };
  paths.forEach(walk);
  return t;
}

function buildIfChanged() {
  const sources = [
    ...['app', 'src', 'assets', 'package.json', 'app.json'].map((p) => path.join(here, p)),
    ...['src', 'capabilities', 'icons', 'tauri.conf.json', 'Cargo.toml', 'build.rs'].map((p) => path.join(tauriDir, p)),
  ];
  if (existsSync(exe) && statSync(exe).mtimeMs >= newest(sources)) return;
  say(existsSync(exe) ? 'Tunar changed: updating the app (about a minute)...' : 'Building Tunar for the first time (a few minutes)...');
  run(`${tauri} build --no-bundle`);
}

if (mode === 'open') {
  buildIfChanged();
  say('Opening Tunar...');
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
} else if (mode === 'shortcut') {
  // A "Tunar" entry in the Start menu, so Windows search finds it. It runs this launcher (which
  // updates the app if the code changed, then opens it). If an update fails, the window stays
  // open ("pause") so the error can be read.
  const programs = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  const link = path.join(programs, 'Tunar.lnk');
  const icon = path.join(tauriDir, 'icons', 'icon.ico');
  const args = `/c ""${process.execPath}" "${path.join(here, 'build.mjs')}" open || pause"`;
  const q = (s) => s.replace(/'/g, "''");
  const ps = [
    `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${q(link)}')`,
    `$s.TargetPath = '${q(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'cmd.exe'))}'`,
    `$s.Arguments = '${q(args)}'`,
    `$s.WorkingDirectory = '${q(here)}'`,
    `$s.IconLocation = '${q(icon)}'`,
    `$s.WindowStyle = 7`,
    `$s.Description = 'Tunar: Guitar, Bass & Ukulele'`,
    `$s.Save()`,
  ].join('; ');
  const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
  if (res.status !== 0) fail('Could not create the Start-menu shortcut.');
  say('Added "Tunar" to the Start menu. Search for Tunar to open it.');
} else if (mode === 'dev') {
  run(`${tauri} dev`);
} else {
  say('Building Tunar (a few minutes the first time)...');
  run(`${tauri} build`);
  say(`Done. Installers are in ${path.join(tauriDir, 'target', 'release', 'bundle')}`);
}
