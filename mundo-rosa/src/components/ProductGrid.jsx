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
      const scrollAmount = direction === 'left' ? -500 : 500;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Lógica de Categorización Dinámica OPTIMIZADA v2
  const { groupedProducts, categoriesList } = useMemo(() => {
    const groups = {};
    const categoriesSet = new Set();
    const categoriesDataMap = {};

    products.forEach(product => {
      // v35.1 SAFETY SHIELD: Skip nulls or products without names to prevent white screen crash
      if (!product || !product.name) return;
      
      // v35.0: Ocultar objetos internos de notas de clientes
      if (product.isCustomerNote || product.name === '_NOTA_CLIENTE') return;
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

      // 🎀 LÓGICA DE COLECCIONES ESPECIALES (Clonación Visual) 🎀
      const isCapibara = product.name && product.name.toLowerCase().includes('capibara');
      const capibaraCategoryName = "🎀♡COLECCIÓN CAPIBARA♡"; // Sin el último emoji (porque el código de arriba lo extrae como icono)
      const capibaraIcon = "🎀";
      
      if (isCapibara && selectedCategory !== capibaraCategoryName) {
        if (!groups[capibaraCategoryName]) {
            groups[capibaraCategoryName] = [];
            categoriesDataMap[capibaraCategoryName] = {
                id: "coleccion-capibara-especial",
                name: capibaraCategoryName,
                icon: capibaraIcon
            };
        }
        // Evitar duplicar si por alguna razón el producto ya entró a este grupo
        if (!groups[capibaraCategoryName].some(p => p.id === product.id)) {
            groups[capibaraCategoryName].push(product);
            categoriesSet.add(capibaraCategoryName);
        }
      }
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
    const performScroll = () => {
      const element = document.getElementById(id);
      if (element) {
        const headerOffset = 160; 
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - headerOffset;
   
        window.scrollTo({
          top: offsetPosition,
          behavior: 'auto'
        });
      }
    };

    // v19.4: Técnica de "Doble Impacto" - Salta dos veces para asegurar posición final exacta
    performScroll(); // Primer impacto (Despierta la sección)
    setTimeout(performScroll, 50);  // Segundo impacto (Ajuste fino instantáneo)
    setTimeout(performScroll, 250); // Tercer impacto (Por si acaso hubo carga de imágenes)
  };

  // v22.6: Removed sync overlay as requested. UI is always visible.
  if (isSyncing && products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: '#FF7EB3' }}>
        <div className="spinner-large" style={{ margin: '0 auto 20px' }}></div>
        <h2 style={{ fontFamily: 'Outfit' }}>Abriendo Catálogo...</h2>
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

      {/* Renderizado de Secciones Dinámicas con Lazy Loading v19.0 */}
      {categoriesList.map(cat => (
        <LazyCategorySection 
          key={cat.id}
          cat={cat}
          categoryProducts={groupedProducts[cat.name]}
          categoryRefs={categoryRefs}
          cart={cart}
          onAddToCart={onAddToCart}
          onRemoveOne={onRemoveOne}
          formatCurrency={formatCurrency}
          priceType={priceType}
        />
      ))}
    </main>
  );
}

// v19.0: Componente de Sección Inteligente (Solo renderiza si es visible)
const LazyCategorySection = ({ cat, categoryProducts, categoryRefs, cart, onAddToCart, onRemoveOne, formatCurrency, priceType }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const sectionRef = React.useRef(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Una vez visible, se queda visible
        }
      },
      { rootMargin: '200px' } // Cargar un poco antes de llegar
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id={cat.id}
      className="category-section"
      ref={el => {
        sectionRef.current = el;
        categoryRefs.current[cat.id] = el;
      }}
    >
      <div className="category-header">
        {cat.icon && <span className="category-icon-bg">{cat.icon}</span>}
        <div>
          <h2>{cat.name}</h2>
          <div className="category-line"></div>
        </div>
      </div>

      <div className="catalog-grid">
        {isVisible ? (
          categoryProducts.map(product => {
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
          })
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            Cargando productos... ⏳
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductGrid;
