import React, { useState, useEffect } from 'react';
import { db, isConfigured } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

// Components
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartModal from './components/CartModal';
import PricingModal from './components/PricingModal';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState(localStorage.getItem('FIREBASE_CONFIG') || '');

  // Pricing flow state
  const [priceType, setPriceType] = useState(null); // null = not yet chosen
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null); // product waiting for price decision

  useEffect(() => {
    if (isConfigured && db) {
      console.log("☁️ Cargando catálogo desde Firestore...");
      const q = query(collection(db, "products"));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const productArray = [];
        querySnapshot.forEach((doc) => {
          productArray.push({ id: doc.id, ...doc.data() });
        });
        setProducts(productArray);
      }, (error) => {
        console.error("Error subscribiendo a Firestore:", error);
        fetchLocalCatalog();
      });
      return () => unsubscribe();
    } else {
      fetchLocalCatalog();
    }
  }, []);

  const fetchLocalCatalog = () => {
    console.log("📂 Cargando catálogo local (JSON)...");
    fetch(`${import.meta.env.BASE_URL}catalog.json`)
      .then(res => res.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
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
      const existing = prev.find(item => item.id === product.id);
      const priceToUse = type === 'mayor' ? product.mayor : product.detal;

      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity, price: priceToUse }
            : item
        );
      }
      return [...prev, { ...product, quantity, price: priceToUse }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Reduce quantity by 1; if it reaches 0, remove from cart
  const removeOneFromCart = (id) => {
    setCart(prev => prev
      .map(item => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const sendWhatsApp = () => {
    const tipoLabel = priceType === 'mayor' ? 'Por Mayor' : 'Al Detal';
    const itemsText = cart.map(item =>
      `${item.quantity}x ${item.name} - Subtotal: ${formatCurrency(item.price * item.quantity)}`
    ).join('\n');

    const text =
      `💖 PEDIDO - MUNDO ROSA 💖\n` +
      `----------------------------------\n\n` +
      itemsText +
      `\n\n----------------------------------\n` +
      `💰 TOTAL A PAGAR: ${formatCurrency(cartTotal)}\n` +
      `Tipo de precio: ${tipoLabel}\n\n` +
      `⚠️ La cotización está sujeta a verificación por parte de nuestras asesoras.`;

    navigator.clipboard.writeText(text).catch(() => {
      // Fallback: create a textarea and copy
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });

    // Reset for next quote
    setCart([]);
    setPriceType(null);
    setIsCartOpen(false);
  };

  return (
    <div className="app">
      <Header
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onCartOpen={() => setIsCartOpen(true)}
        isConfigured={isConfigured}
      />

      <Hero />

      <ProductGrid
        products={products}
        cart={cart}
        onAddToCart={handleAddToCart}
        onRemoveOne={removeOneFromCart}
        formatCurrency={formatCurrency}
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
        onCheckout={sendWhatsApp}
        formatCurrency={formatCurrency}
        cartTotal={cartTotal}
      />

      <footer>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} MUNDO ROSA - Hecho con amor 💖</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
