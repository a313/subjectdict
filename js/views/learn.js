/* Học tập: flashcard, quiz, trang cá nhân, đăng nhập */
import { Store } from '../store.js';
import { $, $$, esc, sayBtn, shuffle, speak, canSpeak, toast, confetti, go, fmtDate, modal } from '../util.js';
import { vcard } from './public.js';

/* ---------- Phạm vi học: topic:<id> | subject:<id> | saved | all ---------- */
function resolveScope(q) {
  const scope = q.scope || 'all', g = q.g || '';
  const [kind, id] = scope.split(':');
  let terms = Store.published(), label = 'Tất cả thuật ngữ', back = '#/';
  if (kind === 'topic') { const t = Store.topic(id); terms = terms.filter(x => x.topic_id === id); label = t ? t.name_vi : 'Chủ đề'; back = '#/topic/' + id; }
  else if (kind === 'subject') { const s = Store.subject(id); terms = terms.filter(x => x.subject_id === id); label = s ? s.name_vi : 'Môn học'; back = '#/subject/' + id; }
  else if (kind === 'saved') { terms = terms.filter(x => Store.saved.has(x.id)); label = 'Sổ từ của em'; back = '#/me'; }
  if (g) { terms = terms.filter(x => String(x.grade) === g); label += ' · Lớp ' + g; }
  return { scope: scope + (g ? '&g=' + g : ''), terms, label, back };
}

