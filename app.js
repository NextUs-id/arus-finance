/* ============ ARUS — app logic ============ */
"use strict";

const LS_KEY = "arus.v1";
const CATS_OUT = [
  { id: "makan",    label: "Makan",     color: "#C0602E" },
  { id: "transport",label: "Transport", color: "#2F6FA3" },
  { id: "kos",      label: "Kos & Tagihan", color: "#7A5AA8" },
  { id: "belanja",  label: "Belanja",   color: "#B08A2E" },
  { id: "nongkrong",label: "Nongkrong", color: "#B24A63" },
  { id: "kuota",    label: "Kuota",        color: "#3C8A6E" },
  { id: "kesehatan",label: "Kesehatan", color: "#4F7A3F" },
  { id: "lainnya",  label: "Lainnya",   color: "#8A7F72" },
];
const CATS_IN = [
  { id: "gaji",     label: "Gaji",      color: "#17785B" },
  { id: "freelance",label: "Freelance", color: "#2F6FA3" },
  { id: "bonus",    label: "Bonus",     color: "#B08A2E" },
  { id: "lainnya",  label: "Lainnya",   color: "#7A5AA8" },
];
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const $ = (s) => document.querySelector(s);
const state = { tx: [], theme: null, view: "dash", f: { month: "all", type: "all", cat: "all", range: "6M", dr: null }, draft: { type: "out", cat: null, id: null }, settings: { askDelete: true, target: 20 }, profile: null, pendingDel: { ids: [], timers: {} } };

/* ---------- storage ---------- */
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.tx)) state.tx = d.tx;
    if (d.theme === "dark" || d.theme === "light") state.theme = d.theme;
    if (d.settings && typeof d.settings.askDelete === "boolean") state.settings.askDelete = d.settings.askDelete;
    if (d.settings && typeof d.settings.target === "number") state.settings.target = d.settings.target;
    if (d.profile && typeof d.profile.name === "string") state.profile = d.profile;
  } catch (e) { console.warn("load failed", e); }
}
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify({ tx: state.tx, theme: state.theme, settings: state.settings }));
}

/* ---------- helpers ---------- */
const fmtIDR = (n) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.round(n));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => d.slice(0, 7);
const monthLabel = (mk) => { const [y, m] = mk.split("-").map(Number); return MONTHS[m - 1] + " " + y; };
const fmtDate = (d) => { const [y, m, dd] = d.split("-").map(Number); return dd + " " + MONTHS[m - 1] + " " + y; };
const catOf = (t) => (t.type === "in" ? CATS_IN : CATS_OUT).find((c) => c.id === t.cat) || CATS_OUT[CATS_OUT.length - 1];
function lastMonths(n) {
  const out = []; const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) { out.unshift(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  return out;
}
function totalsOf(mk) {
  const tx = state.tx.filter((t) => monthKey(t.date) === mk);
  let inSum = 0, outSum = 0;
  tx.forEach((t) => (t.type === "in" ? (inSum += t.amount) : (outSum += t.amount)));
  return { inSum, outSum, count: tx.length };
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- views ---------- */
const VIEWS = ["dash", "history", "settings", "profile"];
function goto(view) {
  state.view = view;
  VIEWS.forEach((v) => ($("#view-" + v).hidden = v !== view));
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.goto === view));
  if (view === "history") buildMonthOptions();
  render();
  window.scrollTo({ top: 0 });
}

/* ---------- render: dashboard ---------- */
function render() {
  if (state.view === "dash") renderDash();
  else if (state.view === "history") renderHistory();
  else if (state.view === "profile") renderProfile();
  else renderSettings();
}

function renderDash() {
  const cur = monthKey(today());
  const prev = lastMonths(2)[0];
  const c = totalsOf(cur), p = totalsOf(prev);
  const saldo = state.tx.reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
  const mNet = c.inSum - c.outSum;

  const firstTx = state.tx.reduce((a, t) => (t.date < a ? t.date : a), today());
  $("#saldoPeriod").textContent = state.tx.length ? "Sejak " + monthLabel(monthKey(firstTx)) : "Belum ada";
  $("#saldoNum").textContent = fmtIDR(saldo);
  $("#saldoNum").classList.toggle("neg", saldo < 0);
  const sub = $("#saldoSub");
  if (c.count === 0) {
    sub.textContent = "Belum ada transaksi bulan ini";
    sub.classList.remove("warn");
  } else if (mNet < 0) {
    sub.textContent = "Bulan ini \u2212" + fmtIDR(Math.abs(mNet)) + " \u2014 pengeluaran melebihi pemasukan";
    sub.classList.add("warn");
  } else {
    sub.textContent = "Bulan ini +" + fmtIDR(mNet) + " (" + fmtIDR(c.inSum) + " masuk \u00b7 " + fmtIDR(c.outSum) + " keluar)";
    sub.classList.remove("warn");
  }

  $("#statIn").textContent = fmtIDR(c.inSum);
  $("#statOut").textContent = fmtIDR(c.outSum);
  $("#deltaIn").innerHTML = deltaHtml(c.inSum, p.inSum);
  $("#deltaOut").innerHTML = deltaHtml(c.outSum, p.outSum);

  const rate = c.inSum > 0 ? Math.max(0, Math.round(((c.inSum - c.outSum) / c.inSum) * 100)) : 0;
  $("#savingsRate").textContent = rate + "%";
  $("#savingsBar").style.width = rate + "%";
  const hint = c.inSum === 0
    ? "Catat pemasukan dulu buat lihat persentase tabungan."
    : rate >= 20 ? "Mantap, di atas target 20%!"
    : rate > 0 ? "Masih di bawah target 20%. Coba tekan pengeluaran nongkrong."
    : "Bulan ini pengeluaranmu melebihi pemasukan. Waspada!";
  const h = $("#savingsHint");
  h.textContent = hint;
  h.className = "hint" + (c.inSum > 0 && rate < 20 ? " warn" : rate >= 20 ? " good" : "");

  renderDonut(cur);
  const { from, to } = rangeWindow(state.f.range);
  renderRangeChips();
  renderLineChart(from, to);
  renderBars();
  renderRecent();

  const empty = state.tx.length === 0;
  $("#emptyState").hidden = !empty;
  $("#dashMeta").hidden = empty;
}

