import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ImportWorkflow from './components/ImportWorkflow';
import ReviewScreen from './components/ReviewScreen';
import PreScreen from './components/PreScreen';
import { StorageService } from './StorageService';

function App() {
  const [theme, setTheme] = useState('system');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState({});

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await StorageService.getConfig('theme', 'system');
      setTheme(savedTheme);
      setThemeLoaded(true);
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;

    const applyTheme = () => {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    applyTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (theme === 'system') applyTheme();
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, themeLoaded]);

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    await StorageService.setConfig('theme', newTheme);
  };

  const handleNavigate = (view, params = {}) => {
    setCurrentView(view);
    setViewParams(params);
    window.scrollTo(0, 0);
  };

  return (
    <div className="App bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen pb-12 transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800 mb-8 py-4 shadow-sm transition-colors duration-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <span 
            className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent cursor-pointer" 
            onClick={() => handleNavigate('dashboard')}
          >
            SLR Magic Inter-Rater
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Theme:</span>
            <select
              value={theme}
              onChange={(e) => handleThemeChange(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2.5 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
              <option value="system">💻 System</option>
            </select>
          </div>
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

