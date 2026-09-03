import { initializeApp } from 'firebase/app';

// Xacheus Firebase configuration.
//
// These values are the application's *public* web configuration. They are safe
// to ship to the browser. They may be overridden with environment variables
// (VITE_FIREBASE_*) for different environments; the values below are the
// project configuration already set up for the application.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDLqKqyR5yEDTZHAF0uxVf7bo1gPF9z89E',
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'phiko-trading.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'phiko-trading',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    'phiko-trading.firebasestorage.app',
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '502225836758',
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    '1:502225836758:web:6ef2df26362622b359c777',
};

// Initialise Firebase exactly once. This is the single source of the Firebase
// app instance; every other Firebase module (auth, firestore, messaging) gets
// its references from here. Do not call initializeApp anywhere else.
export const app = initializeApp(firebaseConfig);

export default firebaseConfig;
