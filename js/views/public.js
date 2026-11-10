/* Trang công khai: trang chủ, tìm kiếm, mục từ, môn học, chủ đề */
import { Store } from '../store.js';
import { $, $$, esc, fold, sayBtn, ICON_SEARCH, toast, go } from '../util.js';
import { search, highlight } from '../search.js';

const GRADES = [6, 7, 8, 9];
const termCount = sid => Store.published().filter(t => t.subject_id === sid).length;
const subjTag = t => { const s = Store.subject(t.subject_id); return s ? `<span class="tag" style="--c:${s.color}">${esc(s.name_vi)}</span>` : ''; };

export const vcard = t => `<a class="vcard" href="#/term/${encodeURIComponent(t.id)}" style="--c:${Store.color(t.subject_id)}">
  <span class="grow"><b>${esc(t.term_en)}</b><span class="vi">${esc(t.term_vi)}</span></span>${sayBtn(t.term_en, { cls: 'sm' })}</a>`;

/* ---------- Ô tìm kiếm có gợi ý ---------- */
export function attachSuggest(input, { autofocus = false } = {}) {
  const box = document.createElement('div'); box.className = 'suggest hide'; box.setAttribute('role', 'listbox');
  input.parentElement.appendChild(box);
  let items = [], act = -1;
  const render = () => {
    const q = input.value;
    if (!fold(q)) { box.classList.add('hide'); return; }
    items = search(Store.published(), q).slice(0, 7).map(r => r.term);
    act = -1;
    box.innerHTML = items.length
      ? items.map((t, i) => `<a href="#/term/${encodeURIComponent(t.id)}" data-i="${i}"><span><b>${highlight(t.term_en, q)}</b> · ${highlight(t.term_vi, q)}</span>${subjTag(t)}</a>`).join('')
        + `<a href="#/search?q=${encodeURIComponent(q)}" class="small muted">Xem tất cả kết quả cho “${esc(q)}” →</a>`
      : `<a href="#/search?q=${encodeURIComponent(q)}" class="small muted">Không có gợi ý. Nhấn Enter để tìm “${esc(q)}”.</a>`;
    box.classList.remove('hide');
  };
  const mark = () => $$('a[data-i]', box).forEach((a, i) => a.classList.toggle('act', i === act));
  input.addEventListener('input', render);
  input.addEventListener('focus', render);
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { act = Math.min(items.length - 1, act + 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(-1, act - 1); mark(); e.preventDefault(); }
    else if (e.key === 'Escape') box.classList.add('hide');
    else if (e.key === 'Enter') {
      e.preventDefault(); box.classList.add('hide');
      if (act >= 0 && items[act]) go('#/term/' + encodeURIComponent(items[act].id));
      else if (input.value.trim()) go('#/search?q=' + encodeURIComponent(input.value.trim()));
    }
  });
  const onDoc = e => {
    if (!input.isConnected) return document.removeEventListener('click', onDoc);
    if (!input.parentElement.contains(e.target)) box.classList.add('hide');
  };
  document.addEventListener('click', onDoc);
  if (autofocus && matchMedia('(min-width: 700px)').matches) input.focus({ preventScroll: true });
}

