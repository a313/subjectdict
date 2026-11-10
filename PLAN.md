# SubjectDict — Kế hoạch MVP

> **Thiết kế ứng dụng tra cứu thuật ngữ Việt – Anh theo môn học (SubjectDict) hỗ trợ học sinh THCS sử dụng tiếng Anh trong các môn học khác.**

Cách tiếp cận: học tiếng Anh qua nội dung môn học (CLIL). Học sinh không chỉ tra nghĩa mà còn **dùng được thuật ngữ trong câu, đúng ngữ cảnh môn học**.

---

## 1. Quyết định đã chốt

| Hạng mục | Quyết định |
|---|---|
| Dữ liệu ban đầu | 100 thuật ngữ mẫu, 4 môn (Toán 25 · KHTN 35 · Lịch sử & Địa lí 20 · Tin học 20) |
| Phân loại | Môn → Chủ đề → Lớp (6–9). **Không theo bộ SGK nào** |
| Vai trò | `student`, `admin`. Vai trò giáo viên để sang v1.1 |
| Branding | Tên **SubjectDict**, mượn phong cách màu, font và component của file mẫu. Không dùng mascot "Chí" |
| Hosting | GitHub Pages (tĩnh), deploy bằng GitHub Actions |
| Database / Auth | Supabase (Postgres + Auth + Row Level Security), gói Free |
| Chế độ demo | Khi chưa cấu hình Supabase, app tự chạy bằng localStorage và dữ liệu mẫu, nên luôn demo được |

## 2. Tech stack (tận dụng từ file mẫu)

- HTML/CSS/JS thuần, **không có bước build**. Dùng ES modules.
- Router theo hash (`#/...`), view viết bằng template literal, giống file mẫu.
- Design tokens lấy từ file mẫu: `--sun --coral --sky --violet --mint --navy…`, font **Be Vietnam Pro** và **Baloo 2**, bo góc 22px, card có shadow, nav ngang gradient.
- Web Speech API (`speechSynthesis`) để phát âm, không tốn chi phí.
- `@supabase/supabase-js@2` nạp từ CDN, chỉ khi đã cấu hình.
- Tìm kiếm chạy phía client: bỏ dấu tiếng Việt, khớp tiền tố, chịu lỗi chính tả nhẹ. Đủ nhanh cho vài nghìn mục từ.

## 3. Tính năng MVP

### Học sinh
- [x] Tra cứu hai chiều Việt ⇄ Anh, gõ không dấu vẫn ra, gợi ý ngay khi gõ
- [x] Lọc theo môn / chủ đề / lớp
- [x] Trang mục từ: EN, VI, IPA, từ loại, định nghĩa tiếng Anh đơn giản, nghĩa tiếng Việt, câu ví dụ theo ngữ cảnh môn học, lưu ý lỗi thường gặp, từ liên quan
- [x] Nghe phát âm US/UK, đọc chậm, đọc cả câu ví dụ
- [x] Duyệt theo môn và chủ đề
- [x] Sổ từ của em (cần đăng nhập)
- [x] Flashcard (EN→VI hoặc VI→EN, theo chủ đề hoặc sổ từ)
- [x] Quiz 10 câu: chọn nghĩa, chọn từ, nghe chọn từ, điền từ vào câu
- [x] Trang cá nhân: sổ từ, lịch sử quiz
- [x] Không cần đăng nhập vẫn tra được

### Admin
- [x] Tổng quan: số liệu, từ tra nhiều nhất, **từ khoá tra không có kết quả** (kèm nút "Thêm từ này")
- [x] Quản lý mục từ: thêm/sửa/xoá, trạng thái nháp hoặc xuất bản, tìm và lọc
- [x] Import CSV, Export CSV/JSON (dùng để sao lưu)
- [x] Quản lý môn và chủ đề
- [x] Quản lý người dùng: cấp hoặc gỡ quyền admin

## 4. Dữ liệu

