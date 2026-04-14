import React, { useState, useEffect, useRef } from 'react';
import { onOrdersUpdate, deleteOrder, addPayment, onCustomerPaymentsUpdate, deletePayment, purgeCustomerData, updateOrder, compressImage, toBase64 } from '../utils/db';

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

   // ADVISOR AUTH v16.4
   const ADVISOR_CODES = { 
     '1349': 'Dharma Perea', 
     '3768': 'Marcela Venegas', 
     '1947': 'Luisa Patiño',
     '4399': 'Esteban',
     '2815': 'Ana'
   };
   const [advisorCode, setAdvisorCode] = useState('');
   const [advisorName, setAdvisorName] = useState(null);
   const [receiptImage, setReceiptImage] = useState(null); // base64
   
   // New Auth Modal State v16.4
   const [showAdvisorAuthModal, setShowAdvisorAuthModal] = useState(false);
   const [advisorAuthCode, setAdvisorAuthCode] = useState('');
  const receiptInputRef = useRef(null);

  const getBaseName = (code) => {
    return (code || "").split(' (SEPARADO #')[0].trim().toUpperCase();
  };

  useEffect(() => {
    if (!isOpen || !orders) return;
    
    // Auto-select first unique customer name if nothing selected OR if selected was purged
    const uniqueInCurrent = Array.from(new Set(orders.map(o => getBaseName(o.code))));
    setSelectedCustomerName(prev => {
        if (!prev && uniqueInCurrent.length > 0) return uniqueInCurrent[0];
        if (prev && !uniqueInCurrent.includes(prev)) return uniqueInCurrent.length > 0 ? uniqueInCurrent[0] : null;
        return prev;
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

  // Grouped unique customer names for the dropdown (FILTERED)
  const uniqueCustomerNames = Array.from(new Set(orders.map(o => getBaseName(o.code))))
    .filter(name => {
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
        if (filterAlerts) {
            const customerOrders = orders.filter(o => getBaseName(o.code) === name);
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
    
    // Legacy abonos still in order documents
    const legacyAbonos = customerOrders.reduce((acc, o) => {
        // We only sum legacy abono IF it exists and wasn't already registered in customerPayments
        // In the new v10 system, we prefer the payments collection.
        let orderTotal = (o.abono || 0);
        if (o.abonoHistory && Array.isArray(o.abonoHistory)) {
            orderTotal += o.abonoHistory.reduce((acc2, ah) => acc2 + (parseInt(ah.amount) || 0), 0);
        }
        return acc + orderTotal;
    }, 0);

    // Global payments from new collection
    const globalAbonos = customerPayments.reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0);
    
    const totalPaid = legacyAbonos + globalAbonos;
    
    return {
      total: totalOrders,
      abonos: totalPaid,
      saldo: totalOrders - totalPaid
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

    // Payments list
    const allAbonos = [];
    customerOrders.forEach(o => {
        if (o.abono > 0) allAbonos.push({ amount: o.abono, date: o.paymentDate });
        if (o.abonoHistory) o.abonoHistory.forEach(ah => allAbonos.push({ amount: ah.amount, date: ah.date }));
    });
    customerPayments.forEach(p => allAbonos.push({ amount: p.amount, date: p.date }));
    
    let paymentsText = "";
    allAbonos.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(a => {
        const dateStr = a.date ? a.date.split('-').reverse().join('/') : 'S/F';
        paymentsText += `📅 Fecha: ${dateStr}: ${formatCurrency(a.amount)}\n`;
    });

    // Build Final Text
    let summaryText = `📋 *ESTADO DE CUENTA CONSOLIDADO* 📋\n`;
    summaryText += `----------------------------------\n`;
    summaryText += `👤 Cliente: *${selectedCustomerName}*\n`;
    summaryText += `👩‍⚕️ Asesor: *${resolvedAdvisor}*\n\n`;
    summaryText += `*Inicio pedido: ${startDate}*\n`;
    summaryText += itemsText;
    summaryText += `----------------------------------\n`;
    summaryText += `💰 *TOTAL DE ESTE SEPARADO: ${formatCurrency(consolidated.total)}*\n\n`;
    summaryText += `💵 *ABONOS*\n`;
    summaryText += paymentsText;
    summaryText += `💰 *TOTAL ABONOS: ${formatCurrency(consolidated.abonos)}*\n\n`;
    summaryText += `💰 *RESTA: ${formatCurrency(consolidated.saldo)}*\n`;
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

  const handleDeleteItem = async (order, itemIndex) => {
    if (isUpdating) return;
    if (!window.confirm("🗑️ ¿Estás seguro de eliminar este producto del pedido?")) return;

    try {
        setIsUpdating(true);
        const updatedItems = order.items.filter((_, idx) => idx !== itemIndex);
        
        if (updatedItems.length === 0) {
            if (window.confirm("⚠️ El pedido quedará vacío. ¿Deseas eliminar todo el pedido?")) {
                await deleteOrder(order.id);
                return;
            } else {
                return;
            }
        }

        // Recalculate total
        const newTotal = updatedItems.reduce((acc, it) => acc + (it.qty * getItemPrice(it, order)), 0);
        
        await updateOrder(order.id, { 
            items: updatedItems,
            total: newTotal 
        });
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
    if (confirm(`⚠️ ¿CONFIRMAS EL DESPACHO TOTAL?\n\nAl confirmar se eliminarán TODOS los pedidos de ${normalizedName} y su historial de pagos para cerrar el ciclo.`)) {
      setIsUpdating(true);
      const success = await purgeCustomerData(normalizedName);
      if (success) {
        setSelectedCustomerName(null);
        alert("✅ Ciclo completado. Cliente y registros eliminados del sistema.");
      }
      setIsUpdating(false);
    }
  };

  const handleToggleSeparado = async (id, currentStatus) => {
    setIsUpdating(true);
    const newStatus = currentStatus === 'separated' ? 'pending' : 'separated';
    await updateOrder(id, { status: newStatus });
    setIsUpdating(false);
  };

  const handleDeleteSinglePayment = async (id) => {
    if (confirm("¿Estás seguro de eliminar este registro de pago?")) {
        await deletePayment(id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content warehouse-modal" onClick={e => e.stopPropagation()}>
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
              <span className="current-name">
                {selectedCustomerName || "Seleccionar un cliente..."}
              </span>
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
                  autoFocus
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

                  return (
                    <button 
                      key={name} 
                      className={`dropdown-item ${selectedCustomerName === name ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCustomerName(name);
                        setShowOrdersList(false);
                      }}
                    >
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
                    {/* Global Payment History for UI */}
                    {(customerPayments.length > 0 || customerOrders.some(o => (o.abono || 0) > 0)) && (
                        <div style={{
                            maxHeight: '100px', 
                            overflowY: 'auto', 
                            fontSize: '0.8rem', 
                            color: '#cbd5e1', 
                            background: 'rgba(0,0,0,0.3)',
                            padding: '10px',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
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
                                        <div key={idx} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                            <span style={{color: '#f8fafc'}}>🔹 Abono Extra:</span>
                                            <span style={{fontWeight: 'bold', color: '#fff'}}>{formatCurrency(ah.amount)} <small style={{opacity: 0.6, fontWeight: 'normal'}}>- {ah.date.split('-').reverse().join('/')}</small></span>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                            {customerPayments.map(p => (
                                <div key={p.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '5px'}}>
                                        <button 
                                            onClick={() => handleDeleteSinglePayment(p.id)}
                                            style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0', fontSize: '0.9rem'}}
                                        >
                                            🗑️
                                        </button>
                                        <span style={{color: '#f8fafc'}}>🔹 {p.advisorName ? p.advisorName : (p.type?.includes('Global') ? 'Abono' : 'Abono Extra')}:</span>
                                    </div>
                                    <span style={{fontWeight: 'bold', color: '#10b981'}}>{formatCurrency(p.amount)} <small style={{opacity: 0.6, fontWeight: 'normal', color: '#fff'}}>- {(p.date || '').split('-').reverse().join('/') || 'S/F'}</small></span>
                                </div>
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
                          <span style={{color: '#1e293b', fontWeight: '900', fontSize: '1rem'}}>{formatCurrency(order.total || 0)}</span>
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
                                <div style={{
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    background: 'rgba(0,0,0,0.08)', 
                                    borderRadius: '8px',
                                    padding: '2px 5px',
                                    border: '1px solid rgba(0,0,0,0.1)'
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
                                    title="Eliminar producto"
                                >
                                    🗑️
                                </button>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                   </div>

                  <button 
                    className="complete-batch-btn" 
                    onClick={() => handleToggleSeparado(order.id, order.status)}
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
