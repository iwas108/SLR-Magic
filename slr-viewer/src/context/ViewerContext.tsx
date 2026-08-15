import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import StorageService, { SessionRecord } from '../StorageService';
import { decompressViewerData } from '../utils/compression';

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  id: number;
}

export interface ViewerContextType {
  sessions: SessionRecord[];
  activeSessionId: number | null;
  activeSession: SessionRecord | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  loadSessions: () => Promise<void>;
  switchSession: (id: number | string, targetTab?: string) => Promise<void>;
  importSnapshot: (file: File) => Promise<SessionRecord>;
  importFromUrl: (url: string) => Promise<SessionRecord>;
  removeSession: (id: number | string) => Promise<void>;
  loading: boolean;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  toast: ToastState | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  activeFiltersCount: number;
  setActiveFiltersCount: (count: number) => void;
  isVisualizerOpen: boolean;
  setIsVisualizerOpen: (open: boolean) => void;
  isLlmContextBuilderOpen: boolean;
  setIsLlmContextBuilderOpen: (open: boolean) => void;
  isImportModalOpen: boolean;
  setIsImportModalOpen: (open: boolean) => void;
}

const ViewerContext = createContext<ViewerContextType | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<SessionRecord | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const switchSession = useCallback(async (id: number | string, targetTab?: string) => {
    if (!id) return;
    try {
      const sess = await StorageService.getSession(id);
      if (sess) {
        setActiveSessionId(sess.id || null);
        setActiveSession(sess);
        if (sess.id) StorageService.updateLastViewed(sess.id);
        if (targetTab) {
          setActiveTab(targetTab);
        }
        const list = await StorageService.getSessions();
        setSessions(list);
        showToast(`Loaded project: ${sess.projectName}`, 'success');
      }
    } catch (e) {
      showToast('Error switching workspace session', 'error');
    }
  }, [showToast]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await StorageService.getSessions();
      setSessions(list);
      
      if (list.length > 0) {
        const currentId = activeSessionId || list[0].id;
        if (currentId) {
          const currentSession = await StorageService.getSession(currentId);
          if (currentSession) {
            setActiveSessionId(currentSession.id || null);
            setActiveSession(currentSession);
            if (currentSession.id) StorageService.updateLastViewed(currentSession.id);
          } else {
            setActiveSessionId(list[0].id || null);
            setActiveSession(list[0]);
          }
        }
      } else {
        setActiveSessionId(null);
        setActiveSession(null);
        setActiveTab('dashboard');
      }
    } catch (err) {
      showToast('Failed to load sessions from browser storage', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, showToast]);

  // Handle URL parameters (?url=... or ?demo=true)
  useEffect(() => {
    async function checkUrlParams() {
      try {
        const params = new URLSearchParams(window.location.search);
        const remoteUrl = params.get('url');
        if (remoteUrl) {
          showToast(`Fetching dataset from remote URL...`, 'info');
          const response = await fetch(remoteUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status} fetching remote dataset`);
          const arrayBuffer = await response.arrayBuffer();
          const parsed = await decompressViewerData(arrayBuffer);
          const filename = remoteUrl.split('/').pop() || 'remote_project.slr-viewer';
          const created = await StorageService.createSession(filename, parsed);
          await loadSessions();
          if (created.id) await switchSession(created.id, 'insight-export-rigor');
          showToast(`Successfully loaded ${created.projectName} from URL`, 'success');
          return;
        }
      } catch (err: any) {
        console.error('Failed to load dataset from URL:', err);
        showToast(err.message || 'Failed to load dataset from URL', 'error');
      }
      loadSessions();
    }
    checkUrlParams();
  }, []);

  const importSnapshot = useCallback(async (file: File): Promise<SessionRecord> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const parsed = await decompressViewerData(arrayBuffer);
          
          if (parsed.type !== 'slr-viewer-export' && !parsed.scientific_rigor) {
            throw new Error('Invalid file format. Must be a valid .slr-viewer snapshot file.');
          }

          const created = await StorageService.createSession(file.name, parsed);
          await loadSessions();
          if (created.id) await switchSession(created.id, 'insight-export-rigor');
          showToast(`Successfully imported ${created.projectName}`, 'success');
          resolve(created);
        } catch (err: any) {
          showToast(err.message || 'Failed to parse .slr-viewer file', 'error');
          reject(err);
        }
      };
      reader.onerror = () => {
        showToast('Error reading snapshot file', 'error');
        reject(new Error('File read error'));
      };
      reader.readAsArrayBuffer(file);
    });
  }, [loadSessions, switchSession, showToast]);

  const importFromUrl = useCallback(async (url: string): Promise<SessionRecord> => {
    try {
      showToast(`Fetching dataset from ${url}...`, 'info');
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching remote file`);
      const buffer = await res.arrayBuffer();
      const parsed = await decompressViewerData(buffer);
      const filename = url.split('/').pop() || 'url_project.slr-viewer';
      const created = await StorageService.createSession(filename, parsed);
      await loadSessions();
      if (created.id) await switchSession(created.id, 'insight-export-rigor');
      showToast(`Successfully loaded ${created.projectName}`, 'success');
      return created;
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch dataset from URL', 'error');
      throw err;
    }
  }, [loadSessions, switchSession, showToast]);

  const removeSession = useCallback(async (id: number | string) => {
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
  const [isLlmContextBuilderOpen, setIsLlmContextBuilderOpen] = useState(false);

  const value: ViewerContextType = {
    sessions,
    activeSessionId,
    activeSession,
    activeTab,
    setActiveTab,
    loadSessions,
    switchSession,
    importSnapshot,
    importFromUrl,
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
    isLlmContextBuilderOpen,
    setIsLlmContextBuilderOpen,
    isImportModalOpen,
    setIsImportModalOpen,
  };

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewerData(): ViewerContextType {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error('useViewerData must be used within a ViewerProvider');
  }
  return context;
}
