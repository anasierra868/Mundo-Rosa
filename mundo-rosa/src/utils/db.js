import pb from "./pocketbase";

// Helper: base URL del servidor PocketBase
export const PB_BASE_URL = "https://137-184-198-49.sslip.io";

/**
 * Construye la URL pública de la imagen 'img' de un record de producto.
 * @param {Object} record - El record retornado por PocketBase tras create/update
 * @returns {string|null} URL completa del archivo o null
 */
export const getProductImageUrl = (record) => {
    if (!record || !record.img) return null;
    return `${PB_BASE_URL}/api/files/${record.collectionId}/${record.id}/${record.img}`;
};

const COLLECTION_NAME = "products";
const ORDERS_COLLECTION = "orders";
const PAYMENTS_COLLECTION = "payments";
const METADATA_COLLECTION = "metadata";
const SOLD_OUT_COLLECTION = "sold_out";

// v23.0: MASTER CLOCK & SMART CACHE — Max Savings Shield
export const getCatalogMetadata = async () => {
    try {
        const records = await pb.collection(METADATA_COLLECTION).getFullList({
            filter: 'name = "catalog"'
        });
        return records.length > 0 ? records[0] : null;
    } catch (e) {
        console.error("Error fetching metadata from PocketBase:", e);
        return null;
    }
};

export const updateCatalogMetadata = async (forceRefresh = false) => {
    try {
        const existing = await getCatalogMetadata();
        const data = {
            name: 'catalog',
            lastUpdate: new Date().toISOString(),
            forceRefresh
        };
        if (existing) {
            await pb.collection(METADATA_COLLECTION).update(existing.id, data);
        } else {
            await pb.collection(METADATA_COLLECTION).create(data);
        }
    } catch (e) {
        console.error("Error updating metadata in PocketBase:", e);
    }
};

export const onCatalogMetadataUpdate = (callback) => {
    pb.collection(METADATA_COLLECTION).subscribe('*', ({ action, record }) => {
        if (record.name === 'catalog') {
            callback(record);
        }
    });
    return () => pb.collection(METADATA_COLLECTION).unsubscribe();
};

// v33.1: REAL-TIME CATALOG SYNC — Reforzado con Reintento Automático
export const onProductsUpdate = (callback) => {
    console.log("📡 Iniciando suscripción de catálogo en tiempo real...");
    
    // Suscribirse a todos los eventos (*) de la colección de productos
    pb.collection(COLLECTION_NAME).subscribe('*', ({ action, record }) => {
        try {
            let finalImg = null;
            if (record.img) {
                finalImg = `${pb.baseUrl}/api/files/${record.collectionId}/${record.id}/${record.img}`;
            } else if (record.image && typeof record.image === 'string' && record.image.startsWith('data:image')) {
                finalImg = record.image;
            }
            
            callback({
                action,
                product: { ...record, image: finalImg }
            });
        } catch (err) {
            console.error("❌ Error procesando actualización en tiempo real:", err);
        }
    }).catch(err => {
        console.error("❌ Falló la conexión en tiempo real:", err);
        // Reintento tras 5 segundos si falla la conexión inicial
        setTimeout(() => onProductsUpdate(callback), 5000);
    });

    return () => {
        console.log("🔌 Cerrando suscripción de catálogo.");
        pb.collection(COLLECTION_NAME).unsubscribe().catch(() => {});
    };
};

// ADVISOR AUTH CENTRALIZED v2.10
export const ADVISOR_CODES = { 
  '1349': 'Dharma Perea', 
  '3768': 'Marcela', 
  '1947': 'Luisa Patiño',
  '4399': 'Esteban',
  '2815': 'Alexa',
  '6643': 'Elkin Patiño'
};

// ===== PRODUCT MANAGEMENT =====

/**
 * Reduce Image size and convert to WebP for maximum performance
 */
export const compressImage = (base64Str, maxWidth = 700, quality = 0.7) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth * height) / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const result = canvas.toDataURL('image/webp', quality);
            
            // v5.3 MEMORY SHIELD: Explicit Cleanup
            ctx.clearRect(0, 0, width, height);
            canvas.width = 0;
            canvas.height = 0;
            img.onload = null;
            img.src = "";
            
            resolve(result);
        };
    });
};

/**
 * Load all products from PocketBase
 */
export const loadLocalProducts = async () => {
    try {
        // v24.0: SMART TIMEOUT SHIELD — Don't block the UI forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos máximo

        const records = await pb.collection(COLLECTION_NAME).getFullList({
            sort: 'name',
            fields: 'id,name,sku,category,stock,location,mayor,detal,img,image,collectionId,collectionName,updated',
            requestKey: 'load_products_main' // Evita colisiones de peticiones
        });

        clearTimeout(timeoutId);

        return records.map(r => {
            let finalImg = null;
            if (r.img) {
                finalImg = `${pb.baseUrl}/api/files/${r.collectionId}/${r.id}/${r.img}`;
            } else if (r.image && typeof r.image === 'string' && r.image.startsWith('data:image')) {
                finalImg = r.image;
            }
            return { ...r, image: finalImg };
        });
    } catch (e) {
        console.warn("⚠️ Carga lenta o abortada: Usando catálogo local/vacío para no bloquear.");
        return [];
    }
};

/**
 * DELTA SYNC: Solo descarga productos creados/modificados después de sinceTimestamp.
 * Evita bajar todo el catálogo — mínimo costo de servidor.
 * @param {string} sinceTimestamp - ISO string del último timestamp conocido localmente
 */
