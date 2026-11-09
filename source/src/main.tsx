import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { createStore } from './lib/storage';

const store = createStore();

try {
  // The app loaded, so clear the one-time deep-link redirect guard set in index.html.
  sessionStorage.removeItem('monitortest.rootRedirect');
} catch {
  /* ignore */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary store={store}>
      <App store={store} />
    </ErrorBoundary>
  </StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a bonus; ignore failures */
    });
  });
}
