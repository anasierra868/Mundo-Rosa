import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, getDoc, writeBatch, onSnapshot, query, orderBy, serverTimestamp, addDoc, where } from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "products";
const ORDERS_COLLECTION = "orders";
const PAYMENTS_COLLECTION = "payments";
const TIMERS_COLLECTION = "customer_timers";

// ADVISOR AUTH CENTRALIZED v2.10
export const ADVISOR_CODES = { 
  '1349': 'Dharma Perea', 
  '3768': 'Marcela Venegas', 
  '1947': 'Luisa Patiño',
  '4399': 'Esteban',
  '2815': 'Ana',
  '6643': 'Elkin Patiño'
};

// ===== CUSTOMER TIMERS v3.0 — DEVICE-ISOLATED =====

/**
 * Generates or retrieves a unique ID for this browser/PC.
 * Stored in localStorage so it persists across sessions on the same device.
 */
const getDeviceId = () => {
    let id = localStorage.getItem('MUNDOROSA_DEVICE_ID');
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem('MUNDOROSA_DEVICE_ID', id);
    }
    return id;
};

export const startCustomerTimer = async (customerName, durationMinutes = 15) => {
    if (!db) return null;
    try {
        const deviceId = getDeviceId();
        const timerCol = collection(db, TIMERS_COLLECTION);
        const ref = await addDoc(timerCol, {
            customerName,
            deviceId,                                   // 🔒 bind to this PC
            startedAt: serverTimestamp(),
            durationMs: durationMinutes * 60 * 1000,
            createdAt: new Date().toISOString()
        });
        return ref.id;
    } catch (e) {
        console.error("Error starting timer", e);
        return null;
    }
};

export const deleteCustomerTimer = async (timerId) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, TIMERS_COLLECTION, timerId));
    } catch (e) {
        console.error("Error deleting timer", e);
    }
};

export const onTimersUpdate = (callback) => {
    if (!db) return () => {};
    const deviceId = getDeviceId();
    return onSnapshot(collection(db, TIMERS_COLLECTION), (snap) => {
        // 🔒 Only return timers created by THIS device
        const timers = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(t => t.deviceId === deviceId);
        callback(timers);
    });
};

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
 * Load all products from Firestore
 */
export const loadLocalProducts = async () => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Error loading products from Firestore", e);
        return [];
    }
};

/**
 * Save multiple products in a single batch (max 500 per batch)
 */
export const saveProductsBatch = async (products) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        products.forEach(p => {
            const ref = doc(db, COLLECTION_NAME, p.id);
            batch.set(ref, p);
        });
        await batch.commit();
    } catch (e) {
        console.error("Error batch saving products to Firestore", e);
    }
};

/**
 * Save or Update a single product in Firestore
 */
export const saveProduct = async (product) => {
    if (!db) return;
    try {
        await setDoc(doc(db, COLLECTION_NAME, product.id), product);
    } catch (e) {
        console.error("Error saving product to Firestore", e);
    }
};

/**
 * ATOMIC GLOBAL DELETE v4.0
 * Deletes from catalog and current order simultaneously to avoid "residue"
 */
export const deleteProductGlobalAtomic = async (productId, orderId, updatedItems) => {
    if (!db) return false;
    try {
        const batch = writeBatch(db);
        
        // 1. Delete from catalog
        batch.delete(doc(db, COLLECTION_NAME, productId));
        
        // 2. Update the order with filtered items
        if (orderId && updatedItems) {
            const orderRef = doc(db, ORDERS_COLLECTION, orderId);
            const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * (it.unitPrice || 0)), 0);
            batch.update(orderRef, { 
                items: updatedItems,
                total: newTotal
            });
        }
        
        await batch.commit();

        // 3. Clean local backup to prevent "ghost" resurrections
        try {
            const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
            const filtered = localOrders.map(lo => {
                if (lo.id === orderId) {
                    return { ...lo, items: updatedItems };
                }
                return lo;
            });
            localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(filtered));
        } catch (err) {
            console.warn("Local cleanup failed", err);
        }

        return true;
    } catch (e) {
        console.error("Critical error in atomic delete:", e);
        return false;
    }
};