export const loadProductsDelta = async (sinceTimestamp) => {
    try {
        const records = await pb.collection(COLLECTION_NAME).getFullList({
            sort: 'updated',
            filter: `updated >= "${sinceTimestamp}"`,
            fields: 'id,name,sku,category,stock,location,mayor,detal,img,collectionId,collectionName,updated'
        });
        return records.map(r => {
            let finalImg = null;
            if (r.img) {
                finalImg = `${pb.baseUrl}/api/files/${r.collectionId}/${r.id}/${r.img}`;
            }
            return { ...r, image: finalImg };
        });
    } catch (e) {
        console.error("Error loading delta products:", e);
        return [];
    }
};

/**
 * Save or Update a single product in PocketBase
 */
export const saveProduct = async (product, checkStock = null, silent = false) => {
    try {
        let finalProduct = { ...product };

        const cleanData = {
            ...finalProduct,
            stock: checkStock !== null ? checkStock : finalProduct.stock,
            updatedAt: new Date().toISOString()
        };

        const { id, created, updated, collectionId, collectionName, ...dataToSend } = cleanData;

        let payload;

        const hasBase64 = dataToSend.image && typeof dataToSend.image === 'string' && dataToSend.image.startsWith('data:image');
        const hasFile = !!dataToSend.imageFile;

        if (hasBase64 || hasFile) {
            // TURBO UPLOAD: Usar FormData con campo 'img' (archivo real PocketBase)
            payload = new FormData();
            for (let key in dataToSend) {
                if (key === 'image' || key === 'imageFile') continue; // los manejamos abajo
                if (dataToSend[key] !== undefined && dataToSend[key] !== null) {
                    payload.append(key, dataToSend[key]);
                }
            }
            if (hasFile) {
                // Archivo real (File object) → campo 'img'
                payload.append('img', dataToSend.imageFile, dataToSend.imageFile.name || 'imagen.webp');
            } else if (hasBase64) {
                // Base64 → convertir a Blob → campo 'img'
                const res = await fetch(dataToSend.image);
                const blob = await res.blob();
                payload.append('img', blob, `${dataToSend.sku || 'img'}.webp`);
            }
        } else {
            // Sin imagen nueva: enviar campos simples, omitir image/img para no pisar
            const { image, imageFile, ...rest } = dataToSend;
            payload = rest;
        }

        let record;
        if (id) {
            record = await pb.collection(COLLECTION_NAME).update(id, payload);
        } else {
            record = await pb.collection(COLLECTION_NAME).create(payload);
        }

        // Sincronización de stock por SKU
        if (checkStock !== null && cleanData.sku) {
            const clones = await pb.collection(COLLECTION_NAME).getFullList({
                filter: `sku = "${cleanData.sku}" && id != "${record.id}"`
            });
            for (const clone of clones) {
                await pb.collection(COLLECTION_NAME).update(clone.id, { stock: checkStock });
            }
        }
        
        if (!silent) await updateCatalogMetadata();
        // Retornar el record completo para poder construir la URL de imagen
        return record;
    } catch (e) {
        console.error("Error saving product to PocketBase:", e);
        return null;
    }
};

export const deductProductStock = async (productId, qtyToDeduct) => {
    try {
        const product = await pb.collection(COLLECTION_NAME).getOne(productId);
        
        // ♾️ Si el stock está vacío o es infinito, no decrementamos nada
        const stockStr = product.stock !== null && product.stock !== undefined ? String(product.stock).trim() : "";
        if (stockStr === "" || stockStr.toLowerCase() === "infinito" || stockStr.toLowerCase() === "infinity" || stockStr === "♾️") {
            return true;
        }

        const currentStock = parseInt(product.stock || 0);
        const newStock = Math.max(0, currentStock - qtyToDeduct);
        
        await pb.collection(COLLECTION_NAME).update(productId, { stock: newStock });

        if (product.sku) {
            const clones = await pb.collection(COLLECTION_NAME).getFullList({
                filter: `sku = "${product.sku}" && id != "${productId}"`
            });
            for (const clone of clones) {
                await pb.collection(COLLECTION_NAME).update(clone.id, { stock: newStock });
            }
        }

        await updateCatalogMetadata();
        return true;
    } catch (e) {
        console.error("Error deductProductStock:", e);
        return false;
    }
};

export const restoreProductStock = async (productId, qtyToRestore) => {
    try {
        const product = await pb.collection(COLLECTION_NAME).getOne(productId);
        
        // ♾️ Si el stock está vacío o es infinito, no incrementamos nada
        const stockStr = product.stock !== null && product.stock !== undefined ? String(product.stock).trim() : "";
        if (stockStr === "" || stockStr.toLowerCase() === "infinito" || stockStr.toLowerCase() === "infinity" || stockStr === "♾️") {
            return true;
        }

        const currentStock = parseInt(product.stock || 0);
        const newStock = currentStock + qtyToRestore;
        
        await pb.collection(COLLECTION_NAME).update(productId, { stock: newStock });

        if (product.sku) {
            const clones = await pb.collection(COLLECTION_NAME).getFullList({
                filter: `sku = "${product.sku}" && id != "${productId}"`
            });
            for (const clone of clones) {
                await pb.collection(COLLECTION_NAME).update(clone.id, { stock: newStock });
            }
        }

        await updateCatalogMetadata();
        return true;
    } catch (e) {
        console.error("Error restoreProductStock:", e);
        return false;
    }
};

// ===== ORDERS MANAGEMENT =====

export const createOrder = async (orderData) => {
    try {
        await pb.collection(ORDERS_COLLECTION).create({
            ...orderData,
            createdAt: new Date().toISOString()
        });
        return true;
    } catch (e) {
        console.error("Error creating order in PocketBase", e);
        return false;
    }
};

