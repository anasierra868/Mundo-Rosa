import { useState, useEffect } from 'react';
import { 
  addPayment, 
  updateOrder, 
  addCODPayment, 
  updatePayment, 
  ADVISOR_CODES,
  toBase64,
  compressImage 
} from '../../utils/db';

export function useOrderFinance({
  selectedCustomerName,
  customerOrders,
  orders,
  allPayments,
  isUpdating,
  setIsUpdating,
  executeConsolidatedCopy
}) {
  // states
  const [showAbonoForm, setShowAbonoForm] = useState(false);
  const [showDomicilioForm, setShowDomicilioForm] = useState(false);
  const [showSaldoFavorForm, setShowSaldoFavorForm] = useState(false);

  const [newAbonoAmount, setNewAbonoAmount] = useState('');
  const [newDomicilioAmount, setNewDomicilioAmount] = useState('');
  const [newAbonoDate, setNewAbonoDate] = useState(new Date().toISOString().split('T')[0]);

  const [domicilioAdvisorCode, setDomicilioAdvisorCode] = useState('');
  const [domicilioAdvisorName, setDomicilioAdvisorName] = useState(null);

  const [advisorCode, setAdvisorCode] = useState('');
  const [advisorName, setAdvisorName] = useState(null);
  const [receiptImage, setReceiptImage] = useState(null);

  const [saldoFavorAmount, setSaldoFavorAmount] = useState('');
  const [saldoFavorCode, setSaldoFavorCode] = useState('');
  const [saldoFavorAdvisorName, setSaldoFavorAdvisorName] = useState(null);

  const [advisorAuthCode, setAdvisorAuthCode] = useState('');
  const [authModalConfig, setAuthModalConfig] = useState({ 
      isOpen: false, 
      actionType: null, // 'copy' or 'edit_payment'
      data: null,       // extra data for the action
      title: '🔒 Acceso de Asesor',
      description: 'Ingresa tu código para autorizar esta acción.'
  });

  // Watch for advisor codes silently in UI
  useEffect(() => {
    const code = domicilioAdvisorCode.trim();
    setDomicilioAdvisorName(ADVISOR_CODES[code] || null);
  }, [domicilioAdvisorCode]);

  useEffect(() => {
    const code = advisorCode.trim();
    setAdvisorName(ADVISOR_CODES[code] || null);
  }, [advisorCode]);

  useEffect(() => {
    const code = saldoFavorCode.trim();
    setSaldoFavorAdvisorName(ADVISOR_CODES[code] || null);
  }, [saldoFavorCode]);

  // Handlers
  const handleRegisterDomicilio = async () => {
      if (!selectedCustomerName) return alert("❌ Selecciona un cliente primero.");
      if (!newDomicilioAmount || isNaN(parseInt(newDomicilioAmount))) return alert("⚠️ Ingresa un monto válido.");
      
      const resolvedAdvisor = ADVISOR_CODES[domicilioAdvisorCode.trim()];
      if (!resolvedAdvisor) return alert("❌ Código de asesor inválido o vacío.");

      setIsUpdating(true);
      try {
          await addCODPayment({
              customerName: selectedCustomerName,
              amount: parseInt(newDomicilioAmount),
              advisorName: resolvedAdvisor,
              date: new Date().toISOString().split('T')[0]
          });
          alert(`✅ Domicilio de $${parseInt(newDomicilioAmount).toLocaleString()} registrado.`);
          setNewDomicilioAmount('');
          setDomicilioAdvisorCode('');
          setDomicilioAdvisorName(null);
          setShowDomicilioForm(false);
      } catch (e) {
          alert("❌ Error al registrar domicilio.");
      } finally {
          setIsUpdating(false);
      }
  };

  const handleRegisterGlobalAbono = async () => {
    console.group('🟣 [ABONO] BOTÓN PRESIONADO — Inicio del flujo');
    if (!selectedCustomerName) {
        console.groupEnd();
        return alert("❌ Selecciona un cliente primero.");
    }
    if (!newAbonoAmount || parseInt(newAbonoAmount) <= 0) {
        console.groupEnd();
        return alert("⚠️ Ingresa un monto válido.");
    }
    
    const resolvedAdvisor = ADVISOR_CODES[advisorCode.trim()];
    if (!resolvedAdvisor) {
        console.groupEnd();
        return alert("🔒 Código de asesor inválido.");
    }

    setIsUpdating(true);
    try {
        const finalReceipt = receiptImage ? await compressImage(receiptImage, 800, 0.6) : "";
        const basePaymentData = {
            customerName: selectedCustomerName,
            amount: parseInt(newAbonoAmount.toString().replace(/\D/g, '')),
            date: newAbonoDate,
            advisorName: resolvedAdvisor,
            receiptImage: finalReceipt,
            image: finalReceipt
        };

        const auditRecord = await addPayment({ ...basePaymentData, type: "abono" });
        const orderToUpdate = customerOrders[0];
        const currentHistory = orderToUpdate.abonoHistory || [];
        const newHistoryItem = {
            amount: basePaymentData.amount,
            date: basePaymentData.date,
            advisorName: basePaymentData.advisorName,
            globalId: auditRecord?.id || null,
            type: "abono"
        };
        
        const warehouseSuccess = await updateOrder(orderToUpdate.id, {
            abonoHistory: [...currentHistory, newHistoryItem]
        });

        if (auditRecord && warehouseSuccess) {
            console.groupEnd();
            alert(`✅ Abono de $${basePaymentData.amount.toLocaleString()} procesado y sincronizado.`);
            setNewAbonoAmount('');
            setReceiptImage(null);
            setShowAbonoForm(false);
            setAdvisorCode('');
            setAdvisorName(null);
        } else {
            console.groupEnd();
            alert("❌ El servidor no respondió. Verifica tu internet.");
        }
    } catch (e) {
        console.groupEnd();
        alert("⚠️ Error de conexión: " + e.message);
    } finally {
        setIsUpdating(false);
    }
  };

  const handleEditPaymentAmount = async (payment) => {
    const newAmountStr = prompt(`💵 Modificar abono de ${payment.advisorName || 'Asesor'}\nNuevo monto para este abono:`, payment.amount);
    if (newAmountStr === null) return;
    
    const newAmount = parseInt(newAmountStr.replace(/\D/g, ''));
    if (isNaN(newAmount) || newAmount <= 0) return alert("⚠️ Ingresa un monto válido.");

    setAdvisorAuthCode(''); 
    setAuthModalConfig({
        isOpen: true,
        actionType: 'edit_payment',
        data: { payment, newAmount },
        title: '🔒 Autorizar Cambio de Abono',
        description: `Modificar abono de $${payment.amount} a $${newAmount}.`
    });
  };

  const handleEditPaymentDate = async (payment) => {
    const newDate = prompt(`📅 Modificar fecha de abono de ${payment.advisorName || 'Asesor'}\nIngrese la nueva fecha (formato AAAA-MM-DD, ej. 2026-05-15):`, payment.date || new Date().toISOString().split('T')[0]);
    if (newDate === null) return;
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(newDate)) return alert("⚠️ Formato de fecha inválido. Debe ser AAAA-MM-DD.");
    
    const parsedDate = new Date(newDate + 'T00:00:00');
    if (isNaN(parsedDate.getTime())) return alert("⚠️ Fecha inválida.");

    setAdvisorAuthCode(''); 
    setAuthModalConfig({
        isOpen: true,
        actionType: 'edit_payment_date',
        data: { payment, newDate },
        title: '🔒 Autorizar Cambio de Fecha de Abono',
        description: `Modificar fecha de abono de ${payment.date ? payment.date.split('-').reverse().join('/') : 'S/F'} a ${newDate.split('-').reverse().join('/')}.`
    });
  };

  const handleConfirmAuth = async () => {
    const code = advisorAuthCode.trim();
    const advisor = ADVISOR_CODES[code];
    
    if (!advisor) {
        alert("❌ Código de asesor inválido. Verifica e intenta de nuevo.");
        return;
    }

    const { actionType, data } = authModalConfig;

    if (actionType === 'copy') {
        executeConsolidatedCopy(code);
        setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
    } 
    else if (actionType === 'edit_payment') {
        const { payment, newAmount } = data;
        setIsUpdating(true);
        try {
            let targetGlobalId = payment.globalId;
            
            if (!targetGlobalId) {
                const matchedGlobal = (allPayments || []).find(ap => 
                    ap.customerName === selectedCustomerName && 
                    parseInt(ap.amount) === parseInt(payment.amount) && 
                    ap.date === payment.date &&
                    (ap.advisorName === payment.advisorName || !payment.advisorName)
                );

                if (matchedGlobal) {
                    targetGlobalId = matchedGlobal.id;
                }
            }

            let auditSuccess = true;
            if (targetGlobalId) {
                auditSuccess = await updatePayment(targetGlobalId, { 
                    amount: newAmount,
                    type: (payment.type || 'abono').includes('_modificado') ? payment.type : `${payment.type || 'abono'}_modificado`
                });
            }

            const orderWithPayment = orders.find(o => 
                (o.abonoHistory || []).some(ah => {
                    if (targetGlobalId && ah.globalId === targetGlobalId) return true;
                    return ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date;
                })
            );

            let warehouseSuccess = true;
            if (orderWithPayment) {
                const newHistory = orderWithPayment.abonoHistory.map(ah => {
                    const isMatch = targetGlobalId 
                        ? (ah.globalId === targetGlobalId || (ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date))
                        : (ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date);
                    
                    if (isMatch) {
                        return { ...ah, amount: newAmount, isModified: true, globalId: targetGlobalId || ah.globalId };
                    }
                    return ah;
                });
                warehouseSuccess = await updateOrder(orderWithPayment.id, { abonoHistory: newHistory });
            }

            if (auditSuccess && warehouseSuccess) {
                setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
                setAdvisorAuthCode('');
            } else {
                alert("❌ Error al sincronizar. Se actualizó el almacén pero no se encontró el registro en Consultar Abonos.");
            }
        } catch (e) {
            console.error("Error updating payment:", e);
            alert("❌ Error técnico al actualizar.");
        } finally {
            setIsUpdating(false);
        }
    }
    else if (actionType === 'edit_payment_date') {
        const { payment, newDate } = data;
        setIsUpdating(true);
        try {
            let targetGlobalId = payment.globalId;
            
            if (!targetGlobalId) {
                const matchedGlobal = (allPayments || []).find(ap => 
                    ap.customerName === selectedCustomerName && 
                    parseInt(ap.amount) === parseInt(payment.amount) && 
                    ap.date === payment.date &&
                    (ap.advisorName === payment.advisorName || !payment.advisorName)
                );

                if (matchedGlobal) {
                    targetGlobalId = matchedGlobal.id;
                }
            }

            let auditSuccess = true;
            if (targetGlobalId) {
                auditSuccess = await updatePayment(targetGlobalId, { 
                    date: newDate,
                    type: (payment.type || 'abono').includes('_modificado') ? payment.type : `${payment.type || 'abono'}_modificado`
                });
            }

            const orderWithPayment = orders.find(o => 
                (o.abonoHistory || []).some(ah => {
                    if (targetGlobalId && ah.globalId === targetGlobalId) return true;
                    return ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date;
                })
            );

            let warehouseSuccess = true;
            if (orderWithPayment) {
                const newHistory = orderWithPayment.abonoHistory.map(ah => {
                    const isMatch = targetGlobalId 
                        ? (ah.globalId === targetGlobalId || (ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date))
                        : (ah.amount === payment.amount && ah.advisorName === payment.advisorName && ah.date === payment.date);
                    
                    if (isMatch) {
                        return { ...ah, date: newDate, isModified: true, globalId: targetGlobalId || ah.globalId };
                    }
                    return ah;
                });
                warehouseSuccess = await updateOrder(orderWithPayment.id, { abonoHistory: newHistory });
            }

            if (auditSuccess && warehouseSuccess) {
                setAuthModalConfig(prev => ({ ...prev, isOpen: false }));
                setAdvisorAuthCode('');
            } else {
                alert("❌ Error al sincronizar. Se actualizó el almacén pero no se encontró el registro en Consultar Abonos.");
            }
        } catch (e) {
            console.error("Error updating payment date:", e);
            alert("❌ Error técnico al actualizar la fecha.");
        } finally {
            setIsUpdating(false);
        }
    }
  };

  const handleRegisterSaldoFavor = async () => {
    if (!saldoFavorAmount || isUpdating || !selectedCustomerName) return;
    const resolvedAdvisor = ADVISOR_CODES[saldoFavorCode.trim()];
    if (!resolvedAdvisor) return alert('❌ Código de asesor inválido.');
    const amount = parseInt(saldoFavorAmount);
    if (!amount || amount <= 0) return alert('❌ Ingresa un monto válido.');

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
            type: 'Saldo a Favor',
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

  return {
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
  };
}
