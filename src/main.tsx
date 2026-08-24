import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/barlow-condensed/900.css';
import './index.css';

const renderApplication = async () => {
  let application = <App />;
  let devLiveMockActive = false;

  if (import.meta.env.DEV) {
    const [{ default: DevApp }, { isDevLiveMockRequested }] = await Promise.all([
      import('./dev/DevApp'),
      import('./dev/runtime'),
    ]);
    devLiveMockActive = isDevLiveMockRequested();
    application = <DevApp />;
  }

  if (devLiveMockActive && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if (!devLiveMockActive && 'serviceWorker' in navigator) {
    registerSW({ immediate: true });
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{application}</React.StrictMode>,
  );
};

void renderApplication();
