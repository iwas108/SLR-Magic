'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Laptop,
  ShieldCheck,
  BarChart3,
  Database,
  Cpu,
  ArrowRight,
  Sparkles,
  Layers,
  Network,
  FileCode2,
  Lock,
  GitBranch,
  BookOpen,
  Info
} from 'lucide-react';
import {
  ECOSYSTEM_MODULES,
  ECOSYSTEM_WORKFLOW_STEPS,
  ECOSYSTEM_FILE_SPECS,
  resolveModuleUrl,
  EcosystemModule
} from '@/lib/services/ecosystem-data';

interface EcosystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModuleId?: 'slr-ide' | 'inter-rater' | 'slr-viewer' | 'worker-server';
}

const ICON_MAP: Record<string, any> = {
  Laptop,
  ShieldCheck,
  BarChart3,
  Database,
  Cpu
};

export default function EcosystemModal({
  isOpen,
  onClose,
  currentModuleId = 'slr-ide'
}: EcosystemModalProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'lifecycle' | 'files'>('modules');
  const [copiedPort, setCopiedPort] = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(currentModuleId);
  const [networkModules, setNetworkModules] = useState<Record<string, { host?: string; port?: number }> | null>(null);

  // Discover live network config when running inside slr-ide
  useEffect(() => {
    if (isOpen && currentModuleId === 'slr-ide' && typeof window !== 'undefined') {
      fetch('/api/network-info')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.config?.modules) {
            setNetworkModules(data.config.modules);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, currentModuleId]);

  // Keyboard shortcut: close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyUrl = (url: string, port?: number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      if (port) {
        setCopiedPort(port);
        setTimeout(() => setCopiedPort(null), 2000);
      }
    }
  };

  const resolveEffectivePort = (modId: string, defaultPort?: number): number | undefined => {
    if (!networkModules || !defaultPort) return defaultPort;
    const key =
      modId === 'slr-ide'
        ? 'slr_ide'
        : modId === 'inter-rater'
        ? 'inter_rater'
        : modId === 'slr-viewer'
        ? 'slr_viewer'
        : modId === 'worker-server'
        ? 'worker_server'
        : null;
    if (key && networkModules[key]?.port) {
      return Number(networkModules[key].port);
    }
    return defaultPort;
  };

  const currentModule = ECOSYSTEM_MODULES.find((m) => m.id === currentModuleId) || ECOSYSTEM_MODULES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-5xl h-[90vh] bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">SLR Magic Architecture & Ecosystem</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Ecosystem Hub
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Node: {currentModule.shortName}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Discover the modular local-first architecture and specialized tools powering your systematic literature review.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-border bg-muted/20 shrink-0">
          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'modules'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sub-Modules & Capabilities</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-background/20">
              {ECOSYSTEM_MODULES.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('lifecycle')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'lifecycle'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Inter-Module Lifecycle Workflow</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-background/20">
              {ECOSYSTEM_WORKFLOW_STEPS.length} Steps
            </span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'files'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Data Exchange File Formats</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-background/20">
              {ECOSYSTEM_FILE_SPECS.length}
            </span>
          </button>
        </div>

        {/* Modal Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MODULES & CAPABILITIES */}
          {activeTab === 'modules' && (
            <div className="space-y-6">
              {/* Architecture Introduction Banner */}
              <div className="p-4 rounded-xl border border-border bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-foreground">
                    Local-First, File-Synchronized Architectural Paradigm
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    SLR Magic is built around independent, single-responsibility sub-modules to preserve strict data privacy,
                    enable offline execution, and prevent cognitive anchoring during blinded human reviews. Data flows cleanly between
                    modules using standardized <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.slr</code>,{' '}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.slr-viewer</code>, and{' '}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.csv</code> file handshakes without external cloud dependencies.
                  </p>
                </div>
              </div>

              {/* Module Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ECOSYSTEM_MODULES.map((mod) => {
                  const isCurrent = mod.id === currentModuleId;
                  const Icon = ICON_MAP[mod.iconName] || Layers;
                  const effectivePort = resolveEffectivePort(mod.id, mod.defaultPort);
                  const modUrl = resolveModuleUrl(effectivePort, mod.id);
                  const isCopied = copiedPort === effectivePort;

                  return (
                    <div
                      key={mod.id}
                      className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all duration-200 ${
                        isCurrent
                          ? 'border-primary/60 bg-primary/5 shadow-md shadow-primary/5 ring-1 ring-primary/40'
                          : 'border-border bg-card/60 hover:border-border/80 hover:bg-muted/30'
                      }`}
                    >
                      {/* Card Header */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                isCurrent
                                  ? 'bg-primary text-primary-foreground border-primary/40'
                                  : 'bg-secondary text-foreground border-border'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-foreground">{mod.name}</h3>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary text-primary-foreground animate-in zoom-in-50">
                                    YOU ARE HERE
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-medium text-primary line-clamp-1">{mod.role}</p>
                            </div>
                          </div>

                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-secondary border border-border text-muted-foreground shrink-0">
                            {mod.badgeText}
                          </span>
                        </div>

                        {/* Tagline & Description */}
                        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{mod.description}</p>

                        {/* Tech Stack Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {mod.techStack.map((tech) => (
                            <span
                              key={tech}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-muted/60 border border-border/50 text-foreground/80"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>

                        {/* Key Capabilities */}
                        <div className="space-y-2 mb-4">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Key Capabilities & Functionality
                          </p>
                          <ul className="space-y-1.5">
                            {mod.capabilities.slice(0, 3).map((cap, i) => (
                              <li key={i} className="text-xs flex items-start gap-2 text-foreground/90">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                                <div>
                                  <span className="font-semibold">{cap.title}:</span>{' '}
                                  <span className="text-muted-foreground">{cap.desc}</span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Card Footer & Network Link Actions */}
                      <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs mt-2">
                        {effectivePort ? (
                          <div className="flex items-center gap-2 truncate">
                            <span className="font-mono text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
                              Port {effectivePort}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground truncate" title={modUrl}>
                              {modUrl}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Cloud / Browser Environment</span>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          {effectivePort && (
                            <button
                              onClick={() => handleCopyUrl(modUrl, effectivePort)}
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Copy URL"
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {effectivePort && !isCurrent ? (
                            <a
                              href={modUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-all shadow-sm"
                            >
                              <span>Open App</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : isCurrent ? (
                            <span className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-[11px] font-semibold border border-border">
                              Current App
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: INTER-MODULE LIFECYCLE WORKFLOW */}
          {activeTab === 'lifecycle' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <h3 className="text-sm font-bold mb-1">Standard 5-Step Systematic Review Data Flow</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  The diagram below illustrates how research reference packages, blinded human calibration pools,
                  and finalized publication cohorts move through the SLR Magic ecosystem.
                </p>
              </div>

              {/* Step List */}
              <div className="space-y-4">
                {ECOSYSTEM_WORKFLOW_STEPS.map((step) => {
                  const fromMod = ECOSYSTEM_MODULES.find((m) => m.id === step.fromModuleId);
                  const toMod = ECOSYSTEM_MODULES.find((m) => m.id === step.toModuleId);

                  return (
                    <div
                      key={step.step}
                      className="p-4 rounded-xl border border-border bg-card/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          {step.step}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-foreground">{step.name}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted border border-border text-foreground">
                              {step.fileFormat}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{step.description}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <Lock className="w-3 h-3 shrink-0" />
                            <span>{step.privacyGuarantee}</span>
                          </div>
                        </div>
                      </div>

                      {/* Route Pill */}
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs shrink-0 self-stretch md:self-auto justify-center">
                        <span className="font-semibold text-foreground">{fromMod?.shortName || 'External DB'}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-semibold text-primary">{toMod?.shortName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DATA EXCHANGE FILE FORMATS */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl border border-border bg-muted/20">
                <h3 className="text-sm font-bold mb-1">Standardized File Handshakes & Offline Interoperability</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  SLR Magic uses simple, file-based exchange protocols. No database ports are opened across the network,
                  and no external microservices are required.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ECOSYSTEM_FILE_SPECS.map((file) => (
                  <div key={file.extension} className="p-5 rounded-xl border border-border bg-card/60 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-mono font-black text-xs">
                          {file.extension}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold">{file.fullName}</h4>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">{file.extension}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{file.purpose}</p>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-t border-border/50">
                        <span className="text-muted-foreground">Primary Producer:</span>
                        <span className="font-semibold text-foreground">{file.primaryProducer}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-border/50">
                        <span className="text-muted-foreground">Primary Consumer:</span>
                        <span className="font-semibold text-foreground">{file.primaryConsumer}</span>
                      </div>
                      <div className="flex justify-between py-1 border-t border-border/50">
                        <span className="text-muted-foreground">Internal Structure:</span>
                        <span className="font-mono text-[11px] text-foreground text-right">{file.formatDescription}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{file.privacyNote}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/40 shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span>
              For full architectural specs and security policies, inspect{' '}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">AGENTS.md</code> and{' '}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] text-foreground">architecture.md</code>.
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold transition-all border border-border cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
