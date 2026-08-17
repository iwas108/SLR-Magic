'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Server, 
  Wifi, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  FileCode, 
  Save,
  Laptop,
  AlertCircle
} from 'lucide-react';
import { NetworkConfig, NetworkInterfaceInfo } from '@/lib/network-config';

interface NetworkSettingsTabProps {
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function NetworkSettingsTab({ showToast }: NetworkSettingsTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  const [hostMode, setHostMode] = useState<'all' | 'localhost' | 'custom'>('all');
  const [customHost, setCustomHost] = useState('');
  
  const [ports, setPorts] = useState({
    slr_ide: 3000,
    inter_rater: 3001,
    slr_viewer: 3002,
    worker_server: 7291,
  });

  const [localInterfaces, setLocalInterfaces] = useState<NetworkInterfaceInfo[]>([]);
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [detectedConfigPath, setDetectedConfigPath] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string>('default');

  const fetchNetworkInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/network-info');
      const data = await res.json();
      if (data.success) {
        const cfg: NetworkConfig = data.config;
        const currentHost = cfg.modules.slr_ide.host || cfg.server.host;
        
        if (currentHost === '0.0.0.0') {
          setHostMode('all');
        } else if (currentHost === '127.0.0.1' || currentHost === 'localhost') {
          setHostMode('localhost');
        } else {
          setHostMode('custom');
          setCustomHost(currentHost);
        }

        setPorts({
          slr_ide: cfg.modules.slr_ide.port || 3000,
          inter_rater: cfg.modules.inter_rater.port || 3001,
          slr_viewer: cfg.modules.slr_viewer.port || 3002,
          worker_server: cfg.modules.worker_server.port || 7291,
        });

        setLocalInterfaces(data.localInterfaces || []);
        setLanUrls(data.lanUrls || []);
        setDetectedConfigPath(data.detectedConfigPath || null);
        setDetectedFormat(data.detectedFormat || 'default');
      }
    } catch (err: any) {
      console.error('Failed to load network info:', err);
      showToast?.('Failed to fetch network information', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNetworkInfo();
  }, []);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    showToast?.(`Copied ${url} to clipboard!`, 'info');
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const targetHost = hostMode === 'all' ? '0.0.0.0' : (hostMode === 'localhost' ? '127.0.0.1' : (customHost.trim() || '0.0.0.0'));
      
      const payload: Partial<NetworkConfig> = {
        server: {
          host: targetHost,
          port: Number(ports.slr_ide),
          cors: true,
        },
        modules: {
          slr_ide: { host: targetHost, port: Number(ports.slr_ide) },
          inter_rater: { host: targetHost, port: Number(ports.inter_rater) },
          slr_viewer: { host: targetHost, port: Number(ports.slr_viewer) },
          worker_server: { host: targetHost, port: Number(ports.worker_server) },
        },
      };

