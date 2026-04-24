import React, { useRef, useMemo } from 'react';
import ProductCard from './ProductCard';

// Mapa de palabras clave e iconos para categorías conocidas
const ICON_MAP = {
  'gloss': '💄',
  'labial': '💄',
  'tinta': '💄',
  'stanley': '🥤',
  'termo': '🥤',
  'vaso': '🥤',
  'billetera': '👛',
  'cartera': '👛',
  'bolso': '👜',
  'manos libres': '👜',
  'riñonera': '👜',
  'prada': '👜',
  'steve': '👜',
  'perfume': '✨',
  'splash': '✨',
  'mist': '✨',
  'sol de janeiro': '✨',
  'dior': '✨',
  'moschino': '✨',
  'crema': '🧴',
  'loción': '🧴',
  'skincare': '🧴',
  'iluminador': '💖',
  'rubor': '💖',
  'maquillaje': '💖',
  'polvo': '💖',
  'cepillo': '💆‍♀️',
  'secador': '💆‍♀️',
  'ventilador': '🌬️',
  'fan': '🌬️',
  'reloj': '⌚',
  'smartwatch': '⌚',
  'kit': '📦',
  'set': '📦',
  'medias': '🧦',
  'tobillera': '🧦',
  'baleta': '🧦',
  'pares': '🧦'
};

// Palabras que debemos ignorar al crear categorías automáticas
const STOP_WORDS = ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'para', 'con', 'y', 'un', 'una', 'mini', 'tipo'];

function ProductGrid({ 
  products, 
  cart,
  onAddToCart,
  onRemoveOne,
  formatCurrency,
  isSyncing,
  priceType
}) {
  const categoryRefs = useRef({});
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -250 : 250;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Lógica de Categorización Dinámica OPTIMIZADA v2
  const { groupedProducts, categoriesList } = useMemo(() => {
    const groups = {};
    const categoriesSet = new Set();
    const categoriesDataMap = {};

    products.forEach(product => {
      let selectedCategory = null;
      let selectedIcon = ''; // SIGUE VACÍO: Solo aparecerá si tú pones un emoji manual

      if (product.category) {
        // Producto YA categorizado: proceso directo, sin buscar palabras clave
        const rawCategory = product.category.trim();
        const emojiMatch = rawCategory.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])$/);
        if (emojiMatch) {
          selectedIcon = emojiMatch[0];
          selectedCategory = rawCategory.replace(selectedIcon, '').trim();
        } else {
          selectedCategory = rawCategory;
          selectedIcon = '';
        }
      } else {
        // Sin categoría: buscar por palabras clave (caso minoritario)
        const nameLower = product.name.toLowerCase();
        for (const [keyword, icon] of Object.entries(ICON_MAP)) {
          if (nameLower.includes(keyword)) {
            selectedCategory = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            selectedIcon = icon;
            if (keyword === 'manos libres') selectedCategory = 'Bolsos';
            if (keyword === 'sol de janeiro') selectedCategory = 'Splash & Perfumes';
            break;
          }
        }
        if (!selectedCategory) {
          const words = product.name.trim().split(/\s+/).filter(w => !STOP_WORDS.includes(w.toLowerCase()));
          selectedCategory = words.length > 0
            ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
            : 'Otros';
        }
      }

      if (!groups[selectedCategory]) {
        groups[selectedCategory] = [];
        categoriesDataMap[selectedCategory] = {
          id: selectedCategory.toLowerCase().replace(/\s+/g, '-'),
          name: selectedCategory,
          icon: selectedIcon
        };
      }
      groups[selectedCategory].push(product);
      categoriesSet.add(selectedCategory);
    });

    const sortedCategories = Array.from(categoriesSet).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    // Ordenamiento interno rápido (comparación directa: 3-5x más veloz que localeCompare en PC)
    for (const cat in groups) {
      groups[cat].sort((p1, p2) => {
        const a = (p1.name || '').trim().toLowerCase();
        const b = (p2.name || '').trim().toLowerCase();
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
    }

    return {
      groupedProducts: groups,
      categoriesList: sortedCategories.map(name => categoriesDataMap[name])
    };
  }, [products]);

  const scrollToCategory = (id) => {
    const element = categoryRefs.current[id];
    if (element) {
      const offset = 140; // Espacio para el header y nav
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

  if (isSyncing) {
    return (
      <div className="sync-overlay-main">
        <div className="spinner"></div>
        <h2>Sincronizando Catálogo...</h2>
        <p>Estamos optimizando y guardando tus productos en la nube. Por favor espera un momento.</p>
      </div>
    );
  }

  return (
    <main className="container">
      {/* Barra de Navegación Dinámica (Fila Deslizable) */}
      <div className="category-nav-outer">
        <button className="nav-arrow left" onClick={() => scroll('left')}>‹</button>
        <div className="category-nav-wrapper">
          <div className="category-nav" ref={scrollRef}>
            {categoriesList.map(cat => (
              <button 
                key={cat.id} 
                className="category-tab"
                onClick={() => scrollToCategory(cat.id)}
              >
                {cat.icon && <span className="tab-icon">{cat.icon}</span>}
                <span className="tab-name">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
        <button className="nav-arrow right" onClick={() => scroll('right')}>›</button>
      </div>

      {/* Renderizado de Secciones Dinámicas */}
      {categoriesList.map(cat => {
        const categoryProducts = groupedProducts[cat.name];
        return (
          <section 
            key={cat.id} 
            className="category-section"
            ref={el => categoryRefs.current[cat.id] = el}
          >
            <div className="category-header">
              {cat.icon && <span className="category-icon-bg">{cat.icon}</span>}
              <div>
                <h2>{cat.name}</h2>
                <div className="category-line"></div>
              </div>
            </div>

            <div className="catalog-grid">
              {categoryProducts.map(product => {
                const quantity = cart
                  .filter(i => i.id === product.id)
                  .reduce((acc, item) => acc + item.quantity, 0);
                return (
                  <ProductCard 
                    key={product.id} 
                    product={product}
                    quantity={quantity}
                    onAddToCart={onAddToCart}
                    onRemoveOne={onRemoveOne}
                    formatCurrency={formatCurrency}
                    priceType={priceType}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}

export default ProductGrid;
