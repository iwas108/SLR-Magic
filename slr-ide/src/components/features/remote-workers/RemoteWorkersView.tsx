import React, { useState } from 'react';
import { useRemoteWorkers } from '@/hooks/useRemoteWorkers';
import { WorkerCard } from './WorkerCard';
import { RemoteWorkerSettingsPanel } from './RemoteWorkerSettingsPanel';
import { Server, Plus, Download, RefreshCw, AlertTriangle } from 'lucide-react';

export function RemoteWorkersView({ isPipelineRunning }: { isPipelineRunning?: boolean }) {
  const {
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
    refreshWorkers
  } = useRemoteWorkers();

  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newHost, setNewHost] = useState('');
  const [addError, setAddError] = useState('');

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newLabel || !newHost) {
      setAddError('Label and Host are required');
      return;
    }
    
    // Ensure host starts with http
    let formattedHost = newHost.trim();
    if (!/^https?:\/\//i.test(formattedHost)) {
      formattedHost = 'http://' + formattedHost;
    }

    try {
      await addWorker(newLabel, formattedHost);
      setIsAdding(false);
      setNewLabel('');
      setNewHost('');
    } catch (err: any) {
      setAddError(err.message || 'Failed to add worker');
    }
  };

  const handleDownloadScript = () => {
    window.open('/api/remote-worker/download-script', '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
            <Server className="w-5 h-5 text-blue-500" />
            <span>Distributed Remote Scraping</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Delegate PDF downloading to other computers on your network to multiply speed.
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownloadScript}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors border shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download Worker Script</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center space-x-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Worker Node</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="p-5 bg-card border rounded-xl animate-in fade-in slide-in-from-top-2">
          <h3 className="text-sm font-medium text-foreground mb-4">Register New Worker</h3>
          <form onSubmit={handleAddWorker} className="flex flex-col md:flex-row gap-4 items-start">
            <div className="flex-1 w-full space-y-1">
              <label className="text-xs text-muted-foreground ml-1">Display Label</label>
              <input
                type="text"
                placeholder="e.g. Laptop B"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-[2] w-full space-y-1">
              <label className="text-xs text-muted-foreground ml-1">Host URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.42:7291"
                value={newHost}
                onChange={e => setNewHost(e.target.value)}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="mt-5 flex space-x-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border hover:bg-secondary rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
              >
                Register
              </button>
            </div>
          </form>
          {addError && <p className="text-red-500 text-sm mt-3">{addError}</p>}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <span>Loading workers...</span>
        </div>
      ) : workers.length === 0 ? (
        <div className="p-12 text-center border rounded-xl border-dashed bg-secondary/20">
          <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-foreground mb-1">No Remote Workers</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
            You haven't registered any remote worker nodes yet. Download the worker script, run it on another computer on the same network, and add it here.
          </p>
          <button
            onClick={handleDownloadScript}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-sm font-medium inline-flex items-center space-x-2 transition-colors border shadow-sm mx-auto"
          >
            <Download className="w-4 h-4" />
            <span>Download worker_server.py</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {workers.map(worker => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              onRemove={removeWorker}
              onToggle={toggleWorker}
              onPair={pairWorker}
              onResume={resumeWorker}
              onCancel={cancelWorker}
            />
          ))}
        </div>
      )}

      {workers.length > 0 && !settingsLoading && (
        <RemoteWorkerSettingsPanel 
          settings={settings} 
          onUpdate={updateSettings} 
          disabled={isPipelineRunning}
        />
      )}
      
      {isPipelineRunning && (
        <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200 mt-4">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Settings are locked while a pipeline is running.</span>
        </div>
      )}
    </div>
  );
}