/* ---------- Trang chủ ---------- */
export async function viewHome() {
  const pub = Store.published();
  const day = Math.floor(Date.now() / 864e5);
  const wod = pub.length ? pub[(day * 37) % pub.length] : null;
  const subjects = Store.cache.subjects.map(s => `
    <a class="space-card" href="#/subject/${s.id}" style="--c:${s.color}">
      <span class="ic">${esc(s.name_vi.charAt(0))}</span>
      <div class="en">${esc(s.name_en)}</div><h3>${esc(s.name_vi)}</h3>
      <p>${Store.topicsOf(s.id).map(t => esc(t.name_vi)).join(' · ')}</p>
      <span class="cnt">${termCount(s.id)}</span></a>`).join('');
  const examples = ['tam giác', 'photosynthesis', 'khối lượng', 'algorithm', 'kinh độ'];
  return {
    title: 'Trang chủ', active: 'home',
    html: `
    <section class="hero">
      <span class="floaty" style="width:60px;height:60px;background:#FFD84D;right:6%;top:18%"></span>
      <span class="floaty" style="width:34px;height:34px;background:#4CC9F0;right:22%;bottom:14%;animation-delay:1.2s"></span>
      <span class="floaty" style="width:44px;height:44px;background:#FF8FB8;right:40%;top:8%;animation-delay:2.2s"></span>
      <div class="kicker">Từ điển thuật ngữ cho học sinh THCS</div>
      <h1><span>Học môn nào,</span><span class="grad-text">nói tiếng Anh môn đó!</span></h1>
      <p style="font-size:18px;max-width:640px">Tra thuật ngữ Việt ⇄ Anh của Toán, Khoa học tự nhiên, Lịch sử và Địa lí, Tin học. Có phát âm, câu ví dụ đúng ngữ cảnh môn học, flashcard và quiz.</p>
      <div class="hero-search">${ICON_SEARCH}<input id="hero-q" type="search" placeholder="Gõ tiếng Việt hoặc tiếng Anh, có dấu hay không dấu đều được" autocomplete="off" aria-label="Tra cứu thuật ngữ"><button class="btn coral" id="hero-go">Tra cứu</button></div>
      <div class="row mt" style="gap:8px"><span class="small muted">Thử:</span>${examples.map(e => `<a class="chip" href="#/search?q=${encodeURIComponent(e)}">${esc(e)}</a>`).join('')}</div>
    </section>

    <h2 class="mt2">Chọn môn học</h2>
    <div class="grid g4">${subjects}</div>

    <div class="grid g2 mt2">
      ${wod ? `<div class="card" style="border-top:8px solid ${Store.color(wod.subject_id)}">
        <div class="kicker">Từ của ngày</div>
        <div class="row" style="gap:10px"><h2 class="mb0">${esc(wod.term_en)}</h2>${sayBtn(wod.term_en)}</div>
        <div class="term-vi" style="font-size:22px">${esc(wod.term_vi)}</div>
        <p class="muted">${esc(wod.ipa)} · ${esc(wod.pos)} · ${subjTag(wod)}</p>
        <p>${esc(wod.example_en)}</p>
        <a class="btn sm sky" href="#/term/${encodeURIComponent(wod.id)}">Xem chi tiết</a>
      </div>` : ''}
      <div class="card">
        <div class="kicker" style="color:var(--blue)">Học thế nào cho nhớ?</div>
        <h3>3 bước với SubjectDict</h3>
        <div class="list-row"><span class="tag" style="--c:#4CC9F0">1</span><span><b>Tra</b> thuật ngữ khi gặp trong bài học, nghe phát âm, đọc câu ví dụ.</span></div>
        <div class="list-row"><span class="tag" style="--c:#FF6B6B">2</span><span><b>Lưu</b> vào Sổ từ của em, ôn bằng flashcard.</span></div>
        <div class="list-row"><span class="tag" style="--c:#06D6A0">3</span><span><b>Kiểm tra</b> bằng quiz 10 câu theo chủ đề.</span></div>
        <div class="row mt"><a class="btn sm sun" href="#/quiz?scope=all">Làm quiz ngẫu nhiên</a>${Store.user ? '' : '<a class="btn sm ghost" href="#/login">Tạo tài khoản</a>'}</div>
      </div>
    </div>`,
    mount() {
      const inp = $('#hero-q'); attachSuggest(inp, { autofocus: true });
      $('#hero-go').onclick = () => { if (inp.value.trim()) go('#/search?q=' + encodeURIComponent(inp.value.trim())); else inp.focus(); };
    },
  };
}

