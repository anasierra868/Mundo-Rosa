import React, { useRef } from 'react';
import ProductCard from './ProductCard';

const CATEGORIES = [
  { id: 'lips', name: 'Gloss & Labiales', icon: '💄', keywords: ['Gloss', 'Tinta', 'Labial'] },
  { id: 'stanley', name: 'Stanley & Termos', icon: '🥤', keywords: ['Stanley', 'Termo'] },
  { id: 'wallets', name: 'Billeteras & Accesorios', icon: '👛', keywords: ['Billetera'] },
  { id: 'bags', name: 'Bolsos & Manos Libres', icon: '👜', keywords: ['Manos libres', 'Riñonera'] },
  { id: 'fragrances', name: 'Splash & Perfumes', icon: '✨', keywords: ['SOL DE JANEIRO', 'Splash', 'Perfume'] },
  { id: 'skincare', name: 'Cuidado de la Piel', icon: '🧴', keywords: ['Cremas', 'Crema'] },
  { id: 'makeup', name: 'Maquillaje', icon: '💖', keywords: ['iluminadores', 'Rubores'] },
  { id: 'tech', name: 'Tecnología & Otros', icon: '🌬️', keywords: ['Ventilador'] },
];

function ProductGrid({ 
  products, 
  cart,
  onAddToCart,
  onRemoveOne,
  formatCurrency
}) {
  const categoryRefs = useRef({});

  // Categorize products
  const groupedProducts = products.reduce((acc, product) => {
    let categoryFound = CATEGORIES.find(cat => 
      cat.keywords.some(keyword => product.name.toLowerCase().includes(keyword.toLowerCase()))
    );

    const categoryId = categoryFound ? categoryFound.id : 'others';
    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }
    acc[categoryId].push(product);
    return acc;
  }, {});

  const scrollToCategory = (id) => {
    const element = categoryRefs.current[id];
    if (element) {
      const offset = 140; // Avoid header overlap
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <main className="container">
      {/* Category Navigation Bar */}
      <div className="category-nav-wrapper">
        <div className="category-nav container">
          {CATEGORIES.map(cat => (
            groupedProducts[cat.id] && (
              <button 
                key={cat.id} 
                className="category-tab"
                onClick={() => scrollToCategory(cat.id)}
              >
                <span className="tab-icon">{cat.icon}</span>
                <span className="tab-name">{cat.name}</span>
              </button>
            )
          ))}
        </div>
      </div>

      {CATEGORIES.map(cat => {
        const categoryProducts = groupedProducts[cat.id];
        if (!categoryProducts || categoryProducts.length === 0) return null;

        return (
          <section 
            key={cat.id} 
            className="category-section"
            ref={el => categoryRefs.current[cat.id] = el}
          >
            <div className="category-header">
              <span className="category-icon-bg">{cat.icon}</span>
              <div>
                <h2>{cat.name}</h2>
                <div className="category-line"></div>
              </div>
            </div>

            <div className="catalog-grid">
              {categoryProducts.map(product => {
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
          </section>
        );
      })}

      {/* Others section if any */}
      {groupedProducts['others'] && (
        <section 
          className="category-section"
          ref={el => categoryRefs.current['others'] = el}
        >
          <div className="category-header">
            <span className="category-icon-bg">🎁</span>
            <div>
              <h2>Otros</h2>
              <div className="category-line"></div>
            </div>
          </div>
          <div className="catalog-grid">
            {groupedProducts['others'].map(product => {
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
        </section>
      )}
    </main>
  );
}

export default ProductGrid;
