#!/usr/bin/env node
/**
 * Builds Tunar.msix, the package uploaded to the Microsoft Store (Partner Center > Packages).
 *
 *   npm.cmd run msix
 *
 * Why MSIX: the Store signs MSIX packages itself, so no paid code-signing certificate is needed
 * (an .exe/.msi installer would have to be signed by us). The package is NOT signed here, so it
 * can't be installed on this PC by double-clicking: it's only for uploading.
 *
 * Uses the Windows SDK tools (makepri, makeappx). The identity comes from store/identity.json,
 * which must match Partner Center exactly. Each new upload needs a higher version: change
 * "version" in src-tauri/tauri.conf.json (1.0.0 -> 1.0.1). MSIX versions get a 4th part, ".0",
 * which the Store reserves for itself.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = path.join(root, 'src-tauri');
const identity = JSON.parse(readFileSync(path.join(root, 'store', 'identity.json'), 'utf8'));
const conf = JSON.parse(readFileSync(path.join(tauriDir, 'tauri.conf.json'), 'utf8'));
const version = `${conf.version}.0`;
const work = path.join(tauriDir, 'target', 'msix');
const layout = path.join(work, 'layout');
const assets = path.join(layout, 'Assets');
const outDir = path.join(tauriDir, 'target', 'release', 'bundle', 'msix');
const out = path.join(outDir, `Tunar_${version}_x64.msix`);

const cargoBin = path.join(process.env.USERPROFILE ?? '', '.cargo', 'bin');
const PATH = `${cargoBin}${path.delimiter}${process.env.PATH ?? process.env.Path ?? ''}`;
const env = { ...process.env, PATH, Path: PATH };
const say = (m) => console.log('\x1b[1;35m[msix]\x1b[0m', m);
const fail = (m) => {
  console.error('\x1b[1;31m[msix]\x1b[0m', m);
  process.exit(1);
};
const run = (file, args, opts = {}) => {
  const r = spawnSync(file, args, { cwd: root, stdio: 'inherit', env, ...opts });
  if (r.status !== 0) fail(`Failed: ${path.basename(file)} ${args.join(' ')}`);
};
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The newest Windows SDK's x64 tools folder. */
function sdkBin() {
  const base = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!existsSync(base)) fail('The Windows SDK is needed (it provides makeappx). Install it from https://developer.microsoft.com/windows/downloads/windows-sdk/');
  const versions = readdirSync(base).filter((d) => /^10\./.test(d) && existsSync(path.join(base, d, 'x64', 'makeappx.exe'))).sort();
  if (!versions.length) fail('makeappx.exe was not found in the Windows SDK.');
  return path.join(base, versions.at(-1), 'x64');
}

// 1. The app itself (one .exe with the screens built in).
say('Building the app...');
run(process.execPath, [path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'build', '--no-bundle']);
const exe = path.join(tauriDir, 'target', 'release', 'tunar.exe');
if (!existsSync(exe)) fail(`Expected ${exe}`);

rmSync(work, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
copyFileSync(exe, path.join(layout, 'tunar.exe'));

// 2. Icons, from the Y fork artwork. Windows picks the size it needs (taskbar, Start, Store);
//    16 and 24 px use the small artwork (thicker fork, inner waves only).
say('Making icons...');
const tauriJs = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const png = (svg, sizes, dir) => run(process.execPath, [tauriJs, 'icon', path.join(root, 'brand', svg), '-o', dir, '--png', sizes.join(',')], { stdio: 'ignore' });
const full = path.join(work, 'icons-full');
const small = path.join(work, 'icons-small');
png('tuner-icon.svg', [32, 44, 48, 50, 88, 100, 150, 256, 300], full);
png('tuner-icon-small.svg', [16, 24], small);
const put = (dir, size, name) => copyFileSync(path.join(dir, `${size}x${size}.png`), path.join(assets, name));
put(full, 150, 'Square150x150Logo.scale-100.png');
put(full, 300, 'Square150x150Logo.scale-200.png');
put(full, 44, 'Square44x44Logo.scale-100.png');
put(full, 88, 'Square44x44Logo.scale-200.png');
put(full, 50, 'StoreLogo.scale-100.png');
put(full, 100, 'StoreLogo.scale-200.png');
for (const [dir, size] of [[small, 16], [small, 24], [full, 32], [full, 48], [full, 256]]) {
  put(dir, size, `Square44x44Logo.targetsize-${size}.png`);
  put(dir, size, `Square44x44Logo.targetsize-${size}_altform-unplated.png`);
}

// 3. The manifest: who made it, what it's called, and that it uses the microphone.
const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">
  <Identity Name="${xml(identity.name)}" Publisher="${xml(identity.publisher)}" Version="${version}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>${xml(identity.displayName)}</DisplayName>
    <PublisherDisplayName>${xml(identity.publisherDisplayName)}</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
  </Resources>
  <Applications>
    <Application Id="Tunar" Executable="tunar.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="${xml(identity.displayName)}"
        Description="${xml(identity.description)}"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png" />
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
    <DeviceCapability Name="microphone" />
  </Capabilities>
</Package>
`;
writeFileSync(path.join(layout, 'AppxManifest.xml'), manifest);

// 4. resources.pri lets Windows find the right icon size; then pack it all into the .msix.
const bin = sdkBin();
say('Packing...');
const priConfig = path.join(work, 'priconfig.xml');
run(path.join(bin, 'makepri.exe'), ['createconfig', '/cf', priConfig, '/dq', 'en-US', '/pv', '10.0.0', '/o'], { stdio: 'ignore' });
run(path.join(bin, 'makepri.exe'), ['new', '/pr', layout, '/cf', priConfig, '/mn', path.join(layout, 'AppxManifest.xml'), '/of', path.join(work, 'resources.pri'), '/o'], { stdio: 'ignore' });
renameSync(path.join(work, 'resources.pri'), path.join(layout, 'resources.pri'));
mkdirSync(outDir, { recursive: true });
run(path.join(bin, 'makeappx.exe'), ['pack', '/d', layout, '/p', out, '/o'], { stdio: 'ignore' });

say(`Done: ${out}`);
say('Upload this file in Partner Center > Tunar > your submission > Packages.');
