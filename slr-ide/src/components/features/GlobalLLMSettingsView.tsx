'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, KeyRound, Key, RefreshCw, Loader, AlertTriangle, ShieldCheck, 
  BookOpen, Terminal, Database, Play, Pause, XCircle, ChevronRight, Save, Eye, EyeOff, Trash2, Plus, Info, X, Sparkles
} from 'lucide-react';
import LLMAuditLogView from './LLMAuditLogView';
import { subscribeSyncChannel, broadcastSync } from '@/lib/sync-utils';

interface ModelPricing {
  model_id: string;
  provider: string;
  input_token_price: number;
  output_token_price: number;
  thinking_token_price: number;
  batch_discount: number;
  updated_at: string;
}

interface Prompt {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  system_prompt: string;
  user_prompt_template: string | null;
  response_schema: string | null;
  is_active: number;
  llm_config?: string;
  model_id?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  execution_mode?: string;
}

interface GlobalLLMSettingsViewProps {
  activeProject?: any;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  loadProjects?: () => void;
  preSelectedPaperIds?: string[];
}

export default function GlobalLLMSettingsView({ 
  activeProject, 
  showToast, 
  loadProjects,
  preSelectedPaperIds 
}: GlobalLLMSettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'settings' | 'prompts' | 'operations' | 'audit'>(
    preSelectedPaperIds && preSelectedPaperIds.length > 0 ? 'operations' : 'settings'
  );
  const [loading, setLoading] = useState(true);

  // --- TAB 1: VAULT SETTINGS STATE ---
  const [vaultInitialized, setVaultInitialized] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [configuredKeys, setConfiguredKeys] = useState<string[]>([]);
  const [pricingModels, setPricingModels] = useState<ModelPricing[]>([]);
  const [refreshingPricing, setRefreshingPricing] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editInputPrice, setEditInputPrice] = useState<string>('');
  const [editOutputPrice, setEditOutputPrice] = useState<string>('');

  // --- TAB 2: PROMPTS LIBRARY STATE ---
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [editorTab, setEditorTab] = useState<'info' | 'template' | 'schema' | 'config'>('info');

  // --- TAB 3: OPERATIONS STATE ---
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('IDLE');
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, processed: 0, cost: 0.0, tokens: 0 });
  const [connecting, setConnecting] = useState(false);
  const [taskType, setTaskType] = useState<'fast_filter' | 'gatekeeper' | 'scientist' | 'miner'>('fast_filter');
  const [paperSelectionMode, setPaperSelectionMode] = useState<'all' | 'limit' | 'range' | 'selected'>(
    preSelectedPaperIds && preSelectedPaperIds.length > 0 ? 'selected' : 'all'
  );
  const [batchLimit, setBatchLimit] = useState<number>(10);
  const [indexOffset, setIndexOffset] = useState<number>(0);
  const [overrideTemplateId, setOverrideTemplateId] = useState<string>('');
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);

  const logEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load configuration and vault state
  const loadVaultState = async () => {
    try {
      const res = await fetch('/api/vault');
      const data = await res.json();
      setVaultInitialized(data.initialized);
      setVaultUnlocked(data.unlocked);

      if (data.unlocked) {
        // List saved keys in vault
        const keyRes = await fetch('/api/vault/keys');
        const keyData = await keyRes.json();
        setConfiguredKeys(keyData.keys || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPricing = async () => {
    try {
      const res = await fetch('/api/llm/pricing');
      const data = await res.json();
      if (data.success) {
        setPricingModels(data.models || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPrompts = async () => {
    if (!activeProject?.id) return;
    try {
      const res = await fetch(`/api/llm/prompts?project_id=${activeProject.id}&include_global=true`);
      const data = await res.json();
      if (data.success) {
        const loadedPrompts = data.prompts || [];
        setPrompts(loadedPrompts);
        if (loadedPrompts.length > 0 && !overrideTemplateId) {
          setOverrideTemplateId(loadedPrompts[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const checkActiveJob = async () => {
    if (!activeProject?.id) return;
    try {
      const res = await fetch(`/api/llm/jobs/active?projectId=${activeProject.id}`);
      const data = await res.json();
      if (data.success && data.jobs && data.jobs.length > 0) {
        const activeJob = data.jobs[0];
        setJobId(activeJob.id);
        setJobStatus(activeJob.status);
        if (activeJob.task_type) {
          setTaskType(activeJob.task_type as any);
        }
        setMetrics({
          total: activeJob.total_papers || 0,
          processed: activeJob.processed_papers || 0,
          cost: activeJob.total_cost || 0,
          tokens: (activeJob.total_input_tokens || 0) + (activeJob.total_output_tokens || 0)
        });
        connectSSE(activeJob.id);
      } else {
        setJobStatus('IDLE');
        setJobId(null);
      }
    } catch (err) {
      console.error('Failed to check active job:', err);
    }
  };

  const checkActiveJobRef = useRef(checkActiveJob);
  useEffect(() => {
    checkActiveJobRef.current = checkActiveJob;
  });

  useEffect(() => {
    Promise.all([loadVaultState(), loadPricing(), loadPrompts(), checkActiveJob()]).then(() => {
      setLoading(false);
    });
  }, [activeProject?.id]);

  useEffect(() => {
    const unsubscribe = subscribeSyncChannel((type) => {
      if (type === 'SYNC_LLM_JOB') {
        checkActiveJobRef.current();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Handle Vault Passwords
  const handleVaultAuth = async (action: 'setup' | 'unlock') => {
    if (!password) return;
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast?.(action === 'setup' ? 'Vault initialized successfully!' : 'Vault unlocked successfully!', 'success');
      setPassword('');
      setConfirmPassword('');
      loadVaultState();
    } catch (err: any) {
      showToast?.(err.message || 'Vault operation failed', 'error');
    }
  };

  const handleLockVault = async () => {
    try {
      await fetch('/api/vault', { method: 'DELETE' });
      showToast?.('Vault locked successfully', 'info');
      setVaultUnlocked(false);
      loadVaultState();
    } catch (err: any) {
      showToast?.('Failed to lock vault', 'error');
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey) return;
    try {
      const res = await fetch('/api/vault/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: 'GEMINI_API_KEY', plainValue: apiKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast?.('Gemini API key encrypted and saved successfully!', 'success');
      setApiKey('');
      loadVaultState();
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save key', 'error');
    }
  };

  const handleRefreshPricing = async () => {
    setRefreshingPricing(true);
    try {
      const res = await fetch('/api/llm/pricing/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast?.('Model list refreshed from Gemini API', 'success');
        setPricingModels(data.pricing || []);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to refresh pricing', 'error');
    } finally {
      setRefreshingPricing(false);
    }
  };

  const handleSaveModelPrice = async (modelId: string) => {
    try {
      const res = await fetch('/api/llm/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_id: modelId,
          input_token_price: Number(editInputPrice),
          output_token_price: Number(editOutputPrice)
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast?.('Model pricing updated successfully', 'success');
        setEditingModelId(null);
        loadPricing();
      } else {
        throw new Error(data.error || 'Failed to update price');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to update pricing', 'error');
    }
  };

  // --- TAB 2: PROMPTS LIBRARY CRUDS ---
  const validateSchemaField = (value: string) => {
    if (!value.trim()) {
      setSchemaError(null);
      return;
    }
    try {
      const parsed = JSON.parse(value);
      if (!parsed.type) {
        setSchemaError("JSON Schema must specify a 'type' property (usually 'OBJECT')");
        return;
      }
      setSchemaError(null);
    } catch (e: any) {
      setSchemaError(`JSON syntax error: ${e.message}`);
    }
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt?.name || !editingPrompt?.system_prompt) {
      showToast?.('Name and System prompt are required', 'warning');
      return;
    }
    if (schemaError) {
      showToast?.('Please resolve JSON Schema validation errors first', 'error');
      return;
    }

    setSavingPrompt(true);
    try {
      const configObj = {
        model_id: editingPrompt.model_id || 'gemini-2.5-flash',
        temperature: Number(editingPrompt.temperature !== undefined ? editingPrompt.temperature : 0.0),
        max_tokens: Number(editingPrompt.max_tokens !== undefined ? editingPrompt.max_tokens : 2000),
        top_p: Number(editingPrompt.top_p !== undefined ? editingPrompt.top_p : 0.9),
        top_k: editingPrompt.top_k !== undefined ? Number(editingPrompt.top_k) : 40,
        execution_mode: editingPrompt.execution_mode || 'flex'
      };

      const res = await fetch('/api/llm/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingPrompt,
          llm_config: JSON.stringify(configObj),
          project_id: activeProject?.id || null
        })
      });
      if (res.ok) {
        showToast?.('Prompt template saved successfully', 'success');
        setEditingPrompt(null);
        loadPrompts();
      } else {
        const errorData = await res.json();
        showToast?.(errorData.error || 'Failed to save template', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save prompt', 'error');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await fetch(`/api/llm/prompts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast?.('Template deleted successfully', 'success');
        loadPrompts();
      } else {
        showToast?.('Failed to delete template', 'error');
      }
    } catch (err: any) {
      showToast?.('Error deleting template', 'error');
    }
  };

  const startEditingPrompt = (p: Partial<Prompt>) => {
    const config = p.llm_config ? JSON.parse(p.llm_config) : {};
    setEditingPrompt({
      ...p,
      model_id: config.model_id || 'gemini-2.5-flash',
      temperature: config.temperature !== undefined ? config.temperature : 0.0,
      max_tokens: config.max_tokens !== undefined ? config.max_tokens : 2000,
      top_p: config.top_p !== undefined ? config.top_p : 0.9,
      top_k: config.top_k !== undefined ? config.top_k : 40,
      execution_mode: config.execution_mode || 'flex'
    });
    setEditorTab('info');
  };

  // --- TAB 3: OPERATIONS & STREAM CONTROLLER ---
  const connectSSE = async (targetJobId: string) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setConnecting(true);

    try {
      const response = await fetch(`/api/llm/screen/logs?jobId=${targetJobId}`, {
        signal: controller.signal
      });
      setConnecting(false);

      if (!response.body) throw new Error('No body stream returned');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          if (chunk.startsWith('data: ')) {
            const dataStr = chunk.replace('data: ', '').trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              handleSSEEvent(data);
            } catch (e) {
              // Ignore heartbeats
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setLogs(prev => [...prev, { status: 'ERROR', message: `Telemetry disconnect: ${err.message}` }]);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSSEEvent = (data: any) => {
    if (data.status) {
      setJobStatus(data.status);
    }
    if (data.message) {
      setLogs(prev => [...prev, data]);
    }
    // Update stats
    if (data.processed_papers !== undefined) {
      setMetrics({
        total: data.total_papers || 0,
        processed: data.processed_papers,
        cost: data.total_cost || 0,
        tokens: data.total_input_tokens + data.total_output_tokens
      });
    }
  };

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    let targetJobId = jobId;
    if (action === 'start') {
      targetJobId = `job-${Date.now()}`;
      setJobId(targetJobId);
      setLogs([{ status: 'STARTING', message: 'Initializing pipeline orchestrator...' }]);
      setMetrics({ total: 0, processed: 0, cost: 0.0, tokens: 0 });
      setJobStatus('STARTING');
    }

    try {
      let payload: any = {
        action: action === 'start' ? undefined : action,
        projectId: activeProject.id,
        jobId: targetJobId,
        taskType
      };

      if (action === 'start') {
        if (paperSelectionMode === 'limit') {
          payload.limit = batchLimit;
        } else if (paperSelectionMode === 'range') {
          payload.limit = batchLimit;
          payload.offset = indexOffset;
        } else if (paperSelectionMode === 'selected' && preSelectedPaperIds) {
          payload.paperIds = preSelectedPaperIds;
        }

        if (overrideTemplateId) {
          payload.templateId = overrideTemplateId;
        }
      }

      const res = await fetch('/api/llm/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error);

      if (action === 'start' || action === 'resume') {
        connectSSE(targetJobId!);
      } else if (action === 'cancel') {
        setJobStatus('CANCELLED');
        setLogs(prev => [...prev, { status: 'CANCELLED', message: 'Execution cancelled by user.' }]);
      }
      
      // Broadcast state sync change to other tabs
      broadcastSync('SYNC_LLM_JOB');
    } catch (err: any) {
      showToast?.(err.message || 'Operation failed', 'error');
      setJobStatus('FAILED');
    }
  };

  if (loading) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader className="w-5 h-5 animate-spin text-primary" />
        <span className="text-[10px] font-medium">Loading LLM manager layout...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[520px] text-xs">
      {/* Premium Glassmorphic Tab switcher */}
      <div className="flex border-b border-border bg-secondary/15 p-1 rounded-t-xl shrink-0 gap-1">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Vault Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('prompts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'prompts' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Prompt Library</span>
        </button>
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'operations' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Operations Center</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${activeTab === 'audit' ? 'bg-card text-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Audit Trail</span>
        </button>
      </div>

      {/* Tab Panels content */}
      <div className="flex-1 overflow-y-auto p-5 border-x border-b border-border/80 rounded-b-xl bg-card/25 backdrop-blur-md">
        
        {/* --- SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            {/* Vault Setup/Auth */}
            {!vaultUnlocked ? (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVaultAuth(vaultInitialized ? 'unlock' : 'setup');
                }}
                className="p-4 bg-secondary/35 border border-border/60 rounded-xl space-y-4 max-w-sm mx-auto mt-4"
              >
                <div className="flex flex-col items-center text-center gap-2">
                  <KeyRound className="w-8 h-8 text-primary animate-pulse" />
                  <h4 className="font-bold text-sm text-foreground">
                    {vaultInitialized ? 'Unlock Key Vault' : 'Initialize Key Vault'}
                  </h4>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    {vaultInitialized 
                      ? 'Enter your master password to decrypt access keys in-memory.' 
                      : 'Define a master password to secure API credentials locally.'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-bold text-muted-foreground">Master Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-secondary/60 border border-border/80 rounded-lg px-3 py-2 outline-none text-foreground font-mono"
                    />
                  </div>
                  {!vaultInitialized && (
                    <div className="space-y-1">
                      <label className="font-bold text-muted-foreground">Confirm Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-secondary/60 border border-border/80 rounded-lg px-3 py-2 outline-none text-foreground font-mono"
                      />
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-bold py-2 rounded-lg transition-all"
                  >
                    {vaultInitialized ? 'Unlock Vault' : 'Initialize Vault'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-3 rounded-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <span className="font-bold block text-foreground">Vault is unlocked</span>
                      <span className="text-[10px] text-muted-foreground">Keys will remain cached in memory for this session</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLockVault}
                    className="px-2.5 py-1 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg bg-red-500/10 hover:bg-red-500/15 transition-all font-bold"
                  >
                    Lock Vault
                  </button>
                </div>

                {/* API Key manager */}
                <div className="space-y-2 max-w-md">
                  <h4 className="font-bold text-muted-foreground">Gemini API Key</h4>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={configuredKeys.includes('GEMINI_API_KEY') ? '•••••••••••••••• (Encrypted on Disk)' : 'Enter Gemini API Key...'}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 pr-9 outline-none font-mono text-foreground transition-all"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-2.5 text-muted-foreground/60 hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSaveApiKey}
                      disabled={!apiKey}
                      className="px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl disabled:opacity-40 transition-all flex items-center gap-1 shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Key
                    </button>
                  </div>
                </div>

                {/* Model Pricing Cache */}
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-muted-foreground">Model Pricing Cache</h4>
                    <button
                      onClick={handleRefreshPricing}
                      disabled={refreshingPricing}
                      className="text-primary hover:text-primary/90 flex items-center gap-1 font-bold disabled:opacity-50"
                    >
                      {refreshingPricing ? <Loader className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Refresh Models
                    </button>
                  </div>

                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-secondary/20 font-bold border-b border-border/80 text-muted-foreground">
                          <th className="p-2.5">Model ID</th>
                          <th className="p-2.5 text-right">Input/1M</th>
                          <th className="p-2.5 text-right">Output/1M</th>
                          <th className="p-2.5">Last Sync</th>
                          <th className="p-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingModels.map((m) => {
                          const isEditing = editingModelId === m.model_id;
                          return (
                            <tr key={m.model_id} className="border-b border-border/40 hover:bg-secondary/10 align-middle">
                              <td className="p-2.5 font-mono text-[10px]">{m.model_id}</td>
                              <td className="p-2.5 text-right font-mono">
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    step="0.0001" 
                                    value={editInputPrice} 
                                    onChange={(e) => setEditInputPrice(e.target.value)}
                                    className="w-16 bg-secondary/80 border border-border/80 focus:border-primary/80 rounded px-1.5 py-0.5 text-right font-mono text-[10px] outline-none text-foreground font-bold"
                                  />
                                ) : (
                                  `$${m.input_token_price.toFixed(3)}`
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono">
                                {isEditing ? (
                                  <input 
                                    type="number" 
                                    step="0.0001" 
                                    value={editOutputPrice} 
                                    onChange={(e) => setEditOutputPrice(e.target.value)}
                                    className="w-16 bg-secondary/80 border border-border/80 focus:border-primary/80 rounded px-1.5 py-0.5 text-right font-mono text-[10px] outline-none text-foreground font-bold"
                                  />
                                ) : (
                                  `$${m.output_token_price.toFixed(3)}`
                                )}
                              </td>
                              <td className="p-2.5 text-muted-foreground text-[10px]">
                                {m.updated_at ? new Date(m.updated_at).toLocaleDateString() : 'Never'}
                              </td>
                              <td className="p-2.5 text-center">
                                {isEditing ? (
                                  <div className="flex justify-center gap-1.5">
                                    <button 
                                      onClick={() => handleSaveModelPrice(m.model_id)}
                                      className="text-emerald-400 hover:text-emerald-300 font-bold hover:scale-105 active:scale-95 transition-all text-[10px]"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingModelId(null)}
                                      className="text-muted-foreground hover:text-foreground font-bold hover:scale-105 active:scale-95 transition-all text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={() => {
                                      setEditingModelId(m.model_id);
                                      setEditInputPrice(m.input_token_price.toString());
                                      setEditOutputPrice(m.output_token_price.toString());
                                    }}
                                    className="text-primary hover:underline font-bold text-[10px]"
                                  >
                                    Edit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- PROMPT LIBRARY TAB --- */}
        {activeTab === 'prompts' && (
          <div className="space-y-4">
            {!editingPrompt ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">Select a prompt template to edit system rules and structured outputs.</span>
                  <button
                    onClick={() => startEditingPrompt({ name: '', system_prompt: '', user_prompt_template: '', response_schema: '' })}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Template</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {prompts.map((p) => (
                    <div 
                      key={p.id} 
                      onClick={() => startEditingPrompt(p)}
                      className="p-3 border border-border/60 hover:border-primary/50 bg-secondary/10 hover:bg-secondary/15 rounded-xl flex flex-col justify-between cursor-pointer transition-all group"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors">{p.name}</span>
                          {p.project_id === null && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold uppercase">Global</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
                      </div>
                      <div className="flex justify-end gap-1.5 mt-3 pt-2.5 border-t border-border/30">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditingPrompt(p); }}
                          className="text-primary hover:underline font-bold"
                        >
                          Edit
                        </button>
                        {p.project_id !== null && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePrompt(p.id); }}
                            className="text-red-400 hover:text-red-300 font-bold"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-secondary/5 border border-border/40 p-4 rounded-xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{editingPrompt.id ? 'Edit Prompt Template' : 'Create Prompt Template'}</h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Customize LLM instructions, Jinja2 template fields, and JSON schemas.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => { setEditingPrompt(null); setSchemaError(null); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Tabbed Editor Selector */}
                <div className="flex border-b border-border/40 pb-1 gap-1">
                  {[
                    { id: 'info', name: 'General & System' },
                    { id: 'template', name: 'Prompt Template' },
                    { id: 'schema', name: 'Structured JSON Output' },
                    { id: 'config', name: 'LLM Config' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setEditorTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        editorTab === tab.id
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>

                {/* Editor Content Area */}
                <div className="min-h-[360px]">
                  
                  {/* Tab 1: General Info & System Rules */}
                  {editorTab === 'info' && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Template Name</label>
                          <input
                            type="text"
                            value={editingPrompt.name || ''}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. Title Screening V2"
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Give this template a descriptive name (e.g. Title Screening V2).</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Description</label>
                          <input
                            type="text"
                            value={editingPrompt.description || ''}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Brief summary of template use case..."
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Optional summary of what this prompt is designed to accomplish.</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">System instruction</label>
                        <textarea
                          rows={11}
                          value={editingPrompt.system_prompt || ''}
                          onChange={(e) => setEditingPrompt(prev => ({ ...prev, system_prompt: e.target.value }))}
                          placeholder="You are an expert systematic review screening assistant. You evaluate if papers satisfy inclusion criteria..."
                          className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2 outline-none font-mono text-xs text-foreground resize-y min-h-[160px]"
                        />
                        <span className="text-[9px] text-muted-foreground/60 block px-1">System-level guidelines injected into Gemini's context defining its persona, rules, and constraints.</span>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: User Prompt & Placeholders */}
                  {editorTab === 'template' && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">User Template (Jinja2 format)</label>
                        <textarea
                          rows={11}
                          value={editingPrompt.user_prompt_template || ''}
                          onChange={(e) => setEditingPrompt(prev => ({ ...prev, user_prompt_template: e.target.value }))}
                          placeholder="Title: {{ Title }}\nAbstract: {{ Abstract }}\n\nDecision criteria rules:\n{{ rules }}"
                          className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2 outline-none font-mono text-xs text-foreground resize-y min-h-[160px]"
                        />
                        <span className="text-[9px] text-muted-foreground/60 block px-1">The dynamic user prompt. Use double curly braces `{"{{ Title }}"}` to reference paper properties.</span>
                      </div>

                      {/* Collapsible Placeholder List */}
                      <details className="group bg-secondary/20 border border-border/40 rounded-xl p-3">
                        <summary className="text-xs font-bold text-muted-foreground cursor-pointer select-none flex items-center justify-between list-none">
                          <span>Show Available Jinja2 Context Variables</span>
                          <span className="text-[10px] text-primary group-open:hidden">Expand Help</span>
                          <span className="text-[10px] text-primary hidden group-open:inline">Collapse Help</span>
                        </summary>
                        <div className="space-y-2 mt-2.5 pt-2.5 border-t border-border/30 text-[10px] text-muted-foreground">
                          <p className="leading-relaxed">
                            Placeholders are replaced dynamically during pipeline execution in python by mapping columns from the active SQLite project and paper rows. Python automatically generates both the original casing and lowercase aliases (e.g. <code>{"{{ Title }}"}</code> or <code>{"{{ title }}"}</code>).
                          </p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
                            <div><strong className="text-foreground">{"{{ Paper_ID }}"}</strong> (or <code>{"{{ id }}"}</code>): Unique record identifier.</div>
                            <div><strong className="text-foreground">{"{{ Title }}"}</strong> (or <code>{"{{ title }}"}</code>): Paper Title.</div>
                            <div><strong className="text-foreground">{"{{ Abstract }}"}</strong> (or <code>{"{{ abstract }}"}</code>): Paper Abstract.</div>
                            <div><strong className="text-foreground">{"{{ Authors }}"}</strong> (or <code>{"{{ authors }}"}</code>): Author names list.</div>
                            <div><strong className="text-foreground">{"{{ Year }}"}</strong> (or <code>{"{{ year }}"}</code>): Publication Year.</div>
                            <div><strong className="text-foreground">{"{{ DOI }}"}</strong> (or <code>{"{{ doi }}"}</code>): Digital Object Identifier.</div>
                            <div><strong className="text-foreground">{"{{ Source }}"}</strong> (or <code>{"{{ source }}"}</code>): Ingestion Source Database (Scopus, PubMed, etc.).</div>
                            <div><strong className="text-foreground">{"{{ PDF_Link }}"}</strong> (or <code>{"{{ pdf_link }}"}</code>): Download URL of the PDF.</div>
                            <div><strong className="text-foreground">{"{{ Publisher }}"}</strong> (or <code>{"{{ publisher }}"}</code>): Publisher name.</div>
                            <div><strong className="text-foreground">{"{{ citation_count }}"}</strong>: Scopus/CSV citation count.</div>
                          </div>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Tab 3: Structured Output JSON Schema */}
                  {editorTab === 'schema' && (
                    <div className="space-y-3.5 animate-in fade-in duration-150">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Structured Output JSON Schema</label>
                          {schemaError && (
                            <span className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">{schemaError}</span>
                          )}
                        </div>
                        <textarea
                          rows={11}
                          value={editingPrompt.response_schema || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingPrompt(prev => ({ ...prev, response_schema: val }));
                            validateSchemaField(val);
                          }}
                          placeholder='{ "type": "OBJECT", "properties": { "decision": { "type": "STRING" } }, "required": ["decision"] }'
                          className={`w-full bg-secondary/40 border ${schemaError ? 'border-red-500/60' : 'border-border/80'} rounded-xl px-3 py-2 outline-none font-mono text-xs text-foreground resize-y min-h-[160px]`}
                        />
                        <span className="text-[9px] text-muted-foreground/60 block px-1">Constrains the Gemini API to respond with a valid JSON object matching this schema. Required for screening/extraction stages.</span>
                      </div>

                      {/* Schema assistant actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              const val = editingPrompt.response_schema || '';
                              if (!val.trim()) return;
                              const parsed = JSON.parse(val);
                              setEditingPrompt(prev => ({ ...prev, response_schema: JSON.stringify(parsed, null, 2) }));
                              setSchemaError(null);
                            } catch (e: any) {
                              setSchemaError(`JSON syntax error: ${e.message}`);
                            }
                          }}
                          className="px-2.5 py-1 text-[10px] bg-secondary/40 hover:bg-secondary/60 border border-border/80 text-foreground font-bold rounded-lg transition-all"
                        >
                          Format JSON
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab 4: LLM Configuration */}
                  {editorTab === 'config' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gemini Model</label>
                          <select
                            value={editingPrompt.model_id || 'gemini-2.5-flash'}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, model_id: e.target.value }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-bold"
                          >
                            {pricingModels.length > 0 ? (
                              pricingModels
                                .filter(m => m.provider === 'gemini')
                                .map(m => (
                                  <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                                ))
                            ) : (
                              <>
                                <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                              </>
                            )}
                          </select>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Choose the Gemini model tier for this prompt execution.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Execution Speed Mode</label>
                          <select
                            value={editingPrompt.execution_mode || 'flex'}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, execution_mode: e.target.value }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-bold"
                          >
                            <option value="flex">Flex Mode (Batched & Discounted)</option>
                            <option value="standard">Standard Mode (Real-time)</option>
                          </select>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Flex mode offers 50% discount on Gemini speed rate limits.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Temperature ({editingPrompt.temperature !== undefined ? editingPrompt.temperature : 0.0})</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.1"
                              value={editingPrompt.temperature !== undefined ? editingPrompt.temperature : 0.0}
                              onChange={(e) => setEditingPrompt(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                              className="flex-1 accent-primary"
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">0.0 is deterministic, higher values increase creativity.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Max Output Tokens</label>
                          <input
                            type="number"
                            min="1"
                            max="16000"
                            value={editingPrompt.max_tokens !== undefined ? editingPrompt.max_tokens : 2000}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, max_tokens: Number(e.target.value) }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Hard limit on size of model JSON outputs.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top P</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={editingPrompt.top_p !== undefined ? editingPrompt.top_p : 0.9}
                              onChange={(e) => setEditingPrompt(prev => ({ ...prev, top_p: Number(e.target.value) }))}
                              className="flex-1 accent-primary"
                            />
                            <span className="text-[10px] font-mono text-muted-foreground min-w-[28px] text-right">{editingPrompt.top_p !== undefined ? editingPrompt.top_p : 0.9}</span>
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Nucleus sampling probability threshold.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top K</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={editingPrompt.top_k !== undefined ? editingPrompt.top_k : 40}
                            onChange={(e) => setEditingPrompt(prev => { if (!prev) return null; return { ...prev, top_k: e.target.value !== '' ? Number(e.target.value) : undefined }; })}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Limits token selection pool size. Default: 40.</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer Save / Cancel Controls */}
                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <button
                    type="button"
                    onClick={() => { setEditingPrompt(null); setSchemaError(null); }}
                    className="px-4 py-1.5 border border-border rounded-xl hover:bg-secondary/40 transition-colors font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    disabled={savingPrompt || !!schemaError}
                    className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-40 transition-all flex items-center gap-1.5 text-xs hover:scale-105 active:scale-95"
                  >
                    {savingPrompt ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Template</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- OPERATIONS TAB --- */}
        {activeTab === 'operations' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Top Control Panel */}
            <div className="bg-secondary/10 border border-border/40 rounded-xl p-4 space-y-4">
              
              {/* Row 1: Stage Taxonomy Selector */}
              <div className="space-y-2">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">1. Select Pipeline Stage</span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'fast_filter', name: 'Fast Filter', desc: 'Metadata (Flash)' },
                    { id: 'gatekeeper', name: 'Gatekeeper', desc: 'PDF Screen (Pro)' },
                    { id: 'scientist', name: 'Scientist', desc: 'QA Check (Pro)' },
                    { id: 'miner', name: 'Miner', desc: 'Extraction (Pro)' },
                  ].map((stage) => (
                    <button
                      key={stage.id}
                      disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                      onClick={() => setTaskType(stage.id as any)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                        taskType === stage.id
                          ? 'border-primary bg-primary/10 text-primary shadow-sm font-bold scale-[1.02]'
                          : 'border-border/60 bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="text-xs font-bold">{stage.name}</span>
                      <span className="text-[9px] mt-0.5 opacity-80">{stage.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Prompt Template Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">2. Select Prompt Template</span>
                  <select
                    value={overrideTemplateId}
                    onChange={(e) => setOverrideTemplateId(e.target.value)}
                    disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                    className={`w-full bg-secondary/40 border ${!overrideTemplateId ? 'border-amber-500/80 bg-amber-500/5' : 'border-border/80'} rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none font-bold`}
                  >
                    <option value="">-- Select a Prompt Template --</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                  {!overrideTemplateId && (
                    <span className="text-[9px] text-amber-500 font-bold block px-1 animate-pulse">A prompt template is required to execute this stage.</span>
                  )}
                </div>

                {/* Row 3: Paper Selection Mode Selector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">3. Paper Range / Selection Mode</span>
                  <select
                    value={paperSelectionMode}
                    onChange={(e) => setPaperSelectionMode(e.target.value as any)}
                    disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                    className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none font-bold"
                  >
                    <option value="all">All Pending Papers</option>
                    <option value="limit">Limit Batch Size</option>
                    <option value="range">Index Range (Offset + Limit)</option>
                    {preSelectedPaperIds && preSelectedPaperIds.length > 0 && (
                      <option value="selected">Pre-selected Papers ({preSelectedPaperIds.length})</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 4: Conditionally Render Selection Parameters */}
              {paperSelectionMode === 'limit' && (
                <div className="grid grid-cols-3 gap-3 pt-1 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Batch Size (Count)</label>
                    <input
                      type="number"
                      min={1}
                      value={batchLimit}
                      onChange={(e) => setBatchLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                      className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {paperSelectionMode === 'range' && (
                <div className="grid grid-cols-2 gap-4 pt-1 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Start Offset (Chronological Index)</label>
                    <input
                      type="number"
                      min={0}
                      value={indexOffset}
                      onChange={(e) => setIndexOffset(Math.max(0, parseInt(e.target.value) || 0))}
                      disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                      className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Max Papers to Run</label>
                    <input
                      type="number"
                      min={1}
                      value={batchLimit}
                      onChange={(e) => setBatchLimit(Math.max(1, parseInt(e.target.value) || 1))}
                      disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                      className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1 text-xs text-foreground outline-none font-bold"
                    />
                  </div>
                </div>
              )}

              {paperSelectionMode === 'selected' && preSelectedPaperIds && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-muted-foreground flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Selected <strong>{preSelectedPaperIds.length} papers</strong> from the database view checkmarks.</span>
                  </div>
                  <button
                    onClick={() => setPaperSelectionMode('all')}
                    disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    Switch to All
                  </button>
                </div>
              )}
            </div>

            {/* Run Actions and Metrics Row */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                Status: <span className="text-foreground">{jobStatus}</span>
              </div>
              <div className="flex gap-2">
                {['IDLE', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(jobStatus) ? (
                  <button
                    disabled={!overrideTemplateId}
                    onClick={() => { setShowLaunchConfirm(true); setConfirmStep(1); }}
                    className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-primary/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch Stage execution</span>
                  </button>
                ) : (
                  <>
                    {jobStatus === 'PAUSED_BUDGET' ? (
                      <button
                        onClick={() => handleAction('resume')}
                        className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all hover:scale-105"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume (Cleared Budget)</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction('pause')}
                        className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all"
                        disabled
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleAction('cancel')}
                      className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all hover:scale-105"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Terminate Run</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Performance metrics dashboard widgets */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl text-center">
                <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase">Processed</span>
                <span className="text-sm font-bold text-foreground font-mono">{metrics.processed} / {metrics.total}</span>
              </div>
              <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl text-center">
                <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase">Total Cost</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">${metrics.cost.toFixed(4)}</span>
              </div>
              <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl text-center">
                <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase">Tokens</span>
                <span className="text-sm font-bold text-foreground font-mono">{metrics.tokens.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl text-center">
                <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase">Job status</span>
                <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                  jobStatus === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                  jobStatus === 'RUNNING' || jobStatus === 'STARTING' ? 'bg-primary/10 text-primary animate-pulse' :
                  jobStatus === 'PAUSED_BUDGET' ? 'bg-yellow-500/10 text-yellow-400' :
                  jobStatus === 'FAILED' ? 'bg-red-500/10 text-red-400' : 'bg-secondary/40 text-muted-foreground'
                }`}>
                  {jobStatus}
                </span>
              </div>
            </div>

            {/* Subprocess Console Screen */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
                  Execution Logs
                </span>
                <button
                  onClick={() => {
                    const el = document.getElementById('llm-exec-logs');
                    if (el) el.scrollTop = el.scrollHeight;
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Scroll to bottom"
                >
                  ↓ Scroll to end
                </button>
              </div>
              {/* Terminal-style log panel with resize handle */}
              <div
                id="llm-exec-logs"
                className="overflow-y-auto font-mono text-[10px] leading-relaxed select-text"
                style={{
                  height: '200px',
                  minHeight: '100px',
                  maxHeight: '600px',
                  resize: 'vertical',
                  background: 'linear-gradient(135deg, #0d1117 0%, #0f1923 100%)',
                  border: '1px solid rgba(99,110,123,0.25)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
                  scrollbarWidth: 'thin',
                  scrollbarColor: 'rgba(99,110,123,0.3) transparent',
                }}
              >
                {logs.length === 0 ? (
                  <span style={{ color: 'rgba(125,133,144,0.55)' }} className="italic">
                    No active logs. Select options and click Launch Stage execution to start.
                  </span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {logs.map((l, i) => {
                      let color = '#8b949e'; // default: muted grey
                      let prefix = '  ';
                      if (l.status === 'ERROR') { color = '#ff6b6b'; prefix = '✗ '; }
                      else if (l.status === 'COMPLETED' || l.status === 'SUCCESS') { color = '#3fb950'; prefix = '✓ '; }
                      else if (l.status === 'WARNING') { color = '#e3b341'; prefix = '⚠ '; }
                      else if (l.status === 'PROGRESS' || l.status === 'RUNNING') { color = '#58a6ff'; prefix = '› '; }
                      const ts = l.timestamp ? `[${new Date(l.timestamp).toLocaleTimeString()}] ` : '';
                      return (
                        <div key={i} className="whitespace-pre-wrap leading-relaxed" style={{ color }}>
                          <span style={{ color: 'rgba(125,133,144,0.45)', fontSize: '9px', userSelect: 'none' }}>{ts}</span>
                          <span>{prefix}</span>
                          <span>{l.message || JSON.stringify(l)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={logEndRef} />
              </div>
              <p className="text-[9px] text-muted-foreground/40 text-right">Drag bottom-right corner to resize</p>
            </div>
          </div>
        )}

        {/* --- AUDIT TRAIL TAB --- */}
        {activeTab === 'audit' && (
          <LLMAuditLogView activeProject={activeProject} showToast={showToast} />
        )}

        {/* --- LAUNCH STAGE EXECUTION CONFIRMATION MODAL --- */}
        {showLaunchConfirm && (() => {
          const stageInfo = {
            fast_filter: { name: 'Fast Filter', desc: 'Metadata Screening', model: 'Gemini 3.5 Flash' },
            gatekeeper: { name: 'Gatekeeper', desc: 'PDF Screening', model: 'Gemini 3.1 Pro Preview' },
            scientist: { name: 'Scientist', desc: 'Quality Assessment QA', model: 'Gemini 3.1 Pro Preview' },
            miner: { name: 'Miner', desc: 'Structured Data Extraction', model: 'Gemini 3.1 Pro Preview' }
          }[taskType];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
              <div className="bg-background/95 border border-border/80 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden scale-in-center">
                
                {/* Header */}
                <div className="p-4 border-b border-border/60 bg-secondary/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="font-bold text-foreground text-sm">
                        {confirmStep === 1 ? 'Confirm Stage Execution - Step 1: Targets' : 'Confirm Stage Execution - Step 2: Prompt Details'}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">Verify pipeline configurations before running the LLM orchestrator.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 font-bold rounded bg-primary/15 text-primary">
                      Step {confirmStep} of 2
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowLaunchConfirm(false)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Plan details */}
                <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1 min-h-0">
                  
                  {confirmStep === 1 && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Stage & Key Status Widgets */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl space-y-1">
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">1. Pipeline Stage & Model</span>
                          <div className="font-bold text-foreground text-xs">{stageInfo.name}</div>
                          <div className="text-[10px] text-muted-foreground">{stageInfo.desc} • <span className="font-mono text-primary font-bold">{stageInfo.model}</span></div>
                        </div>

                        <div className={`p-3 border rounded-xl space-y-1 ${
                          configuredKeys.includes('GEMINI_API_KEY') 
                            ? 'bg-emerald-500/5 border-emerald-500/20' 
                            : 'bg-red-500/5 border-red-500/20'
                        }`}>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase">2. API Key / Vault Status</span>
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            {configuredKeys.includes('GEMINI_API_KEY') ? (
                              <>
                                <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
                                <span className="text-emerald-400">Vault Key Unlocked</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-red-400">API Key Missing</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {configuredKeys.includes('GEMINI_API_KEY') ? 'Decrypted in memory' : 'Configure in Tab 1 first'}
                          </div>
                        </div>
                      </div>

                      {/* Target paper range */}
                      <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl space-y-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">3. Target Paper Count & Mode</span>
                        <div className="font-bold text-foreground text-xs">
                          {paperSelectionMode === 'all' && 'All Pending Papers in Project'}
                          {paperSelectionMode === 'limit' && `Limit Batch Size: Run first ${batchLimit} pending papers`}
                          {paperSelectionMode === 'range' && `Index Range: Run ${batchLimit} papers starting from index offset ${indexOffset}`}
                          {paperSelectionMode === 'selected' && `Pre-selected Checkbox List: Run on ${preSelectedPaperIds?.length || 0} papers`}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Papers will be executed sequentially matching database chronological rowid ordering.
                        </div>
                      </div>
                    </div>
                  )}

                  {confirmStep === 2 && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Prompt Verification section */}
                      <div className="space-y-3">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block border-b border-border/30 pb-1">4. Complete Prompt & Rules Preview</span>
                        
                        {overrideTemplateId ? (
                          (() => {
                            const selectedPrompt = prompts.find(p => p.id === overrideTemplateId);
                            if (!selectedPrompt) return <div className="text-red-400 font-bold">Override template not found.</div>;
                            return (
                              <div className="space-y-4">
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                                  <span className="text-[10px] text-primary font-bold block mb-1">Override Template Selected: {selectedPrompt.name}</span>
                                  <span className="text-[9px] text-muted-foreground block">{selectedPrompt.description || 'No description.'}</span>
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-[10px] text-muted-foreground font-bold block">System Instructions:</span>
                                  <div className="max-h-48 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-100 whitespace-pre-wrap select-all border-l-2 border-l-primary/60 leading-relaxed">
                                    {selectedPrompt.system_prompt}
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <span className="text-[10px] text-muted-foreground font-bold block">User Template (Jinja2 format):</span>
                                  <div className="max-h-48 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-100 whitespace-pre-wrap select-all border-l-2 border-l-primary/60 leading-relaxed">
                                    {selectedPrompt.user_prompt_template}
                                  </div>
                                </div>

                                {selectedPrompt.response_schema && (
                                  <div className="space-y-1.5">
                                    <span className="text-[10px] text-muted-foreground font-bold block">Structured Output JSON Schema:</span>
                                    <pre className="max-h-48 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-emerald-400 select-all border-l-2 border-l-emerald-500/60 leading-relaxed">
                                      {(() => {
                                        try {
                                          return JSON.stringify(JSON.parse(selectedPrompt.response_schema), null, 2);
                                        } catch (e) {
                                          return selectedPrompt.response_schema;
                                        }
                                      })()}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-1">
                            <span className="font-bold text-yellow-400 block">Using Default Project Config Templates</span>
                            <p className="text-[10px] text-muted-foreground leading-normal">
                              This stage will run using the default system prompts defined in python execution files, combined with project rules (e.g. active exclusion criteria checklist rules for Screening, QA metrics, or data miner specifications).
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border/60 bg-secondary/20 flex justify-between items-center">
                  <div>
                    {confirmStep === 2 && (
                      <button
                        type="button"
                        onClick={() => setConfirmStep(1)}
                        className="px-4 py-1.5 border border-border rounded-xl hover:bg-secondary/40 font-bold transition-all text-xs"
                      >
                        Previous Step
                      </button>
                    )}
                    {confirmStep === 1 && (
                      <button
                        type="button"
                        onClick={() => setShowLaunchConfirm(false)}
                        className="px-4 py-1.5 border border-border rounded-xl hover:bg-secondary/40 font-bold transition-all text-xs"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  <div>
                    {confirmStep === 1 && (
                      <button
                        type="button"
                        onClick={() => setConfirmStep(2)}
                        className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl transition-all hover:scale-105 text-xs font-bold"
                      >
                        Next Step
                      </button>
                    )}
                    {confirmStep === 2 && (
                      <button
                        type="button"
                        disabled={!configuredKeys.includes('GEMINI_API_KEY')}
                        onClick={() => {
                          setShowLaunchConfirm(false);
                          handleAction('start');
                        }}
                        className="px-4 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-40 text-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Start Stage Execution</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