/**
 * Delete a product by ID in Firestore
 */
export const deleteProduct = async (id) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (e) {
        console.error("Error deleting product from Firestore", e);
    }
};

/**
 * Clear the entire database using a batch
 */
export const clearDB = async () => {
    if (!db) return;
    try {
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
            batch.delete(doc(db, COLLECTION_NAME, d.id));
        });
        await batch.commit();
    } catch (e) {
        console.error("Error clearing DB in Firestore", e);
    }
};


/**
 * ORDERS MANAGEMENT
 * Functions to create, delete, and listen for live orders for the warehouse
 */

export const createOrder = async (orderData) => {
    if (!db) {
        console.warn("DB not initialized, saving to LocalStorage only.");
    }
    
    const newOrder = {
        ...orderData,
        id: "local-" + Date.now(),
        createdAt: serverTimestamp ? serverTimestamp() : { seconds: Math.floor(Date.now()/1000) }
    };

    // ALWAYS SAVE TO LOCALSTORAGE AS BACKUP (Light version without heavy images)
    try {
        const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
        const lightOrder = {
            ...newOrder,
            items: newOrder.items.map(it => ({ id: it.id, name: it.name, qty: it.qty })) // No images for local backup
        };
        const updatedLocal = [...localOrders, lightOrder].slice(-50); // Keep only last 50
        localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(updatedLocal));
    } catch (err) {
        console.warn("LocalStorage full, proceeding without local backup.", err);
    }

    if (!db) return true; // Pretend success since it's local

    try {
        const ordersCol = collection(db, ORDERS_COLLECTION);
        await addDoc(ordersCol, {
            ...orderData,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error creating order", e);
        alert("⚠️ Error de Firebase al crear orden: " + e.message + "\n\n(La orden se guardó localmente como respaldo)");
        return false;
    }
};

export const updateOrder = async (id, data) => {
    if (!db) return;
    try {
        await updateDoc(doc(db, ORDERS_COLLECTION, id), data);
    } catch (e) {
        console.error("Error updating order", e);
    }
};

export const deleteOrder = async (id, code) => {
    // 1. Remove from local backup
    const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
    const filtered = localOrders.filter(lo => lo.code !== code && lo.id !== id);
    localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(filtered));

    if (!db) return;
    try {
        await deleteDoc(doc(db, ORDERS_COLLECTION, id));
    } catch (e) {
        console.error("Error deleting order", e);
    }
};

/**
 * Real-time listener for orders; merges Firestore & Local Storage
 */
export const onOrdersUpdate = (callback) => {
    if (!db) {
        const localOnly = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
        callback(localOnly);
        return () => {};
    }

    const q = query(collection(db, ORDERS_COLLECTION));
    return onSnapshot(q, 
        (snapshot) => {
            const firestoreOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentLocal = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
            const allOrders = [...firestoreOrders];
            
            let updatedLocal = [...currentLocal];
            let localChanged = false;

            currentLocal.forEach(lo => {
                const alreadyInFirestore = firestoreOrders.some(fo => fo.code === lo.code);
                if (!alreadyInFirestore) {
                    // Logic to detect and kill Zombies v3.0 (Aggressive)
                    let isZombie = false;
                    let orderTimestamp = null;
                    
                    // 1. Try to extract timestamp from ID (local-XXXX)
                    const idParts = String(lo.id || "").split('local-');
                    if (idParts.length > 1) {
                        orderTimestamp = parseInt(idParts[1]);
                    } 
                    
                    // 2. Try to extract from createdAt if available
                    if (!orderTimestamp && lo.createdAt) {
                        orderTimestamp = (lo.createdAt.seconds * 1000) || new Date(lo.createdAt).getTime();
                    }

                    // 3. DECISION: If it has no date, or is older than 2 hours, it's a zombie
                    // (We are online, so if it's not in Firestore by now, it shouldn't exist)
                    if (!orderTimestamp || isNaN(orderTimestamp)) {
                        isZombie = true; // No date = Invalid/Ghost
                    } else {
                        const ageHours = (Date.now() - orderTimestamp) / (1000 * 60 * 60);
                        if (ageHours > 2) isZombie = true; 
                    }

                    if (isZombie) {
                        updatedLocal = updatedLocal.filter(ul => ul.id !== lo.id);
                        localChanged = true;
                    } else {
                        allOrders.push(lo);
                    }
                }
            });

            if (localChanged) {
                console.log(`🧹 Zombie Hunter: Limpiados ${currentLocal.length - updatedLocal.length} pedidos fantasmas de la memoria local.`);
                localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(updatedLocal));
            }

            allOrders.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            callback(allOrders);
        },
        (error) => {
            console.error("❌ Error de Sincronización:", error);
            alert("⚠️ Problema de conexión con Almacén: " + error.message);
        }
    );
};

