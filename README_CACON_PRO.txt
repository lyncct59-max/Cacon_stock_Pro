BỘ FILE CACON PRO UX

1. Đổi tên file:
- index_cacon_pro.html -> index.html
- style_cacon_pro.css -> style.css
- app_cacon_pro.js -> app.js
- firebase_cacon_pro.js -> firebase.js (nếu muốn giữ cấu hình hiện tại)

2. Cấu trúc Firebase được code này sử dụng:
- users/{uid}
- patterns/{docId} với field userId
- watchlist/{docId} với field userId
- journal/{docId} với field userId
- settings/market_{uid}
- psychology/{uid}
- reviews/{uid}

3. Tách dữ liệu theo tài khoản:
- mọi query đều where("userId","==", uid) hoặc doc theo uid
- mỗi tài khoản chỉ thấy dữ liệu của mình nếu Firestore Rules chặn đúng

4. Rules gợi ý:
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /patterns/{docId} {
  allow read, write: if request.auth != null && resource == null ? request.resource.data.userId == request.auth.uid : resource.data.userId == request.auth.uid;
}
match /watchlist/{docId} {
  allow read, write: if request.auth != null && resource == null ? request.resource.data.userId == request.auth.uid : resource.data.userId == request.auth.uid;
}
match /journal/{docId} {
  allow read, write: if request.auth != null && resource == null ? request.resource.data.userId == request.auth.uid : resource.data.userId == request.auth.uid;
}
match /settings/{docId} {
  allow read, write: if request.auth != null && docId == ('market_' + request.auth.uid);
}
match /psychology/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
match /reviews/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}

5. Tính năng chính đã có:
- intro screen cá con nổi bật giữa đàn cá mập icon nét mảnh
- đăng nhập nhiều tài khoản bằng Firebase Auth
- CRUD mẫu hình
- CRUD nhật ký lệnh
- CRUD watchlist
- liên kết mẫu hình với nhật ký và watchlist
- so sánh mô hình lý thuyết và thực tế trong nhật ký
- module tâm lý, thị trường, review