function deltaHtml(cur, prev) {
  if (prev === 0) return '<span class="muted">(belum ada bulan lalu)</span>';
  const diff = cur - prev;
  const pct = Math.round((diff / prev) * 100);
  const cls = diff >= 0 ? "up" : "down";
  const arrow = diff >= 0 ? "▲" : "▼";
  return '<span class="' + cls + '">' + arrow + " " + Math.abs(pct) + "%</span> vs bulan lalu";
}

function renderDonut(mk) {
  const wrap = $("#donutWrap");
  const legend = $("#donutLegend");
  const out = state.tx.filter((t) => t.type === "out" && monthKey(t.date) === mk);
  const byCat = {};
  out.forEach((t) => (byCat[t.cat] = (byCat[t.cat] || 0) + t.amount));
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);

  if (total === 0) {
    wrap.innerHTML = '<p class="hint" style="padding:26px 0;text-align:center">Belum ada pengeluaran bulan ini.</p>';
    legend.innerHTML = "";
    return;
  }
  const R = 66, CIRC = 2 * Math.PI * R;
  let acc = 0;
  const segs = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  let svg = '<div style="position:relative;display:grid;place-items:center">';
  svg += '<svg viewBox="0 0 160 160"><circle cx="80" cy="80" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="26"/>';
  segs.forEach(([cid, amt]) => {
    const c = catOf({ type: "out", cat: cid });
    const frac = amt / total;
    const dash = Math.max(frac * CIRC - 1.2, 0.5);
    svg += '<circle cx="80" cy="80" r="' + R + '" fill="none" stroke="' + c.color + '" stroke-width="26" stroke-dasharray="' + dash.toFixed(2) + " " + (CIRC + 1).toFixed(2) + '" stroke-dashoffset="' + (-acc * CIRC).toFixed(2) + '" stroke-linecap="butt"/>';
    acc += frac;
  });
  svg += "</svg>";
  svg += '<div class="donut-center"><div class="dc-label">Total keluar</div><div class="dc-num">' + fmtIDR(total) + "</div></div></div>";
  wrap.innerHTML = svg;

  legend.innerHTML = segs.map(([cid, amt]) => {
    const c = catOf({ type: "out", cat: cid });
    const pct = Math.round((amt / total) * 100);
    return '<div class="legend-row"><span class="legend-swatch" style="background:' + c.color + '"></span><span class="legend-label">' + c.label + '</span><span class="legend-val">' + fmtIDR(amt) + '</span><span class="legend-pct">' + pct + "%</span></div>";
  }).join("");
}

let barOpenMk = null;
function closeBarPop() {
  barOpenMk = null;
  const pop = $("#barPop");
  closeWithAnim(pop, 170, () => {
    pop.style.left = "";
    pop.style.top = "";
  });
  document.querySelectorAll(".mb-col").forEach((c) => c.classList.remove("selected"));
}
function showBarPop(mk, colEl) {
  const b = curBuckets.find((x) => x.key === mk);
  if (!b) return;
  const t = { inSum: b.inSum, outSum: b.outSum, count: b.count };
  const isMonth = /^\d{4}-\d{2}$/.test(mk);
  const net = t.inSum - t.outSum;
  $("#barPop").innerHTML =
    '<div class="bar-pop-title">' + esc(b.label) + "</div>" +
    '<div class="bar-pop-row pos"><span>Pemasukan</span><b>+' + fmtIDR(t.inSum) + "</b></div>" +
    '<div class="bar-pop-row neg"><span>Pengeluaran</span><b>&minus;' + fmtIDR(t.outSum) + "</b></div>" +
    '<div class="bar-pop-row ' + (net >= 0 ? "pos" : "neg") + '"><span>Selisih</span><b>' + (net >= 0 ? "+" : "&minus;") + fmtIDR(Math.abs(net)) + "</b></div>" +
    '<button class="btn ghost block" id="barDrill">' + (isMonth ? "Lihat transaksi bulan ini" : "Lihat transaksi periode ini") + "</button>";
  const pop = $("#barPop");
  cancelCloseAnim(pop);
  pop.hidden = false;
  const cr = colEl.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  let left = cr.left + cr.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, innerWidth - pw - 8));
  let top = cr.top - ph - 10;
  if (top < 8) top = cr.bottom + 10;
  top = Math.max(8, Math.min(top, innerHeight - ph - 8));
  pop.style.left = left + "px";
  pop.style.top = top + "px";
  barOpenMk = mk;
  document.querySelectorAll(".mb-col").forEach((c) => c.classList.toggle("selected", c.dataset.mk === mk));
  pop.querySelector("#barDrill").onclick = () => {
    state.f.type = "all"; state.f.cat = "all";
    if (isMonth) { state.f.month = mk; state.f.dr = null; }
    else { state.f.month = "all"; state.f.dr = { from: b.from, to: b.to }; }
    syncDdLabels(); buildMonthOptions();
    goto("history");
  };
}
/* ---------- rekap: rentang waktu + tren saldo + batang adaptif ---------- */
const RANGES = [
  { k: "1W", label: "1 Mg" },
  { k: "1M", label: "1 Bln" },
  { k: "3M", label: "3 Bln" },
  { k: "6M", label: "6 Bln" },
  { k: "1Y", label: "1 Thn" },
  { k: "3Y", label: "3 Thn" },
  { k: "ALL", label: "Semua" },
];
const DAY = 864e5;
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtDateShort = (key) => { const [y, m, d] = key.split("-").map(Number); return d + " " + MONTHS[m - 1]; };
let curBuckets = [];

function rangeWindow(rng) {
  const to = today();
  const d = new Date();
  if (rng === "1W") return { from: iso(addDays(d, -6)), to };
  if (rng === "1M") return { from: iso(addDays(d, -29)), to };
  if (rng === "3M") return { from: iso(addDays(d, -89)), to };
  if (rng === "6M") return { from: iso(addDays(d, -179)), to };
  if (rng === "1Y") return { from: iso(addDays(d, -364)), to };
  if (rng === "3Y") return { from: iso(addDays(d, -1094)), to };
  const min = state.tx.reduce((a, t) => (t.date < a ? t.date : a), to);
  const max = state.tx.reduce((a, t) => (t.date > a ? t.date : a), to);
  return { from: min, to: max };
}

function renderRangeChips() {
  $("#rangeChips").innerHTML = RANGES.map((r) =>
    '<button class="range-chip' + (r.k === state.f.range ? " active" : "") + '" data-range="' + r.k + '" role="tab" aria-selected="' + (r.k === state.f.range) + '">' + r.label + "</button>"
  ).join("");
}

