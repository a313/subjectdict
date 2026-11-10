/* Lớp dữ liệu: một API chung, hai backend
 *  - DemoBackend: localStorage + data/seed.json (khi chưa cấu hình Supabase)
 *  - SupabaseBackend: Postgres + Auth + RLS
 */
import { CONFIG } from './config.js';
import { slug, uid } from './util.js';

const TERM_COLS = ['id', 'subject_id', 'topic_id', 'grade', 'term_en', 'term_vi', 'ipa', 'pos', 'def_en', 'def_vi', 'example_en', 'example_vi', 'note', 'related', 'status'];
export const cleanTerm = t => {
  const o = {};
  for (const k of TERM_COLS) o[k] = t[k] ?? (k === 'related' ? [] : '');
  o.grade = parseInt(o.grade, 10) || 6;
  o.status = o.status === 'draft' ? 'draft' : 'published';
  if (typeof o.related === 'string') o.related = o.related.split(/[|;]/).map(s => s.trim()).filter(Boolean);
  o.topic_id = o.topic_id || null;
  return o;
};
export const newTermId = en => slug(en) + '-' + uid().slice(-4);

async function fetchSeed() {
  const r = await fetch('data/seed.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('Không tải được dữ liệu mẫu');
  return r.json();
}

/* ======================= DEMO BACKEND ======================= */
const LS_DB = 'sd_db_v1', LS_SES = 'sd_session_v1';
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };

class DemoBackend {
  mode = 'demo';
  db = null; userId = null; listeners = [];
  async init() {
    try { this.db = JSON.parse(lsGet(LS_DB) || 'null'); } catch (e) { this.db = null; }
    if (!this.db) {
      const seed = await fetchSeed();
      const now = new Date().toISOString();
      this.db = {
        subjects: seed.subjects, topics: seed.topics,
        terms: seed.terms.map(t => ({ ...cleanTerm(t), status: 'published', updated_at: now })),
        users: [
          { id: 'u-admin', email: 'admin@demo.vn', password: 'demo1234', display_name: 'Cô Quản Trị', grade: null, role: 'admin', created_at: now },
          { id: 'u-student', email: 'hocsinh@demo.vn', password: 'demo1234', display_name: 'Minh An', grade: 7, role: 'student', created_at: now },
        ],
        saved: [], quiz: [],
        logs: ['tam giac', 'photosynthesis', 'quang hop', 'khoi luong', 'mass', 'mitochondria', 'vector', 'nhiet ke', 'algorithm', 'tam giac']
          .map((q, i) => ({ id: i + 1, query: q, found: !['mitochondria', 'vector', 'nhiet ke'].includes(q), created_at: now })),
      };
      this.save();
    }
    this.userId = lsGet(LS_SES);
  }
  save() { lsSet(LS_DB, JSON.stringify(this.db)); }
  emit() { this.listeners.forEach(f => f()); }
  onAuth(f) { this.listeners.push(f); }
  pub(u) { if (!u) return null; const { password, ...p } = u; return p; }
  async currentUser() { return this.pub(this.db.users.find(u => u.id === this.userId)); }
  async signIn(email, password) {
    const u = this.db.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!u || u.password !== password) throw new Error('Email hoặc mật khẩu không đúng.');
    this.userId = u.id; lsSet(LS_SES, u.id);
  }
  async signUp({ email, password, display_name, grade }) {
    email = String(email).trim().toLowerCase();
    if (this.db.users.some(u => u.email === email)) throw new Error('Email này đã được đăng kí.');
    const u = { id: 'u-' + uid(), email, password, display_name, grade: grade ? +grade : null, role: 'student', created_at: new Date().toISOString() };
    this.db.users.push(u); this.save();
    this.userId = u.id; lsSet(LS_SES, u.id);
    return { needConfirm: false };
  }
  async signOut() { this.userId = null; lsSet(LS_SES, ''); }
  async updateProfile(patch) {
    const u = this.db.users.find(u => u.id === this.userId); if (!u) return;
    Object.assign(u, { display_name: patch.display_name, grade: patch.grade ? +patch.grade : null }); this.save();
  }
  async getCatalog() { return { subjects: this.db.subjects, topics: this.db.topics }; }
  async getTerms(includeDrafts) { return includeDrafts ? this.db.terms : this.db.terms.filter(t => t.status === 'published'); }
  async upsertTerms(list) {
    const now = new Date().toISOString();
    for (const t of list) {
      const i = this.db.terms.findIndex(x => x.id === t.id);
      const row = { ...cleanTerm(t), updated_at: now };
      if (i >= 0) this.db.terms[i] = row; else this.db.terms.push(row);
    }
    this.save();
  }
  async deleteTerm(id) { this.db.terms = this.db.terms.filter(t => t.id !== id); this.db.saved = this.db.saved.filter(s => s.term_id !== id); this.save(); }
  async upsertSubject(s) { const i = this.db.subjects.findIndex(x => x.id === s.id); if (i >= 0) this.db.subjects[i] = s; else this.db.subjects.push(s); this.save(); }
  async deleteSubject(id) {
    this.db.subjects = this.db.subjects.filter(s => s.id !== id);
    this.db.topics = this.db.topics.filter(t => t.subject_id !== id);
    this.db.terms = this.db.terms.filter(t => t.subject_id !== id); this.save();
  }
  async upsertTopic(t) { const i = this.db.topics.findIndex(x => x.id === t.id); if (i >= 0) this.db.topics[i] = t; else this.db.topics.push(t); this.save(); }
  async deleteTopic(id) { this.db.topics = this.db.topics.filter(t => t.id !== id); this.db.terms.forEach(t => { if (t.topic_id === id) t.topic_id = null; }); this.save(); }
  async getSaved() { return this.db.saved.filter(s => s.user_id === this.userId).map(s => s.term_id); }
  async setSaved(termId, on) {
    this.db.saved = this.db.saved.filter(s => !(s.user_id === this.userId && s.term_id === termId));
    if (on) this.db.saved.push({ user_id: this.userId, term_id: termId, created_at: new Date().toISOString() });
    this.save();
  }
  async addQuizResult(r) { this.db.quiz.push({ id: uid(), user_id: this.userId, ...r, created_at: new Date().toISOString() }); this.save(); }
  async getQuizResults() { return this.db.quiz.filter(q => q.user_id === this.userId).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async logSearch(query, found) { this.db.logs.push({ id: this.db.logs.length + 1, query, found, created_at: new Date().toISOString() }); if (this.db.logs.length > 3000) this.db.logs = this.db.logs.slice(-3000); this.save(); }
  async getSearchLogs(days) { const since = Date.now() - days * 864e5; return this.db.logs.filter(l => new Date(l.created_at).getTime() >= since); }
  async listUsers() { return this.db.users.map(u => this.pub(u)); }
  async setRole(id, role) { const u = this.db.users.find(u => u.id === id); if (u) { u.role = role; this.save(); } }
  async resetDemo() { localStorage.removeItem(LS_DB); localStorage.removeItem(LS_SES); }
}