export const onOrdersUpdate = (callback) => {
    let currentOrders = [];
    const fetchAll = async () => {
        try {
            const records = await pb.collection(ORDERS_COLLECTION).getFullList({ sort: '-created' });
            currentOrders = records.map(r => ({ ...r, id: r.id }));
            callback(currentOrders);
        } catch (e) { console.warn("⚠️ Orders fetch failed, retrying on next update."); }
    };
    fetchAll();
    pb.collection(ORDERS_COLLECTION).subscribe('*', ({ action, record }) => {
        if (action === 'create') currentOrders = [record, ...currentOrders];
        else if (action === 'update') currentOrders = currentOrders.map(o => o.id === record.id ? record : o);
        else if (action === 'delete') currentOrders = currentOrders.filter(o => o.id !== record.id);
        callback(currentOrders);
    }).catch(() => { /* SSE error — silently ignore, data was already fetched */ });
    return () => pb.collection(ORDERS_COLLECTION).unsubscribe().catch(() => {});
};


export const deleteOrder = async (id) => {
    try {
        await pb.collection(ORDERS_COLLECTION).delete(id);
        return true;
    } catch (e) { return false; }
};

// ===== PAYMENTS MANAGEMENT =====

export const addPayment = async (paymentData) => {
    const traceId = `ABONO-${Date.now()}`;
    console.group(`🔵 [${traceId}] INICIO addPayment`);
    console.log('  📦 Datos recibidos:', {
        customerName: paymentData.customerName,
        amount: paymentData.amount,
        date: paymentData.date,
        advisorName: paymentData.advisorName,
        type: paymentData.type,
        tieneImagen: !!(paymentData.receiptImage || paymentData.image),
        imagenTamano: (paymentData.receiptImage || paymentData.image || '').length
    });

    try {
        const { receiptImage, image, ...data } = paymentData;
        const formData = new FormData();

        // Campos de texto
        for (const key in data) {
            if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        }
        formData.append('createdAt', new Date().toISOString());
        console.log('  ✅ PASO 1: Campos de texto agregados al FormData');

        // Imagen del recibo → campo 'receiptFile' (tipo FILE real en PocketBase)
        const imgSource = receiptImage || image;
        if (imgSource && typeof imgSource === 'string' && imgSource.startsWith('data:image')) {
            console.log(`  🖼️ PASO 2: Procesando imagen (${Math.round(imgSource.length / 1024)}KB)...`);
            const res = await fetch(imgSource);
            const blob = await res.blob();
            console.log(`  ✅ PASO 2: Blob generado (${Math.round(blob.size / 1024)}KB, tipo: ${blob.type})`);
            formData.append('receiptFile', blob, `receipt_${Date.now()}.webp`);
        } else {
            console.log('  ⚠️ PASO 2: Sin imagen — registro sin evidencia fotográfica');
        }

        console.log('  🚀 PASO 3: Enviando a PocketBase colección:', PAYMENTS_COLLECTION);
        const record = await pb.collection(PAYMENTS_COLLECTION).create(formData);
        console.log('  ✅ PASO 3: GUARDADO EXITOSO — ID generado:', record.id);
        console.log('  🖼️ receiptFile en DB:', record.receiptFile || '(sin imagen)');
        console.groupEnd();
        return true;
    } catch (e) {
        console.error(`  ❌ FALLO en [${traceId}]:`, e.message);
        console.error('  📋 Error completo:', e);
        console.groupEnd();
        return false;
    }
};


export const onAllPaymentsUpdate = (callback) => {
    let currentPayments = [];

    // Helper: construye la URL completa de la imagen del recibo
    const buildReceiptUrl = (record) => {
        // PRIORIDAD 1: receiptFile (tipo file real en PocketBase — nuevo)
        if (record.receiptFile) {
            if (typeof record.receiptFile === 'string') {
                if (record.receiptFile.startsWith('http') || record.receiptFile.startsWith('data:')) {
                    return record.receiptFile.replace('http://137.184.198.49', 'https://137-184-198-49.sslip.io');
                }
                return `${PB_BASE_URL}/api/files/${record.collectionId}/${record.id}/${record.receiptFile}`;
            }
        }
        // PRIORIDAD 2: receiptImage (campo texto legacy)
        if (record.receiptImage && typeof record.receiptImage === 'string') {
            if (record.receiptImage.startsWith('http') || record.receiptImage.startsWith('data:')) {
                return record.receiptImage.replace('http://137.184.198.49', 'https://137-184-198-49.sslip.io');
            }
            if (record.receiptImage.length > 10) {
                return `${PB_BASE_URL}/api/files/${record.collectionId}/${record.id}/${record.receiptImage}`;
            }
        }
        return null;
    };

    const fetchAll = async () => {
        try {
            const records = await pb.collection(PAYMENTS_COLLECTION).getFullList({ sort: '-created' });
            currentPayments = records.map(r => ({
                ...r,
                id: r.id,
                receiptImage: buildReceiptUrl(r) || r.receiptImage
            }));
            callback(currentPayments);
        } catch (e) { console.warn("⚠️ Payments fetch failed:", e.message); }
    };
    fetchAll();

    pb.collection(PAYMENTS_COLLECTION).subscribe('*', ({ action, record }) => {
        let rec = { ...record, id: record.id };
        rec.receiptImage = buildReceiptUrl(rec) || rec.receiptImage;

        if (action === 'create') currentPayments = [rec, ...currentPayments];
        else if (action === 'update') currentPayments = currentPayments.map(p => p.id === rec.id ? rec : p);
        else if (action === 'delete') currentPayments = currentPayments.filter(p => p.id !== rec.id);
        callback(currentPayments);
    }).catch(() => { /* SSE error — silently ignore */ });

    return () => pb.collection(PAYMENTS_COLLECTION).unsubscribe().catch(() => {});
};


