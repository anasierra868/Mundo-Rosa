import React from 'react';

function Hero() {
  return (
    <section className="hero">
      <div className="container" style={{ textAlign: 'center' }}>
        <img 
          src={`${import.meta.env.BASE_URL}logo-mundo-rosa.jpg`} 
          alt="Mundo Rosa Logo Principal" 
          style={{ height: '180px', width: '180px', objectFit: 'cover', borderRadius: '50%', marginBottom: '20px', boxShadow: '0 10px 25px rgba(255,126,179,0.3)', border: '4px solid white' }} 
        />
        <h1 className="hero-subtitle">Detalles que Enamoran</h1>
        <p>La magia de regalar, con la elegancia que mereces.</p>
      </div>
    </section>
  );
}

export default Hero;
