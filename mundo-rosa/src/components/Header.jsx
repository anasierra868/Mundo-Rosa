function Header({ cartCount, onCartOpen, globalSearch, onSearchChange }) {
  return (
    <header>
      <div className="container">
        <nav>
          <div className="header-search-container">
            <input 
              type="text" 
              placeholder="🔍 Buscar productos..." 
              value={globalSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="global-search-input"
            />
            {globalSearch && (
              <button 
                className="clear-search-btn" 
                onClick={() => onSearchChange('')}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <div className="nav-actions">
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