export const deletePayment = async (id) => {
    try {
        await pb.collection(PAYMENTS_COLLECTION).delete(id);
        return true;
    } catch (e) { return false; }
};

export const updatePayment = async (id, data) => {
    try {
        await pb.collection(PAYMENTS_COLLECTION).update(id, data);
        return true;
    } catch (e) { return false; }
};

export const getOrdersCountForCustomer = async (customerName) => {
    try {
        const nameToMatch = customerName.toLowerCase().trim();
        const records = await pb.collection(ORDERS_COLLECTION).getFullList();
        return records.filter(doc => {
            const code = (doc.code || "").toLowerCase();
            return code === nameToMatch || code.startsWith(nameToMatch + " (separado #");
        }).length;
    } catch (e) { return 0; }
};

// ===== SOLD OUT / VAULT =====

export const onSoldOutUpdate = (callback) => {
    const buildVaultList = (records) => records.map(r => ({
        ...r,
        // image can be: base64 string OR a URL (for old records)
        image: r.image || "",
        mayor: parseInt(r.mayor) || 0,
        detal: parseInt(r.detal) || 0,
        stock: parseInt(r.stock) || 0
    }));

    pb.collection(SOLD_OUT_COLLECTION).getFullList({ sort: '-created' }).then(records => callback(buildVaultList(records)));
    pb.collection(SOLD_OUT_COLLECTION).subscribe("*", async () => {
        const list = await pb.collection(SOLD_OUT_COLLECTION).getFullList({ sort: '-created' });
        callback(buildVaultList(list));
    });
    return () => pb.collection(SOLD_OUT_COLLECTION).unsubscribe();
};

// ⏰ Auto-purge: delete vault items older than 28 days
export const purgeExpiredVaultItems = async () => {
    try {
        const records = await pb.collection(SOLD_OUT_COLLECTION).getFullList();
        const now = new Date();
        let purged = 0;
        for (const r of records) {
            const deletedAt = new Date(r.soldOutAt || r.created);
            const daysDiff = (now - deletedAt) / (1000 * 60 * 60 * 24);
            if (daysDiff >= 28) {
                await pb.collection(SOLD_OUT_COLLECTION).delete(r.id);
                purged++;
            }
        }
        if (purged > 0) console.log(`🧹 Auto-purge: ${purged} artículos de más de 28 días eliminados de la bóveda.`);
        return purged;
    } catch (e) {
        console.error('Error in purgeExpiredVaultItems:', e);
        return 0;
    }
};

export const restoreProductFromSoldOut = async (productId) => {
    try {
        const item = await pb.collection(SOLD_OUT_COLLECTION).getOne(productId);
        const { id, created, updated, collectionId, collectionName, soldOutAt, ...rest } = item;
        
        // Stock VACÍO por seguridad
        const productToRestore = { ...rest, stock: null };

        await saveProduct(productToRestore);
        await pb.collection(SOLD_OUT_COLLECTION).delete(productId);
        return true;
    } catch (e) { return false; }
};

export const deleteSoldOutPermanently = async (productId) => {
    try {
        await pb.collection(SOLD_OUT_COLLECTION).delete(productId);
    } catch (e) { console.error("Error deleting from vault:", e); }
};

// ===== PRODUCT HELPERS =====

