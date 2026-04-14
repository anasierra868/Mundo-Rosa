import React, { useState, useEffect } from 'react';
import { db, isConfigured } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

// Components
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartModal from './components/CartModal';
import PricingModal from './components/PricingModal';
import AdminPanel from './components/AdminPanel';
import OrderQueue from './components/OrderQueue';
import AuthModal from './components/AuthModal';
import { loadLocalProducts, onOrdersUpdate, onAllPaymentsUpdate } from './utils/db';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('MUNDOROSA_CART');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState(localStorage.getItem('FIREBASE_CONFIG') || '');

  // Pricing flow state
  const [priceType, setPriceType] = useState(() => {
    return localStorage.getItem('MUNDOROSA_PRICE_TYPE') || null;
  });
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null); // product waiting for price decision
  const [separationCount, setSeparationCount] = useState(() => {
    const saved = localStorage.getItem('MUNDOROSA_SEPARATION_COUNT');
    return saved ? parseInt(saved) : 0;
  });

  // Admin state
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Auth state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'admin' or 'warehouse'

  // REAL-TIME SHARED STATE v12.0
  const [orders, setOrders] = useState([]);
  const [allPayments, setAllPayments] = useState([]);

  const sortProducts = (list) => {
    return [...list].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  };

  useEffect(() => {
    if (isConfigured && db) {
      console.log("☁️ Cargando catálogo desde Firestore...");
      const q = query(collection(db, "products"));
      const unsubscribeCatalog = onSnapshot(q, (querySnapshot) => {
        if (isSyncing) return; // Silent mode during bulk operations
        const productArray = [];
        querySnapshot.forEach((doc) => {
          productArray.push({ id: doc.id, ...doc.data() });
        });
        setProducts(sortProducts(productArray));
      }, (error) => {
        console.error("Error subscribiendo a Firestore:", error);
        fetchLocalCatalog();
      });

      // SYNC ORDERS & PAYMENTS (Global Listeners)
      const unsubscribeOrders = onOrdersUpdate((liveOrders) => {
        setOrders(liveOrders);
        console.log("📦 Órdenes actualizadas:", liveOrders.length);
      });

      const unsubscribePayments = onAllPaymentsUpdate((livePayments) => {
        setAllPayments(livePayments);
        console.log("💰 Pagos actualizados:", livePayments.length);
      });

      return () => {
        unsubscribeCatalog();
        unsubscribeOrders();
        unsubscribePayments();
      };
    } else {
      fetchLocalCatalog();
    }
  }, []);

  // Keyboard shortcut listener for Ctrl + Alt + A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        checkAuthAndOpen('admin');
        console.log("🛠️ Admin Panel Auth Requested");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync Cart to LocalStorage
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

  const fetchLocalCatalog = () => {
    console.log("📂 Cargando catálogo local (JSON)...");
    fetch(`${import.meta.env.BASE_URL}catalogo.json`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setProducts(sortProducts(list));
      })
      .catch(err => {
        console.error("Error loading catalog:", err);
        setProducts([]);
      });
  };

  // Called when product card "+ / Añadir al Pedido" is clicked
  const handleAddToCart = (product, quantity = 1) => {
    if (priceType === null) {
      // First product: show pricing modal, save pending product
      setPendingProduct({ product, quantity });
      setIsPricingModalOpen(true);
    } else {
      // Price already chosen: add directly
      commitToCart(product, quantity, priceType);
    }
  };

  // Called when user selects a price type in the modal
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
      // Find item with same ID that is NOT yet separated
      const existingNew = prev.find(item => item.id === product.id && !item.isSeparated);
      const priceToUse = type === 'mayor' ? product.mayor : product.detal;

      if (existingNew) {
        return prev.map(item =>
          (item.id === product.id && !item.isSeparated)
            ? { ...item, quantity: item.quantity + quantity, price: priceToUse }
            : item
        );
      }
      // If it doesn't exist as "New", add it as a new entry (even if there are "Separated" versions)
      return [...prev, { ...product, quantity, price: priceToUse, isSeparated: false }];
    });
  };

  const removeFromCart = (id) => {
    // Remove all lots for this product ID
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const removeOneFromCart = (id) => {
    setCart(prev => {
      // Check if there is a "New" one (not separated)
      const hasNew = prev.some(item => item.id === id && !item.isSeparated);
      
      if (hasNew) {
        // Priority: remove from the "New" lot first
        return prev
          .map(item => (item.id === id && !item.isSeparated) ? { ...item, quantity: item.quantity - 1 } : item)
          .filter(item => item.quantity > 0);
      } else {
        // Only "Separated" items exist; decrement from the first one found
        return prev
          .map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
          .filter(item => item.quantity > 0);
      }
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
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

    const text =
      `✨ *SEPARADO #${currentSeparation} - MUNDO ROSA* ✨\n` +
      `----------------------------------\n` +
      `📦 _Solo productos nuevos añadidos:_\n\n` +
      itemsText +
      `\n\n----------------------------------\n` +
      `💰 *TOTAL DE ESTE SEPARADO: ${formatCurrency(newItems.reduce((a, b) => a + (b.price * b.quantity), 0))}*\n` +
      `💵 *TOTAL ACUMULADO DEL PEDIDO: ${formatCurrency(cartTotal)}*\n` +
      `Tipo de precio: _${tipoLabel}_\n\n` +
      `⚠️ _La asesora verificará y separará estos ítems._`;

    navigator.clipboard.writeText(text).then(() => {
      // Mark as separated but keep in cart
      setCart(prev => prev.map(item => ({ ...item, isSeparated: true })));
      setSeparationCount(currentSeparation);
      setIsCartOpen(false);
    });
  };

  const handleClearCart = () => {
    if (confirm("⚠️ ¿Estás seguro de que deseas LIMPIAR TODO EL CARRITO? Se perderán todos los productos actuales.")) {
      setCart([]);
      setPriceType(null);
      setSeparationCount(0);
      setIsCartOpen(false);
    }
  };

  return (
    <div className="app">
      <Header
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onCartOpen={() => setIsCartOpen(true)}
        onAdminOpen={() => checkAuthAndOpen('admin')}
        onWarehouseOpen={() => checkAuthAndOpen('warehouse')}
        isConfigured={isConfigured}
      />

      <Hero />

      <ProductGrid
        products={products}
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
      />

      <AdminPanel 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
        currentCatalog={products}
        onUpdateCatalog={(newCatalog) => setProducts(newCatalog)}
        onSyncingStatus={setIsSyncing}
        orders={orders}
        allPayments={allPayments}
      />

      <footer>
        <div className="container">
          <div className="logo" onClick={() => checkAuthAndOpen('admin')} style={{ cursor: 'pointer' }}>
            MUNDO ROSA <span style={{fontSize: '0.6rem', opacity: 0.5, marginLeft: '5px', verticalAlign: 'middle'}}>v16.7.2</span>
          </div>
          <p>&copy; {new Date().getFullYear()} MUNDO ROSA - Hecho con amor 💖</p>
        </div>
      </footer>
      <OrderQueue
        isOpen={isWarehouseOpen}
        onClose={() => setIsWarehouseOpen(false)}
        formatCurrency={formatCurrency}
        catalog={products}
        orders={orders}
        allPayments={allPayments}
      />
      
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticate={handleAuthenticated}
      />
    </div>
  );
}

export default App;
