import React, { useState, useEffect, useRef } from 'react';
import { onOrdersUpdate, deleteOrder, addPayment, onCustomerPaymentsUpdate, deletePayment, deletePaymentAndHistory, purgeCustomerData, updateOrder, deleteProduct, compressImage, toBase64, renameCustomer, ADVISOR_CODES, updateOrderAbono, deleteOrderAbono, startCustomerTimer, onTimersUpdate, deleteCustomerTimer, deleteProductGlobalAtomic, getCustomerNote, saveCustomerNote, sendToPrintQueue, updatePayment, addCODPayment, onCODPaymentsUpdate, deductProductStock, restoreProductStock } from '../utils/db';
import { useOrderTimers } from './Orders/useOrderTimers';
import { useOrderFinance } from './Orders/useOrderFinance';
import { OrderForms } from './Orders/OrderForms';
import { CustomerSelector } from './Orders/CustomerSelector';
import { CustomerBatches } from './Orders/CustomerBatches';

function OrderQueue({ isOpen, onClose, formatCurrency, catalog, orders, allPayments }) {
  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  
  // v20.6: Normalization helper at top to avoid uninitialized access
  const normalizeText = (text) => {
    if (!text) return "";
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAlerts, setFilterAlerts] = useState(false);
  const [showOrdersList, setShowOrdersList] = useState(false);
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  
  // ADD PRODUCT v14.0 states
  const [itemSearchText, setItemSearchText] = useState("");
  const [activeSearchOrderId, setActiveSearchOrderId] = useState(null);

   // NEW Local Edit State v2.10
   const [editingLocalAbono, setEditingLocalAbono] = useState(null); // { orderId, index, amount }
   const [localEditAmount, setLocalEditAmount] = useState('');
   const [localEditDate, setLocalEditDate] = useState('');

   // ESCUCHADOR DE DOMICILIOS EN TIEMPO REAL
   const [allDomicilios, setAllDomicilios] = useState([]);
   useEffect(() => {
       const unsub = onCODPaymentsUpdate((data) => setAllDomicilios(data));
       return () => { if (unsub && typeof unsub === 'function') unsub(); };
   }, []);

  const parseDate = (d) => {
      if (!d) return new Date();
      if (d.toDate) return d.toDate();
      if (d.seconds) return new Date(d.seconds * 1000);
      return new Date(d);
  };

  const customerOrders = (orders || [])
      .filter(o => getBaseName(o.code) === selectedCustomerName)
      .sort((a, b) => {
          const da = a.createdAt ? parseDate(a.createdAt) : new Date(a.created || 0);
          const db = b.createdAt ? parseDate(b.createdAt) : new Date(b.created || 0);
          return da - db;
      });

   const {
      showAbonoForm, setShowAbonoForm,
      showDomicilioForm, setShowDomicilioForm,
      showSaldoFavorForm, setShowSaldoFavorForm,
      newAbonoAmount, setNewAbonoAmount,
      newDomicilioAmount, setNewDomicilioAmount,
      newAbonoDate, setNewAbonoDate,
      domicilioAdvisorCode, setDomicilioAdvisorCode,
      domicilioAdvisorName,
      advisorCode, setAdvisorCode,
      advisorName,
      receiptImage, setReceiptImage,
      saldoFavorAmount, setSaldoFavorAmount,
      saldoFavorCode, setSaldoFavorCode,
      saldoFavorAdvisorName,
      advisorAuthCode, setAdvisorAuthCode,
      authModalConfig, setAuthModalConfig,

      handleRegisterDomicilio,
      handleRegisterGlobalAbono,
      handleEditPaymentAmount,
      handleEditPaymentDate,
      handleConfirmAuth,
      handleRegisterSaldoFavor,
      handleReceiptFileChange,
      handlePasteReceipt
   } = useOrderFinance({
      selectedCustomerName,
      customerOrders,
      orders,
      allPayments,
      isUpdating,
      setIsUpdating,
      executeConsolidatedCopy
   });

   // TIMERS v2.15 (EXTRACTED TO HOOK)
   const {
       activeTimers,
       showTimersPanel,
       setShowTimersPanel,
       timerTick,
       handleStartTimer
   } = useOrderTimers(selectedCustomerName);

   // Financial Modal states extracted to hook

   // Rename Customer Feature v2
   const [isEditingName, setIsEditingName] = useState(false);
   const [tempName, setTempName] = useState('');
   const [justRenamedFrom, setJustRenamedFrom] = useState(null); // Instant UI Patch
   
   // Customer Notes v5.0
   const [customerNote, setCustomerNote] = useState(null);
   useEffect(() => {
     if (!selectedCustomerName) {
         setCustomerNote(null);
         return;
     }
     const fetchNote = async () => {
         const note = await getCustomerNote(selectedCustomerName);
         setCustomerNote(note);
     };
     fetchNote();
   }, [selectedCustomerName]);

   // SHIPPING MODAL v24.0
   const [showPrintModal, setShowPrintModal] = useState(false);
   const [shippingForm, setShippingForm] = useState({
       name: '',
       cedula: '',
       phone: '',
       city: '',
       department: '',
       address: '',
       valor: ''
   });


  const handleEditNote = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!selectedCustomerName) return;
    const currentNote = customerNote || '';
    const newNote = prompt(`Escribe la nota para ${selectedCustomerName}:`, currentNote);
    if (newNote === null) return;
    setIsUpdating(true);
    await saveCustomerNote(selectedCustomerName, newNote);
    setCustomerNote(newNote.trim() === '' ? null : newNote.trim());
    setIsUpdating(false);
  };

  // v5.10: DELETE FULL ORDER (Single Batch Only)
  const handleDeleteFullOrder = async (orderId, orderCode) => {
    if (window.confirm(`\u26a0\ufe0f ADVERTENCIA: \u00bfEst\u00e1s seguro de eliminar TODO el pedido "${orderCode}"? \n\nEsta acci\u00f3n eliminar\u00e1 todos los art\u00edculos de esta tanda y es irreversible.`)) {
      setIsUpdating(true);
      // Guardar cliente actual en memoria antes de refrescar
      if (selectedCustomerName) localStorage.setItem('lastSelectedCustomer', selectedCustomerName);
      
      // v7.3: Forzar reapertura igual que en artículos
      localStorage.setItem('MUNDOROSA_REOPEN_WAREHOUSE', 'true');
      
      await deleteOrder(orderId, orderCode);
      
      // Delay de seguridad para persistencia
      setTimeout(() => {
          window.location.reload();
      }, 800);
    }
  };

  const handleReadNote = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (customerNote) {
        alert(`🗒️ NOTA DE ${selectedCustomerName}:\n\n${customerNote}`);
    } else {
        alert(`No hay notas guardadas para ${selectedCustomerName}`);
    }
  };

  const receiptInputRef = useRef(null);

  function getBaseName(code) {
    let name = (code || "").split(' (SEPARADO #')[0].trim().toUpperCase();
    if (name.startsWith('ALM_')) name = name.substring(4);
    return name;
  }

  useEffect(() => {
    if (!isOpen || !orders) return;
    
    // Auto-select first unique customer name if nothing selected OR if selected was purged
    const uniqueInCurrent = Array.from(new Set(orders.map(o => getBaseName(o.code))));
    setSelectedCustomerName(prev => {
        // 1. Priorizar selección activa si aún es válida en la lista actual
        if (prev && uniqueInCurrent.includes(prev)) return prev;

        // 2. Si no hay selección (carga inicial) o el cliente ya no existe, buscar en memoria local
        const saved = localStorage.getItem('lastSelectedCustomer');
        if (saved && uniqueInCurrent.includes(saved)) return saved;
        
        // 3. Fallback: seleccionar el primero disponible
        return uniqueInCurrent.length > 0 ? uniqueInCurrent[0] : null;
    });
  }, [isOpen, orders]);

  // v28.0: AUTO-RECALCULATE REPAIR SYSTEM
  // If the current selected customer has orders with mismatched totals, fix them silently.
  useEffect(() => {
    if (!selectedCustomerName || !orders || isUpdating) return;
    
    const myOrders = orders.filter(o => getBaseName(o.code) === selectedCustomerName);
    
    const fixOrders = async () => {
        for (const order of myOrders) {
            const realTotal = (order.items || []).reduce((acc, it) => acc + (Number(it.qty || 0) * getItemPrice(it, order)), 0);
            if (Math.abs(realTotal - (order.total || 0)) > 1) {
                console.warn(`🛠️ Reparando total de pedido ${order.code}: DB ${order.total} -> Real ${realTotal}`);
                await updateOrder(order.id, { total: realTotal });
            }
        }
    };
    
    fixOrders();
  }, [selectedCustomerName, orders?.length]);

  // Derived Payments for selected customer (v22.0: Filtro de canal único — excluye duplicados del almacén)
  const customerPayments = (allPayments || []).filter(p => {
       if (p.type?.startsWith('almacen_local_record')) return false; // ← Excluir registros del almacén para no duplicar
      const pName = normalizeText(p.customerName || "");
      const sName = normalizeText(selectedCustomerName || "");
      return pName !== "" && pName === sName;
  });

  const getAlertStatus = (cOrders, cPayments) => {
    if (!cOrders || cOrders.length === 0) return 'normal';
    const now = new Date();
    

    const hasAbonos = cOrders.some(o => (o.abono > 0) || (o.abonoHistory && o.abonoHistory.length > 0)) || (cPayments && cPayments.length > 0);
    
    let referenceDate;
    if (hasAbonos) {
        // Logic: FIRST Abono (Immutable)
        let firstAbono = null;
        cOrders.forEach(o => {
            if (o.paymentDate) {
                const d = new Date(o.paymentDate);
                if (!isNaN(d.getTime())) {
                    if (firstAbono === null || d < firstAbono) firstAbono = d;
                }
            }
            (o.abonoHistory || []).forEach(ah => {
                const d = new Date(ah.date);
                if (!isNaN(d.getTime())) {
                    if (firstAbono === null || d < firstAbono) firstAbono = d;
                }
            });
        });
        (cPayments || []).forEach(p => {
            const d = new Date(p.date);
            if (!isNaN(d.getTime())) {
                if (firstAbono === null || d < firstAbono) firstAbono = d;
            }
        });
        referenceDate = firstAbono === null ? parseDate(cOrders[0].createdAt) : firstAbono;
    } else {
        // Logic: FIRST Order
        let oldestOrder = now;
        cOrders.forEach(o => {
            const d = parseDate(o.createdAt);
            if (d < oldestOrder) oldestOrder = d;
        });
        referenceDate = oldestOrder;
    }

    const diffDays = Math.floor((now - referenceDate) / (1000 * 60 * 60 * 24));
    
    if (hasAbonos) {
        if (diffDays === 9) return 'orange';
        if (diffDays >= 10) {
            // Grace period: Day 10 before 9:00 AM is still orange
            if (diffDays === 10 && now.getHours() < 9) return 'orange';
            return 'red';
        }
    } else {
        if (diffDays === 12) return 'orange';
        if (diffDays === 13) return 'red';
        if (diffDays >= 14) return 'purged'; 
    }
    return 'normal';
  };


  // Grouped unique customer names for the dropdown (FILTERED)
  const uniqueCustomerNames = Array.from(new Set(orders.map(o => getBaseName(o.code))))
    .filter(name => {
        // Instant UI Patch: Hide the old name immediately after renaming
        if (name === justRenamedFrom) return false;
        
        const term = normalizeText(searchTerm);
        if (!term) {
            if (filterAlerts) {
                const customerOrders = orders.filter(o => getBaseName(o.code) === name);
                const status = getAlertStatus(customerOrders);
                return status === 'red' || status === 'orange';
            }
            return true;
        }

        // v4.9: Universal Search (matches name OR category/product inside their orders)
        const matchesName = normalizeText(name).includes(term);
        
        // Deep search in orders of this customer
        const customerOrders = orders.filter(o => getBaseName(o.code) === name);
        const matchesInside = customerOrders.some(order => 
            (order.items || []).some(it => normalizeText(it.name).includes(term) || normalizeText(it.category).includes(term))
        );

        const matchesSearch = matchesName || matchesInside;

        if (filterAlerts) {
            const status = getAlertStatus(customerOrders);
            return matchesSearch && (status === 'red' || status === 'orange');
        }
        return matchesSearch;
    });

  // All orders for the selected customer already declared above

  // Helper to get total abonos (handles legacy on-order abonos + global payments)
  const getTotals = () => {
    const totalOrders = customerOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    
    // 1. Collect potential payments (ONLY FROM WAREHOUSE ORDERS v49.0)
    const rawPayments = [];
    
    // Standard and History abonos inside orders (The only source for Warehouse)
    customerOrders.forEach(o => {
        if (o.abono > 0) rawPayments.push({ 
            amount: o.abono, 
            date: o.paymentDate, 
            id: `legacy-${o.id}`,
            advisorName: o.advisorName || 'Sist.' 
        });
        if (o.abonoHistory) o.abonoHistory.forEach((ah, idx) => {
            rawPayments.push({ 
                amount: ah.amount, 
                date: ah.date, 
                id: `hist-${o.id}-${idx}`,
                globalId: ah.globalId, 
                advisorName: ah.advisorName,
                type: ah.type,
                isModified: ah.isModified || ah.type?.includes('_modificado')
            });
        });
    });

    // 2. Deduplicate (Ultra-Precision v20.0)
    const uniquePayments = [];
    const seenGlobalIds = new Set();
    const seenLegacyKeys = new Set();
    
    // Pass 1: Global Payments (The most reliable source)
    rawPayments.filter(p => p.globalId && !p.id.startsWith('hist-')).forEach(p => {
        uniquePayments.push(p);
        seenGlobalIds.add(p.globalId);
    });

    // Pass 2: Legacy/History (Only if not already included as Global)
    rawPayments.filter(p => p.id.startsWith('legacy-') || p.id.startsWith('hist-')).forEach(p => {
        if (p.globalId && seenGlobalIds.has(p.globalId)) return;
        
        // Secondary safety: amount + date + advisor
        const legacyKey = `${p.amount}_${p.date}_${p.advisorName}`;
        if (!seenLegacyKeys.has(legacyKey)) {
            uniquePayments.push(p);
            seenLegacyKeys.add(legacyKey);
        }
    });

    // Final sorting: Newest first
    uniquePayments.sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        if (dateB - dateA !== 0) return dateB - dateA;
        // Fallback to ID sorting to keep order stable
        return (b.id || "").localeCompare(a.id || "");
    });

    const totalPaid = totalOrders > 0 
        ? uniquePayments.reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0)
        : 0;
    
    return {
      total: totalOrders,
      abonos: totalPaid,
      saldo: totalOrders - totalPaid,
      items: totalOrders > 0 ? uniquePayments : [] // Solo mostrar abonos en el historial si hay pedidos
    };
  };

  const consolidated = getTotals();

  // FINANCIAL ACTION HANDLERS EXTRACTED TO useOrderFinance HOOK

  const handleCopyConsolidatedSummary = () => {
    if (!selectedCustomerName || (customerOrders.length === 0 && customerPayments.length === 0)) return;
    setAdvisorAuthCode(''); // Reset
    setAuthModalConfig({
        isOpen: true,
        actionType: 'copy',
        data: null,
        title: '🔒 Copiar Estado de Cuenta',
        description: 'Ingresa tu código para generar el resumen de WhatsApp.'
    });
  };

  function executeConsolidatedCopy(code) {
    const resolvedAdvisor = ADVISOR_CODES[code.trim()];
    if (!resolvedAdvisor) {
        alert("❌ Código de asesor inválido. Verifica e intenta de nuevo.");
        return;
    }

    // Parser robusto de fechas (soporta PocketBase string y Firebase legacy)
    const parseDate = (dateVal) => {
        if (!dateVal) return new Date(0);
        if (typeof dateVal === 'string') return new Date(dateVal);
        if (dateVal.toDate) return dateVal.toDate();
        if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
        return new Date(dateVal);
    };

    // DETERMINAR ESTADO DEL MENSAJE (v16.6 Inteligente)
    const isVentaRealizada = consolidated.saldo <= 0;
    const isCotizacion = !isVentaRealizada && consolidated.abonos === 0;

    // Determinar la fecha de inicio según el estado del carrito
    let startDate = 'S/F';
    
    if (isVentaRealizada) {
        // 3. VENTA REALIZADA: Fecha actualizada del sistema (hoy)
        startDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } else if (!isCotizacion && consolidated.items?.length > 0) {
        // 2. SEPARADO: Fecha de la primera consignación/abono
        const earliestPayment = [...consolidated.items].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))[0];
        startDate = earliestPayment?.date ? earliestPayment.date.split('-').reverse().join('/') : 'S/F';
    } else {
        // 1. COTIZACIÓN: Fecha de ingreso del primer pedido
        const earliestOrder = [...customerOrders].sort((a, b) => {
            return parseDate(a.createdAt) - parseDate(b.createdAt);
        })[0];
        startDate = earliestOrder?.createdAt 
            ? parseDate(earliestOrder.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'S/F';
    }

    // Consolidated items text
    let itemsText = "";
    customerOrders.forEach(order => {
        order.items.forEach(item => {
            const price = getItemPrice(item, order);
            itemsText += `*${item.qty}x*  ${item.name} (${formatCurrency(price)} c/u)\n   💰 Subtotal: ${formatCurrency(item.qty * price)}\n`;
        });
    });

    // Payments list (using deduplicated from getTotals)
    let paymentsText = "";
    [...(consolidated.items || [])].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(a => {
        const dateStr = a.date ? a.date.split('-').reverse().join('/') : 'S/F';
        const typeLabel = a.type === 'Saldo a Favor' ? ' (Saldo a favor)' : '';
        const modLabel = (a.isModified || a.type?.includes('_modificado')) ? ' (MODIFICADO)' : '';
        paymentsText += `📅 Fecha: ${dateStr}: ${formatCurrency(a.amount)}${typeLabel}${modLabel}\n`;
    });

    // Títulos y etiquetas dinámicas
    let headerEmoji = "📋";
    let headerTitle = "ESTADO DE CUENTA CONSOLIDADO";
    let dateLabel = "Inicio pedido";
    let totalLabel = "TOTAL DE ESTE SEPARADO";

    if (isCotizacion) {
        headerTitle = "COTIZACIÓN";
        dateLabel = "Cotización";
        totalLabel = "TOTAL DE ESTA COTIZACIÓN";
    } else if (isVentaRealizada) {
        headerEmoji = "✅";
        headerTitle = "VENTA REALIZADA";
        dateLabel = "Fecha de venta";
        totalLabel = "TOTAL DE ESTA VENTA";
    } else {
        headerTitle = "ESTADO DE CUENTA SEPARADO";
        dateLabel = "Inicio de separado";
        totalLabel = "TOTAL DE ESTE SEPARADO";
    }

    // Build Final Text
    let summaryText = `${headerEmoji} *${headerTitle}* ${headerEmoji}\n`;
    summaryText += `----------------------------------\n`;
    summaryText += `👤 Cliente: *${selectedCustomerName}*\n`;
    summaryText += `👩‍⚕️ Asesor: *${resolvedAdvisor}*\n\n`;
    summaryText += `*${dateLabel}: ${startDate}*\n`;
    summaryText += itemsText;
    summaryText += `----------------------------------\n`;
    summaryText += `💰 *${totalLabel}: ${formatCurrency(consolidated.total)}*\n\n`;

    // Solo mostrar abonos y resta si NO es una cotización
    if (!isCotizacion) {
        summaryText += `💵 *ABONOS*\n`;
        summaryText += paymentsText;
        summaryText += `💰 *TOTAL ABONOS: ${formatCurrency(consolidated.abonos)}*\n\n`;
        summaryText += `💰 *RESTA: ${formatCurrency(consolidated.saldo)}*\n`;
    }

    summaryText += `✅ Mundo Rosa agradece tu preferencia.`;

    navigator.clipboard.writeText(summaryText).then(() => {
      alert("✅ ¡Estado de cuenta consolidado copiado! Ya puedes pegarlo en WhatsApp.");
      setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
      setAdvisorAuthCode('');
    });
  };

  // Helper to get unit price of an item (with fallback for legacy orders)
  const getItemPrice = (item, order) => {
    // 1. If stored in item (New version v13.0+)
    if (item.unitPrice) return Number(item.unitPrice) || 0;
    
    // 2. Fallback to catalog (Normalized search v28.0)
    const norm = (t) => (t || "").toLowerCase().trim();
    const catalogProduct = (catalog || []).find(p => 
        p.id === item.id || 
        norm(p.name) === norm(item.name) ||
        norm(p.name).includes(norm(item.name)) ||
        norm(item.name).includes(norm(p.name))
    );
    
    if (!catalogProduct) return 0;
    
    const isWholesale = order?.type?.toLowerCase().includes('mayor');
    const price = isWholesale ? catalogProduct.mayor : catalogProduct.detal;
    return Number(price) || 0;
  };


  const handleUpdateItemQty = async (order, itemIndex, newQty) => {
    if (newQty < 1) return;
    if (isUpdating) return;

    try {
        setIsUpdating(true);
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], qty: newQty };
        
        // Recalculate total accurately using item prices
        const newTotal = updatedItems.reduce((acc, it) => {
            const price = getItemPrice(it, order);
            // Ensure it has unitPrice for the future
            it.unitPrice = price; 
            return acc + (Number(it.qty || 0) * price);
        }, 0);
        
        await updateOrder(order.id, { 
            items: updatedItems,
            total: newTotal 
        });
    } catch (e) {
        console.error("Error updating qty", e);
        alert("❌ Error al actualizar cantidad");
    } finally {
        setIsUpdating(false);
    }
  };

  const handleMarkAsSoldOut = async (order, itemIndex) => {
    if (isUpdating) return;
    const item = order.items[itemIndex];
    if (!item) return;

    if (!window.confirm(`🚨 AGOTADO GLOBAL: ¿Estás totalmente seguro de eliminar "${item.name}" de la tienda y del almacén? Esta acción es permanente.`)) return;

    try {
        setIsUpdating(true);
        // 1. Identify product ID
        let realProductId = item.id;
        const catalogTarget = (catalog || []).find(p => 
            (item.sku && p.sku === item.sku) || 
            (p.name === item.name)
        );
        if (catalogTarget) realProductId = catalogTarget.id;

        // 2. Sync removal: Prepare updated items list
        const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
        
        // 3. ATOMIC PURGE v4.0
        const success = await deleteProductGlobalAtomic(realProductId, order.id, updatedItems);

        if (success) {
            // v4.4: Safety delay to ensure Firestore sync before reload
            localStorage.setItem('MUNDOROSA_REOPEN_WAREHOUSE', 'true');
            console.log("♻️ Purga atómica exitosa. Esperando sincronización...");
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } else {
            alert("❌ Error en la purga atómica. Intenta de nuevo.");
            setIsUpdating(false);
        }
    } catch (e) {
        console.error("Error in atomic sold out:", e);
        alert("❌ Error crítico al procesar el agotado global.");
        setIsUpdating(false);
    }
  };

  const handleDeleteItem = async (order, itemIndex) => {
    if (isUpdating) return;
    if (!window.confirm("🗑️ ¿Eliminar este producto SOLO de este pedido?")) return;

    try {
        setIsUpdating(true);
        const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
        
        if (updatedItems.length === 0) {
            if (window.confirm("⚠️ El pedido quedará vacío. ¿Deseas eliminar todo el pedido?")) {
                await deleteOrder(order.id);
            } else {
                await updateOrder(order.id, { items: [], total: 0 });
            }
        } else {
            const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * getItemPrice(it, order)), 0);
            await updateOrder(order.id, { 
                items: updatedItems,
                total: newTotal 
            });
        }

        // v4.4: Absolute refresh with safety delay
        if (selectedCustomerName) localStorage.setItem('lastSelectedCustomer', selectedCustomerName);
        localStorage.setItem('MUNDOROSA_REOPEN_WAREHOUSE', 'true');
        console.log("\ud83d\uddd1\ufe0f Eliminaci\u00f3n exitosa. Sincronizando antes de refrescar...");
        setTimeout(() => {
            window.location.reload();
        }, 800);
    } catch (e) {
        console.error("Error deleting item", e);
        alert("❌ Error al eliminar producto");
    } finally {
        setIsUpdating(false);
    }
  };

  const handleAddItemToOrder = async (product) => {
    if (isUpdating) return;
    
    // Find the latest order for this customer
    const currentCustomerOrders = orders.filter(o => getBaseName(o.code) === selectedCustomerName);
    if (currentCustomerOrders.length === 0) return;
    
    // Sort oldest first to guarantee that the last index is the newest order
    const sorted = [...currentCustomerOrders].sort((a, b) => {
        const da = a.createdAt ? parseDate(a.createdAt) : new Date(a.created || 0);
        const db = b.createdAt ? parseDate(b.createdAt) : new Date(b.created || 0);
        return da - db;
    });
    const order = sorted[sorted.length - 1];

    try {
        setIsUpdating(true);
        const updatedItems = [...order.items];
        
        // Check if already in order
        const existingIdx = updatedItems.findIndex(it => it.id === product.id);
        if (existingIdx !== -1) {
            updatedItems[existingIdx] = { ...updatedItems[existingIdx], qty: updatedItems[existingIdx].qty + 1 };
        } else {
            const isWholesale = order.type?.toLowerCase().includes('mayor');
            const price = isWholesale ? (parseInt(product.mayor) || 0) : (parseInt(product.detal) || 0);
            
            updatedItems.push({
                id: product.id,
                name: product.name,
                qty: 1,
                unitPrice: price
            });
        }

        // Recalculate total
        // Recalculate total accurately
        const newTotal = updatedItems.reduce((acc, it) => {
           const price = getItemPrice(it, order);
           it.unitPrice = price; // BINDING: Save price into the item
           return acc + (Number(it.qty || 0) * price);
        }, 0);
        
        await updateOrder(order.id, { 
            items: updatedItems,
            total: newTotal 
        });

        // Clear search
        setItemSearchText("");
    } catch (e) {
        console.error("Error adding item", e);
        alert("❌ Error al añadir producto");
    } finally {
        setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    // v24.0: Integración con Ventana de Impresión
    const savedShipping = localStorage.getItem(`SHIPPING_${selectedCustomerName}`);
    const defaultData = savedShipping ? JSON.parse(savedShipping) : {
        name: selectedCustomerName,
        cedula: '',
        phone: '',
        city: '',
        department: '',
        address: '',
        valor: consolidated.saldo.toString()
    };
    
    setShippingForm({ ...defaultData, valor: consolidated.saldo.toString() });
    setShowPrintModal(true);
  };

  const executeFinalDispatch = async () => {
    const normalizedName = selectedCustomerName.trim().toUpperCase();
    if (window.confirm(`🚀 ¿ESTÁS SEGURO DE CERRAR EL CLIENTE ${normalizedName}?\n\nSe borrarán todos sus pedidos y abonos.`)) {
      setIsUpdating(true);
      try {
        const success = await purgeCustomerData(normalizedName);
        if (success) {
            localStorage.setItem('MUNDOROSA_REOPEN_WAREHOUSE', 'true');
            window.location.reload();
        } else {
            alert("❌ Error al procesar el despacho.");
        }
      } catch (e) {
        alert("❌ Error técnico al despachar: " + e.message);
      }
      setIsUpdating(false);
    }
  };

  const handlePrintGuia = async (onlyPrint = false) => {
    if (!selectedCustomerName) return;
    
    setIsUpdating(true);
    try {
        // Guardar por defecto para la próxima vez
        localStorage.setItem(`SHIPPING_${selectedCustomerName}`, JSON.stringify(shippingForm));

        const data = {
            customerName: selectedCustomerName,
            status: 'pending',
            shipping: shippingForm
        };
        
        const success = await sendToPrintQueue(data);
        if (success) {
            if (onlyPrint) {
                alert("🖨️ ¡Guía enviada!");
                setShowPrintModal(false);
            } else {
                // Si viene del flujo de despacho, cerramos el modal y procedemos al borrado
                setShowPrintModal(false);
                setTimeout(() => executeFinalDispatch(), 300);
            }
        } else {
            alert("❌ Error al enviar a la impresora.");
        }
    } catch (e) {
        alert("❌ Error técnico de impresión: " + e.message);
    } finally {
        setIsUpdating(false);
    }
  };








  const handleToggleSeparado = async (id, currentStatus, currentLocation, isFirstButton) => {

    setIsUpdating(true);

    // 🚨 Detectar si se va a marcar como separado
    const willBecomeSeparated =
        currentStatus !== 'separated';

    // 🚨 Verificar si existen abonos reales
    const hasPayments =
        consolidated.items &&
        consolidated.items.length > 0;

    // 🚨 Detectar si es un domicilio (Pago contra entrega)
    const normalizedName = (selectedCustomerName || '').trim().toUpperCase();
    const esPagoContraEntrega = allDomicilios.some(d => 
        (d.customerName || '').trim().toUpperCase() === normalizedName
    );

    // 🚨 BLOQUEAR si NO tiene abonos Y TAMPOCO es domicilio
    if (
        willBecomeSeparated &&
        !hasPayments &&
        !esPagoContraEntrega
    ) {

        alert(
            "⚠️ NO SE PUEDE MARCAR COMO SEPARADO.\n\n" +
            "Debe existir mínimo un abono registrado o estar marcado como Domicilio (Pago contra entrega)."
        );

        setIsUpdating(false);
        return;
    }

    let newLocation = currentLocation;








    
    // Solo manejamos lógica de ubicación si es el primer botón de la lista
    if (isFirstButton) {

        if (currentStatus !== 'separated') {

            const otherOrderWithLocation = orders.find(o => 
                getBaseName(o.code) === (selectedCustomerName || "").trim().toUpperCase() && 
                o.separacionLocation && 
                o.separacionLocation.trim() !== ''
            );

            if (otherOrderWithLocation) {

                newLocation = otherOrderWithLocation.separacionLocation;

            } else {

                const loc = prompt(
                    "Lugar de separación (Ej. Canasta 5, Caja A):",
                    currentLocation || ""
                );

                if (loc === null) {
                    setIsUpdating(false);
                    return;
                }

                newLocation = loc.trim();
            }

        } else {

            if (
                !window.confirm(
                    "⚠️ ¿Estás totalmente seguro de marcar este pedido como NO SEPARADO? Esto borrará la ubicación registrada para esta tanda."
                )
            ) {
                setIsUpdating(false);
                return;
            }
        }
    }

    const newStatus =
        currentStatus === 'separated'
            ? 'pending'
            : 'separated';

    const payload = {
        status: newStatus
    };

    if (newStatus === 'separated') {

        payload.separacionLocation =
            isFirstButton
                ? newLocation
                : null;

    } else {

        payload.separacionLocation = null;
    }

    // 📦 ACTUALIZACIÓN DE INVENTARIO
    try {
        const orderObj = orders.find(o => o.id === id);
        if (orderObj && orderObj.items) {
            for (const item of orderObj.items) {
                const catalogProduct = catalog.find(p => p.id === item.id || p.name === item.name);
                if (catalogProduct) {
                    if (newStatus === 'separated') {
                        await deductProductStock(catalogProduct.id, item.qty || 1);
                    } else {
                        await restoreProductStock(catalogProduct.id, item.qty || 1);
                    }
                }
            }
        }
    } catch (stockErr) {
        console.error("⚠️ Error actualizando stock durante el cambio de estado:", stockErr);
    }

    await updateOrder(id, payload);

    setIsUpdating(false);
};

  const handleDeleteSinglePayment = async (id) => {
    if (confirm("¿Estás seguro de eliminar este registro de pago?")) {
        await deletePayment(id);
    }
  };


  const handleSaveRename = async () => {
    if (!tempName.trim()) return;
    const oldName = selectedCustomerName;
    const freshName = tempName.trim().toUpperCase();
    
    if (oldName === freshName) {
        setIsEditingName(false);
        return;
    }
    
    setIsUpdating(true);
    try {
        const success = await renameCustomer(oldName, freshName);
        if (success) {
            // Force local update
            setJustRenamedFrom(oldName);
            setSelectedCustomerName(freshName);
            localStorage.setItem('lastSelectedCustomer', freshName); // Actualizar memoria tras renombrar
            setIsEditingName(false);
            // Close dropdown if it was open to help focus reset
            setShowOrdersList(false);
        } else {
            alert("❌ Error al renombrar cliente.");
        }
    } catch (err) {
        console.error(err);
        alert("❌ Error de conexión al renombrar.");
    } finally {
        setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content warehouse-modal" onClick={e => e.stopPropagation()}>
        
        {/* TOP TIMERS BAR v3.0 */}
        {activeTimers.length > 0 && (
          <div style={{
            background: '#0f172a',
            padding: '8px 15px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            gap: '10px',
            overflowX: 'auto',
            minHeight: '45px',
            alignItems: 'center'
          }}>
            <span style={{fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold', whiteSpace: 'nowrap'}}>⏱️ ACTIVOS:</span>
            {activeTimers.map(timer => {
              // Parse startedAt: PocketBase guarda un string ISO, NO un Firebase Timestamp
              const startedAt = timer.startedAt
                  ? new Date(timer.startedAt)
                  : new Date(timer.created || new Date());
              const now = new Date();
              const elapsed = now - startedAt;
              const durationMs = parseInt(timer.durationMs) || (15 * 60 * 1000);
              const remaining = Math.max(0, durationMs - elapsed);
              const isExpired = remaining <= 0;
              
              const minutes = Math.floor(remaining / 60000);
              const seconds = Math.floor((remaining % 60000) / 1000);

              return (
                <div 
                  key={timer.id}
                  className={isExpired ? 'timer-expired' : ''}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: isExpired ? '#ef4444' : 'rgba(255,255,255,0.05)',
                    color: isExpired ? '#fff' : '#fff',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    border: isExpired ? 'none' : '1px solid #334155',
                    transition: 'all 0.3s'
                  }}
                >
                  <span style={{fontWeight: '900'}}>{timer.customerName}:</span>
                  <span>{isExpired ? '¡TIEMPO!' : `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}</span>
                  <button 
                    onClick={() => deleteCustomerTimer(timer.id)}
                    style={{background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '0.8rem', padding: '0 2px'}}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-header">
          <div className="header-title-row">
            <h2>📦 Gestión por Cliente</h2>
            <div className="pending-badge">{orders.length} Tandas Pendientes</div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Improved Dropdown: One name per customer */}
        <CustomerSelector
            showOrdersList={showOrdersList}
            setShowOrdersList={setShowOrdersList}
            isEditingName={isEditingName}
            setIsEditingName={setIsEditingName}
            tempName={tempName}
            setTempName={setTempName}
            isUpdating={isUpdating}
            handleSaveRename={handleSaveRename}
            selectedCustomerName={selectedCustomerName}
            setSelectedCustomerName={setSelectedCustomerName}
            handleReadNote={handleReadNote}
            customerNote={customerNote}
            handleEditNote={handleEditNote}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterAlerts={filterAlerts}
            setFilterAlerts={setFilterAlerts}
            uniqueCustomerNames={uniqueCustomerNames}
            orders={orders}
            allPayments={allPayments}
            getBaseName={getBaseName}
            getAlertStatus={getAlertStatus}
            purgeCustomerData={purgeCustomerData}
            formatCurrency={formatCurrency}
        />

        {/* Consolidated Summary Header with Global Payment Actions */}
        {selectedCustomerName && (
            <div className={`consolidated-header-stats ${isSummaryCollapsed ? 'collapsed' : ''}`} style={{
                margin: '10px 15px',
                padding: isSummaryCollapsed ? '10px 15px' : '15px',
                background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                borderRadius: '15px',
                border: '1px solid #334155',
                display: 'flex',
                flexDirection: 'column',
                gap: isSummaryCollapsed ? '5px' : '10px',
                position: 'sticky',
                top: '0',
                zIndex: '5',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}>
                {!isSummaryCollapsed && (



                  <>
                  
            {(() => {

                const normalizedName = (selectedCustomerName || '').trim().toUpperCase();
                const tieneDomicilio = allDomicilios.some(d => 
                    (d.customerName || '').trim().toUpperCase() === normalizedName
                );

                if (tieneDomicilio) {
                    return (
                        <div style={{
                            background: 'rgba(56,189,248,0.2)',
                            color: '#38bdf8',
                            padding: '10px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            fontWeight: '900',
                            fontSize: '0.85rem',
                            border: '1px solid #38bdf8',
                            marginBottom: '5px'
                        }}>
                            🛵 ES UN DOMICILIO
                        </div>
                    );
                }

                if (consolidated.abonos === 0) {
                    return (
                        <div style={{
                            background: 'rgba(239,68,68,0.2)',
                            color: '#ff4d4d',
                            padding: '10px',
                            borderRadius: '10px',
                            textAlign: 'center',
                            fontWeight: '900',
                            fontSize: '0.85rem',
                            border: '1px solid #ef4444',
                            marginBottom: '5px',
                            animation: 'pulse 2s infinite'
                        }}>
                            ⚠️ ¡ALERTA: NO SE HA PISADO EL SEPARADO! ⚠️
                        </div>
                    );
                }

                return null;

            })()}


                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'}}>
                        <span style={{color: '#94a3b8', fontSize: '0.8rem', fontWeight: 'bold'}}>TOTAL EN PEDIDOS:</span>
                        <span style={{color: '#fff', fontWeight: 'bold'}}>{formatCurrency(consolidated.total)}</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px'}}>
                        <span style={{color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold'}}>PAGOS REGISTRADOS:</span>
                        <span style={{color: '#10b981', fontWeight: 'bold'}}>{formatCurrency(consolidated.abonos)}</span>
                    </div>
                  </>
                )}

                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}} onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span style={{color: '#ffff00', fontSize: isSummaryCollapsed ? '0.75rem' : '0.9rem', fontWeight: '900'}}>⚠️ SALDO FINAL:</span>
                      {isSummaryCollapsed && <span style={{fontSize: '0.7rem', color: '#94a3b8'}}>(Toca para ver detalles)</span>}
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <span style={{color: '#ffff00', fontSize: isSummaryCollapsed ? '1.1rem' : '1.4rem', fontWeight: '900', textShadow: '0 0 10px rgba(255,255,0,0.3)'}}>{formatCurrency(consolidated.saldo)}</span>
                      <span style={{color: '#fff', opacity: 0.5, fontSize: '0.8rem'}}>{isSummaryCollapsed ? '▼' : '▲'}</span>
                    </div>
                </div>

                {!isSummaryCollapsed && (
                  <>
                    {consolidated.items.length > 0 && (
                        <div style={{
                            maxHeight: '120px', 
                            overflowY: 'auto', 
                            fontSize: '0.8rem', 
                            color: '#cbd5e1', 
                            background: 'rgba(0,0,0,0.3)',
                            padding: '10px',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '10px'
                        }}>
                            {consolidated.items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((payment, idx) => {
                                const isGlobal = !!payment.globalId;
                                return (
                                    <div key={payment.id || idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: idx > 0 ? '4px' : '0'}}>
                                        <div style={{display: 'flex', flexDirection: 'column'}}>
                                            <span style={{color: payment.type?.includes('Saldo') ? '#38bdf8' : '#f8fafc', fontSize: '0.75rem'}}>
                                                {payment.type?.includes('Saldo') 
                                                    ? `🏦 ${payment.advisorName || 'Sist.'} (Saldo a favor):` 
                                                    : `🔹 ${payment.advisorName || 'Asesor'}:`}
                                                {(payment.isModified || payment.type?.includes('_modificado')) && (
                                                    <span style={{
                                                        color: '#ff0000', 
                                                        background: '#fff', 
                                                        fontSize: '0.7rem', 
                                                        marginLeft: '8px', 
                                                        fontWeight: '900', 
                                                        padding: '1px 5px', 
                                                        borderRadius: '4px',
                                                        boxShadow: '0 0 5px rgba(255,0,0,0.5)'
                                                    }}>
                                                        (MODIFICADO)
                                                    </span>
                                                )}
                                            </span>
                                            <small 
                                                onClick={() => handleEditPaymentDate(payment)}
                                                title="Haga clic para modificar la fecha"
                                                style={{
                                                    color: '#94a3b8', 
                                                    fontSize: '0.65rem',
                                                    cursor: isGlobal ? 'pointer' : 'default',
                                                    padding: '2px 4px',
                                                    borderRadius: '4px',
                                                    border: isGlobal ? '1px dashed rgba(255,255,255,0.1)' : 'none',
                                                    display: 'inline-block',
                                                    marginTop: '2px'
                                                }}
                                            >
                                                {payment.date ? payment.date.split('-').reverse().join('/') : 'S/F'}
                                            </small>
                                        </div>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                            <div 
                                                onClick={() => handleEditPaymentAmount(payment)}
                                                title="Haga clic para modificar el monto"
                                                style={{
                                                    fontWeight: 'bold', 
                                                    color: payment.type?.includes('Saldo') ? '#0ea5e9' : '#10b981',
                                                    cursor: isGlobal ? 'pointer' : 'default',
                                                    padding: '2px 4px',
                                                    borderRadius: '4px',
                                                    border: isGlobal ? '1px dashed rgba(255,255,255,0.1)' : 'none'
                                                }}
                                            >
                                                {formatCurrency(payment.amount)}
                                            </div>
                                            
                                            <button 
                                                onClick={() => handleEditPaymentAmount(payment)}
                                                style={{
                                                    background: 'none', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    fontSize: '0.9rem', 
                                                    opacity: 0.8,
                                                    transition: 'transform 0.2s ease',
                                                    padding: '2px'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                title="Editar monto de este abono"
                                            >
                                                ✏️
                                            </button>

                                            {/* BOTÓN BORRAR ABONO v67.3 UNIVERSAL */}
                                            <button 
                                                onClick={async () => {
                                                    if (window.confirm(`⚠️ ¿Eliminar este abono de ${formatCurrency(payment.amount)}?\n\nEsta acción es irreversible.`)) {
                                                        if (payment.globalId) {
                                                            await deletePaymentAndHistory(payment.globalId);
                                                        } else if (payment.id?.startsWith('hist-')) {
                                                            const parts = payment.id.split('-');
                                                            if (parts.length === 3) {
                                                                await deleteOrderAbono(parts[1], parseInt(parts[2]));
                                                            }
                                                        } else if (payment.id?.startsWith('legacy-')) {
                                                            const parts = payment.id.split('-');
                                                            if (parts.length === 2) {
                                                                await updateOrder(parts[1], { abono: 0, paymentDate: null, advisorName: null });
                                                            }
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    background: 'none', 
                                                    border: 'none', 
                                                    cursor: 'pointer', 
                                                    fontSize: '0.9rem', 
                                                    opacity: 0.7,
                                                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                                                    padding: '2px'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.2)'; e.currentTarget.style.opacity = '1'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '0.7'; }}
                                                title="Eliminar este abono"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div style={{display: 'flex', gap: '8px', marginTop: '5px'}}>
                        <button 
                            className="btn-primary" 
                            style={{flex: 1, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)', padding: '10px', fontSize: '0.75rem', borderRadius: '10px'}}
                            onClick={handleCopyConsolidatedSummary}
                        >
                            📋 WhatsApp
                        </button>
                        <button 
                            onClick={() => { setShowAbonoForm(!showAbonoForm); setShowDomicilioForm(false); }}
                            style={{
                                flex: 1, 
                                background: showAbonoForm ? '#ef4444' : 'linear-gradient(90deg, #10b981, #059669)', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '10px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold'
                            }}
                        >
                            {showAbonoForm ? '✕ Cancelar' : '💰 Abono'}
                        </button>
                        <button 
                            onClick={() => { setShowDomicilioForm(!showDomicilioForm); setShowAbonoForm(false); }}
                            style={{
                                flex: 1, 
                                background: showDomicilioForm ? '#ef4444' : 'linear-gradient(90deg, #f59e0b, #d97706)', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '10px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold'
                            }}
                        >
                            {showDomicilioForm ? '✕ Cancelar' : '🛒 Domicilio'}
                        </button>
                    </div>

                    {/* Domicilio Form extracted to OrderForms component below */}
                    {/* Timer button row v2.15 */}
                    <div style={{display: 'flex', gap: '8px', marginTop: '0px'}}>
                        <button
                            onClick={handleStartTimer}
                            style={{
                                flex: 1,
                                background: 'linear-gradient(90deg, #92400e, #d97706)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            ⏱️ Iniciar Temporizador
                        </button>
                    </div>
                    {/* SALDO A FAVOR button row v1.0 */}
                    <div style={{display: 'flex', gap: '8px', marginTop: '0px'}}>
                        <button
                            onClick={() => {
                                setShowSaldoFavorForm(!showSaldoFavorForm);
                                setShowAbonoForm(false); // close the other form
                            }}
                            style={{
                                flex: 1,
                                background: showSaldoFavorForm
                                    ? '#ef4444'
                                    : 'linear-gradient(90deg, #0369a1, #0ea5e9)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            {showSaldoFavorForm ? '✕ Cancelar' : '🏦 SALDOS A FAVOR'}
                        </button>
                    </div>
                  </>
                )}

                    <OrderForms
                        showAbonoForm={showAbonoForm}
                        showDomicilioForm={showDomicilioForm}
                        showSaldoFavorForm={showSaldoFavorForm}
                        newAbonoAmount={newAbonoAmount}
                        setNewAbonoAmount={setNewAbonoAmount}
                        newAbonoDate={newAbonoDate}
                        setNewAbonoDate={setNewAbonoDate}
                        advisorCode={advisorCode}
                        setAdvisorCode={setAdvisorCode}
                        advisorName={advisorName}
                        receiptImage={receiptImage}
                        handleRegisterGlobalAbono={handleRegisterGlobalAbono}
                        handlePasteReceipt={handlePasteReceipt}
                        newDomicilioAmount={newDomicilioAmount}
                        setNewDomicilioAmount={setNewDomicilioAmount}
                        domicilioAdvisorCode={domicilioAdvisorCode}
                        setDomicilioAdvisorCode={setDomicilioAdvisorCode}
                        domicilioAdvisorName={domicilioAdvisorName}
                        handleRegisterDomicilio={handleRegisterDomicilio}
                        saldoFavorAmount={saldoFavorAmount}
                        setSaldoFavorAmount={setSaldoFavorAmount}
                        saldoFavorCode={saldoFavorCode}
                        setSaldoFavorCode={setSaldoFavorCode}
                        saldoFavorAdvisorName={saldoFavorAdvisorName}
                        handleRegisterSaldoFavor={handleRegisterSaldoFavor}
                        isUpdating={isUpdating}
                    />
            </div>
        )}

        {/* Multi-Batch Detail View */}
        <CustomerBatches
            selectedCustomerName={selectedCustomerName}
            customerOrders={customerOrders}
            catalog={catalog}
            isUpdating={isUpdating}
            formatCurrency={formatCurrency}
            getItemPrice={getItemPrice}
            handleDeleteFullOrder={handleDeleteFullOrder}
            handleUpdateItemQty={handleUpdateItemQty}
            handleMarkAsSoldOut={handleMarkAsSoldOut}
            handleDeleteItem={handleDeleteItem}
            handleToggleSeparado={handleToggleSeparado}
            itemSearchText={itemSearchText}
            setItemSearchText={setItemSearchText}
            handleAddItemToOrder={handleAddItemToOrder}
            consolidated={consolidated}
            allDomicilios={allDomicilios}
            handleComplete={handleComplete}
        />
      </div>

      {/* GENERIC Advisor Authentication Modal v2.0 */}
      {authModalConfig.isOpen && (
        <div className="modal-overlay" style={{zIndex: '2000'}}>
          <div className="modal-content" style={{maxWidth: '320px', padding: '25px', textAlign: 'center'}}>
            <h3>{authModalConfig.title}</h3>
            <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px'}}>
              {authModalConfig.description}
            </p>
            <input 
              type="password"
              placeholder="••••"
              value={advisorAuthCode}
              onChange={(e) => setAdvisorAuthCode(e.target.value)}
              maxLength={4}
              autoFocus
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '1.5rem',
                textAlign: 'center',
                letterSpacing: '10px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '12px',
                color: '#fff',
                marginBottom: '20px'
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmAuth()}
            />
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                className="btn-primary" 
                style={{flex: 1, background: '#475569'}}
                onClick={() => {
                  setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
                  setAdvisorAuthCode('');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                style={{flex: 1, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)'}}
                onClick={handleConfirmAuth}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SHIPPING / PRINT MODAL v24.0 */}
      {showPrintModal && (
        <div className="modal-overlay" style={{zIndex: '2000'}}>
          <div className="modal-content" style={{maxWidth: '450px', padding: '25px'}}>
            <div style={{textAlign: 'center', marginBottom: '20px'}}>
                <h2 style={{color: '#f43f5e'}}>📄 Guía de Envío</h2>
                <p style={{color: '#94a3b8', fontSize: '0.85rem'}}>Verifica los datos antes de imprimir y despachar.</p>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div style={{display: 'flex', gap: '10px'}}>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>NOMBRE / DESTINATARIO</label>
                        <input type="text" value={shippingForm.name} onChange={e => setShippingForm({...shippingForm, name: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{width: '120px'}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>VALOR $</label>
                        <input type="text" value={shippingForm.valor} onChange={e => setShippingForm({...shippingForm, valor: e.target.value})} style={inputStyle} />
                    </div>
                </div>

                <div style={{display: 'flex', gap: '10px'}}>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>CÉDULA / NIT</label>
                        <input type="text" value={shippingForm.cedula} onChange={e => setShippingForm({...shippingForm, cedula: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>TELÉFONO</label>
                        <input type="text" value={shippingForm.phone} onChange={e => setShippingForm({...shippingForm, phone: e.target.value})} style={inputStyle} />
                    </div>
                </div>

                <div style={{display: 'flex', gap: '10px'}}>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>CIUDAD</label>
                        <input type="text" value={shippingForm.city} onChange={e => setShippingForm({...shippingForm, city: e.target.value})} style={inputStyle} />
                    </div>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>DEPARTAMENTO</label>
                        <input type="text" value={shippingForm.department} onChange={e => setShippingForm({...shippingForm, department: e.target.value})} style={inputStyle} />
                    </div>
                </div>

                <div>
                    <label style={{fontSize: '0.7rem', color: '#94a3b8'}}>DIRECCIÓN DE ENTREGA</label>
                    <input type="text" value={shippingForm.address} onChange={e => setShippingForm({...shippingForm, address: e.target.value})} style={inputStyle} />
                </div>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '25px'}}>
                <button 
                    onClick={() => handlePrintGuia(false)} 
                    disabled={isUpdating}
                    style={{
                        background: 'linear-gradient(90deg, #f43f5e, #e11d48)',
                        padding: '15px',
                        color: '#fff',
                        borderRadius: '10px',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    🖨️ IMPRIMIR Y DESPACHAR
                </button>

                <button 
                    onClick={() => setShowPrintModal(false)}
                    style={{background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', marginTop: '5px'}}
                >
                    Cancelar
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const inputStyle = {
    width: '100%',
    padding: '10px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    marginTop: '4px'
};

export default OrderQueue;