/* ---------- Tìm kiếm ---------- */
const logged = new Set();
export async function viewSearch({ q }) {
  const query = q.q || '', f = { subject: q.s || '', topic: q.t || '', grade: q.g || '' };
  const res = search(Store.published(), query, f);
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
  const topics = f.subject ? Store.topicsOf(f.subject) : Store.cache.topics;
  const list = res.slice(0, 200).map(({ term: t }) => `
    <a class="result-item" href="#/term/${encodeURIComponent(t.id)}" style="--c:${Store.color(t.subject_id)}">
      <div class="grow">
        <div class="row" style="gap:8px"><h3>${highlight(t.term_en, query)}</h3><span class="ipa">${esc(t.ipa)}</span></div>
        <div style="font-weight:700;color:var(--pink)">${highlight(t.term_vi, query)}</div>
        <p class="muted">${esc(t.def_en)}</p>
        <div class="row small" style="gap:6px;margin-top:4px">${subjTag(t)}<span class="chip">Lớp ${t.grade}</span>${Store.topic(t.topic_id) ? `<span class="chip">${esc(Store.topic(t.topic_id).name_vi)}</span>` : ''}</div>
      </div>${sayBtn(t.term_en)}</a>`).join('');
  return {
    title: query ? `“${query}”` : 'Tra cứu', active: 'search',
    html: `
    <h1 style="font-size:clamp(26px,3.5vw,38px)">${query ? `Kết quả cho “${esc(query)}”` : 'Tất cả thuật ngữ'}</h1>
    <div class="filters">
      <select class="sel" id="f-s" aria-label="Môn">${opt('', 'Tất cả môn', f.subject)}${Store.cache.subjects.map(s => opt(s.id, s.name_vi, f.subject)).join('')}</select>
      <select class="sel" id="f-t" aria-label="Chủ đề">${opt('', 'Tất cả chủ đề', f.topic)}${topics.map(t => opt(t.id, t.name_vi, f.topic)).join('')}</select>
      <select class="sel" id="f-g" aria-label="Lớp">${opt('', 'Mọi lớp', f.grade)}${GRADES.map(g => opt(g, 'Lớp ' + g, f.grade)).join('')}</select>
      <span class="muted small">${res.length} kết quả</span>
    </div>
    ${res.length ? list : `<div class="card empty"><b>Chưa có thuật ngữ này</b>Thử gõ cách khác, bỏ bớt bộ lọc, hoặc tra bằng tiếng Anh nhé.<br><span class="small">Từ khoá của em đã được ghi lại để thầy cô bổ sung.</span></div>`}`,
    mount() {
      const upd = () => {
        const p = new URLSearchParams();
        if (query) p.set('q', query);
        const s = $('#f-s').value, t = $('#f-t').value, g = $('#f-g').value;
        if (s) p.set('s', s);
        if (t && (!s || Store.topic(t)?.subject_id === s)) p.set('t', t);
        if (g) p.set('g', g);
        go('#/search?' + p.toString());
      };
      ['#f-s', '#f-t', '#f-g'].forEach(id => $(id).onchange = upd);
      const key = fold(query);
      if (key.length >= 2 && !f.subject && !f.topic && !f.grade && !logged.has(key)) {
        logged.add(key); Store.logSearch(query.trim().slice(0, 100), res.length > 0);
      }
    },
  };
}