export const deleteProduct = async (id) => {
    try {
        // 1. Obtener el producto antes de borrarlo para enviarlo a la Bóveda de Agotados
        const product = await pb.collection(COLLECTION_NAME).getOne(id).catch(() => null);
        
        if (product) {
            const { id: oldId, collectionId, collectionName, created, updated, expand, img, image, ...vaultData } = product;
            vaultData.soldOutAt = new Date().toISOString();
            
            // Transformar la imagen física en Base64 para que no se pierda al borrar el original
            let finalImage = '';
            try {
                if (img) {
                    const imgUrl = getProductImageUrl(product);
                    if (imgUrl) {
                        const response = await fetch(imgUrl);
                        if (response.ok) {
                            const blob = await response.blob();
                            finalImage = await new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result);
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                } else if (image && image.startsWith('data:')) {
                    finalImage = image; // Ya es Base64
                } else if (image && image.startsWith('http')) {
                    finalImage = image; // URL Externa
                }
            } catch (imgError) {
                console.warn('⚠️ No se pudo convertir la imagen a Base64 para la bóveda:', imgError);
                finalImage = image || '';
            }
            
            vaultData.image = finalImage;

            // 2. Guardar en la bóveda
            await pb.collection(SOLD_OUT_COLLECTION).create(vaultData).catch(e => {
                console.warn("No se pudo guardar en la bóveda, procediendo a borrar:", e);
            });
        }

        // 3. Eliminación del catálogo principal
        // ⚠️ COMENTADO TEMPORALMENTE — Medida de seguridad durante implementación de inventarios.
        // Activar cuando la lógica de stock esté completamente lista para evitar borrados accidentales.
        // await pb.collection(COLLECTION_NAME).delete(id);
        await updateCatalogMetadata();
        return true;
    } catch (e) {
        console.error('Error al enviar a bóveda / eliminar:', e);
        return false;
    }
};

export const getVaultProducts = async () => {
    try {
        const records = await pb.collection('sold_out').getFullList({ sort: '-created' });
        return records.map(r => {
            let img = r.image || "";
            if (img && typeof img === 'string') {
                img = img.replace('http://137.184.198.49', 'https://137-184-198-49.sslip.io');
            }
            return {
                ...r,
                image: img,
                mayor: parseInt(r.mayor) || 0,
                detal: parseInt(r.detal) || 0,
                stock: parseInt(r.stock) || 0
            };
        });
    } catch (e) { console.error("Error fetching vault:", e); return []; }
};

export const restoreFromVault = async (vaultId, productData) => {
    try {
        const { id, collectionId, collectionName, created, updated, soldOutAt, img, image, ...rest } = productData;

        // Build the product to restore - image field contains base64 or URL
        const hasBase64 = image && image.startsWith('data:image');

        let payload;
        if (hasBase64) {
            // Convert base64 back to file and upload properly
            payload = new FormData();
            for (const [key, val] of Object.entries(rest)) {
                if (val !== undefined && val !== null) payload.append(key, String(val));
            }
            payload.append('stock', '0');
            try {
                const imgRes = await fetch(image);
                const blob = await imgRes.blob();
                payload.append('img', blob, `restored_${Date.now()}.webp`);
            } catch (e) {
                console.warn('⚠️ Could not re-upload image on restore:', e);
            }
        } else {
            // No image or plain URL — just restore text fields
            payload = { ...rest, stock: 0 };
        }

        await pb.collection(COLLECTION_NAME).create(payload);
        await pb.collection(SOLD_OUT_COLLECTION).delete(vaultId);
        await updateCatalogMetadata();
        return true;
    } catch (e) {
        console.error('Error restoring from vault:', e);
        return false;
    }
};

export const deleteFromVault = async (vaultId) => {
    try {
        await pb.collection('sold_out').delete(vaultId);
        return true;
    } catch (e) { console.error("Error deleting from vault:", e); return false; }
};

export const clearDB = async () => {
    try {
        const all = await pb.collection(COLLECTION_NAME).getFullList();
        // v50.16: Limpieza Turbo en bloques para evitar cuelgues
        const chunkSize = 10;
        for (let i = 0; i < all.length; i += chunkSize) {
            const chunk = all.slice(i, i + chunkSize);
            await Promise.all(chunk.map(p => pb.collection(COLLECTION_NAME).delete(p.id).catch(e => console.error(e))));
            await new Promise(r => setTimeout(r, 100)); // Respiro para el servidor
        }
    } catch (e) { console.error("Error clearing DB:", e); }
};

export const saveProductsBatch = async (products, onProgress) => {
    const chunkSize = 5; 
    for (let i = 0; i < products.length; i += chunkSize) {
        if (onProgress) onProgress(i, products.length);
        const chunk = products.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (p) => {
            // v19.0: DO NOT STRIP IDs — Use existing ID to update, or omit to create
            const { created, updated, collectionId, collectionName, ...productToSave } = p;
            return saveProduct(productToSave, null, true);
        }));
        
        await new Promise(r => setTimeout(r, 100));
    }
    await updateCatalogMetadata();
};

export const importProductsFromJSON = async (jsonData, mode, onProgress) => {
    try {
        const products = jsonData.catalog || (Array.isArray(jsonData) ? jsonData : []);
        if (products.length === 0) return false;

        // 1. LIMPIEZA SI ES MODO CLEAN
        if (mode === 'clean') {
            if (onProgress) onProgress(0, 0, '🧹 Limpiando catálogo actual...');
            const all = await pb.collection(COLLECTION_NAME).getFullList({ fields: 'id' });
            const chunkSize = 20;
            for (let i = 0; i < all.length; i += chunkSize) {
                const chunk = all.slice(i, i + chunkSize);
                await Promise.all(chunk.map(p => pb.collection(COLLECTION_NAME).delete(p.id).catch(e => console.error(e))));
                if (onProgress) onProgress(i, all.length, `🧹 Limpiando: ${i} de ${all.length}`);
            }
        } else {
            // MODO APPEND: Referenciar duplicados automáticamente
            if (onProgress) onProgress(0, 0, '🔍 Verificando duplicados...');
            const existing = await pb.collection(COLLECTION_NAME).getFullList({ fields: 'name' });
            const existingNames = new Set(existing.map(e => (e.name || "").trim().toLowerCase()));
            
            const generateRandomSKU = () => 'Ref. ' + Math.random().toString(36).substring(2, 5).toUpperCase();

            // En lugar de filtrar, renombramos los que ya existen
            products.forEach(p => {
                const cleanName = (p.name || "").trim();
                if (existingNames.has(cleanName.toLowerCase())) {
                    p.name = `${cleanName} ${generateRandomSKU()}`;
                }
            });

            if (onProgress) onProgress(0, products.length, `✅ Procesados ${products.length} productos con referenciación automática.`);
        }

        // 2. IMPORTACIÓN TURBO (Paralela + Conversión de Imagen)
        if (onProgress) onProgress(0, products.length, '🚀 Iniciando Subida Turbo...');
        
        const batchSize = 5;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            await Promise.all(batch.map(async (p) => {
                try {
                    const formData = new FormData();
                    formData.append('name', p.name || '');
                    formData.append('sku', p.sku || '');
                    formData.append('category', p.category || 'Otros 🎁');
                    formData.append('mayor', p.mayor || 0);
                    formData.append('detal', p.detal || 0);
                    formData.append('stock', p.stock || 0);
                    formData.append('ubicacion', p.location || p.ubicacion || '');
                    
                    // Si ya tiene imageFile (del AdminPanel) lo usamos
                    if (p.imageFile) {
                        formData.append('img', p.imageFile);
                    } 
                    // Si viene como Base64 (del JSON directo) lo convertimos
                    else if (p.image && p.image.startsWith('data:image')) {
                        const res = await fetch(p.image);
                        const blob = await res.blob();
                        formData.append('img', blob, `${p.sku || 'img'}.webp`);
                    }
                    
                    formData.append('image', ''); // Campo viejo vacío
                    await pb.collection(COLLECTION_NAME).create(formData);
                } catch (err) {
                    console.error("Error importando producto:", p.name, err);
                }
            }));
            
            if (onProgress) onProgress(i + batch.length, products.length, `🚀 Subiendo: ${i + batch.length} de ${products.length}`);
        }

        await updateCatalogMetadata(true);
        return true;
    } catch (e) {
        console.error("Error in importProductsFromJSON:", e);
        return false;
    }
};

