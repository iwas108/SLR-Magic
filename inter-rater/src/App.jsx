import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import Dashboard from './components/Dashboard';
import ImportWorkflow from './components/ImportWorkflow';
import ReviewScreen from './components/ReviewScreen';

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState({});

  const handleNavigate = (view, params = {}) => {
    setCurrentView(view);
    setViewParams(params);
    window.scrollTo(0, 0);
  };

  return (
    <div className="App bg-body min-vh-100 pb-5">
      <nav className="navbar navbar-expand-lg bg-body-tertiary mb-4">
        <div className="container">
          <span className="navbar-brand mb-0 h1 cursor-pointer" onClick={() => handleNavigate('dashboard')} style={{cursor: 'pointer'}}>
            SLR Magic Inter-Rater
          </span>

          <button className="btn btn-outline-secondary" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </nav>

      {currentView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      {currentView === 'import' && <ImportWorkflow onNavigate={handleNavigate} />}
      {currentView === 'review' && <ReviewScreen sessionId={viewParams.sessionId} onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
