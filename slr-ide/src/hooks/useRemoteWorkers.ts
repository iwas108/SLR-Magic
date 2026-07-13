import { useState, useEffect, useRef, useCallback } from 'react';
import type { RemoteWorker } from '@/lib/services/remote-worker-manager';

export interface RemoteWorkerSettings {
  batch_size: number;
  local_scraper_enabled: boolean;
}

export function useRemoteWorkers() {
  const [workers, setWorkers] = useState<RemoteWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<RemoteWorkerSettings>({ batch_size: 10, local_scraper_enabled: true });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Use refs to avoid stale closures in the polling interval
  const workersRef = useRef(workers);
  workersRef.current = workers;

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch('/api/remote-worker/register');
      if (res.ok) {
        const data = await res.json();
        setWorkers(data);
      }
    } catch (e) {
      console.error('Failed to fetch workers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/remote-worker/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings({
          batch_size: data.batch_size,
          local_scraper_enabled: data.local_scraper_enabled
        });
      }
    } catch (e) {
      console.error('Failed to fetch settings:', e);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
    fetchSettings();
  }, [fetchWorkers, fetchSettings]);

  // Polling loop for statuses
  useEffect(() => {
    const interval = setInterval(() => {
      workersRef.current.forEach(async (worker) => {
        if (worker.is_enabled === 1 && worker.session_token) {
          try {
            const res = await fetch(`/api/remote-worker/${worker.id}/status`);
            if (res.ok) {
              const updatedWorker = await res.json();
              setWorkers((prev) => prev.map(w => w.id === updatedWorker.id ? updatedWorker : w));
            }
          } catch (e) {
            // Error handled by backend returning OFFLINE, frontend just ignores fetch errs
          }
        }
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const addWorker = async (label: string, host: string) => {
    const res = await fetch('/api/remote-worker/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, host })
    });
    if (!res.ok) throw new Error(await res.text());
    const newWorker = await res.json();
    setWorkers(prev => [newWorker, ...prev]);
    return newWorker;
  };

  const pairWorker = async (worker_id: string, pairing_code: string) => {
    const res = await fetch('/api/remote-worker/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worker_id, pairing_code })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setWorkers(prev => prev.map(w => w.id === worker_id ? data.worker : w));
  };

  const removeWorker = async (id: string) => {
    await fetch(`/api/remote-worker/${id}`, { method: 'DELETE' });
    setWorkers(prev => prev.filter(w => w.id !== id));
  };

  const toggleWorker = async (id: string, is_enabled: boolean) => {
    const res = await fetch(`/api/remote-worker/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setWorkers(prev => prev.map(w => w.id === id ? data.worker : w));
  };

  const resumeWorker = async (id: string) => {
    const res = await fetch(`/api/remote-worker/${id}/resume`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  };

  const cancelWorker = async (id: string) => {
    const res = await fetch(`/api/remote-worker/${id}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error(await res.text());
  };

  const updateSettings = async (patch: Partial<RemoteWorkerSettings>) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings); // Optimistic update
    try {
      const res = await fetch('/api/remote-worker/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (e) {
      console.error('Failed to update settings:', e);
      setSettings(settings); // Rollback
      throw e;
    }
  };

  return {
    workers,
    loading,
    settings,
    settingsLoading,
    addWorker,
    pairWorker,
    removeWorker,
    toggleWorker,
    resumeWorker,
    cancelWorker,
    updateSettings,
    refreshWorkers: fetchWorkers
  };
}
