/* Trang quản trị */
import { Store, cleanTerm, newTermId } from '../store.js';
import { $, $$, esc, fold, slug, toast, modal, confirmBox, parseCSV, toCSV, download, go, fmtDate } from '../util.js';
import { search } from '../search.js';

const CSV_COLS = ['id', 'term_en', 'term_vi', 'subject_id', 'topic_id', 'grade', 'ipa', 'pos', 'def_en', 'def_vi', 'example_en', 'example_vi', 'note', 'related', 'status'];
const nav = cur => `<div class="admin-nav">${[['', 'Tổng quan'], ['terms', 'Mục từ'], ['topics', 'Môn & chủ đề'], ['users', 'Người dùng']]
  .map(([k, l]) => `<a class="tab ${cur === k ? 'on' : ''}" href="#/admin${k ? '/' + k : ''}">${l}</a>`).join('')}</div>`;
const head = (title, sub) => `<div class="phead" style="--c:#2EC4B6"><div class="en">Quản trị SubjectDict</div><h1>${title}</h1><p>${sub}</p></div>`;

export async function viewAdmin(ctx) {
  if (!Store.user) return { redirect: '#/login?next=' + encodeURIComponent(location.hash) };
  if (!Store.isAdmin) return { title: 'Quản trị', html: `<div class="card empty"><b>Em không có quyền truy cập trang này</b>Trang quản trị chỉ dành cho tài khoản admin.</div>` };
  const sub = ctx.parts[1] || '';
  const v = { '': dashboard, terms, topics, users }[sub];
  if (!v) return { redirect: '#/admin' };
  const r = await v(ctx);
  return { ...r, active: 'admin', html: nav(sub) + r.html };
}

/* ---------- Tổng quan ---------- */
async function dashboard() {
  const all = Store.cache.terms, pub = all.filter(t => t.status !== 'draft');
  const [logs, users] = await Promise.all([Store.getSearchLogs(30).catch(() => []), Store.listUsers().catch(() => [])]);
  const group = list => {
    const m = new Map();
    for (const l of list) { const k = fold(l.query); if (!k) continue; const e = m.get(k) || { q: l.query, n: 0 }; e.n++; m.set(k, e); }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 10);
  };
  const top = group(logs.filter(l => l.found));
  // từ khoá không có kết quả: kiểm tra lại với dữ liệu hiện tại để biết đã bổ sung chưa
  const miss = group(logs.filter(l => !l.found)).map(x => ({ ...x, now: search(pub, x.q).length > 0 }));
  const max = Math.max(1, ...Store.cache.subjects.map(s => pub.filter(t => t.subject_id === s.id).length));
  return {
    title: 'Quản trị',
    html: head('Tổng quan', 'Theo dõi kho thuật ngữ và nhu cầu tra cứu của học sinh trong 30 ngày gần nhất.') + `
    <div class="grid g4">
      <div class="kpi" style="background:linear-gradient(135deg,#4CC9F0,#4361EE)"><b>${pub.length}</b><span>thuật ngữ đã xuất bản</span></div>
      <div class="kpi" style="background:linear-gradient(135deg,#FFD84D,#FFB703);color:var(--navy)"><b>${all.length - pub.length}</b><span>bản nháp</span></div>
      <div class="kpi" style="background:linear-gradient(135deg,#FF8E53,#FF4D6D)"><b>${users.length}</b><span>người dùng</span></div>
      <div class="kpi" style="background:linear-gradient(135deg,#9D4EDD,#5A4FF3)"><b>${logs.length}</b><span>lượt tra cứu (30 ngày)</span></div>
    </div>
    <div class="grid g2 mt">
      <div class="card"><h3>Từ khoá chưa có kết quả</h3><p class="small muted">Nhu cầu thật của học sinh. Ưu tiên bổ sung các từ này.</p>
        ${miss.length ? miss.map(x => `<div class="list-row"><b class="grow">${esc(x.q)}</b><span class="chip">${x.n} lượt</span>
          ${x.now ? '<span class="status s-pub">Đã có</span>' : `<a class="btn sm sky" href="#/admin/terms?new=${encodeURIComponent(x.q)}">+ Thêm từ này</a>`}</div>`).join('') : '<p class="muted">Chưa có dữ liệu.</p>'}
      </div>
      <div class="card"><h3>Từ khoá tra nhiều nhất</h3><p class="small muted">Các lượt tra có kết quả.</p>
        ${top.length ? top.map(x => `<div class="list-row"><a class="grow" href="#/search?q=${encodeURIComponent(x.q)}">${esc(x.q)}</a><span class="chip">${x.n} lượt</span></div>`).join('') : '<p class="muted">Chưa có dữ liệu.</p>'}
      </div>
    </div>
    <div class="card mt"><h3>Thuật ngữ theo môn</h3>
      ${Store.cache.subjects.map(s => { const n = pub.filter(t => t.subject_id === s.id).length; return `<div class="hbar"><span>${esc(s.name_vi)}</span><div class="bar"><i style="width:${n / max * 100}%;background:${s.color}"></i></div><b>${n}</b></div>`; }).join('')}
    </div>
    <div class="card mt"><h3>Sao lưu</h3><p class="small muted">Gói Supabase miễn phí không có backup tự động. Hãy xuất dữ liệu định kì.</p>
      <div class="row"><a class="btn sm ghost" href="#/admin/terms">Xuất CSV / JSON ở trang Mục từ</a>
      ${Store.mode === 'demo' ? '<button class="btn sm danger" id="reset-demo">Đặt lại dữ liệu demo</button>' : ''}</div></div>`,
    mount() {
      const r = $('#reset-demo');
      if (r) r.onclick = async () => { if (await confirmBox('Xoá toàn bộ dữ liệu demo trên trình duyệt này và nạp lại 100 từ mẫu?')) { await Store.be.resetDemo(); location.hash = '#/'; location.reload(); } };
    },
  };
}