/* ---------- Flashcard ---------- */
export async function viewFlashcards({ q }) {
  const sc = resolveScope(q);
  if (q.scope === 'saved' && !Store.user) return { redirect: '#/login?next=' + encodeURIComponent(location.hash) };
  if (!sc.terms.length) return { title: 'Flashcard', html: `<div class="card empty"><b>Chưa có thẻ nào để ôn</b>${q.scope === 'saved' ? 'Hãy lưu vài thuật ngữ vào sổ từ trước nhé.' : ''}<div class="mt"><a class="btn sky" href="${sc.back}">Quay lại</a></div></div>` };
  return {
    title: 'Flashcard · ' + sc.label, active: 'learn',
    html: `
    <div class="tabs"><a class="tab" href="${sc.back}">← ${esc(sc.label)}</a></div>
    <div class="fc-stage"><div id="fc-done" class="hide"></div><div id="fc-main">
      <div class="row between"><h2 class="mb0">Flashcard</h2>
        <div class="row" style="gap:6px"><button class="chip on" data-dir="en">EN → VI</button><button class="chip" data-dir="vi">VI → EN</button><button class="chip" id="fc-shuffle">🔀 Trộn</button></div></div>
      <div class="row between mt small"><span id="fc-pos" class="muted"></span><span><b id="fc-known" style="color:#06A77D">0</b> đã nhớ · <b id="fc-again" style="color:#C0263D">0</b> cần ôn</span></div>
      <div class="bar" style="margin-top:6px"><i id="fc-bar" style="width:0"></i></div>
      <div class="fc" id="fc" tabindex="0" role="button" aria-label="Lật thẻ"><div class="fc-inner">
        <div class="fc-face fc-front" id="fc-front"></div><div class="fc-face fc-back" id="fc-back"></div></div></div>
      <div class="row" style="justify-content:center">
        <button class="btn coral" id="fc-no">✗ Chưa nhớ</button>
        <button class="btn ghost" id="fc-flip">Lật thẻ (Space)</button>
        <button class="btn mint" id="fc-yes">✓ Đã nhớ</button>
      </div>
      <p class="center small muted mt">Phím tắt: Space lật thẻ · ← chưa nhớ · → đã nhớ</p>
    </div></div>`,
    mount(root) {
      let deck = shuffle(sc.terms), i = 0, dir = 'en', known = new Set(), again = new Set();
      const fc = $('#fc', root);
      const draw = () => {
        if (i >= deck.length) return finish();
        $('#fc-main').classList.remove('hide'); $('#fc-done').classList.add('hide');
        const t = deck[i]; fc.classList.remove('flip');
        const en = `<b>${esc(t.term_en)}</b><div class="fc-hint">${esc(t.ipa)}</div>`;
        const vi = `<b>${esc(t.term_vi)}</b>`;
        $('#fc-front').innerHTML = (dir === 'en' ? en : vi) + `<div class="fc-hint">Nhấn để lật</div>`;
        $('#fc-back').innerHTML = (dir === 'en' ? vi : en) + `<p class="muted small" style="margin-top:10px">${esc(t.example_en)}</p>${sayBtn(t.term_en)}`;
        $('#fc-pos').textContent = `Thẻ ${i + 1} / ${deck.length}`;
        $('#fc-bar').style.width = (i / deck.length * 100) + '%';
        $('#fc-known').textContent = known.size; $('#fc-again').textContent = again.size;
        if (dir === 'en' && canSpeak()) speak(t.term_en);
      };
      const next = ok => { const t = deck[i]; if (!t) return; (ok ? known : again).add(t.id); (ok ? again : known).delete(t.id); i++; draw(); };
      const finish = () => {
        const rest = deck.filter(t => again.has(t.id));
        $('#fc-main').classList.add('hide');
        const done = $('#fc-done'); done.classList.remove('hide');
        done.innerHTML = `<div class="card center"><div class="score-big">${known.size}/${deck.length}</div><h2>Hoàn thành bộ thẻ!</h2>
          <p>${rest.length ? `Còn <b>${rest.length}</b> thẻ cần ôn thêm.` : 'Em đã nhớ hết. Tuyệt vời!'}</p>
          <div class="row" style="justify-content:center">${rest.length ? '<button class="btn coral" id="fc-retry">Ôn lại thẻ chưa nhớ</button>' : ''}<a class="btn sun" href="#/quiz?scope=${sc.scope}">Làm quiz</a><a class="btn ghost" href="${sc.back}">Quay lại</a></div></div>`;
        if (!rest.length) confetti();
        const r = $('#fc-retry'); if (r) r.onclick = () => { deck = shuffle(rest); i = 0; known.clear(); again.clear(); draw(); };
      };
      fc.onclick = e => { if (!e.target.closest('[data-say]')) fc.classList.toggle('flip'); };
      $('#fc-flip').onclick = () => fc.classList.toggle('flip');
      $('#fc-yes').onclick = () => next(true);
      $('#fc-no').onclick = () => next(false);
      $('#fc-shuffle').onclick = () => { deck = shuffle(deck); i = 0; known.clear(); again.clear(); draw(); };
      $$('[data-dir]', root).forEach(b => b.onclick = () => { dir = b.dataset.dir; $$('[data-dir]', root).forEach(x => x.classList.toggle('on', x === b)); draw(); });
      const key = e => {
        if (!document.body.contains(fc)) return document.removeEventListener('keydown', key);
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || i >= deck.length) return;
        if (e.key === ' ') { e.preventDefault(); fc.classList.toggle('flip'); }
        else if (e.key === 'ArrowRight') next(true);
        else if (e.key === 'ArrowLeft') next(false);
      };
      document.addEventListener('keydown', key);
      draw();
    },
  };
}

