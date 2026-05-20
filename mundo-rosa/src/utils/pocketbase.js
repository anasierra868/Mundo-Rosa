import PocketBase from 'pocketbase';

const PB_URL = 'https://137-184-198-49.sslip.io';
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false); 

export async function initPB(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            if (pb.authStore.isValid) return pb;

            console.log(`🔄 Intento de conexión ${i + 1}...`);
            
            const response = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity: 'admin@mundorosa.com',
                    password: 'mundorosa2026'
                })
            });

            if (response.ok) {
                const authData = await response.json();
                pb.authStore.save(authData.token, authData.admin);
                console.log("✅ Conexión establecida exitosamente.");
                return pb;
            } else {
                console.warn("⚠️ Fallo con cuenta principal, probando alternativa...");
                const responseAlt = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identity: 'patioroz@gmail.com',
                        password: 'Ana_45003235_Ep'
                    })
                });
                if (responseAlt.ok) {
                    const authDataAlt = await responseAlt.json();
                    pb.authStore.save(authDataAlt.token, authDataAlt.admin);
                    return pb;
                }
            }
        } catch (e) {
            console.error(`❌ Error en intento ${i + 1}:`, e.message);
            if (i === retries - 1) throw e;
            // Esperar 1 segundo antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return pb;
}

export default pb;
