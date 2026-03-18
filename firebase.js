// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyCapUGa35wIhvA2Y0NcCzUYCqLnOXEFkJc",
  authDomain: "cacon-stock-b4cab.firebaseapp.com",
  projectId: "cacon-stock-b4cab",
  storageBucket: "cacon-stock-b4cab.firebasestorage.app",
  messagingSenderId: "835007942800",
  appId: "1:835007942800:web:2e91579fae013d56b10815",
  measurementId: "G-RFNN6PYY8R"
};

// Khởi tạo các dịch vụ Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let userRole = 'user';

// Hàm kiểm tra quyền Admin từ Database
async function checkAdminRole(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data().role === 'admin') {
        userRole = 'admin';
        document.body.classList.add('is-admin');
        return true;
    }
    return false;
}