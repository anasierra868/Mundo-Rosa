import React, { useState, useEffect, useMemo, memo } from 'react';
import { loadLocalProducts, saveProduct, saveProductsBatch, deleteProduct, clearDB, toBase64, compressImage, createOrder, getOrdersCountForCustomer, getUniquePendingNames, addPayment, deletePayment, updatePaymentGlobal, ADVISOR_CODES, startCustomerTimer, deleteCustomerTimer, onTimersUpdate, differentiateDuplicatesOnly, cleanupGlobalFormat } from '../utils/db';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
  const [importModeChoice, setImportModeChoice] = useState(null); // 'replace', 'append' or null
  const [pendingImportData, setPendingImportData] = useState(null);
  
  // BODEGA SEARCH v5.5
  const [custSearch, setCustSearch] = useState('');
  const [isCustDropdownOpen, setIsCustDropdownOpen] = useState(false);

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

  // v4.9: Universal normalization to ignore mangled data (YZ?, emojis, case)
  const normalizeText = (text) => {
    if (!text) return "";
    return text.toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9 ]/g, " ")     // Replace special/mangled chars with spaces
      .replace(/\s+/g, " ")            // Consolidate spaces
      .trim();
  };

  const filteredActiveCustomers = useMemo(() => {
    const term = normalizeText(custSearch);
    if (!term) return activeCustomers;
    return activeCustomers.filter(name => normalizeText(name).includes(term));
  }, [activeCustomers, custSearch]);

  const displayProducts = useMemo(() => {
    const term = normalizeText(searchTerm);
    const filtered = products.filter(p => {
        if (!term) return true;
        const targetName = normalizeText(p.name);
        const targetCat = normalizeText(p.category);
        return targetName.includes(term) || targetCat.includes(term);
    });
    
    return [...filtered].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  }, [products.length, searchTerm]);

  // CONSULTAR ABONOS v15.1
  const [showAbonosViewer, setShowAbonosViewer] = useState(false);
  const [abonosPassword, setAbonosPassword] = useState('');
  const [abonosUnlocked, setAbonosUnlocked] = useState(false);
  const [editingAbonoId, setEditingAbonoId] = useState(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [editAuthCode, setEditAuthCode] = useState('');

  // TIMERS v2.15
  const [showTimersModal, setShowTimersModal] = useState(false);
  const [activeTimers, setActiveTimers] = useState([]);
  const [timerTick, setTimerTick] = useState(0); // forces re-render every second

  useEffect(() => {
    if (!showTimersModal) return;
    const unsub = onTimersUpdate(setActiveTimers);
    return () => unsub();
  }, [showTimersModal]);

  useEffect(() => {
    const interval = setInterval(() => setTimerTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Alarma de audio para timers expirados
  const alarmedTimersRef = React.useRef(new Set());
  useEffect(() => {
    if (activeTimers.length === 0) return;
    let playAlarm = false;
    
    activeTimers.forEach(timer => {
        let remainingMs = timer.durationMs;
        if (timer.startedAt) {
            const startMs = timer.startedAt.seconds * 1000;
            const elapsed = Date.now() - startMs;
            remainingMs = Math.max(0, timer.durationMs - elapsed);
        }
        
        if (remainingMs <= 0 && !alarmedTimersRef.current.has(timer.id)) {
            alarmedTimersRef.current.add(timer.id);
            playAlarm = true;
        }
    });

    if (playAlarm) {
        // 1. Sonido de Alerta v2.16
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
        audio.play().catch(e => console.warn("Autoplay bloqueado:", e));

        // 2. Voz Inteligente (Text-to-Speech)
        // Buscamos el timer que acaba de expirar para leer su nombre/número
        const expiredTimer = activeTimers.find(t => {
            let rem = t.durationMs;
            if (t.startedAt) {
                const elapsed = Date.now() - (t.startedAt.seconds * 1000);
                rem = t.durationMs - elapsed;
            }
            return rem <= 0;
        });

        if (expiredTimer && window.speechSynthesis) {
            const rawName = (expiredTimer.customerName || "").toString().trim();
            let voiceText = "";

            // Lógica de detección de celular (solo dígitos)
            if (/^\d+$/.test(rawName) && rawName.length >= 10) {
                const d = rawName;
                // Grupo 1 (Prefijo): 3, 0, 1
                const p1 = `${d[0]}, ${d[1]}, ${d[2]}`; 
                // Grupo 2: 6, 26
                const p2 = `${d[3]}, ${d.slice(4,6)}`;
                // Grupo 3: 36
                const p3 = d.slice(6,8);
                // Grupo 4: 58
                const p4 = d.slice(8);
                
                voiceText = `Tiempo agotado para el cliente: ${p1}. . . ${p2}. . . ${p3}. . . ${p4}`;
            } else {
                voiceText = `Tiempo agotado para el cliente: ${rawName}`;
            }

            const utterance = new SpeechSynthesisUtterance(voiceText);
            utterance.lang = 'es-ES';
            utterance.rate = 0.85; // Velocidad ligeramente reducida para máxima claridad
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }
  }, [timerTick, activeTimers]);

  const getTimerRemaining = (timer) => {
    if (!timer.startedAt) return timer.durationMs;
    const startMs = timer.startedAt.seconds * 1000;
    const elapsed = Date.now() - startMs;
    return Math.max(0, timer.durationMs - elapsed);
  };

  const formatTimerDisplay = (ms) => {
    if (ms <= 0) return null; // expired
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const [newName, setNewName] = useState('');
  const [newMayor, setNewMayor] = useState('');
  const [newDetal, setNewDetal] = useState('');

  // EXPORT TO EXCEL v2.14
  const exportAbonosToExcel = async () => {
    if (!allPayments || allPayments.length === 0) return alert('❌ No hay datos para exportar.');
    
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Abonos Mundo Rosa');

      // Define columns
      worksheet.columns = [
        { header: 'FECHA', key: 'date', width: 15 },
        { header: 'HORA', key: 'time', width: 12 },
        { header: 'ASESOR', key: 'advisor', width: 25 },
        { header: 'CLIENTE', key: 'customer', width: 30 },
        { header: 'VALOR', key: 'amount', width: 18 }
      ];

      // Style Header
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF38BDF8' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
      headerRow.height = 25;

      // Add Data
      let total = 0;
      [...allPayments].reverse().forEach(p => {
        const formattedDate = (p.date || '').split('-').reverse().join('/');
        const formattedTime = p.createdAt ? (p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt.seconds * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'S/H';
        
        total += parseInt(p.amount || 0);

        const row = worksheet.addRow({
          date: formattedDate,
          time: formattedTime,
          advisor: (p.advisorName || 'S/A').toUpperCase(),
          customer: (p.customerName || 'S/C').toUpperCase(),
          amount: parseInt(p.amount || 0)
        });

        // Format Amount cell
        row.getCell('amount').numFmt = '"$"#,##0';
        row.alignment = { vertical: 'middle' };
      });

      // Add TOTAL Row
      worksheet.addRow([]); // Blank
      const totalRow = worksheet.addRow({
        customer: 'TOTAL RECAUDADO:',
        amount: total
      });
      totalRow.getCell('customer').font = { bold: true };
      totalRow.getCell('amount').font = { bold: true, color: { argb: 'FF10B981' } };
      totalRow.getCell('amount').numFmt = '"$"#,##0';
      totalRow.getCell('amount').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

      // Generate Buffer and Download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const now = new Date();
      const timestamp = `${now.getDate()}_${now.getMonth() + 1}_${now.getFullYear()}`;
      saveAs(blob, `Reporte_Abonos_MundoRosa_${timestamp}.xlsx`);

    } catch (error) {
      console.error("Error al exportar Excel:", error);
      alert("❌ Ocurrió un error al generar el Excel.");
    }
  };

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
    
    // AUTOMATIZACIÓN: Diferenciar duplicados tras añadir producto nuevo v18.2
    setProgress('✨ Limpiando duplicados y asignando referencias...');
    await differentiateDuplicatesOnly();
    
    // Recargar productos frescos tras la diferenciación para ver los cambios de Ref.
    const freshProducts = await loadLocalProducts();
    setProducts(sortProducts(freshProducts));

    setIsProcessing(false);
    if (onSyncingStatus) onSyncingStatus(false);
    resetForm();
    alert(`✅ ¡"${p.name}" añadido y catálogo organizado con éxito!`);
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

  const handleExport = async () => {
    try {
      setProgress('⏳ Cargando catálogo completo...');
      setIsProcessing(true);

      // Always fetch fresh from Firestore for a complete export
      const allProducts = await loadLocalProducts();
      
      if (!allProducts || allProducts.length === 0) {
        alert('❌ No hay productos en el catálogo para exportar.');
        return;
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allProducts, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `catalogo_${allProducts.length}productos_${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      setProgress(`✅ Exportados ${allProducts.length} productos correctamente.`);
      setTimeout(() => setProgress(''), 3000);
    } catch (err) {
      console.error("Error al exportar:", err);
      alert('❌ Error al exportar el catálogo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) throw new Error("El archivo no contiene una lista de productos válida.");
        
        setPendingImportData(imported);
        setImportModeChoice('pending'); // Mostramos el modal de elección
      } catch (err) { 
          console.error(err);
          alert('Error al leer el archivo JSON: ' + err.message); 
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };

  const executeImport = async (mode) => {
    if (!pendingImportData) return;
    const items = pendingImportData;
    setImportModeChoice(null); // Cerramos el modal

    if (onSyncingStatus) onSyncingStatus(true);
    setIsProcessing(true);
    setProducts([]); // v5.4: Limpieza agresiva de estado para liberar RAM inmediata
    setProgress(`Iniciando importación en modo ${mode === 'replace' ? 'REEMPLAZO' : 'ANEXO'}...`);

    try {
      if (mode === 'replace') {
          await clearDB();
      }

      // v5.3: BLINDAJE TOTAL DE MEMORIA - Carga Ultra-Lenta y Segura
      const total = items.length;
      let currentBatch = [];
      const MAX_BATCH_SIZE = 3; // Lotes diminutos para evitar picos de RAM

      for (let i = 0; i < total; i++) {
          const p = items[i];
          setProgress(`🛡️ Blindaje RAM: Procesando ${i + 1} de ${total}...`);
          
          let processedP = { ...p };
          if (p.image && (p.image.length > 50000 || !p.image.includes('webp'))) {
              const optimizedImg = await compressImage(p.image);
              processedP.image = optimizedImg;
              // Respiración entre cada producto (Darle tiempo al Garbage Collector)
              await new Promise(r => setTimeout(r, 150)); 
          }
          currentBatch.push(processedP);

          // Sincronización por lotes mini
          if (currentBatch.length >= MAX_BATCH_SIZE || i === total - 1) {
              const count = currentBatch.length;
              setProgress(`☁️ Sincronizando bloque (${i + 1}/${total}) - Liberando memoria...`);
              
              await saveProductsBatch([...currentBatch]);
              
              // LIMPIEZA EXPLÍCITA
              currentBatch.forEach(item => { item.image = null; }); // Romper referencias
              currentBatch = []; 
              
              // Pausa de respiro profundo tras cada lote
              setProgress(`🍃 Respiro de sistema (Estabilizando RAM)...`);
              await new Promise(r => setTimeout(r, 500));
          }
      }

      setIsProcessing(false);
      if (onSyncingStatus) onSyncingStatus(false);
      setProgress('');
      setPendingImportData(null);
      
      // v5.4: Recarga de datos frescos tras la carga atómica
      const freshProducts = await loadLocalProducts();
      setProducts(sortProducts(freshProducts));

      alert(`¡Importación BLINDADA exitosa! Se han procesado ${total} productos con éxito y estabilidad.`);
    } catch (err) {
        console.error(err);
        alert("Error durante la importación: " + err.message);
        setIsProcessing(false);
        if (onSyncingStatus) onSyncingStatus(false);
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
          sku: item.sku || null, // Guardar el SKU para facilitar la eliminación global
          qty: item.qty,
          unitPrice: item.realPrice
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
            <button className="btn-upload" style={{background: '#7c3aed'}} onClick={() => setShowVerify(!showVerify)}>
              🛡️ Verificar Cotización
            </button>
            <button className="btn-export" onClick={handleExport}>💾 Exportar catalogo.json</button>
            <button 
              className="btn-upload" 
              style={{background: '#0ea5e9'}} 
              onClick={async () => {
                if(!confirm('⚠️ DIFERENCIADOR DE DUPLICADOS\n\n¿Deseas asignar códigos únicos Ref. XXX solo a los productos que se llaman igual y valen lo mismo?\n\nLos nombres se actualizarán automáticamente.')) return;
                setIsProcessing(true);
                const count = await differentiateDuplicatesOnly((msg) => setProgress(msg));
                if (count > 0) {
                     alert(`✅ Se han diferenciado ${count} productos duplicados exitosamente.`);
                     if (onUpdateCatalog) onUpdateCatalog(); 
                } else {
                     alert('✨ No se encontraron duplicados que necesiten ser diferenciados.');
                }
                setIsProcessing(false);
                setProgress('');
              }}
            >
              🏷️ DIFERENCIAR DUPLICADOS
            </button>
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
            <button 
              onClick={() => setShowTimersModal(true)}
              style={{
                background: 'linear-gradient(90deg, #92400e, #d97706)',
                color: '#fff',
                border: '1px solid #f59e0b',
                borderRadius: '10px',
                padding: '8px 16px',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              ⏱️ TEMPORIZADOR CLIENTES
            </button>
          </div>
        </section>

        {/* TIMERS MODAL v2.15 */}
        {showTimersModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: '20px',
              border: '2px solid #f59e0b',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Header */}
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{color: '#f59e0b', margin: 0, fontSize: '1rem', fontWeight: '900'}}>⏱️ TEMPORIZADOR CLIENTES</h3>
                <button onClick={() => setShowTimersModal(false)} style={{background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer'}}>✕</button>
              </div>

              {/* Timer List */}
              {activeTimers.length === 0 ? (
                <p style={{color: '#64748b', textAlign: 'center', fontSize: '0.85rem', padding: '20px 0'}}>No hay temporizadores activos.</p>
              ) : (
                activeTimers.map(timer => {
                  const remainingMs = getTimerRemaining(timer);
                  const display = formatTimerDisplay(remainingMs);
                  const expired = remainingMs <= 0;
                  return (
                    <div key={timer.id} style={{
                      background: '#1e293b',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: expired ? '1px solid #ef4444' : '1px solid #334155',
                      animation: expired ? 'pulse 0.8s infinite' : 'none'
                    }}>
                      <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                        <span style={{color: '#f8fafc', fontWeight: '900', fontSize: '1rem', letterSpacing: '0.5px'}}>
                          {(timer.customerName || '').toUpperCase()}
                        </span>
                        {expired ? (
                          <span style={{color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem', animation: 'pulse 0.6s infinite'}}>
                            🔴 TIEMPO AGOTADO
                          </span>
                        ) : (
                          <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem'}}>
                            {display}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteCustomerTimer(timer.id)}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: '#94a3b8',
                          width: '34px',
                          height: '34px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '1rem'
                        }}
                        title="Eliminar temporizador"
                      >🗑️</button>
                    </div>
                  );
                })
              )}

              {/* Footer note */}
              <p style={{color: '#64748b', fontSize: '0.7rem', textAlign: 'center', margin: '5px 0 0 0', fontStyle: 'italic'}}>
                * Los registros requieren eliminación manual por el asesor.
              </p>
            </div>
          </div>
        )}

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
                   <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px'}}>
                    <p style={{color: '#94a3b8', fontSize: '0.75rem', margin: 0, fontStyle: 'italic'}}>
                      *A continuación se muestran los abonos registrados con su evidencia fotográfica.
                    </p>
                    <button 
                      onClick={exportAbonosToExcel}
                      style={{
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px', 
                        padding: '6px 12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 'bold', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      📊 EXPORTAR EXCEL
                    </button>
                  </div>
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
                              {(p.date || '').split('-').reverse().join('/') || 'S/F'} 
                              {p.createdAt && (
                                <span style={{marginLeft: '5px', color: '#64748b'}}>
                                  🕒 {(p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt.seconds * 1000)).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              &bull; {p.customerName}
                            </div>
                          </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div style={{color: '#10b981', fontWeight: '900', fontSize: '1.2rem'}}>
                                {editingAbonoId === p.id ? (
                                    <input 
                                        type="number" 
                                        value={editingAmount}
                                        onChange={(e) => setEditingAmount(e.target.value)}
                                        style={{width: '100px', background: '#0f172a', border: '1px solid #38bdf8', color: '#fff', padding: '5px', borderRadius: '5px'}}
                                        autoFocus
                                    />
                                ) : (
                                    `$${parseInt(p.amount || 0).toLocaleString('es-CO')}`
                                )}
                            </div>
                            <div style={{display: 'flex', gap: '5px'}}>
                                {editingAbonoId === p.id ? (
                                    <>
                                        <input 
                                            type="password" 
                                            placeholder="Cód." 
                                            value={editAuthCode}
                                            onChange={(e) => setEditAuthCode(e.target.value)}
                                            maxLength={4}
                                            style={{width: '60px', background: '#0f172a', border: '1px solid #ef4444', color: '#fff', padding: '5px', borderRadius: '5px', fontSize: '0.7rem'}}
                                        />
                                        <button 
                                            onClick={async () => {
                                                const resolved = ADVISOR_CODES[editAuthCode.trim()];
                                                if (!resolved) return alert('❌ Código de asesor inválido.');
                                                if (!editingAmount || isNaN(editingAmount)) return alert('❌ Por favor ingresa un monto válido.');
                                                
                                                const success = await updatePaymentGlobal(p.id, { 
                                                    amount: parseInt(editingAmount),
                                                    advisorName: `${resolved} (Corregido)` 
                                                });
                                                if (success) {
                                                    setEditingAbonoId(null);
                                                    setEditAuthCode('');
                                                } else {
                                                    alert('❌ Error al actualizar el abono.');
                                                }
                                            }}
                                            style={{background: '#10b981', border: 'none', color: '#fff', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem'}}
                                        >
                                            ✅
                                        </button>
                                        <button 
                                            onClick={() => setEditingAbonoId(null)}
                                            style={{background: '#64748b', border: 'none', color: '#fff', padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.8rem'}}
                                        >
                                            ❌
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button 
                                            onClick={() => {
                                                setEditingAbonoId(p.id);
                                                setEditingAmount(p.amount);
                                                setEditAuthCode('');
                                            }}
                                            style={{background: 'rgba(56, 189, 248, 0.1)', border: 'none', color: '#38bdf8', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem'}}
                                            title="Editar abono"
                                        >
                                            ✏️
                                        </button>
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
                                    </>
                                )}
                            </div>
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

        {/* v5.2: Modal de Decisión de Importación Centrado y Premium */}
      {importModeChoice === 'pending' && (
        <div className="admin-decision-overlay">
          <div className="admin-decision-card">
            <div style={{ fontSize: '3.5rem', marginBottom: '20px', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}>📥</div>
            <h2>¿Cómo deseas importar?</h2>
            <p>
              Hemos leído el archivo y encontramos <strong>{pendingImportData?.length}</strong> productos listos para procesar. Selecciona el modo que prefieras:
            </p>
            
            <div className="decision-actions">
              <button 
                className="btn-decision replace" 
                onClick={() => executeImport('replace')}
              >
                🔄 MODO REEMPLAZO
                <span className="sub">(Borra todo y deja solo el archivo nuevo)</span>
              </button>

              <button 
                className="btn-decision append" 
                onClick={() => executeImport('append')}
              >
                ➕ MODO ANEXO
                <span className="sub">(Mantiene lo actual y suma lo nuevo)</span>
              </button>

              <button 
                className="btn-delete" 
                style={{ marginTop: '20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', padding: '12px' }}
                onClick={() => {
                  setImportModeChoice(null);
                  setPendingImportData(null);
                }}
              >
                Cancelar Operación
              </button>
            </div>
          </div>
        </div>
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
                  
                  <div className="search-select-container">
                    <div 
                      className="search-select-trigger" 
                      onClick={() => setIsCustDropdownOpen(!isCustDropdownOpen)}
                    >
                      <span>
                        {isNewCustomer 
                          ? "✍️ NUEVO CLIENTE (Ingresar manual)" 
                          : (customerName || "--- Seleccionar de Bodega ---")}
                      </span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{isCustDropdownOpen ? '▲' : '▼'}</span>
                    </div>

                    {isCustDropdownOpen && (
                      <div className="search-select-dropdown">
                        <div className="search-select-search-bar">
                          <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={custSearch}
                            onChange={(e) => setCustSearch(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div className="search-select-options">
                          {filteredActiveCustomers.length === 0 && custSearch && (
                            <div style={{ padding: '10px', color: '#64748b', fontSize: '0.8rem', textAlign: 'center' }}>
                              No se encontraron coincidencias
                            </div>
                          )}
                          
                          {filteredActiveCustomers.map(name => (
                            <div 
                              key={name} 
                              className={`option-item ${customerName === name && !isNewCustomer ? 'selected' : ''}`}
                              onClick={() => {
                                setCustomerName(name);
                                setIsNewCustomer(false);
                                setIsCustDropdownOpen(false);
                                setCustSearch('');
                              }}
                            >
                              {name}
                            </div>
                          ))}

                          <div 
                            className={`option-item new-user ${isNewCustomer ? 'selected' : ''}`}
                            onClick={() => {
                                setIsNewCustomer(true);
                                setCustomerName("");
                                setIsCustDropdownOpen(false);
                                setCustSearch('');
                            }}
                          >
                            ✍️ NUEVO CLIENTE (Ingresar manual)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

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
        
       {!isProcessing && (
         <>
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
        </>
       )}
      </div>
    </div>
  );
};

export default AdminPanel;
