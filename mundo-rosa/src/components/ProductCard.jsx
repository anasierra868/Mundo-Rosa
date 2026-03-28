import React from 'react';

function ProductCard({ product, onAddToCart, formatCurrency }) {
  return (
    <div className="product-card">
      <div className="product-image-container">
        <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
      </div>
      <div className="product-info">
        <h3>{product.name}</h3>

        <div className="price-container">
          <div className="price-row">
            <span className="price-label">Mayor:</span>
            <p className="product-price">{formatCurrency(product.mayor)}</p>
          </div>
          <div className="price-row">
            <span className="price-label">Detal:</span>
            <p className="product-price detal-price">{formatCurrency(product.detal)}</p>
          </div>
        </div>

        <button 
          className="add-to-cart-btn"
          onClick={() => onAddToCart(product)}
        >
          ✨ Añadir al Pedido
        </button>
      </div>
    </div>
  );
}

export default ProductCard;