/**
 * Get count of active orders for a customer to handle automatic (SEPARADO #2) numbering
 */
export const getOrdersCountForCustomer = async (customerName) => {
    if (!db) return 0;
    try {
        const q = query(collection(db, ORDERS_COLLECTION));
        const snapshot = await getDocs(q);
        const nameToMatch = customerName.toLowerCase().trim();
        
        // Count orders that start with this name (Case insensitive)
        const count = snapshot.docs.filter(doc => {
            const code = (doc.data().code || "").toLowerCase();
            return code === nameToMatch || code.startsWith(nameToMatch + " (separado #");
        }).length;
        
        return count;
    } catch (e) {
        console.error("Error counting customer orders", e);
        return 0;
    }
};

/**
 * Get unique base names of customers currently in the warehouse
 */
export const getUniquePendingNames = async () => {
    if (!db) return [];
    try {
        const q = query(collection(db, ORDERS_COLLECTION));
        const snapshot = await getDocs(q);
        const names = snapshot.docs.map(doc => {
            const fullCode = doc.data().code || "";
            return fullCode.split(' (SEPARADO #')[0].trim();
        });
        return Array.from(new Set(names)).filter(n => n.length > 0);
    } catch (e) {
        console.error("Error fetching unique names", e);
        return [];
    }
};

/**
 * PAYMENTS MANAGEMENT
 * Independent collection to track customer abonos/payments
 */

export const addPayment = async (paymentData) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        
        // 1. Create Global Record (for Admin)
        const paymentsCol = collection(db, PAYMENTS_COLLECTION);
        const newPaymentRef = doc(paymentsCol);
        batch.set(newPaymentRef, {
            ...paymentData,
            createdAt: serverTimestamp()
        });

        // 2. Local Record (for Customer Warehouse history)
        // Find the latest order for this customer to attach the payment
        const nameToMatch = (paymentData.customerName || "").toLowerCase().trim();
        const ordersQ = query(collection(db, ORDERS_COLLECTION));
        const ordersSnapshot = await getDocs(ordersQ);
        
        // Filter and sort to find the most recent order for this customer
        const customerOrders = ordersSnapshot.docs
            .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
            .filter(o => {
                const codeName = (o.code || "").split(' (SEPARADO #')[0].toLowerCase().trim();
                return codeName === nameToMatch;
            })
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (customerOrders.length > 0) {
            const targetOrder = customerOrders[0];
            const currentHistory = targetOrder.abonoHistory || [];
            const newEntry = {
                amount: paymentData.amount,
                date: paymentData.date,
                advisorName: paymentData.advisorName || 'S/A',
                type: 'Abono Registrado (Independiente)',
                timestamp: new Date().toISOString(),
                globalId: newPaymentRef.id // LINK established v2.11
            };
            
            batch.update(targetOrder.ref, {
                abonoHistory: [...currentHistory, newEntry]
            });
            console.log(`✅ Abono de ${paymentData.amount} vinculado localmente al pedido ${targetOrder.code}`);
        } else {
            console.warn("⚠️ No se encontró un pedido activo para vincular el abono localmente.");
        }

        await batch.commit();
        return true;
    } catch (e) {
        console.error("Error adding payment", e);
        return false;
    }
};

export const onAllPaymentsUpdate = (callback) => {
    if (!db) return () => {};
    const q = query(collection(db, PAYMENTS_COLLECTION), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
        const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(allPayments);
    });
};

