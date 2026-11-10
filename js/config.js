// Cấu hình SubjectDict.
// Để trống SUPABASE_URL / SUPABASE_ANON_KEY → app chạy CHẾ ĐỘ DEMO (dữ liệu lưu trên trình duyệt).
// Điền thông tin từ Supabase Dashboard → Project Settings → API để dùng database thật.
// ANON KEY là khoá công khai, được phép để trong mã nguồn web; dữ liệu được bảo vệ bằng Row Level Security.
export const CONFIG = {
  SUPABASE_URL: 'https://wxoipghqetatrkbpaliu.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4b2lwZ2hxZXRhdHJrYnBhbGl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMTc3NjMsImV4cCI6MjEwOTg5Mzc2M30.3Hs9J2hb4iaMHF2KZ1JO4aZZGt-L-x3GrFwfj31IG9Q',
  APP_NAME: 'SubjectDict',
};
