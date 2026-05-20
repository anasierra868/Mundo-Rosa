import React from 'react';

export function OrderForms({
  showAbonoForm,
  showDomicilioForm,
  showSaldoFavorForm,

  newAbonoAmount, setNewAbonoAmount,
  newAbonoDate, setNewAbonoDate,
  advisorCode, setAdvisorCode,
  advisorName,
  receiptImage,
  handleRegisterGlobalAbono,
  handlePasteReceipt,

  newDomicilioAmount, setNewDomicilioAmount,
  domicilioAdvisorCode, setDomicilioAdvisorCode,
  domicilioAdvisorName,
  handleRegisterDomicilio,

  saldoFavorAmount, setSaldoFavorAmount,
  saldoFavorCode, setSaldoFavorCode,
  saldoFavorAdvisorName,
  handleRegisterSaldoFavor,

  isUpdating
}) {
  return (
    <>
      {/* 1. DOMICILIO FORM */}
      {showDomicilioForm && (
          <div style={{
              marginTop: '8px', 
              background: 'rgba(245, 158, 11, 0.1)', 
              padding: '12px', 
              borderRadius: '12px', 
              border: '1px solid rgba(245, 158, 11, 0.3)',
              animation: 'fadeIn 0.3s ease'
          }}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <div style={{display: 'flex', gap: '8px'}}>
                      <input 
                          type="number"
                          placeholder="Valor del domicilio..."
                          value={newDomicilioAmount}
                          onChange={(e) => setNewDomicilioAmount(e.target.value)}
                          style={{
                              flex: 1, 
                              background: '#0f172a', 
                              border: '1px solid #334155', 
                              color: '#fff', 
                              padding: '10px', 
                              borderRadius: '8px',
                              fontSize: '0.9rem'
                          }}
                      />
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <input 
                          type="password"
                          placeholder="🔒 Código de asesor"
                          value={domicilioAdvisorCode}
                          maxLength={4}
                          onChange={(e) => setDomicilioAdvisorCode(e.target.value)}
                          style={{
                              flex: 1, 
                              background: '#000', 
                              border: `1px solid ${domicilioAdvisorName ? '#f59e0b' : '#334155'}`, 
                              borderRadius: '8px', 
                              padding: '8px', 
                              color: '#fff', 
                              fontSize: '0.9rem', 
                              letterSpacing: '3px'
                          }}
                      />
                      {domicilioAdvisorName && (
                          <span style={{fontSize: '0.75rem', color: '#f59e0b', fontWeight: 'bold', whiteSpace: 'nowrap'}}>
                              ✅ {domicilioAdvisorName}
                          </span>
                      )}
                  </div>
                  <button 
                      onClick={handleRegisterDomicilio}
                      disabled={isUpdating || !domicilioAdvisorName || !newDomicilioAmount}
                      style={{
                          background: (domicilioAdvisorName && newDomicilioAmount) ? '#f59e0b' : '#475569', 
                          color: '#fff', 
                          border: 'none', 
                          padding: '10px 15px', 
                          borderRadius: '8px', 
                          fontWeight: 'bold',
                          cursor: (domicilioAdvisorName && newDomicilioAmount) ? 'pointer' : 'not-allowed',
                          transition: 'background 0.3s'
                      }}
                  >
                      CONFIRMAR 🛵
                  </button>
              </div>
          </div>
      )}

      {/* 2. ABONO FORM */}
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
                      onChange={(e) => setAdvisorCode(e.target.value)}
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

      {/* 3. SALDO A FAVOR FORM */}
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
                      onChange={(e) => setSaldoFavorCode(e.target.value)}
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
    </>
  );
}
