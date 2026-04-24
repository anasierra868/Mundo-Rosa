import React, { useState, useEffect, useRef } from 'react';
import { onOrdersUpdate, deleteOrder, addPayment, onCustomerPaymentsUpdate, deletePayment, purgeCustomerData, updateOrder, deleteProduct, compressImage, toBase64, renameCustomer, ADVISOR_CODES, updateOrderAbono, deleteOrderAbono, startCustomerTimer, onTimersUpdate, deleteCustomerTimer, deleteProductGlobalAtomic, getCustomerNote, saveCustomerNote } from '../utils/db';

function OrderQueue({ isOpen, onClose, formatCurrency, catalog, orders, allPayments }) {
  const [selectedCustomerName, setSelectedCustomerName] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAlerts, setFilterAlerts] = useState(false);
  const [showOrdersList, setShowOrdersList] = useState(false);
  
  // REAL-TIME STATE v12.0 (Now from props)
  const [showAbonoForm, setShowAbonoForm] = useState(false);
  const [newAbonoAmount, setNewAbonoAmount] = useState('');
  const [newAbonoDate, setNewAbonoDate] = useState(new Date().toISOString().split('T')[0]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  
  // ADD PRODUCT v14.0 states
  const [itemSearchText, setItemSearchText] = useState("");
  const [activeSearchOrderId, setActiveSearchOrderId] = useState(null);

   // NEW Local Edit State v2.10
   const [editingLocalAbono, setEditingLocalAbono] = useState(null); // { orderId, index, amount }
   const [localEditAmount, setLocalEditAmount] = useState('');
   const [localEditDate, setLocalEditDate] = useState('');
   const [localEditAuthCode, setLocalEditAuthCode] = useState('');
   const [advisorCode, setAdvisorCode] = useState('');
   const [advisorName, setAdvisorName] = useState(null);

   // SALDO A FAVOR v1.0 — Local warehouse credit (never touches PAYMENTS_COLLECTION)
   const [showSaldoFavorForm, setShowSaldoFavorForm] = useState(false);
   const [saldoFavorAmount, setSaldoFavorAmount] = useState('');
   const [saldoFavorCode, setSaldoFavorCode] = useState('');
   const [saldoFavorAdvisorName, setSaldoFavorAdvisorName] = useState(null);

   // TIMERS v2.15
   const [activeTimers, setActiveTimers] = useState([]);
   const [showTimersPanel, setShowTimersPanel] = useState(false);
   const [timerTick, setTimerTick] = useState(0);
   const [notifiedTimers, setNotifiedTimers] = useState(new Set()); // v3.0

   useEffect(() => {
     const unsub = onTimersUpdate(setActiveTimers);
     return () => unsub();
   }, []);

   useEffect(() => {
     const interval = setInterval(() => setTimerTick(t => t + 1), 1000);
     return () => clearInterval(interval);
   }, []);

   // ALARM MONITOR v3.0
   useEffect(() => {
     if (!activeTimers || activeTimers.length === 0) return;

     activeTimers.forEach(timer => {
       if (notifiedTimers.has(timer.id)) return;

       // Calculate time
       const startedAt = timer.startedAt?.toDate ? timer.startedAt.toDate() : new Date(timer.createdAt || new Date());
       const now = new Date();
       const elapsed = now - startedAt;
       const remaining = timer.durationMs - elapsed;

       if (remaining <= 0) {
         // EXPIRED! Trigger Alarm
         playTimerAlarm(timer.customerName);
         setNotifiedTimers(prev => new Set([...prev, timer.id]));
       }
     });
   }, [activeTimers, timerTick, notifiedTimers]);

   const playTimerAlarm = (customerName) => {
     try {
       // 1. Voice Notification (Premium feel)
       if ('speechSynthesis' in window) {
         const msg = new SpeechSynthesisUtterance(`Atención. El tiempo del cliente ${customerName} se ha agotado.`);
         msg.lang = 'es-ES';
         msg.rate = 0.9;
         window.speechSynthesis.speak(msg);
       }

       // 2. Beep (Context Audio)
       const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
       const oscillator = audioCtx.createOscillator();
       const gainNode = audioCtx.createGain();

       oscillator.type = 'triangle';
       oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
       oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5); // Slide to A5
       
       gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
       gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
       gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

       oscillator.connect(gainNode);
       gainNode.connect(audioCtx.destination);

       oscillator.start();
       oscillator.stop(audioCtx.currentTime + 1.5);
     } catch (e) {
       console.warn("Audio alarm blocked by browser policy:", e);
     }
   };

   const handleStartTimer = async () => {
     if (!selectedCustomerName) return;
     await startCustomerTimer(selectedCustomerName, 15);
     alert(`\u23f1\ufe0f Temporizador iniciado para ${selectedCustomerName}`);
   };
   const [receiptImage, setReceiptImage] = useState(null); // base64
   
   // New Auth Modal State v16.4
   const [showAdvisorAuthModal, setShowAdvisorAuthModal] = useState(false);
   const [advisorAuthCode, setAdvisorAuthCode] = useState('');

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

  const getBaseName = (code) => {
    return (code || "").split(' (SEPARADO #')[0].trim().toUpperCase();
  };

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

  // Derived Payments for selected customer
  const customerPayments = (allPayments || []).filter(p => 
      (p.customerName || "").trim().toUpperCase() === (selectedCustomerName || "").trim().toUpperCase()
  );

  const getAlertStatus = (customerOrders) => {
    if (!customerOrders || customerOrders.length === 0) return 'normal';
    const now = new Date();
    let maxDays = 0;
    
    customerOrders.forEach(order => {
      if (order.createdAt) {
        // Firebase timestamp or fall-back to raw date
        const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date((order.createdAt.seconds || 0) * 1000);
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > maxDays) maxDays = diffDays;
      }
    });

    if (maxDays >= 10) return 'red';
    if (maxDays === 9) return 'orange';
    return 'normal';
  };

  // v4.9: Normalization helper for insensitive search
  const normalizeText = (text) => {
    if (!text) return "";
    return text.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
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

  // All orders for the selected customer
  const customerOrders = orders.filter(o => getBaseName(o.code) === selectedCustomerName);

  // Helper to get total abonos (handles legacy on-order abonos + global payments)
  const getTotals = () => {
    const totalOrders = customerOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    
    // 1. Collect all potential payments
    const rawPayments = [];
    
    // Legacy single abonos in orders
    customerOrders.forEach(o => {
        if (o.abono > 0) rawPayments.push({ amount: o.abono, date: o.paymentDate, id: `legacy-${o.id}` });
        if (o.abonoHistory) o.abonoHistory.forEach((ah, idx) => {
            rawPayments.push({ 
                amount: ah.amount, 
                date: ah.date, 
                id: `hist-${o.id}-${idx}`,
                globalId: ah.globalId, // 🔗 Critical link for deduplication
                type: ah.type 
            });
        });
    });

    // Global Payment documents
    customerPayments.forEach(p => {
        rawPayments.push({ 
            amount: p.amount, 
            date: p.date, 
            id: p.id,
            globalId: p.id, // A global payment IS its own global ID
            type: p.type 
        });
    });

    // 2. Deduplicate (Heuristic: same date and amount = probably same payment)
    const uniquePayments = [];
    const seen = new Set();
    
    rawPayments.forEach(p => {
        // v2.16 Ultra-Deduplication: Monto + Fecha es la clave suprema para evitar dobles cobros por desincronización
        const key = `${p.amount}_${p.date}`;
        
        if (!seen.has(key)) {
            uniquePayments.push(p);
            seen.add(key);
        }
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

  const handleRegisterGlobalAbono = async () => {
    if (!newAbonoAmount || isUpdating || !selectedCustomerName) return;

    // v15.0 Validation
    const resolvedAdvisor = ADVISOR_CODES[advisorCode.trim()];
    if (!resolvedAdvisor) {
        alert('❌ Código de asesor inválido. Verifica e intenta de nuevo.');
        return;
    }
    if (!receiptImage) {
        alert('❌ Debes adjuntar la imagen de la consignación para continuar.');
        return;
    }
    
    setIsUpdating(true);
    const success = await addPayment({
      customerName: selectedCustomerName,
      amount: parseInt(newAbonoAmount),
      date: newAbonoDate,
      type: 'Abono Global / Caja Almacén',
      advisorName: resolvedAdvisor,
      receiptImage: receiptImage
    });

    if (success) {
        setShowAbonoForm(false);
        setNewAbonoAmount('');
        setAdvisorCode('');
        setAdvisorName(null);
        setReceiptImage(null);
    }
    setIsUpdating(false);
  };

  // SALDO A FAVOR v1.0 — Writes ONLY to abonoHistory, never to PAYMENTS_COLLECTION
  const handleRegisterSaldoFavor = async () => {
    if (!saldoFavorAmount || isUpdating || !selectedCustomerName) return;
    const resolvedAdvisor = ADVISOR_CODES[saldoFavorCode.trim()];
    if (!resolvedAdvisor) return alert('❌ Código de asesor inválido.');
    const amount = parseInt(saldoFavorAmount);
    if (!amount || amount <= 0) return alert('❌ Ingresa un monto válido.');

    // Find the most recent order for this customer to attach the credit
    const targetOrder = [...customerOrders].sort((a, b) =>
        (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    )[0];
    if (!targetOrder) return alert('❌ No hay un pedido activo para este cliente.');

    setIsUpdating(true);
    try {
        const currentHistory = targetOrder.abonoHistory || [];
        const newEntry = {
            amount,
            date: new Date().toISOString().split('T')[0],
            advisorName: resolvedAdvisor,
            type: 'Saldo a Favor',                    // 🔒 Warehouse-only marker
            timestamp: new Date().toISOString()
        };
        await updateOrder(targetOrder.id, {
            abonoHistory: [...currentHistory, newEntry]
        });
        setSaldoFavorAmount('');
        setSaldoFavorCode('');
        setSaldoFavorAdvisorName(null);
        setShowSaldoFavorForm(false);
    } catch (e) {
        console.error('Error al registrar saldo a favor:', e);
        alert('❌ Error al registrar el saldo a favor.');
    } finally {
        setIsUpdating(false);
    }
  };

  const handleReceiptFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const base64 = await toBase64(file);
        const compressed = await compressImage(base64, 700, 0.7);
        setReceiptImage(compressed);
    } catch (err) {
        alert('❌ Error al procesar la imagen. Intenta de nuevo.');
    }
  };

  const handlePasteReceipt = async (e) => {
    const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image')) {
            const file = item.getAsFile();
            const base64 = await toBase64(file);
            const compressed = await compressImage(base64, 700, 0.7);
            setReceiptImage(compressed);
            break;
        }
    }
  };

  const handleCopyConsolidatedSummary = () => {
    if (!selectedCustomerName || (customerOrders.length === 0 && customerPayments.length === 0)) return;
    setAdvisorAuthCode(''); // Reset
    setShowAdvisorAuthModal(true);
  };

  const executeConsolidatedCopy = () => {
    const resolvedAdvisor = ADVISOR_CODES[advisorAuthCode.trim()];
    if (!resolvedAdvisor) {
        alert("❌ Código de asesor inválido. Verifica e intenta de nuevo.");
        return;
    }

    // Earliest Date
    const earliestOrder = [...customerOrders].sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date((a.createdAt?.seconds || 0) * 1000);
        const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date((b.createdAt?.seconds || 0) * 1000);
        return da - db;
    })[0];
    const startDate = earliestOrder?.createdAt 
        ? (earliestOrder.createdAt.toDate ? earliestOrder.createdAt.toDate() : new Date((earliestOrder.createdAt.seconds || 0) * 1000)).toLocaleDateString('es-ES')
        : 'S/F';

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
        paymentsText += `📅 Fecha: ${dateStr}: ${formatCurrency(a.amount)}${typeLabel}\n`;
    });

    // DETERMINAR ESTADO DEL MENSAJE (v16.5 Inteligente)
    const isCotizacion = consolidated.abonos === 0;
    const isVentaRealizada = consolidated.saldo === 0 && consolidated.abonos > 0;
    
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
      setShowAdvisorAuthModal(false);
      setAdvisorAuthCode('');
    });
  };

  // Helper to get unit price of an item (with fallback for legacy orders)
  const getItemPrice = (item, order) => {
    // 1. If stored in item (New version v13.0+)
    if (item.unitPrice) return item.unitPrice;
    
    // 2. Fallback to catalog
    const catalogProduct = (catalog || []).find(p => p.id === item.id || p.name === item.name);
    if (!catalogProduct) return 0;
    
    const isWholesale = order.type?.toLowerCase().includes('mayor');
    return isWholesale ? (parseInt(catalogProduct.mayor) || 0) : (parseInt(catalogProduct.detal) || 0);
  };

  const handleUpdateItemQty = async (order, itemIndex, newQty) => {
    if (newQty < 1) return;
    if (isUpdating) return;

    try {
        setIsUpdating(true);
        const updatedItems = [...order.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], qty: newQty };
        
        // Recalculate total accurately using item prices
        const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * getItemPrice(it, order)), 0);
        
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
    
    const order = currentCustomerOrders[currentCustomerOrders.length - 1];

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
        const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * getItemPrice(it, order)), 0);
        
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
    const normalizedName = selectedCustomerName.trim().toUpperCase();
    // v8.0: Blindaje de confirmación para evitar cierres accidentales
    if (window.confirm(`🚀 \u00bfEST\u00c1S SEGURO DE CERRAR EL CLIENTE ${normalizedName}?\n\nEsta acci\u00f3n eliminar\u00e1 permanentemente TODOS sus pedidos y abonos actuales del almac\u00e9n para finalizar su ciclo.`)) {
      setIsUpdating(true);
      try {
        const success = await purgeCustomerData(normalizedName);
        if (success) {
            localStorage.setItem('MUNDOROSA_REOPEN_WAREHOUSE', 'true');
            console.log("♻️ Despacho exitoso. Recargando para limpieza total...");
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

  const handleToggleSeparado = async (id, currentStatus, currentLocation, isFirstButton) => {
    setIsUpdating(true);
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
                const loc = prompt("Lugar de separación (Ej. Canasta 5, Caja A):", currentLocation || "");
                if (loc === null) {
                    setIsUpdating(false);
                    return;
                }
                newLocation = loc.trim();
            }
        } else {
            if (!window.confirm("⚠️ ¿Estás totalmente seguro de marcar este pedido como NO SEPARADO? Esto borrará la ubicación registrada para esta tanda.")) {
                setIsUpdating(false);
                return;
            }
        }
    }

    const newStatus = currentStatus === 'separated' ? 'pending' : 'separated';
    const payload = { status: newStatus };
    if (newStatus === 'separated') {
        payload.separacionLocation = isFirstButton ? newLocation : null;
    } else {
        payload.separacionLocation = null;
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
              const startedAt = timer.startedAt?.toDate ? timer.startedAt.toDate() : new Date(timer.createdAt || new Date());
              const now = new Date();
              const elapsed = now - startedAt;
              const remaining = Math.max(0, timer.durationMs - elapsed);
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
        <div className="order-selector-container">
          <button 
            className="current-order-toggle" 
            onClick={() => setShowOrdersList(!showOrdersList)}
          >
            <div className="toggle-info">
              <small>Expediente de Cliente:</small>
              <div className="current-name" style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '30px' }}>
                {isEditingName ? (
                   <>
                     <input
                       type="text"
                       autoFocus
                       value={tempName}
                       onChange={(e) => setTempName(e.target.value.toUpperCase())}
                       onClick={(e) => e.stopPropagation()}
                       onKeyDown={(e) => {
                           if(e.key === 'Enter') { 
                              e.stopPropagation(); 
                              e.preventDefault();
                              handleSaveRename(); 
                           }
                           if(e.key === 'Escape') { 
                              e.stopPropagation(); 
                              e.preventDefault();
                              setIsEditingName(false); 
                           }
                       }}
                       style={{ 
                          color: '#000', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.95rem', 
                          border: '2px solid #ec4899', 
                          background: '#fff', 
                          width: '100%', 
                          outline: 'none',
                          fontWeight: 'bold'
                       }}
                       placeholder="Nombre..."
                       disabled={isUpdating}
                     />
                     <button 
                        onClick={(e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           handleSaveRename();
                        }}
                        disabled={isUpdating || !tempName.trim()}
                        style={{
                           background: '#10b981',
                           color: '#fff',
                           border: 'none',
                           borderRadius: '4px',
                           padding: '4px 8px',
                           fontSize: '1rem',
                           cursor: 'pointer',
                           opacity: isUpdating ? 0.5 : 1
                        }}
                        title="Guardar cambio"
                     >
                        {isUpdating ? '⏳' : '✅'}
                     </button>
                     <button 
                        onClick={(e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           setIsEditingName(false);
                        }}
                        disabled={isUpdating}
                        style={{
                           background: '#ef4444',
                           color: '#fff',
                           border: 'none',
                           borderRadius: '4px',
                           padding: '4px 8px',
                           fontSize: '1rem',
                           cursor: 'pointer',
                           opacity: isUpdating ? 0.5 : 1
                        }}
                        title="Cancelar"
                     >
                        ❌
                     </button>
                   </>
                ) : (
                   <>
                     {selectedCustomerName || "Seleccionar un cliente..."}
                     {selectedCustomerName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
                           <span 
                              className="rename-pencil"
                              onClick={(e) => {
                                 e.stopPropagation();
                                 e.preventDefault();
                                 setTempName('');
                                 setIsEditingName(true);
                              }}
                              style={{ fontSize: '1.1rem', cursor: 'pointer', opacity: 0.8, padding: '2px', transition: 'transform 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              title="Renombrar cliente"
                           >
                              ✏️
                           </span>
                           <span
                               onClick={handleReadNote}
                               style={{ 
                                  fontSize: '1.2rem', 
                                  cursor: 'pointer', 
                                  opacity: customerNote ? 1 : 0.4, 
                                  padding: '2px', 
                                  transition: 'all 0.2s', 
                                  filter: customerNote ? 'drop-shadow(0 0 5px rgba(236,72,153,0.8))' : 'none',
                                  transform: customerNote ? 'scale(1.1)' : 'scale(1)'
                               }}
                               onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                               onMouseLeave={(e) => e.currentTarget.style.transform = customerNote ? 'scale(1.1)' : 'scale(1)'}
                               title={customerNote ? "Leer nota activa" : "No hay notas aún"}
                           >
                               📖
                           </span>
                           <span
                               onClick={handleEditNote}
                               style={{ fontSize: '1.1rem', cursor: 'pointer', opacity: 0.8, padding: '2px', transition: 'transform 0.2s' }}
                               onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                               onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                               title="Escribir/Editar nota"
                           >
                               📝
                           </span>
                        </div>
                     )}
                   </>
                )}
              </div>
            </div>
            <span className={`toggle-arrow ${showOrdersList ? 'open' : ''}`}>▼</span>
          </button>

          {showOrdersList && (
            <div className="orders-dropdown-menu">
              <div className="order-search-container" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()} 
                  className="order-search-input"
                  style={{ flex: 1 }}
                  autoFocus={!isEditingName}
                />
                <button 
                  className={`alert-filter-btn ${filterAlerts ? 'active' : ''}`}
                  onClick={(e) => {
                      e.stopPropagation();
                      setFilterAlerts(!filterAlerts);
                  }}
                  title="Filtrar pedidos por vencer (9-10 días)"
                >
                  ⚠️
                </button>
              </div>

              {uniqueCustomerNames.length === 0 ? (
                <p className="empty-msg">{filterAlerts ? "No hay alertas pendientes." : "No hay clientes pendientes."}</p>
              ) : (
                uniqueCustomerNames.map(name => {
                  const customerOrders = orders.filter(o => getBaseName(o.code) === name);
                  const batchCount = customerOrders.length;
                  const status = getAlertStatus(customerOrders);

                  // CÁLCULO AUTÓNOMO v5.0 (Diodo)
                  // El almacén solo confía en la información local del pedido actual.
                  const hasAbonos = customerOrders.some(o => (o.abono > 0) || (o.abonoHistory && o.abonoHistory.length > 0));
                  
                  let daysCountText = "";
                  let customStyle = {};

                  if (!hasAbonos) {
                      const now = new Date();
                      let oldest = now;
                      customerOrders.forEach(o => {
                          const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date((o.createdAt?.seconds || 0) * 1000);
                          if (d < oldest) oldest = d;
                      });
                      const diff = Math.floor((now - oldest) / (1000 * 60 * 60 * 24));
                      daysCountText = `⏳ ${diff}d`;
                      if (diff >= 6) customStyle = { color: '#ef4444', fontWeight: '900' };
                  } else {
                      daysCountText = "✅";
                  }

                  return (
                    <button 
                      key={name} 
                      className={`dropdown-item ${selectedCustomerName === name ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCustomerName(name);
                        localStorage.setItem('lastSelectedCustomer', name); // Sincronizar memoria al seleccionar manualmente
                        setShowOrdersList(false);
                      }}
                      style={customStyle}
                    >
                      <span style={{ fontSize: '0.8rem', marginRight: '8px', opacity: 0.8 }}>{daysCountText}</span>
                      <span className={`status-dot ${status}`}></span>
                      <span className="item-name-text">{name}</span>
                      <span className="batch-tag">{batchCount} tanda(s)</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

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
                    {consolidated.abonos === 0 && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.2)',
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
                    )}
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
                    {/* Independent Payment History for UI v2.5 */}
                    {customerOrders.some(o => (o.abono > 0 || (o.abonoHistory && o.abonoHistory.length > 0))) && (
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
                            gap: '8px'
                        }}>
                            {customerOrders.map(o => (o.abono > 0 || (o.abonoHistory && o.abonoHistory.length > 0)) && (
                                <React.Fragment key={o.id}>
                                    {o.abono > 0 && (
                                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span style={{color: '#f8fafc'}}>🔸 Abono Inicial:</span>
                                            <span style={{fontWeight: 'bold', color: '#fff'}}>{formatCurrency(o.abono)} <small style={{opacity: 0.6, fontWeight: 'normal'}}>- {o.paymentDate ? o.paymentDate.split('-').reverse().join('/') : 'S/F'}</small></span>
                                        </div>
                                    )}
                                    {o.abonoHistory?.map((ah, idx) => (
                                        <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px'}}>
                                            <div style={{display: 'flex', flexDirection: 'column'}}>
                                                <span style={{color: ah.type === 'Saldo a Favor' ? '#38bdf8' : '#f8fafc', fontSize: '0.75rem'}}>
                                                    {ah.type === 'Saldo a Favor' 
                                                        ? `🏦 Asesor ${ah.advisorName} (Saldo a favor):` 
                                                        : `🔹 Asesor ${ah.advisorName} (Abono):`}
                                                </span>
                                                <small style={{color: '#94a3b8', fontSize: '0.65rem'}}>{ah.date ? ah.date.split('-').reverse().join('/') : 'S/F'}</small>
                                            </div>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                                <div style={{fontWeight: 'bold', color: ah.type === 'Saldo a Favor' ? '#0ea5e9' : '#10b981'}}>
                                                    {editingLocalAbono?.orderId === o.id && editingLocalAbono?.index === idx ? (
                                                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                                                            <input 
                                                                type="number" 
                                                                value={localEditAmount}
                                                                onChange={(e) => setLocalEditAmount(e.target.value)}
                                                                style={{width: '100px', padding: '3px 5px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #38bdf8', background: '#0f172a', color: '#fff'}}
                                                                autoFocus
                                                            />
                                                            <input 
                                                                type="date" 
                                                                value={localEditDate}
                                                                onChange={(e) => setLocalEditDate(e.target.value)}
                                                                style={{width: '100px', padding: '3px 5px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid #38bdf8', background: '#0f172a', color: '#fff'}}
                                                            />
                                                         </div>
                                                    ) : (
                                                        formatCurrency(ah.amount)
                                                    )}
                                                </div>
                                                
                                                {editingLocalAbono?.orderId === o.id && editingLocalAbono?.index === idx ? (
                                                    <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                                                        <input 
                                                            type="password" 
                                                            placeholder="Cód." 
                                                            value={localEditAuthCode}
                                                            onChange={(e) => setLocalEditAuthCode(e.target.value)}
                                                            maxLength={4}
                                                            style={{width: '50px', padding: '2px 5px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid #ef4444', background: '#0f172a', color: '#fff'}}
                                                        />
                                                        <button 
                                                            onClick={async () => {
                                                                const resolved = ADVISOR_CODES[localEditAuthCode.trim()];
                                                                if (!resolved) return alert('❌ Código inválido.');
                                                                
                                                                try {
                                                                    const amount = parseInt(localEditAmount);
                                                                    if (isNaN(amount) || amount <= 0) return alert('❌ Ingresa un monto válido.');

                                                                    const success = await updateOrderAbono(o.id, idx, { 
                                                                        amount: amount,
                                                                        date: localEditDate || ah.date || new Date().toISOString().split('T')[0],
                                                                        advisorName: `${resolved} (Corregido)`
                                                                    });
                                                                    if (success) {
                                                                        setEditingLocalAbono(null);
                                                                        setLocalEditAuthCode('');
                                                                    } else {
                                                                        alert('❌ La actualización falló en el servidor.');
                                                                    }
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('❌ Error técnico: ' + err.message);
                                                                }
                                                            }}
                                                            style={{background: '#10b981', color: '#fff', border: 'none', padding: '3px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer'}}
                                                        >
                                                            ✅
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                const resolved = ADVISOR_CODES[localEditAuthCode.trim()];
                                                                if (!resolved) return alert('❌ Código inválido.');
                                                                if (!confirm(`¿Estás seguro de ELIMINAR este registro de ${formatCurrency(ah.amount)}?`)) return;
                                                                const success = await deleteOrderAbono(o.id, idx);
                                                                if (success) {
                                                                    setEditingLocalAbono(null);
                                                                    setLocalEditAuthCode('');
                                                                } else alert('❌ Error al eliminar.');
                                                            }}
                                                            style={{background: '#ef4444', color: '#fff', border: 'none', padding: '3px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer'}}
                                                            title="Eliminar permanentemente"
                                                        >
                                                            🗑️
                                                        </button>
                                                        <button onClick={() => setEditingLocalAbono(null)} style={{background: '#64748b', color: '#fff', border: 'none', padding: '3px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer'}}>❌</button>
                                                    </div>
                                                ) : (
                                                    <button 
                                                        onClick={() => {
                                                            setEditingLocalAbono({ orderId: o.id, index: idx });
                                                            setLocalEditAmount(ah.amount);
                                                            setLocalEditDate(ah.date || '');
                                                            setLocalEditAuthCode('');
                                                        }}
                                                        style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', opacity: 0.6}}
                                                        title="Editar este abono"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </div>
                    )}

                    <div style={{display: 'flex', gap: '8px', marginTop: '5px'}}>
                        <button 
                            className="btn-primary" 
                            style={{flex: 1, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)', padding: '10px', fontSize: '0.75rem', borderRadius: '10px'}}
                            onClick={handleCopyConsolidatedSummary}
                        >
                            📋 Copiar WhatsApp
                        </button>
                        <button 
                            onClick={() => setShowAbonoForm(!showAbonoForm)}
                            style={{
                                flex: 1, 
                                background: showAbonoForm ? '#ef4444' : '#10b981', 
                                color: '#fff', 
                                border: 'none', 
                                borderRadius: '10px', 
                                fontSize: '0.75rem', 
                                fontWeight: 'bold'
                            }}
                        >
                            {showAbonoForm ? '✕ Cancelar Abono' : '➕💰 Registrar Abono'}
                        </button>
                    </div>
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

                {showAbonoForm && (
                    <div 
                        style={{
                            marginTop: '10px',
                            padding: '12px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            border: '1px solid #10b981',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}
                        onPaste={handlePasteReceipt}
                    >
                        {/* Row 1: Amount + Date */}
                        <div style={{display: 'flex', gap: '8px'}}>
                            <input 
                                type="number" 
                                placeholder="Monto del Abono $" 
                                value={newAbonoAmount}
                                onChange={(e) => setNewAbonoAmount(e.target.value)}
                                style={{flex: 2, background: '#000', border: '1px solid #334155', borderRadius: '8px', padding: '8px', color: '#fff'}}
                            />
                            <input 
                                type="date" 
                                value={newAbonoDate}
                                onChange={(e) => setNewAbonoDate(e.target.value)}
                                style={{flex: 1.5, background: '#000', border: '1px solid #334155', borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '0.8rem'}}
                            />
                        </div>

                        {/* Row 2: Advisor Code */}
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <input 
                                type="password"
                                placeholder="🔒 Código de asesor"
                                value={advisorCode}
                                maxLength={4}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setAdvisorCode(val);
                                    setAdvisorName(ADVISOR_CODES[val.trim()] || null);
                                }}
                                style={{flex: 1, background: '#000', border: `1px solid ${advisorName ? '#10b981' : '#334155'}`, borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '0.9rem', letterSpacing: '3px'}}
                            />
                            {advisorName && (
                                <span style={{fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                                    ✅ {advisorName}
                                </span>
                            )}
                        </div>

                        {/* Row 3: Receipt Image (PASTE ONLY) */}
                        <div style={{
                            border: `2px dashed ${receiptImage ? '#10b981' : '#7c3aed'}`,
                            borderRadius: '10px',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            background: receiptImage ? 'rgba(16,185,129,0.05)' : 'rgba(124,58,237,0.05)',
                            transition: 'all 0.3s'
                        }}>
                            {receiptImage ? (
                                <>
                                    <img src={receiptImage} alt="Consignación" style={{maxHeight: '120px', borderRadius: '6px', objectFit: 'contain'}} />
                                    <span style={{fontSize: '0.7rem', color: '#10b981'}}>✅ Imagen pegada — lista para registrar</span>
                                </>
                            ) : (
                                <>
                                    <span style={{fontSize: '1.5rem'}}>📋</span>
                                    <span style={{fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center'}}>
                                        <b>PEGA (Ctrl+V)</b> la imagen de la consignación aquí
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Confirm Button */}
                        <button 
                            onClick={handleRegisterGlobalAbono}
                            disabled={isUpdating || !advisorName || !receiptImage}
                            style={{
                                background: (advisorName && receiptImage) ? '#10b981' : '#475569',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px',
                                fontWeight: 'bold',
                                cursor: (advisorName && receiptImage) ? 'pointer' : 'not-allowed',
                                transition: 'background 0.3s'
                            }}
                        >
                            {isUpdating ? 'Registrando...' : '✅ Confirmar Abono'}
                        </button>
                    </div>
                )}

                {/* SALDO A FAVOR FORM v1.0 */}
                {showSaldoFavorForm && (
                    <div style={{
                        marginTop: '10px',
                        padding: '14px',
                        background: 'rgba(3, 105, 161, 0.12)',
                        borderRadius: '12px',
                        border: '1px solid #0ea5e9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <span style={{color: '#38bdf8', fontWeight: 'bold', fontSize: '0.8rem'}}>🏦 SALDO A FAVOR — Solo Almacén</span>
                        <input
                            type="number"
                            placeholder="Monto del saldo a favor $"
                            value={saldoFavorAmount}
                            onChange={(e) => setSaldoFavorAmount(e.target.value)}
                            style={{background: '#000', border: '1px solid #334155', borderRadius: '8px', padding: '8px', color: '#fff', width: '100%', boxSizing: 'border-box'}}
                        />
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <input
                                type="password"
                                placeholder="🔒 Código de asesor"
                                value={saldoFavorCode}
                                maxLength={4}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSaldoFavorCode(val);
                                    setSaldoFavorAdvisorName(ADVISOR_CODES[val.trim()] || null);
                                }}
                                style={{flex: 1, background: '#000', border: `1px solid ${saldoFavorAdvisorName ? '#0ea5e9' : '#334155'}`, borderRadius: '8px', padding: '8px', color: '#fff', fontSize: '0.9rem', letterSpacing: '3px'}}
                            />
                            {saldoFavorAdvisorName && (
                                <span style={{fontSize: '0.75rem', color: '#38bdf8', fontWeight: 'bold', whiteSpace: 'nowrap'}}>✅ {saldoFavorAdvisorName}</span>
                            )}
                        </div>
                        <button
                            onClick={handleRegisterSaldoFavor}
                            disabled={isUpdating || !saldoFavorAdvisorName || !saldoFavorAmount}
                            style={{
                                background: (saldoFavorAdvisorName && saldoFavorAmount) ? '#0369a1' : '#475569',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px',
                                fontWeight: 'bold',
                                cursor: (saldoFavorAdvisorName && saldoFavorAmount) ? 'pointer' : 'not-allowed'
                            }}
                        >
                            {isUpdating ? 'Registrando...' : '✅ Confirmar Saldo a Favor'}
                        </button>
                        <p style={{fontSize: '0.65rem', color: '#64748b', margin: 0, textAlign: 'center'}}>* Solo afecta el saldo del almacén. No se registra en Consultar Abonos.</p>
                    </div>
                )}
            </div>
        )}

        {/* Multi-Batch Detail View */}
        <div className="customer-batches-scroller">
          {selectedCustomerName ? (
            customerOrders.length > 0 ? (
              customerOrders.map((order, oIdx) => (
                <div key={order.id} className="batch-block" style={{
                    border: order.status === 'separated' ? '3px solid #ea580c' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: order.status === 'separated' ? '0 0 20px rgba(234, 88, 12, 0.3)' : 'none',
                    transition: 'all 0.3s ease'
                }}>
                  <div className="batch-header">
                    <div className="batch-title">
                       <span className="batch-num" style={{ background: order.status === 'separated' ? '#ea580c' : '#7c3aed' }}>#{oIdx + 1}</span>
                       <div className="batch-naming">
                          <h4>{order.code.includes('SEPARADO') ? order.code.split(' (')[1].replace(')', '') : 'PEDIDO PRINCIPAL'}</h4>
                          <span className="batch-date-label">
                            🗓️ Asignado hace {Math.floor(Math.abs(new Date() - (order.createdAt?.toDate ? order.createdAt.toDate() : new Date((order.createdAt?.seconds || 0) * 1000))) / (1000 * 60 * 60 * 24))} día(s)
                          </span>
                       </div>
                    </div>
                    <span className="batch-type" style={{ background: order.status === 'separated' ? '#ea580c' : 'rgba(255,255,255,0.1)' }}>{order.type}</span>
                  </div>

                  {/* ... financials ... */}
                  <div className="batch-financials-row" style={{
                      margin: '0 15px 10px',
                      padding: '12px',
                      background: order.status === 'separated' ? 'rgba(234, 88, 12, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px'
                  }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', alignItems: 'center'}}>
                          <span style={{color: '#475569', fontWeight: '800'}}>VALOR PEDIDO:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{color: '#1e293b', fontWeight: '900', fontSize: '1rem'}}>{formatCurrency(order.total || 0)}</span>
                              <button 
                                 onClick={() => handleDeleteFullOrder(order.id, order.code)}
                                 title="Eliminar PEDIDO COMPLETO"
                                 style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}
                              >
                                 🗑️
                              </button>
                          </div>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem'}}>
                          <span style={{color: '#475569', fontWeight: '600'}}>🗓️ Ingresado:</span>
                          <span style={{color: '#1e293b', fontWeight: '700'}}>
                            {order.createdAt ? (
                              (order.createdAt.toDate ? order.createdAt.toDate() : new Date((order.createdAt.seconds || 0) * 1000))
                                .toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            ) : 'S/F'}
                          </span>
                      </div>
                  </div>

                  <div className="order-items-grid">
                    {order.items.map((item, idx) => {
                      const catalogProduct = catalog.find(p => p.id === item.id || p.name === item.name);
                      const itemImg = catalogProduct ? catalogProduct.image : "placeholder.png";

                      return (
                        <div key={idx} className="order-item-row">
                          <div className="item-img-container">
                            <img src={itemImg} alt={item.name} />
                          </div>
                          <div className="item-text" style={{flex: 1}}>
                             <span className="item-name" style={{fontSize: '0.85rem', display: 'block', marginBottom: '4px'}}>{item.name}</span>
                             <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                    <div style={{
                                        display: 'flex', 
                                        padding: '2px 5px',
                                        background: 'rgba(0,0,0,0.08)', 
                                        borderRadius: '8px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        alignItems: 'center'
                                    }}>
                                        <button 
                                            onClick={() => handleUpdateItemQty(order, idx, (item.qty || 1) - 1)}
                                            disabled={isUpdating || item.qty <= 1}
                                            style={{background: 'none', border: 'none', color: '#1e293b', padding: '5px', cursor: 'pointer', fontSize: '1.2rem', minWidth: '30px'}}
                                        >
                                            -
                                        </button>
                                        <span style={{
                                            minWidth: '25px', 
                                            textAlign: 'center', 
                                            fontWeight: 'bold', 
                                            fontSize: '1rem',
                                            color: order.status === 'separated' ? '#ff914d' : '#ec4899'
                                        }}>
                                            {item.qty}
                                        </span>
                                        <button 
                                            onClick={() => handleUpdateItemQty(order, idx, (item.qty || 1) + 1)}
                                            disabled={isUpdating}
                                            style={{background: 'none', border: 'none', color: '#1e293b', padding: '5px', cursor: 'pointer', fontSize: '1.1rem', minWidth: '30px'}}
                                        >
                                            +
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleMarkAsSoldOut(order, idx)}
                                        disabled={isUpdating}
                                        style={{
                                            background: '#fff',
                                            border: '1px solid #ef4444',
                                            borderRadius: '20px',
                                            color: '#ef4444',
                                            fontSize: '0.65rem',
                                            padding: '2px 8px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            textTransform: 'uppercase',
                                            opacity: isUpdating ? 0.5 : 1
                                        }}
                                    >
                                        {isUpdating ? '...' : 'AGOTADO'}
                                    </button>
                                 </div>
                                
                                <span style={{fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px'}}>
                                    {formatCurrency(getItemPrice(item, order))} c/u
                                </span>

                                <button 
                                    onClick={() => handleDeleteItem(order, idx)}
                                    disabled={isUpdating}
                                    style={{
                                        marginLeft: 'auto', 
                                        background: 'none', 
                                        border: 'none', 
                                        color: '#ef4444', 
                                        opacity: 0.6,
                                        cursor: 'pointer',
                                        padding: '5px',
                                        fontSize: '1.1rem'
                                    }}
                                >
                                    🗑️
                                </button>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                   </div>

                  {oIdx === 0 && order.status === 'separated' && order.separacionLocation && (
                      <div style={{
                          textAlign: 'center', 
                          fontSize: '0.75rem', 
                          color: '#ff914d', 
                          marginBottom: '6px',
                          fontWeight: '800',
                          letterSpacing: '1px'
                      }}>
                         📍 UBICACIÓN: {order.separacionLocation}
                      </div>
                  )}
                  <button 
                    className="complete-batch-btn" 
                    onClick={() => handleToggleSeparado(order.id, order.status, order.separacionLocation, oIdx === 0)}
                    style={{
                        background: order.status === 'separated' ? 'linear-gradient(90deg, #f97316, #ea580c)' : '#2dd4bf',
                        fontWeight: 'bold',
                        opacity: isUpdating ? 0.7 : 1
                    }}
                   >
                    {order.status === 'separated' ? '✅ YA FUE SEPARADO' : '📦 MARCAR COMO SEPARADO'}
                  </button>
                </div>
              ))
            ) : (
              <div className="select-hint">Este cliente ya no tiene pedidos pendientes.</div>
            )
          ) : (
            <div className="select-hint">👈 Selecciona un cliente para ver todas sus tandas.</div>
          )}

          {/* GLOBAL ADD PRODUCT v14.1 (Between list and final button) */}
          {selectedCustomerName && customerOrders.length > 0 && (
            <div style={{ 
                margin: '20px 15px 0', 
                padding: '15px', 
                background: 'rgba(0,0,0,0.03)', 
                borderRadius: '14px', 
                border: '1px solid rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 'bold' }}>ANEXAR PRODUCTO (AL ÚLTIMO PEDIDO):</span>
                </div>
                
                <div style={{ position: 'relative' }}>
                    <input 
                        type="text"
                        placeholder="🔍 Escribe para buscar en el catálogo..."
                        value={itemSearchText}
                        onChange={(e) => setItemSearchText(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 15px',
                            borderRadius: '12px',
                            background: 'rgba(0,0,0,0.03)',
                            border: '1px dashed #7c3aed',
                            color: '#1e293b',
                            fontSize: '0.85rem'
                        }}
                    />
                    {itemSearchText.length > 1 && (
                        <div style={{
                            position: 'absolute',
                            top: '100%', // Changed to bottom
                            left: 0,
                            right: 0,
                            background: '#fff',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                            border: '1px solid #7c3aed',
                            zIndex: 999, // High z-index
                            maxHeight: '220px',
                            overflowY: 'auto',
                            marginTop: '5px'
                        }}>
                            {(catalog || [])
                                .filter(p => 
                                    p.name?.toLowerCase().includes(itemSearchText.toLowerCase()) || 
                                    p.id?.toString().includes(itemSearchText.toLowerCase())
                                )
                                .slice(0, 8)
                                .map(p => (
                                    <div 
                                        key={p.id}
                                        onClick={() => handleAddItemToOrder(p)}
                                        style={{
                                            padding: '12px 15px',
                                            borderBottom: '1px solid rgba(0,0,0,0.05)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            transition: 'background 0.2s'
                                        }}
                                        className="catalog-suggestion-item"
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(124, 58, 237, 0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                        <img src={p.image || 'placeholder.png'} style={{width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover'}} />
                                        <div style={{flex: 1}}>
                                            <div style={{fontSize: '0.9rem', color: '#1e293b', fontWeight: '500'}}>{p.name}</div>
                                            <div style={{fontSize: '0.75rem', color: '#64748b'}}>
                                                {formatCurrency(p.mayor)} Mayor | {formatCurrency(p.detal)} Detal
                                            </div>
                                        </div>
                                        <div style={{ color: '#7c3aed', fontSize: '1.2rem' }}>⊕</div>
                                    </div>
                                ))
                            }
                            {/* Empty state within dropdown */}
                            {(catalog || []).filter(p => p.name?.toLowerCase().includes(itemSearchText.toLowerCase())).length === 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                                    No se encontraron productos.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* FINAL DISPATCH BUTTON */}
          {selectedCustomerName && customerOrders.length > 0 && (
            <div style={{ padding: '20px 15px 40px' }}>
                <button 
                    className="complete-batch-btn"
                    onClick={handleComplete}
                    disabled={isUpdating}
                    style={{
                        background: 'linear-gradient(90deg, #ef4444, #b91c1c)',
                        padding: '18px',
                        fontSize: '1rem',
                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                        border: '2px solid rgba(255,255,255,0.2)'
                    }}
                >
                    🚀 PEDIDO DESPACHADO (CERRAR CLIENTE)
                </button>
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '10px' }}>
                   *Esta acción borrará todos los abonos y pedidos de este cliente.
                </p>
            </div>
          )}
        </div>
      </div>

      {/* Advisor Authentication Modal for WhatsApp v16.4 */}
      {showAdvisorAuthModal && (
        <div className="modal-overlay" style={{zIndex: '2000'}}>
          <div className="modal-content" style={{maxWidth: '320px', padding: '25px', textAlign: 'center'}}>
            <h3>🔒 Acceso de Asesor</h3>
            <p style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '20px'}}>
              Ingresa tu código para generar el estado de cuenta.
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
              onKeyDown={(e) => e.key === 'Enter' && executeConsolidatedCopy()}
            />
            <div style={{display: 'flex', gap: '10px'}}>
              <button 
                className="btn-primary" 
                style={{flex: 1, background: '#475569'}}
                onClick={() => {
                  setShowAdvisorAuthModal(false);
                  setAdvisorAuthCode('');
                }}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                style={{flex: 1, background: 'linear-gradient(90deg, #7c3aed, #4f46e5)'}}
                onClick={executeConsolidatedCopy}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderQueue;
