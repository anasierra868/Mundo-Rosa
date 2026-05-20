import React from 'react';

export function CustomerSelector({
    showOrdersList,
    setShowOrdersList,
    isEditingName,
    setIsEditingName,
    tempName,
    setTempName,
    isUpdating,
    handleSaveRename,
    selectedCustomerName,
    setSelectedCustomerName,
    handleReadNote,
    customerNote,
    handleEditNote,
    searchTerm,
    setSearchTerm,
    filterAlerts,
    setFilterAlerts,
    uniqueCustomerNames,
    orders,
    allPayments,
    getBaseName,
    getAlertStatus,
    purgeCustomerData,
    formatCurrency
}) {
    return (
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
                                        if (e.key === 'Enter') {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            handleSaveRename();
                                        }
                                        if (e.key === 'Escape') {
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
                            title="Filtrar pedidos con 10+ días desde el PRIMER abono"
                        >
                            ⚠️
                        </button>
                    </div>

                    {uniqueCustomerNames.length === 0 ? (
                        <p className="empty-msg">{filterAlerts ? "No hay alertas de 10+ días." : "No hay clientes pendientes."}</p>
                    ) : (
                        uniqueCustomerNames.filter(name => {
                            if (!filterAlerts) return true;
                            
                            const cOrders = orders.filter(o => getBaseName(o.code) === name);
                            const cPayments = (allPayments || []).filter(p => (p.customerName || "").trim().toUpperCase() === name.trim().toUpperCase());
                            
                            const validAbonoDates = [];
                            cOrders.forEach(o => {
                                if (Number(o.abono) > 0) {
                                    const d = o.paymentDate ? new Date(o.paymentDate) : (o.createdAt?.toDate ? o.createdAt.toDate() : new Date((o.createdAt?.seconds || 0) * 1000));
                                    if (!isNaN(d.getTime())) validAbonoDates.push(d);
                                }
                                (o.abonoHistory || []).forEach(ah => {
                                    const d = new Date(ah.date);
                                    if (!isNaN(d.getTime())) validAbonoDates.push(d);
                                });
                            });
                            cPayments.forEach(p => {
                                const d = new Date(p.date);
                                if (!isNaN(d.getTime())) validAbonoDates.push(d);
                            });
                            
                            if (validAbonoDates.length === 0) return false;

                            let firstAbono = new Date();
                            validAbonoDates.forEach(d => {
                                if (d < firstAbono) firstAbono = d;
                            });

                            const diff = Math.floor((new Date() - firstAbono) / (1000 * 60 * 60 * 24));
                            return diff >= 10;
                        }).map(name => {
                            const cOrders = orders.filter(o => getBaseName(o.code) === name);
                            const cPayments = (allPayments || []).filter(p => (p.customerName || "").trim().toUpperCase() === name.trim().toUpperCase());
                            const status = getAlertStatus(cOrders, cPayments);

                            // AUTO-PURGE MONITOR v6.0
                            if (status === 'purged' && !isUpdating) {
                                console.warn(`🚨 AUTO-PURGE: Client ${name} reached 14 days without payment. Executing...`);
                                purgeCustomerData(name);
                                return null;
                            }

                            // Totals for balance tag
                            const totalOrders = cOrders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
                            const rawPayments = [];
                            cOrders.forEach(o => {
                                if (Number(o.abono) > 0) rawPayments.push({ amount: Number(o.abono), date: o.paymentDate });
                                (o.abonoHistory || []).forEach(ah => rawPayments.push({ amount: Number(ah.amount), date: ah.date }));
                            });
                            cPayments.forEach(p => rawPayments.push({ amount: Number(p.amount), date: p.date }));
                            const seen = new Set();
                            const uniqueAbonos = [];
                            rawPayments.forEach(p => {
                                const k = `${p.amount}_${p.date}`;
                                if (!seen.has(k)) { uniqueAbonos.push(p); seen.add(k); }
                            });
                            const totalPaid = uniqueAbonos.reduce((acc, p) => acc + p.amount, 0);
                            const balance = totalOrders - totalPaid;

                            // Refined Date Logic for Countdown
                            const parseDate = (d) => {
                                if (!d) return new Date();
                                if (d.toDate) return d.toDate();
                                if (d.seconds) return new Date(d.seconds * 1000);
                                return new Date(d);
                            };

                            const refDate = (() => {
                                if (uniqueAbonos.length > 0) {
                                    let oldest = null;
                                    uniqueAbonos.forEach(p => {
                                        const d = new Date(p.date);
                                        if (!isNaN(d.getTime())) {
                                            if (oldest === null || d < oldest) oldest = d;
                                        }
                                    });
                                    return oldest === null ? (cOrders[0] ? parseDate(cOrders[0].createdAt) : new Date()) : oldest;
                                } else {
                                    let old = new Date();
                                    cOrders.forEach(o => { const d = parseDate(o.createdAt); if(d < old) old = d; });
                                    return old;
                                }
                            })();
                            const diff = Math.floor((new Date() - refDate) / (1000 * 60 * 60 * 24));

                            // Icon Logic (User Specs)
                            let displayIcon = "";
                            if (balance <= 0) {
                                displayIcon = "✅";
                            } else if (uniqueAbonos.length === 0) {
                                displayIcon = `💰 ${diff}d`;
                            } else {
                                displayIcon = `📦 ${diff}d`; // Regalito for those with payments
                            }

                            return (
                                <button 
                                    key={name} 
                                    className={`dropdown-item ${selectedCustomerName === name ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedCustomerName(name);
                                        localStorage.setItem('lastSelectedCustomer', name);
                                        setShowOrdersList(false);
                                    }}
                                >
                                    <div style={{display: 'flex', alignItems: 'center', width: '100%'}}>
                                        <span style={{ fontSize: '0.75rem', marginRight: '8px', opacity: 1, minWidth: '45px', textAlign: 'center' }}>{displayIcon}</span>
                                        <span className={`status-dot ${status}`}></span>
                                        <span className="item-name-text" style={{flex: 1, textAlign: 'left'}}>{name}</span>
                                        <span style={{
                                            background: balance <= 0 ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                                            color: '#fff',
                                            padding: '2px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            border: balance <= 0 ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                                            minWidth: '80px',
                                            textAlign: 'right'
                                        }}>
                                            {formatCurrency(balance)}
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
