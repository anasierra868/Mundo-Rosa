import React from 'react';
import ProductCard from './ProductCard';

function ProductGrid({ 
  products, 
  cart,
  onAddToCart,
  onRemoveOne,
  formatCurrency
}) {
  return (
    <main className="container">

      <div className="catalog-grid">
        {products.map(product => {
          const cartItem = cart.find(i => i.id === product.id);
          const quantity = cartItem ? cartItem.quantity : 0;
          return (
            <ProductCard 
              key={product.id} 
              product={product}
              quantity={quantity}
              onAddToCart={onAddToCart}
              onRemoveOne={onRemoveOne}
              formatCurrency={formatCurrency}
            />
          );
        })}
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