export const onCustomerPaymentsUpdate = (customerName, callback) => {
    if (!db) return () => {};
    
    const q = query(
        collection(db, PAYMENTS_COLLECTION),
        orderBy("createdAt", "asc")
    );
    
    return onSnapshot(q, (snapshot) => {
        const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter by customer name (case insensitive)
        const nameToMatch = (customerName || "").toLowerCase().trim();
        const filtered = allPayments.filter(p => 
            (p.customerName || "").toLowerCase().trim() === nameToMatch
        );
        callback(filtered);
    });
};

export const deletePayment = async (id) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, PAYMENTS_COLLECTION, id));
        return true;
    } catch (e) {
        console.error("Error deleting payment", e);
        return false;
    }
};

/**
 * Purge warehouse data for a specific customer on dispatch (PEDIDO DESPACHADO)
 * v5.7: WAREHOUSE PURGE — Orders + Notes + Timers
 * 🔒 MURO DE SEGURIDAD: Los abonos en PAYMENTS_COLLECTION son INTOCABLES.
 *    Solo pueden eliminarse manualmente desde CONSULTAR ABONOS por el asesor.
 */
export const purgeCustomerData = async (customerName) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        const nameToMatch = (customerName || "").toLowerCase().trim();
        const nameKey = customerName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

        console.log(`🧹 PURGA DE ALMACÉN iniciando para: ${nameToMatch}`);

        // 1. Delete ALL Orders for this customer
        const allOrdersSnapshot = await getDocs(collection(db, ORDERS_COLLECTION));
        let deletedOrders = 0;
        allOrdersSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const fullCode = String(data.code || "").toLowerCase().trim();
            const baseName = fullCode.split(' (')[0].trim();
            if (baseName === nameToMatch) {
                batch.delete(docSnap.ref);
                deletedOrders++;
            }
        });

        // 🔒 ABONOS (PAYMENTS_COLLECTION) — INTOCABLES EN DESPACHO.
        // Solo el asesor puede eliminarlos manualmente desde CONSULTAR ABONOS.
        let deletedPayments = 0; // Para el log

        // 2. Delete Customer NOTE (stored in products collection with CUST_NOTE_ prefix)
        const noteId = 'CUST_NOTE_' + nameKey;
        const noteRef = doc(db, COLLECTION_NAME, noteId);
        const noteSnap = await getDoc(noteRef);
        if (noteSnap.exists()) {
            batch.delete(noteRef);
            console.log(`🗒️ Nota de ${customerName} eliminada.`);
        }

        // 3. Delete ALL Timers for this customer
        const allTimersSnapshot = await getDocs(collection(db, TIMERS_COLLECTION));
        let deletedTimers = 0;
        allTimersSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const timerCustomer = (data.customerName || "").toLowerCase().trim();
            if (timerCustomer === nameToMatch) {
                batch.delete(docSnap.ref);
                deletedTimers++;
            }
        });

        await batch.commit();
        console.log(`✅ PURGA ATÓMICA EXITOSA: ${deletedOrders} pedidos, ${deletedPayments} abonos y ${deletedTimers} timers eliminados.`);
        
        // 4. Cleanup local storage backup (MUNDOROSA_OFFLINE_ORDERS)
        const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
        const filteredLocal = localOrders.filter(lo => {
            const loBase = String(lo.code || "").toLowerCase().split(' (')[0].trim();
            return loBase !== nameToMatch;
        });
        localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(filteredLocal));

        return true;
    } catch (e) {
        console.error("Error purging customer data", e);
        return false;
    }
};

/**
 * Update a global payment in PAYMENTS_COLLECTION v2.10
 */
