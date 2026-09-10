# Arus 💸

**Tau uangmu ke mana.**

Aplikasi pencatat keuangan pribadi — vanilla HTML/CSS/JS, data tersimpan di
localStorage (100% offline, tanpa server).

> 📱 **Dibuat khusus untuk HP** (mobile-first). Di laptop tetap bisa dipakai:
> konten tampil sebagai kolom mobile ter-center (max-width 720px), atau pakai
> **DevTools device emulation** (F12 → toggle device toolbar / `Ctrl+Shift+M`)
> untuk simulasi layar HP.

## Fitur

- 📊 **Dashboard**: saldo kumulatif + tren saldo (garis) & pengeluaran/pemasukan (bar)
- 🗓️ **Rentang waktu**: 1W / 1M / 3M / 6M / 1Y / 3Y / ALL
- 🌙 **Dark mode** native (mobile-first)
- 💳 **Format Rupiah (IDR)** & Plus Jakarta Sans self-hosted
- 🔒 **Privasi**: semua data cuma di browser kamu

## Cara pakai

Buka `index.html` di browser, atau serve secara lokal:

```bash
python3 -m http.server 8080
```

Di **HP**: buka file/serve di jaringan lokal, atau (nanti) install via APK.
Di **laptop**: buka langsung — kolom mobile ter-center; atau pakai DevTools
device emulation (`Ctrl+Shift+M`) biar persis kayak di HP.

## Tech

- Vanilla JS (tanpa framework, tanpa build step)
- localStorage
- CSS custom properties
- Font: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (self-hosted, OFL license)

## Roadmap

- [x] Build APK (WebView wrapper, tanpa Gradle — lihat `build.sh` + `app/`)
- [ ] Export/import CSV
- [ ] Budget per kategori

## Build APK

Web di root (`index.html`, `app.js`, `styles.css`, `fonts/`) adalah sumber utama.
`build.sh` otomatis sync ke `app/src/main/assets/` lalu build via `aapt2`/`javac`/`d8`.

```bash
# siapkan Android SDK (atau set ANDROID_SDK_ROOT)
export ANDROID_SDK_ROOT=/path/ke/Android_SDK
./build.sh
```

Hasil: `Arus.apk` (jangan commit — rilis via GitHub Releases).
Keystore (`*.keystore`) jangan commit ke publik.
