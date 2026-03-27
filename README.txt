CACON Trading Journal - Supabase bản ghép từ layout hiện tại

1. Trên Supabase:
- Tạo project mới
- Authentication > Providers > bật Email
- Nếu muốn đăng ký vào dùng luôn, tắt Confirm email trong Auth settings
- SQL Editor: chạy file supabase_schema.sql

2. Cấu hình:
- Mở file supabase_config.js
- Điền YOUR_SUPABASE_URL
- Điền YOUR_SUPABASE_ANON_KEY

3. Deploy:
- Giữ đúng tên file: index.html, style.css, app.js, supabase_config.js
- Upload lên GitHub Pages, Netlify hoặc Vercel

4. Kiến trúc dữ liệu:
- Mỗi tài khoản chỉ có 1 dòng trong trading_journals
- Toàn bộ journal, pattern, watchlist, mindset, review đang nằm trong cột payload JSONB
- RLS khóa theo auth.uid() nên các tài khoản không xem được dữ liệu của nhau

5. Upload ảnh:
- Ảnh lý thuyết, thực tế và mẫu hình lưu trong bucket cacon-files
- Mỗi người chỉ ghi vào thư mục của UID mình