export const updatePaymentGlobal = async (paymentId, newData) => {
    if (!db) return false;
    try {
        const paymentRef = doc(db, PAYMENTS_COLLECTION, paymentId);
        await updateDoc(paymentRef, {
            ...newData,
            lastEditedAt: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error("Error updating global payment", e);
        return false;
    }
};

/**
 * Update a specific payment entry in an order's abonoHistory v2.10
 * v2.12: Added retro-sync fallback for unlinked old records
 */
export const updateOrderAbono = async (orderId, abonoIndex, newData, customerName, oldAmount) => {
    if (!db) return false;
    try {
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) {
            console.error("Order not found:", orderId);
            return false;
        }

        const data = orderSnap.data();
        const history = [...(data.abonoHistory || [])];
        const entry = history[abonoIndex];
        
        if (!entry) {
            console.error("Abono entry not found at index:", abonoIndex);
            return false;
        }

        // 1. Update LOCAL object first
        const updatedEntry = {
            ...entry,
            ...newData,
            editedAt: new Date().toISOString()
        };

        // 2. Sync Logic (Only for non-Saldo a Favor)
        if (entry.type !== 'Saldo a Favor') {
            let gid = entry.globalId;
            
            if (gid) {
                try {
                    await updatePaymentGlobal(gid, {
                        amount: newData.amount,
                        date: newData.date || entry.date,
                        advisorName: newData.advisorName
                    });
                } catch (err) {
                    console.warn("Global sync failed, but continuing with local update", err);
                }
            } else if (customerName && oldAmount) {
                // FALLBACK: Intelligent search for unlinked records
                try {
                    const paymentsQ = query(collection(db, PAYMENTS_COLLECTION), where("customerName", "==", customerName));
                    const pSnapshot = await getDocs(paymentsQ);
                    
                    const candidates = pSnapshot.docs
                        .map(d => ({ id: d.id, ...d.data() }))
                        .filter(p => parseInt(p.amount) === parseInt(oldAmount));

                    if (candidates.length === 1) {
                        gid = candidates[0].id;
                        await updatePaymentGlobal(gid, {
                            amount: newData.amount,
                            date: newData.date || entry.date,
                            advisorName: newData.advisorName
                        });
                        updatedEntry.globalId = gid; // Link it now!
                    }
                } catch (err) {
                    console.warn("Fallback sync failed", err);
                }
            }
        }

        history[abonoIndex] = updatedEntry;
        await updateDoc(orderRef, { abonoHistory: history });
        return true;
    } catch (e) {
        console.error("Error updating local abono", e);
        throw e; // Throw so UI can catch and alert
    }
};

/**
 * Delete a specific payment entry from an order's abonoHistory v2.10
 */
export const deleteOrderAbono = async (orderId, abonoIndex) => {
    if (!db) return false;
    try {
        const orderRef = doc(db, ORDERS_COLLECTION, orderId);
        const orderSnap = await getDoc(orderRef);
        
        if (orderSnap.exists()) {
            const data = orderSnap.data();
            const history = [...(data.abonoHistory || [])];
            const entry = history[abonoIndex];
            
            if (entry) {
                // If it has a global link, delete the global record too? 
                // Decision: For now, only local deletion to avoid accidental massive data loss, 
                // unless it's a "Saldo a Favor" which is ONLY local.
                if (entry.globalId && entry.type !== 'Saldo a Favor') {
                    // Optional: deletePayment(entry.globalId);
                }
                
                history.splice(abonoIndex, 1);
                await updateDoc(orderRef, { abonoHistory: history });
                return true;
            }
        }
        return false;
    } catch (e) {
        console.error("Error deleting order abono", e);
        return false;
    }
};


/**
 * Rename a customer entirely across all Orders and Payments (e.g. Number to Name)
 */
export const renameCustomer = async (oldName, newName) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        const nameToMatch = (oldName || "").toLowerCase().trim();
        const finalNewName = (newName || "").toUpperCase().trim();
        
        console.log(`🔄 Renombrando '${oldName}' a '${finalNewName}'...`);

        // Force a more broad search to avoid type-mismatch issues (Number vs String)
        const allOrdersSnapshot = await getDocs(collection(db, ORDERS_COLLECTION));
        let updatedOrdersCount = 0;
        
        allOrdersSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const fullCode = String(data.code || ""); // Ensure it's a string for splitting
            const parts = fullCode.split(' (SEPARADO #');
            const orderCustomerName = parts[0].toLowerCase().trim();
            
            if (orderCustomerName === nameToMatch) {
                const newCode = parts.length > 1 ? `${finalNewName} (SEPARADO #${parts[1]}` : finalNewName;
                batch.update(docSnap.ref, { code: newCode });
                updatedOrdersCount++;
            }
        });

        console.log(`✅ ${updatedOrdersCount} pedidos preparados para actualización.`);

        // Optimized Update Payments (Payments are usually strings, but let's be safe)
        const allPaymentsSnapshot = await getDocs(collection(db, PAYMENTS_COLLECTION));
        let updatedPaymentsCount = 0;
        allPaymentsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const pCustomerName = String(data.customerName || "").toLowerCase().trim();
            if (pCustomerName === nameToMatch) {
                batch.update(docSnap.ref, { customerName: finalNewName });
                updatedPaymentsCount++;
            }
        });

        await batch.commit();
        console.log(`🚀 Batch commit exitoso. ${updatedOrdersCount} pedidos y ${updatedPaymentsCount} abonos actualizados.`);

        // Update LocalStorage Backup
        const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
        const updatedLocal = localOrders.map(lo => {
            const parts = String(lo.code || "").split(' (SEPARADO #');
            if (parts[0].toLowerCase().trim() === nameToMatch) {
                return { ...lo, code: parts.length > 1 ? `${finalNewName} (SEPARADO #${parts[1]}` : finalNewName };
            }
            return lo;
        });
        localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(updatedLocal));

        return true;
    } catch (e) {
        console.error("❌ Error renaming customer", e);
        return false;
    }
};

