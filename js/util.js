/* Tiện ích dùng chung */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Chuẩn hoá để so khớp: bỏ dấu tiếng Việt, đ→d, chữ thường, gộp khoảng trắng */
export const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const slug = s => fold(s).replace(/\s+/g, '-').slice(0, 60) || 'term';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const fmtDate = d => { try { return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };

export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  return { path, parts, q };
}
export const go = h => { if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; };

/* ---------- Phát âm (Web Speech API) ---------- */
let voices = [];
function loadVoices() { try { voices = speechSynthesis.getVoices(); } catch (e) { voices = []; } }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
export const canSpeak = () => 'speechSynthesis' in window;
export function speak(text, { lang = 'en-US', rate = 0.9 } = {}) {
  if (!canSpeak()) { toast('Trình duyệt không hỗ trợ phát âm'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = rate;
  const v = voices.find(v => v.lang === lang) || voices.find(v => v.lang && v.lang.startsWith(lang.slice(0, 2)));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
export const ICON_SPEAK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
export const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>';
/** Nút loa: data-say="text" data-lang="en-US|en-GB" data-rate */
export const sayBtn = (text, { lang = 'en-US', cls = '', title = 'Nghe phát âm', rate } = {}) =>
  `<button class="say ${cls}" type="button" data-say="${esc(text)}" data-lang="${lang}"${rate ? ` data-rate="${rate}"` : ''} title="${esc(title)}" aria-label="${esc(title)}">${ICON_SPEAK}</button>`;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  speak(b.dataset.say, { lang: b.dataset.lang || 'en-US', rate: parseFloat(b.dataset.rate || '0.9') });
});

/* ---------- Toast / modal / confetti ---------- */
export function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
export function modal(html, { onClose } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="x" aria-label="Đóng">✕</button>${html}</div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('.x')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  return { el: bg.querySelector('.modal'), close };
}
export function confirmBox(msg) {
  return new Promise(res => {
    const m = modal(`<h3>Xác nhận</h3><p>${esc(msg)}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-a="0">Huỷ</button><button class="btn coral sm" data-a="1">Đồng ý</button></div>`, { onClose: () => res(false) });
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { const v = b.dataset.a === '1'; m.close(); res(v); } });
  });
}
export function confetti(n = 70) {
  const cs = ['#FF6B6B', '#FFB703', '#06D6A0', '#4CC9F0', '#7B61FF', '#F72585'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = cs[i % cs.length];
    c.style.animationDuration = (1.8 + Math.random() * 1.6) + 's'; c.style.animationDelay = (Math.random() * .4) + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
}

/* ---------- CSV ---------- */
export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim() !== ''));
  if (!clean.length) return [];
  const head = clean[0].map(h => h.trim());
  return clean.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
export function toCSV(rows, cols) {
  const cell = v => { v = Array.isArray(v) ? v.join('|') : (v == null ? '' : String(v)); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
}
export function download(name, content, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type + ';charset=utf-8' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
