import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { cleanupLegacyLocalStorage } from './services/storage';

// One-time startup cleanup: delete old localStorage keys written by earlier versions
cleanupLegacyLocalStorage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
