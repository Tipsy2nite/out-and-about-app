import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import App from './App.jsx';

// Remember the browser's "install this app" offer so the Install button can use it later
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__oaInstallPrompt = e;
  window.dispatchEvent(new Event('oa-install-ready'));
});
window.addEventListener('appinstalled', () => {
  window.__oaInstallPrompt = null;
  window.dispatchEvent(new Event('oa-installed'));
});

// Lets the site install like an app and open offline (production only)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
