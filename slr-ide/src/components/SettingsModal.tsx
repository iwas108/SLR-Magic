'use client';

import React, { useState, useEffect } from 'react';
import { X, Cloud, Sliders, CheckCircle, AlertTriangle, Play, RefreshCw, Loader, Cpu, FileText } from 'lucide-react';
import GlobalLLMSettingsView from './features/GlobalLLMSettingsView';
import PromptLibraryView from './features/PromptLibraryView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function SettingsModal({ isOpen, onClose, showToast }: SettingsModalProps) {
  const [showPathsHelp, setShowPathsHelp] = useState(false);
  const [activeTab, setActiveTab] = useState<'rclone' | 'scraper' | 'llm' | 'prompts'>('rclone');
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

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



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-opacity duration-300">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-200">
        
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
            onClick={() => setActiveTab('rclone')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'rclone' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Rclone Engine Settings
          </button>
          <button
            onClick={() => setActiveTab('scraper')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'scraper' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Scraper Settings
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'llm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cpu className="w-4 h-4" />
            LLM Engine
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'prompts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            Global Prompts
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading settings...</span>
            </div>
          ) : activeTab === 'rclone' ? (
            <div className="space-y-6 text-xs">
              
              {/* Rclone Forms */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Rclone Executable Path</label>
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.RCLONE_EXECUTABLE_PATH || ''}
                    onChange={(e) => handleChange('RCLONE_EXECUTABLE_PATH', e.target.value)}
                    placeholder="rclone"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave as &apos;rclone&apos; if it is in your system PATH.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground flex justify-between">
                    <span>Custom rclone.conf Path (Optional)</span>
                    <button 
                      onClick={() => setShowPathsHelp(prev => !prev)} 
                      type="button" 
                      className="text-primary hover:underline font-semibold text-[10px]"
                    >
                      {showPathsHelp ? 'Hide Default Locations' : 'Show Default Locations'}
                    </button>
                  </label>
                  
                  {showPathsHelp && (
                    <div className="bg-secondary/45 border border-border rounded-xl p-3 text-[10px] text-muted-foreground space-y-1.5 font-sans leading-relaxed animate-in fade-in duration-200">
                      <p className="font-bold text-foreground">Standard Config File Paths:</p>
                      <div>
                        <span className="font-semibold text-foreground">Windows:</span>
                        <code className="block mt-0.5 bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[9px]">C:\Users\&lt;Username&gt;\AppData\Roaming\rclone\rclone.conf</code>
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">macOS / Linux:</span>
                        <code className="block mt-0.5 bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[9px]">~/.config/rclone/rclone.conf</code>
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.RCLONE_CONFIG_PATH || ''}
                    onChange={(e) => handleChange('RCLONE_CONFIG_PATH', e.target.value)}
                    placeholder="e.g. C:\Users\Username\AppData\Roaming\rclone\rclone.conf"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave empty to use Rclone&apos;s default config location.</p>
                </div>



                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Sync Mode</label>
                  <select
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary text-xs cursor-pointer"
                    value={configs.RCLONE_SYNC_MODE || 'incremental'}
                    onChange={(e) => handleChange('RCLONE_SYNC_MODE', e.target.value)}
                  >
                    <option value="incremental">Incremental Update (rclone copy) - Safely keeps extra files on GDrive</option>
                    <option value="mirror">Mirror Sync (rclone sync) - Deletes files on GDrive if they do not exist locally</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">Select whether to incrementally copy new files or perform a strict mirror sync.</p>
                </div>
              </div>

              {/* Connection Verification Tool */}
              <div className="border border-border/80 rounded-lg p-4 bg-secondary/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-foreground">Verify Connectivity</h4>
                    <p className="text-[10px] text-muted-foreground">Test if Rclone can successfully connect to the active project's cloud remote.</p>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Test Connection
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-lg border text-xs flex gap-3 ${
                    testResult.success 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-destructive/10 border-destructive/20 text-destructive'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold">{testResult.message}</div>
                      {testResult.details && (
                        <div className="opacity-90 font-mono text-[10px] leading-relaxed">{testResult.details}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : activeTab === 'scraper' ? (
            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">EzProxy Base Login URL</label>
                <input
                  type="text"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                  value={configs.SCRAPER_PROXY_BASE_URL || ''}
                  onChange={(e) => handleChange('SCRAPER_PROXY_BASE_URL', e.target.value)}
                  placeholder="https://ezproxy.library.domain.com/login?url=https://doi.org/"
                />
                <p className="text-[10px] text-muted-foreground">The proxy redirection URL used to bypass publisher paywalls during automated scraping.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Scraper Base Delay (Seconds)</label>
                  <input
                    type="number"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.SCRAPER_DELAY_SECONDS || '20'}
                    onChange={(e) => handleChange('SCRAPER_DELAY_SECONDS', e.target.value)}
                    min="1"
                  />
                  <p className="text-[10px] text-muted-foreground">Delay duration applied after each download to respect rate limits.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Scraper Random Jitter (Seconds)</label>
                  <input
                    type="number"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.SCRAPER_JITTER_SECONDS || '5'}
                    onChange={(e) => handleChange('SCRAPER_JITTER_SECONDS', e.target.value)}
                    min="0"
                  />
                  <p className="text-[10px] text-muted-foreground">Adds a random value between 0 and this number to the delay to mimic human behavior.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Fuzzy Title Match Threshold (%)</label>
                  <input
                    type="number"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.FUZZY_MATCH_THRESHOLD || '90'}
                    onChange={(e) => handleChange('FUZZY_MATCH_THRESHOLD', e.target.value)}
                    min="1"
                    max="100"
                  />
                  <p className="text-[10px] text-muted-foreground">Required percentage similarity for fuzzy matching cached file names to paper titles.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">Chrome Browser Visibility</label>
                  <div className="flex items-center h-10">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configs.SCRAPER_HEADED_MODE === 'true'}
                        onChange={(e) => handleChange('SCRAPER_HEADED_MODE', String(e.target.checked))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      <span className="ml-3 text-xs font-semibold text-foreground">
                        {configs.SCRAPER_HEADED_MODE === 'true' ? 'Headed Mode (Visible window)' : 'Headless Mode (Background)'}
                      </span>
                    </label>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Headed mode is recommended if manual login or captcha solving is required.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-muted-foreground">Chrome User Profile Location</label>
                <input
                  type="text"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                  value={configs.SCRAPER_CHROME_PROFILE_DIR || ''}
                  onChange={(e) => handleChange('SCRAPER_CHROME_PROFILE_DIR', e.target.value)}
                  placeholder="./chrome_profile"
                />
                <p className="text-[10px] text-muted-foreground">Location to store cookies and persistent Chrome sessions (highly recommended to keep sessions logged into proxy).</p>
              </div>

              <div className="border-t border-border my-2 pt-2">
                <h4 className="text-xs font-bold text-foreground mb-3">Tesseract OCR (Scanned PDFs fallback)</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">Enable Tesseract OCR</label>
                    <div className="flex items-center h-10">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={configs.OCR_ENABLED === 'true'}
                          onChange={(e) => handleChange('OCR_ENABLED', String(e.target.checked))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        <span className="ml-3 text-xs font-semibold text-foreground">
                          {configs.OCR_ENABLED === 'true' ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Perform OCR scan on first page if standard PDF text extraction returns empty.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">Tesseract Executable Path</label>
                    <input
                      type="text"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                      value={configs.TESSERACT_PATH || 'tesseract'}
                      onChange={(e) => handleChange('TESSERACT_PATH', e.target.value)}
                      placeholder="e.g., C:\Program Files\Tesseract-OCR\tesseract.exe"
                    />
                    <p className="text-[10px] text-muted-foreground">Specify path if tesseract is not on system path. Default is &apos;tesseract&apos;.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border my-2 pt-2">
                <h4 className="text-xs font-bold text-foreground mb-3">PDF Compression & Quality Settings</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">Enable PDF Compression</label>
                    <div className="flex items-center h-10">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={configs.PDF_COMPRESSION_ENABLED === 'true'}
                          onChange={(e) => handleChange('PDF_COMPRESSION_ENABLED', String(e.target.checked))}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        <span className="ml-3 text-xs font-semibold text-foreground">
                          {configs.PDF_COMPRESSION_ENABLED === 'true' ? 'Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Compress PDFs incrementally before syncing to cloud storage.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">Compression Level</label>
                    <select
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-semibold text-[11px]"
                      value={configs.PDF_COMPRESSION_LEVEL || '/ebook'}
                      onChange={(e) => handleChange('PDF_COMPRESSION_LEVEL', e.target.value)}
                    >
                      <option value="/screen">Screen (72 DPI, Aggressive, Low Size)</option>
                      <option value="/ebook">Ebook (150 DPI, Recommended, Balanced)</option>
                      <option value="/printer">Printer (300 DPI, High Quality, Large Size)</option>
                    </select>
                    <p className="text-[10px] text-muted-foreground">Quality profile settings mapped to Ghostscript options.</p>
                  </div>
                </div>

                <div className="space-y-1.5 mt-3">
                  <label className="block text-xs font-semibold text-muted-foreground">Ghostscript Executable Path (Optional)</label>
                  <input
                    type="text"
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
                    value={configs.GHOSTSCRIPT_PATH || ''}
                    onChange={(e) => handleChange('GHOSTSCRIPT_PATH', e.target.value)}
                    placeholder="Auto-detect (e.g. gs, gswin64c, gswin32c)"
                  />
                  <p className="text-[10px] text-muted-foreground">Leave empty to auto-detect Ghostscript binaries using system environment PATH.</p>
                </div>
              </div>
            </div>
          ) : activeTab === 'llm' ? (
            <div className="h-full">
              <GlobalLLMSettingsView showToast={showToast} />
            </div>
          ) : activeTab === 'prompts' ? (
            <div className="h-full">
              <PromptLibraryView projectId={null} showToast={showToast} />
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-end bg-secondary/35 gap-3">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            type="button"
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors flex items-center gap-1.5"
          >
            {saving && <Loader className="w-3 h-3 animate-spin text-primary-foreground" />}
            Save Configurations
          </button>
        </div>

      </div>
    </div>
  );
}
