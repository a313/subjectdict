# SubjectDict

**Từ điển thuật ngữ Việt – Anh theo môn học**, hỗ trợ học sinh THCS sử dụng tiếng Anh trong Toán, Khoa học tự nhiên, Lịch sử và Địa lí, Tin học.

- Tra cứu hai chiều, gõ không dấu vẫn ra, có phát âm US/UK, câu ví dụ theo ngữ cảnh môn học
- Sổ từ cá nhân, flashcard, quiz 10 câu
- Trang quản trị: quản lý mục từ, import/export CSV, quản lý môn và chủ đề, người dùng, thống kê từ khoá chưa có kết quả
- Chạy hoàn toàn tĩnh trên **GitHub Pages**. Dữ liệu lưu trên **Supabase** (gói Free)

Kế hoạch chi tiết: [PLAN.md](PLAN.md)

---

## Chạy thử trên máy

Không cần cài đặt hay build. Chỉ cần một web server tĩnh:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Khi `js/config.js` còn để trống, app chạy **chế độ demo**: dữ liệu lưu trong localStorage của trình duyệt, có sẵn 100 thuật ngữ và 2 tài khoản:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Học sinh | `hocsinh@demo.vn` | `demo1234` |
| Admin | `admin@demo.vn` | `demo1234` |

## Kết nối Supabase (database thật)

1. Tạo project tại [supabase.com](https://supabase.com) (gói Free).
2. Vào **SQL Editor**, chạy lần lượt:
   - [`supabase/schema.sql`](supabase/schema.sql): tạo bảng, Row Level Security, trigger
   - [`supabase/seed.sql`](supabase/seed.sql): nạp 4 môn, 12 chủ đề, 100 thuật ngữ
3. Vào **Project Settings → API**, copy **Project URL** và **anon public key** vào [`js/config.js`](js/config.js):
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
   Anon key là khoá công khai, được phép commit. Dữ liệu được bảo vệ bằng RLS. **Không bao giờ** dùng `service_role` key trong web.
4. Vào **Authentication → URL Configuration**, đặt **Site URL** là địa chỉ GitHub Pages (`https://<username>.github.io/subjectdict/`) để link xác nhận email trỏ đúng trang.
   - Nếu muốn học sinh đăng kí xong dùng được ngay, tắt **Authentication → Providers → Email → Confirm email**.
5. Mở website, tự đăng kí tài khoản, rồi chạy trong SQL Editor để thành admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'email-cua-ban@example.com';
   ```
   Các admin sau có thể được cấp quyền ngay trong trang **Quản trị → Người dùng**.

## Deploy lên GitHub Pages

1. Tạo repo trên GitHub, push code lên nhánh `main` (hoặc `master`).
2. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
3. Mỗi lần push, workflow [`deploy.yml`](.github/workflows/deploy.yml) tự deploy. URL công khai: `https://<username>.github.io/<repo>/`

### Giữ Supabase Free không bị tạm dừng

Supabase Free tạm dừng project sau khoảng 7 ngày không có truy cập. Workflow [`keepalive.yml`](.github/workflows/keepalive.yml) ping database 3 ngày một lần. Để bật, thêm 2 secrets trong **Settings → Secrets and variables → Actions**: `SUPABASE_URL` và `SUPABASE_ANON_KEY`.

> GitHub tự tắt workflow theo lịch nếu repo không có commit nào trong 60 ngày. Khi đó vào tab Actions để bật lại.

## Quản lý dữ liệu

- **Thêm/sửa từng mục:** Quản trị → Mục từ → *+ Thêm mục từ*
- **Nhập hàng loạt:** soạn trong Excel hoặc Google Sheets theo *file CSV mẫu*, lưu dạng CSV UTF-8, rồi *Import CSV*. Cột `related` ghi id các từ liên quan, cách nhau bằng `|`. Dòng không có `id` mà trùng `term_en` và môn sẽ được cập nhật thay vì tạo mới.
- **Sao lưu:** *Export JSON* (toàn bộ môn, chủ đề, mục từ) hoặc *Export CSV*.
- **Sửa dữ liệu mẫu:** sửa [`data/seed.json`](data/seed.json), chạy `python3 scripts/gen_seed_sql.py` để sinh lại `supabase/seed.sql`.

## Cấu trúc

```
index.html              trang duy nhất (SPA, router theo hash)
css/app.css             design tokens + components
js/config.js            cấu hình Supabase
js/store.js             lớp dữ liệu: DemoBackend | SupabaseBackend
js/search.js            tìm kiếm phía client (bỏ dấu, chịu lỗi chính tả)
js/app.js               router + khung giao diện
js/views/public.js      trang chủ, tìm kiếm, mục từ, môn, chủ đề
js/views/learn.js       flashcard, quiz, trang cá nhân, đăng nhập
js/views/admin.js       trang quản trị
data/seed.json          100 thuật ngữ mẫu
supabase/schema.sql     bảng + RLS
supabase/seed.sql       dữ liệu mẫu (sinh tự động)
```

Tech stack: HTML/CSS/JS thuần (ES modules, không cần build), font Be Vietnam Pro và Baloo 2, Web Speech API, `@supabase/supabase-js@2` qua CDN.
