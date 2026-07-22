import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import StorageService from '../StorageService';

const ViewerContext = createContext(null);

export function ViewerProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [activeTab, setActiveTab] = useState('insight-export-rigor');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await StorageService.getSessions();
      setSessions(list);
      
      if (list.length > 0) {
        const currentId = activeSessionId || list[0].id;
        const currentSession = await StorageService.getSession(currentId);
        if (currentSession) {
          setActiveSessionId(currentSession.id);
          setActiveSession(currentSession);
          StorageService.updateLastViewed(currentSession.id);
        } else {
          setActiveSessionId(list[0].id);
          setActiveSession(list[0]);
        }
      } else {
        setActiveSessionId(null);
        setActiveSession(null);
      }
    } catch (err) {
      showToast('Failed to load sessions from local database', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, showToast]);

  useEffect(() => {
    loadSessions();
  }, []);

  const switchSession = useCallback(async (id, targetTab) => {
    if (!id) return;
    try {
      const sess = await StorageService.getSession(id);
      if (sess) {
        setActiveSessionId(sess.id);
        setActiveSession(sess);
        StorageService.updateLastViewed(sess.id);
        if (targetTab) {
          setActiveTab(targetTab);
        }
        showToast(`Switched to workspace: ${sess.projectName}`, 'success');
      }
    } catch (e) {
      showToast('Error switching workspace session', 'error');
    }
  }, [showToast]);

  const importSnapshot = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed.type !== 'slr-viewer-export' && !parsed.scientific_rigor) {
            throw new Error('Invalid file format. Must be a valid .slr-viewer snapshot file.');
          }

          const created = await StorageService.createSession(file.name, parsed);
          await loadSessions();
          await switchSession(created.id, 'insight-export-rigor');
          showToast(`Successfully imported ${created.projectName}`, 'success');
          resolve(created);
        } catch (err) {
          showToast(err.message || 'Failed to parse .slr-viewer file', 'error');
          reject(err);
        }
      };
      reader.onerror = () => {
        showToast('Error reading snapshot file', 'error');
        reject(new Error('File read error'));
      };
      reader.readAsText(file);
    });
  }, [loadSessions, switchSession, showToast]);

  const removeSession = useCallback(async (id) => {
    try {
      await StorageService.deleteSession(id);
      showToast('Session deleted', 'info');
      await loadSessions();
    } catch (e) {
      showToast('Failed to delete session', 'error');
    }
  }, [loadSessions, showToast]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);

  const value = {
    sessions,
    activeSessionId,
    activeSession,
    activeTab,
    setActiveTab,
    switchSession,
    importSnapshot,
    removeSession,
    loading,
    showToast,
    toast,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    activeFiltersCount,
    setActiveFiltersCount,
    isVisualizerOpen,
    setIsVisualizerOpen,
  };

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerData() {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewerData must be used within a ViewerProvider');
  }
  return context;
}