/* ---------- Chi tiết mục từ ---------- */
export async function viewTerm({ parts }) {
  const t = Store.term(decodeURIComponent(parts[1] || ''));
  if (!t) return viewNotFound();
  const s = Store.subject(t.subject_id), tp = Store.topic(t.topic_id);
  const related = (t.related || []).map(id => Store.term(id)).filter(Boolean);
  const same = Store.published().filter(x => x.id !== t.id && fold(x.term_en) === fold(t.term_en));
  const saved = Store.saved.has(t.id);
  return {
    title: t.term_en,
    active: 'subject:' + t.subject_id,
    html: `
    <div class="crumbs small"><a href="#/">Trang chủ</a> › ${s ? `<a href="#/subject/${s.id}">${esc(s.name_vi)}</a> › ` : ''}${tp ? `<a href="#/topic/${tp.id}">${esc(tp.name_vi)}</a> › ` : ''}${esc(t.term_en)}</div>
    <div class="grid" style="grid-template-columns:minmax(0,1fr)">
    <article class="card" style="border-top:10px solid ${Store.color(t.subject_id)}">
      ${t.status === 'draft' ? '<span class="status s-draft">Bản nháp (chỉ admin thấy)</span>' : ''}
      <div class="term-head">
        <div class="grow">
          <h1 class="term-en">${esc(t.term_en)}</h1>
          <div class="term-vi">${esc(t.term_vi)}</div>
          <div class="row" style="gap:10px">
            <span class="ipa-big">${esc(t.ipa)}</span>
            ${t.pos ? `<span class="chip">${esc(t.pos)}</span>` : ''}
            ${subjTag(t)}<span class="chip">Lớp ${t.grade}</span>
          </div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn sm sky" data-say="${esc(t.term_en)}" data-lang="en-US">🔊 US</button>
          <button class="btn sm violet" data-say="${esc(t.term_en)}" data-lang="en-GB">🔊 UK</button>
          <button class="btn sm sun" data-say="${esc(t.term_en)}" data-lang="en-US" data-rate="0.55">🐢 Đọc chậm</button>
        </div>
      </div>

      <div class="sec-label">Definition · Định nghĩa</div>
      <p class="def"><b>${esc(t.def_en)}</b></p>
      <p class="muted">${esc(t.def_vi)}</p>

      ${t.example_en ? `<div class="sec-label">Example · Ví dụ trong môn ${esc(s?.name_vi || '')}</div>
      <div class="ex">${sayBtn(t.example_en, { cls: 'sm', title: 'Nghe câu ví dụ' })}<div><div class="en">${highlight(t.example_en, t.term_en)}</div><div class="vi">${esc(t.example_vi)}</div></div></div>` : ''}

      ${t.note ? `<div class="sec-label">Lưu ý</div><div class="note-box">${esc(t.note)}</div>` : ''}

      ${same.length ? `<div class="sec-label">Cùng từ, khác môn</div><div class="vocab">${same.map(vcard).join('')}</div>` : ''}
      ${related.length ? `<div class="sec-label">Thuật ngữ liên quan</div><div class="vocab">${related.map(vcard).join('')}</div>` : ''}

      <div class="row mt">
        <button class="btn ghost save-btn ${saved ? 'on' : ''}" id="save">${saved ? '★ Đã lưu vào sổ từ' : '☆ Lưu vào sổ từ'}</button>
        ${tp ? `<a class="btn sky" href="#/flashcards?scope=topic:${tp.id}">Flashcard chủ đề này</a>` : ''}
        ${Store.isAdmin ? `<a class="btn ghost" href="#/admin/terms?edit=${encodeURIComponent(t.id)}">Sửa mục từ</a>` : ''}
      </div>
    </article></div>`,
    mount() {
      $('#save').onclick = async () => {
        if (!Store.user) { toast('Đăng nhập để lưu từ vào sổ nhé!'); go('#/login?next=' + encodeURIComponent(location.hash)); return; }
        try {
          const on = await Store.toggleSave(t.id);
          const b = $('#save'); b.classList.toggle('on', on); b.textContent = on ? '★ Đã lưu vào sổ từ' : '☆ Lưu vào sổ từ';
          toast(on ? 'Đã lưu vào Sổ từ của em' : 'Đã bỏ khỏi sổ từ');
        } catch (e) { toast('Lỗi: ' + e.message); }
      };
    },
  };
}

