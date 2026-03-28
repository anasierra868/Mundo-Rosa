import React from 'react';
import ProductCard from './ProductCard';

function ProductGrid({ 
  products, 
  searchTerm, 
  onSearchChange, 
  onAddToCart,
  formatCurrency
}) {
  return (
    <main className="container">
      <div className="controls-container">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            placeholder="Buscar productos, colores o estilos..." 
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {isAnalyzing && (
        <div className="analysis-overlay">
          <div className="analysis-status">
            <div className="spinner-large"></div>
            <p>Gemini está analizando tu pedido...</p>
            <span>Identificando productos y cantidades</span>
          </div>
        </div>
      )}

      <div className="catalog-grid">
        {products.map(product => (
          <ProductCard 
            key={product.id} 
            product={product} 
            priceType={priceType}
            onAddToCart={onAddToCart}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
      
      {products.length === 0 && (
        <div style={{textAlign: 'center', padding: '100px 0', opacity: 0.5}}>
          <h3>No encontramos lo que buscas...</h3>
          <p>Intenta con otros términos</p>
        </div>
      )}
    </main>
  );
}

export default ProductGrid;
