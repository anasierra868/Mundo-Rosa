import React, { useState, useEffect } from 'react';

const AuthModal = ({ isOpen, onAuthenticate, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const SECRET = "Ana_45003235";

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(false);
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === SECRET) {
      sessionStorage.setItem('MUNDOROSA_LOGGED_IN', 'true');
      onAuthenticate();
      setPassword('');
    } else {
      setError(true);
      setTimeout(() => setError(false), 500);
      setPassword('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay auth-overlay" onClick={onClose}>
      <div className={`modal-content auth-modal ${error ? 'shake' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="auth-header">
          <div className="auth-icon">🛡️</div>
          <h2>Acceso Protegido</h2>
          <p>Por favor, ingresa la clave de seguridad para continuar.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              autoFocus
              className={error ? 'error' : ''}
            />
          </div>
          <button type="submit" className="auth-submit">
            Desbloquear Panel
          </button>
        </form>

        <button className="auth-close" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
};

export default AuthModal;
