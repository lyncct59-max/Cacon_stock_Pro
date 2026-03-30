// supabase.js
window.SUPABASE_URL = "https://unlrlmxlngxhstbnrzax.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_DB9DIVS7RWnE4rEfY4GaHg_Kwc8rhya";

// Khởi tạo thực thể kết nối duy nhất
if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
} else {
  console.error("Thư viện Supabase chưa được nạp. Kiểm tra file index.html");
}