```
subjects     (id, name_vi, name_en, color, sort)
topics       (id, subject_id, name_vi, name_en, sort)
terms        (id, subject_id, topic_id, grade, term_en, term_vi, ipa, pos,
              def_en, def_vi, example_en, example_vi, note, related[], status, …)
profiles     (id → auth.users, email, display_name, grade, school, role)
saved_terms  (user_id, term_id, created_at)
quiz_results (id, user_id, scope, score, total, created_at)
search_logs  (id, query, found, created_at)
```

Bảo mật bằng Row Level Security:
- Ai cũng đọc được môn, chủ đề và các từ đã xuất bản. Chỉ admin được ghi.
- Mỗi người chỉ đọc/ghi sổ từ và kết quả quiz của mình.
- Người dùng không tự nâng quyền được: có trigger chặn đổi `role` nếu người thực hiện không phải admin.
- `search_logs`: ai cũng ghi được, chỉ admin đọc.

## 5. Các trang

```
#/                    Trang chủ: ô tìm kiếm, các môn, từ của ngày
#/search?q=&s=&g=     Kết quả + bộ lọc
#/term/:id            Chi tiết mục từ
#/subject/:id         Môn học → chủ đề → danh sách từ
#/topic/:id           Từ của chủ đề + Flashcard + Quiz
#/flashcards?scope=   scope = topic:<id> | subject:<id> | saved
#/quiz?scope=
#/me                  Sổ từ, lịch sử quiz
#/login
#/admin               Tổng quan
#/admin/terms         Mục từ + Import/Export
#/admin/topics        Môn & chủ đề
#/admin/users         Người dùng
```

## 6. Cấu trúc repo

```
index.html
assets/logo.svg
css/app.css
js/config.js          SUPABASE_URL / ANON_KEY (để trống = chế độ demo)
js/util.js            helper, chuẩn hoá tiếng Việt, phát âm, toast, modal
js/store.js           lớp dữ liệu: DemoBackend (localStorage) | SupabaseBackend
js/search.js          tìm kiếm phía client
js/app.js             router + khung giao diện
js/views/public.js    trang chủ, tìm kiếm, mục từ, môn, chủ đề
js/views/learn.js     flashcard, quiz, trang cá nhân, đăng nhập
js/views/admin.js     trang admin
data/seed.json        100 thuật ngữ mẫu
supabase/schema.sql   bảng, RLS, trigger
supabase/seed.sql     sinh từ seed.json (scripts/gen_seed_sql.py)
.github/workflows/deploy.yml     deploy GitHub Pages
.github/workflows/keepalive.yml  giữ project Supabase Free không bị tạm dừng
```

## 7. Các bước triển khai

1. ✅ Phân tích file mẫu, chốt phạm vi
2. ✅ Dựng khung: index, css, router, store (chế độ demo)
3. ✅ Dữ liệu mẫu 100 từ
4. ✅ Trang học sinh: tìm kiếm, mục từ, môn, chủ đề, flashcard, quiz, trang cá nhân
5. ✅ Trang admin
6. ✅ Schema Supabase, RLS, seed SQL
7. ✅ Workflow deploy và keepalive, README hướng dẫn
8. ⏳ Bạn tạo project Supabase, chạy SQL, điền `js/config.js`, push lên GitHub, bật Pages

## 8. Sau MVP (v1.1)

- Vai trò giáo viên: tạo lớp, giao bộ từ, xem kết quả quiz của lớp
- Luyện phát âm bằng nhận dạng giọng nói
- Ôn tập ngắt quãng (spaced repetition)
- Phrase bank theo môn ("The graph shows…", "In this experiment, we…")
- Học sinh đề xuất từ mới hoặc báo lỗi, admin duyệt
- Upload hình minh hoạ lên Supabase Storage, lịch sử chỉnh sửa
- PWA dùng offline, gamification (ngôi sao, chuỗi ngày học)
