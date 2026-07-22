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
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else if (theme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
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
    <div className={`App bg-background text-foreground min-h-screen transition-colors duration-200 flex flex-col ${
      currentView === 'review' ? 'h-screen overflow-hidden' : 'pb-12'
    }`}>
      {currentView !== 'review' && (
        <nav className="bg-card border-b border-border mb-8 py-4 shadow-sm transition-colors duration-200 shrink-0">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <span 
              className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent cursor-pointer" 
              onClick={() => handleNavigate('dashboard')}
            >
              SLR Magic Inter-Rater
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Theme:</span>
              <select
                value={theme}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="bg-secondary text-secondary-foreground border border-border rounded-lg px-2.5 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="light">☀️ Light</option>
                <option value="dark">🌙 Dark</option>
                <option value="system">💻 System</option>
              </select>
            </div>
          </div>
        </nav>
      )}

      {currentView === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}
      {currentView === 'import' && <ImportWorkflow onNavigate={handleNavigate} />}
      {currentView === 'prescreen' && <PreScreen sessionId={viewParams.sessionId} onNavigate={handleNavigate} />}
      {currentView === 'review' && (
        <ReviewScreen 
          sessionId={viewParams.sessionId} 
          onNavigate={handleNavigate} 
          theme={theme}
          onThemeChange={handleThemeChange}
        />
      )}
    </div>
  );
}

export default App;

