import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles/tokens.css';
import './styles/base.css';
import { ToastProvider, TooltipProvider } from './components/ui/index.js';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          <Routes>
            <Route path="*" element={<App />} />
          </Routes>
        </TooltipProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
