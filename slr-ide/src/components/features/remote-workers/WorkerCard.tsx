import React, { useState } from 'react';
import { RemoteWorker } from '@/lib/services/remote-worker-manager';
import { Play, Pause, Trash2, KeyRound, Monitor, AlertCircle, Clock, Activity, CheckCircle2, Download } from 'lucide-react';

interface WorkerCardProps {
  worker: RemoteWorker;
  onRemove: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onPair: (id: string, code: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}

export function WorkerCard({ worker, onRemove, onToggle, onPair, onResume, onCancel }: WorkerCardProps) {
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IDLE': return 'text-green-500';
      case 'SCRAPING': return 'text-blue-500';
      case 'WAITING_LOGIN': return 'text-yellow-500';
      case 'ERROR': return 'text-red-500';
      default: return 'text-gray-400'; // OFFLINE
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'IDLE': return 'Idle';
      case 'SCRAPING': return 'Scraping';
      case 'WAITING_LOGIN': return 'Waiting for Login';
      case 'ERROR': return 'Error';
      default: return 'Offline';
    }
  };

  const handlePair = async () => {
    if (!pairingCode) return;
    setIsPairing(true);
    try {
      await onPair(worker.id, pairingCode);
    } catch (e) {
      alert('Failed to pair. Check code and worker status.');
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div className={`p-4 rounded-xl border bg-card transition-all ${worker.is_enabled ? 'border-border' : 'border-dashed border-gray-300 opacity-75'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-secondary/50 rounded-lg">
            <Monitor className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground flex items-center space-x-2">
              <span>{worker.label}</span>
              <span className="flex h-2 w-2 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusColor(worker.status).replace('text-', 'bg-')}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusColor(worker.status).replace('text-', 'bg-')}`}></span>
              </span>
            </h3>
            <p className="text-xs text-muted-foreground font-mono">{worker.host}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {worker.session_token && (
            <button
              onClick={() => onToggle(worker.id, worker.is_enabled === 1 ? false : true)}
              className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors"
              title={worker.is_enabled ? "Pause Worker" : "Enable Worker"}
            >
              {worker.is_enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          )}
          <button
            onClick={() => onRemove(worker.id)}
            className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-md text-muted-foreground transition-colors"
            title="Remove Worker"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!worker.session_token ? (
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <KeyRound className="w-4 h-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-600">Needs Pairing</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Enter the 6-digit code shown on the worker's terminal to authorize it.
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="e.g. 123456"
              value={pairingCode}
              onChange={e => setPairingCode(e.target.value)}
              className="flex-1 bg-background border rounded-md px-3 py-1.5 text-sm font-mono"
            />
            <button
              onClick={handlePair}
              disabled={isPairing || !pairingCode}
              className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
            >
              {isPairing ? 'Pairing...' : 'Pair'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className={`font-medium ${getStatusColor(worker.status)}`}>{getStatusLabel(worker.status)}</span>
          </div>
          
          {worker.telemetry && (
            <>
              {worker.telemetry.current_paper && (
                <div className="text-sm">
                  <span className="text-muted-foreground block text-xs mb-1">Current Task</span>
                  <div className="truncate font-medium" title={worker.telemetry.current_paper}>
                    {worker.telemetry.current_paper}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="p-2 bg-secondary/30 rounded-md flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Success</span>
                    <span className="font-semibold text-sm">{worker.telemetry.done || 0}</span>
                  </div>
                </div>
                <div className="p-2 bg-secondary/30 rounded-md flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Failed</span>
                    <span className="font-semibold text-sm">{worker.telemetry.failed || 0}</span>
                  </div>
                </div>
                <div className="p-2 bg-secondary/30 rounded-md flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Speed</span>
                    <span className="font-semibold text-sm">{worker.telemetry.speed_pph || 0} pph</span>
                  </div>
                </div>
                <div className="p-2 bg-secondary/30 rounded-md flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Last Seen</span>
                    <span className="font-semibold text-sm">
                      {worker.last_seen_at ? new Date(worker.last_seen_at).toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {worker.status === 'WAITING_LOGIN' && (
            <button
              onClick={() => onResume(worker.id)}
              className="w-full mt-2 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Resume Worker (Login Complete)</span>
            </button>
          )}
          
          {worker.status === 'SCRAPING' && (
            <button
              onClick={() => onCancel(worker.id)}
              className="w-full mt-2 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
            >
              <Pause className="w-4 h-4" />
              <span>Cancel Task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
