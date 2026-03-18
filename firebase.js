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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let userRole = 'user';

const ADMIN_EMAILS_COLLECTION = 'admin_emails';
const APPROVED_EMAILS_COLLECTION = 'approved_emails';
const PENDING_REG_COLLECTION = 'pending_registrations';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function checkAdminRole(user) {
  if (!user) {
    userRole = 'user';
    document.body.classList.remove('is-admin');
    return false;
  }

  const uidDoc = await db.collection('users').doc(user.uid).get();
  const userEmail = normalizeEmail(user.email);
  const emailDoc = userEmail ? await db.collection(ADMIN_EMAILS_COLLECTION).doc(userEmail).get() : null;
  const isAdmin = (uidDoc.exists && uidDoc.data().role === 'admin') || (emailDoc && emailDoc.exists);

  userRole = isAdmin ? 'admin' : 'user';
  document.body.classList.toggle('is-admin', isAdmin);

  if (uidDoc.exists) {
    await db.collection('users').doc(user.uid).set({
      email: user.email || '',
      name: uidDoc.data().name || user.displayName || user.email?.split('@')[0] || 'User',
      role: isAdmin ? 'admin' : (uidDoc.data().role || 'user'),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return isAdmin;
}

async function isEmailApproved(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const approvedDoc = await db.collection(APPROVED_EMAILS_COLLECTION).doc(normalized).get();
  const adminDoc = await db.collection(ADMIN_EMAILS_COLLECTION).doc(normalized).get();
  return approvedDoc.exists || adminDoc.exists;
}
