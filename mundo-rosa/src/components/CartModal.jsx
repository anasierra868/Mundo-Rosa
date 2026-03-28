import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';

function CartModal({ cart, isOpen, onClose, onCheckout, onRemoveItem, formatCurrency, cartTotal, priceType }) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const cartRef = useRef(null);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!cartRef.current || cart.length === 0) return;
    setIsGenerating(true);
    
    // Generar el texto de respaldo por si la imagen falla
    const itemsText = cart.map(item =>
      `${item.quantity}x ${item.name} - Subtotal: ${formatCurrency(item.price * item.quantity)}`
    ).join('\n');
    const fallbackText = `💖 PEDIDO - MUNDO ROSA 💖\n----------------------------------\n\n${itemsText}\n\n----------------------------------\n💰 TOTAL A PAGAR: ${formatCurrency(cartTotal)}\n⚠️ La cotización está sujeta a verificación por parte de nuestras asesoras.`;

    try {
      // Escala dinámica: calidad regular para móviles (más rápido), retina para PC
      const isMobile = window.innerWidth <= 600;
      const captureScale = isMobile ? 1 : 2;

      // Tomar una foto del contenedor del carrito
      const canvas = await html2canvas(cartRef.current, { 
        useCORS: true, 
        scale: captureScale, 
        backgroundColor: '#ffffff' 
      });

      canvas.toBlob(async (blob) => {
        try {
          if (!blob) throw new Error("Error procesando imagen");

          // 1. Prioridad: "Web Share API" nativo celular
          const file = new File([blob], 'Mi_Pedido_Mundo_Rosa.png', { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Cotización Mundo Rosa',
              text: '💖 Hola, quiero verificar este pedido con ustedes:'
            });
            onCheckout(); // Reinicia el carrito
            return;
          }

          // 2. Respaldo Desktop: Usar API del Portapapeles Web
          if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([
              new window.ClipboardItem({ 'image/png': blob })
            ]);
            setCopied(true);
            setTimeout(() => {
              setCopied(false);
              onCheckout(); 
            }, 3000);
            return;
          }

          throw new Error("Ni Web Share ni Clipboard soportados en este navegador");

        } catch(err) {
          console.error("Error al exportar imagen:", err);
          // 3. Fallback a texto
          navigator.clipboard.writeText(fallbackText).catch(()=>{});
          onCheckout();
        } finally {
          setIsGenerating(false);
        }
      }, 'image/png', 1.0);

    } catch (err) {
      console.error("Error capturando el carrito:", err);
      // Fallback a texto
      navigator.clipboard.writeText(fallbackText);
      onCheckout();
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        
        {/* Contenedor que será fotografiado por html2canvas */}
        <div ref={cartRef} style={{ padding: '20px', backgroundColor: 'white', borderRadius: '15px' }}>
          <div className="modal-header" style={{ marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>Tu Pedido - Mundo Rosa</h2>
            {/* Ocultamos el boton cerrar en la foto si podemos */}
          </div>

          <div className="cart-items" style={{ maxHeight: 'none', overflow: 'visible' }}>
            {cart.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px 0'}}>
                <p>Aún no has añadido nada.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.id} className="cart-item" style={{ display: 'flex', gap: '15px', padding: '15px 0', borderBottom: '1px solid #eee' }}>
                  <img src={item.image} className="cart-item-img" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '10px' }} alt={item.name} />
                  <div className="cart-item-info">
                    <strong style={{ display: 'block', fontSize: '1.05rem', marginBottom: '5px' }}>{item.name}</strong>
                    <small style={{ color: '#666' }}>{item.quantity} x {formatCurrency(item.price)}</small>
                    <br />
                    {/* Boton de quitar oculto durante la generacion de imagen mediante opacidad si es necesario, o lo dejamos ya que da igual */}
                    {!isGenerating && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        style={{color: '#ff758c', background: 'none', padding: '5px 0', fontSize: '0.8rem', border: 'none', cursor: 'pointer'}}
                      >
                        Quitar ítem
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {cart.length > 0 && (
            <div className="cart-total-section" style={{ paddingTop: '20px', borderTop: '2px dashed #eee', marginTop: '10px' }}>
              <div className="cart-total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 'bold', color: '#ff758c' }}>
                <span>Total</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div style={{ textAlign: 'right', marginTop: '5px', fontSize: '0.9rem', color: '#666' }}>
                Tipo de precio: <strong>{priceType === 'mayor' ? 'Por Mayor' : 'Al Detal'}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Botones de acción (fuera de la captura) */}
        {cart.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <button 
              className="whatsapp-btn copy-quote-btn" 
              onClick={handleCopy}
              disabled={isGenerating}
            >
              {isGenerating ? '📸 Procesando Imagen...' : 
               copied ? '✅ ¡Listo! Pégalo en WhatsApp' : '📋 Compartir / Copiar Imagen'}
            </button>
            <button className="close-btn" style={{ position: 'absolute', top: '15px', right: '15px' }} onClick={onClose}>×</button>

            {copied && (
              <p className="copy-hint" style={{ color: '#10b981', fontWeight: 'bold' }}>
                Ve a WhatsApp y usa "Pegar" (Ctrl+V) en el chat de tu asesora 🖼️.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CartModal;
