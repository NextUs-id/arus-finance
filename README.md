# Arus 💸

**Tau uangmu ke mana.**

Aplikasi pencatat keuangan pribadi — vanilla HTML/CSS/JS, data tersimpan di
localStorage (100% offline, tanpa server).

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

## Tech

- Vanilla JS (tanpa framework, tanpa build step)
- localStorage
- CSS custom properties
- Font: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (self-hosted, OFL license)

## Roadmap

- [ ] Build APK (PWA / WebView wrapper)
- [ ] Export/import CSV
- [ ] Budget per kategori
