# Tunar

A guitar, bass and ukulele tuner for Windows, made from Riffly's tuner.

- **App name:** Tunar
- **Store title:** "Tunar: Guitar, Bass & Ukulele". The words guitar, bass and ukulele help people searching for a tuner find it.
- **Logo:** the Y fork, a tuning fork whose arms curve into a Y with amber sound waves. The
  artwork is in `brand/`: `tuner-icon.svg` (32 px and up) and `tuner-icon-small.svg` (16 and
  24 px: a thicker fork with only the inner waves). Amber is only ever the waves, never the fork.

It's a separate copy of the tuner code (in `src/`), so changes to Riffly's tuner don't reach
it automatically.

## Change the icon

Edit the SVGs in `brand/`, then run:

```
npx tauri icon brand/tuner-icon.svg
```

That replaces every size, including the Store logos. Then rebuild `icon.ico` so the small sizes
use the small artwork (see the comment at the top of `brand/make-ico.mjs`).

## Build

```
npm.cmd run build
```

The installers end up in `src-tauri/target/release/bundle/`:

- `nsis/Tunar_1.0.0_x64-setup.exe` (use this one for the Store)
- `msi/Tunar_1.0.0_x64_en-US.msi`

The installer includes WebView2 offline and installs for all users. The Store needs both.

`npm.cmd run open` opens the app without installing it.

## Ship it to the Microsoft Store

1. Sign up at https://partner.microsoft.com/dashboard (individual developer accounts are free).
2. **Apps and games → New product → MSI or EXE app**, then reserve the name **Tunar: Guitar, Bass & Ukulele**.
3. Upload the `-setup.exe` somewhere with a public **https** link that won't change, such as a
   GitHub Release. The Store downloads the installer from that link.
4. In **Packages**, paste the link, set the architecture to x64 and the silent install switch to `/S`.
5. Fill in the Store listing: description, at least one screenshot, the category (Music) and a
   privacy policy link. The app listens to the microphone but records and sends nothing.
6. Set the price to Free and submit. Certification usually takes 1–3 business days.

Every update needs a new version number (in `tauri.conf.json` and `Cargo.toml`) and a new
download link.
