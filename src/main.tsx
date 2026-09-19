import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Telegram WebApp initialization helper
declare global {
  interface Window {
    telegramInitData?: string;
    telegramUser?: any;
    Telegram?: {
      WebApp: any;
    };
  }
}

function TelegramInitWrapper() {
  useEffect(() => {
    // Wait for Telegram WebApp to be ready
    const initTelegram = () => {
      if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Expand to full height
        tg.expand();
        
        // Set header color
        tg.setHeaderColor('#0b0f12');
        tg.setBackgroundColor('#0b0f12');
        
        // Ready signal
        tg.ready();
        
        console.log('[Telegram WebApp] Ready', tg.initDataUnsafe?.user);
      }
    };
    
    initTelegram();
  }, []);
  
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TelegramInitWrapper />
    <App />
  </StrictMode>,
);
