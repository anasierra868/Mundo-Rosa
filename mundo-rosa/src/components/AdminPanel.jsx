import React, { useState, useEffect, useMemo, memo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
    loadLocalProducts, saveProduct, saveProductsBatch, deleteProduct, clearDB, toBase64, compressImage, 
    onCODPaymentsUpdate, deleteCODPayment, importProductsFromJSON, getProductImageUrl,
    getVaultProducts, restoreFromVault, deleteFromVault, onSoldOutUpdate, purgeExpiredVaultItems,
    createOrder, deletePayment, updatePayment, importProductsFromExcel
} from '../utils/db';
import html2canvas from 'html2canvas';

// Sub-component for individual product rows to prevent full table re-renders v16.7
const AdminProductRow = memo(({ product, onEdit, onDelete }) => {
  const [localName, setLocalName] = useState(product.name);
  const [localCategory, setLocalCategory] = useState(product.category || 'Otros 🎁');
  const [localMayor, setLocalMayor] = useState(product.mayor);
  const [localDetal, setLocalDetal] = useState(product.detal);
  const [localStock, setLocalStock] = useState(product.stock || 0);
  const [localLocation, setLocalLocation] = useState(product.sku || '');

  // Sync if external name changes (like search or mass import)
  useEffect(() => { setLocalName(product.name); }, [product.name]);
  useEffect(() => { setLocalCategory(product.category || 'Otros 🎁'); }, [product.category]);
  useEffect(() => { setLocalMayor(product.mayor); }, [product.mayor]);
  useEffect(() => { setLocalDetal(product.detal); }, [product.detal]);
  useEffect(() => { setLocalStock(product.stock || 0); }, [product.stock]);
  useEffect(() => { setLocalLocation(product.sku || ''); }, [product.sku]);

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
        <input 
          type="number" 
          value={localStock} 
          placeholder="0"
          style={{ width: '60px', textAlign: 'center' }}
          onChange={e => {
            const val = parseInt(e.target.value) || 0;
            setLocalStock(val);
            onEdit(product.id, 'stock', val);
          }} 
        />
      </td>
      <td>
        <input 
          type="text" 
          value={localLocation} 
          placeholder="---"
          style={{ width: '80px', textAlign: 'center' }}
          onChange={e => {
            setLocalLocation(e.target.value);
            onEdit(product.id, 'sku', e.target.value);
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [excelImportData, setExcelImportData] = useState(null);
  const [showTools, setShowTools] = useState(false);
  const [pastedQuote, setPastedQuote] = useState('');
  const [verifiedResults, setVerifiedResults] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [localCheckedMap, setLocalCheckedMap] = useState({});


  // Derive active customers in real-time from orders prop v15.6
  const activeCustomers = useMemo(() => {
    if (!orders) return [];
    const uniqueMap = new Map();
    orders.forEach(o => {
      const fullCode = o.code || "";
      const name = fullCode.split(' (SEPARADO #')[0].split(' (separado #')[0].trim().toUpperCase();
      if (name && !uniqueMap.has(name)) {
        uniqueMap.set(name, o.customerId || null);
      }
    });
    return Array.from(uniqueMap.entries())
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // CONSULTAR ABONOS v15.1
  const [showAbonosViewer, setShowAbonosViewer] = useState(false);
  const [abonosPassword, setAbonosPassword] = useState('');
  const [abonosUnlocked, setAbonosUnlocked] = useState(false);
  const [abonosSearchTerm, setAbonosSearchTerm] = useState('');

  // 🛵 DOMICILIOS v1.0
  const [showDomiciliosViewer, setShowDomiciliosViewer] = useState(false);
  const [domiciliosPassword, setDomiciliosPassword] = useState('');
  const [domiciliosUnlocked, setDomiciliosUnlocked] = useState(false);
  const [allDomicilios, setAllDomicilios] = useState([]);
  
  // 🏛️ BÓVEDA DE AGOTADOS v1.0
  const [showVault, setShowVault] = useState(false);
  const [vaultProducts, setVaultProducts] = useState([]);
  const [vaultSearchTerm, setVaultSearchTerm] = useState('');
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [targetCategory, setTargetCategory] = useState('');

  const [newName, setNewName] = useState('');
  const [newMayor, setNewMayor] = useState('');
  const [newDetal, setNewDetal] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // FILTERED PAYMENTS v22.0: FULL ARCHITECTURAL DECOUPLING
  const filteredPayments = useMemo(() => {
    if (!allPayments) return [];
    
    // 1. Mostrar todos los registros sin excepción
    const independentPayments = allPayments;
    
    // 2. Ordenar por fecha (Priorizar fecha de creación en servidor para que los recién subidos salgan primero)
    const sorted = [...independentPayments].sort((a, b) => {
        const dateA = new Date(a.created || a.date || 0);
        const dateB = new Date(b.created || b.date || 0);
        return dateB - dateA;
    });

    const term = abonosSearchTerm.toLowerCase().trim();
    const list = !term ? sorted : sorted.filter(p => 
      (p.customerName || "").toLowerCase().includes(term) ||
      (p.advisorName || "").toLowerCase().includes(term) ||
      (p.amount || "").toString().includes(term) ||
      (p.date || "").includes(term)
    );

    // v42.0: Respuesta Instantánea Blindada
    return list.map(p => {
        const pId = p.id || p.globalId || `${p.customerName}_${p.amount}_${p.date}`;
        return {
            ...p,
            isChecked: localCheckedMap[pId] !== undefined ? localCheckedMap[pId] : p.isChecked
        };
    });
  }, [allPayments, abonosSearchTerm, localCheckedMap]);

  // STABLE SORT v16.7: Only re-sort if total length changes or search changes.
  // This prevents jumping while the user edits a specific product's name.
  const displayProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = products.filter(p => 
      (p.name || "").toLowerCase().includes(term) || 
      (p.category || "").toLowerCase().includes(term)
    );
    return [...filtered].sort((a, b) => 
      (a.name || "").localeCompare((b.name || ""), 'es', { numeric: true, sensitivity: 'base' })
    );
  }, [products.length, searchTerm]);

  const [newImage, setNewImage] = useState(null);
  const [newCategory, setNewCategory] = useState('Nuevos 🎁');
  const [manualCategory, setManualCategory] = useState('');
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let unsubVault = null;
    if (showVault) {
      setIsVaultLoading(true);
      // Run the 30-day purge exactly when the vault is opened
      purgeExpiredVaultItems().then(() => {
        unsubVault = onSoldOutUpdate((list) => {
          setVaultProducts(list); // already processed by onSoldOutUpdate (image URLs, numeric types)
          setIsVaultLoading(false);
        });
      });
    }
    return () => { if (unsubVault) unsubVault(); };
  }, [showVault]);

  const handleRestoreFromVault = async (item) => {
    if (!confirm(`¿Restaurar "${item.name}" al catálogo?`)) return;
    const ok = await restoreFromVault(item.id, item);
    if (ok) {
      alert("✅ Producto restaurado correctamente.");
    } else {
      alert("❌ Error al restaurar.");
    }
  };

  const handleDeleteFromVault = async (id) => {
    if (!confirm("¿ELIMINAR DEFINITIVAMENTE? Esta acción no se puede deshacer.")) return;
    const ok = await deleteFromVault(id);
    if (ok) {
      alert("🗑️ Eliminado definitivamente.");
    }
  };

  const handleDeleteAllFromVault = async () => {
    if (vaultProducts.length === 0) return alert('La bóveda ya está vacía.');
    if (!confirm(`☢️ ¿ELIMINAR DEFINITIVAMENTE los ${vaultProducts.length} productos de la bóveda? Esta acción NO se puede deshacer.`)) return;
    if (!confirm('⚠️ Segunda confirmación: ¿Está COMPLETAMENTE SEGURO? Se borrarán todos los artículos agotados para siempre.')) return;

    setIsVaultLoading(true);
    let deleted = 0;
    for (const item of vaultProducts) {
      const ok = await deleteFromVault(item.id);
      if (ok) deleted++;
    }
    setIsVaultLoading(false);
    alert(`✅ Se eliminaron ${deleted} productos de la bóveda.`);
  };

  useEffect(() => {
    if (isOpen) {
      loadDraft();
      if (activeCustomers.length === 0) {
        setIsNewCustomer(true);
      }
    }
  }, [isOpen]);

  // v28.0: SAFE SYNC SHIELD — Solo cargar el catálogo al abrir para evitar que la sincronización delta borre ediciones en curso
  useEffect(() => {
    if (isOpen) {
      // Si ya tenemos productos y estamos editando, no sobrescribir desde afuera
      if (products.length === 0) {
        setProducts(sortProducts(currentCatalog));
      }
    } else {
      // Limpiar al cerrar para forzar recarga fresca la próxima vez
      setProducts([]);
    }
  }, [isOpen]); // Quitamos currentCatalog de las dependencias para evitar race conditions

  // Real-time Domicilios Sync v1.0
  useEffect(() => {
    if (isOpen) {
        const unsub = onCODPaymentsUpdate((data) => {
            setAllDomicilios(data);
        });
        return () => unsub();
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

  const handleExportPaymentsExcel = () => {
    if (!allPayments || allPayments.length === 0) return alert('No hay abonos para exportar.');
    
    // Preparar los datos en formato de arreglo de objetos para XLSX
    let total = 0;
    const rows = allPayments.map(p => {
        const amount = parseInt(p.amount || 0);
        total += amount;
        return {
            "Fecha Registro": p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CO') : 'S/R',
            "Fecha Consignación": (p.date || '').split('-').reverse().join('/') || 'S/F',
            "Nombre Cliente": p.customerName || 'N/A',
            "Nombre Asesor": p.advisorName || 'N/A',
            "Valor Consignado": amount
        };
    });
    
    // Agregar fila de total
    rows.push({
        "Fecha Registro": "",
        "Fecha Consignación": "",
        "Nombre Cliente": "",
        "Nombre Asesor": "TOTAL",
        "Valor Consignado": total
    });

    // Crear hoja de trabajo y libro
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Abonos");
    
    // Descargar archivo .xlsx
    XLSX.writeFile(workbook, `Reporte_Abonos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportDomiciliosExcel = () => {
    if (!allDomicilios || allDomicilios.length === 0) return alert('No hay domicilios para exportar.');
    
    let total = 0;
    const rows = allDomicilios.map(d => {
        const amount = parseInt(d.amount || 0);
        total += amount;
        return {
            "Fecha Registro": d.createdAt ? new Date(d.createdAt).toLocaleString('es-CO') : 'S/R',
            "Nombre Cliente": d.customerName || 'N/A',
            "Asesor Responsable": d.advisorName || 'N/A',
            "Monto Domicilio": amount
        };
    });
    
    rows.push({
        "Fecha Registro": "",
        "Nombre Cliente": "",
        "Asesor Responsable": "TOTAL",
        "Monto Domicilio": total
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Domicilios");
    XLSX.writeFile(workbook, `Reporte_Domicilios_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDeleteSingleDomicilio = async (id) => {
    if (confirm('¿Eliminar este registro de domicilio?')) {
        await deleteCODPayment(id);
    }
  };

  const handleDeleteAllDomicilios = async () => {
    if (confirm('⚠️ ¡ATENCIÓN! Estás a punto de borrar TODOS los registros de domicilios.\n\nEsta acción es irreversible. ¿Deseas continuar?')) {
        setIsProcessing(true);
        try {
            for (const d of allDomicilios) {
                await deleteCODPayment(d.id);
            }
            alert('✅ Lista de domicilios vaciada.');
        } catch (err) {
            alert('Error al vaciar la lista.');
        }
        setIsProcessing(false);
    }
  };

  const handleDeleteAllPayments = async () => {
    if (confirm('⚠️ ¡ATENCIÓN! Estás a punto de ELIMINAR TODOS los abonos registrados.\n\nEsta acción es irreversible. ¿Deseas continuar?')) {
        if (confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Se borrará toda la lista de Consultar Abonos.')) {
            setIsProcessing(true);
            try {
                for (const p of allPayments) {
                    await deletePayment(p.id);
                }
                alert('✅ Todos los abonos han sido eliminados.');
            } catch (err) {
                alert('Error al eliminar algunos registros.');
            }
            setIsProcessing(false);
        }
    }
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
    setProgress('⬆️ Subiendo imagen al servidor...');
    
    // 0. Verificar duplicados y referenciar automáticamente
    const exists = products.some(p => p.name.trim().toLowerCase() === newName.trim().toLowerCase());
    let finalName = newName;
    if (exists) {
        const randomRef = 'Ref. ' + Math.random().toString(36).substring(2, 5).toUpperCase();
        finalName = `${newName.trim()} ${randomRef}`;
    }

    const p = {
      name: finalName,
      mayor: parseInt(newMayor) || 0,
      detal: parseInt(newDetal) || 0,
      stock: parseInt(newStock) || 0,
      sku: newLocation,
      imageFile: newImage,   // Archivo real → se sube al campo 'img' de PocketBase
      tags: '',
      category: finalCategory || 'Nuevos 🎁'
    };

    const record = await saveProduct(p);
    setIsProcessing(false);
    if (onSyncingStatus) onSyncingStatus(false);

    if (!record) {
      alert('❌ Error al subir el producto. Revisa la consola.');
      return;
    }

    // Producto nuevo con URL real del servidor
    const imgUrl = getProductImageUrl(record);
    const productWithUrl = { ...record, image: imgUrl };

    // 1. Actualizar estado local del AdminPanel
    setProducts(prev => sortProducts([productWithUrl, ...prev]));

    // 2. Inyectar en caché localStorage + invalidar TS para forzar delta sync en próxima visita
    try {
      const cached = localStorage.getItem('MUNDOROSA_CATALOG_CACHE');
      const cacheList = cached ? JSON.parse(cached) : [];
      // Verificar que no esté duplicado
      const exists = cacheList.some(cp => cp.id === productWithUrl.id);
      if (!exists) cacheList.push(productWithUrl);
      localStorage.setItem('MUNDOROSA_CATALOG_CACHE', JSON.stringify(cacheList));
      // Invalidar TS para que otros dispositivos (y próxima recarga) hagan delta sync
      localStorage.removeItem('MUNDOROSA_CATALOG_TS');
    } catch (e) { console.warn('Error actualizando caché:', e); }

    // 3. Actualizar el catálogo en App.jsx directamente (aparece en tienda al instante)
    if (onUpdateCatalog) {
      const currentList = Array.isArray(currentCatalog) ? currentCatalog : [];
      // Evitar duplicados si ya estaba en la lista
      const filtered = currentList.filter(cp => cp.id !== productWithUrl.id);
      onUpdateCatalog(sortProducts([productWithUrl, ...filtered]));
    }

    resetForm();
    alert(`✅ ¡"${record.name}" añadido con éxito!`);
  };

  const resetForm = () => {
    // v54.0: Persistencia Total (Incluso el nombre queda para variantes)
    setNewImage(null);
    
    // Se mantiene TODO lo demás: newName, newMayor, newDetal, newLocation, newCategory
  };

  const handleDelete = async (id) => {
    try {
      const ok = await deleteProduct(id);
      if (ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
      } else {
        alert("⚠️ El servidor no respondió a tiempo. El producto se eliminará la próxima vez que refresques.");
      }
    } catch (err) {
      console.error("Error UI handleDelete:", err);
      alert("❌ Error de conexión. Refresca la página.");
    }
  };

  const [saveTimeout, setSaveTimeout] = useState(null);

  const handleEdit = (id, field, value) => {
    // 1. Actualización visual instantánea
    const updated = products.map(p => {
      if (p.id === id) {
        const val = (field === 'mayor' || field === 'detal' || field === 'stock') ? (parseInt(value) || 0) : value;
        return { ...p, [field]: val };
      }
      return p;
    });
    setProducts(updated);
    
    // 1.1 PERSISTENCIA INMEDIATA EN CACHÉ (v28.0)
    // Esto asegura que si el usuario busca o refresca, el cambio no se pierda
    localStorage.setItem('MUNDOROSA_CATALOG_CACHE', JSON.stringify(updated));

    // 2. Guardado en Google con Retraso (Debounce)
    if (saveTimeout) clearTimeout(saveTimeout);
    
    const newTimeout = setTimeout(async () => {
        const productToSave = updated.find(p => p.id === id);
        if (productToSave) {
            const success = await saveProduct(productToSave);
            if (success) {
                console.log("☁️ Guardado automático sincronizado");
                // 3. ACTUALIZACIÓN CRÍTICA DE CACHÉ LOCAL v28.0
                // Esto evita que al recargar la página se pierdan los cambios antes del delta sync
                try {
                    const cached = localStorage.getItem('MUNDOROSA_CATALOG_CACHE');
                    if (cached) {
                        const list = JSON.parse(cached);
                        const idx = list.findIndex(p => p.id === id);
                        if (idx !== -1) {
                            list[idx] = { ...list[idx], ...productToSave };
                            localStorage.setItem('MUNDOROSA_CATALOG_CACHE', JSON.stringify(list));
                        }
                    }
                } catch (e) { console.warn("Error actualizando cache local:", e); }
            }
        }
    }, 1500); // 1.5 Segundos de espera
    
    setSaveTimeout(newTimeout);
  };

  const handleExport = () => {
    // v50.18: Formato Estandarizado de Exportación (Compatible con Importador Dual)
    const exportData = {
        catalog: products
    };
    
    const jsonString = JSON.stringify(exportData, null, 2); // Formato bonito con sangrías
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
    
    // Generar fecha para el nombre del archivo (Ej: RESPALDO_CATALOGO_2026-05-11.json)
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `RESPALDO_CATALOGO_${dateStr}.json`;

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
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
        const importedData = JSON.parse(event.target.result);
        const products = importedData.catalog || (Array.isArray(importedData) ? importedData : []);
        
        if (products.length === 0) {
            alert("❌ El archivo no contiene productos válidos.");
            return;
        }

        // v50.14: Open dedicated selection modal
        setImportData(importedData);
        setShowImportModal(true);
      } catch (err) {
        console.error("Error reading JSON:", err);
        alert("❌ El archivo seleccionado no es un JSON válido.");
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async (mode) => {
    if (!importData) return;
    
    const productsCount = (importData.catalog || importData).length;
    const confirmMsg = mode === 'clean' 
        ? `⚠️ ¿ESTÁS SEGURO? Se ELIMINARÁ TODO el catálogo actual y se cargarán ${productsCount} productos nuevos.`
        : `📦 ¿Confirmas que quieres ANEXAR ${productsCount} productos al catálogo actual?`;

    if (!window.confirm(confirmMsg)) return;

    setShowImportModal(false);
    setIsProcessing(true);
    if (onSyncingStatus) onSyncingStatus(true);
    setProgress(`Iniciando importación en modo ${mode.toUpperCase()}...`);

    // v80.0: MODO TURBO - Conversión de archivos en tiempo real
    const success = await importProductsFromJSON(importData, mode, (current, total, msg) => {
        setProgress(msg || `🚀 PROCESANDO: ${current} de ${total} (Casi listo...)`);
    });

    if (success) {
        setProgress('✅ ¡EXITOSO! Refrescando...');
        setTimeout(() => window.location.reload(), 1500);
    } else {
        alert("❌ Hubo un error durante la importación.");
        setIsProcessing(false);
        if (onSyncingStatus) onSyncingStatus(false);
        setProgress('');
    }
  };

  const handleExportCatalogExcel = () => {
    if (!products || products.length === 0) return alert('No hay productos en el catálogo para exportar.');
    
    const data = products.map(p => ({
        'ID (SKU)': p.sku || '',
        'NOMBRE PRODUCTO': p.name || '',
        'CATEGORÍA': p.category || '',
        'PRECIO MAYOR': parseInt(p.mayor) || 0,
        'PRECIO DETAL': parseInt(p.detal) || 0,
        'STOCK ACTUAL': (p.stock === null || p.stock === undefined || String(p.stock).trim() === '' || String(p.stock).toLowerCase() === 'infinito' || String(p.stock).toLowerCase() === 'infinity' || String(p.stock) === '♾️') ? '' : p.stock,
        'UBICACIÓN': p.location || p.ubicacion || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    
    ws['!cols'] = [
        { wch: 20 }, // ID (SKU)
        { wch: 35 }, // NOMBRE PRODUCTO
        { wch: 20 }, // CATEGORÍA
        { wch: 15 }, // PRECIO MAYOR
        { wch: 15 }, // PRECIO DETAL
        { wch: 15 }, // STOCK ACTUAL
        { wch: 15 }  // UBICACIÓN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    
    const today = new Date().toLocaleDateString('es-ES').replace(/\//g, '_');
    XLSX.writeFile(wb, `Zoho_Inventario_MundoRosa_${today}.xlsx`);
  };

  const handleImportCatalogExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
            alert("❌ El archivo Excel está vacío.");
            return;
        }

        const headers = Object.keys(jsonData[0]);
        const requiredColumns = ['NOMBRE PRODUCTO', 'PRECIO MAYOR', 'PRECIO DETAL'];
        const missing = requiredColumns.filter(c => !headers.includes(c));
        if (missing.length > 0) {
            alert(`❌ Al archivo le faltan columnas requeridas: ${missing.join(', ')}`);
            return;
        }

        const productsToImport = jsonData.map(row => {
            const stockVal = row['STOCK ACTUAL'];
            const stock = (stockVal === undefined || stockVal === null || String(stockVal).trim() === '' || String(stockVal).toLowerCase() === 'infinito' || String(stockVal).toLowerCase() === 'infinity' || String(stockVal) === '♾️') ? '' : parseInt(stockVal);
            
            return {
                sku: row['ID (SKU)'] || '',
                name: row['NOMBRE PRODUCTO'] || '',
                category: row['CATEGORÍA'] || 'Otros 🎁',
                mayor: parseInt(row['PRECIO MAYOR']) || 0,
                detal: parseInt(row['PRECIO DETAL']) || 0,
                stock: stock,
                location: row['UBICACIÓN'] || ''
            };
        });

        setExcelImportData(productsToImport);
        setShowExcelImportModal(true);
      } catch (err) {
        console.error(err);
        alert("❌ Error al leer el archivo Excel. Asegúrate de que sea un archivo válido.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const executeExcelImport = async (mode) => {
    if (!excelImportData) return;
    
    const productsCount = excelImportData.length;
    const confirmMsg = mode === 'clean' 
        ? `⚠️ ¿ESTÁS SEGURO? Se ELIMINARÁ TODO el catálogo actual y se cargarán ${productsCount} productos nuevos desde el Excel.`
        : `📦 ¿Confirmas que quieres COMBINAR / ACTUALIZAR ${productsCount} productos del Excel en el catálogo actual?\n\n(Se buscará coincidencia por SKU o nombre para actualizar datos y los nuevos se crearán).`;

    if (!window.confirm(confirmMsg)) return;

    setShowExcelImportModal(false);
    setIsProcessing(true);
    if (onSyncingStatus) onSyncingStatus(true);
    setProgress(`Sincronizando Excel en modo ${mode.toUpperCase()}...`);

    const success = await importProductsFromExcel(excelImportData, mode, (current, total, msg) => {
        setProgress(msg || `🚀 Sincronizando: ${current} de ${total}`);
    });

    if (success) {
        setProgress('✅ ¡SINCRO COMPLETA! Refrescando...');
        setTimeout(() => window.location.reload(), 1500);
    } else {
        alert("❌ Hubo un error durante la sincronización del Excel.");
        setIsProcessing(false);
        if (onSyncingStatus) onSyncingStatus(false);
        setProgress('');
      }
  };

  const handleMassReference = async () => {
    if (!targetCategory) return alert('📂 Selecciona primero una categoría.');
    
    const targetProducts = products.filter(p => p.category === targetCategory);
    if (targetProducts.length < 2) return alert('⚠️ No hay suficientes productos en esta categoría para comparar.');

    // 1. Agrupar duplicados por nombre exacto
    const nameGroups = {};
    targetProducts.forEach(p => {
      const name = p.name.trim().toLowerCase();
      if (!nameGroups[name]) nameGroups[name] = [];
      nameGroups[name].push(p);
    });

    const duplicateGroups = Object.values(nameGroups).filter(group => group.length > 1);
    if (duplicateGroups.length === 0) return alert('✨ No se encontraron nombres duplicados en esta categoría.');

    if (!confirm(`📦 Se procesarán ${duplicateGroups.length} grupos de productos repetidos. Se les asignará una referencia aleatoria (Ref. XYZ). ¿Continuar?`)) return;

    if (onSyncingStatus) onSyncingStatus(true);
    setIsProcessing(true);
    let totalUpdated = 0;

    try {
      const generateRandomSKU = () => 'Ref. ' + Math.random().toString(36).substring(2, 5).toUpperCase();

      for (const group of duplicateGroups) {
        setProgress(`🏷️ Referenciando: ${group[0].name}...`);
        for (const p of group) {
            const newName = `${p.name.trim()} ${generateRandomSKU()}`;
            const updated = { ...p, name: newName };
            await saveProduct(updated);
            totalUpdated++;
        }
      }
      alert(`✅ ¡Éxito! Se actualizaron ${totalUpdated} productos.`);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('❌ Error durante el procesamiento masivo.');
    } finally {
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
      
      // v50.5: Use clean customer name as ID to avoid PocketBase validation errors
      let finalCustomerId = customerName.trim().toUpperCase();

      const orderData = {
        code: orderCode,
        customerId: finalCustomerId, // El DNI que diferencia a los Pepitos
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

            {/* Herramienta de Referenciación Masiva (Reemplazo IA) */}
            <div style={{
              display: 'flex', gap: '5px', background: 'rgba(255,255,255,0.05)', 
              padding: '5px', borderRadius: '12px', border: '1px solid rgba(255, 105, 180, 0.3)'
            }}>
              <select 
                className="admin-select"
                style={{ width: '150px', fontSize: '0.75rem', margin: 0, height: '35px' }}
                value={targetCategory}
                onChange={e => setTargetCategory(e.target.value)}
              >
                <option value="">-- Seleccionar Cat. --</option>
                {[...new Set(products.map(p => p.category))].filter(Boolean).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button 
                className="btn-upload" 
                style={{background: '#10b981', height: '35px', padding: '0 10px', fontSize: '0.7rem'}} 
                onClick={handleMassReference}
              >
                🏷️ Referenciar Categoría
              </button>
            </div>
            <button className="btn-upload" style={{background: '#7c3aed'}} onClick={() => setShowVerify(!showVerify)}>
              🛡️ Verificar Cotización
            </button>
            <button className="btn-export" onClick={handleExport}>💾 Exportar catalogo.json</button>
            <label className="btn-import">
              📤 Importar Backup
              <input type="file" accept=".json" onChange={handleImport} hidden />
            </label>
            <button 
              className="btn-export" 
              style={{ background: 'linear-gradient(135deg, #107c41, #1f9a55)', color: '#fff', border: 'none' }} 
              onClick={handleExportCatalogExcel}
            >
              📊 Descargar Excel
            </button>
            <label 
              className="btn-import" 
              style={{ background: 'linear-gradient(135deg, #1f9a55, #107c41)', color: '#fff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              📥 Subir Excel (Inventario)
              <input type="file" accept=".xlsx, .xls" onChange={handleImportCatalogExcel} hidden />
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
              onClick={() => { setShowDomiciliosViewer(true); setDomiciliosPassword(''); setDomiciliosUnlocked(false); }}
              style={{
                background: 'linear-gradient(90deg, #0f172a, #1e3a5f)',
                color: '#ec4899',
                border: '1.5px solid #ec4899',
                borderRadius: '10px',
                padding: '8px 16px',
                fontWeight: 'bold',
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 10px rgba(236, 72, 153, 0.2)'
              }}
            >
              🛵 DOMICILIOS
            </button>
            <button 
              id="btn-agotados-v1"
              onClick={() => setShowVault(true)}
              style={{
                background: 'linear-gradient(90deg, #1e3a5f, #0f172a)',
                color: '#f59e0b',
                border: '2px solid #f59e0b',
                borderRadius: '10px',
                padding: '8px 16px',
                fontWeight: '900',
                fontSize: '0.8rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)'
              }}
            >
              🏛️ AGOTADOS (v1)
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
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    {abonosUnlocked && (
                        <>
                            <button 
                                onClick={handleExportPaymentsExcel}
                                style={{ background: '#10b981', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                📥 Exportar Excel
                            </button>
                            <button 
                                onClick={handleDeleteAllPayments}
                                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px', borderRadius: '8px', cursor: 'pointer' }}
                                title="Eliminar todo"
                            >
                                🗑️🧺
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowAbonosViewer(false)} style={{background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer'}}>✕</button>
                </div>
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
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    background: 'rgba(56, 189, 248, 0.05)', 
                    padding: '15px', 
                    borderRadius: '15px',
                    border: '1px solid rgba(56, 189, 248, 0.2)' 
                  }}>
                    <input 
                      type="text"
                      placeholder="🔍 Buscar abono (Cliente, Asesor, Valor...)"
                      value={abonosSearchTerm}
                      onChange={(e) => setAbonosSearchTerm(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#1e293b',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '10px',
                        padding: '10px 15px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxShadow: '0 0 10px rgba(56, 189, 248, 0.1)'
                      }}
                    />
                    <p style={{color: '#38bdf8', fontSize: '0.75rem', margin: 0, textAlign: 'center', fontWeight: 'bold'}}>
                      Total Acumulado: ${filteredPayments.reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                  {(!filteredPayments || filteredPayments.length === 0) ? (
                    <p style={{color: '#94a3b8', textAlign: 'center', padding: '20px'}}>No se encontraron abonos con ese criterio.</p>
                  ) : (
                    filteredPayments.map(p => (
                      <div key={p.id} style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        padding: '12px',
                        border: p.isChecked ? '2px solid #10b981' : '1px solid #334155',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        opacity: p.isChecked ? 0.7 : 1,
                        transition: 'all 0.3s ease'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                          <div style={{ flex: 1 }}>
                            <div style={{color: '#38bdf8', fontWeight: 'bold', fontSize: '0.85rem'}}>
                              {p.advisorName || 'Asesor no registrado'}
                            </div>
                            <div style={{color: '#fff', fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px'}}>
                              👤 {p.customerName}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                                <div style={{color: '#94a3b8', fontSize: '0.65rem'}}>
                                  📝 Reg: {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-CO') : 'S/R'}
                                </div>
                                <div style={{color: '#fbbf24', fontSize: '0.65rem'}}>
                                  💰 Consig: {(p.date || '').split('-').reverse().join('/') || 'S/F'}
                                </div>
                            </div>
                          </div>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                                <div style={{color: '#10b981', fontWeight: '900', fontSize: '1.2rem'}}>
                                    ${parseInt(p.amount || 0).toLocaleString('es-CO')}
                                </div>
                                {p.type?.includes('_modificado') && (
                                    <div style={{
                                        color: '#fbbf24', 
                                        fontSize: '0.6rem', 
                                        fontWeight: 'bold', 
                                        marginTop: '-2px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        background: 'rgba(251, 191, 36, 0.1)',
                                        padding: '1px 4px',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(251, 191, 36, 0.2)'
                                    }}>
                                        ⚠️ EDITADO
                                    </div>
                                )}
                            </div>
                            
                            {/* BOTÓN DE CHULEO v58.0 — PERSISTENCIA POR CAMUFLAJE DE TIPO */}
                            <button 
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    const targetId = p.id || p.globalId;
                                    if (!targetId) return;

                                    const currentType = p.type || 'abono';
                                    const isAlreadyChecked = currentType.includes('_revisado');
                                    
                                    // Si ya está revisado, no hacer nada (Sello Inmutable)
                                    if (isAlreadyChecked) return;
                                    
                                    const newType = `${currentType}_revisado`;
                                    
                                    // 1. CAMBIO VISUAL AL INSTANTE
                                    setLocalCheckedMap(prev => ({ ...prev, [targetId]: true }));

                                    // 2. Guardar en servidor usando el campo 'type' que sí existe
                                    try {
                                        await updatePayment(targetId, { type: newType });
                                    } catch (err) {
                                        console.error("Error persistiendo sello:", err);
                                    }
                                }}
                                style={{
                                    background: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? '#10b981' : 'rgba(148, 163, 184, 0.2)', 
                                    border: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? 'none' : '1.5px solid rgba(148, 163, 184, 0.3)', 
                                    color: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? '#fff' : '#94a3b8', 
                                    padding: '8px', 
                                    borderRadius: '8px', 
                                    cursor: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? 'default' : 'pointer', 
                                    fontSize: '1rem',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minWidth: '38px',
                                    boxShadow: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none',
                                    opacity: (p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? 0.9 : 1
                                }}
                                title={(p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? "Revisado (Permanente)" : "Marcar como revisado"}
                            >
                                {(p.type?.includes('_revisado') || localCheckedMap[p.id || p.globalId]) ? '✅' : '🔘'}
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
                          </div>
                        </div>
                        { (p.receiptImage || p.image) ? (
                          <div style={{ position: 'relative', marginTop: '10px' }}>
                            <img
                                src={p.receiptImage || p.image}
                                alt="Consignación"
                                style={{
                                    width: '100%', 
                                    maxHeight: '1000px', // v50.7: Mega Zoom para visualización total
                                    objectFit: 'contain',
                                    borderRadius: '16px', 
                                    border: '1px solid #475569',
                                    display: 'block',
                                    margin: '0 auto',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
                                }}
                                loading="lazy"
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

        {/* 🛵 DOMICILIOS VIEWER MODAL v1.0 */}
        {showDomiciliosViewer && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: '20px',
              border: '1px solid #ec4899',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '25px',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{color: '#ec4899', margin: 0, fontSize: '1rem'}}>🛵 REGISTRO DE DOMICILIOS</h3>
                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                    {domiciliosUnlocked && (
                        <>
                            <button 
                                onClick={() => {
                                    const handleCopyToWhatsApp = () => {
                                        if (!allDomicilios || allDomicilios.length === 0) return;
                                        let text = "🛵 *REPORTE DE DOMICILIOS - MUNDO ROSA* 🎀\n------------------------------------------\n\n";
                                        allDomicilios.forEach((d, index) => {
                                            text += `*${index + 1}. CLIENTE:* ${d.customerName.toUpperCase()}\n`;
                                            text += `💰 *MONTO:* $${(parseInt(d.amount) || 0).toLocaleString('es-CO')}\n`;
                                            text += `👤 *ASESOR:* ${d.advisorName}\n------------------------------------------\n`;
                                        });
                                        const total = allDomicilios.reduce((acc, d) => acc + (parseInt(d.amount) || 0), 0);
                                        text += `\n💵 *TOTAL RECAUDO: $${total.toLocaleString('es-CO')}*\n✅ _Reporte generado automáticamente_`;
                                        navigator.clipboard.writeText(text);
                                        alert("✅ Reporte copiado al portapapeles. ¡Ya puedes pegarlo en WhatsApp!");
                                    };
                                    handleCopyToWhatsApp();
                                }}
                                style={{ background: '#25D366', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                📲 WhatsApp
                            </button>
                            <button 
                                onClick={handleExportDomiciliosExcel}
                                style={{ background: '#ec4899', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                📥 Exportar Excel
                            </button>
                            <button 
                                onClick={handleDeleteAllDomicilios}
                                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '5px', borderRadius: '8px', cursor: 'pointer' }}
                                title="Vaciado Total"
                            >
                                🗑️🧺
                            </button>
                        </>
                    )}
                    <button onClick={() => setShowDomiciliosViewer(false)} style={{background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer'}}>✕</button>
                </div>
              </div>

              {!domiciliosUnlocked ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', padding: '20px 0'}}>
                  <span style={{fontSize: '2rem'}}>🔐</span>
                  <p style={{color: '#94a3b8', textAlign: 'center', fontSize: '0.85rem', margin: 0}}>Ingresa la clave de acceso para consultar los domicilios.</p>
                  <input
                    type="password"
                    placeholder="Clave de acceso"
                    value={domiciliosPassword}
                    maxLength={4}
                    onChange={(e) => setDomiciliosPassword(e.target.value)}
                    style={{
                      background: '#1e293b', border: '1px solid #334155', borderRadius: '10px',
                      padding: '10px 15px', color: '#fff', fontSize: '1.2rem',
                      letterSpacing: '5px', textAlign: 'center', width: '150px'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (domiciliosPassword === '4399') setDomiciliosUnlocked(true);
                      else { alert('❌ Clave incorrecta.'); setDomiciliosPassword(''); }
                    }}
                    style={{
                      background: '#ec4899', color: '#fff', border: 'none',
                      borderRadius: '10px', padding: '10px 25px', fontWeight: 'bold', cursor: 'pointer'
                    }}
                  >
                    Ingresar
                  </button>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                   <div style={{ background: 'rgba(236, 72, 153, 0.1)', padding: '10px', borderRadius: '10px', border: '1px dashed #ec4899' }}>
                    <p style={{color: '#ec4899', fontSize: '0.75rem', margin: 0, textAlign: 'center', fontWeight: 'bold'}}>
                      Total Domicilios: ${allDomicilios.reduce((acc, d) => acc + (parseInt(d.amount) || 0), 0).toLocaleString('es-CO')}
                    </p>
                  </div>
                  {(!allDomicilios || allDomicilios.length === 0) ? (
                    <p style={{color: '#94a3b8', textAlign: 'center'}}>No hay domicilios registrados todavía.</p>
                  ) : (
                    [...allDomicilios].map(d => (
                      <div key={d.id} style={{
                        background: '#1e293b',
                        borderRadius: '12px',
                        padding: '12px',
                        border: '1px solid #334155',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{color: '#ec4899', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase'}}>
                            👤 Cliente: {d.customerName}
                          </div>
                          <div style={{color: '#fff', fontSize: '0.75rem', marginTop: '2px'}}>
                            Asesor: {d.advisorName}
                          </div>
                          <div style={{color: '#94a3b8', fontSize: '0.6rem', marginTop: '4px'}}>
                            📅 {d.createdAt ? new Date(d.createdAt).toLocaleString('es-CO') : 'S/R'}
                          </div>
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                           <div style={{color: '#10b981', fontWeight: '900', fontSize: '1.1rem'}}>
                              ${parseInt(d.amount || 0).toLocaleString('es-CO')}
                           </div>
                           <button 
                               onClick={() => handleDeleteSingleDomicilio(d.id)}
                               style={{background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', padding: '6px', borderRadius: '6px', cursor: 'pointer'}}
                               title="Eliminar"
                           >
                             🗑️
                           </button>
                        </div>
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

            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" placeholder="P. Mayor $" value={newMayor} onChange={e => setNewMayor(e.target.value)} required />
              <input type="number" placeholder="P. Detal $" value={newDetal} onChange={e => setNewDetal(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="number" placeholder="Stock Inicial" value={newStock} onChange={e => setNewStock(e.target.value)} />
              <input type="text" placeholder="Ubicación (Pasillo, estante...)" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
            </div>
            
            {/* Selector de imagen con vista previa */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(236,72,153,0.5)',
                borderRadius: '12px', padding: '12px 16px', cursor: 'pointer',
                color: '#ec4899', fontWeight: 'bold', fontSize: '0.85rem'
              }}>
                📷 {newImage ? `✅ ${newImage.name}` : 'Seleccionar Imagen...'}
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => { setNewImage(e.target.files[0]); }} 
                  hidden 
                  required 
                />
              </label>

              {/* Vista previa de imagen seleccionada */}
              {newImage && (
                <div style={{ textAlign: 'center' }}>
                  <img
                    src={URL.createObjectURL(newImage)}
                    alt="Vista previa"
                    style={{
                      maxHeight: '140px', maxWidth: '100%',
                      borderRadius: '10px', border: '1px solid rgba(236,72,153,0.4)',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )}
            </div>


            <button type="submit" className="btn-success">
              ⬆️ Subir y Añadir al Catálogo
            </button>
            <button type="button" className="btn-delete" style={{marginTop: '10px'}} onClick={resetForm}>Limpiar Formulario</button>
          </form>
        )}

        {showImportModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '500px', textAlign: 'center'}}>
              <h2 style={{color: '#f43f5e'}}>📥 Opciones de Importación</h2>
              <p style={{marginBottom: '20px', color: '#94a3b8'}}>Has seleccionado un archivo de catálogo. ¿Cómo deseas proceder?</p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                <button 
                  className="btn-primary" 
                  style={{padding: '15px', fontSize: '1rem', background: 'linear-gradient(90deg, #3b82f6, #2563eb)'}}
                  onClick={() => executeImport('append')}
                >
                  📦 ANEXAR AL CATÁLOGO<br/>
                  <small style={{opacity: 0.8, fontSize: '0.7rem'}}>(Mantiene lo actual y suma lo nuevo)</small>
                </button>
                
                <button 
                  className="btn-primary" 
                  style={{padding: '15px', fontSize: '1rem', background: 'linear-gradient(90deg, #ef4444, #dc2626)'}}
                  onClick={() => executeImport('clean')}
                >
                  🧹 INGRESO LIMPIO<br/>
                  <small style={{opacity: 0.8, fontSize: '0.7rem'}}>(BORRA TODO y carga desde cero)</small>
                </button>
                
                <button 
                  className="btn-cancel" 
                  style={{marginTop: '10px'}}
                  onClick={() => setShowImportModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showExcelImportModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '500px', textAlign: 'center'}}>
              <h2 style={{color: '#107c41'}}>📊 Importar Inventario desde Excel</h2>
              <p style={{marginBottom: '20px', color: '#94a3b8'}}>Has cargado un archivo de inventario en Excel con {excelImportData ? excelImportData.length : 0} productos. ¿Cómo deseas proceder?</p>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                <button 
                  className="btn-primary" 
                  style={{padding: '15px', fontSize: '1rem', background: 'linear-gradient(90deg, #107c41, #1f9a55)'}}
                  onClick={() => executeExcelImport('upsert')}
                >
                  🔄 COMBINAR Y ACTUALIZAR<br/>
                  <small style={{opacity: 0.8, fontSize: '0.7rem'}}>(Actualiza precios/stock de los existentes por SKU, y crea nuevos si no existen)</small>
                </button>
                
                <button 
                  className="btn-primary" 
                  style={{padding: '15px', fontSize: '1rem', background: 'linear-gradient(90deg, #ef4444, #dc2626)'}}
                  onClick={() => executeExcelImport('clean')}
                >
                  🧹 INGRESO LIMPIO<br/>
                  <small style={{opacity: 0.8, fontSize: '0.7rem'}}>(BORRA TODO el catálogo y carga el Excel como inventario fresco)</small>
                </button>
                
                <button 
                  className="btn-cancel" 
                  style={{marginTop: '10px'}}
                  onClick={() => setShowExcelImportModal(false)}
                >
                  Cancelar
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
                  
                  <div className="search-select-container" ref={customerDropdownRef}>
                    <div 
                      className="search-select-trigger"
                      onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                    >
                      <span>
                        {isNewCustomer ? "✍️ NUEVO CLIENTE" : (customerName || "--- Seleccionar de Bodega ---")}
                      </span>
                      <span>{isCustomerDropdownOpen ? '▲' : '▼'}</span>
                    </div>

                    {isCustomerDropdownOpen && (
                      <div className="search-select-dropdown">
                        <div className="search-select-search-bar">
                          <input 
                            type="text" 
                            placeholder="🔍 Buscar cliente..." 
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="search-select-options">
                          {activeCustomers
                            .filter(c => c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                            .map(c => (
                              <div 
                                key={c.name} 
                                className={`option-item ${customerName === c.name ? 'selected' : ''}`}
                                onClick={() => {
                                  setCustomerName(c.name);
                                  setSelectedCustomerId(c.id);
                                  setIsNewCustomer(false);
                                  setIsCustomerDropdownOpen(false);
                                  setCustomerSearchQuery('');
                                }}
                              >
                                {c.name}
                              </div>
                            ))
                          }
                          
                          <div 
                            className="option-item new-user"
                            onClick={() => {
                              setIsNewCustomer(true);
                              setCustomerName("");
                              setSelectedCustomerId(null);
                              setIsCustomerDropdownOpen(false);
                              setCustomerSearchQuery('');
                            }}
                          >
                            ✍️ CREAR NUEVO CLIENTE
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
                <th>Stock</th>
                <th>Ubicación</th>
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
          <p className="hint">⚡ Los cambios se guardan instantáneamente en la nube (PocketBase) para todos tus clientes.</p>
          <button className="btn-apply" onClick={onClose}>
            Cerrar Panel
          </button>
        </div>
        {/* 🏛️ BÓVEDA DE AGOTADOS MODAL v1.0 */}
        {showVault && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: '24px',
              border: '2px solid #f59e0b',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '25px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              position: 'relative',
              boxShadow: '0 0 50px rgba(245, 158, 11, 0.2)'
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                  <h2 style={{color: '#f59e0b', margin: 0, fontSize: '1.4rem'}}>🏛️ BÓVEDA DE AGOTADOS</h2>
                  <p style={{color: '#94a3b8', fontSize: '0.8rem', margin: 0}}>Productos eliminados del catálogo</p>
                </div>
                <div style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                  <div style={{position: 'relative', width: '250px'}}>
                    <input 
                      type="text" 
                      placeholder="Buscar en boveda..." 
                      value={vaultSearchTerm}
                      onChange={(e) => setVaultSearchTerm(e.target.value)}
                      style={{
                        width: '100%', padding: '10px 15px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid #334155',
                        color: '#fff', fontSize: '0.85rem', outline: 'none'
                      }}
                    />
                    <span style={{position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5}}>🔍</span>
                  </div>
                  <button
                    onClick={handleDeleteAllFromVault}
                    title="Vaciar bóveda completamente"
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444',
                      color: '#ef4444', borderRadius: '10px', padding: '8px 14px',
                      fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🗑️ Vaciar Bóveda
                  </button>
                  <button 
                    onClick={() => setShowVault(false)}
                    style={{background: '#1e293b', border: 'none', color: '#fff', fontSize: '1.5rem', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer'}}
                  >
                    &times;
                  </button>
                </div>
              </div>

              {isVaultLoading ? (
                <div style={{textAlign: 'center', padding: '50px'}}>
                  <div className="spinner" style={{margin: '0 auto 15px'}}></div>
                  <p style={{color: '#94a3b8'}}>Consultando boveda...</p>
                </div>
              ) : vaultProducts.length === 0 ? (
                <div style={{textAlign: 'center', padding: '100px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed #334155'}}>
                  <div style={{fontSize: '3rem', marginBottom: '15px'}}> Desert 🌵</div>
                  <h3 style={{color: '#fff', margin: '0 0 10px'}}>La bóveda está vacía</h3>
                  <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>Los productos que elimines del catálogo aparecerán aquí.</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '15px'
                }}>
                  {vaultProducts.filter(p => {
                    const term = vaultSearchTerm.toLowerCase();
                    return (p.name || "").toLowerCase().includes(term) || 
                           (p.category || "").toLowerCase().includes(term);
                  }).map(item => (
                    <div key={item.id} style={{
                      background: '#1e293b',
                      borderRadius: '16px',
                      padding: '12px',
                      border: '1px solid #334155',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'transform 0.2s'
                    }}>
                      <div style={{position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '10px', overflow: 'hidden'}}>
                        <img 
                          src={item.image} 
                          alt="" 
                          style={{width: '100%', height: '100%', objectFit: 'cover'}}
                        />
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'rgba(0,0,0,0.7)', padding: '4px', fontSize: '0.65rem',
                          color: '#fff', textAlign: 'center'
                        }}>
                          📅 {new Date(item.soldOutAt || item.created).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div style={{flex: 1}}>
                        <div style={{color: '#fff', fontWeight: 'bold', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                          {item.name}
                        </div>
                        <div style={{color: '#94a3b8', fontSize: '0.7rem'}}>{item.category}</div>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '5px'}}>
                           <span style={{color: '#10b981', fontWeight: 'bold', fontSize: '0.8rem'}}>${parseInt(item.mayor).toLocaleString()}</span>
                           <span style={{color: '#38bdf8', fontSize: '0.75rem'}}>SKU: {item.sku || '---'}</span>
                        </div>
                      </div>

                      <div style={{display: 'flex', gap: '8px'}}>
                        <button 
                          onClick={() => handleRestoreFromVault(item)}
                          style={{
                            flex: 2, background: '#f59e0b', color: '#000', border: 'none', 
                            borderRadius: '8px', padding: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem'
                          }}
                        >
                          ♻️ Restaurar
                        </button>
                        <button 
                          onClick={() => handleDeleteFromVault(item.id)}
                          style={{
                            flex: 1, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', 
                            borderRadius: '8px', padding: '8px', cursor: 'pointer', fontSize: '0.75rem'
                          }}
                          title="Eliminar permanentemente"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
