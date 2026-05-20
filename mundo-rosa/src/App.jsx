import React, { useState, useEffect, Suspense } from 'react';

// Components
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartModal from './components/CartModal';
import PricingModal from './components/PricingModal';
import AdminPanel from './components/AdminPanel';
import OrderQueue from './components/OrderQueue';
import AuthModal from './components/AuthModal';

import { 
  onOrdersUpdate, 
  onAllPaymentsUpdate, 
  onSoldOutUpdate, 
  loadLocalProducts, 
  loadProductsDelta, 
  getCatalogMetadata, 
  onCatalogMetadataUpdate,
  onProductsUpdate,
  loadAllProductIds
} from './utils/db';
import { initPB } from './utils/pocketbase';

const APP_VERSION = "72.0"; // INDEXEDDB FIX v72.0

// Helper para IndexedDB (Caché sin límite de memoria)
const idbCache = {
  async get() {
    return new Promise(resolve => {
      const req = indexedDB.open('MundoRosaDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('cache');
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) return resolve(null);
        const getReq = db.transaction('cache', 'readonly').objectStore('cache').get('catalog');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  },
  async set(data) {
    return new Promise(resolve => {
      const req = indexedDB.open('MundoRosaDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('cache');
      req.onsuccess = e => {
        try {
          const tx = e.target.result.transaction('cache', 'readwrite');
          tx.objectStore('cache').put(JSON.stringify(data), 'catalog');
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch(err) {
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    });
  },
  async clear() {
    return new Promise(resolve => {
      const req = indexedDB.open('MundoRosaDB', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('cache');
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('cache')) return resolve();
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').clear();
        tx.oncomplete = () => resolve();
      };
      req.onerror = () => resolve();
    });
  }
};

function App() {
  const [products, setProducts] = useState([]);
  const [soldOutItems, setSoldOutItems] = useState([]);
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('MUNDOROSA_CART');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Pricing flow state
  const [priceType, setPriceType] = useState(() => {
    return localStorage.getItem('MUNDOROSA_PRICE_TYPE') || null;
  });
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [separationCount, setSeparationCount] = useState(() => {
    const saved = localStorage.getItem('MUNDOROSA_SEPARATION_COUNT');
    return saved ? parseInt(saved) : 0;
  });
  const [globalSearch, setGlobalSearch] = useState('');

  // Admin state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // REAL-TIME SHARED STATE
  const [orders, setOrders] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [isSynced, setIsSynced] = useState(false); // v35.1: Monitor de sincronización

  useEffect(() => {
    initPB();
  }, []);

  // v32.0: SISTEMA DE LIMPIEZA FORZADA PARA CLIENTES
  useEffect(() => {
    const savedVersion = localStorage.getItem('MUNDOROSA_APP_VERSION');
    if (savedVersion !== APP_VERSION) {
        console.log(`🧹 Limpieza de versión antigua (${savedVersion || '0'}) detectada. Forzando descarga completa...`);
        localStorage.removeItem('MUNDOROSA_CATALOG_CACHE');
        idbCache.clear();
        localStorage.removeItem('MUNDOROSA_CATALOG_TS');
        localStorage.setItem('MUNDOROSA_APP_VERSION', APP_VERSION);
    }
  }, []);

  const sortProducts = (list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  };

  const fetchCatalog = async (force = false) => {
    // v26.0: INSTANT LOAD — Mostrar caché local primero, sincronizar en segundo plano
    const localCache = (await idbCache.get()) || localStorage.getItem('MUNDOROSA_CATALOG_CACHE');
    
    if (!force && localCache) {
      try {
        const cached = typeof localCache === 'string' ? JSON.parse(localCache) : localCache;
        if (Array.isArray(cached) && cached.length > 0) {
          console.log(`⚡ Catálogo local cargado (${cached.length} productos). Sincronizando en segundo plano...`);
          setProducts(sortProducts(cached));
          setIsSyncing(false); // UI disponible de inmediato
        }
      } catch(e) { /* caché corrupto, ignorar */ }
    }

    // Sincronizar con el servidor en segundo plano
    setIsSyncing(true);
    try {
      const lastTS = localStorage.getItem('MUNDOROSA_CATALOG_TS') || '2024-01-01';
      let list = [];

      if (!force && localCache) {
          // MODO DELTA: Solo bajar lo nuevo
          console.log("☁️ Sincronización Delta activa...");
          const delta = await loadProductsDelta(lastTS);
          
          const cached = typeof localCache === 'string' ? JSON.parse(localCache) : localCache;
          let merged = [...cached];

          if (delta.length > 0) {
              delta.forEach(newItem => {
                  const idx = merged.findIndex(p => p.id === newItem.id);
                  if (idx !== -1) merged[idx] = newItem;
                  else merged.push(newItem);
              });
              console.log(`✨ Catálogo actualizado con ${delta.length} cambios.`);
          }

          // v33.0: LIMPIEZA DE OBSOLETOS (Lo que sobra)
          console.log("🔍 Verificando integridad del catálogo...");
          const serverIds = await loadAllProductIds();
          if (serverIds.length > 0) {
              const cleaned = merged.filter(p => serverIds.includes(p.id));
              if (cleaned.length !== merged.length) {
                  console.log(`🧹 Eliminados ${merged.length - cleaned.length} productos obsoletos.`);
                  merged = cleaned;
              }
          }
          list = merged;
      } else {
          // MODO FULL: Bajar todo (primera vez o forzado)
          console.log("📥 Descargando catálogo completo...");
          list = await loadLocalProducts();
      }
      
      if (list && list.length > 0) {
        // v51.0: DEDUPLICACIÓN FINAL ANTES DE MOSTRAR
        const uniqueMap = {};
        list.forEach(p => { uniqueMap[p.id] = p; });
        const cleanList = Object.values(uniqueMap);

        const sorted = sortProducts(cleanList);
        setProducts(sorted);        
        idbCache.set(sorted);
        
        // Actualizar el timestamp con el más reciente del catálogo
        const newest = list.reduce((max, p) => (p.updated > max ? p.updated : max), '2024-01-01');
        localStorage.setItem('MUNDOROSA_CATALOG_TS', newest);
      }
    } catch (e) {
      console.warn("Sincronización en segundo plano falló:", e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchCatalog();

    // v35.0: RECONEXIÓN AGRESIVA — El 'Hilo de Ariadna'
    let unsubscribeMetadata;
    let unsubscribeLive;

    const startSync = async () => {
        // v52.0: LIMPIEZA DE HILOS ANTES DE RECONECTAR
        if (unsubscribeMetadata) { try { unsubscribeMetadata(); } catch(e){} }
        if (unsubscribeLive) { try { unsubscribeLive(); } catch(e){} }

        try {
            await initPB();
            setIsSynced(true);

            unsubscribeMetadata = onCatalogMetadataUpdate((meta) => {
                const cloudTS = meta?.lastUpdate || '0';
                const localTS = localStorage.getItem('MUNDOROSA_CATALOG_TS') || '0';
                if (cloudTS !== '0' && cloudTS !== localTS) {
                    console.log("🔔 Cambio detectado — Sincronizando...");
                    fetchCatalog(false).then(() => {
                        localStorage.setItem('MUNDOROSA_CATALOG_TS', cloudTS);
                    });
                }
            });

            unsubscribeLive = onProductsUpdate(({ action, product }) => {
                setProducts(prev => {
                    const uniqueMap = {};
                    prev.forEach(p => { uniqueMap[p.id] = p; }); // Mapear actuales

                    if (action === 'create' || action === 'update') {
                        uniqueMap[product.id] = product; // Insertar o Sobrescribir
                    } else if (action === 'delete') {
                        delete uniqueMap[product.id];
                    }
                    
                    const sorted = sortProducts(Object.values(uniqueMap));
                    idbCache.set(sorted);
                    return sorted;
                });
            });
        } catch (err) {
            console.error("❌ Error de sincronización:", err);
            setIsSynced(false);
        }
    };

    startSync();

    const heartbeat = setInterval(() => {
        // v52.0: Solo reintenta si realmente se perdió la conexión
        if (!isSynced) {
            console.log("💓 Heartbeat: Reintentando conexión...");
            startSync();
        }
    }, 30000);

    return () => {
        if (unsubscribeMetadata) unsubscribeMetadata();
        if (unsubscribeLive) unsubscribeLive();
        clearInterval(heartbeat);
    };
  }, []);

  useEffect(() => {
    // v25.0: PRIVACY SHIELD — Solo cargar pedidos/pagos SI se abrió Admin o Almacén
    if (!isAdminOpen && !isWarehouseOpen) return;

    console.log("🔐 Autenticación detectada: Iniciando descarga de datos administrativos...");

    const unsubscribeOrders = onOrdersUpdate((liveOrders) => {
        const active = liveOrders.filter(o => {
            const isBuried = o.customerId && o.customerId.startsWith('ELM_');
            const isCancelled = o.status === 'cancelled';
            return !isBuried && !isCancelled;
        });
        setOrders(active);
    });

    const unsubscribePayments = onAllPaymentsUpdate((livePayments) => {
        setAllPayments(livePayments);
    });

    return () => {
        if (unsubscribeOrders) unsubscribeOrders();
        if (unsubscribePayments) unsubscribePayments();
    };
  }, [isAdminOpen, isWarehouseOpen]);

  useEffect(() => {
    const shouldReopen = localStorage.getItem('MUNDOROSA_REOPEN_WAREHOUSE');
    if (shouldReopen === 'true') {
      localStorage.removeItem('MUNDOROSA_REOPEN_WAREHOUSE');
      setIsWarehouseOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        checkAuthAndOpen('admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    localStorage.setItem('MUNDOROSA_CART', JSON.stringify(cart));
    localStorage.setItem('MUNDOROSA_PRICE_TYPE', priceType || '');
    localStorage.setItem('MUNDOROSA_SEPARATION_COUNT', separationCount.toString());
  }, [cart, priceType, separationCount]);

  const checkAuthAndOpen = (action) => {
    const isAuth = sessionStorage.getItem('MUNDOROSA_LOGGED_IN') === 'true';
    if (isAuth) {
      if (action === 'admin') setIsAdminOpen(true);
      if (action === 'warehouse') setIsWarehouseOpen(true);
    } else {
      setPendingAction(action);
      setIsAuthModalOpen(true);
    }
  };

  const handleAuthenticated = () => {
    setIsAuthModalOpen(false);
    if (pendingAction === 'admin') setIsAdminOpen(true);
    if (pendingAction === 'warehouse') setIsWarehouseOpen(true);
    setPendingAction(null);
  };

  const handleAddToCart = (product, quantity = 1) => {
    if (priceType === null) {
      setPendingProduct({ product, quantity });
      setIsPricingModalOpen(true);
    } else {
      commitToCart(product, quantity, priceType);
    }
  };

  const handlePriceTypeSelect = (type) => {
    setPriceType(type);
    setIsPricingModalOpen(false);
    if (pendingProduct) {
      commitToCart(pendingProduct.product, pendingProduct.quantity, type);
      setPendingProduct(null);
    }
  };

  const commitToCart = (product, quantity, type) => {
    setCart(prev => {
      const existingNew = prev.find(item => item.id === product.id && !item.isSeparated);
      const priceToUse = type === 'mayor' ? product.mayor : product.detal;
      if (existingNew) {
        return prev.map(item =>
          (item.id === product.id && !item.isSeparated)
            ? { ...item, quantity: item.quantity + quantity, price: priceToUse }
            : item
        );
      }
      return [...prev, { ...product, quantity, price: priceToUse, isSeparated: false }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const removeOneFromCart = (id) => {
    setCart(prev => {
      const hasNew = prev.some(item => item.id === id && !item.isSeparated);
      if (hasNew) {
        return prev
          .map(item => (item.id === id && !item.isSeparated) ? { ...item, quantity: item.quantity - 1 } : item)
          .filter(item => item.quantity > 0);
      } else {
        return prev
          .map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
          .filter(item => item.quantity > 0);
      }
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  
  const normalizeSearch = (text) => {
    if (!text) return "";
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const filteredProducts = products.filter(p => {
    if (!globalSearch) return true;
    const term = normalizeSearch(globalSearch);
    const productName = normalizeSearch(p.name);
    const productId = p.id?.toString().toLowerCase() || "";
    const productSku = p.sku?.toLowerCase() || "";
    return productName.includes(term) || productId.includes(term) || productSku.includes(term);
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleSeparateItems = () => {
    const newItems = cart.filter(item => !item.isSeparated);
    if (newItems.length === 0) return alert("❌ No hay ítems nuevos para separar.");
    const tipoLabel = priceType === 'mayor' ? 'Por Mayor' : 'Al Detal';
    const currentSeparation = separationCount + 1;
    const itemsText = newItems.map(item =>
      `*${item.quantity}x* ${item.name} (${formatCurrency(item.price)} c/u)\n   💰 _Subtotal: ${formatCurrency(item.price * item.quantity)}_`
    ).join('\n\n');
    const text = `✨ *SEPARADO #${currentSeparation} - MUNDO ROSA* ✨\n----------------------------------\n📦 _Solo productos nuevos añadidos:_\n\n` + itemsText + `\n\n----------------------------------\n💰 *TOTAL DE ESTE SEPARADO: ${formatCurrency(newItems.reduce((a, b) => a + (b.price * b.quantity), 0))}*\n💵 *TOTAL ACUMULADO DEL PEDIDO: ${formatCurrency(cartTotal)}*\nTipo de precio: _${tipoLabel}_\n\n⚠️ _La asesora verificará este pedido_`;
    navigator.clipboard.writeText(text).then(() => {
      setCart(prev => prev.map(item => ({ ...item, isSeparated: true })));
      setSeparationCount(currentSeparation);
      setIsCartOpen(false);
    });
  };

  const handleRevertSeparated = () => {
    setCart(prev => prev.map(item => ({ ...item, isSeparated: false })));
    alert('🔄 Ítems revertidos. Ya puede volver a COPIAR A WHATSAPP.');
  };

  const handleClearCart = () => {
    if (confirm("⚠️ ¿LIMPIAR TODO EL CARRITO?")) {
      setCart([]); setPriceType(null); setSeparationCount(0); setIsCartOpen(false);
    }
  };

  return (
    <div className="app">
      <Suspense fallback={<div className="loading-overlay">Iniciando Mundo Rosa... 💖</div>}>
        <Header
          cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
          onCartOpen={() => setIsCartOpen(true)}
          onAdminOpen={() => checkAuthAndOpen('admin')}
          onWarehouseOpen={() => checkAuthAndOpen('warehouse')}
          isConfigured={true}
          globalSearch={globalSearch}
          onSearchChange={setGlobalSearch}
          onSync={() => fetchCatalog(true)}
          isSyncing={isSyncing}
        />
        <Hero />
        <ProductGrid
          products={filteredProducts}
          cart={cart}
          onAddToCart={handleAddToCart}
          onRemoveOne={removeOneFromCart}
          formatCurrency={formatCurrency}
          isSyncing={isSyncing}
          priceType={priceType}
        />
        <PricingModal
          isOpen={isPricingModalOpen}
          onSelectMayor={() => handlePriceTypeSelect('mayor')}
          onSelectDetal={() => handlePriceTypeSelect('detal')}
        />
        <CartModal
          cart={cart}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onRemoveItem={removeFromCart}
          onSeparate={handleSeparateItems}
          onClearCart={handleClearCart}
          formatCurrency={formatCurrency}
          cartTotal={cartTotal}
          priceType={priceType}
          onRevertSeparated={handleRevertSeparated}
        />
        {/* INDICADOR DE SINCRONIZACIÓN v35.0 */}
      <div style={{
          position: 'fixed',
          bottom: '10px',
          right: '10px',
          zIndex: 9999,
          padding: '4px 8px',
          borderRadius: '20px',
          background: isSynced ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `1px solid ${isSynced ? '#10b981' : '#ef4444'}`,
          color: isSynced ? '#10b981' : '#ef4444',
          fontSize: '0.65rem',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          pointerEvents: 'none',
          backdropFilter: 'blur(5px)'
      }}>
          <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isSynced ? '#10b981' : '#ef4444',
              boxShadow: isSynced ? '0 0 10px #10b981' : '0 0 10px #ef4444'
          }} />
          {isSynced ? 'CONECTADO ONLINE' : 'DESCONECTADO'}
      </div>

        {isAdminOpen && (
          <Suspense fallback={<div className="loading-overlay">Abriendo Panel... ⚙️</div>}>
            <AdminPanel 
              isOpen={isAdminOpen} 
              onClose={() => setIsAdminOpen(false)} 
              currentCatalog={products}
              onUpdateCatalog={(newCatalog) => setProducts(Array.isArray(newCatalog) ? newCatalog : [])}
              onSyncingStatus={setIsSyncing}
              orders={orders}
              allPayments={allPayments}
              soldOutItems={soldOutItems}
            />
          </Suspense>
        )}
        <footer>
          <div className="container">
            <div className="footer-main-logo" onClick={() => checkAuthAndOpen('admin')}>MUNDO ROSA</div>
            <p>&copy; {new Date().getFullYear()} MUNDO ROSA - 100% Independiente 💖</p>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button className="warehouse-btn" onClick={() => checkAuthAndOpen('warehouse')}>📦 Almacén</button>
            </div>
          </div>
        </footer>
        {isWarehouseOpen && (
          <Suspense fallback={<div className="loading-overlay">Abriendo Almacén... 📦</div>}>
            <OrderQueue
              isOpen={isWarehouseOpen}
              onClose={() => setIsWarehouseOpen(false)}
              formatCurrency={formatCurrency}
              catalog={products}
              setCatalog={setProducts}
              orders={orders}
              soldOutItems={soldOutItems}
              allPayments={allPayments}
            />
          </Suspense>
        )}
        


        {/* Flecha Flotante Estática para ir ARRIBA (SOLO PC - IZQUIERDA) */}
        <button 
          className="desktop-arrows"
          onClick={() => {
            const queue = document.querySelector('.order-queue-container');
            if (queue) {
              queue.scrollTo(0, 0);
            }
            window.scrollTo(0, 0);
          }}
          style={{
            position: 'fixed',
            bottom: '86px', 
            left: '30px', 
            backgroundColor: 'rgba(255, 126, 179, 0.3)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FF758C', 
            zIndex: 9998,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(255, 126, 179, 0.2)',
            outline: 'none',
            padding: 0
          }}
          aria-label="Ir al inicio de la página"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="30" height="30" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))', marginBottom: '3px' }}
          >
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <polyline points="6 10 12 4 18 10"></polyline>
          </svg>
        </button>

        {/* Botón Flotante Estático para ir al fondo (SOLO PC - IZQUIERDA) */}
        <button 
          className="desktop-arrows"
          onClick={() => {
            const queue = document.querySelector('.order-queue-container');
            if (queue) {
              queue.scrollTo(0, 999999);
            }
            window.scrollTo(0, 999999);
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '30px', 
            backgroundColor: 'rgba(255, 126, 179, 0.3)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FF758C', 
            zIndex: 9998,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(255, 126, 179, 0.2)',
            outline: 'none',
            padding: 0
          }}
          aria-label="Ir al final de la página"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="30" height="30" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))', marginTop: '3px' }}
          >
            <line x1="12" y1="4" x2="12" y2="20"></line>
            <polyline points="18 14 12 20 6 14"></polyline>
          </svg>
        </button>

        {/* Botón Flotante Estático para ir ARRIBA (SOLO CELULARES - IZQUIERDA) */}
        <button 
          className="mobile-arrows"
          onClick={() => {
            const queue = document.querySelector('.order-queue-container');
            if (queue) {
              queue.scrollTo(0, 0);
            }
            window.scrollTo(0, 0);
          }}
          style={{
            position: 'fixed',
            bottom: '86px',
            left: '20px', 
            backgroundColor: 'rgba(255, 126, 179, 0.3)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FF758C', 
            zIndex: 9998,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(255, 126, 179, 0.2)',
            outline: 'none',
            padding: 0
          }}
          aria-label="Ir al inicio de la página"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="30" height="30" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))', marginBottom: '3px' }}
          >
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <polyline points="6 10 12 4 18 10"></polyline>
          </svg>
        </button>

        {/* Botón Flotante Estático para ir al fondo (SOLO CELULARES - IZQUIERDA) */}
        <button 
          className="mobile-arrows"
          onClick={() => {
            const queue = document.querySelector('.order-queue-container');
            if (queue) {
              queue.scrollTo(0, 999999);
            }
            window.scrollTo(0, 999999);
          }}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px', 
            backgroundColor: 'rgba(255, 126, 179, 0.3)',
            border: 'none',
            borderRadius: '50%',
            width: '56px',
            height: '56px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#FF758C', 
            zIndex: 9998,
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(255, 126, 179, 0.2)',
            outline: 'none',
            padding: 0
          }}
          aria-label="Ir al final de la página"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="30" height="30" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))', marginTop: '3px' }}
          >
            <line x1="12" y1="4" x2="12" y2="20"></line>
            <polyline points="18 14 12 20 6 14"></polyline>
          </svg>
        </button>

        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthenticate={handleAuthenticated}
        />
      </Suspense>
    </div>
  );
}

export default App;