/* ---------- Mục từ ---------- */
const relatedToText = t => (t.related || []).map(id => Store.term(id)?.term_en || id).join(', ');
function textToRelated(text, subjectId, selfId) {
  return String(text || '').split(',').map(s => s.trim()).filter(Boolean).map(name => {
    if (Store.term(name)) return name;
    const c = Store.cache.terms.filter(t => fold(t.term_en) === fold(name) && t.id !== selfId);
    return (c.find(t => t.subject_id === subjectId) || c[0])?.id;
  }).filter(Boolean);
}

function termForm(t, isNew) {
  const subjOpts = Store.cache.subjects.map(s => `<option value="${s.id}" ${s.id === t.subject_id ? 'selected' : ''}>${esc(s.name_vi)}</option>`).join('');
  const f = (id, label, val, extra = '') => `<div class="field"><label for="${id}">${label}</label><input class="inp" id="${id}" value="${esc(val)}" ${extra}></div>`;
  const ta = (id, label, val) => `<div class="field"><label for="${id}">${label}</label><textarea class="inp" id="${id}">${esc(val)}</textarea></div>`;
  return `<h3>${isNew ? 'Thêm mục từ' : 'Sửa mục từ'}</h3>
    <form id="tf" novalidate>
    <div class="form-grid">
      ${f('t-en', 'Thuật ngữ tiếng Anh *', t.term_en, 'required maxlength="120"')}
      ${f('t-vi', 'Nghĩa tiếng Việt *', t.term_vi, 'required maxlength="160"')}
      <div class="field"><label for="t-sub">Môn *</label><select class="inp" id="t-sub">${subjOpts}</select></div>
      <div class="field"><label for="t-top">Chủ đề</label><select class="inp" id="t-top"></select></div>
      <div class="field"><label for="t-grade">Lớp *</label><select class="inp" id="t-grade">${[6, 7, 8, 9].map(g => `<option ${+t.grade === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
      <div class="field"><label for="t-status">Trạng thái</label><select class="inp" id="t-status"><option value="published" ${t.status !== 'draft' ? 'selected' : ''}>Xuất bản</option><option value="draft" ${t.status === 'draft' ? 'selected' : ''}>Nháp</option></select></div>
      ${f('t-ipa', 'Phiên âm IPA', t.ipa, 'placeholder="/ˈtraɪæŋɡl/"')}
      ${f('t-pos', 'Từ loại', t.pos, 'placeholder="noun / verb / adjective" list="pos-list"')}
    </div>
    <datalist id="pos-list"><option>noun</option><option>verb</option><option>adjective</option><option>adverb</option><option>noun (plural)</option><option>phrase</option></datalist>
    ${ta('t-def-en', 'Định nghĩa tiếng Anh (đơn giản, A2–B1)', t.def_en)}
    ${ta('t-def-vi', 'Định nghĩa tiếng Việt', t.def_vi)}
    <div class="form-grid">${ta('t-ex-en', 'Câu ví dụ (EN) theo ngữ cảnh môn học', t.example_en)}${ta('t-ex-vi', 'Dịch câu ví dụ (VI)', t.example_vi)}</div>
    ${ta('t-note', 'Lưu ý / lỗi thường gặp', t.note)}
    ${f('t-rel', 'Thuật ngữ liên quan (tiếng Anh, cách nhau bằng dấu phẩy)', relatedToText(t), 'placeholder="triangle, right angle"')}
    <div class="form-msg err" id="t-msg"></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" id="t-cancel">Huỷ</button><button class="btn mint" id="t-save">Lưu</button></div>
    </form>`;
}

function openTermEditor(t, isNew, onDone) {
  const md = modal(termForm(t, isNew));
  const el = md.el;
  const fillTopics = () => {
    const sid = $('#t-sub', el).value;
    $('#t-top', el).innerHTML = `<option value="">— Không —</option>` + Store.topicsOf(sid).map(tp => `<option value="${tp.id}" ${tp.id === t.topic_id ? 'selected' : ''}>${esc(tp.name_vi)}</option>`).join('');
  };
  fillTopics(); $('#t-sub', el).onchange = fillTopics;
  $('#t-cancel', el).onclick = md.close;
  $('#tf', el).onsubmit = async e => {
    e.preventDefault();
    const v = id => $(id, el).value.trim();
    const row = {
      ...t, term_en: v('#t-en'), term_vi: v('#t-vi'), subject_id: v('#t-sub'), topic_id: v('#t-top') || null, grade: +v('#t-grade'), status: v('#t-status'),
      ipa: v('#t-ipa'), pos: v('#t-pos'), def_en: v('#t-def-en'), def_vi: v('#t-def-vi'), example_en: v('#t-ex-en'), example_vi: v('#t-ex-vi'), note: v('#t-note'),
    };
    if (!row.term_en || !row.term_vi) { $('#t-msg', el).textContent = 'Cần nhập thuật ngữ tiếng Anh và nghĩa tiếng Việt.'; return; }
    if (isNew) {
      row.id = newTermId(row.term_en);
      const dup = Store.cache.terms.find(x => fold(x.term_en) === fold(row.term_en) && x.subject_id === row.subject_id);
      if (dup && !(await confirmBox(`Môn này đã có “${dup.term_en}”. Vẫn thêm mục mới?`))) return;
    }
    row.related = textToRelated(v('#t-rel'), row.subject_id, row.id);
    const btn = $('#t-save', el); btn.disabled = true;
    try { await Store.upsertTerms([row]); md.close(); toast('Đã lưu “' + row.term_en + '”'); onDone && onDone(row); }
    catch (err) { $('#t-msg', el).textContent = 'Lỗi: ' + err.message; btn.disabled = false; }
  };
  setTimeout(() => $('#t-en', el).focus(), 50);
}

async function terms({ q }) {
  const subjOpts = Store.cache.subjects.map(s => `<option value="${s.id}">${esc(s.name_vi)}</option>`).join('');
  return {
    title: 'Quản trị · Mục từ',
    html: head('Mục từ', `${Store.cache.terms.length} mục từ. Thêm, sửa, nhập hàng loạt từ CSV hoặc xuất dữ liệu để sao lưu.`) + `
    <div class="row">
      <button class="btn mint" id="new">+ Thêm mục từ</button>
      <label class="btn ghost" for="csv-in" style="cursor:pointer">⬆ Import CSV</label><input type="file" id="csv-in" accept=".csv,text/csv" class="hide">
      <button class="btn ghost" id="exp-csv">⬇ Export CSV</button><button class="btn ghost" id="exp-json">⬇ Export JSON</button>
      <button class="btn ghost sm" id="tpl">Tải file CSV mẫu</button>
    </div>
    <div class="filters">
      <input class="inp" id="a-q" placeholder="Lọc theo từ…" style="max-width:260px">
      <select class="sel" id="a-s"><option value="">Tất cả môn</option>${subjOpts}</select>
      <select class="sel" id="a-st"><option value="">Mọi trạng thái</option><option value="published">Xuất bản</option><option value="draft">Nháp</option></select>
      <span class="small muted" id="a-n"></span>
    </div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>English</th><th>Tiếng Việt</th><th>Môn / chủ đề</th><th>Lớp</th><th>Trạng thái</th><th></th></tr></thead><tbody id="a-rows"></tbody></table></div>
    <div class="center mt"><button class="btn ghost hide" id="more">Xem thêm</button></div>`,
    mount() {
      let limit = 50;
      const draw = () => {
        const s = $('#a-s').value, st = $('#a-st').value;
        let list = search(Store.cache.terms, $('#a-q').value, { subject: s }).map(r => r.term);
        if (st) list = list.filter(t => (t.status || 'published') === st);
        $('#a-n').textContent = list.length + ' mục';
        $('#a-rows').innerHTML = list.slice(0, limit).map(t => `<tr>
          <td><a href="#/term/${encodeURIComponent(t.id)}" style="font-weight:800;color:var(--navy)">${esc(t.term_en)}</a></td><td>${esc(t.term_vi)}</td>
          <td class="small"><span class="tag" style="--c:${Store.color(t.subject_id)}">${esc(Store.subject(t.subject_id)?.name_vi || t.subject_id)}</span> ${esc(Store.topic(t.topic_id)?.name_vi || '')}</td>
          <td>${t.grade}</td><td><span class="status ${t.status === 'draft' ? 's-draft' : 's-pub'}">${t.status === 'draft' ? 'Nháp' : 'Xuất bản'}</span></td>
          <td style="white-space:nowrap"><button class="btn sm ghost" data-edit="${esc(t.id)}">Sửa</button> <button class="btn sm danger" data-del="${esc(t.id)}">Xoá</button></td></tr>`).join('')
          || `<tr><td colspan="6" class="center muted">Không có mục nào.</td></tr>`;
        $('#more').classList.toggle('hide', list.length <= limit);
      };
      ['#a-q', '#a-s', '#a-st'].forEach(id => $(id).addEventListener('input', () => { limit = 50; draw(); }));
      $('#more').onclick = () => { limit += 50; draw(); };
      $('#a-rows').onclick = async e => {
        const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
        if (ed) openTermEditor(Store.term(ed.dataset.edit), false, draw);
        if (del) {
          const t = Store.term(del.dataset.del);
          if (await confirmBox(`Xoá vĩnh viễn “${t.term_en}”?`)) { try { await Store.deleteTerm(t.id); toast('Đã xoá'); draw(); } catch (err) { toast('Lỗi: ' + err.message); } }
        }
      };
      const blank = () => ({ subject_id: $('#a-s').value || Store.cache.subjects[0]?.id, grade: 6, status: 'published', related: [] });
      $('#new').onclick = () => openTermEditor(blank(), true, draw);
      $('#exp-csv').onclick = () => download(`subjectdict-terms-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(Store.cache.terms, CSV_COLS), 'text/csv');
      $('#exp-json').onclick = () => download(`subjectdict-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify({ exported_at: new Date().toISOString(), subjects: Store.cache.subjects, topics: Store.cache.topics, terms: Store.cache.terms }, null, 2), 'application/json');
      $('#tpl').onclick = () => download('subjectdict-mau.csv', toCSV([{
        id: '', term_en: 'thermometer', term_vi: 'nhiệt kế', subject_id: 'science', topic_id: 's-phy', grade: 6, ipa: '/θəˈmɒmɪtə(r)/', pos: 'noun',
        def_en: 'A tool used to measure temperature.', def_vi: 'Dụng cụ dùng để đo nhiệt độ.', example_en: 'Use a thermometer to measure the water temperature.',
        example_vi: 'Dùng nhiệt kế để đo nhiệt độ của nước.', note: '', related: 'energy', status: 'published',
      }], CSV_COLS), 'text/csv');
      $('#csv-in').onchange = async e => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        importPreview(parseCSV(await file.text()), draw);
      };
      draw();
      // mở sẵn form khi đến từ "Sửa mục từ" hoặc "Thêm từ này"
      if (q.edit && Store.term(q.edit)) openTermEditor(Store.term(q.edit), false, draw);
      else if (q.new) {
        const isVi = /[^\x00-\x7F]/.test(q.new);
        openTermEditor({ ...blank(), term_en: isVi ? '' : q.new, term_vi: isVi ? q.new : '' }, true, draw);
      }
      if (q.edit || q.new) history.replaceState(null, '', '#/admin/terms');
    },
  };
}

function importPreview(rows, onDone) {
  const subjects = new Set(Store.cache.subjects.map(s => s.id));
  const ok = [], errs = [];
  rows.forEach((r, i) => {
    const line = i + 2;
    if (!r.term_en || !r.term_vi) return errs.push(`Dòng ${line}: thiếu term_en hoặc term_vi`);
    if (!subjects.has(r.subject_id)) return errs.push(`Dòng ${line}: subject_id “${r.subject_id}” không tồn tại`);
    if (r.topic_id && Store.topic(r.topic_id)?.subject_id !== r.subject_id) return errs.push(`Dòng ${line}: topic_id “${r.topic_id}” không thuộc môn ${r.subject_id}`);
    const g = parseInt(r.grade, 10);
    if (!(g >= 6 && g <= 9)) return errs.push(`Dòng ${line}: grade phải từ 6 đến 9`);
    let id = r.id;
    if (!id) {
      const ex = Store.cache.terms.find(t => fold(t.term_en) === fold(r.term_en) && t.subject_id === r.subject_id);
      id = ex ? ex.id : newTermId(r.term_en);
    }
    ok.push(cleanTerm({ ...r, id, grade: g }));
  });
  const upd = ok.filter(t => Store.term(t.id)).length;
  const md = modal(`<h3>Nhập từ CSV</h3>
    <div class="ok-box"><b>${ok.length}</b> dòng hợp lệ: ${ok.length - upd} mục mới, ${upd} mục cập nhật.</div>
    ${errs.length ? `<div class="warn-box mt"><b>${errs.length} dòng lỗi (sẽ bỏ qua):</b><br><span class="small">${errs.slice(0, 15).map(esc).join('<br>')}${errs.length > 15 ? '<br>…' : ''}</span></div>` : ''}
    <div class="row mt" style="justify-content:flex-end"><button class="btn ghost" id="i-no">Huỷ</button><button class="btn mint" id="i-go" ${ok.length ? '' : 'disabled'}>Nhập ${ok.length} mục</button></div>`);
  $('#i-no', md.el).onclick = md.close;
  $('#i-go', md.el).onclick = async () => {
    const b = $('#i-go', md.el); b.disabled = true; b.textContent = 'Đang nhập…';
    try { await Store.upsertTerms(ok); md.close(); toast(`Đã nhập ${ok.length} mục từ`); onDone(); }
    catch (e) { toast('Lỗi: ' + e.message); b.disabled = false; b.textContent = 'Thử lại'; }
  };
}

/* ---------- Môn & chủ đề ---------- */
function editSubject(s, isNew) {
  const md = modal(`<h3>${isNew ? 'Thêm môn học' : 'Sửa môn học'}</h3><form id="sf">
    <div class="form-grid">
      <div class="field"><label>Tên tiếng Việt *</label><input class="inp" id="s-vi" value="${esc(s.name_vi || '')}" required></div>
      <div class="field"><label>Tên tiếng Anh *</label><input class="inp" id="s-en" value="${esc(s.name_en || '')}" required></div>
      <div class="field"><label>Mã (id)</label><input class="inp" id="s-id" value="${esc(s.id || '')}" ${isNew ? 'placeholder="tự tạo từ tên tiếng Anh"' : 'disabled'}></div>
      <div class="field"><label>Màu</label><input class="inp" type="color" id="s-color" value="${esc(s.color || '#4361EE')}" style="height:46px;padding:4px"></div>
      <div class="field"><label>Thứ tự</label><input class="inp" type="number" id="s-sort" value="${s.sort ?? Store.cache.subjects.length + 1}"></div>
    </div><div class="form-msg err" id="s-msg"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn mint">Lưu</button></div></form>`);
  $('#sf', md.el).onsubmit = async e => {
    e.preventDefault();
    const row = { id: isNew ? (slug($('#s-id', md.el).value || $('#s-en', md.el).value)) : s.id, name_vi: $('#s-vi', md.el).value.trim(), name_en: $('#s-en', md.el).value.trim(), color: $('#s-color', md.el).value, sort: +$('#s-sort', md.el).value || 0 };
    if (!row.name_vi || !row.name_en) return $('#s-msg', md.el).textContent = 'Cần nhập đủ tên.';
    if (isNew && Store.subject(row.id)) return $('#s-msg', md.el).textContent = 'Mã môn đã tồn tại.';
    try { await Store.upsertSubject(row); md.close(); toast('Đã lưu môn học'); go('#/admin/topics'); } catch (err) { $('#s-msg', md.el).textContent = err.message; }
  };
}
function editTopic(t, isNew) {
  const md = modal(`<h3>${isNew ? 'Thêm chủ đề' : 'Sửa chủ đề'} · ${esc(Store.subject(t.subject_id)?.name_vi || '')}</h3><form id="pf">
    <div class="form-grid">
      <div class="field"><label>Tên tiếng Việt *</label><input class="inp" id="p-vi" value="${esc(t.name_vi || '')}" required></div>
      <div class="field"><label>Tên tiếng Anh *</label><input class="inp" id="p-en" value="${esc(t.name_en || '')}" required></div>
      <div class="field"><label>Thứ tự</label><input class="inp" type="number" id="p-sort" value="${t.sort ?? Store.topicsOf(t.subject_id).length + 1}"></div>
    </div><div class="form-msg err" id="p-msg"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn mint">Lưu</button></div></form>`);
  $('#pf', md.el).onsubmit = async e => {
    e.preventDefault();
    const row = { id: isNew ? t.subject_id + '-' + slug($('#p-en', md.el).value).slice(0, 30) : t.id, subject_id: t.subject_id, name_vi: $('#p-vi', md.el).value.trim(), name_en: $('#p-en', md.el).value.trim(), sort: +$('#p-sort', md.el).value || 0 };
    if (!row.name_vi || !row.name_en) return $('#p-msg', md.el).textContent = 'Cần nhập đủ tên.';
    if (isNew && Store.topic(row.id)) return $('#p-msg', md.el).textContent = 'Chủ đề này đã tồn tại.';
    try { await Store.upsertTopic(row); md.close(); toast('Đã lưu chủ đề'); go('#/admin/topics'); } catch (err) { $('#p-msg', md.el).textContent = err.message; }
  };
}
async function topics() {
  const cnt = (k, v) => Store.cache.terms.filter(t => t[k] === v).length;
  return {
    title: 'Quản trị · Môn & chủ đề',
    html: head('Môn & chủ đề', 'Phân loại thuật ngữ theo môn và chủ đề, không theo bộ sách giáo khoa nào.') + `
    <button class="btn mint" id="new-sub">+ Thêm môn học</button>
    <div class="grid g2 mt">${Store.cache.subjects.map(s => `
      <div class="card" style="border-top:8px solid ${s.color}">
        <div class="row between"><div><div class="small muted">${esc(s.name_en)} · <code>${esc(s.id)}</code></div><h3 class="mb0">${esc(s.name_vi)}</h3><span class="small muted">${cnt('subject_id', s.id)} thuật ngữ</span></div>
          <div class="row" style="gap:6px"><button class="btn sm ghost" data-es="${s.id}">Sửa</button><button class="btn sm danger" data-ds="${s.id}">Xoá</button></div></div>
        <div class="mt">${Store.topicsOf(s.id).map(tp => `<div class="list-row"><span class="grow"><b>${esc(tp.name_vi)}</b> <span class="small muted">${esc(tp.name_en)} · ${cnt('topic_id', tp.id)} từ</span></span>
          <button class="btn sm ghost" data-et="${tp.id}">Sửa</button><button class="btn sm danger" data-dt="${tp.id}">Xoá</button></div>`).join('') || '<p class="muted small">Chưa có chủ đề.</p>'}</div>
        <button class="btn sm sky mt" data-nt="${s.id}">+ Thêm chủ đề</button>
      </div>`).join('')}</div>`,
    mount(root) {
      $('#new-sub').onclick = () => editSubject({}, true);
      root.addEventListener('click', async e => {
        const b = e.target.closest('button'); if (!b) return;
        const d = b.dataset;
        if (d.es) editSubject(Store.subject(d.es), false);
        if (d.nt) editTopic({ subject_id: d.nt }, true);
        if (d.et) editTopic(Store.topic(d.et), false);
        if (d.ds && await confirmBox(`Xoá môn “${Store.subject(d.ds).name_vi}” sẽ xoá luôn ${cnt('subject_id', d.ds)} thuật ngữ và các chủ đề của môn. Tiếp tục?`)) {
          try { await Store.deleteSubject(d.ds); toast('Đã xoá môn'); go('#/admin/topics'); } catch (err) { toast('Lỗi: ' + err.message); }
        }
        if (d.dt && await confirmBox(`Xoá chủ đề “${Store.topic(d.dt).name_vi}”? Các thuật ngữ vẫn được giữ, chỉ bỏ gắn chủ đề.`)) {
          try { await Store.deleteTopic(d.dt); toast('Đã xoá chủ đề'); go('#/admin/topics'); } catch (err) { toast('Lỗi: ' + err.message); }
        }
      });
    },
  };
}

/* ---------- Người dùng ---------- */
async function users() {
  const list = await Store.listUsers();
  return {
    title: 'Quản trị · Người dùng',
    html: head('Người dùng', `${list.length} tài khoản. Cấp hoặc gỡ quyền quản trị.`) + `
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tên</th><th>Email</th><th>Lớp</th><th>Vai trò</th><th>Ngày tạo</th><th></th></tr></thead><tbody>
    ${list.map(u => `<tr><td><b>${esc(u.display_name || '—')}</b></td><td>${esc(u.email || '')}</td><td>${u.grade || '—'}</td>
      <td><span class="status ${u.role === 'admin' ? 's-admin' : 's-student'}">${u.role === 'admin' ? 'Admin' : 'Học sinh'}</span></td><td class="small">${fmtDate(u.created_at)}</td>
      <td>${u.id === Store.user.id ? '<span class="small muted">(em)</span>' : `<button class="btn sm ${u.role === 'admin' ? 'danger' : 'ghost'}" data-role="${u.role === 'admin' ? 'student' : 'admin'}" data-id="${esc(u.id)}">${u.role === 'admin' ? 'Gỡ quyền admin' : 'Cấp quyền admin'}</button>`}</td></tr>`).join('')}
    </tbody></table></div>`,
    mount(root) {
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-role]'); if (!b) return;
        if (!(await confirmBox(b.dataset.role === 'admin' ? 'Cấp quyền quản trị cho tài khoản này?' : 'Gỡ quyền quản trị của tài khoản này?'))) return;
        try { await Store.setRole(b.dataset.id, b.dataset.role); toast('Đã cập nhật'); go('#/admin/users'); } catch (err) { toast('Lỗi: ' + err.message); }
      });
    },
  };
}
