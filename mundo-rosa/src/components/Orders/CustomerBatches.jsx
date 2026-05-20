import React from 'react';

export function CustomerBatches({
    selectedCustomerName,
    customerOrders,
    catalog,
    isUpdating,
    formatCurrency,
    getItemPrice,
    handleDeleteFullOrder,
    handleUpdateItemQty,
    handleMarkAsSoldOut,
    handleDeleteItem,
    handleToggleSeparado,
    itemSearchText,
    setItemSearchText,
    handleAddItemToOrder,
    consolidated,
    allDomicilios,
    handleComplete
}) {
    return (
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
                            🗓️ Asignado hace {(() => {
                                const now = new Date();
                                let d;
                                if (order.createdAt?.toDate) d = order.createdAt.toDate();
                                else if (order.createdAt?.seconds) d = new Date(order.createdAt.seconds * 1000);
                                else if (order.createdAt) d = new Date(order.createdAt);
                                else d = now;
                                return Math.floor(Math.abs(now - d) / (1000 * 60 * 60 * 24));
                            })()} día(s)
                          </span>
                       </div>
                    </div>
                    <span className="batch-type" style={{ background: order.status === 'separated' ? '#ea580c' : 'rgba(255,255,255,0.1)' }}>{order.type}</span>
                  </div>

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
                            {order.createdAt ? (() => {
                                let d;
                                if (order.createdAt.toDate) d = order.createdAt.toDate();
                                else if (order.createdAt.seconds) d = new Date(order.createdAt.seconds * 1000);
                                else d = new Date(order.createdAt);
                                return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                            })() : 'S/F'}
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
                             <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px'}}>
                               <span className="item-name" style={{fontSize: '0.85rem', fontWeight: '500'}}>{item.name}</span>
                               {catalogProduct?.sku && (
                                 <span style={{
                                   background: '#1e293b', 
                                   color: '#f97316', 
                                   padding: '2px 8px', 
                                   borderRadius: '6px', 
                                   fontSize: '0.65rem', 
                                   fontWeight: '900',
                                   border: '1px solid #f97316'
                                 }}>
                                   📍 {catalogProduct.sku.toUpperCase()}
                                 </span>
                               )}
                               <span style={{
                                 background: 'rgba(124, 58, 237, 0.1)', 
                                 color: '#7c3aed', 
                                 padding: '2px 8px', 
                                 borderRadius: '6px', 
                                 fontSize: '0.65rem', 
                                 fontWeight: '900',
                                 border: '1px solid rgba(124, 58, 237, 0.2)'
                               }}>
                                 📦 Stock: {
                                   (catalogProduct && catalogProduct.stock !== null && catalogProduct.stock !== undefined && String(catalogProduct.stock).trim() !== '' && String(catalogProduct.stock).toLowerCase() !== 'infinito' && String(catalogProduct.stock).toLowerCase() !== 'infinity' && String(catalogProduct.stock) !== '♾️')
                                   ? catalogProduct.stock
                                   : '♾️'
                                 }
                               </span>
                             </div>
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
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#fff',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                            border: '1px solid #7c3aed',
                            zIndex: 999,
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
                                                {formatCurrency(p.mayor)} Mayor | {formatCurrency(p.detal)} Detal | Stock: {
                                                    (p.stock !== null && p.stock !== undefined && String(p.stock).trim() !== '' && String(p.stock).toLowerCase() !== 'infinito' && String(p.stock).toLowerCase() !== 'infinity' && String(p.stock) !== '♾️')
                                                    ? p.stock
                                                    : '♾️'
                                                }
                                            </div>
                                        </div>
                                        <div style={{ color: '#7c3aed', fontSize: '1.2rem' }}>⊕</div>
                                    </div>
                                ))
                            }
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

          {selectedCustomerName && customerOrders.length > 0 && (() => {
              const allSeparated = customerOrders.every(o => o.status === 'separated');
              const balanceOk = consolidated.saldo <= 0;
              const isDomicilio = allDomicilios.some(d => 
                  (d.customerName || '').trim().toUpperCase() === (selectedCustomerName || '').trim().toUpperCase()
              );

              const canDispatch = allSeparated && (balanceOk || isDomicilio);
              
              let buttonText = '🚀 PEDIDO DESPACHADO (CERRAR CLIENTE)';
              if (!allSeparated) buttonText = '⚠️ FALTAN PEDIDOS POR SEPARAR';
              else if (!balanceOk && !isDomicilio) buttonText = '⚠️ SALDO PENDIENTE (SIN PAGAR)';

              return (
                <div style={{ padding: '20px 15px 40px' }}>
                    <button 
                        className="complete-batch-btn"
                        onClick={handleComplete}
                        disabled={isUpdating || !canDispatch}
                        style={{
                            background: canDispatch ? 'linear-gradient(90deg, #ef4444, #b91c1c)' : '#64748b',
                            padding: '18px',
                            fontSize: '1rem',
                            boxShadow: canDispatch ? '0 4px 15px rgba(239, 68, 68, 0.4)' : 'none',
                            border: '2px solid rgba(255,255,255,0.2)',
                            cursor: canDispatch ? 'pointer' : 'not-allowed',
                            color: canDispatch ? '#fff' : '#94a3b8'
                        }}
                    >
                        {buttonText}
                    </button>
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '10px' }}>
                       *Esta acción borrará todos los abonos y pedidos de este cliente.
                    </p>
                </div>
              );
          })()}
        </div>
    );
}
