import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ViewerProvider } from './context/ViewerContext';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ViewerProvider>
        <App />
      </ViewerProvider>
    </React.StrictMode>
  );
}
