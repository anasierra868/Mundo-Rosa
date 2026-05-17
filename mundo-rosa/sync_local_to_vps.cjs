const fs = require('fs');
const path = require('path');

const LOCAL_URL = 'http://127.0.0.1:8090';
const VPS_URL = 'https://137-184-198-49.sslip.io';
const IDENTITY = 'admin@mundorosa.com';
const PASSWORD = 'mundorosa2026';
const ALT_IDENTITY = 'patioroz@gmail.com';
const ALT_PASSWORD = 'Ana_45003235_Ep';

async function authenticate(baseUrl) {
  console.log(`🔐 Autenticando en ${baseUrl}...`);
  try {
    let res = await fetch(`${baseUrl}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: IDENTITY, password: PASSWORD })
    });

    if (!res.ok) {
      console.warn(`⚠️ Intento con cuenta principal falló en ${baseUrl}. Probando alternativa...`);
      res = await fetch(`${baseUrl}/api/admins/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: ALT_IDENTITY, password: ALT_PASSWORD })
      });
    }

    if (!res.ok) {
      throw new Error(`Código de estado HTTP: ${res.status}`);
    }

    const data = await res.json();
    console.log(`✅ Autenticado con éxito en ${baseUrl}`);
    return data.token;
  } catch (error) {
    console.error(`❌ Error al autenticar en ${baseUrl}:`, error.message);
    throw error;
  }
}

async function getRecords(baseUrl, token, collectionName) {
  console.log(`📥 Descargando registros de '${collectionName}' desde ${baseUrl}...`);
  try {
    const res = await fetch(`${baseUrl}/api/collections/${collectionName}/records?perPage=5000`, {
      headers: { 'Authorization': token }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`✅ Se obtuvieron ${data.items.length} registros.`);
    return data.items;
  } catch (error) {
    console.error(`❌ Error al obtener registros de ${collectionName}:`, error.message);
    return [];
  }
}

async function syncCollection(localToken, vpsToken, collectionName) {
  console.log(`\n🔄 Sincronizando colección: '${collectionName}'...`);
  
  const localRecords = await getRecords(LOCAL_URL, localToken, collectionName);
  if (localRecords.length === 0) {
    console.log(`ℹ️ No hay registros locales para sincronizar en '${collectionName}'`);
    return;
  }

  // Descargar registros del VPS para comparar
  const vpsRecords = await getRecords(VPS_URL, vpsToken, collectionName);
  const vpsMap = new Map(vpsRecords.map(r => [r.id, r]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < localRecords.length; i++) {
    const local = localRecords[i];
    
    // Limpiar campos de metadatos de PocketBase que no se deben enviar o modificar
    const payload = {};
    for (const key in local) {
      if (!['collectionId', 'collectionName', 'created', 'updated'].includes(key)) {
        payload[key] = local[key];
      }
    }

    const vpsRecord = vpsMap.get(local.id);

    try {
      if (vpsRecord) {
        // Verificar si hay diferencias reales para evitar peticiones redundantes
        let hasChanges = false;
        for (const key in payload) {
          if (JSON.stringify(payload[key]) !== JSON.stringify(vpsRecord[key])) {
            hasChanges = true;
            break;
          }
        }

        if (hasChanges) {
          // Actualizar registro en VPS
          const res = await fetch(`${VPS_URL}/api/collections/${collectionName}/records/${local.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': vpsToken
            },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`PATCH HTTP ${res.status}`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Crear registro en VPS con el ID exacto
        const res = await fetch(`${VPS_URL}/api/collections/${collectionName}/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': vpsToken
          },
          body: JSON.stringify({ id: local.id, ...payload })
        });
        if (!res.ok) throw new Error(`POST HTTP ${res.status}`);
        created++;
      }
    } catch (e) {
      console.error(`❌ Error sincronizando ${local.name || local.code || local.id}:`, e.message);
      errors++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`   Procesados ${i + 1}/${localRecords.length} registros...`);
    }
  }

  console.log(`📊 RESULTADOS PARA '${collectionName}':`);
  console.log(`   Creados: ${created}`);
  console.log(`   Actualizados: ${updated}`);
  console.log(`   Sin cambios: ${skipped}`);
  console.log(`   Errores: ${errors}`);
}

async function run() {
  console.log('🏁 INICIANDO PROCESO DE SINCRONIZACIÓN LOCAL -> VPS');
  try {
    const localToken = await authenticate(LOCAL_URL);
    const vpsToken = await authenticate(VPS_URL);

    // Sincronizar catálogo principal y bodega
    await syncCollection(localToken, vpsToken, 'products');
    await syncCollection(localToken, vpsToken, 'sold_out');
    
    // Opcional: Sincronizar pedidos y pagos
    await syncCollection(localToken, vpsToken, 'orders');
    await syncCollection(localToken, vpsToken, 'payments');

    console.log('\n🏆 ¡PROCESO DE SINCRONIZACIÓN TERMINADO CON ÉXITO!');
  } catch (error) {
    console.error('\n💥 FALLÓ EL PROCESO GLOBAL DE SINCRONIZACIÓN:', error.message);
  }
}

run();