      const res = await fetch('/api/network-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showToast?.('Network configuration saved to slr-magic.config.json', 'success');
        await fetchNetworkInfo();
      } else {
        showToast?.(data.error || 'Failed to save configuration', 'error');
      }
    } catch (err: any) {
      console.error('Error saving config:', err);
      showToast?.('Error saving network configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Inspecting network interfaces...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>Network Interface & Port Listening</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                hostMode === 'all' 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}>
                {hostMode === 'all' ? '0.0.0.0 (All Interfaces)' : (hostMode === 'localhost' ? '127.0.0.1 (Localhost Only)' : customHost)}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control whether SLR Magic listens on all local network interfaces (LAN/Wi-Fi) to allow remote worker scrapers and peer reviewers to connect.
            </p>
          </div>
        </div>

        <button
          onClick={fetchNetworkInfo}
          className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Interface Binding Mode */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Wifi className="w-3.5 h-3.5 text-primary" />
          <span>Network Interface Binding</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Option 1: All Interfaces (0.0.0.0) */}
          <div 
            onClick={() => setHostMode('all')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              hostMode === 'all'
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-foreground">All Network Interfaces (`0.0.0.0`)</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                Recommended
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Enables team members, mobile browsers, and remote Python scraper nodes on the same Wi-Fi/LAN to access SLR-IDE.
            </p>
          </div>

          {/* Option 2: Localhost Only (127.0.0.1) */}
          <div 
            onClick={() => setHostMode('localhost')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              hostMode === 'localhost'
                ? 'bg-primary/5 border-primary shadow-sm'
                : 'bg-card border-border hover:border-primary/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold text-foreground">Localhost Only (`127.0.0.1`)</span>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                Isolated
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Strictly restricts access to this local computer only. Other devices on the local network will not be able to connect.
            </p>
          </div>
        </div>
      </div>

      {/* Available LAN Access URLs */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-primary" />
            <span>Accessible LAN URLs for this Machine</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-normal">Click to copy URL</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {lanUrls.map((url, idx) => {
            const isLocalhost = url.includes('localhost');
            const iface = localInterfaces.find(i => url.includes(i.address));
            
            return (
              <div 
                key={idx}
                onClick={() => handleCopyUrl(url)}
                className="group flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-secondary/40 transition-all cursor-pointer shadow-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-foreground">{url}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-mono">
                      {isLocalhost ? 'Loopback' : (iface?.name || 'LAN Interface')}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {isLocalhost ? 'Local browser session' : 'Share with team members & remote nodes on local network'}
                  </p>
                </div>

                <button 
                  type="button"
                  className="p-1.5 rounded-md bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors"
                >
                  {copiedUrl === url ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Port Allocation Grid */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5 text-primary" />
          <span>Module Port Allocations</span>
        </label>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* SLR-IDE */}
          <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground block">SLR IDE Hub</span>
            <input
              type="number"
              value={ports.slr_ide}
              onChange={(e) => setPorts(prev => ({ ...prev, slr_ide: Number(e.target.value) }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[9px] text-muted-foreground block">Default: 3000</span>
          </div>

          {/* Inter-Rater */}
          <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground block">Inter-Rater SPA</span>
            <input
              type="number"
              value={ports.inter_rater}
              onChange={(e) => setPorts(prev => ({ ...prev, inter_rater: Number(e.target.value) }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[9px] text-muted-foreground block">Default: 3001</span>
          </div>

          {/* SLR-Viewer */}
          <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground block">SLR Viewer</span>
            <input
              type="number"
              value={ports.slr_viewer}
              onChange={(e) => setPorts(prev => ({ ...prev, slr_viewer: Number(e.target.value) }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[9px] text-muted-foreground block">Default: 3002</span>
          </div>

          {/* Worker Server */}
          <div className="p-3 rounded-lg bg-card border border-border space-y-1.5">
            <span className="text-[11px] font-semibold text-foreground block">Worker Scraper</span>
            <input
              type="number"
              value={ports.worker_server}
              onChange={(e) => setPorts(prev => ({ ...prev, worker_server: Number(e.target.value) }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-2.5 py-1.5 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
            />
            <span className="text-[9px] text-muted-foreground block">Default: 7291</span>
          </div>
        </div>
      </div>

      {/* Configuration File Status & Save */}
      <div className="p-4 rounded-xl bg-secondary/20 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">File-Based Configuration Synchronization</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {detectedConfigPath 
              ? `Loaded from: ${detectedConfigPath}` 
              : 'Using default system configuration (slr-magic.config.json will be created)'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save to slr-magic.config.json</span>
        </button>
      </div>

      {/* Firewall Notice */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-blue-400 flex items-start gap-2.5 text-[11px] leading-relaxed">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
        <div>
          <span className="font-semibold text-foreground">Firewall Tip: </span>
          <span>When accessing from another computer or mobile phone on your Wi-Fi, ensure your OS firewall (e.g. Windows Defender Firewall or macOS Security) allows inbound connections on the configured ports.</span>
        </div>
      </div>
    </div>
  );
}