/* ======================= SUPABASE BACKEND ======================= */
class SupabaseBackend {
  mode = 'supabase';
  sb = null; session = null; profile = null; listeners = [];
  async init() {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
    this.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    const { data } = await this.sb.auth.getSession();
    this.session = data.session;
    await this.loadProfile();
    // Không gọi Supabase trực tiếp trong callback (tránh deadlock) → đẩy sang tick sau
    this.sb.auth.onAuthStateChange((_e, session) => {
      const changed = (session?.user?.id || null) !== (this.session?.user?.id || null);
      this.session = session;
      if (changed) setTimeout(async () => { await this.loadProfile(); this.listeners.forEach(f => f()); }, 0);
    });
  }
  ok({ data, error }) { if (error) throw new Error(error.message); return data; }
  async loadProfile() {
    this.profile = null;
    const u = this.session?.user; if (!u) return;
    const { data } = await this.sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    this.profile = data || { id: u.id, email: u.email, display_name: u.email, role: 'student' };
  }
  onAuth(f) { this.listeners.push(f); }
  async currentUser() { return this.profile; }
  async signIn(email, password) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email hoặc mật khẩu không đúng.' : error.message);
    this.session = data.session; await this.loadProfile();
  }
  async signUp({ email, password, display_name, grade }) {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(), password,
      options: { data: { display_name, grade: grade ? +grade : null }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(error.message);
    if (data.session) { this.session = data.session; await this.loadProfile(); }
    return { needConfirm: !data.session };
  }
  async signOut() { await this.sb.auth.signOut(); this.session = null; this.profile = null; }
  async updateProfile(patch) {
    this.ok(await this.sb.from('profiles').update({ display_name: patch.display_name, grade: patch.grade ? +patch.grade : null }).eq('id', this.profile.id));
    await this.loadProfile();
  }
  async all(q) { // phân trang vượt giới hạn 1000 dòng
    const out = []; const size = 1000;
    for (let from = 0; ; from += size) {
      const rows = this.ok(await q().range(from, from + size - 1));
      out.push(...rows); if (rows.length < size) break;
    }
    return out;
  }
  async getCatalog() {
    const [subjects, topics] = await Promise.all([
      this.sb.from('subjects').select('*').order('sort'),
      this.sb.from('topics').select('*').order('sort'),
    ]);
    return { subjects: this.ok(subjects), topics: this.ok(topics) };
  }
  async getTerms(includeDrafts) {
    return this.all(() => { let q = this.sb.from('terms').select('*').order('term_en'); if (!includeDrafts) q = q.eq('status', 'published'); return q; });
  }
  async upsertTerms(list) {
    const rows = list.map(t => ({ ...cleanTerm(t), updated_at: new Date().toISOString() }));
    for (let i = 0; i < rows.length; i += 500) this.ok(await this.sb.from('terms').upsert(rows.slice(i, i + 500)));
  }
  async deleteTerm(id) { this.ok(await this.sb.from('terms').delete().eq('id', id)); }
  async upsertSubject(s) { this.ok(await this.sb.from('subjects').upsert(s)); }
  async deleteSubject(id) { this.ok(await this.sb.from('subjects').delete().eq('id', id)); }
  async upsertTopic(t) { this.ok(await this.sb.from('topics').upsert(t)); }
  async deleteTopic(id) { this.ok(await this.sb.from('topics').delete().eq('id', id)); }
  async getSaved() { return this.ok(await this.sb.from('saved_terms').select('term_id').eq('user_id', this.profile.id)).map(r => r.term_id); }
  async setSaved(termId, on) {
    if (on) this.ok(await this.sb.from('saved_terms').upsert({ user_id: this.profile.id, term_id: termId }, { ignoreDuplicates: true }));
    else this.ok(await this.sb.from('saved_terms').delete().eq('user_id', this.profile.id).eq('term_id', termId));
  }
  async addQuizResult(r) { this.ok(await this.sb.from('quiz_results').insert({ user_id: this.profile.id, ...r })); }
  async getQuizResults() { return this.ok(await this.sb.from('quiz_results').select('*').eq('user_id', this.profile.id).order('created_at', { ascending: false }).limit(50)); }
  async logSearch(query, found) { await this.sb.from('search_logs').insert({ query, found }); }
  async getSearchLogs(days) {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    return this.ok(await this.sb.from('search_logs').select('query,found,created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(5000));
  }
  async listUsers() { return this.all(() => this.sb.from('profiles').select('*').order('created_at', { ascending: false })); }
  async setRole(id, role) { this.ok(await this.sb.from('profiles').update({ role }).eq('id', id)); }
}

/* ======================= STORE (cache + API chung) ======================= */
export const Store = {
  be: null, user: null, saved: new Set(),
  cache: { subjects: [], topics: [], terms: [], termsAll: false },
  get mode() { return this.be?.mode; },
  get isAdmin() { return this.user?.role === 'admin'; },
  async init() {
    const useSb = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY;
    this.be = useSb ? new SupabaseBackend() : new DemoBackend();
    await this.be.init();
    await this.refreshUser();
    await this.loadAll();
  },
  onAuth(f) { this.be.onAuth(async () => { await this.afterAuth(); f(); }); },
  async refreshUser() {
    this.user = await this.be.currentUser();
    this.saved = new Set(this.user ? await this.be.getSaved().catch(() => []) : []);
  },
  async loadAll() {
    const [cat, terms] = await Promise.all([this.be.getCatalog(), this.be.getTerms(this.isAdmin)]);
    this.cache.subjects = [...cat.subjects].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    this.cache.topics = [...cat.topics].sort((a, b) => (a.sort || 0) - (b.sort || 0));
    this.cache.terms = terms;
    this.cache.termsAll = this.isAdmin;
  },
  /* tra cứu nhanh trong cache */
  subject(id) { return this.cache.subjects.find(s => s.id === id); },
  topic(id) { return this.cache.topics.find(t => t.id === id); },
  term(id) { return this.cache.terms.find(t => t.id === id); },
  published() { return this.cache.terms.filter(t => t.status !== 'draft'); },
  topicsOf(sid) { return this.cache.topics.filter(t => t.subject_id === sid); },
  color(sid) { return this.subject(sid)?.color || '#4361EE'; },

  async afterAuth() { await this.refreshUser(); await this.loadAll(); },
  async signIn(e, p) { await this.be.signIn(e, p); await this.afterAuth(); },
  async signUp(o) { const r = await this.be.signUp(o); await this.afterAuth(); return r; },
  async signOut() { await this.be.signOut(); await this.afterAuth(); },
  async updateProfile(p) { await this.be.updateProfile(p); await this.refreshUser(); },

  async toggleSave(id) {
    const on = !this.saved.has(id);
    await this.be.setSaved(id, on);
    on ? this.saved.add(id) : this.saved.delete(id);
    return on;
  },
  addQuizResult: r => Store.be.addQuizResult(r),
  getQuizResults: () => Store.be.getQuizResults(),
  logSearch: (q, f) => Store.be.logSearch(q, f).catch(() => { }),

  async upsertTerms(list) { await this.be.upsertTerms(list); await this.loadAll(); },
  async deleteTerm(id) { await this.be.deleteTerm(id); await this.loadAll(); },
  async upsertSubject(s) { await this.be.upsertSubject(s); await this.loadAll(); },
  async deleteSubject(id) { await this.be.deleteSubject(id); await this.loadAll(); },
  async upsertTopic(t) { await this.be.upsertTopic(t); await this.loadAll(); },
  async deleteTopic(id) { await this.be.deleteTopic(id); await this.loadAll(); },
  getSearchLogs: d => Store.be.getSearchLogs(d),
  listUsers: () => Store.be.listUsers(),
  setRole: (id, r) => Store.be.setRole(id, r),
};
