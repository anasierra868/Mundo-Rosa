const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// INSTRUCTIONS:
// 1. Download your service account key from Firebase Console (Project Settings > Service Accounts).
// 2. Save it as 'serviceAccountKey.json' in this directory.
// 3. Run: node scripts/migrate.js

const serviceAccount = require('../serviceAccountKey.json');
const catalogPath = path.join(__dirname, '../public/catalog.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  console.log(`🚀 Iniciando migración de ${data.length} productos...`);

  const collectionRef = db.collection('products');
  const batchSize = 500;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = db.batch();
    const chunk = data.slice(i, i + batchSize);
    
    chunk.forEach(product => {
      // Use existing ID if available, otherwise generated one
      const docRef = product.id ? collectionRef.doc(product.id) : collectionRef.doc();
      batch.set(docRef, product);
    });

    await batch.commit();
    console.log(`✅ Procesados ${Math.min(i + batchSize, data.length)} / ${data.length}`);
  }

  console.log('✨ Migración completada con éxito.');
}

migrate().catch(console.error);
