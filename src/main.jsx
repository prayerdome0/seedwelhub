import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppIntro from './components/AppIntro';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LocationProvider } from './contexts/LocationContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Register the FCM service worker (safe even when unsupported).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // firebase-messaging-sw.js is registered lazily by firebase/messaging when a
    // token is requested. We don't force-register here; the messaging module
    // handles it. This is just a best-effort attach.
    if (typeof Notification !== 'undefined') {
      // no-op; service worker registration handled in messaging.js
    }
  });
}

// Deep-link restoration. If a static host (or the 404.html fallback) bounced a
// direct URL like /messages/group/123 back to "/", we replay the original path
// into the SPA router so a refresh lands on the same screen instead of home.
function restoreDeepLink() {
  try {
    const target = sessionStorage.getItem('seedwel:redirect');
    if (!target) return;
    sessionStorage.removeItem('seedwel:redirect');
    if (target.startsWith('/') && !target.startsWith('//') && target !== '/') {
      window.history.replaceState(null, '', target);
    }
  } catch {
    /* storage unavailable — ignore, the app still loads at "/" */
  }
}
restoreDeepLink();

function Root() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      {!introDone && <AppIntro onDone={() => setIntroDone(true)} />}
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <LocationProvider>
                <App />
              </LocationProvider>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </React.StrictMode>
);
