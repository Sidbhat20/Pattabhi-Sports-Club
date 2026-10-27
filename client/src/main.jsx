import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RuntimeLoader } from '@rive-app/react-canvas';
import App from './App.jsx';
import './styles.css';

// Serve the Rive WebAssembly from this app, not a CDN.
RuntimeLoader.setWasmUrl('/rive.wasm');
RuntimeLoader.setWasmFallbackUrl(null);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
