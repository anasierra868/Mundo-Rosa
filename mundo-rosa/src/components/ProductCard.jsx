import React from 'react';

function ProductCard({ product, quantity, onAddToCart, onRemoveOne, formatCurrency, priceType }) {
  return (
    <div className="product-card">
      <div className="product-image-container">
        <img 
          src={
            (product.imageUrl || product.image || '').replace('http://137.184.198.49', 'https://137-184-198-49.sslip.io')
          } 
          alt={product.name} 
          className="product-image" 
          loading="lazy" 
          decoding="async"
          onLoad={(e) => e.target.classList.add('loaded')} 
        />
        {quantity > 0 && (
          <div className="product-qty-badge">{quantity}</div>
        )}
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


        {quantity > 0 ? (
          <div className="qty-controls">
            <button className="qty-btn qty-minus" onClick={() => onRemoveOne(product.id)}>−</button>
            <span className="qty-display">
              {priceType === null ? (
                `${quantity} en pedido`
              ) : (
                <>
                  <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#065f46' }}>{quantity} x</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800' }}>
                    {formatCurrency(quantity * (priceType === 'mayor' ? product.mayor : product.detal))}
                  </div>
                </>
              )}
            </span>
            <button className="qty-btn qty-plus" onClick={() => onAddToCart(product)}>+</button>
          </div>
        ) : (
          <button 
            className="add-to-cart-btn"
            onClick={() => onAddToCart(product)}
          >
            ✨ Añadir al Pedido
          </button>
        )}
      </div>
    </div>
  );
}

export default ProductCard;
