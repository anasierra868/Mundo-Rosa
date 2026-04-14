import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, setDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAm1nLIMVK35-kyQVH3W4d5diUXSFQFoRo",
  authDomain: "mundo-rosa-a12b9.firebaseapp.com",
  projectId: "mundo-rosa-a12b9",
  storageBucket: "mundo-rosa-a12b9.firebasestorage.app",
  messagingSenderId: "382729644220",
  appId: "1:382729644220:web:3785cabbe83853239088b9",
  measurementId: "G-H6RD44ZQEG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
    try {
        console.log("Conectando a Firestore...");
        const snapshot = await getDocs(collection(db, "products"));
        console.log(`Productos encontrados: ${snapshot.docs.length}`);
        
        // Let's test write permissions
        await setDoc(doc(db, "products", "test_item"), { name: "Test" });
        console.log("Prueba de escritura exitosa.");
        
    } catch (e) {
        console.error("Error conectando a DB:", e.message);
    }
}

check();