// ===== CUSTOMER NOTES =====
export const getCustomerNote = async (customerName) => {
    if (!db || !customerName) return null;
    try {
        const id = 'CUST_NOTE_' + customerName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const docRef = doc(db, COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data().note : null;
    } catch (e) {
        console.error("Error getting customer note:", e);
        return null;
    }
};

export const saveCustomerNote = async (customerName, noteText) => {
    if (!db || !customerName) return false;
    try {
        const id = 'CUST_NOTE_' + customerName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const docRef = doc(db, COLLECTION_NAME, id);
        if (!noteText || noteText.trim() === '') {
            await deleteDoc(docRef);
        } else {
            await setDoc(docRef, { 
                name: '_NOTA_CLIENTE', 
                price: 0,
                stock: 0,
                note: noteText.trim(), 
                isCustomerNote: true,
                updatedAt: new Date() 
            });
        }
        return true;
    } catch (e) {
        console.error("Error saving customer note:", e);
        return false;
    }
};


/**
 * CLEANUP GLOBAL FORMAT v3.7
 * Replaces old " Cód. Ref." with " Ref." in ALL products
 */
export const cleanupGlobalFormat = async (onProgress) => {
    if (!db) return 0;
    try {
        if (onProgress) onProgress('⏳ Escaneando catálogo para limpieza de formato...');
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const batch = writeBatch(db);
        let updatedCount = 0;

        allProducts.forEach(p => {
            const name = p.name || "";
            if (name.includes(' Cód. Ref.')) {
                const newName = name.replace(' Cód. Ref.', ' Ref.');
                const ref = doc(db, COLLECTION_NAME, p.id);
                batch.update(ref, { name: newName });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            if (onProgress) onProgress(`🚀 ¡Limpieza terminada! ${updatedCount} productos corregidos.`);
        } else {
            if (onProgress) onProgress('✅ El catálogo ya está limpio.');
        }
        return updatedCount;
    } catch (e) {
        console.error("Error in cleanupGlobalFormat", e);
        if (onProgress) onProgress('❌ Error al limpiar formato.');
        return 0;
    }
};

/**
 * AUTO-DIFERENCIADOR QUIRÚRGICO v3.5
 * Only appends SKU to products with identical Names and Prices
 */
export const differentiateDuplicatesOnly = async (onProgress) => {
    if (!db) return 0;
    try {
        if (onProgress) onProgress('⏳ Analizando catálogo en busca de duplicados...');
        const snapshot = await getDocs(collection(db, COLLECTION_NAME));
        const allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // v3.6: Normalización profunda — elimina emojis, acentos y espacios extras
        // para detectar duplicados como "♡Coach ♡" y "♡Coach♡" como iguales.
        const normalizeName = (name) => (name || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")   // quitar acentos
            .replace(/[^a-z0-9 ]/g, " ")        // emojis y especiales → espacio
            .replace(/\s+/g, " ")               // colapsar espacios múltiples
            .trim();

        // 1. Group by NormalizedName + Price
        const groups = {};
        allProducts.forEach(p => {
            const key = `${normalizeName(p.name)}_${p.detal || 0}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });

        // 2. Filter groups that have more than 1 item
        const duplicates = Object.values(groups).filter(g => g.length > 1);
        
        if (duplicates.length === 0) {
            if (onProgress) onProgress('✅ No se encontraron productos duplicados.');
            return 0;
        }

        const batch = writeBatch(db);
        let updatedCount = 0;
        const usedSKUs = new Set(allProducts.map(p => p.sku).filter(Boolean));

        const generateUnique3Char = () => {
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            let code = '';
            for (let i = 0; i < 3; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        };

        if (onProgress) onProgress(`🏷️ Diferenciando ${duplicates.length} grupos de productos...`);

        duplicates.forEach(group => {
            group.forEach(p => {
                // Generate SKU that is not in the global set
                let newSKU;
                do {
                    newSKU = generateUnique3Char();
                } while (usedSKUs.has(newSKU));
                usedSKUs.add(newSKU);

                // Clean existing "Cód." or "Ref." if any to avoid stacking
                let cleanName = (p.name || "").split(' Cód. Ref.')[0].split(' Ref.')[0].trim();
                const newFullName = `${cleanName} Ref. ${newSKU}`;

                const ref = doc(db, COLLECTION_NAME, p.id);
                batch.update(ref, {
                    name: newFullName,
                    sku: newSKU
                });
                updatedCount++;
            });
        });

        await batch.commit();
        if (onProgress) onProgress(`🚀 ¡Éxito! ${updatedCount} productos diferenciados.`);
        return updatedCount;
    } catch (e) {
        console.error("Error in differentiateDuplicatesOnly", e);
        if (onProgress) onProgress('❌ Error crítico al diferenciar.');
        return 0;
    }
};

/**
 * Convert Image File to Base64
 */
export const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

/**
 * SISTEMA DE LIMPIEZA AUTOMÁTICA v4.0 (7 DÍAS)
 */
export const cleanupAbandonedOrders = async (orders, allPayments) => {
    if (!db || !orders || orders.length === 0) return 0;
    try {
        const now = new Date();
        const LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
        const customersToPurge = new Set();
        
        const customerGroups = {};
        orders.forEach(o => {
            const rawCode = o.code || "";
            let name = "";
            if (rawCode.includes(' (SEPARADO #')) {
                name = rawCode.split(' (SEPARADO #')[0].trim().toUpperCase();
            } else if (rawCode.includes(' (')) {
                name = rawCode.split(' (')[0].trim().toUpperCase();
            } else {
                name = rawCode.trim().toUpperCase();
            }

            if (name) {
                if (!customerGroups[name]) customerGroups[name] = [];
                customerGroups[name].push(o);
            }
        });

        for (const [name, cOrders] of Object.entries(customerGroups)) {
            // DIODO v5.0: El almacén es autónomo. 
            // Ignoramos pagos externos (Consultar Abonos).
            const hasLocalAbonos = cOrders.some(o => (o.abono > 0) || (o.abonoHistory && o.abonoHistory.length > 0));

            if (!hasLocalAbonos) {
                let oldest = now;
                let newest = new Date(0);
                cOrders.forEach(o => {
                    const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date((o.createdAt?.seconds || 0) * 1000);
                    if (d < oldest) oldest = d;
                    if (d > newest) newest = d;
                });

                const isOldEnough = (now - oldest) >= LIMIT_MS;
                const isSafeMargin = (now - newest) >= (24 * 60 * 60 * 1000);

                if (isOldEnough && isSafeMargin) {
                    customersToPurge.add(name);
                }
            }
        }
        for (const name of customersToPurge) {
            await purgeCustomerData(name);
        }

        return customersToPurge.size;
    } catch (e) { 
        console.error("Error limpieza:", e);
        return 0; 
    }
};
