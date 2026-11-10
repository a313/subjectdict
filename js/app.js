/* Router + khung giao diện SubjectDict */
import { Store } from './store.js';
import { $, esc, parseHash, ICON_SEARCH, toast } from './util.js';
import * as P from './views/public.js';
import * as L from './views/learn.js';
import * as A from './views/admin.js';

const app = document.getElementById('app');
const initials = n => String(n || '?').trim().split(/\s+/).pop().charAt(0).toUpperCase();

function shell(active, body) {
  const u = Store.user;
  const subj = Store.cache.subjects.map(s =>
    `<a href="#/subject/${s.id}" class="${active === 'subject:' + s.id ? 'on' : ''}"><span class="dot" style="background:${s.color}">${esc(s.name_vi.charAt(0))}</span>${esc(s.name_vi)}</a>`).join('');
  return `
  ${Store.mode === 'demo' ? `<div class="demo-bar">Chế độ demo: dữ liệu lưu trên trình duyệt này. Tài khoản thử: <b>hocsinh@demo.vn</b> / <b>admin@demo.vn</b>, mật khẩu <b>demo1234</b></div>` : ''}
  <header class="topnav">
    <div class="tn-row wrap2">
      <a class="logo" href="#/"><img src="assets/logo.svg" alt=""><span>SubjectDict<small>VIỆT – ANH THEO MÔN HỌC</small></span></a>
      <div class="tn-search${active === 'home' ? ' off' : ''}">
        ${ICON_SEARCH}<input id="top-q" type="search" placeholder="Tra thuật ngữ, ví dụ: tam giác, photosynthesis…" autocomplete="off" aria-label="Tra cứu thuật ngữ">
      </div>
      ${u ? `<a class="user-chip" href="#/me" title="Trang của em"><span class="avatar" style="background:${u.role === 'admin' ? '#7B61FF' : '#FF6B6B'}">${esc(initials(u.display_name))}</span><span class="nm"><b>${esc(u.display_name || u.email)}</b><br><span class="small muted">${u.role === 'admin' ? 'Quản trị viên' : (u.grade ? 'Học sinh lớp ' + u.grade : 'Học sinh')}</span></span></a>`
      : `<a class="btn sm" href="#/login">Đăng nhập</a>`}
    </div>
    <div class="tn-nav"><div class="wrap2"><nav class="hnav" aria-label="Điều hướng chính">
      <a href="#/" class="${active === 'home' ? 'on' : ''}"><span class="dot" style="background:#FFB703">⌂</span>Trang chủ</a>
      ${subj}
      <a href="#/me" class="${active === 'me' ? 'on' : ''}"><span class="dot" style="background:#F72585">★</span>Sổ từ của em</a>
      ${Store.isAdmin ? `<a href="#/admin" class="${active === 'admin' ? 'on' : ''}"><span class="dot" style="background:#2EC4B6">⚙</span>Quản trị</a>` : ''}
    </nav></div></div>
  </header>
  <main class="page wrap2" id="page">${body}</main>
  <footer class="footer"><div class="wrap2 row between">
    <span><b style="color:#fff">SubjectDict</b> · Từ điển thuật ngữ Việt – Anh theo môn học cho học sinh THCS</span>
    <span>${Store.cache.terms.filter(t => t.status !== 'draft').length} thuật ngữ · ${Store.cache.subjects.length} môn học</span>
  </div></footer>`;
}

const ROUTES = {
  '': P.viewHome, search: P.viewSearch, term: P.viewTerm, subject: P.viewSubject, topic: P.viewTopic,
  flashcards: L.viewFlashcards, quiz: L.viewQuiz, me: L.viewMe, login: L.viewLogin,
  admin: A.viewAdmin,
};

let routing = 0;
async function route() {
  const my = ++routing;
  const ctx = parseHash();
  const key = ctx.parts[0] || '';
  const view = ROUTES[key] || P.viewNotFound;
  let res;
  try { res = await view(ctx); }
  catch (e) { console.error(e); res = { html: `<div class="warn-box">Có lỗi khi tải trang: ${esc(e.message)}</div>` }; }
  if (my !== routing) return;
  if (res.redirect) { location.hash = res.redirect; return; }
  document.title = (res.title ? res.title + ' · ' : '') + 'SubjectDict';
  app.innerHTML = shell(res.active || key, res.html);
  const top = $('#top-q');
  if (top) P.attachSuggest(top);
  if (res.mount) { try { await res.mount($('#page')); } catch (e) { console.error(e); toast('Lỗi: ' + e.message); } }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
(async function boot() {
  try {
    await Store.init();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="wrap2 page"><div class="warn-box"><b>Không kết nối được dữ liệu.</b><br>${esc(e.message)}<br><span class="small">Nếu đang mở file trực tiếp (file://), hãy chạy một web server tĩnh, ví dụ: <code>python3 -m http.server</code>.</span></div></div>`;
    return;
  }
  Store.onAuth(route);
  route();
})();
