import React, { useState, useEffect } from 'react';

function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    fetch('/catalog.json')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error loading catalog:", err));
  }, []);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const sendWhatsApp = () => {
    const phone = "573000000000"; // Reemplazar con el número real
    const message = encodeURIComponent(
      `¡Hola! Me gustaría realizar el siguiente pedido en MUNDO ROSA:\n\n` +
      cart.map(item => `- ${item.name} (${item.quantity}x) - ${formatCurrency(item.price * item.quantity)}`).join('\n') +
      `\n\n*Total: ${formatCurrency(total)}*`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="app">
      <header>
        <div className="container">
          <nav>
            <div className="logo">MUNDO<span>ROSA</span></div>
            <button className="cart-icon" onClick={() => setIsCartOpen(true)}>
              🛒 {cart.length > 0 && <span className="cart-count">{cart.reduce((a, b) => a + b.quantity, 0)}</span>}
            </button>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <h1>Detalles que Enamoran</h1>
          <p>Encuentra el regalo perfecto con la elegancia que solo MUNDO ROSA puede ofrecer.</p>
        </div>
      </section>

      <main className="container catalog-section">
        <div className="catalog-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <img src={product.image} alt={product.name} className="product-image" />
              <div className="product-info">
                <h3>{product.name}</h3>
                <p className="product-price">{formatCurrency(product.price)}</p>
                <button 
                  className="add-to-cart-btn"
                  onClick={() => addToCart(product)}
                >
                  Añadir al Carrito
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {isCartOpen && (
        <div className="modal-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setIsCartOpen(false)}>×</button>
            <h2>Tu Pedido</h2>
            <div className="cart-items">
              {cart.length === 0 ? (
                <p>El carrito está vacío.</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div>
                      <strong>{item.name}</strong>
                      <br />
                      <small>{item.quantity} x {formatCurrency(item.price)}</small>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{color: 'red', background: 'none'}}>Eliminar</button>
                  </div>
                ))
              )}
            </div>
            
            {cart.length > 0 && (
              <>
                <div className="cart-total">
                  Total: {formatCurrency(total)}
                </div>
                <button className="whatsapp-btn" onClick={sendWhatsApp}>
                  🛍️ Pedir por WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <footer style={{textAlign: 'center', padding: '40px', color: 'var(--text-light)'}}>
        <p>&copy; 2026 MUNDO ROSA - Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}

export default App;
