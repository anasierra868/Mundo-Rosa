import { useState, useEffect } from 'react';
import { onTimersUpdate, startCustomerTimer } from '../../utils/db';

export function useOrderTimers(selectedCustomerName) {
   const [activeTimers, setActiveTimers] = useState([]);
   const [showTimersPanel, setShowTimersPanel] = useState(false);
   const [timerTick, setTimerTick] = useState(0);
   const [notifiedTimers, setNotifiedTimers] = useState(new Set()); // v3.0

    useEffect(() => {
      const unsub = onTimersUpdate(setActiveTimers);
      return () => {
          if (unsub && typeof unsub === 'function') unsub();
      };
    }, []);

   useEffect(() => {
     const interval = setInterval(() => setTimerTick(t => t + 1), 1000);
     return () => clearInterval(interval);
   }, []);

   // ALARM MONITOR v3.0
   useEffect(() => {
     if (!activeTimers || activeTimers.length === 0) return;

     activeTimers.forEach(timer => {
       if (notifiedTimers.has(timer.id)) return;

       // Parse startedAt: PocketBase guarda un string ISO, NO un Firebase Timestamp
       const startedAt = timer.startedAt
           ? new Date(timer.startedAt)
           : new Date(timer.created || new Date());
       const now = new Date();
       const elapsed = now - startedAt;
       const durationMs = parseInt(timer.durationMs) || (15 * 60 * 1000);
       const remaining = durationMs - elapsed;

       if (remaining <= 0) {
         // EXPIRED! Trigger Alarm
         playTimerAlarm(timer.customerName);
         setNotifiedTimers(prev => new Set([...prev, timer.id]));
       }
     });
   }, [activeTimers, timerTick, notifiedTimers]);

   const playTimerAlarm = (customerName) => {
     let count = 0;
     const ring = () => {
       try {
         // 1. Voice Notification (Premium feel)
         if ('speechSynthesis' in window) {
           const msg = new SpeechSynthesisUtterance(`Atención. El tiempo del cliente ${customerName} se ha agotado.`);
           msg.lang = 'es-ES';
           msg.rate = 0.9;
           window.speechSynthesis.speak(msg);
         }

         // 2. Beep (Context Audio)
         const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
         const oscillator = audioCtx.createOscillator();
         const gainNode = audioCtx.createGain();

         oscillator.type = 'triangle';
         oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
         oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5); // Slide to A5
         
         gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
         gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
         gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

         oscillator.connect(gainNode);
         gainNode.connect(audioCtx.destination);

         oscillator.start();
         oscillator.stop(audioCtx.currentTime + 1.5);
       } catch (e) {
         console.warn("Audio alarm blocked by browser policy:", e);
       }
       
       count++;
       if (count < 3) {
         setTimeout(ring, 5000); // Repetir cada 5 segundos
       }
     };
     
     ring();
   };

   const handleStartTimer = async () => {
     if (!selectedCustomerName) return;
     await startCustomerTimer(selectedCustomerName, 15);
     alert(`\u23f1\ufe0f Temporizador iniciado localmente para ${selectedCustomerName}`);
   };

   return {
       activeTimers,
       showTimersPanel,
       setShowTimersPanel,
       timerTick,
       handleStartTimer
   };
}
