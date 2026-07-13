import React, { useState, useEffect } from 'react';
import { RemoteWorkerSettings } from '@/hooks/useRemoteWorkers';
import { Settings, Save } from 'lucide-react';

interface SettingsPanelProps {
  settings: RemoteWorkerSettings;
  onUpdate: (patch: Partial<RemoteWorkerSettings>) => Promise<void>;
  disabled?: boolean;
}

export function RemoteWorkerSettingsPanel({ settings, onUpdate, disabled }: SettingsPanelProps) {
  const [batchSize, setBatchSize] = useState(settings.batch_size.toString());
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Sync prop changes back to local state
  useEffect(() => {
    setBatchSize(settings.batch_size.toString());
  }, [settings.batch_size]);

  const handleSaveBatchSize = async () => {
    const val = parseInt(batchSize, 10);
    if (isNaN(val) || val < 1 || val > 50) {
      setBatchSize(settings.batch_size.toString());
      return;
    }
    
    setIsSaving(true);
    try {
      await onUpdate({ batch_size: val });
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (e) {
      // Revert on error
      setBatchSize(settings.batch_size.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleLocal = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ local_scraper_enabled: !settings.local_scraper_enabled });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border rounded-xl p-5 mt-6">
      <div className="flex items-center space-x-2 mb-4 border-b pb-3">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Global Worker Settings</h3>
        {saveMessage && <span className="ml-2 text-xs text-green-500 flex items-center"><Save className="w-3 h-3 mr-1"/> {saveMessage}</span>}
      </div>

      <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground block mb-1">Batch Size</label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Papers claimed per worker per round-trip. Smaller is safer for crash recovery. Max 50.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="1"
              max="50"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              onBlur={handleSaveBatchSize}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveBatchSize()}
              disabled={disabled || isSaving}
              className="w-20 px-3 py-1.5 border rounded-md text-sm bg-background disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground block mb-1">Run local scraper in parallel</label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Also scrape on this machine while remote workers are active. Turn off to dedicate this machine only to orchestration.
            </p>
          </div>
          <div className="flex items-center h-8">
            <button
              onClick={handleToggleLocal}
              disabled={disabled || isSaving}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                settings.local_scraper_enabled ? 'bg-primary' : 'bg-input'
              }`}
            >
              <span className="sr-only">Toggle local scraper</span>
              <span
                className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                  settings.local_scraper_enabled ? 'translate-x-2' : '-translate-x-2'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
