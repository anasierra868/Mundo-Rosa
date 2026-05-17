import React, { useState, useEffect, useMemo, memo } from 'react';
import { loadLocalProducts, saveProduct, saveProductsBatch, deleteProduct, clearDB, toBase64, compressImage, createOrder, getOrdersCountForCustomer, getUniquePendingNames, addPayment, deletePayment } from '../utils/db';
import html2canvas from 'html2canvas';

// Sub-component for individual product rows to prevent full table re-renders v16.7
const AdminProductRow = memo(({ product, onEdit, onDelete }) => {
  const [localName, setLocalName] = useState(product.name);
  const [localCategory, setLocalCategory] = useState(product.category || 'Otros 🎁');
  const [localMayor, setLocalMayor] = useState(product.mayor);
  const [localDetal, setLocalDetal] = useState(product.detal);

  // Sync if external name changes (like search or mass import)
  useEffect(() => { setLocalName(product.name); }, [product.name]);
  useEffect(() => { setLocalCategory(product.category || 'Otros 🎁'); }, [product.category]);
  useEffect(() => { setLocalMayor(product.mayor); }, [product.mayor]);
  useEffect(() => { setLocalDetal(product.detal); }, [product.detal]);

  return (
    <tr>
      <td><img src={product.image} alt="" className="admin-img-thumb" loading="lazy" /></td>
      <td>
        <input 
          type="text" 
          value={localName} 
          onChange={e => {
            setLocalName(e.target.value);
            onEdit(product.id, 'name', e.target.value);
          }} 
        />
      </td>
      <td>
        <input 
          type="text" 
          value={localCategory} 
          onChange={e => {
            setLocalCategory(e.target.value);
            onEdit(product.id, 'category', e.target.value);
          }} 
        />
      </td>
      <td>
        <input 
          type="number" 
          value={localMayor} 
          onChange={e => {
            setLocalMayor(e.target.value);
            onEdit(product.id, 'mayor', e.target.value);
          }} 
        />
      </td>
      <td>
        <input 
          type="number" 
          value={localDetal} 
          onChange={e => {
            setLocalDetal(e.target.value);
            onEdit(product.id, 'detal', e.target.value);
          }} 
        />
      </td>
      <td>
        <button className="btn-delete" onClick={() => onDelete(product.id)}>Eliminar</button>
      </td>
    </tr>
  );
});

