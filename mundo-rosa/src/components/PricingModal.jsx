import React from 'react';

function PricingModal({ isOpen, onSelectMayor, onSelectDetal }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay pricing-modal-overlay">
      <div className="pricing-modal">
        <div className="pricing-modal-header">
          <span className="pricing-modal-icon">💖</span>
          <h2>¡Bienvenid@ a Mundo Rosa!</h2>
          <p>Antes de comenzar, cuéntanos un poco sobre ti:</p>
        </div>

        <div className="pricing-modal-options">
          <div className="pricing-question">
            <span>¿Eres cliente de Mundo Rosa y no han pasado más de 30 días desde tu última compra?</span>
            <button className="pricing-yes-btn" onClick={onSelectMayor}>SÍ</button>
          </div>

          <div className="pricing-divider">ó</div>

          <div className="pricing-question">
            <span>¿Tus compras son superiores a $150.000 en cualquier producto?</span>
            <button className="pricing-yes-btn" onClick={onSelectMayor}>SÍ</button>
          </div>

          <button className="pricing-none-btn" onClick={onSelectDetal}>
            Ninguna de las anteriores
          </button>
        </div>

        <p className="pricing-modal-note">
          ⚠️ La cotización enviada estará sujeta a verificación por parte de nuestras asesoras.
        </p>
      </div>
    </div>
  );
}

export default PricingModal;