function renderLineChart(from, to) {
  const svg = $("#saldoChart");
  const legend = $("#saldoLegend");
  const days = Math.round((new Date(to) - new Date(from)) / DAY) + 1;
  const [y0, m0, d0] = from.split("-").map(Number);
  const start = new Date(y0, m0 - 1, d0);
  let bal = state.tx.filter((t) => t.date < from).reduce((a, t) => a + (t.type === "in" ? t.amount : -t.amount), 0);
  const pts = [];
  if (days <= 122) {
    const map = {};
    state.tx.forEach((t) => { if (t.date >= from && t.date <= to) map[t.date] = (map[t.date] || 0) + (t.type === "in" ? t.amount : -t.amount); });
    pts.push({ key: from, bal });
    for (let i = 0; i < days; i++) {
      const key = iso(addDays(start, i));
      bal += map[key] || 0;
      pts.push({ key, bal });
    }
  } else {
    pts.push({ key: from, bal });
    let y = y0, m = m0, guard = 0;
    while (guard++ < 480) {
      const mk = y + "-" + String(m).padStart(2, "0");
      const eom = iso(new Date(y, m, 0));
      const ptKey = eom <= to ? eom : to;
      state.tx.forEach((t) => { if (monthKey(t.date) === mk && t.date <= to) bal += t.type === "in" ? t.amount : -t.amount; });
      pts.push({ key: ptKey, bal });
      if (eom >= to) break;
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  if (pts.length < 2) {
    svg.innerHTML = "";
    legend.innerHTML = '<span class="muted">Belum ada data di rentang ini.</span>';
    return;
  }
  const W = 340, H = 118, PAD = 8, top = 10, bottom = 8;
  const vals = pts.map((p) => p.bal);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) { lo -= 1; hi += 1; }
  const span = hi - lo;
  const X = (i) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const Y = (v) => top + (1 - (v - lo) / span) * (H - top - bottom);
  const line = pts.map((p, i) => X(i).toFixed(1) + "," + Y(p.bal).toFixed(1)).join(" ");
  const area = "M" + line.replace(/ /g, " L") + " L" + X(pts.length - 1).toFixed(1) + "," + (H - bottom) + " L" + X(0).toFixed(1) + "," + (H - bottom) + " Z";
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#17785B";
  const first = pts[0].bal, last = pts[pts.length - 1].bal;
  const diff = last - first;
  const diffHtml = '<span class="' + (diff >= 0 ? "up" : "down") + '">' + (diff >= 0 ? "▲ +" : "▼ −") + fmtIDR(Math.abs(diff)) + "</span>";
  legend.innerHTML = '<span>Awal <b>' + fmtIDR(first) + "</b></span><span>Perubahan " + diffHtml + "</span><span>Akhir <b>" + fmtIDR(last) + "</b></span>";
  svg.innerHTML =
    '<defs><linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + accent + '" stop-opacity=".30"/>' +
    '<stop offset="1" stop-color="' + accent + '" stop-opacity="0"/></linearGradient></defs>' +
    '<line class="grid-line" x1="' + PAD + '" y1="' + (top + (H - top - bottom) / 2) + '" x2="' + (W - PAD) + '" y2="' + (top + (H - top - bottom) / 2) + '"/>' +
    '<path class="area" d="' + area + '"/>' +
    '<polyline class="line" points="' + line + '"/>' +
    '<circle class="dot start" cx="' + X(0).toFixed(1) + '" cy="' + Y(first).toFixed(1) + '" r="3"/>' +
    '<circle class="dot" cx="' + X(pts.length - 1).toFixed(1) + '" cy="' + Y(last).toFixed(1) + '" r="3.4"/>';
}

function buildBuckets(from, to) {
  const days = Math.round((new Date(to) - new Date(from)) / DAY) + 1;
  const [y0, m0, d0] = from.split("-").map(Number);
  const start = new Date(y0, m0 - 1, d0);
  const sum = (a, b) => {
    let i = 0, o = 0, n = 0;
    state.tx.forEach((t) => { if (t.date >= a && t.date <= b) { n++; t.type === "in" ? (i += t.amount) : (o += t.amount); } });
    return { inSum: i, outSum: o, count: n };
  };
  const B = [];
  if (days <= 14) {
    for (let i = 0; i < days; i++) {
      const key = iso(addDays(start, i));
      const s = sum(key, key);
      B.push({ key, from: key, to: key, label: fmtDate(key), labelShort: key.slice(8, 10) + "/" + key.slice(5, 7), inSum: s.inSum, outSum: s.outSum, count: s.count });
    }
  } else if (days <= 130) {
    for (let i = 0; i < days; i += 7) {
      const wk = addDays(start, i);
      const fk = iso(wk);
      const tk = iso(addDays(wk, 6));
      const s = sum(fk, tk);
      B.push({ key: fk, from: fk, to: tk, label: fmtDate(fk) + " – " + fmtDateShort(tk), labelShort: fmtDateShort(fk), inSum: s.inSum, outSum: s.outSum, count: s.count });
    }
  } else if (days <= 640) {
    let y = y0, m = m0, guard = 0;
    while (guard++ < 72) {
      const mk = y + "-" + String(m).padStart(2, "0");
      const eom = iso(new Date(y, m, 0));
      if (eom < from) { m++; if (m > 12) { m = 1; y++; } continue; }
      const fk = mk + "-01";
      const tk = eom <= to ? eom : to;
      const s = sum(fk, tk);
      B.push({ key: mk, from: fk, to: tk, label: monthLabel(mk), labelShort: MONTHS[m - 1], inSum: s.inSum, outSum: s.outSum, count: s.count });
      if (eom >= to) break;
      m++; if (m > 12) { m = 1; y++; }
    }
  } else if (days <= 1900) {
    let y = y0, q = Math.floor((m0 - 1) / 3) + 1, guard = 0;
    while (guard++ < 60) {
      const fk = y + "-" + String((q - 1) * 3 + 1).padStart(2, "0") + "-01";
      const ek = iso(new Date(y, q * 3 + 1, 0));
      if (ek < from) { q++; if (q > 4) { q = 1; y++; } continue; }
      const tk = ek <= to ? ek : to;
      const s = sum(fk, tk);
      B.push({ key: "Q" + q + " " + y, from: fk, to: tk, label: "Kuartal " + q + " " + y, labelShort: "Q" + q, inSum: s.inSum, outSum: s.outSum, count: s.count });
      if (ek >= to) break;
      q++; if (q > 4) { q = 1; y++; }
    }
  } else {
    const lastY = Number(to.slice(0, 4));
    for (let y = y0; y <= lastY; y++) {
      const fk = y + "-01-01";
      const tk = y === lastY ? to : y + "-12-31";
      const s = sum(fk, tk);
      B.push({ key: String(y), from: fk, to: tk, label: "Tahun " + y, labelShort: String(y).slice(2), inSum: s.inSum, outSum: s.outSum, count: s.count });
    }
  }
  return B;
}

function renderBars() {
  closeBarPop();
  const { from, to } = rangeWindow(state.f.range);
  let ri = 0, ro = 0;
  state.tx.forEach((t) => { if (t.date >= from && t.date <= to) t.type === "in" ? (ri += t.amount) : (ro += t.amount); });
  const rn = ri - ro;
  $("#rsIn").textContent = "+" + fmtIDR(ri);
  $("#rsOut").textContent = "\u2212" + fmtIDR(ro);
  const rsNet = $("#rsNet");
  rsNet.textContent = (rn >= 0 ? "+" : "\u2212") + fmtIDR(Math.abs(rn));
  rsNet.className = "rs-val " + (rn >= 0 ? "pos" : "neg");
  curBuckets = buildBuckets(from, to);
  const maxV = Math.max(1, ...curBuckets.map((b) => Math.max(b.inSum, b.outSum)));
  const bars = $("#monthBars");
  bars.style.gridTemplateColumns = "repeat(" + curBuckets.length + ", minmax(0, 1fr))";
  bars.classList.toggle("dense", curBuckets.length > 12);
  bars.innerHTML = curBuckets.map((b) => {
    const hi = Math.round((b.inSum / maxV) * 100);
    const ho = Math.round((b.outSum / maxV) * 100);
    return '<div class="mb-col" data-mk="' + esc(b.key) + '" title="' + esc(b.label) + '"><div class="mb-pair">' +
      '<div class="mb-bar in" role="button" tabindex="0" aria-label="Pemasukan ' + fmtIDR(b.inSum) + " " + esc(b.label) + '" style="height:' + Math.max(hi, 2) + '%"></div>' +
      '<div class="mb-bar out" role="button" tabindex="0" aria-label="Pengeluaran ' + fmtIDR(b.outSum) + " " + esc(b.label) + '" style="height:' + Math.max(ho, 2) + '%"></div>' +
      "</div><div class='mb-label'>" + esc(b.labelShort) + "</div></div>";
  }).join("");
}

function renderRecent() {
  const list = [...state.tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $("#recentList").innerHTML = list.length ? list.map((t) => txItemHtml(t, true)).join("") : '<p class="hint" style="padding:8px 0">Belum ada transaksi. Tekan tombol + untuk mulai.</p>';
}

function txItemHtml(t, withDel) {
  const c = catOf(t);
  const amtCls = t.type === "in" ? "pos" : "neg";
  const sign = t.type === "in" ? "+" : "−";
  return '<div class="tx-item">' +
    '<div class="tx-badge" style="background:' + c.color + '">' + esc(c.label[0]) + "</div>" +
    '<div class="tx-body"><div class="tx-title">' + esc(c.label) + (t.note ? " · " + esc(t.note) : "") + '</div><div class="tx-sub">' + fmtDate(t.date) + "</div></div>" +
    '<div class="tx-amt ' + amtCls + '">' + sign + " " + fmtIDR(t.amount) + "</div>" +
    (withDel ? '<button class="tx-menu-btn" data-del="' + t.id + '" aria-label="Aksi transaksi"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button>' : "") +
    "</div>";
}

/* ---------- render: history ---------- */
function ddItem(val, label, cur) {
  return '<button type="button" class="dd-item' + (val === cur ? " sel" : "") + '" data-val="' + val + '">' +
    '<span class="dd-item-label">' + label + "</span>" +
    (val === cur ? '<span class="dd-check">✓</span>' : "") + "</button>";
}
function syncDdLabels() {
  const month = state.f.month !== "all" ? monthLabel(state.f.month) : "Semua bulan";
  const type = state.f.type === "in" ? "Masuk" : state.f.type === "out" ? "Keluar" : "Semua";
  let cat = "Semua kategori";
  if (state.f.cat !== "all") {
    const cats = state.f.type === "in" ? CATS_IN : CATS_OUT;
    const c = cats.find((x) => x.id === state.f.cat);
    if (c) cat = c.label;
  }
  $("#ddBtnMonth").textContent = month;
  $("#ddBtnType").textContent = type;
  $("#ddBtnCat").textContent = cat;
}
function buildMonthOptions() {
  $("#ddPanelMonth").innerHTML = ddItem("all", "Semua bulan", state.f.month) +
    lastMonths(12).map((m) => ddItem(m, monthLabel(m), state.f.month)).join("");
  const cats = state.f.type === "in" ? CATS_IN : CATS_OUT;
  $("#ddPanelCat").innerHTML = ddItem("all", "Semua kategori", state.f.cat) +
    cats.map((c) => ddItem(c.id, c.label, state.f.cat)).join("");
  $("#ddPanelType").innerHTML = ddItem("all", "Semua", state.f.type) +
    ddItem("in", "Masuk", state.f.type) + ddItem("out", "Keluar", state.f.type);
  syncDdLabels();
}

function renderHistory() {
  buildMonthOptions();
  let list = [...state.tx].sort((a, b) => b.date.localeCompare(a.date));
  if (state.f.month !== "all") list = list.filter((t) => monthKey(t.date) === state.f.month);
  if (state.f.type !== "all") list = list.filter((t) => t.type === state.f.type);
  if (state.f.cat !== "all") list = list.filter((t) => t.cat === state.f.cat);
  if (state.f.dr) list = list.filter((t) => t.date >= state.f.dr.from && t.date <= state.f.dr.to);

  const rn = $("#rangeNote");
  if (state.f.dr) {
    rn.hidden = false;
    $("#rangeNoteTxt").textContent = fmtDate(state.f.dr.from) + " – " + fmtDate(state.f.dr.to);
  } else rn.hidden = true;

  $("#historyEmpty").hidden = list.length !== 0;
  const groups = {};
  list.forEach((t) => (groups[t.date] = groups[t.date] || []).push(t));
  $("#historyList").innerHTML = Object.entries(groups).map(([d, tx]) =>
    '<div class="group-label">' + fmtDate(d) + "</div>" + tx.map((t) =>
      state.pendingDel.ids.includes(t.id) ? undoRowHtml(t) : txItemHtml(t, true)
    ).join("")
  ).join("");
}

/* ---------- render: settings ---------- */
function renderSettings() {
  $("#darkToggle").checked = state.theme === "dark";
  $("#askDelToggle").checked = state.settings.askDelete;
}

/* ---------- add sheet ---------- */
function openSheet(tx) {
  clearTimeout(sheetCloseTimer);
  const s0 = $("#sheet");
  cancelCloseAnim(s0);
  cancelCloseAnim($("#sheetOverlay"));
  s0.style.transform = "";
  s0.style.transition = "";
  s0.style.opacity = "";
  $("#sheetOverlay").hidden = false;
  if (tx) {
    state.draft = { type: tx.type, cat: tx.cat, id: tx.id };
    $("#sheetTitle").textContent = "Edit transaksi";
    $("#amountInput").value = tx.amount;
    $("#noteInput").value = tx.note || "";
    $("#dateInput").value = tx.date;
    $("#saveTx").textContent = "Simpan Perubahan";
  } else {
    state.draft = { type: "out", cat: null, id: null };
    $("#sheetTitle").textContent = "Catat transaksi";
    $("#amountInput").value = "";
    $("#noteInput").value = "";
    $("#dateInput").value = today();
    $("#saveTx").textContent = "Simpan";
  }
  syncSeg();
  syncCats();
  updateSaveState();
  $("#amountInput").focus();
}
let sheetCloseTimer = null;
function closeSheet() {
  clearTimeout(sheetCloseTimer);
  const s = $("#sheet");
  const ov = $("#sheetOverlay");
  // kalau swipe-close sedang berjalan (inline transform), finalkan tanpa animasi ulang
  if (s.style.transform) { finishSheetClose(s, ov); return; }
  s.classList.add("closing");
  ov.classList.add("closing");
  clearTimeout(closeSheet._t);
  closeSheet._t = setTimeout(() => finishSheetClose(s, ov), 220);
}
function finishSheetClose(s, ov) {
  s.classList.remove("closing");
  ov.classList.remove("closing");
  s.style.transform = "";
  s.style.transition = "";
  s.style.opacity = "";
  ov.hidden = true;
  if (state.draft) state.draft.id = null;
}
function syncSeg() {
  document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.type === state.draft.type));
  syncCats();
  updateSaveState();
}
function syncCats() {
  const cats = state.draft.type === "in" ? CATS_IN : CATS_OUT;
  if (!cats.some((c) => c.id === state.draft.cat)) state.draft.cat = null;
  $("#catGrid").innerHTML = cats.map((c) =>
    '<button class="cat-btn' + (state.draft.cat === c.id ? " selected" : "") + '" data-cat="' + c.id + '">' +
    '<span class="mono" style="background:' + c.color + '">' + esc(c.label[0]) + '</span><span class="cat-label">' + esc(c.label) + "</span></button>"
  ).join("");
}
function updateSaveState() {
  const amt = parseAmount($("#amountInput").value);
  $("#saveTx").disabled = !(amt > 0 && state.draft.cat);
}
function parseAmount(v) {
  const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}
