import React from 'react';

function SettingsModal({ isOpen, onClose, apiKey, firebaseConfig, onSave }) {
  if (!isOpen) return null;

  const handleSave = () => {
    const key = document.getElementById('api-key-input-field').value;
    const config = document.getElementById('firebase-config-input-field').value;
    onSave(key, config);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content api-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configuración Avanzada</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Gemini API Key</label>
            <input 
              type="password" 
              placeholder="Introducir API Key..." 
              className="api-input"
              id="api-key-input-field"
              defaultValue={apiKey}
            />
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '8px', fontWeight: 'bold'}}>Firebase Config (JSON)</label>
            <textarea 
              placeholder='Pega aquí el objeto firebaseConfig de tu consola...' 
              className="api-input"
              style={{height: '100px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical'}}
              id="firebase-config-input-field"
              defaultValue={firebaseConfig}
            ></textarea>
            <small style={{display: 'block', marginTop: '4px', opacity: 0.7}}>Para habilitar la sincronización en la nube.</small>
          </div>
          
          <button className="save-btn" onClick={handleSave}>
            Guardar Configuración
          </button>
          <p style={{marginTop: '15px', fontSize: '0.75rem', textAlign: 'center'}}>La configuración se guarda localmente en tu navegador.</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
