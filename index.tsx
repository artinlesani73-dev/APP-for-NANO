import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
const App = React.lazy(() => import('./App'));
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading app...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);