function saveTx() {
  const amt = parseAmount($("#amountInput").value);
  if (!(amt > 0 && state.draft.cat)) return;
  const data = {
    type: state.draft.type,
    amount: amt,
    cat: state.draft.cat,
    note: $("#noteInput").value.trim() || "",
    date: $("#dateInput").value || today(),
  };
  if (state.draft.id) {
    const t = state.tx.find((x) => x.id === state.draft.id);
    if (t) Object.assign(t, data);
    save(); closeSheet(); render(); toast("Perubahan disimpan ✓");
    return;
  }
  state.tx.push(Object.assign({ id: uid() }, data));
  save();
  closeSheet();
  render();
  toast("Tersimpan ✓");
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, action, fn) {
  const el = $("#toast");
  el.textContent = "";
  const span = document.createElement("span");
  span.textContent = msg;
  el.appendChild(span);
  if (action && fn) {
    const b = document.createElement("button");
    b.className = "toast-act";
    b.textContent = action;
    b.onclick = () => { clearTimeout(toastTimer); el.hidden = true; fn(); };
    el.appendChild(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}

/* ---------- seed demo ---------- */
function seedDemo() {
  const d = new Date();
  const seed = [];
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a));
  for (let m = 5; m >= 0; m--) {
    const base = new Date(d.getFullYear(), d.getMonth() - m, 1);
    seed.push({ id: uid(), type: "in", amount: 3500000, cat: "gaji", note: "Gaji", date: mk(base, 1) });
    if (Math.random() > .5) seed.push({ id: uid(), type: "in", amount: rnd(200, 900) * 1000, cat: "freelance", note: "Side job", date: mk(base, rnd(8, 20)) });
    const nOut = rnd(8, 14);
    for (let i = 0; i < nOut; i++) {
      const cat = pick(["makan", "transport", "kos", "belanja", "nongkrong", "kuota", "kesehatan"]);
      const amt = cat === "kos" ? rnd(60, 120) * 10000 : cat === "nongkrong" ? rnd(3, 15) * 10000 : rnd(1, 8) * 10000;
      seed.push({ id: uid(), type: "out", amount: amt, cat, note: "", date: mk(base, rnd(1, 28)) });
    }
  }
  function mk(base, day) { const x = new Date(base); x.setDate(day); return x.toISOString().slice(0, 10); }
  state.tx = seed;
  save();
  render();
  toast("Contoh data diisi (bisa dihapus di Atur)");
}

