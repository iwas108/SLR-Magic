import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ImportWorkflow from './components/ImportWorkflow';
import ReviewScreen from './components/ReviewScreen';
import PreScreen from './components/PreScreen';

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    <div className="App bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen pb-12 transition-colors duration-200">
      <nav className="bg-gray-100 dark:bg-gray-800 mb-8 py-4 shadow-sm transition-colors duration-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <span className="text-xl font-bold cursor-pointer" onClick={() => handleNavigate('dashboard')}>
            SLR Magic Inter-Rater
          </span>

          <button
            className="px-4 py-2 border border-gray-400 dark:border-gray-600 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            onClick={toggleTheme}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </nav>

      {currentView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      {currentView === 'import' && <ImportWorkflow onNavigate={handleNavigate} />}
      {currentView === 'prescreen' && <PreScreen sessionId={viewParams.sessionId} onNavigate={handleNavigate} />}
      {currentView === 'review' && <ReviewScreen sessionId={viewParams.sessionId} onNavigate={handleNavigate} />}
    </div>
  );
}

export default App;
