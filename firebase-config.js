/*
  Replace every placeholder with values from Firebase Console:
  Project settings > General > Your apps > Web app config.
  These Firebase web config values identify your project; they are not passwords.
*/
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyA36RbjHDFgEMOrlrYDHmS33-oxRsd5CLI",
  authDomain: "subhajit-location-tracker.firebaseapp.com",
  projectId: "subhajit-location-tracker",
  storageBucket: "subhajit-location-tracker.firebasestorage.app",
  messagingSenderId: "216793752225",
  appId: "1:216793752225:web:c875fe1cae2fa0bd4806e0"
};

/*
  Add the Firebase Authentication email addresses you create for the two roles.
  Do not put either account password here.
*/
window.ROLE_EMAILS = {
  provider: "itzsubhajit2012@gmail.com",
  viewer: "subhajit721242@gmail.com"
};
