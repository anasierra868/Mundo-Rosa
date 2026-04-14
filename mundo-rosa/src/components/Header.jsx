import React from 'react';

function Header({ cartCount, onCartOpen, onAdminOpen, onWarehouseOpen, isConfigured }) {
  return (
    <header>
      <div className="container">
        <nav>
          <div className="logo" onClick={onAdminOpen} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            MUNDO ROSA 
          </div>
          <div className="nav-actions">
            <button className="warehouse-btn" onClick={onWarehouseOpen}>
              📦 Almacén
            </button>
            <button className="cart-icon" onClick={onCartOpen}>
              🛒 {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header;
