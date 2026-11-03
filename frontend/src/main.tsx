import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#14110e',
              color: '#f6f2ea',
              border: '1px solid #86622a',
              fontFamily: "'Inter', system-ui, sans-serif",
            },
            success: { iconTheme: { primary: '#86622a', secondary: '#f6f2ea' } },
            error: { iconTheme: { primary: '#b3382f', secondary: '#f6f2ea' } },
          }}
        />
      </BrowserRouter>
  </React.StrictMode>
);
