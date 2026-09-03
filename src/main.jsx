import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import AppIntro from './components/AppIntro';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { NotificationProvider } from './contexts/NotificationContext';
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

function Root() {
  const [introDone, setIntroDone] = useState(false);

  return (
    <>
      {!introDone && <AppIntro onDone={() => setIntroDone(true)} />}
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <App />
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