/* ---------- Quiz ---------- */
function blankOut(sentence, term) {
  const re = new RegExp('\\b' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?\\b', 'i');
  return re.test(sentence) ? sentence.replace(re, '_____') : null;
}
function buildQuiz(pool, n = 10) {
  const all = Store.published();
  const pick = shuffle(pool).slice(0, n);
  return pick.map(t => {
    const sameSub = shuffle(all.filter(x => x.id !== t.id && x.subject_id === t.subject_id && x.term_en.toLowerCase() !== t.term_en.toLowerCase()));
    const others = shuffle(all.filter(x => x.id !== t.id && x.subject_id !== t.subject_id));
    const distract = [...sameSub, ...others].filter((x, i, a) => a.findIndex(y => y.term_vi === x.term_vi || y.term_en === x.term_en) === i).slice(0, 3);
    const types = ['en2vi', 'vi2en'];
    if (canSpeak()) types.push('listen');
    const cloze = t.example_en && blankOut(t.example_en, t.term_en);
    if (cloze) types.push('cloze', 'cloze');
    const type = types[Math.floor(Math.random() * types.length)];
    const field = type === 'en2vi' ? 'term_vi' : 'term_en';
    const opts = shuffle([t, ...distract]).map(x => ({ id: x.id, label: x[field] }));
    return { t, type, opts, cloze };
  });
}
export async function viewQuiz({ q }) {
  const sc = resolveScope(q);
  if (q.scope === 'saved' && !Store.user) return { redirect: '#/login?next=' + encodeURIComponent(location.hash) };
  if (sc.terms.length < 4) return { title: 'Quiz', html: `<div class="card empty"><b>Cần ít nhất 4 thuật ngữ để làm quiz</b>Phạm vi “${esc(sc.label)}” hiện có ${sc.terms.length} thuật ngữ.<div class="mt"><a class="btn sky" href="${sc.back}">Quay lại</a></div></div>` };
  return {
    title: 'Quiz · ' + sc.label, active: 'learn',
    html: `<div class="tabs"><a class="tab" href="${sc.back}">← ${esc(sc.label)}</a></div><div id="quiz"></div>`,
    mount(root) {
      const qs = buildQuiz(sc.terms); let i = 0, score = 0; const wrong = [];
      const box = $('#quiz', root);
      const prompts = {
        en2vi: x => `<div class="qt">Chọn nghĩa tiếng Việt đúng:</div><div class="row"><span class="qbig">${esc(x.t.term_en)}</span>${sayBtn(x.t.term_en)}</div>`,
        vi2en: x => `<div class="qt">Thuật ngữ tiếng Anh của:</div><div class="qbig">${esc(x.t.term_vi)}</div>`,
        listen: x => `<div class="qt">Nghe và chọn từ đúng:</div><div class="row"><button class="btn sky" data-say="${esc(x.t.term_en)}" data-lang="en-US">🔊 Nghe</button><button class="btn ghost sm" data-say="${esc(x.t.term_en)}" data-lang="en-US" data-rate="0.55">🐢 Nghe chậm</button></div>`,
        cloze: x => `<div class="qt">Điền thuật ngữ thích hợp vào chỗ trống:</div><div style="font-size:21px;font-weight:600;color:var(--navy)">${esc(x.cloze)}</div><div class="small muted">(${esc(x.t.term_vi)})</div>`,
      };
      const draw = () => {
        if (i >= qs.length) return finish();
        const x = qs[i];
        box.innerHTML = `<div class="q">
          <div class="row between small muted"><span>Câu ${i + 1} / ${qs.length}</span><span class="counter">${score} điểm</span></div>
          <div class="bar" style="margin:6px 0 16px"><i style="width:${i / qs.length * 100}%"></i></div>
          ${prompts[x.type](x)}
          <div class="opts mt">${x.opts.map(o => `<button class="opt" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>
          <div id="fb"></div></div>`;
        if (x.type === 'listen') setTimeout(() => speak(x.t.term_en), 300);
        $$('.opt', box).forEach(b => b.onclick = () => {
          const ok = b.dataset.id === x.t.id;
          $$('.opt', box).forEach(o => { o.disabled = true; if (o.dataset.id === x.t.id) o.classList.add('right'); });
          if (ok) score++; else { b.classList.add('wrong'); wrong.push(x.t); }
          $('#fb', box).innerHTML = `<div class="fb ${ok ? 'ok' : 'no'}">${ok ? '✓ Chính xác!' : '✗ Chưa đúng.'} <b>${esc(x.t.term_en)}</b> = ${esc(x.t.term_vi)}. <span class="small">${esc(x.t.example_en)}</span></div>
            <div class="row mt" style="justify-content:flex-end"><button class="btn sky" id="nx">${i + 1 < qs.length ? 'Câu tiếp →' : 'Xem kết quả'}</button></div>`;
          $('#nx', box).onclick = () => { i++; draw(); };
          $('#nx', box).focus();
        });
      };
      const finish = async () => {
        const pct = score / qs.length;
        box.innerHTML = `<div class="q center"><div class="score-big">${score}/${qs.length}</div>
          <h2>${pct >= .8 ? 'Xuất sắc!' : pct >= .5 ? 'Khá lắm, cố thêm chút nữa!' : 'Ôn lại rồi thử lần nữa nhé!'}</h2>
          ${Store.user ? '<p class="small muted">Kết quả đã được lưu vào trang cá nhân.</p>' : '<p class="small muted"><a href="#/login">Đăng nhập</a> để lưu kết quả.</p>'}
          ${wrong.length ? `<div class="sec-label">Từ cần ôn</div><div class="vocab" style="text-align:left">${wrong.map(vcard).join('')}</div>` : ''}
          <div class="row mt" style="justify-content:center"><button class="btn coral" id="again">Làm lại</button><a class="btn sun" href="#/flashcards?scope=${sc.scope}">Ôn bằng flashcard</a><a class="btn ghost" href="${sc.back}">Quay lại</a></div></div>`;
        if (pct >= .8) confetti();
        $('#again', box).onclick = () => go(location.hash);
        if (Store.user) Store.addQuizResult({ scope: sc.label, score, total: qs.length }).catch(e => toast('Không lưu được kết quả: ' + e.message));
      };
      draw();
    },
  };
}

/* ---------- Trang cá nhân ---------- */
export async function viewMe() {
  if (!Store.user) return { redirect: '#/login?next=%23%2Fme' };
  const u = Store.user;
  const saved = Store.published().filter(t => Store.saved.has(t.id));
  const results = await Store.getQuizResults().catch(() => []);
  const bySub = Store.cache.subjects.map(s => ({ s, list: saved.filter(t => t.subject_id === s.id) })).filter(x => x.list.length);
  const avg = results.length ? Math.round(results.reduce((a, r) => a + r.score / r.total, 0) / results.length * 100) : 0;
  return {
    title: 'Trang của em', active: 'me',
    html: `
    <div class="phead" style="--c:#F72585">
      <div class="en">${u.role === 'admin' ? 'Quản trị viên' : 'Học sinh' + (u.grade ? ' · Lớp ' + u.grade : '')}</div>
      <h1>Chào ${esc(u.display_name || u.email)}!</h1>
      <p>${esc(u.email || '')}</p>
      <div class="row mt"><button class="btn ghost sm" id="edit">Sửa thông tin</button><button class="btn ghost sm" id="logout">Đăng xuất</button></div>
    </div>
    <div class="grid g3">
      <div class="kpi" style="background:linear-gradient(135deg,#FF8E53,#FF4D6D)"><b>${saved.length}</b><span>từ trong sổ</span></div>
      <div class="kpi" style="background:linear-gradient(135deg,#4CC9F0,#4361EE)"><b>${results.length}</b><span>lượt làm quiz</span></div>
      <div class="kpi" style="background:linear-gradient(135deg,#2EE6B6,#06A77D)"><b>${avg}%</b><span>điểm quiz trung bình</span></div>
    </div>
    <div class="row between mt2"><h2 class="mb0">Sổ từ của em</h2>
      ${saved.length ? `<div class="row"><a class="btn sun sm" href="#/flashcards?scope=saved">Flashcard sổ từ</a>${saved.length >= 4 ? '<a class="btn ghost sm" href="#/quiz?scope=saved">Quiz sổ từ</a>' : ''}</div>` : ''}</div>
    ${bySub.length ? bySub.map(({ s, list }) => `<div class="sec-label" style="color:${s.color}">${esc(s.name_vi)} · ${list.length}</div><div class="vocab">${list.map(vcard).join('')}</div>`).join('')
      : `<div class="card empty mt"><b>Sổ từ còn trống</b>Mở một thuật ngữ và bấm “☆ Lưu vào sổ từ”.<div class="mt"><a class="btn sky" href="#/">Bắt đầu tra cứu</a></div></div>`}
    <h2 class="mt2">Lịch sử quiz</h2>
    ${results.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Phạm vi</th><th>Điểm</th></tr></thead><tbody>
      ${results.slice(0, 20).map(r => `<tr><td>${fmtDate(r.created_at)}</td><td>${esc(r.scope)}</td><td><b>${r.score}/${r.total}</b></td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted">Chưa có lượt quiz nào.</p>'}`,
    mount() {
      $('#logout').onclick = async () => { await Store.signOut(); toast('Đã đăng xuất'); go('#/'); };
      $('#edit').onclick = () => {
        const md = modal(`<h3>Sửa thông tin</h3>
          <div class="field"><label for="p-name">Tên hiển thị</label><input class="inp" id="p-name" value="${esc(u.display_name || '')}" maxlength="60"></div>
          <div class="field"><label for="p-grade">Lớp</label><select class="inp" id="p-grade"><option value="">—</option>${[6, 7, 8, 9].map(g => `<option ${u.grade == g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
          <div class="row" style="justify-content:flex-end"><button class="btn sky" id="p-save">Lưu</button></div>`);
        $('#p-save', md.el).onclick = async () => {
          try { await Store.updateProfile({ display_name: $('#p-name', md.el).value.trim() || u.display_name, grade: $('#p-grade', md.el).value }); md.close(); toast('Đã lưu'); go('#/me'); }
          catch (e) { toast('Lỗi: ' + e.message); }
        };
      };
    },
  };
}

/* ---------- Đăng nhập / đăng kí ---------- */
export async function viewLogin({ q }) {
  const next = q.next || '#/me';
  if (Store.user) return { redirect: next };
  const demo = Store.mode === 'demo';
  return {
    title: 'Đăng nhập', active: 'login',
    html: `
    <div class="auth-card card">
      <h2 class="center">Chào mừng đến SubjectDict</h2>
      <div class="seg"><button class="on" data-tab="in">Đăng nhập</button><button data-tab="up">Tạo tài khoản</button></div>
      <form id="f-auth" novalidate>
        <div class="field up hide"><label for="a-name">Tên của em</label><input class="inp" id="a-name" maxlength="60" autocomplete="name" placeholder="Ví dụ: Nguyễn Minh An"></div>
        <div class="field up hide"><label for="a-grade">Lớp</label><select class="inp" id="a-grade"><option value="">Chọn lớp</option><option>6</option><option>7</option><option>8</option><option>9</option></select></div>
        <div class="field"><label for="a-email">Email</label><input class="inp" id="a-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="a-pw">Mật khẩu</label><input class="inp" id="a-pw" type="password" autocomplete="current-password" minlength="6" required></div>
        <button class="btn coral" style="width:100%;justify-content:center" id="a-go">Đăng nhập</button>
        <div class="form-msg" id="a-msg" role="status"></div>
      </form>
      ${demo ? `<div class="note-box small mt"><b>Chế độ demo</b>: thử nhanh bằng tài khoản có sẵn
        <div class="row mt" style="gap:8px"><button class="btn sm sky" data-demo="hocsinh@demo.vn">Học sinh demo</button><button class="btn sm violet" data-demo="admin@demo.vn">Admin demo</button></div></div>` : ''}
      <p class="small muted center mt">Không cần tài khoản vẫn tra cứu được. Tài khoản giúp lưu sổ từ và kết quả quiz.</p>
    </div>`,
    mount() {
      let mode = 'in';
      const msg = (t, ok) => { const m = $('#a-msg'); m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
      $$('[data-tab]').forEach(b => b.onclick = () => {
        mode = b.dataset.tab;
        $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
        $$('.field.up').forEach(f => f.classList.toggle('hide', mode !== 'up'));
        $('#a-go').textContent = mode === 'up' ? 'Tạo tài khoản' : 'Đăng nhập';
        $('#a-pw').autocomplete = mode === 'up' ? 'new-password' : 'current-password';
        msg('');
      });
      $$('[data-demo]').forEach(b => b.onclick = () => { $('#a-email').value = b.dataset.demo; $('#a-pw').value = 'demo1234'; $('#f-auth').requestSubmit(); });
      $('#f-auth').onsubmit = async e => {
        e.preventDefault();
        const email = $('#a-email').value.trim(), pw = $('#a-pw').value, name = $('#a-name').value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) return msg('Email chưa hợp lệ.');
        if (pw.length < 6) return msg('Mật khẩu cần ít nhất 6 kí tự.');
        if (mode === 'up' && !name) return msg('Hãy nhập tên của em.');
        const btn = $('#a-go'); btn.disabled = true;
        try {
          if (mode === 'in') { await Store.signIn(email, pw); toast('Đăng nhập thành công!'); go(next); }
          else {
            const r = await Store.signUp({ email, password: pw, display_name: name, grade: $('#a-grade').value });
            if (r.needConfirm) msg('Đã tạo tài khoản! Hãy mở email để xác nhận, sau đó đăng nhập.', true);
            else { toast('Tạo tài khoản thành công!'); go(next); }
          }
        } catch (err) { msg(err.message); }
        finally { btn.disabled = false; }
      };
    },
  };
}
