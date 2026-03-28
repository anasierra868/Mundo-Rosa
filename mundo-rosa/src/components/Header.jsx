import React from 'react';

function Header({ cartCount, onCartOpen, isConfigured }) {
  return (
    <header>
      <div className="container">
        <nav>
          <div className="logo">
            MUNDO<span>ROSA</span> 
            {isConfigured && <span style={{fontSize: '0.6rem', color: '#00ff88'}}>☁️ CLOUD</span>}
          </div>
          <button className="cart-icon" onClick={onCartOpen}>
            🛍️ {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </button>
        </nav>
      </div>
    </header>
  );
}

export default Header;