/* ---------- Môn học ---------- */
export async function viewSubject({ parts, q }) {
  const s = Store.subject(parts[1]);
  if (!s) return viewNotFound();
  const g = q.g || '';
  const terms = Store.published().filter(t => t.subject_id === s.id && (!g || String(t.grade) === g));
  const topics = Store.topicsOf(s.id).map(tp => {
    const n = terms.filter(t => t.topic_id === tp.id).length;
    return `<a class="unit" href="#/topic/${tp.id}${g ? '?g=' + g : ''}" style="--c:${s.color}"><div class="u">${esc(tp.name_en)}</div><h4>${esc(tp.name_vi)}</h4><span class="small muted">${n} thuật ngữ</span></a>`;
  }).join('');
  const tabs = ['', ...GRADES].map(x => `<a class="tab ${String(x) === g ? 'on' : ''}" href="#/subject/${s.id}${x ? '?g=' + x : ''}">${x ? 'Lớp ' + x : 'Tất cả'}</a>`).join('');
  return {
    title: s.name_vi, active: 'subject:' + s.id,
    html: `
    <div class="phead" style="--c:${s.color}">
      <div class="en">${esc(s.name_en)}</div><h1>${esc(s.name_vi)}</h1>
      <p>${terms.length} thuật ngữ${g ? ' lớp ' + g : ''}. Chọn chủ đề để học, hoặc ôn cả môn bằng flashcard và quiz.</p>
      <div class="row mt"><a class="btn sun sm" href="#/flashcards?scope=subject:${s.id}${g ? '&g=' + g : ''}">Flashcard cả môn</a><a class="btn ghost sm" href="#/quiz?scope=subject:${s.id}${g ? '&g=' + g : ''}">Quiz 10 câu</a></div>
    </div>
    <div class="tabs">${tabs}</div>
    <h2>Chủ đề</h2>
    <div class="unit-grid">${topics || '<p class="muted">Chưa có chủ đề.</p>'}</div>
    <h2 class="mt2">Tất cả thuật ngữ</h2>
    ${terms.length ? `<div class="vocab">${[...terms].sort((a, b) => a.term_en.localeCompare(b.term_en)).map(vcard).join('')}</div>` : '<div class="card empty"><b>Chưa có thuật ngữ</b></div>'}`,
  };
}

/* ---------- Chủ đề ---------- */
export async function viewTopic({ parts, q }) {
  const tp = Store.topic(parts[1]);
  if (!tp) return viewNotFound();
  const s = Store.subject(tp.subject_id);
  const g = q.g || '';
  const all = Store.published().filter(t => t.topic_id === tp.id);
  const terms = all.filter(t => !g || String(t.grade) === g).sort((a, b) => a.grade - b.grade || a.term_en.localeCompare(b.term_en));
  const grades = [...new Set(all.map(t => t.grade))].sort();
  const tabs = ['', ...grades].map(x => `<a class="tab ${String(x) === g ? 'on' : ''}" href="#/topic/${tp.id}${x ? '?g=' + x : ''}">${x ? 'Lớp ' + x : 'Tất cả'}</a>`).join('');
  const scope = `topic:${tp.id}${g ? '&g=' + g : ''}`;
  return {
    title: tp.name_vi, active: 'subject:' + tp.subject_id,
    html: `
    <div class="phead" style="--c:${s?.color}">
      <div class="crumbs"><a href="#/subject/${s?.id}">${esc(s?.name_vi)}</a> › ${esc(tp.name_vi)}</div>
      <div class="en">${esc(tp.name_en)}</div><h1>${esc(tp.name_vi)}</h1>
      <p>${terms.length} thuật ngữ. Đọc, nghe, rồi ôn bằng flashcard hoặc quiz.</p>
      <div class="row mt"><a class="btn sun sm" href="#/flashcards?scope=${scope}">Flashcard</a><a class="btn ghost sm" href="#/quiz?scope=${scope}">Quiz 10 câu</a></div>
    </div>
    ${grades.length > 1 ? `<div class="tabs">${tabs}</div>` : ''}
    ${terms.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>English</th><th>Tiếng Việt</th><th>Phiên âm</th><th>Lớp</th><th></th></tr></thead><tbody>
      ${terms.map(t => `<tr><td><a href="#/term/${encodeURIComponent(t.id)}" style="font-weight:800;color:var(--navy)">${esc(t.term_en)}</a></td><td>${esc(t.term_vi)}</td><td class="muted">${esc(t.ipa)}</td><td>${t.grade}</td><td style="width:50px">${sayBtn(t.term_en, { cls: 'sm' })}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="card empty"><b>Chưa có thuật ngữ</b></div>'}`,
  };
}

export async function viewNotFound() {
  return { title: 'Không tìm thấy', html: `<div class="card empty"><b>Không tìm thấy trang</b><p>Liên kết có thể đã bị đổi hoặc mục từ đã bị xoá.</p><a class="btn sky" href="#/">Về trang chủ</a></div>` };
}
