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

- [ ] Build APK (PWA / WebView wrapper)
- [ ] Export/import CSV
- [ ] Budget per kategori
