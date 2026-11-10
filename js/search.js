/* Tìm kiếm phía client: bỏ dấu, khớp tiền tố, khớp từng từ, chịu lỗi chính tả nhẹ */
import { fold, esc } from './util.js';

const idx = new WeakMap();
function keys(t) {
  let k = idx.get(t);
  if (!k) {
    k = {
      en: fold(t.term_en), vi: fold(t.term_vi),
      body: fold([t.def_en, t.def_vi, t.example_en, t.note].join(' ')),
    };
    idx.set(t, k);
  }
  return k;
}

function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

function fieldScore(f, q) {
  if (!f) return 0;
  if (f === q) return 100;
  if (f.startsWith(q)) return 80;
  if ((' ' + f).includes(' ' + q)) return 62;
  if (f.includes(q)) return 40;
  if (q.length >= 4) {
    const max = q.length >= 8 ? 2 : 1;
    if (lev(q, f, max) <= max) return 34;
    // so với từng từ trong thuật ngữ nhiều từ
    if (f.includes(' ') && f.split(' ').some(w => w.length >= 4 && lev(q, w, max) <= max)) return 26;
  }
  return 0;
}

/** Trả về [{term, score}] đã sắp xếp. filters: {subject, topic, grade} */
export function search(terms, query, filters = {}) {
  const q = fold(query);
  const pass = t => (!filters.subject || t.subject_id === filters.subject)
    && (!filters.topic || t.topic_id === filters.topic)
    && (!filters.grade || String(t.grade) === String(filters.grade));
  const pool = terms.filter(pass);
  if (!q) return pool.map(term => ({ term, score: 0 })).sort((a, b) => a.term.term_en.localeCompare(b.term.term_en));
  const raw = String(query).trim().toLowerCase();
  const out = [];
  for (const t of pool) {
    const k = keys(t);
    let s = Math.max(fieldScore(k.en, q), fieldScore(k.vi, q));
    if (!s && q.length >= 3 && k.body.includes(q)) s = 12;
    if (s && raw && t.term_vi.toLowerCase().includes(raw)) s += 4; // ưu tiên khớp đúng dấu
    if (s) out.push({ term: t, score: s });
  }
  return out.sort((a, b) => b.score - a.score || a.term.term_en.length - b.term.term_en.length);
}

/** Tô sáng phần khớp (không phân biệt dấu) */
export function highlight(text, query) {
  const q = fold(query);
  text = String(text || '');
  if (!q) return esc(text);
  const per = Array.from(text).map(c => fold(c) || ' ');
  const flat = per.join('');
  const i = flat.indexOf(q);
  if (i < 0) return esc(text);
  // per[] có thể có phần tử dài hơn 1 kí tự → tính lại vị trí
  let pos = 0, start = -1, end = -1;
  for (let k = 0; k < per.length; k++) {
    if (start < 0 && pos >= i) start = k;
    pos += per[k].length;
    if (start >= 0 && pos >= i + q.length) { end = k + 1; break; }
  }
  if (start < 0 || end < 0) return esc(text);
  const chars = Array.from(text);
  return esc(chars.slice(0, start).join('')) + '<mark>' + esc(chars.slice(start, end).join('')) + '</mark>' + esc(chars.slice(end).join(''));
}
