import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ViewerProvider } from './context/ViewerContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ViewerProvider>
      <App />
    </ViewerProvider>
  </React.StrictMode>
);