/* ---------- export / import / reset ---------- */
function exportData() {
  const json = JSON.stringify({ app: "arus", version: 1, exported: today(), tx: state.tx }, null, 2);
  const fname = "arus-backup-" + today() + ".json";
  if (window.ArusBridge) {
    ArusBridge.saveExport(fname, json);
    ArusBridge.shareExport(fname, json);
    toast("Backup: tersimpan di Downloads + siap dibagikan");
    return;
  }
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup diunduh");
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.tx)) throw new Error("format salah");
      state.tx = d.tx;
      save(); render(); toast("Data dipulihkan (" + d.tx.length + " transaksi)");
    } catch (e) { toast("Gagal: file bukan backup Arus"); }
  };
  reader.readAsText(file);
}

/* ---------- theme ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  $("#darkToggle").checked = state.theme === "dark";
}
/* ---------- aksi item: menu ⋮, dialog hapus, hold-to-confirm ---------- */
function closeWithAnim(el, ms, done) {
  if (!el || el.hidden) { done && done(); return; }
  if (el._ct) return;
  el.classList.add("closing");
  el._ct = setTimeout(() => {
    el._ct = null;
    el.classList.remove("closing");
    el.hidden = true;
    done && done();
  }, ms);
}
function cancelCloseAnim(el) {
  if (el && el._ct) { clearTimeout(el._ct); el._ct = null; }
  if (el) el.classList.remove("closing");
}
let txMenuId = null;
let dlgTxId = null;
function openTxMenu(btnEl) {
  const tx = state.tx.find((t) => t.id === btnEl.dataset.del);
  if (!tx) return;
  closeDeleteDialog();
  txMenuId = tx.id;
  const menu = $("#txMenu");
  cancelCloseAnim(menu);
  menu.hidden = false;
  const br = btnEl.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = br.right - mw;
  left = Math.max(8, Math.min(left, innerWidth - mw - 8));
  let top = br.bottom + 6;
  if (top + mh > innerHeight - 8) top = br.top - mh - 6;
  top = Math.max(8, Math.min(top, innerHeight - mh - 8));
  menu.style.left = left + "px";
  menu.style.top = top + "px";
}
function closeTxMenu() {
  txMenuId = null;
  const m = $("#txMenu");
  cancelHold($("#txMenuDel"));
  closeWithAnim(m, 160, () => {
    const b = $("#txMenuDel");
    if (b._arm) { b.removeEventListener("pointerdown", b._arm); b._arm = null; }
    b.classList.remove("hold-btn");
    $("#txMenuEdit").style.display = "";
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Hapus';
    b.dataset.label = "Hapus";
  });
}
let dlgWipe = false;
function showDeleteDialog(tx) {
  closeTxMenu();
  dlgTxId = tx.id;
  dlgWipe = false;
  $("#dlgNoAsk").closest("label").hidden = false;
  $("#dlgTitle").textContent = "Hapus transaksi?";
  $("#dlgMsg").textContent =
    (tx.type === "in" ? "Pemasukan " : "Pengeluaran ") + fmtIDR(tx.amount) + " · " + (catOf(tx).label) + ". Tindakan ini tidak bisa dikembalikan.";
  $("#dlgNoAsk").checked = false;
  const ov = $("#dlgOverlay");
  cancelCloseAnim(ov);
  ov.hidden = false;
}
function closeDeleteDialog() {
  cancelHold($("#dlgConfirm"));
  dlgTxId = null;
  dlgWipe = false;
  closeWithAnim($("#dlgOverlay"), 180);
}
function showWipeDialog() {
  closeTxMenu();
  dlgTxId = null;
  dlgWipe = true;
  $("#dlgTitle").textContent = "Hapus semua data?";
  $("#dlgMsg").textContent = "Semua " + state.tx.length + " transaksi akan dihapus permanen dari perangkat ini. Tindakan ini tidak bisa dikembalikan.";
  $("#dlgNoAsk").closest("label").hidden = true;
  const ov = $("#dlgOverlay");
  cancelCloseAnim(ov);
  ov.hidden = false;
}
function wipeAll() {
  const backup = state.tx.slice();
  state.tx = [];
  save(); render();
  toast("Semua data dihapus", "Batal", () => {
    state.tx = backup; save(); render();
  });
}
/* inline undo (2-fase: soft delete -> commit) */
const UNDO_MS = 6000;
function deleteTx(id) {
  if (state.pendingDel.ids.includes(id)) return;
  state.pendingDel.ids.push(id);
  state.pendingDel.timers[id] = setTimeout(() => commitUndo(id, true), UNDO_MS);
  save(); render();
  showSnackUndo(id);
}
let snackTimer = null;
function showSnackUndo(id) {
  const el = $("#undoSnack");
  if (!el) return;
  el.innerHTML =
    '<span class="undo-dot" aria-hidden="true">🗑</span>' +
    '<span class="undo-msg">Transaksi dihapus</span>' +
    '<button type="button" class="snack-act" data-snack-batal="' + id + '">Batal</button>';
  el.hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnack, UNDO_MS);
}
function hideSnack() {
  const el = $("#undoSnack");
  if (el) { el.hidden = true; el.textContent = ""; clearTimeout(snackTimer); }
}
function undoRowHtml(t) {
  return '<div class="undo-row" data-pending-id="' + t.id + '">' +
    '<div class="undo-info">🗑️<span>Transaksi dihapus</span></div>' +
    '<div class="undo-actions">' +
    '<button type="button" class="undo-x" data-undo-x="' + t.id + '" aria-label="Tutup (hapus permanen)">✕</button>' +
    '<button type="button" class="undo-bak" data-undo-bak="' + t.id + '">Batal</button>' +
    "</div></div>";
}
function restoreUndo(id) {
  if (!state.pendingDel.ids.includes(id)) return;
  clearTimeout(state.pendingDel.timers[id]);
  delete state.pendingDel.timers[id];
  state.pendingDel.ids = state.pendingDel.ids.filter((x) => x !== id);
  save(); render();
  clearTimeout(snackTimer); hideSnack();
}
function commitUndo(id, animate) {
  if (!state.pendingDel.ids.includes(id)) return;
  clearTimeout(state.pendingDel.timers[id]);
  delete state.pendingDel.timers[id];
  state.pendingDel.ids = state.pendingDel.ids.filter((x) => x !== id);
  const finish = () => {
    state.tx = state.tx.filter((t) => t.id !== id);
    save(); render();
    clearTimeout(snackTimer); hideSnack();
  };
  if (animate) {
    const row = document.querySelector('.undo-row[data-pending-id="' + id + '"]');
    if (row) {
      row.style.maxHeight = row.offsetHeight + "px";
      void row.offsetHeight;
      row.style.maxHeight = "0px";
      row.style.paddingTop = "0";
      row.style.paddingBottom = "0";
      row.style.opacity = "0";
      setTimeout(finish, 240);
      return;
    }
  }
  finish();
}
function holdToConfirm(btn, ms, onDone) {
  cancelHold(btn);
  const t0 = performance.now();
  const h = { cancel: false, iv: null, to: null };
  btn._hold = h;
  btn.style.setProperty("--fill", "0%");
  h.iv = setInterval(() => {
    if (h.cancel) return;
    const p = Math.min(1, (performance.now() - t0) / ms);
    btn.style.setProperty("--fill", (p * 100).toFixed(1) + "%");
  }, 40);
  h.to = setTimeout(() => {
    if (h.cancel) return;
    clearInterval(h.iv);
    btn._hold = null;
    btn.style.setProperty("--fill", "0%");
    onDone();
  }, ms);
}
function cancelHold(btn) {
  const h = btn && btn._hold;
  if (h) { h.cancel = true; clearInterval(h.iv); clearTimeout(h.to); btn._hold = null; }
  if (btn) btn.style.setProperty("--fill", "0%");
}
function bindHold(btn, ms, onDone) {
  btn.addEventListener("pointerdown", (e) => { e.preventDefault(); holdToConfirm(btn, ms, onDone); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => btn.addEventListener(ev, () => cancelHold(btn)));
}
bindHold($("#dlgConfirm"), 1500, () => {
  const id = dlgTxId, wipe = dlgWipe;
  closeDeleteDialog();
  closeTxMenu();
  if (wipe) wipeAll();
  else if (id) deleteTx(id, "Transaksi dihapus");
});
$("#dlgCancel").addEventListener("click", closeDeleteDialog);
$("#dlgNoAsk").addEventListener("change", (e) => {
  state.settings.askDelete = !e.target.checked;
  save();
});
$("#txMenuEdit").addEventListener("click", () => {
  const tx = state.tx.find((t) => t.id === txMenuId);
  closeTxMenu();
  if (tx) openSheet(tx);
});
$("#txMenuDel").addEventListener("click", () => {
  const tx = state.tx.find((t) => t.id === txMenuId);
  if (!tx) return;
  if (state.settings.askDelete) {
    showDeleteDialog(tx);
  } else {
    // skip dialog: item berubah jadi "Tahan untuk menghapus";
    // hold baru dimulai saat POINTER DOWN berikutnya (bukan langsung dari klik!)
    $("#txMenuEdit").style.display = "none";
    const b = $("#txMenuDel");
    b.classList.add("hold-btn");
    b.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Tahan untuk menghapus';
    const arm = (e) => {
      e.preventDefault();
      b.removeEventListener("pointerdown", arm);
      b._arm = null;
      holdToConfirm(b, 1500, () => {
        closeTxMenu();
        deleteTx(tx.id, "Transaksi dihapus");
      });
    };
    b._arm = arm;
    b.addEventListener("pointerdown", arm);
  }
});

/* ---------- events ---------- */
document.addEventListener("click", (e) => {
  const rc = e.target.closest("[data-range]");
  if (rc) { state.f.range = rc.dataset.range; render(); return; }
  const g = e.target.closest("[data-goto]");
  if (g) { goto(g.dataset.goto); return; }
  const ux = e.target.closest("[data-undo-x]");
  if (ux) { commitUndo(ux.dataset.undoX, true); return; }
  const sb = e.target.closest("[data-snack-batal]");
  if (sb) { restoreUndo(sb.dataset.snackBatal); return; }
  const ub = e.target.closest("[data-undo-bak]");
  if (ub) { restoreUndo(ub.dataset.undoBak); return; }
  const del = e.target.closest("[data-del]");
  if (del) {
    openTxMenu(del);
    return;
  }
  const cat = e.target.closest("[data-cat]");
  if (cat) { state.draft.cat = cat.dataset.cat; syncCats(); updateSaveState(); return; }
  const amt = e.target.closest("[data-amt]");
  if (amt) {
    $("#amountInput").value = amt.dataset.amt;
    updateSaveState();
    return;
  }
  const typeBtn = e.target.closest(".seg-btn");
  if (typeBtn) { state.draft.type = typeBtn.dataset.type; syncSeg(); return; }
  if (e.target.closest("#emptyAdd")) { openSheet(); return; }
  if (e.target.closest("#emptySeed") || e.target.closest("#seedBtn")) { seedDemo(); return; }
  if (e.target.closest("#fabAdd")) { openSheet(); return; }
  if (e.target.closest("#saveTx")) { saveTx(); return; }
  if (e.target.closest("#exportBtn")) { exportData(); return; }
  if (e.target.closest("#resetBtn")) {
    setTimeout(showWipeDialog, 0);
    return;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#sheetOverlay").hidden) closeSheet();
  if (e.key === "Enter" && !$("#sheetOverlay").hidden && e.target.id === "amountInput") {
    const cat = state.draft.cat;
    if (cat) saveTx(); else toast("Pilih kategori dulu");
  }
});
$("#amountInput").addEventListener("input", updateSaveState);
$("#darkToggle").addEventListener("change", (e) => { state.theme = e.target.checked ? "dark" : "light"; save(); applyTheme(); });
$("#rangeNoteX").addEventListener("click", () => { state.f.dr = null; state.f.month = "all"; renderHistory(); });
$("#askDelToggle").addEventListener("change", (e) => {
  state.settings.askDelete = e.target.checked;
  save();
});
$("#sheetOverlay").addEventListener("click", (e) => { if (e.target.id === "sheetOverlay") closeSheet(); });
$("#monthBars").addEventListener("click", (e) => {
  const col = e.target.closest(".mb-col");
  if (!col) return;
  const mk = col.dataset.mk;
  if (barOpenMk === mk) { closeBarPop(); return; }
  showBarPop(mk, col);
});
$("#monthBars").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const col = e.target.closest(".mb-col");
  if (col) { e.preventDefault(); col.click(); }
});
window.addEventListener("scroll", () => {
  if (barOpenMk) closeBarPop();
  if (txMenuId) closeTxMenu();
}, { passive: true });
document.addEventListener("click", (e) => {
  if (barOpenMk && !e.target.closest("#barPop") && !e.target.closest("#monthBars")) closeBarPop();
  if (txMenuId && !e.target.closest("#txMenu") && !e.target.closest("[data-del]")) closeTxMenu();
  if (!document.getElementById("dlgOverlay").hidden && !e.target.closest("#dlgOverlay") && !e.target.closest("#txMenu") && !e.target.closest("[data-del]") && !e.target.closest("#resetBtn")) closeDeleteDialog();
});
$("#cancelTx").addEventListener("click", closeSheet);
// swipe-down untuk tutup (native bottom-sheet gesture)
(() => {
  const sheet = $("#sheet");
  let startY = null, curY = 0;
  sheet.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; curY = 0; sheet.style.transition = "none"; }, { passive: true });
  sheet.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    curY = e.touches[0].clientY - startY;
    if (curY > 0) sheet.style.transform = "translateY(" + curY + "px)";
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    startY = null;
    sheet.style.transition = "";
    if (curY > 90) {
      sheet.style.transition = "transform .18s ease, opacity .18s ease";
      sheet.style.transform = "translateY(70px)";
      sheet.style.opacity = "0";
      sheetCloseTimer = setTimeout(closeSheet, 170);
    } else {
      sheet.style.transform = "";
      sheet.style.opacity = "";
    }
    curY = 0;
  });
})();
$("#importFile").addEventListener("change", (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
$("#historyEmptyAdd").addEventListener("click", () => openSheet());
document.addEventListener("click", (e) => {
  const ddWrap = e.target.closest(".dd");
  const btn = e.target.closest(".dd-btn");
  if (btn && ddWrap) {
    const which = ddWrap.dataset.dd;
    const panel = $("#ddPanel" + which[0].toUpperCase() + which.slice(1));
    const wasHidden = panel.hidden;
    document.querySelectorAll(".dd-panel").forEach((p) => { p.hidden = true; });
    document.querySelectorAll(".dd-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
    if (wasHidden) { panel.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    return;
  }
  const item = e.target.closest(".dd-item");
  if (item && ddWrap) {
    const which = ddWrap.dataset.dd;
    state.f[which] = item.dataset.val;
    if (which === "month") state.f.dr = null;
    const panel = $("#ddPanel" + which[0].toUpperCase() + which.slice(1));
    panel.hidden = true;
    document.querySelector('[data-dd="' + which + '"] .dd-btn').setAttribute("aria-expanded", "false");
    buildMonthOptions();
    renderHistory();
    return;
  }
  document.querySelectorAll(".dd-panel").forEach((p) => { p.hidden = true; });
  document.querySelectorAll(".dd-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".dd-panel").forEach((p) => { p.hidden = true; });
    document.querySelectorAll(".dd-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }
});

/* ---------- pengaman autosave (APK/WebView) ---------- */
function storageAvailable() {
  try {
    const k = "__arus_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
}
if (!storageAvailable()) {
  setTimeout(() => toast("Peringatan: penyimpanan lokal tidak tersedia — data TIDAK akan tersimpan."), 800);
}
window.addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(); });

/* ---------- profil ---------- */
function profileName() { return (state.profile && state.profile.name && state.profile.name.trim()) || "Pengguna Arus"; }
function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = [152, 162, 172, 182, 192, 202, 212];
  return "hsl(" + hues[h % hues.length] + ", 55%, 38%)";
}
function daysSince(startIso) {
  const d1 = new Date(startIso + "T00:00:00");
  const d2 = new Date();
  return Math.max(1, Math.round((d2 - d1) / 864e5) + 1);
}
function renderProfile() {
  const tx = state.tx;
  const name = profileName();
  $("#profileGreeting").textContent = greeting() + " 👋";
  $("#profileAvatar").textContent = name[0].toUpperCase();
  $("#profileAvatar").style.background = avatarColor(name);
  $("#profileName").textContent = name;
  if (tx.length) {
    const dates = tx.map((t) => t.date).sort();
    const saldo = tx.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
    const catCount = {};
    tx.forEach((t) => { catCount[t.cat] = (catCount[t.cat] || 0) + 1; });
    const top = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    const c = CATS_IN.concat(CATS_OUT).find((x) => x.id === top[0]);
    $("#pStatsCount").textContent = tx.length + " transaksi";
    $("#pStatsSince").textContent = fmtDate(dates[0]);
    $("#pStatsSaldo").textContent = fmtIDR(saldo);
    $("#pStatsTopCat").textContent = c ? c.label : top[0];
    $("#pStatsDays").textContent = "Hari ke-" + daysSince(dates[0]);
    $("#profileEmptyNote").hidden = true;
  } else {
    $("#pStatsCount").textContent = "0 transaksi";
    $("#pStatsSince").textContent = "—";
    $("#pStatsSaldo").textContent = "Rp 0";
    $("#pStatsTopCat").textContent = "—";
    $("#pStatsDays").textContent = "Belum mulai";
    $("#profileEmptyNote").hidden = false;
  }
  renderTarget();
}
function renderTarget() {
  const target = (state.settings && state.settings.target) || 20;
  const mk = monthKey(today());
  const inc = state.tx.filter((t) => t.type === "in" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
  const out = state.tx.filter((t) => t.type === "out" && monthKey(t.date) === mk).reduce((s, t) => s + t.amount, 0);
  const saved = inc - out;
  const pct = inc > 0 ? Math.max(0, Math.min(100, Math.round((saved / (inc * target / 100)) * 100))) : 0;
  $("#profileTarget").textContent = target + "%";
  $("#targetBarFill").style.width = pct + "%";
  $("#targetBarPct").textContent = pct + "%";
  $("#targetHint").textContent = inc > 0
    ? (pct >= 100 ? "Target tercapai bulan ini! 🎉" : "Simpan " + fmtIDR(inc * target / 100 - saved) + " lagi bulan ini.")
    : "Catat pemasukan bulan ini untuk mulai target.";
}
function openNameDialog() {
  const input = $("#nameInput");
  input.value = profileName() === "Pengguna Arus" ? "" : profileName();
  const ov = $("#nameOverlay");
  cancelCloseAnim(ov);
  ov.hidden = false;
  setTimeout(() => input.focus(), 60);
}
function closeNameDialog() {
  const ov = $("#nameOverlay");
  cancelCloseAnim(ov);
  closeWithAnim(ov, 180);
}
function saveName() {
  const clean = $("#nameInput").value.trim().slice(0, 24);
  if (!clean) { closeNameDialog(); return; }
  state.profile = state.profile || {};
  state.profile.name = clean;
  save(); closeNameDialog(); renderProfile();
  toast("Nama disimpan");
}
function cycleTarget() {
  const cur = (state.settings && state.settings.target) || 20;
  const next = cur >= 50 ? 10 : cur + 10;
  state.settings.target = next;
  save(); renderTarget();
  toast("Target tabungan " + next + "%");
}
$("#profileHero").addEventListener("click", openNameDialog);
$("#nameSave").addEventListener("click", saveName);
$("#nameCancel").addEventListener("click", closeNameDialog);
$("#nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") saveName(); });
$("#profileTarget").addEventListener("click", cycleTarget);

/* ---------- init ---------- */
load();
if (state.theme !== "dark" && state.theme !== "light") {
  state.theme = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}
applyTheme();
buildMonthOptions();
render();
const _vEl = $("#appVersion"); if (_vEl) _vEl.textContent = ARUS_VERSION;
