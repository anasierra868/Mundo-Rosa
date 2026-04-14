import { collection, doc, setDoc, updateDoc, deleteDoc, getDocs, writeBatch, onSnapshot, query, orderBy, serverTimestamp, addDoc, where } from "firebase/firestore";
import { db } from "../firebase";

const COLLECTION_NAME = "products";
const ORDERS_COLLECTION = "orders";
const PAYMENTS_COLLECTION = "payments";

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
            // Using WebP format for 60% better efficiency on mobile
            resolve(canvas.toDataURL('image/webp', quality));
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
            currentLocal.forEach(lo => {
                const alreadyInFirestore = firestoreOrders.some(fo => fo.code === lo.code);
                if (!alreadyInFirestore) allOrders.push(lo);
            });
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
        const paymentsCol = collection(db, PAYMENTS_COLLECTION);
        await addDoc(paymentsCol, {
            ...paymentData,
            createdAt: serverTimestamp()
        });
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
 * Purge all data (orders and payments) for a specific customer
 */
export const purgeCustomerData = async (customerName) => {
    if (!db) return;
    try {
        const batch = writeBatch(db);
        const nameToMatch = (customerName || "").toLowerCase().trim();

        // 1. Find and delete all orders
        const ordersQ = query(collection(db, ORDERS_COLLECTION));
        const ordersSnapshot = await getDocs(ordersQ);
        ordersSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const orderCustomerName = (data.code || "").split(' (SEPARADO #')[0].toLowerCase().trim();
            if (orderCustomerName === nameToMatch) {
                batch.delete(docSnap.ref);
            }
        });

        // 2. Find and delete all payments
        const paymentsQ = query(collection(db, PAYMENTS_COLLECTION));
        const paymentsSnapshot = await getDocs(paymentsQ);
        paymentsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const pCustomerName = (data.customerName || "").toLowerCase().trim();
            if (pCustomerName === nameToMatch) {
                batch.delete(docSnap.ref);
            }
        });

        await batch.commit();
        
        // Cleanup local storage backup as well
        const localOrders = JSON.parse(localStorage.getItem('MUNDOROSA_OFFLINE_ORDERS') || '[]');
        const filteredLocal = localOrders.filter(lo => {
            const loName = (lo.code || "").split(' (SEPARADO #')[0].toLowerCase().trim();
            return loName !== nameToMatch;
        });
        localStorage.setItem('MUNDOROSA_OFFLINE_ORDERS', JSON.stringify(filteredLocal));

        return true;
    } catch (e) {
        console.error("Error purging customer data", e);
        return false;
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
