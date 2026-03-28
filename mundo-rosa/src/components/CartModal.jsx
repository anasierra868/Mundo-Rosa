import React, { useState } from 'react';

function CartModal({ cart, isOpen, onClose, onCheckout, onRemoveItem, formatCurrency, cartTotal, priceType }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    onCheckout(); // This now formats text, copies to clipboard, and resets state in App.jsx
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 3000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tu Pedido</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p>Aún no has añadido nada.</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <img src={item.image} className="cart-item-img" alt={item.name} />
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <small>{item.quantity} x {formatCurrency(item.price)}</small>
                  <br />
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    style={{ color: '#ff758c', background: 'none', padding: '5px 0', fontSize: '0.8rem', border: 'none', cursor: 'pointer' }}
                  >
                    Quitar ítem
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-total-section">
            <div className="cart-total">
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '5px' }}>
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#666', width: '100%' }}>
                Tipo de precio: <strong>{priceType === 'mayor' ? 'Por Mayor' : 'Al Detal'}</strong>
              </div>
            </div>

            <button className="whatsapp-btn copy-quote-btn" onClick={handleCopy}>
              {copied ? '✅ ¡Copiado! Pégalo en WhatsApp' : '📋 Copiar pedido como texto'}
            </button>

            {copied && (
              <p className="copy-hint">
                ¡Texto copiado! Ahora solo ve al chat de WhatsApp y dale a "Pegar".
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CartModal;