const AdminPanel = ({ isOpen, onClose, currentCatalog, onUpdateCatalog, onSyncingStatus, orders, allPayments }) => {
  const [products, setProducts] = useState([]);
  const [apiKey, setApiKey] = useState(localStorage.getItem('MUNDOROSA_GM_KEY') || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showVerify, setShowVerify] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [pastedQuote, setPastedQuote] = useState('');
  const [verifiedResults, setVerifiedResults] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Derive active customers in real-time from orders prop v15.6
  const activeCustomers = useMemo(() => {
    if (!orders) return [];
    const names = orders.map(o => {
      const fullCode = o.code || "";
      // Strip both versions of (SEPARADO #) and (separado #)
      return fullCode.split(' (SEPARADO #')[0].split(' (separado #')[0].trim().toUpperCase();
    });
    return Array.from(new Set(names)).filter(n => n.length > 0).sort();
  }, [orders]);

  // CONSULTAR ABONOS v15.1
  const [showAbonosViewer, setShowAbonosViewer] = useState(false);
  const [abonosPassword, setAbonosPassword] = useState('');
  const [abonosUnlocked, setAbonosUnlocked] = useState(false);

  const [newName, setNewName] = useState('');
  const [newMayor, setNewMayor] = useState('');
  const [newDetal, setNewDetal] = useState('');

  // STABLE SORT v16.7: Only re-sort if total length changes or search changes.
  // This prevents jumping while the user edits a specific product's name.
  const displayProducts = useMemo(() => {
    const filtered = products.filter(p => (p.name || "").toLowerCase().includes(searchTerm.toLowerCase()));
    return [...filtered].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  }, [products.length, searchTerm]);

  const [newImage, setNewImage] = useState(null);
  const [newCategory, setNewCategory] = useState('Nuevos 🎁');
  const [manualCategory, setManualCategory] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDraft();
      if (activeCustomers.length === 0) {
        setIsNewCustomer(true);
      }
    }
  }, [isOpen]);

  const sortProducts = (list) => {
    return [...list].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  };

  const loadDraft = async () => {
    const local = await loadLocalProducts();
    let initialProducts = local.length > 0 ? local : currentCatalog;
    
    // Auto-cleanup orphan video products once
    const hasVideos = initialProducts.some(p => p.videoUrl);
    if (hasVideos) {
      console.log("🧹 Limpiando productos de video obsoletos...");
      const cleaned = initialProducts.filter(p => !p.videoUrl);
      // Remove from DB one by one
      for (const p of initialProducts) {
        if (p.videoUrl) await deleteProduct(p.id);
      }
      initialProducts = cleaned;
    }

    setProducts(sortProducts(initialProducts));
  };

  const handleSaveApiKey = () => {
    localStorage.setItem('MUNDOROSA_GM_KEY', apiKey);
    alert('✅ API Key guardada con éxito.');
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    if (!newName) return alert('El nombre es obligatorio.');
    if (!newImage) return alert('La imagen es obligatoria.');

    // Determine final category
    const finalCategory = newCategory === 'OTRA_MANUAL' ? manualCategory : newCategory;
    if (!finalCategory) return alert('La categoría es obligatoria.');

    if (onSyncingStatus) onSyncingStatus(true);
    setIsProcessing(true);
    setProgress('Optimizando imagen...');
    const originalB64 = await toBase64(newImage);
    const b64 = await compressImage(originalB64);
    
    const p = {
      id: 'p-' + Date.now(),
      name: newName,
      mayor: parseInt(newMayor) || 0,
      detal: parseInt(newDetal) || 0,
      image: b64,
      tags: '',
      category: finalCategory || 'Nuevos 🎁'
    };

    await saveProduct(p);
    setProducts(prev => sortProducts([p, ...prev]));
    setIsProcessing(false);
    if (onSyncingStatus) onSyncingStatus(false);
    resetForm();
    alert(`✅ ¡"${p.name}" añadido con éxito!`);
  };

  const resetForm = () => {
    // 100% Persistence: Keep everything (Name, Prices, Category AND Image)
    // This helps following the file sequence (consecutives)
    // setNewName(''); 
    // setNewMayor(''); 
    // setNewDetal('');
    // setNewImage(null);
    // setManualCategory('');
    // setNewCategory('Nuevos 🎁');
  };

  const handleDelete = async (id) => {
    await deleteProduct(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const [saveTimeout, setSaveTimeout] = useState(null);

  const handleEdit = (id, field, value) => {
    // 1. Actualización visual instantánea
    const updated = products.map(p => {
      if (p.id === id) {
        const val = (field === 'mayor' || field === 'detal') ? (parseInt(value) || 0) : value;
        return { ...p, [field]: val };
      }
      return p;
    });
    setProducts(updated);

    // 2. Guardado en Google con Retraso (Debounce)
    if (saveTimeout) clearTimeout(saveTimeout);
    
    const newTimeout = setTimeout(async () => {
        const productToSave = updated.find(p => p.id === id);
        if (productToSave) {
            await saveProduct(productToSave);
            console.log("☁️ Guardado automático sincronizado");
        }
    }, 1500); // 1.5 Segundos de espera
    
    setSaveTimeout(newTimeout);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(products));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "catalogo.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (confirm(`¿Importar ${imported.length} productos? Reemplazará los cambios actuales en la Nube.\n\nADVERTENCIA: Tu catálogo pesa mucho (${(event.target.result.length / 1024 / 1024).toFixed(1)}MB). El sistema los comprimirá ahora para evitar bloqueos.`)) {
          if (onSyncingStatus) onSyncingStatus(true);
          setIsProcessing(true);
          setProgress(`Optimizando 1/ ${imported.length} fotos...`);
          
          await clearDB();
          
          // Importante: No solo mandamos a Batch, ¡Primero Comprimimos!
          const chunkSize = 10;
          for (let i = 0; i < imported.length; i += chunkSize) {
              const chunk = imported.slice(i, i + chunkSize);
              setProgress(`Optimizando bloque de fotos ${Math.floor(i/chunkSize) + 1} de ${Math.ceil(imported.length/chunkSize)}...`);
              
              // Comprimir en paralelo el chunk antes de enviarlo
              const optimizedChunk = await Promise.all(chunk.map(async p => {
                  if (p.image && p.image.length > 50000) { // Si pesa mas de 50kb
                      const newImg = await compressImage(p.image);
                      return { ...p, image: newImg };
                  }
                  return p;
              }));
              
              await saveProductsBatch(optimizedChunk);
          }
          
          setIsProcessing(false);
          if (onSyncingStatus) onSyncingStatus(false);
          setProgress('');
          alert('¡Sincronización completa con éxito! Tus 164 productos ahora son livianos y rápidos.');
        }
      } catch (err) { 
          console.error(err);
          alert('Error al leer el archivo JSON.'); 
          setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (!apiKey) return alert('Configura primero tu API Key de Gemini Flash.');

    if (confirm(`Vas a subir ${files.length} imágenes. La IA extraerá precios.`)) {
      if (onSyncingStatus) onSyncingStatus(true);
      setIsProcessing(true);
      const newBatch = [];
      let count = 0;

      for (let file of files) {
        count++;
        setProgress(`Procesando ${count}/${files.length}: ${file.name}`);
        try {
          const originalB64 = await toBase64(file);
          const b64 = await compressImage(originalB64);
          const prompt = `Analiza esta imagen. Extrae: {"name": "...", "mayor": ..., "detal": ..., "tags": "8 etiquetas"}. Retorna solo JSON puro.`;
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: "image/jpeg", data: b64.split(',')[1] } }
                ]
              }]
            })
          });
          
          const data = await response.json();
          let info;
          try {
            const content = data.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            info = JSON.parse(content);
          } catch(err) { 
            info = { name: file.name.split('.')[0], mayor: 0, detal: 0, tags: '' }; 
          }

          const product = {
            id: 'p-' + Date.now() + '-' + count,
            name: info.name,
            mayor: parseInt(info.mayor) || 0,
            detal: parseInt(info.detal) || 0,
            image: b64,
            tags: info.tags || '',
            category: 'Nuevos 🎁'
          };
          await saveProduct(product);
          newBatch.push(product);
        } catch (e) { console.error(e); }
      }
      
      setProducts(prev => sortProducts([...newBatch, ...prev]));
      setIsProcessing(false);
      if (onSyncingStatus) onSyncingStatus(false);
      setProgress('');
      alert('¡Subida masiva completada!');
    }
  };

  const handleAiCategorize = async () => {
    if (!apiKey) return alert('Configura primero tu API Key de Gemini Flash.');
    
    // Encontrar solo los productos que necesitan categoría
    const newProducts = products.filter(p => !p.category || p.category.includes('Nuevos 🎁') || p.category.includes('Otros 🎁'));
    
    if (newProducts.length === 0) {
        return alert('¡Todo tu catálogo ya está categorizado! No hay productos nuevos pendientes.');
    }

    // Recopilar categorías que ya existen en el catálogo
    const existingCats = new Set();
    products.forEach(p => {
        if (p.category && !p.category.includes('Nuevos 🎁') && !p.category.includes('Otros 🎁')) {
            existingCats.add(p.category);
        }
    });
    const existingCategoryList = Array.from(existingCats).join(', ');

    if (confirm(`La IA va a analizar y asignar categoría a los ${newProducts.length} productos nuevos. ¿Continuar?`)) {
      if (onSyncingStatus) onSyncingStatus(true);
      setIsProcessing(true);
      setProgress(`Buscando la categoría perfecta para ${newProducts.length} productos nuevos...`);

      try {
        const productListStr = newProducts.map(p => `ID: ${p.id} | NOMBRE: ${p.name}`).join('\n');
        
        let categoriesContext = "";
        if (existingCats.size > 0) {
            categoriesContext = `OBLIGATORIO: Asigna los productos a alguna de estas categorías ya existentes si es posible: [${existingCategoryList}]. Si un producto definitivamente no encaja en ninguna de esas, inventa una categoría nueva lógica terminada en un emoji.`;
        } else {
            categoriesContext = `Ejemplos de categorías sugeridas: "Labiales & Gloss 💄", "Perfumería & Splash ✨", "Bolsos & Billeteras 👜", "Termos & Vasos 🥤", "Hogar & Variedades 📦". Crea tus propias categorías lógicas que terminen siempre en un emoji.`;
        }
        
        const prompt = `
          Eres un experto en organizar catálogos de tiendas de belleza y accesorios para mujeres ("Mundo Rosa").
          Aquí tienes una lista de productos sin categorizar. 
          Asigna a cada producto una "Categoría" acompañada de UN SOLO emoji al final. 
          
          ${categoriesContext}
          
          Catálogo de Productos Nuevos:
          ${productListStr}
          
          Devuelve ESTRICTAMENTE un JSON con esta estructura exacta, SIN comentarios ni texto adicional:
          {"categorias": [{"id": "el-id", "category": "Nombre de Categoria 🎀"}]}
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        const aiResult = JSON.parse(content);

        // Actualizar solo los productos que la IA procesó
        const updatedProducts = products.map(p => {
          const aiCat = aiResult.categorias?.find(c => c.id === p.id);
          if (aiCat && aiCat.category) {
            const updatedP = { ...p, category: aiCat.category };
            saveProduct(updatedP); // save to Firestore/DB
            return updatedP;
          }
          return p;
        });

        setProducts(sortProducts(updatedProducts));
        alert('¡Categorización completada para los productos nuevos!');
      } catch (error) {
        console.error("Error AI Categorization:", error);
        alert('Hubo un error de conexión con la IA. Asegúrate de que la API Key es válida.');
      } finally {
        setIsProcessing(false);
        if (onSyncingStatus) onSyncingStatus(false);
        setProgress('');
      }
    }
  };
  
  const handleVerify = () => {
    if (!pastedQuote.trim()) return;
    
    const results = [];
    // Regex flexible: *2x* or *2 x*
    // Group 1: Qty, Group 2: Name
    const itemRegex = /\*(\d+)\s*x\*\s+(.*?)\s+\(\$/gi;
    
    // Detect price type
    const isWholesale = pastedQuote.toLowerCase().includes('por mayor');
    const pType = isWholesale ? 'mayor' : 'detal';
    
    let match;
    while ((match = itemRegex.exec(pastedQuote)) !== null) {
        const qty = parseInt(match[1]);
        const nameNode = match[2].trim();
        
        // Find in our database (products state/IndexedDB)
        const realProduct = products.find(p => p.name.trim().toLowerCase() === nameNode.toLowerCase());
        
        if (realProduct) {
            const realPrice = isWholesale ? (parseInt(realProduct.mayor) || 0) : (parseInt(realProduct.detal) || 0);
            results.push({
                ...realProduct,
                qty,
                realPrice,
                subtotal: qty * realPrice,
                error: false
            });
        } else {
            // Product not found in our current DB
            results.push({
                id: 'unknown-' + Date.now() + '-' + Math.random(),
                name: nameNode, 
                qty,
                realPrice: 0,
                subtotal: 0,
                image: '',
                error: true // IMPORTANT: Mark as error for UI
            });
        }
    }
    
    setVerifiedResults({
        items: results,
        type: isWholesale ? 'Por Mayor' : 'Al Detal',
        total: results.reduce((acc, curr) => acc + curr.subtotal, 0)
    });
    setAbono(''); // Reiniciar abono
    setPaymentDate(new Date().toISOString().split('T')[0]); // Reiniciar fecha a hoy
  };

  const handleAssignOrder = async () => {
    if (!verifiedResults || !verifiedResults.items.length) return;
    
    try {
      if (!customerName.trim()) return alert('⚠️ Por favor ingresa el NOMBRE DEL CLIENTE antes de asignar al almacén.');

      setIsProcessing(true);
      setProgress('Calculando número de tanda...');
      
      // Calculate count from current orders prop (Real-time)
      const nameToMatch = customerName.toLowerCase().trim();
      const count = (orders || []).filter(doc => {
          const code = (doc.code || "").toLowerCase();
          return code === nameToMatch || code.startsWith(nameToMatch + " (separado #");
      }).length;

      let orderCode = customerName.trim();
      if (count > 0) {
        orderCode = `${orderCode} (SEPARADO #${count + 1})`;
      }

      setProgress('Enviando orden al almacén...');
      
      const orderData = {
        code: orderCode,
        items: verifiedResults.items.map(item => ({
          id: item.id,
          name: item.name,
          qty: item.qty,
          unitPrice: item.realPrice // Almacenar el precio para futuras ediciones en almacén
        })),
        total: verifiedResults.total,
        type: verifiedResults.type,
        status: 'pending',
        paymentDate: new Date().toISOString().split('T')[0] // Fecha de creación del pedido
      };
      
      const success = await createOrder(orderData);
      
      if (success) {
          // Note: Abonos are now handled via the advisor module.
          alert(`🚀 ¡ORDEN ASIGNADA: ${orderCode}! \n\nEl almacenista ya puede visualizarla en el panel de Almacén.`);
          // Clear current verification after success
          setVerifiedResults(null);
          setCustomerName('');
          setPastedQuote('');
      } else {
          alert(`❌ Error al asignar la orden ${orderCode}. Se guardó localmente en este PC, pero NO llegará a otros dispositivos hasta que se solucione la conexión.`);
      }
    } catch (error) {
      console.error(error);
      alert('Error detallado al asignar: ' + error.message);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };


  if (!isOpen) return null;

  return (
    <div className="admin-modal">
      <div className="admin-content" style={{ position: 'relative' }}>
          <button className="close-btn" style={{ 
            position: 'absolute', 
            top: '15px', 
            right: '15px', 
            zIndex: 100,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            color: 'white',
            cursor: 'pointer'
          }} onClick={onClose}>&times;</button>

        <section className="admin-section api-key-section">
          <h3>🔐 Configuración de IA</h3>
          <div className="api-input-group">
            <input 
              type="password" 
              placeholder="API Key de Google Gemini"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button className="btn-save" onClick={handleSaveApiKey}>Guardar</button>
          </div>
          <p className="hint">Se guarda localmente en tu navegador.</p>
        </section>

        <button 
          className="btn-primary" 
          onClick={() => setShowTools(!showTools)}
          style={{
            width: '100%',
            marginBottom: '10px',
            background: 'linear-gradient(90deg, #4c1d95, #7c3aed)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          {showTools ? '🔼 Ocultar Herramientas' : '🛠️ Mostrar Panel de Herramientas'}
        </button>

        <section className={`admin-actions-container ${showTools ? 'expanded' : 'collapsed'}`}>
          <div className="admin-actions">
            <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? 'Cancelar' : '+ Nuevo Producto'}
            </button>
            <label className="btn-upload">
              📁 Subir Carpeta (IA)
              <input type="file" webkitdirectory="" directory="" multiple onChange={handleBulkUpload} hidden />
            </label>
            <button className="btn-upload" style={{background: '#e11d48'}} onClick={handleAiCategorize}>
              🧠 Auto-Categorizar (IA)
            </button>
            <button className="btn-upload" style={{background: '#7c3aed'}} onClick={() => setShowVerify(!showVerify)}>
              🛡️ Verificar Cotización
            </button>
            <button className="btn-export" onClick={handleExport}>💾 Exportar catalogo.json</button>
            <label className="btn-import">
              📤 Importar Backup
              <input type="file" accept=".json" onChange={handleImport} hidden />
            </label>
            <button 
              onClick={() => { setShowAbonosViewer(true); setAbonosPassword(''); setAbonosUnlocked(false); }}
              style={{
                background: 'linear-gradient(90deg, #0f172a, #1e3a5f)',
                color: '#38bdf8',
                border: '1px solid #38bdf8',
                borderRadius: '10px',
                padding: '8px 16px',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              📊 CONSULTAR ABONOS
            </button>
          </div>
        </section>

        {/* ABONOS VIEWER MODAL v15.1 */}
        {showAbonosViewer && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: '20px',
              border: '1px solid #38bdf8',
              width: '100%',
              maxWidth: '750px', // Increased from 480px
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '25px', // slightly more padding for the larger view
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{color: '#38bdf8', margin: 0, fontSize: '1rem'}}>📊 CONSULTAR ABONOS</h3>
                <button onClick={() => setShowAbonosViewer(false)} style={{background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer'}}>✕</button>
              </div>

              {!abonosUnlocked ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '20px 0'}}>
                  <span style={{fontSize: '2rem'}}>🔐</span>
                  <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem', margin: 0}}>Ingresa la clave de acceso para consultar los abonos registrados.</p>
                  <input
                    type="password"
                    placeholder="Clave de acceso"
                    value={abonosPassword}
                    maxLength={4}
                    onChange={(e) => setAbonosPassword(e.target.value)}
                    style={{
                      background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
                      padding: '10px 15px', color: '#fff', fontSize: '1.2rem',
                      letterSpacing: '5px', textAlign: 'center', width: '150px'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (abonosPassword === '0748') setAbonosUnlocked(true);
                      else { alert('❌ Clave incorrecta.'); setAbonosPassword(''); }
                    }}
                    style={{
                      background: '#38bdf8', color: '#0f172a', border: 'none',
                      borderRadius: '10px', padding: '10px 25px', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    Ingresar
                  </button>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                  <p style={{color: '#94a3b8', fontSize: '0.75rem', margin: '0 0 5px 0', fontStyle: 'italic'}}>
                    *A continuación se muestran los abonos registrados con su evidencia fotográfica.
                  </p>
                  {(!allPayments || allPayments.length === 0) ? (
                    <p style={{color: '#94a3b8', textAlign: 'center'}}>No hay abonos registrados todavía.</p>
                  ) : (
                    [...allPayments].reverse().map(p => (
                      <div key={p.id} style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        padding: '12px',
                        border: '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                          <div>
                            <div style={{color: '#38bdf8', fontWeight: 'bold', fontSize: '0.85rem'}}>
                              {p.advisorName || 'Asesor no registrado'}
                            </div>
                            <div style={{color: '#94a3b8', fontSize: '0.75rem'}}>
                              {(p.date || '').split('-').reverse().join('/') || 'S/F'} &bull; {p.customerName}
                            </div>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div style={{color: '#10b981', fontWeight: '900', fontSize: '1.2rem'}}>
                                ${parseInt(p.amount || 0).toLocaleString('es-CO')}
                            </div>
                            <button 
                                onClick={async () => {
                                    if (window.confirm('¿Confirmas que deseas ELIMINAR este registro de abono permanentemente?')) {
                                        await deletePayment(p.id);
                                    }
                                }}
                                style={{background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem'}}
                                title="Eliminar abono"
                            >
                                🗑️
                            </button>
                          </div>
                        </div>
                        {p.receiptImage ? (
                          <div style={{ position: 'relative', marginTop: '10px' }}>
                            <img
                                src={p.receiptImage}
                                alt="Consignación"
                                style={{
                                    width: '100%', 
                                    height: 'auto',
                                    borderRadius: '12px', 
                                    border: '1px solid #334155',
                                    display: 'block',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
                                }}
                            />
                            <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(56, 189, 248, 0.8)', padding: '5px 12px', borderRadius: '20px', fontSize: '0.7rem', color: '#000', fontWeight: 'bold' }}>
                                Evidencia 📸
                            </div>
                          </div>
                        ) : (
                          <div style={{color: '#475569', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'center', padding: '8px'}}>Sin imagen de consignación (abono antiguo)</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showAddForm && (
          <form className="admin-form" onSubmit={handleManualAdd}>
            <input type="text" placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} required />
            
            <div className="category-selection" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <select 
                className="admin-select"
                value={newCategory} 
                onChange={e => setNewCategory(e.target.value)} 
              >
                <option value="Nuevos 🎁">Nuevos 🎁</option>
                {[...new Set(products.map(p => p.category))].filter(c => c && c !== 'Nuevos 🎁').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="OTRA_MANUAL">Otra (Manual) ✍️</option>
              </select>

              {newCategory === 'OTRA_MANUAL' && (
                <input 
                  type="text" 
                  placeholder="Escribe la nueva categoría (ej: Accesorios ✨)" 
                  value={manualCategory} 
                  onChange={e => setManualCategory(e.target.value)} 
                  required 
                />
              )}
            </div>

            <div className="price-inputs">
              <input type="number" placeholder="P. Mayor" value={newMayor} onChange={e => setNewMayor(e.target.value)} />
              <input type="number" placeholder="P. Detal" value={newDetal} onChange={e => setNewDetal(e.target.value)} />
            </div>
            
            <input type="file" onChange={e => setNewImage(e.target.files[0])} required />

            <button type="submit" className="btn-success">Añadir al Catálogo</button>
            <button type="button" className="btn-delete" style={{marginTop: '10px'}} onClick={resetForm}>Limpiar Formulario</button>
          </form>
        )}

        {isProcessing && (
          <div className="admin-loader">
            <div className="spinner"></div>
            <p>{progress || 'Procesando...'}</p>
          </div>
        )}

        {showVerify && (
          <section className="verify-section">
            <div className="verify-input-area">
              <h3>🛡️ Escudo Antifraude: Scanner de WhatsApp</h3>
              <textarea 
                placeholder="Pega aquí el texto que te envió el cliente por WhatsApp..." 
                value={pastedQuote}
                onChange={(e) => setPastedQuote(e.target.value)}
              />
              <button className="btn-success" onClick={handleVerify}>🔍 Verificar Ahora</button>
              <button className="btn-delete" style={{marginLeft: '10px'}} onClick={() => { setVerifiedResults(null); setPastedQuote(''); }}>Limpiar</button>
            </div>

            {verifiedResults && (
              <div className="verify-results">
                <div className="verify-header-box">
                  <h4>✅ RESULTADO DE VERIFICACIÓN REAL</h4>
                  <p>Precios aplicados: <strong>{verifiedResults.type}</strong></p>
                </div>
                
                <div className="verify-items-list">
                  {verifiedResults.items.map(item => (
                    <div key={item.id} className={`verify-item-card ${item.error ? 'error' : ''}`}>
                      <img src={item.image || 'https://via.placeholder.com/50'} alt="" />
                      <div className="verify-item-details">
                        <span className={`verify-name ${item.error ? 'error' : ''}`}>{item.name}</span>
                        <span className="verify-calc">
                          {item.qty} x {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.realPrice)} = <strong>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(item.subtotal)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="verify-total-box" style={{
                  background: 'rgba(0,0,0,0.5)', 
                  padding: '20px', 
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '15px'
                }}>
                  {/* Fila 1: Total Verificado */}
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'}}>
                    <span style={{fontWeight: '900', color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem'}}>TOTAL VERIFICADO:</span>
                    <strong style={{color: '#00ff88', fontSize: '1.5rem', textShadow: '0 0 10px rgba(0,255,136,0.3)'}}>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(verifiedResults.total)}</strong>
                  </div>

                  {/* Fila 2: Fecha de Registro */}
                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <span style={{fontSize: '0.75rem', fontWeight: '800', color: '#ffff00', textAlign: 'center'}}>📅 FECHA REGISTRO:</span>
                    <input 
                      type="date" 
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#000',
                        border: '2px solid #ffff00',
                        borderRadius: '10px',
                        padding: '12px',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                </div>


                <div className="customer-selection-area" style={{marginTop: '15px'}}>
                  <label style={{display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)'}}>👤 Seleccionar Cliente:</label>
                  
                  <select 
                    className="admin-select"
                    value={isNewCustomer ? "NEW" : customerName}
                    onChange={(e) => {
                      if (e.target.value === "NEW") {
                        setIsNewCustomer(true);
                        setCustomerName("");
                      } else {
                        setIsNewCustomer(false);
                        setCustomerName(e.target.value);
                      }
                    }}
                  >
                    {!customerName && !isNewCustomer && <option value="">--- Seleccionar de Bodega ---</option>}
                    {activeCustomers.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="NEW">✍️ NUEVO CLIENTE (Ingresar manual)</option>
                  </select>

                  {isNewCustomer && (
                    <input 
                      type="text" 
                      placeholder="Nombre del Cliente (Ej: Ana Sierra - Bogotá)" 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="admin-manual-input"
                      style={{
                        width: '100%',
                        padding: '12px',
                        marginTop: '10px',
                        borderRadius: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid #ff758c',
                        color: '#ffffff',
                        fontSize: '1rem',
                        outline: 'none',
                        animation: 'fadeInUp 0.3s ease'
                      }}
                    />
                  )}
                </div>

                <div className="verify-actions" style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                  <button className="btn-success" style={{flex: 2}} onClick={handleAssignOrder}>
                    🚀 Asignar Orden al Almacén
                  </button>
                  <button className="btn-delete" style={{flex: 1}} onClick={() => { setVerifiedResults(null); setPastedQuote(''); }}>
                    🧹 Limpiar Todo
                  </button>
                </div>
                
                <p className="hint">💡 Si este total no coincide con lo que el cliente te envió, ¡la cotización fue manipulada!</p>
              </div>
            )}
          </section>
        )}
        
        <div className="admin-search-bar">
          <input 
            type="text" 
            placeholder="🔍 Buscar producto por nombre para editar o eliminar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Imagen</th>
                <th>Nombre</th>
                <th>Categoría (IA)</th>
                <th>P. Mayor</th>
                <th>P. Detal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {displayProducts.map(p => (
                <AdminProductRow 
                  key={p.id} 
                  product={p} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                />
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="admin-footer">
          <p className="hint">⚡ Los cambios se guardan instantáneamente en la nube (Firebase) para todos tus clientes.</p>
          <button className="btn-apply" onClick={onClose}>
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
