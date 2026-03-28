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
  'estuche': '📦',
  'kit': '📦',
  'set': '📦'
};

// Palabras que debemos ignorar al crear categorías automáticas
const STOP_WORDS = ['el', 'la', 'los', 'las', 'de', 'del', 'en', 'para', 'con', 'y', 'un', 'una', 'mini', 'tipo'];

function ProductGrid({ 
  products, 
  cart,
  onAddToCart,
  onRemoveOne,
  formatCurrency
}) {
  const categoryRefs = useRef({});

  // Lógica de Categorización Dinámica
  const { groupedProducts, categoriesList } = useMemo(() => {
    const groups = {};
    const categoriesSet = new Set();
    const categoriesDataMap = {};

    products.forEach(product => {
      const nameLower = product.name.toLowerCase();
      let selectedCategory = null;
      let selectedIcon = '🎁';

      // 1. Buscar en el mapa de iconos conocidos
      for (const [keyword, icon] of Object.entries(ICON_MAP)) {
        if (nameLower.includes(keyword)) {
          selectedCategory = keyword.charAt(0).toUpperCase() + keyword.slice(1);
          selectedIcon = icon;
          // Especial para "Múltiples palabras"
          if (keyword === 'manos libres') selectedCategory = 'Bolsos';
          if (keyword === 'sol de janeiro') selectedCategory = 'Splash & Perfumes';
          break;
        }
      }

      // 2. Si no hay coincidencia, tomar la primera palabra significativa
      if (!selectedCategory) {
        const words = product.name.split(' ').filter(w => w.length > 2 && !STOP_WORDS.includes(w.toLowerCase()));
        if (words.length > 0) {
          selectedCategory = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
        } else {
          selectedCategory = 'Otros';
        }
      }

      // 3. Normalizar nombre (Limpiar plurales simples o variaciones comunes si fuera necesario)
      // Por ahora lo dejamos tal cual o con un mapeo simple de visualización
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

    // Ordenar categorías: primero las conocidas, luego las automáticas alfabéticamente
    const sortedCategories = Array.from(categoriesSet).sort((a, b) => {
      const iconA = categoriesDataMap[a].icon;
      const iconB = categoriesDataMap[b].icon;
      if (iconA !== '🎁' && iconB === '🎁') return -1;
      if (iconA === '🎁' && iconB !== '🎁') return 1;
      return a.localeCompare(b);
    });

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

  return (
    <main className="container">
      {/* Barra de Navegación Dinámica */}
      <div className="category-nav-wrapper">
        <div className="category-nav container">
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
    </main>
  );
}

export default ProductGrid;
