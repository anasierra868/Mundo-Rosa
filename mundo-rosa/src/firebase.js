import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Hardcoded Config obtained from the user's Firebase console screenshot
const firebaseConfig = {
  apiKey: "AIzaSyAm1nLIMVK35-kyQVH3W4d5diUXSFQFoRo",
  authDomain: "mundo-rosa-a12b9.firebaseapp.com",
  projectId: "mundo-rosa-a12b9",
  storageBucket: "mundo-rosa-a12b9.firebasestorage.app",
  messagingSenderId: "382729644220",
  appId: "1:382729644220:web:3785cabbe83853239088b9",
  measurementId: "G-H6RD44ZQEG"
};

const isConfigured = true;

const app = isConfigured ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;

if (db) {
  // habilitar persistencia multi-pestaña para evitar errores de pantalla blanca
  import('firebase/firestore').then(({ enableMultiTabIndexedDbPersistence }) => {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      console.warn("Firestore persistence warning:", err.code);
    });
  });
}

export { db, storage, isConfigured };

