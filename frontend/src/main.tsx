import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './i18n'

// Installed to a home screen the app owns the whole display, including the
// strip behind the Dynamic Island. iOS is supposed to report that strip
// through env(safe-area-inset-top), but an app installed before the status-bar
// meta tag was settled keeps the old behaviour and reports nothing, which puts
// the header under the clock. Marking standalone lets the stylesheet hold back
// a status bar's worth of room whatever the insets claim.
if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
) {
    document.documentElement.classList.add('standalone');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)

// The installed app's shell. Registered after load so it never competes with
// the first render, and only where the page is a secure origin — the service
// worker API is absent over plain HTTP on the LAN, which is how this is often
// played.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').catch(() => {
            // An unregistrable worker costs the page nothing; the table is
            // live over a socket either way.
        });
    });
}
