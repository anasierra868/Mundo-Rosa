import React, { useState, useEffect, useMemo } from 'react';
import { db, isConfigured } from './firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';

// Components
import Header from './components/Header';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartModal from './components/CartModal';
import SettingsModal from './components/SettingsModal';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceType, setPriceType] = useState('mayor'); // 'mayor' or 'detal'
  const [apiKey, setApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [firebaseConfig, setFirebaseConfig] = useState(localStorage.getItem('FIREBASE_CONFIG') || '');

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

  const filteredProducts = useMemo(() => {
    return products.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.tags && product.tags.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [products, searchTerm]);

  const addToCart = (product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const priceToUse = priceType === 'mayor' ? product.mayor : product.detal;
      
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + quantity, price: priceToUse } : item
        );
      }
      return [...prev, { ...product, quantity, price: priceToUse }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const processImageWithAI = async (base64Image) => {
    if (!apiKey) {
      setIsApiModalOpen(true);
      return;
    }
    if (products.length === 0) {
      alert("Cargando catálogo... intenta de nuevo en un momento.");
      return;
    }

    setIsAnalyzing(true);
    const catalogContext = products.map(p => `ID: ${p.id} | NOMBRE: ${p.name} | TAGS: ${p.tags || ''}`).join("\n");
    
    const prompt = `Analiza esta imagen de pedido. 
    1. Identifica productos basándote en rasgos visuales.
    2. Si hay números escritos, esa es la cantidad (por ejemplo "4" escrito sobre un producto).
    3. Si no hay números claros, usa 1 por cada ítem marcado.
    4. Match con este catálogo:
    ${catalogContext}
    Retorna ESTRICTAMENTE un arreglo JSON: [{"id": "...", "cantidad": ...}]. Sin texto adicional.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: base64Image.split(',')[1] } }
            ]
          }]
        })
      });
      const data = await response.json();
      const content = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
      const detected = JSON.parse(content);
      
      if (Array.isArray(detected)) {
        detected.forEach(item => {
          const prod = products.find(p => p.id === item.id);
          if (prod) {
            addToCart(prod, parseInt(item.cantidad) || 1);
          }
        });
        setIsCartOpen(true);
      }
    } catch (error) {
      console.error("Error Gemini:", error);
      alert("Error al analizar la imagen. Verifica tu API Key y conexión.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => processImageWithAI(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handlePaste = async (e) => {
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(item => item.type.indexOf('image') !== -1);
      if (imageItems.length > 0) {
        const file = imageItems[0].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => processImageWithAI(ev.target.result);
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [apiKey, products, priceType]);

  const saveSettings = (key, firebaseJson) => {
    localStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    
    if (firebaseJson) {
      try {
        JSON.parse(firebaseJson);
        localStorage.setItem('FIREBASE_CONFIG', firebaseJson);
        setFirebaseConfig(firebaseJson);
        alert("Configuración guardada satisfactoriamente.");
        window.location.reload();
      } catch (e) {
        alert("El JSON de Firebase no es válido.");
        return;
      }
    }
    setIsApiModalOpen(false);
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
    const phone = "573136272551"; 
    const itemsText = cart.map(item => 
      `*${item.quantity}x* ${item.name}\n   _Subtotal: ${formatCurrency(item.price * item.quantity)}_`
    ).join('\n\n');

    const message = encodeURIComponent(
      `💖 *NUEVOPEDIDO - MUNDO ROSA* 💖\n` +
      `----------------------------------\n\n` +
      itemsText +
      `\n\n----------------------------------\n` +
      `💰 *TOTAL A PAGAR: ${formatCurrency(cartTotal)}*\n\n` +
      `Tipo de precio: _${priceType === 'mayor' ? 'Por Mayor' : 'Al Detal'}_`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
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
        products={filteredProducts}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        priceType={priceType}
        onPriceTypeChange={setPriceType}
        onImageUpload={handleImageUpload}
        isAnalyzing={isAnalyzing}
        onSettingsOpen={() => setIsApiModalOpen(true)}
        onAddToCart={addToCart}
        formatCurrency={formatCurrency}
      />

      <SettingsModal 
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        apiKey={apiKey}
        firebaseConfig={firebaseConfig}
        onSave={saveSettings}
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
