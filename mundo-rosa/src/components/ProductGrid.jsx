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

  // Lógica de Categorización Dinámica
  const { groupedProducts, categoriesList } = useMemo(() => {
    const groups = {};
    const categoriesSet = new Set();
    const categoriesDataMap = {};

    products.forEach(product => {
      const nameLower = product.name.toLowerCase();
      let selectedCategory = null;
      let selectedIcon = '🎁';

      // 1. Prioritize AI Category if it exists
      // Extraer Categoría e Icono del producto (Manejo de IA y Manual)
      if (product.category) {
        const rawCategory = product.category.trim();
        // Regex para detectar un emoji al final (funciona con la mayoría de emojis modernos)
        const emojiMatch = rawCategory.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])$/);
        
        if (emojiMatch) {
            selectedIcon = emojiMatch[0];
            selectedCategory = rawCategory.replace(selectedIcon, '').trim();
        } else {
            selectedCategory = rawCategory;
            selectedIcon = '🎁';
        }
      }

      // 2. Unificación Alfabética v5.1: Máximo Respeto a las Categorías del Admin
      // Si la categoría ya existe (Manual o IA), la respetamos y no la sobreescribimos.
      if (!selectedCategory) {
        for (const [keyword, icon] of Object.entries(ICON_MAP)) {
          if (nameLower.includes(keyword)) {
            selectedCategory = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            selectedIcon = icon;
            // Solo corregimos nombres genéricos a marcas conocidas si no hay categoría
            if (keyword === 'manos libres') selectedCategory = 'Bolsos';
            if (keyword === 'sol de janeiro') selectedCategory = 'Splash & Perfumes';
            break;
          }
        }

        if (!selectedCategory) {
          // Fallback: usar la primera palabra del nombre
          const words = product.name.trim().split(/\s+/).filter(w => !STOP_WORDS.includes(w.toLowerCase()));
          if (words.length > 0) {
            selectedCategory = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
          } else {
            selectedCategory = 'Otros';
          }
        }
      }

      const displayCategory = selectedCategory;

      if (!groups[displayCategory]) {
        groups[displayCategory] = [];
        categoriesDataMap[displayCategory] = {
          id: displayCategory.toLowerCase().replace(/\s+/g, '-'),
          name: displayCategory,
          icon: selectedIcon
        };
      }
      
      groups[displayCategory].push(product);
      categoriesSet.add(displayCategory);
    });

    // Ordenar categorías: Orden Alfabético Estricto A-Z (Sin excepciones para 'Nuevos' ni íconos)
    const sortedCategories = Array.from(categoriesSet).sort((a, b) => 
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );

    // Ordenar alfabéticamente los productos DENTRO de cada categoría (A, A1, A2...)
    for (const cat in groups) {
      groups[cat].sort((p1, p2) => p1.name.trim().localeCompare(p2.name.trim(), 'es', { numeric: true, sensitivity: 'base' }));
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
                <span className="tab-icon">{cat.icon}</span>
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
              <span className="category-icon-bg">{cat.icon}</span>
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
