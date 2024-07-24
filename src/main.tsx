import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <footer>
      Not affiliated with Raspberry Pi. Raspberry Pi is a trademark of the Raspberry Pi Foundation.
    </footer>
    <ToastContainer stacked />
  </React.StrictMode>,
)
