import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Load config from localStorage (same as legacy app)
let firebaseConfig = null;
try {
  const savedConfig = localStorage.getItem('FIREBASE_CONFIG');
  if (savedConfig) {
    firebaseConfig = JSON.parse(savedConfig);
  }
} catch (e) {
  console.error("Error loading Firebase Config from localStorage", e);
}

// Placeholder if not configured yet
const isConfigured = firebaseConfig && firebaseConfig.apiKey;

const app = isConfigured ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

if (db) {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn("Firestore persistence could not be enabled: multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn("Firestore persistence is not supported by this browser.");
    }
  });
}

export { db, storage, isConfigured };

