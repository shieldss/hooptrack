// Firebase web configuration is public, but this project-specific value must come
// from your Firebase console. Do not place service-account credentials here.
export const firebaseConfig = {
   apiKey: "AIzaSyAFdBORtyOsz3AvCQ-zqHBehpeGMUc4b_c",
  authDomain: "hooptrack-3488b.firebaseapp.com",
  projectId: "hooptrack-3488b",
  storageBucket: "hooptrack-3488b.firebasestorage.app",
  messagingSenderId: "215080346649",
  appId: "1:215080346649:web:493125996f03a9676ff688"
};

export const firebaseConfigured = () => Object.values(firebaseConfig).every(value => value && !value.includes('PASTE_YOUR'));

export async function getFirebaseServices() {
  if (!firebaseConfigured()) throw new Error('Firebase has not been configured.');
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
  ]);
  const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(firebaseConfig);
  return { auth: authSdk.getAuth(app), db: firestoreSdk.getFirestore(app), authSdk, firestoreSdk };
}
