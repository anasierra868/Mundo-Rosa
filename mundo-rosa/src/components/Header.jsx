import React from 'react';

function Header({ cartCount, onCartOpen, isConfigured }) {
  return (
    <header>
      <div className="container">
        <nav>
          <div className="logo">
            MUNDO ROSA
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
