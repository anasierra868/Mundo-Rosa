import React, { useState, useEffect, useRef } from 'react';

export default function DraggableRefresh() {
  // Anclaje inicial: Lado izquierdo v3.0 (x: 15)
  const [position, setPosition] = useState({ x: 15, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    hasMoved.current = false;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    startPos.current = { ...position };
    pointerStart.current = { x: clientX, y: clientY };
    
    if (!e.touches) e.preventDefault(); 
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const dx = clientX - pointerStart.current.x;
    const dy = clientY - pointerStart.current.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      hasMoved.current = true;
    }

    const newX = Math.max(0, Math.min(window.innerWidth - 60, startPos.current.x + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 60, startPos.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handlePointerMove);
      window.addEventListener('mouseup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove, { passive: false });
      window.addEventListener('touchend', handlePointerUp);
    } else {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div
      className="mobile-refresh-btn"
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onClick={(e) => {
        if (hasMoved.current) {
          e.preventDefault();
        } else {
          window.location.reload(true);
        }
      }}
      style={{
        position: 'fixed',
        left: position.x + 'px',
        top: position.y + 'px',
        background: 'rgba(255, 126, 179, 0.3)', 
        borderRadius: '50%', 
        color: '#FF758C', // Rosa oscuro distinto al rojo y al translúcido
        width: '56px', 
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(255, 126, 179, 0.15)',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 99999,
        userSelect: 'none',
        touchAction: 'none' 
      }}
    >
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ 
          width: '55%', 
          height: '55%', 
          filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' 
        }}
      >
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
    </div>
  );
}
