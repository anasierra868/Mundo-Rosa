import React, { useState } from 'react';

function CartModal({ cart, isOpen, onClose, onSeparate, onClearCart, onRemoveItem, formatCurrency, cartTotal, priceType }) {
  const [copiedType, setCopiedType] = useState(null); // 'separate' or 'final'

  if (!isOpen) return null;

  const handleSeparate = () => {
    onSeparate();
    setCopiedType('separate');
    setTimeout(() => {
      setCopiedType(null);
      onClose();
    }, 3000);
  };

  const handleClear = () => {
    onClearCart();
  };

  const newItemsCount = cart.filter(item => !item.isSeparated).length;

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
                <div style={{ position: 'relative' }}>
                  <img src={item.image} className="cart-item-img" alt={item.name} decoding="async" loading="lazy" />
                  {item.isSeparated ? (
                    <span className="item-status-badge separated">SEPARADO ✅</span>
                  ) : (
                    <span className="item-status-badge new">NUEVO 🛒</span>
                  )}
                </div>
                <div className="cart-item-info">
                  <strong>{item.name}</strong>
                  <small>{item.quantity} x {formatCurrency(item.price)} = <strong>{formatCurrency(item.quantity * item.price)}</strong></small>
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
                <span>Total Acumulado</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#666', width: '100%' }}>
                Tipo de precio: <strong>{priceType === 'mayor' ? 'Por Mayor' : 'Al Detal'}</strong>
              </div>
            </div>

            <div className="cart-actions-dual">
              <button 
                className={`whatsapp-btn separate-btn ${newItemsCount === 0 ? 'disabled' : ''}`} 
                onClick={handleSeparate}
                disabled={newItemsCount === 0}
              >
                {copiedType === 'separate' ? '✅ ¡Copiado!' : `📂 Separar Nuevos (${newItemsCount})`}
              </button>

              <button className="whatsapp-btn final-btn" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }} onClick={handleClear}>
                🗑️ Limpiar Carrito
              </button>
            </div>

            {copiedType && (
              <p className="copy-hint" style={{ color: '#059669', fontWeight: 'bold' }}>
                ¡Pedido parcial copiado! Pégalo en WhatsApp.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CartModal;