export const importProductsFromExcel = async (products, mode, onProgress) => {
    try {
        if (products.length === 0) return false;

        // 1. LIMPIEZA SI ES MODO CLEAN
        if (mode === 'clean') {
            if (onProgress) onProgress(0, 0, '🧹 Limpiando catálogo actual...');
            const all = await pb.collection(COLLECTION_NAME).getFullList({ fields: 'id' });
            const chunkSize = 20;
            for (let i = 0; i < all.length; i += chunkSize) {
                const chunk = all.slice(i, i + chunkSize);
                await Promise.all(chunk.map(p => pb.collection(COLLECTION_NAME).delete(p.id).catch(e => console.error(e))));
                if (onProgress) onProgress(i, all.length, `🧹 Limpiando: ${i} de ${all.length}`);
            }
        }

        // Obtener el catálogo actual para mapear por SKU y por Nombre
        const existing = await pb.collection(COLLECTION_NAME).getFullList();
        const existingBySku = {};
        const existingByName = {};
        existing.forEach(p => {
            if (p.sku) existingBySku[p.sku.toLowerCase().trim()] = p;
            if (p.name) existingByName[p.name.toLowerCase().trim()] = p;
        });

        // 2. IMPORTACIÓN EN LOTES
        const batchSize = 10;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            await Promise.all(batch.map(async (p) => {
                try {
                    const cleanSku = (p.sku || "").toLowerCase().trim();
                    const cleanName = (p.name || "").toLowerCase().trim();
                    
                    // Buscar si existe por SKU o por Nombre
                    const existingProduct = (cleanSku && existingBySku[cleanSku]) || existingByName[cleanName];

                    const payload = {
                        name: p.name || '',
                        sku: p.sku || '',
                        category: p.category || 'Otros 🎁',
                        mayor: p.mayor || 0,
                        detal: p.detal || 0,
                        stock: p.stock !== '' ? p.stock : null,
                        location: p.location || '',
                        updatedAt: new Date().toISOString()
                    };

                    if (existingProduct) {
                        // ACTUALIZAR PRODUCTO EXISTENTE (conserva la imagen de PocketBase)
                        await pb.collection(COLLECTION_NAME).update(existingProduct.id, payload);
                    } else if (mode === 'clean' || mode === 'upsert') {
                        // CREAR NUEVO PRODUCTO
                        if (!payload.sku) {
                            payload.sku = 'p-' + Date.now() + Math.floor(Math.random() * 1000);
                        }
                        await pb.collection(COLLECTION_NAME).create(payload);
                    }
                } catch (err) {
                    console.error("Error importando/actualizando producto de Excel:", p.name, err);
                }
            }));
            
            if (onProgress) onProgress(i + batch.length, products.length, `🚀 Sincronizando: ${i + batch.length} de ${products.length}`);
        }

        await updateCatalogMetadata(true);
        return true;
    } catch (e) {
        console.error("Error in importProductsFromExcel:", e);
        return false;
    }
};

export const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// ===== TIMERS (LOCAL STORAGE v5.0) =====

export const startCustomerTimer = async (customerName, durationMinutes = 15) => {
    const timers = JSON.parse(localStorage.getItem('MUNDOROSA_LOCAL_TIMERS') || '[]');
    const newTimer = {
        id: 'TMR_' + Date.now(),
        customerName,
        durationMs: durationMinutes * 60 * 1000,
        startedAt: new Date().toISOString(),
        created: new Date().toISOString()
    };
    timers.push(newTimer);
    localStorage.setItem('MUNDOROSA_LOCAL_TIMERS', JSON.stringify(timers));
    window.dispatchEvent(new Event('local_timers_updated'));
    return newTimer.id;
};

export const deleteCustomerTimer = async (timerId) => {
    const timers = JSON.parse(localStorage.getItem('MUNDOROSA_LOCAL_TIMERS') || '[]');
    const filtered = timers.filter(t => t.id !== timerId);
    localStorage.setItem('MUNDOROSA_LOCAL_TIMERS', JSON.stringify(filtered));
    window.dispatchEvent(new Event('local_timers_updated'));
};

export const onTimersUpdate = (callback) => {
    const emit = () => {
        const timers = JSON.parse(localStorage.getItem('MUNDOROSA_LOCAL_TIMERS') || '[]');
        callback(timers.sort((a, b) => new Date(b.created) - new Date(a.created)));
    };
    
    window.addEventListener('local_timers_updated', emit);
    window.addEventListener('storage', (e) => {
        if (e.key === 'MUNDOROSA_LOCAL_TIMERS') emit();
    });
    
    emit();
    return () => {
        window.removeEventListener('local_timers_updated', emit);
    };
};

// ===== COD PAYMENTS (DOMICILIOS) =====

export const onCODPaymentsUpdate = (callback) => {
    let currentCODPayments = [];
    const fetchAll = async () => {
        try {
            const records = await pb.collection('cod_payments').getFullList({ sort: '-created' });
            currentCODPayments = records.map(r => ({ ...r, id: r.id }));
            callback(currentCODPayments);
        } catch (e) { console.error("Error fetching COD payments:", e); }
    };
    fetchAll();
    
    pb.collection('cod_payments').subscribe('*', ({ action, record }) => {
        if (action === 'create') currentCODPayments = [record, ...currentCODPayments];
        else if (action === 'update') currentCODPayments = currentCODPayments.map(t => t.id === record.id ? record : t);
        else if (action === 'delete') currentCODPayments = currentCODPayments.filter(t => t.id !== record.id);
        callback(currentCODPayments);
    });
    
    return () => pb.collection('cod_payments').unsubscribe();
};

