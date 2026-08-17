'use client';

import React, { useState, useEffect } from 'react';
import { X, Cloud, Sliders, Loader, Globe } from 'lucide-react';
import RcloneSettingsTab from './features/settings/RcloneSettingsTab';
import ScraperSettingsTab from './features/settings/ScraperSettingsTab';
import NetworkSettingsTab from './features/settings/NetworkSettingsTab';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  activeProject?: any;
  preSelectedPaperIds?: string[];
  initialTab?: 'rclone' | 'scraper' | 'network';
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  showToast, 
  activeProject, 
  preSelectedPaperIds, 
  initialTab 
}: SettingsModalProps) {
  const [showPathsHelp, setShowPathsHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'rclone' | 'scraper' | 'network'>('network');
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [backingUp, setBackingUp] = useState(false);

  // Load configs on open
  useEffect(() => {
    if (isOpen) {
      fetch('/api/config')
        .then((res) => res.json())
        .then((data) => {
          setConfigs(data);
          setLoading(false);
        })
        .catch((err) => console.error('Error loading config:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, preSelectedPaperIds, initialTab]);

  const handleChange = (key: string, value: string) => {
    setConfigs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
      if (res.ok) {
        showToast?.('Configurations saved successfully', 'success');
        onClose();
      } else {
        showToast?.('Failed to save settings', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error saving settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save temp configs first before testing
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });

      const res = await fetch('/api/config/test', { method: 'POST' });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
        details: data.details
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Network error occurred while testing connection.',
        details: err.message
      });
    } finally {
      setTesting(false);
    }
  };

  const handleManualBackup = async () => {
    setBackingUp(true);
    try {
      // Save temp configs first before backing up to make sure destination is updated
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });

      const res = await fetch('/api/config/backup', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast?.(data.message || 'Database backup completed successfully.', 'success');
        // Refetch configs to get the updated LAST_BACKUP_TIMESTAMP
        const configRes = await fetch('/api/config');
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfigs(configData);
        }
      } else {
        showToast?.(data.message || 'Database backup failed.', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error executing database backup.', 'error');
    } finally {
      setBackingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[640px] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/35">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-sm">Global Settings & Setup</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-border bg-secondary/10 px-4">
          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'network' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            Network & Interfaces
          </button>
          <button
            onClick={() => setActiveTab('rclone')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rclone' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Rclone Engine Settings
          </button>
          <button
            onClick={() => setActiveTab('scraper')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'scraper' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Scraper Settings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading settings...</span>
            </div>
          ) : activeTab === 'network' ? (
            <NetworkSettingsTab showToast={showToast} />
          ) : activeTab === 'rclone' ? (
            <RcloneSettingsTab
              configs={configs}
              showPathsHelp={showPathsHelp}
              setShowPathsHelp={setShowPathsHelp}
              handleChange={handleChange}
              testing={testing}
              handleTestConnection={handleTestConnection}
              testResult={testResult}
              backingUp={backingUp}
              handleManualBackup={handleManualBackup}
            />
          ) : activeTab === 'scraper' ? (
            <ScraperSettingsTab
              configs={configs}
              handleChange={handleChange}
            />
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end bg-secondary/35 gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors cursor-pointer"
          >
            Close
          </button>
          {activeTab !== 'network' && (
            <button
              onClick={handleSave}
              disabled={saving}
              type="button"
              className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {saving && <Loader className="w-3 h-3 animate-spin text-primary-foreground" />}
              Save Configurations
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