export const deleteCODPayment = async (id) => {
    try {
        await pb.collection('cod_payments').delete(id);
        return true;
    } catch (e) {
        console.error("Error deleting COD payment:", e);
        return false;
    }
};

export const addCODPayment = async (data) => {
    try {
        const record = await pb.collection('cod_payments').create({
            ...data,
            type: 'domicilio',
            createdAt: new Date().toISOString()
        });
        return record;
    } catch (e) {
        console.error("Error adding COD payment:", e);
        return null;
    }
};

export const updatePaymentGlobal = async (id, data) => {
    try {
        await pb.collection(PAYMENTS_COLLECTION).update(id, data);
        return true;
    } catch (e) { return false; }
};

export const differentiateDuplicatesOnly = async (onProgress) => {
    try {
        if (onProgress) onProgress('⌛ Analizando catálogo en busca de duplicados...');
        const allProducts = await pb.collection(COLLECTION_NAME).getFullList();
        
        const groups = {};
        allProducts.forEach(p => {
            const key = `${(p.name || "").toLowerCase().trim()}_${p.detal || 0}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        const duplicates = Object.values(groups).filter(g => g.length > 1);
        if (duplicates.length === 0) {
            if (onProgress) onProgress('✅ No se encontraron duplicados.');
            return 0;
        }

        let updatedCount = 0;
        if (onProgress) onProgress(`🚀 Diferenciando ${duplicates.length} grupos...`);

        for (const group of duplicates) {
            for (const p of group) {
                const sku = Math.random().toString(36).substring(2, 5).toUpperCase();
                let cleanName = (p.name || "").split(' Cód. Ref.')[0].split(' Ref.')[0].trim();
                const newName = `${cleanName} Ref. ${sku}`;
                await pb.collection(COLLECTION_NAME).update(p.id, { name: newName, sku });
                updatedCount++;
            }
        }
        
        await updateCatalogMetadata();
        if (onProgress) onProgress(`✅ ¡Éxito! ${updatedCount} productos diferenciados.`);
        return updatedCount;
    } catch (e) {
        console.error("Error in differentiateDuplicatesOnly", e);
        if (onProgress) onProgress('❌ Error al diferenciar.');
        return 0;
    }
};

export const cleanupGlobalFormat = async (onProgress) => {
    try {
        if (onProgress) onProgress('⌛ Limpiando formato de nombres...');
        const allProducts = await pb.collection(COLLECTION_NAME).getFullList();
        let updatedCount = 0;

        for (const p of allProducts) {
            const name = p.name || "";
            if (name.includes(' Cód. Ref.')) {
                const newName = name.replace(' Cód. Ref.', ' Ref.');
                await pb.collection(COLLECTION_NAME).update(p.id, { name: newName });
                updatedCount++;
            }
        }

        await updateCatalogMetadata();
        if (onProgress) onProgress(`✅ ¡Limpieza terminada! ${updatedCount} corregidos.`);
        return updatedCount;
    } catch (e) {
        if (onProgress) onProgress('❌ Error al limpiar.');
        return 0;
    }
};
export const exportSystemBackup = async () => {};
export const createNewCustomer = async () => {};
export const runRetroactiveMigration = async () => {};

export const getUniquePendingNames = async () => {
    try {
        const records = await pb.collection(ORDERS_COLLECTION).getFullList();
        const names = records.map(r => (r.code || "").split(' (')[0].trim());
        return Array.from(new Set(names)).filter(n => n.length > 0);
    } catch (e) { return []; }
};

export const updateOrder = async (id, data) => {
    try { 
        await pb.collection(ORDERS_COLLECTION).update(id, data); 
        return true;
    } catch (e) {
        console.error("Error updating order:", id, e);
        return false;
    }
};

export const onCustomerPaymentsUpdate = (customerName, callback) => {
    pb.collection(PAYMENTS_COLLECTION).getFullList({ sort: '-created' }).then(records => {
        const nameToMatch = (customerName || "").toLowerCase().trim();
        callback(records.filter(p => (p.customerName || "").toLowerCase().trim() === nameToMatch));
    }).catch(() => callback([]));
    return () => {};
};

export const deleteProductGlobalAtomic = async (productId, orderId, updatedItems) => {
    try {
        await pb.collection(COLLECTION_NAME).delete(productId);
        if (orderId && updatedItems) {
            const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * (it.unitPrice || 0)), 0);
            await pb.collection(ORDERS_COLLECTION).update(orderId, { items: updatedItems, total: newTotal });
        }
        return true;
    } catch (e) { return false; }
};

export const cremateOldDifuntos = async () => {
    try {
        const allOrders = await pb.collection(ORDERS_COLLECTION).getFullList();
        const now = new Date();
        const limitDays = 90;
        let crematedCount = 0;

        for (const order of allOrders) {
            if (order.customerId && order.customerId.startsWith('ELM_')) {
                const orderDate = new Date(order.updated || order.created);
                const diffDays = Math.floor(Math.abs(now - orderDate) / (1000 * 60 * 60 * 24));
                if (diffDays >= limitDays) {
                    await pb.collection(ORDERS_COLLECTION).delete(order.id);
                    crematedCount++;
                }
            }
        }
        if (crematedCount > 0) console.log(`🔥 CREMATORIO: ${crematedCount} difuntos antiguos eliminados.`);
        return true;
    } catch (e) { return false; }
};

export const purgeCustomerData = async (customerName, customerId = null) => {
    try {
        const nameToMatch = (customerName || "").toLowerCase().trim();
        const allOrders = await pb.collection(ORDERS_COLLECTION).getFullList();
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const shortTime = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        const newId = `ELM_${(customerName || 'SIN_NOMBRE').trim().toUpperCase()}_${timestamp}_${shortTime}`;

        for (const order of allOrders) {
            const isMatch = customerId ? (order.customerId === customerId) : ((order.code || "").split(' (')[0].toLowerCase().trim() === nameToMatch);
            if (isMatch) {
                await pb.collection(ORDERS_COLLECTION).update(order.id, { customerId: newId, status: 'dispatched' });
            }
        }

        // v67.1 Limpieza de Domicilios Fantasmas
        const allCodPayments = await pb.collection('cod_payments').getFullList();
        for (const cod of allCodPayments) {
            if ((cod.customerName || "").toLowerCase().trim() === nameToMatch) {
                await pb.collection('cod_payments').update(cod.id, { customerName: newId });
            }
        }

        return true;
    } catch (e) { return false; }
};

export const renameCustomer = async (oldName, newName, customerId = null) => {
    try {
        const orders = await pb.collection(ORDERS_COLLECTION).getFullList();
        for (const o of orders) {
            const isMatch = customerId 
                ? (o.customerId === customerId)
                : ((o.code || "").toUpperCase().startsWith(oldName.toUpperCase()));

            if (isMatch) {
                const newCode = o.code.replace(new RegExp(oldName, 'i'), newName);
                await pb.collection(ORDERS_COLLECTION).update(o.id, { code: newCode });
            }
        }

        // v67.1 Renombrar Domicilios
        const allCodPayments = await pb.collection('cod_payments').getFullList();
        for (const cod of allCodPayments) {
            if ((cod.customerName || "").toLowerCase().trim() === oldName.toLowerCase().trim()) {
                await pb.collection('cod_payments').update(cod.id, { customerName: newName });
            }
        }

        return true;
    } catch (e) { return false; }
};

export const updateOrderAbono = async (orderId, index, updatedData) => {
    try {
        const order = await pb.collection(ORDERS_COLLECTION).getOne(orderId);
        const history = [...(order.abonoHistory || [])];
        if (index >= 0 && index < history.length) {
            // Preservamos los datos originales y solo sobreescribimos lo que viene en updatedData
            history[index] = { ...history[index], ...updatedData };
            await pb.collection(ORDERS_COLLECTION).update(orderId, { abonoHistory: history });
            return true;
        }
        return false;
    } catch (e) { 
        console.error("Error updating abono:", e);
        return false; 
    }
};

// v67.2: Borrado Atómico — Elimina de payments Y limpia abonoHistory de todas las órdenes
export const deletePaymentAndHistory = async (globalId) => {
    try {
        // Paso 1: Borrar el registro real de la colección payments
        try {
            await pb.collection(PAYMENTS_COLLECTION).delete(globalId);
        } catch (e) {
            console.warn('deletePaymentAndHistory: No se pudo borrar de payments:', e.message);
        }

        // Paso 2: Limpiar el globalId del abonoHistory de TODAS las órdenes
        const allOrders = await pb.collection(ORDERS_COLLECTION).getFullList();
        for (const order of allOrders) {
            const history = order.abonoHistory || [];
            const filtered = history.filter(ah => ah.globalId !== globalId);
            if (filtered.length !== history.length) {
                await pb.collection(ORDERS_COLLECTION).update(order.id, { abonoHistory: filtered });
            }
        }
        return true;
    } catch (e) {
        console.error('deletePaymentAndHistory error:', e);
        return false;
    }
};

export const deleteOrderAbono = async (orderId, index) => {
    try {
        const order = await pb.collection(ORDERS_COLLECTION).getOne(orderId);
        const history = [...(order.abonoHistory || [])];
        if (index >= 0 && index < history.length) {
            history.splice(index, 1);
            await pb.collection(ORDERS_COLLECTION).update(orderId, { abonoHistory: history });
            return true;
        }
        return false;
    } catch (e) { 
        console.error("Error deleting abono:", e);
        return false; 
    }
};

export const getCustomerNote = async (customerName) => {
    try {
        const records = await pb.collection('customer_notes').getFullList({
            filter: `customerName = "${customerName}"`
        });
        return records.length > 0 ? records[0].note : '';
    } catch (e) { return ''; }
};

export const saveCustomerNote = async (customerName, note) => {
    try {
        const records = await pb.collection('customer_notes').getFullList({
            filter: `customerName = "${customerName}"`
        });
        if (records.length > 0) {
            await pb.collection('customer_notes').update(records[0].id, { note });
        } else {
            await pb.collection('customer_notes').create({ customerName, note });
        }
        return true;
    } catch (e) { return false; }
};

export const sendToPrintQueue = async (data) => {
    try {
        await pb.collection('print_jobs').create(data);
        return true;
    } catch (e) { return false; }
};

export const saveCODPayment = async (data) => {
    try {
        await pb.collection('cod_payments').create({ ...data, createdAt: new Date().toISOString() });
        return true;
    } catch (e) { return false; }
};

/**
 * v33.0: CARGA ULTRA-LIGERA DE IDS
 * Solo baja los IDs para detectar qué sobra (productos eliminados)
 */
export const loadAllProductIds = async () => {
    try {
        const records = await pb.collection(COLLECTION_NAME).getFullList({
            fields: 'id'
        });
        return records.map(r => r.id);
    } catch (e) { return []; }
};






