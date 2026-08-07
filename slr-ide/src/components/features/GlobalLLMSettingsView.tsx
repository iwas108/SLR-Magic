'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, KeyRound, Key, RefreshCw, Loader, AlertTriangle, ShieldCheck, 
  BookOpen, Terminal, Database, Play, Pause, XCircle, ChevronRight, ChevronDown, Save, Eye, EyeOff, Trash2, Plus, Info, X, Sparkles, SlidersHorizontal
} from 'lucide-react';
import { useSseStream } from '@/hooks/useSseStream';
import LLMAuditLogView from './LLMAuditLogView';
import { subscribeSyncChannel, broadcastSync } from '@/lib/sync-utils';
import { useGlobalPipelineLock } from '@/hooks/useGlobalPipelineLock';

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
  request_delay?: number;
  interaction_chaining?: boolean;
  concurrency?: number;
  timeout_seconds?: number;
  thinking_level?: string;
  discount?: number;
}

interface GlobalLLMSettingsViewProps {
  activeProject?: any;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  loadProjects?: () => void;
  preSelectedPaperIds?: string[];
}

function extractSchemaKeyPaths(schemaStr: string | null | undefined): string[] {
  if (!schemaStr || !schemaStr.trim()) return [];
  try {
    const parsed = JSON.parse(schemaStr);
    const paths: string[] = [];

    const traverse = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object') return;
      const properties = obj.properties || (obj.type === 'OBJECT' && obj.properties ? obj.properties : null);
      if (properties && typeof properties === 'object') {
        for (const [key, value] of Object.entries(properties)) {
          const currentPath = prefix ? `${prefix}.${key}` : key;
          paths.push(currentPath);
          if (value && typeof value === 'object') {
            traverse(value, currentPath);
          }
        }
      }
    };

    traverse(parsed);
    return Array.from(new Set(paths));
  } catch {
    return [];
  }
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

  const { isLocked, forceUnlock } = useGlobalPipelineLock();

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

  // Disable triggering if locked by another pipeline and we are not currently running
  const isLlmLocked = isLocked && !['RUNNING', 'PAUSED_BUDGET', 'PAUSED_USER', 'PENDING'].includes(jobStatus);

  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ total: 0, processed: 0, cost: 0.0, tokens: 0, included: 0, excluded: 0, exclusion_reasons: {} as Record<string, number>, not_stated_metrics: {} as Record<string, number>, avgExecutionTimeMs: 0 });
  const [connecting, setConnecting] = useState(false);
  const [taskType, setTaskType] = useState<'fast_filter' | 'gatekeeper' | 'scientist' | 'miner' | 'umbrellanizer'>('fast_filter');
  const [extractedKeysState, setExtractedKeysState] = useState<string[]>([]);
  const [selectedUmbrellaKey, setSelectedUmbrellaKey] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('0');
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL');
  const [excludeManual, setExcludeManual] = useState<boolean>(true);
  const [paperSelectionMode, setPaperSelectionMode] = useState<'all' | 'all_project' | 'limit' | 'range' | 'selected' | 'snowballing'>(
    preSelectedPaperIds && preSelectedPaperIds.length > 0 ? 'selected' : 'all'
  );
  const [batchLimit, setBatchLimit] = useState<number>(10);
  const [indexOffset, setIndexOffset] = useState<number>(0);
  const [targetCount, setTargetCount] = useState<number | null>(null);
  const pipelineCount = (() => {
    if (targetCount === null) return 0;
    if (paperSelectionMode === 'limit') {
      return Math.min(targetCount, batchLimit);
    } else if (paperSelectionMode === 'range') {
      return Math.max(0, Math.min(targetCount - indexOffset, batchLimit));
    } else {
      return targetCount;
    }
  })();
  // --- DEFAULT STAGE PROMPTS & SCHEMA MAPPER STATE ---
  const [defaultPromptsState, setDefaultPromptsState] = useState<Record<string, string>>({});
  const [schemaMappingsState, setSchemaMappingsState] = useState<Record<string, Record<string, string>>>({});
  const [customKeyModesState, setCustomKeyModesState] = useState<Record<string, boolean>>({});
  const [savingStageConfig, setSavingStageConfig] = useState(false);
  const [isExpandedStageMapper, setIsExpandedStageMapper] = useState(true);

  // Toggle custom text input mode for a key path field
  const toggleCustomKeyMode = (stage: string, keyName: string, isCustom: boolean) => {
    setCustomKeyModesState(prev => ({
      ...prev,
      [`${stage}:${keyName}`]: isCustom
    }));
  };

  // Sync stage defaults from activeProject.llm_config
  useEffect(() => {
    try {
      const cfg = activeProject?.llm_config ? JSON.parse(activeProject.llm_config) : {};
      setDefaultPromptsState(cfg.default_prompts || {});
      setSchemaMappingsState(cfg.schema_mappings || {});
    } catch {
      setDefaultPromptsState({});
      setSchemaMappingsState({});
    }
  }, [activeProject?.id, activeProject?.llm_config]);

  // Handler to update a single stage default prompt assignment
  const handleStagePromptChange = (stage: string, promptId: string) => {
    setDefaultPromptsState(prev => ({
      ...prev,
      [stage]: promptId
    }));
  };

  // Handler to update a schema key path for a specific stage
  const handleSchemaKeyChange = (stage: string, keyName: string, pathValue: string) => {
    setSchemaMappingsState(prev => ({
      ...prev,
      [stage]: {
        ...(prev[stage] || {}),
        [keyName]: pathValue
      }
    }));
  };

  // Auto-fill standard defaults for a specific stage
  const handleLoadDefaultSchemaKeys = (stage: string) => {
    const standardKeys: Record<string, Record<string, string>> = {
      fast_filter: { decision: 'decision', exclusion_trigger: 'exclusion_trigger', rationale: 'rationale' },
      gatekeeper: { decision: 'decision', exclusion_trigger: 'exclusion_trigger', rationale: 'rationale' },
      scientist: { quality_assessment: 'qa_scores', decision: 'final_evaluation.decision', exclusion_trigger: 'final_evaluation.exclusion_code', rationale: 'final_evaluation.reasoning' },
      miner: { extracted_data: 'extracted_data', rationale: 'rationale' }
    };

    setSchemaMappingsState(prev => ({
      ...prev,
      [stage]: standardKeys[stage] || { decision: 'decision', rationale: 'rationale' }
    }));

    // Reset custom input mode for this stage's keys
    setCustomKeyModesState(prev => {
      const next = { ...prev };
      Object.keys(standardKeys[stage] || {}).forEach(k => {
        delete next[`${stage}:${k}`];
      });
      return next;
    });
  };

  // Save stage configuration (default_prompts & schema_mappings) to active project
  const handleSaveStageConfig = async () => {
    if (!activeProject?.id) {
      showToast?.('No active project selected to save settings.', 'error');
      return;
    }

    setSavingStageConfig(true);
    try {
      let currentLlmConfig: any = {};
      try {
        currentLlmConfig = activeProject.llm_config ? JSON.parse(activeProject.llm_config) : {};
      } catch {
        currentLlmConfig = {};
      }

      const updatedLlmConfig = {
        ...currentLlmConfig,
        default_prompts: defaultPromptsState,
        schema_mappings: schemaMappingsState
      };

      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeProject,
          llm_config: updatedLlmConfig
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update project LLM configuration');
      }

      showToast?.('Stage prompt defaults & schema mappings saved successfully!', 'success');
      loadProjects?.();
      broadcastSync('SYNC_PROJECTS');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save stage configuration', 'error');
    } finally {
      setSavingStageConfig(false);
    }
  };

  const activeTemplateId = (() => {
    if (defaultPromptsState[taskType]) return defaultPromptsState[taskType];
    try {
      const cfg = activeProject?.llm_config ? JSON.parse(activeProject.llm_config) : {};
      return cfg.default_prompts?.[taskType] || '';
    } catch {
      return '';
    }
  })();

  const renderSchemaKeySelector = (
    keyName: string, 
    label: string, 
    defaultFallback: string, 
    colSpanClass: string = ""
  ) => {
    const currentPromptId = defaultPromptsState[taskType] || activeTemplateId;
    const currentPrompt = prompts.find(p => p.id === currentPromptId);
    const extractedKeys = extractSchemaKeyPaths(currentPrompt?.response_schema);
    const currentSavedVal = schemaMappingsState[taskType]?.[keyName] !== undefined 
      ? schemaMappingsState[taskType][keyName] 
      : defaultFallback;

    const modeKey = `${taskType}:${keyName}`;
    const isCustomActive = customKeyModesState[modeKey] || (
      extractedKeys.length > 0 && 
      currentSavedVal !== defaultFallback && 
      !extractedKeys.includes(currentSavedVal)
    );

    return (
      <div className={`space-y-1 ${colSpanClass}`}>
        <div className="flex items-center justify-between">
          <label className="text-[9px] font-bold text-muted-foreground uppercase">{label}</label>
          {extractedKeys.length > 0 && (
            <span className="text-[8px] font-mono text-primary font-bold">
              {extractedKeys.length} schema {extractedKeys.length === 1 ? 'key' : 'keys'} found
            </span>
          )}
        </div>

        {extractedKeys.length > 0 ? (
          <div className="space-y-1">
            <select
              value={isCustomActive ? '__custom__' : currentSavedVal}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__custom__') {
                  toggleCustomKeyMode(taskType, keyName, true);
                } else {
                  toggleCustomKeyMode(taskType, keyName, false);
                  handleSchemaKeyChange(taskType, keyName, val);
                }
              }}
              className="w-full bg-secondary/50 border border-border/80 rounded-lg px-2.5 py-1 text-xs font-mono text-foreground outline-none font-bold"
            >
              {!extractedKeys.includes(defaultFallback) && (
                <option value={defaultFallback}>Default: {defaultFallback}</option>
              )}
              {extractedKeys.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
              <option value="__custom__">Custom Key Path...</option>
            </select>

            {isCustomActive && (
              <input
                type="text"
                value={currentSavedVal}
                onChange={(e) => handleSchemaKeyChange(taskType, keyName, e.target.value)}
                placeholder={`Enter custom key path for ${keyName}...`}
                className="w-full bg-secondary/40 border border-primary/50 focus:border-primary rounded-lg px-2.5 py-1 text-xs font-mono text-foreground outline-none mt-1 animate-in fade-in duration-150"
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            value={currentSavedVal}
            onChange={(e) => handleSchemaKeyChange(taskType, keyName, e.target.value)}
            placeholder={`e.g. ${defaultFallback}`}
            className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1 text-xs font-mono text-foreground outline-none"
          />
        )}
      </div>
    );
  };

  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);

  // Load extracted keys for umbrellanizer stage
  useEffect(() => {
    if (!activeProject?.id) return;
    fetch(`/api/export/cloud-gold-mine/keys?project_id=${activeProject.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.keys)) {
          setExtractedKeysState(data.keys);
          if (data.keys.length > 0 && !selectedUmbrellaKey) {
            setSelectedUmbrellaKey(data.keys[0]);
          }
        }
      })
      .catch(err => console.error('Failed to load keys for umbrellanizer', err));
  }, [activeProject?.id]);

  // Sync statusFilter whenever taskType changes
  useEffect(() => {
    const defaults: Record<string, string> = {
      fast_filter: '0',
      gatekeeper: '1',
      scientist: '2',
      miner: '3',
      umbrellanizer: '4'
    };
    setStatusFilter(defaults[taskType] || '0');
    setDecisionFilter(taskType === 'fast_filter' ? 'ALL' : 'INCLUDE');
    if (taskType === 'fast_filter' && paperSelectionMode === 'snowballing') {
      setPaperSelectionMode('all');
    }
  }, [taskType, paperSelectionMode]);

  useEffect(() => {
    if (!activeProject?.id) return;

    const fetchCount = async () => {
      try {
        let url = `/api/llm/count?projectId=${activeProject.id}&statusFilter=${statusFilter}&decisionFilter=${decisionFilter}&excludeManual=${excludeManual}&taskType=${taskType}&paperSelectionMode=${paperSelectionMode}`;
        
        if (taskType === 'umbrellanizer') {
          url += `&extractedKey=${encodeURIComponent(selectedUmbrellaKey)}`;
        }

        if (paperSelectionMode === 'selected' && preSelectedPaperIds) {
          if (preSelectedPaperIds.length === 0) {
            setTargetCount(0);
            return;
          }
          url += `&paperIds=${preSelectedPaperIds.join(',')}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setTargetCount(data.count);
        }
      } catch (err) {
        console.error('Failed to fetch target count', err);
      }
    };
    
    fetchCount();
  }, [activeProject?.id, statusFilter, decisionFilter, paperSelectionMode, preSelectedPaperIds, excludeManual, taskType, selectedUmbrellaKey]);

  const getPromptValidation = () => {
    if (!activeTemplateId) {
      return {
        isValid: false,
        error: `No default prompt template configured for stage '${taskType}' in Project Settings. Please configure it under the Prompts tab first.`
      };
    }
    const selectedPrompt = prompts.find(p => p.id === activeTemplateId);
    if (!selectedPrompt) {
      return {
        isValid: false,
        error: `The default prompt template configured for '${taskType}' ('${activeTemplateId}') was not found in the prompt library.`
      };
    }

    if (taskType !== 'fast_filter') {
      return { isValid: true, error: null };
    }

    const userPrompt = selectedPrompt.user_prompt_template || '';
    const hasTitle = /\{\{\s*title\s*\}\}/i.test(userPrompt);
    const hasAbstract = /\{\{\s*abstract\s*\}\}/i.test(userPrompt);

    if (!hasTitle || !hasAbstract) {
      const missing = [];
      if (!hasTitle) missing.push('{{title}}');
      if (!hasAbstract) missing.push('{{abstract}}');
      return {
        isValid: false,
        error: `Prompt placeholder safety error: The user prompt template is missing the required metadata placeholder(s): ${missing.join(', ')}. Without these, the LLM will not receive the papers' context, causing compliance logic to fail.`
      };
    }
    return { isValid: true, error: null };
  };
  const promptValidation = getPromptValidation();

  const logContainerRef = useRef<HTMLDivElement>(null);
  const { connect: connectSseStream, abortControllerRef } = useSseStream({
    onEvent: (data) => handleSSEEvent(data),
    onError: (err) => setLogs(prev => [...prev, { status: 'ERROR', message: `Telemetry disconnect: ${err.message}` }]),
    onComplete: () => setConnecting(false)
  });

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
        if (keyRes.status === 401) {
          setVaultUnlocked(false);
          return;
        }
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
          tokens: (activeJob.total_input_tokens || 0) + (activeJob.total_output_tokens || 0),
          included: activeJob.included_papers || 0,
          excluded: activeJob.excluded_papers || 0,
          exclusion_reasons: activeJob.exclusion_reasons || {},
          not_stated_metrics: activeJob.not_stated_metrics || {},
          avgExecutionTimeMs: activeJob.average_execution_time_ms || 0
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
      } else if (type === 'SYNC_VAULT_KEYS') {
        loadVaultState();
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
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
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) return;
    try {
      const res = await fetch('/api/vault/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: 'GEMINI_API_KEY', plainValue: trimmedKey })
      });
      const data = await res.json();
      if (res.status === 401) {
        setVaultUnlocked(false);
        loadVaultState();
      }
      if (!res.ok) throw new Error(data.error);

      showToast?.('Gemini API key encrypted and saved successfully!', 'success');
      setApiKey('');
      loadVaultState();
      broadcastSync('SYNC_VAULT_KEYS');
    } catch (err: any) {
      showToast?.(err.message || 'Failed to save key', 'error');
    }
  };

  const handleRefreshPricing = async () => {
    setRefreshingPricing(true);
    try {
      const res = await fetch('/api/llm/pricing/refresh', { method: 'POST' });
      const data = await res.json();
      if (res.status === 401) {
        setVaultUnlocked(false);
        loadVaultState();
      }
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
        execution_mode: editingPrompt.execution_mode || 'flex',
        request_delay: editingPrompt.request_delay !== undefined ? Number(editingPrompt.request_delay) : 1.0,
        interaction_chaining: editingPrompt.interaction_chaining !== undefined ? editingPrompt.interaction_chaining : true,
        concurrency: editingPrompt.concurrency !== undefined ? Number(editingPrompt.concurrency) : 1,
        timeout_seconds: editingPrompt.timeout_seconds !== undefined ? Number(editingPrompt.timeout_seconds) : 900,
        thinking_level: editingPrompt.thinking_level || 'none',
        discount: Number(editingPrompt.discount !== undefined ? editingPrompt.discount : 0.0)
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
      execution_mode: config.execution_mode || 'flex',
      request_delay: config.request_delay !== undefined ? config.request_delay : 1.0,
      interaction_chaining: config.interaction_chaining !== undefined ? config.interaction_chaining : true,
      concurrency: config.concurrency !== undefined ? config.concurrency : 1,
      timeout_seconds: config.timeout_seconds !== undefined ? config.timeout_seconds : 900,
      thinking_level: config.thinking_level || 'none',
      discount: config.discount !== undefined ? config.discount : 0.0
    });
    setEditorTab('info');
  };

  // --- TAB 3: OPERATIONS & STREAM CONTROLLER ---
  const connectSSE = async (targetJobId: string) => {
    setConnecting(true);
    try {
      await connectSseStream(`/api/llm/screen/logs?jobId=${targetJobId}`);
    } finally {
      // connecting state is handled by onDisconnect in the hook, but we keep this just in case
    }
  };

  const handleSSEEvent = (data: any) => {
    const jobExecutionStatuses = ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED_BUDGET', 'PAUSED_USER'];
    if (data.status && jobExecutionStatuses.includes(data.status)) {
      setJobStatus(data.status);
      if (data.status === 'FAILED') {
        loadVaultState();
      }
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
        tokens: (data.total_input_tokens || 0) + (data.total_output_tokens || 0),
        included: data.included_papers || 0,
        excluded: data.excluded_papers || 0,
        exclusion_reasons: data.exclusion_reasons || {},
        not_stated_metrics: data.not_stated_metrics || {},
        avgExecutionTimeMs: data.average_execution_time_ms || 0
      });
    }
  };

  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'cancel') => {
    let targetJobId = jobId;
    if (action === 'start') {
      targetJobId = `job-${Date.now()}`;
      setJobId(targetJobId);
      setLogs([{ status: 'STARTING', message: 'Initializing pipeline orchestrator...' }]);
      setMetrics({ total: 0, processed: 0, cost: 0.0, tokens: 0, included: 0, excluded: 0, exclusion_reasons: {}, not_stated_metrics: {}, avgExecutionTimeMs: 0 });
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
        payload.statusFilter = statusFilter;
        payload.decisionFilter = decisionFilter;
        payload.excludeManual = excludeManual;
        payload.paperSelectionMode = paperSelectionMode;

        if (paperSelectionMode === 'limit') {
          payload.limit = batchLimit;
        } else if (paperSelectionMode === 'range') {
          payload.limit = batchLimit;
          payload.offset = indexOffset;
        } else if (paperSelectionMode === 'selected' && preSelectedPaperIds) {
          payload.paperIds = preSelectedPaperIds;
        }

        if (taskType === 'umbrellanizer') {
          payload.key = selectedUmbrellaKey;
          
          let targetRq = selectedUmbrellaKey;
          if (activeProject?.questions) {
            const lines = activeProject.questions.split('\n').map((l: string) => l.trim()).filter(Boolean);
            const match = selectedUmbrellaKey.match(/^rq(\d+)(?:_?([a-z]))?/i);
            if (match) {
              const num = match[1] + (match[2] || '');
              const targetPrefix = `rq${num}`.toLowerCase();
              const targetPrefix2 = `rq ${num}`.toLowerCase();
              const found = lines.find((line: string) => {
                const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
                return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
              });
              if (found) targetRq = ` (${found})`;
            }
          }
          payload.targetResearchQuestion = `${selectedUmbrellaKey}${targetRq.startsWith(' (') ? targetRq : ''}`;

          let targetDesc = '';
          if (activeProject?.llm_config) {
            try {
              const pCfg = JSON.parse(activeProject.llm_config);
              const rqDescs = pCfg.research_question_descriptions || {};
              const match = selectedUmbrellaKey.match(/^rq\s*\d+[a-z]?/i);
              const codeKey = match ? match[0].toUpperCase().replace(/\s+/g, '') : '';
              targetDesc = rqDescs[codeKey] || rqDescs[selectedUmbrellaKey] || '';
            } catch (e) {}
          }
          payload.targetResearchQuestionDescription = targetDesc;
        }

        if (activeTemplateId) {
          payload.templateId = activeTemplateId;
        }
      }

      const res = await fetch('/api/llm/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (res.status === 401) {
        setVaultUnlocked(false);
        loadVaultState();
      }
      if (!res.ok) throw new Error(result.error);

      if (action === 'start' || action === 'resume') {
        connectSSE(targetJobId!);
      } else if (action === 'cancel') {
        setJobStatus('CANCELLED');
        setLogs(prev => [...prev, { status: 'CANCELLED', message: 'Execution cancelled by user.' }]);
      } else if (action === 'pause') {
        setJobStatus('PAUSED_USER');
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
    <div className="flex flex-col flex-1 h-full min-h-[600px] text-xs space-y-4">
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
                        <div className="space-y-3 mt-2.5 pt-2.5 border-t border-border/30 text-[10px] text-muted-foreground">
                          <p className="leading-relaxed">
                            Placeholders are replaced dynamically during pipeline execution in python by mapping columns from the active SQLite project and paper rows. Python automatically generates both the original casing and lowercase aliases (e.g. <code>{"{{ Title }}"}</code> or <code>{"{{ title }}"}</code>).
                          </p>
                          
                          <div className="space-y-1">
                            <span className="font-bold text-foreground uppercase tracking-wider block text-[9px]">Standard Screening &amp; Extraction Variables (Fast Filter, Gatekeeper, Scientist, Miner):</span>
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

                          <div className="space-y-1 pt-1.5 border-t border-border/20">
                            <span className="font-bold text-primary uppercase tracking-wider block text-[9px]">Umbrellanizer Taxonomy Stage Variables:</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 font-mono">
                              <div><strong className="text-primary">{"{{ umbrellanizer_target_research_question }}"}</strong>: Mapped Research Question code &amp; title (e.g. <code>RQ1</code> or <code>RQ1: What models...</code>).</div>
                              <div><strong className="text-primary">{"{{ umbrellanizer_target_research_question_description }}"}</strong>: Detailed description mapped for the question in Project Settings.</div>
                              <div className="col-span-2"><strong className="text-primary">{"{{ umbrellanizer_raw_tokens_array }}"}</strong>: JSON array of deduplicated unique raw tokens extracted from Miner outputs.</div>
                            </div>
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
                      <div className="grid grid-cols-3 gap-4">
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
                                <option value="gemma-2-27b-it">gemma-2-27b-it</option>
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

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Thinking Level</label>
                          <select
                            value={editingPrompt.thinking_level || 'none'}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, thinking_level: e.target.value }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-bold"
                          >
                            <option value="none">None</option>
                            <option value="minimal">Minimal</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Enable complex reasoning (reduces output errors).</span>
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
                            max="64000"
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

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Request Delay (seconds)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editingPrompt.request_delay !== undefined ? editingPrompt.request_delay : 1.0}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, request_delay: e.target.value !== '' ? Number(e.target.value) : 0.0 }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Throttling delay between API calls to prevent 429 errors.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Interaction Chaining</label>
                          <div className="flex items-center gap-2 h-[32px] bg-secondary/30 border border-border/60 rounded-xl px-3 mt-0.5">
                            <input
                              type="checkbox"
                              id="interaction_chaining_chk"
                              checked={editingPrompt.interaction_chaining !== undefined ? editingPrompt.interaction_chaining : true}
                              onChange={(e) => setEditingPrompt(prev => ({ ...prev, interaction_chaining: e.target.checked }))}
                              className="accent-primary w-3.5 h-3.5"
                            />
                            <label htmlFor="interaction_chaining_chk" className="text-xs font-semibold text-foreground select-none cursor-pointer">
                              Enable Chaining
                            </label>
                          </div>
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Chain new calls to previous interaction context.</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Thread Concurrency</label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={editingPrompt.concurrency !== undefined ? editingPrompt.concurrency : 1}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, concurrency: e.target.value !== '' ? Number(e.target.value) : 1 }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Number of parallel papers to send. Min: 1, Max: 20. Default: 1.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">API Request Timeout (s)</label>
                          <input
                            type="number"
                            min="10"
                            max="3600"
                            value={editingPrompt.timeout_seconds !== undefined ? editingPrompt.timeout_seconds : 900}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, timeout_seconds: e.target.value !== '' ? Number(e.target.value) : 900 }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Wait time before aborting and retrying a hanging request. Default: 900s.</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Discount Rate</label>
                          <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={editingPrompt.discount !== undefined ? editingPrompt.discount : 0.0}
                            onChange={(e) => setEditingPrompt(prev => ({ ...prev, discount: e.target.value !== '' ? Number(e.target.value) : 0.0 }))}
                            className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-1.5 outline-none text-foreground text-xs font-mono"
                          />
                          <span className="text-[9px] text-muted-foreground/60 block px-1">Apply multiplier discount on cost calculations. 0.0 means no discount, 0.5 is 50% discount. Default: 0.0.</span>
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
            {showLaunchConfirm ? (
              <div className="bg-secondary/10 border border-border/40 rounded-xl p-4 space-y-4">
                {(() => {
                  const activeTemplate = prompts.find(p => p.id === activeTemplateId);
                  const templateConfig = (() => {
                    try { return activeTemplate?.llm_config ? JSON.parse(activeTemplate.llm_config) : {}; }
                    catch { return {}; }
                  })();
                  const activeModel = templateConfig.model_id || {
                    fast_filter: 'gemini-3.5-flash',
                    gatekeeper: 'gemini-3.1-pro-preview',
                    scientist: 'gemini-3.1-pro-preview',
                    miner: 'gemini-3.1-pro-preview',
                    umbrellanizer: 'gemini-2.5-flash'
                  }[taskType];
                  const activeExecutionMode = templateConfig.execution_mode || 'FLEX';
                  const stageInfo = {
                    fast_filter: { name: 'Fast Filter', desc: 'Metadata Screening', model: activeModel },
                    gatekeeper: { name: 'Gatekeeper', desc: 'PDF Screening', model: activeModel },
                    scientist: { name: 'Scientist', desc: 'Quality Assessment QA', model: activeModel },
                    miner: { name: 'Miner', desc: 'Structured Data Extraction', model: activeModel },
                    umbrellanizer: { name: 'Umbrellanizer', desc: 'Taxonomy Category Mapping', model: activeModel }
                  }[taskType];
                  return (
                    <div className="border border-border/60 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {/* Inline header */}
                      <div className="px-4 py-2.5 bg-primary/5 border-b border-border/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 text-primary" />
                          <span className="font-bold text-foreground text-xs">
                            {confirmStep === 1 ? 'Confirm Execution — Step 1: Targets' : 'Confirm Execution — Step 2: Prompt Details'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 font-bold rounded bg-primary/15 text-primary">Step {confirmStep} of 2</span>
                          <button
                            type="button"
                            onClick={() => setShowLaunchConfirm(false)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Step content */}
                      <div className="p-4 space-y-3 text-xs">
                        {confirmStep === 1 && (
                          <div className="space-y-3 animate-in fade-in duration-150">
                            {!promptValidation.isValid && (
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-red-400 block text-xs">Prompt Design Error</span>
                                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                                    {promptValidation.error}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Stage & Model */}
                              <div className="p-3 bg-secondary/10 border border-border/40 rounded-lg space-y-1">
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">1. Pipeline Stage &amp; Model</span>
                                <div className="font-bold text-foreground text-xs">{stageInfo.name}</div>
                                <div className="text-[10px] text-muted-foreground">{stageInfo.desc} • <span className="font-mono text-primary font-bold">{stageInfo.model}</span></div>
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground">Speed tier:</span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                    activeExecutionMode === 'STANDARD'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                    {activeExecutionMode === 'STANDARD' ? 'standard' : 'flex (50% discount)'}
                                  </span>
                                </div>
                              </div>
                              {/* API Key */}
                              <div className={`p-3 border rounded-lg space-y-1 ${
                                configuredKeys.includes('GEMINI_API_KEY')
                                  ? 'bg-emerald-500/5 border-emerald-500/20'
                                  : 'bg-red-500/5 border-red-500/20'
                              }`}>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">2. API Key / Vault Status</span>
                                <div className="flex items-center gap-1.5 font-bold text-xs">
                                  {configuredKeys.includes('GEMINI_API_KEY') ? (
                                    <><ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" /><span className="text-emerald-400">Vault Key Unlocked</span></>
                                  ) : (
                                    <><AlertTriangle className="w-4 h-4 text-red-400" /><span className="text-red-400">API Key Missing</span></>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {configuredKeys.includes('GEMINI_API_KEY') ? 'Decrypted in memory' : 'Configure in Tab 1 first'}
                                </div>
                              </div>
                            </div>
                            {/* Target range / tokens */}
                            <div className="p-3 bg-secondary/10 border border-border/40 rounded-lg space-y-1 relative">
                              <div className="absolute right-3 top-3">
                                {targetCount !== null && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                                    {targetCount} {taskType === 'umbrellanizer' ? (targetCount === 1 ? 'Unique Token' : 'Unique Tokens') : (pipelineCount === 1 ? 'Paper' : 'Papers')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                {taskType === 'umbrellanizer' ? '2. Target Extraction Variable & RQ Mapping' : '2. Target Paper Count & Mode'}
                              </span>
                              {taskType === 'umbrellanizer' ? (
                                <div className="space-y-1 pt-0.5">
                                  <div className="font-bold text-foreground text-xs font-mono">
                                    Key: <span className="text-primary">{selectedUmbrellaKey || 'None'}</span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Mapped RQ (<code>{"{{ umbrellanizer_target_research_question }}"}</code>): <strong className="text-foreground font-sans">
                                      {(() => {
                                        if (!selectedUmbrellaKey || !activeProject?.questions) return selectedUmbrellaKey;
                                        const lines = activeProject.questions.split('\n').map((l: string) => l.trim()).filter(Boolean);
                                        const match = selectedUmbrellaKey.match(/^rq(\d+)(?:_?([a-z]))?/i);
                                        if (!match) return selectedUmbrellaKey;
                                        const num = match[1] + (match[2] || '');
                                        const targetPrefix = `rq${num}`.toLowerCase();
                                        const targetPrefix2 = `rq ${num}`.toLowerCase();
                                        const found = lines.find((line: string) => {
                                          const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
                                          return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
                                        });
                                        return found ? `${selectedUmbrellaKey} (${found})` : selectedUmbrellaKey;
                                      })()}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Mapped Description (<code>{"{{ umbrellanizer_target_research_question_description }}"}</code>): <span className="text-foreground italic">
                                      {(() => {
                                        if (!selectedUmbrellaKey || !activeProject?.llm_config) return 'None configured.';
                                        try {
                                          const pCfg = JSON.parse(activeProject.llm_config);
                                          const rqDescs = pCfg.research_question_descriptions || {};
                                          const match = selectedUmbrellaKey.match(/^rq\s*\d+[a-z]?/i);
                                          const codeKey = match ? match[0].toUpperCase().replace(/\s+/g, '') : '';
                                          return rqDescs[codeKey] || rqDescs[selectedUmbrellaKey] || 'None configured.';
                                        } catch { return 'None configured.'; }
                                      })()}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="font-bold text-foreground text-xs">
                                    {paperSelectionMode === 'all' && `All Matching Papers (Status: ${statusFilter === 'ALL' ? 'Any' : statusFilter}, Decision: ${decisionFilter})`}
                                    {paperSelectionMode === 'limit' && `Limit Batch Size: Run first ${batchLimit} matching papers (Status: ${statusFilter === 'ALL' ? 'Any' : statusFilter}, Decision: ${decisionFilter})`}
                                    {paperSelectionMode === 'range' && `Index Range: Run ${batchLimit} papers starting from offset ${indexOffset} (Status: ${statusFilter === 'ALL' ? 'Any' : statusFilter}, Decision: ${decisionFilter})`}
                                    {paperSelectionMode === 'selected' && `Manual Select: Run on ${preSelectedPaperIds?.length || 0} papers`}
                                    {paperSelectionMode === 'snowballing' && `Manually Ingested & Snowballing Papers (Status: ${statusFilter === 'ALL' ? 'Any' : statusFilter}, Decision: ${decisionFilter})`}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">
                                    Papers will be executed sequentially matching database chronological rowid ordering.
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {confirmStep === 2 && (
                          <div className="space-y-3 animate-in fade-in duration-150">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block border-b border-border/30 pb-1">4. Complete Prompt &amp; Rules Preview</span>
                            {!promptValidation.isValid && (
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-red-400 block text-xs">Prompt Design Error</span>
                                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                                    {promptValidation.error}
                                  </p>
                                </div>
                              </div>
                            )}
                            {activeTemplateId ? (() => {
                              const selectedPrompt = prompts.find(p => p.id === activeTemplateId);
                              if (!selectedPrompt) return <div className="text-red-400 font-bold">Configured template not found.</div>;
                              return (
                                <div className="space-y-3">
                                  <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                                    <span className="text-[10px] text-primary font-bold block mb-0.5">Template: {selectedPrompt.name}</span>
                                    <span className="text-[9px] text-muted-foreground block">{selectedPrompt.description || 'No description.'}</span>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold block">System Instructions:</span>
                                    <div className="max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-100 whitespace-pre-wrap select-all border-l-2 border-l-primary/60 leading-relaxed">
                                      {selectedPrompt.system_prompt}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-muted-foreground font-bold block">User Template (Jinja2 format):</span>
                                    <div className="max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-100 whitespace-pre-wrap select-all border-l-2 border-l-primary/60 leading-relaxed">
                                      {selectedPrompt.user_prompt_template}
                                    </div>
                                  </div>
                                  {selectedPrompt.response_schema && (
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-muted-foreground font-bold block">Structured Output JSON Schema:</span>
                                      <pre className="max-h-40 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-emerald-400 select-all border-l-2 border-l-emerald-500/60 leading-relaxed">
                                        {(() => { try { return JSON.stringify(JSON.parse(selectedPrompt.response_schema), null, 2); } catch { return selectedPrompt.response_schema; } })()}
                                      </pre>
                                    </div>
                                  )}
                                  {(() => {
                                      let configObj: any = {};
                                      try { if (selectedPrompt.llm_config) configObj = JSON.parse(selectedPrompt.llm_config); } catch (e) {}
                                      return (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border/30 mt-2">
                                          <div className="bg-secondary/20 p-2 rounded border border-border/40">
                                            <span className="text-[9px] text-muted-foreground block uppercase">Concurrency</span>
                                            <span className="font-bold font-mono text-xs text-foreground">{configObj.concurrency || 1}</span>
                                          </div>
                                          <div className="bg-secondary/20 p-2 rounded border border-border/40">
                                            <span className="text-[9px] text-muted-foreground block uppercase">Timeout (s)</span>
                                            <span className="font-bold font-mono text-xs text-foreground">{configObj.timeout_seconds || 900}</span>
                                          </div>
                                          <div className="bg-secondary/20 p-2 rounded border border-border/40">
                                            <span className="text-[9px] text-muted-foreground block uppercase">Req Delay (s)</span>
                                            <span className="font-bold font-mono text-xs text-foreground">{configObj.request_delay !== undefined ? configObj.request_delay : 1.0}</span>
                                          </div>
                                          <div className="bg-secondary/20 p-2 rounded border border-border/40">
                                            <span className="text-[9px] text-muted-foreground block uppercase">Max Tokens</span>
                                            <span className="font-bold font-mono text-xs text-foreground">{configObj.max_tokens || 2000}</span>
                                          </div>
                                        </div>
                                      );
                                  })()}
                                </div>
                              );
                            })() : (
                              <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex gap-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-yellow-400 block">Using Default Project Config Templates</span>
                                  <p className="text-[10px] text-muted-foreground leading-normal">
                                    This stage will run using the default system prompts defined in python execution files, combined with project rules.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Inline footer */}
                      <div className="px-4 py-2.5 border-t border-border/60 bg-secondary/10 flex justify-between items-center">
                        <div>
                          {confirmStep === 2 && (
                            <button type="button" onClick={() => setConfirmStep(1)}
                              className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary/40 font-bold transition-all text-xs">
                              ← Previous
                            </button>
                          )}
                          {confirmStep === 1 && (
                            <button type="button" onClick={() => setShowLaunchConfirm(false)}
                              className="px-3 py-1.5 border border-border rounded-lg hover:bg-secondary/40 font-bold transition-all text-xs">
                              Cancel
                            </button>
                          )}
                        </div>
                        <div>
                          {confirmStep === 1 && (
                            <button type="button"
                              disabled={!promptValidation.isValid}
                              onClick={() => setConfirmStep(2)}
                              className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed text-xs">
                              Next →
                            </button>
                          )}
                          {confirmStep === 2 && (
                            <button
                              type="button"
                              disabled={!configuredKeys.includes('GEMINI_API_KEY') || !promptValidation.isValid || isLlmLocked}
                              onClick={() => { setShowLaunchConfirm(false); handleAction('start'); }}
                              className="px-3 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg flex items-center gap-1.5 transition-all hover:scale-105 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed text-xs"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Start Stage Execution</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
                {/* Top Control Panel */}
                <div className="bg-secondary/10 border border-border/40 rounded-xl p-4 space-y-4">
                  
                  {/* Row 1: Stage Taxonomy Selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">1. Select Pipeline Stage</span>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { id: 'fast_filter', name: 'Fast Filter', desc: 'Metadata (Flash)' },
                        { id: 'gatekeeper', name: 'Gatekeeper', desc: 'PDF Screen (Pro)' },
                        { id: 'scientist', name: 'Scientist', desc: 'QA Check (Pro)' },
                        { id: 'miner', name: 'Miner', desc: 'Extraction (Pro)' },
                        { id: 'umbrellanizer', name: 'Umbrellanizer', desc: 'Taxonomy (Flash/Pro)' },
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

                  {/* Target Extraction Key Selector for Umbrellanizer */}
                  {taskType === 'umbrellanizer' && (
                    <div className="p-3 bg-secondary/15 border border-primary/30 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          Target Extraction Variable Key
                        </label>
                        {targetCount !== null && (
                          <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                            {targetCount} Unique Raw {targetCount === 1 ? 'Token' : 'Tokens'}
                          </span>
                        )}
                      </div>
                      <select
                        value={selectedUmbrellaKey}
                        onChange={(e) => setSelectedUmbrellaKey(e.target.value)}
                        className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-foreground outline-none focus:border-primary"
                      >
                        {extractedKeysState.length === 0 && (
                          <option value="">-- No Extracted Keys Found --</option>
                        )}
                        {extractedKeysState.map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                      <p className="text-[9px] text-muted-foreground leading-relaxed">
                        Select the extracted JSON key to categorize into umbrella taxonomy categories. Unique tokens are harvested from Miner outputs.
                      </p>
                    </div>
                  )}

                  {/* Row 2: Default Stage Prompts & Schema Mapper Control Panel */}
                  <div className="bg-secondary/15 border border-border/60 rounded-xl overflow-hidden transition-all">
                    {/* Panel Header */}
                    <div 
                      onClick={() => setIsExpandedStageMapper(!isExpandedStageMapper)}
                      className="px-3.5 py-2.5 bg-secondary/30 hover:bg-secondary/40 cursor-pointer flex items-center justify-between border-b border-border/40 select-none"
                    >
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <span className="font-bold text-xs text-foreground">
                          Default Stage Prompts &amp; Schema Mapper
                        </span>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold uppercase">
                          Stage: {taskType.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeTemplateId ? (() => {
                          const activePrompt = prompts.find(p => p.id === activeTemplateId);
                          return (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Active: <strong className="text-foreground font-sans">{activePrompt ? activePrompt.name : activeTemplateId}</strong>
                            </span>
                          );
                        })() : (
                          <span className="text-[10px] text-amber-400 font-bold">No Prompt Selected</span>
                        )}
                        {isExpandedStageMapper ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Panel Body */}
                    {isExpandedStageMapper && (
                      <div className="p-3.5 space-y-4 text-xs animate-in fade-in duration-150">
                        {/* Section A: Template Selector & Quick Edit */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Default Prompt Template for {taskType.replace('_', ' ')}
                            </label>
                            {activeTemplateId && prompts.find(p => p.id === activeTemplateId) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const selectedPrompt = prompts.find(p => p.id === activeTemplateId);
                                  if (selectedPrompt) {
                                    startEditingPrompt(selectedPrompt);
                                    setActiveTab('prompts');
                                  }
                                }}
                                className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1"
                              >
                                <BookOpen className="w-3 h-3" />
                                <span>Quick Edit Template in Library</span>
                              </button>
                            )}
                          </div>
                          <select
                            value={defaultPromptsState[taskType] || activeTemplateId || ''}
                            onChange={(e) => handleStagePromptChange(taskType, e.target.value)}
                            className="w-full bg-secondary/50 border border-border/80 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none font-bold"
                          >
                            <option value="">-- Select Default Prompt Template --</option>
                            {prompts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.project_id === null ? '(Global)' : '(Project)'}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Section B: Stage Output Schema Key Mappers */}
                        <div className="space-y-2 border-t border-border/40 pt-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                JSON Output Schema Key Path Mappers ({taskType.replace('_', ' ')})
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                Maps custom JSON response keys from Gemini model outputs to project screening variables (supports dot-notation).
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLoadDefaultSchemaKeys(taskType)}
                              className="text-[10px] text-primary hover:underline font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all"
                            >
                              Load Stage Standard Defaults
                            </button>
                          </div>

                          {/* Stage specific input fields */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            {['fast_filter', 'gatekeeper'].includes(taskType) && (
                              <>
                                {renderSchemaKeySelector('decision', 'Decision Key Path', 'decision')}
                                {renderSchemaKeySelector('exclusion_trigger', 'Exclusion Trigger Key Path', 'exclusion_trigger')}
                                {renderSchemaKeySelector('rationale', 'Rationale Key Path', 'rationale')}
                              </>
                            )}

                            {taskType === 'scientist' && (
                              <>
                                {renderSchemaKeySelector('quality_assessment', 'QA Scores Key Path', 'qa_scores')}
                                {renderSchemaKeySelector('decision', 'Decision Key Path', 'final_evaluation.decision')}
                                {renderSchemaKeySelector('exclusion_trigger', 'Exclusion Code Key Path', 'final_evaluation.exclusion_code')}
                                {renderSchemaKeySelector('rationale', 'Rationale Key Path', 'final_evaluation.reasoning')}
                              </>
                            )}

                            {taskType === 'miner' && (
                              <>
                                {renderSchemaKeySelector('extracted_data', 'Extracted Data Key Path', 'extracted_data', 'md:col-span-2')}
                                {renderSchemaKeySelector('rationale', 'Rationale Key Path', 'rationale')}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Section C: Footer Save Action */}
                        <div className="flex justify-end pt-2 border-t border-border/40">
                          <button
                            type="button"
                            disabled={savingStageConfig}
                            onClick={handleSaveStageConfig}
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 text-xs"
                          >
                            {savingStageConfig ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>Save Stage Configuration to Project</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Paper Selection Mode Selector & Target Paper Status */}
                  {/* Row 2: Paper Selection Mode Selector & Target Paper Status & Screening Decision */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5 relative">
                      <div className="absolute right-0 top-0">
                        {targetCount !== null && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-primary/20 text-primary inline-block -mt-1">
                            {pipelineCount} {pipelineCount === 1 ? 'paper' : 'papers'} target
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">2. Paper Range / Selection Mode</span>
                      <select
                        value={paperSelectionMode}
                        onChange={(e) => setPaperSelectionMode(e.target.value as any)}
                        disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                        className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none font-bold"
                      >
                        <option value="all">All Papers Matching Filters</option>
                        {taskType !== 'fast_filter' && (
                          <option value="snowballing">Manually Ingested &amp; Snowballing Papers</option>
                        )}
                        <option value="limit">Limit Batch Size</option>
                        <option value="range">Index Range (Offset + Limit)</option>
                        {preSelectedPaperIds && preSelectedPaperIds.length > 0 && (
                          <option value="selected">Manual Select ({preSelectedPaperIds.length} papers)</option>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">2b. Target Paper Status (Gate)</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                        className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none font-bold"
                      >
                        <option value="0">Status 0: Unprocessed</option>
                        <option value="1">Status 1: Passed Fast Filter</option>
                        <option value="2">Status 2: Passed Gatekeeper</option>
                        <option value="3">Status 3: Passed Scientist</option>
                        <option value="4">Status 4: Passed Miner</option>
                        <option value="ALL">Any Status / All Stages</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 animate-in slide-in-from-right-2 duration-200">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">2c. Target Screening Decision (State)</span>
                      <select
                        value={decisionFilter}
                        onChange={(e) => setDecisionFilter(e.target.value)}
                        disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                        className="w-full bg-secondary/40 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none font-bold"
                      >
                        <option value="ALL">Any Decision</option>
                        <option value="PENDING">Pending</option>
                        <option value="INCLUDE">Included</option>
                        <option value="EXCLUDE">Excluded</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2.5 pt-1 md:col-span-3">
                      <input
                        type="checkbox"
                        id="excludeManualToggle"
                        checked={excludeManual}
                        onChange={(e) => setExcludeManual(e.target.checked)}
                        disabled={['RUNNING', 'STARTING'].includes(jobStatus)}
                        className="w-3.5 h-3.5 rounded border-border bg-secondary/40 text-primary accent-primary outline-none focus:ring-1 focus:ring-primary/45 cursor-pointer"
                      />
                      <label htmlFor="excludeManualToggle" className="text-xs font-semibold text-muted-foreground select-none cursor-pointer">
                        Exclude papers manually screened in this stage
                      </label>
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
                        <span>Selected <strong>{preSelectedPaperIds.length} papers</strong> ({targetCount} eligible to run) from checkmarks.</span>
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

                  {targetCount === 0 && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 animate-in slide-in-from-top-2 duration-200">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>No papers match the current filter settings. Adjust the Stage or Decision filter.</span>
                    </div>
                  )}

                  {/* ── Normal run actions row ── */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      Status: <span className="text-foreground">{jobStatus}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      {['IDLE', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(jobStatus) ? (
                        <>
                          {isLlmLocked && (
                            <div className="flex items-center gap-2 mr-2">
                              <span className="text-red-500 font-semibold text-[10px] animate-pulse">Another pipeline is running</span>
                              <button onClick={forceUnlock} className="px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 rounded text-[9px] uppercase font-bold transition-all shadow-sm">
                                Force Unlock
                              </button>
                            </div>
                          )}
                          <button
                            disabled={!activeTemplateId || connecting || !promptValidation.isValid || isLlmLocked || targetCount === 0 || pipelineCount === 0}
                            onClick={() => { setShowLaunchConfirm(true); setConfirmStep(1); }}
                            className={`px-4 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg transition-all ${isLlmLocked || targetCount === 0 || pipelineCount === 0 ? 'bg-muted text-muted-foreground/50 border border-border/50 cursor-not-allowed opacity-50 shadow-none' : 'bg-primary hover:bg-primary/95 text-primary-foreground shadow-primary/10 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed'}`}
                          >
                            {connecting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{connecting ? 'Initializing…' : 'Launch Stage execution'}</span>
                            {!connecting && targetCount !== null && (
                              <span className="px-1.5 py-0.5 rounded bg-primary-foreground/20 text-primary-foreground text-[10px] font-mono font-extrabold ml-1">
                                {pipelineCount}
                              </span>
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          {['PAUSED_BUDGET', 'PAUSED_USER'].includes(jobStatus) ? (
                            <button onClick={() => handleAction('resume')}
                              className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all hover:scale-105">
                              <Play className="w-3.5 h-3.5" /><span>Resume (Cleared Budget)</span>
                            </button>
                          ) : (
                            <button onClick={() => handleAction('pause')}
                              className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all">
                              <Pause className="w-3.5 h-3.5" /><span>Pause</span>
                            </button>
                          )}
                          <button onClick={() => handleAction('cancel')}
                            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all hover:scale-105">
                            <XCircle className="w-3.5 h-3.5" /><span>Terminate Run</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Performance metrics dashboard widgets */}
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3.5 bg-secondary/15 border border-border/50 rounded-xl text-center shadow-sm backdrop-blur-sm flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase tracking-wider">Processed Papers</span>
                      <span className="text-base font-extrabold text-foreground font-mono">{metrics.processed} <span className="text-xs text-muted-foreground font-normal">/ {metrics.total}</span></span>
                    </div>
                    <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-center shadow-sm backdrop-blur-sm flex flex-col justify-center">
                      <span className="text-[10px] text-emerald-500/90 block font-bold mb-1 uppercase tracking-wider">Total Cost</span>
                      <span className="text-base font-extrabold text-emerald-400 font-mono">${metrics.cost.toFixed(4)}</span>
                    </div>
                    <div className="p-3.5 bg-secondary/15 border border-border/50 rounded-xl text-center shadow-sm backdrop-blur-sm flex flex-col justify-center">
                      <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase tracking-wider">Total Tokens</span>
                      <span className="text-base font-extrabold text-foreground font-mono">{metrics.tokens.toLocaleString()}</span>
                    </div>
                    <div className="p-3.5 bg-secondary/15 border border-border/50 rounded-xl text-center shadow-sm backdrop-blur-sm flex flex-col justify-center items-center">
                      <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase tracking-wider">Job Status</span>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                        jobStatus === 'COMPLETED' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                        jobStatus === 'RUNNING' || jobStatus === 'STARTING' ? 'bg-primary/15 text-primary border border-primary/30 animate-pulse' :
                        ['PAUSED_BUDGET', 'PAUSED_USER'].includes(jobStatus) ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                        jobStatus === 'FAILED' ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-secondary/50 text-muted-foreground border border-border/40'
                      }`}>
                        {jobStatus}
                      </span>
                    </div>
                  </div>

                  {/* ETA & Avg Time Row */}
                  {(jobStatus === 'RUNNING' || ['PAUSED_BUDGET', 'PAUSED_USER'].includes(jobStatus) || jobStatus === 'COMPLETED') && metrics.processed > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl flex items-center justify-between shadow-sm">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Avg Time / Paper</span>
                        <span className="text-sm font-bold text-foreground font-mono">
                          {(metrics.avgExecutionTimeMs / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <div className="p-3 bg-secondary/10 border border-border/40 rounded-xl flex items-center justify-between shadow-sm">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Est. Time Remaining</span>
                        <span className="text-sm font-bold text-foreground font-mono">
                          {(() => {
                            const remaining = metrics.total - metrics.processed;
                            if (remaining <= 0) return '0s';
                            const etaSecs = Math.round((remaining * metrics.avgExecutionTimeMs) / 1000);
                            if (etaSecs > 60) {
                              const mins = Math.floor(etaSecs / 60);
                              const secs = etaSecs % 60;
                              return `${mins}m ${secs}s`;
                            }
                            return `${etaSecs}s`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}

                  {['fast_filter', 'gatekeeper', 'scientist'].includes(taskType) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col justify-between shadow-sm backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-emerald-400 font-extrabold uppercase tracking-wider">Included Papers</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {metrics.processed > 0 ? ((metrics.included / metrics.processed) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                        <span className="text-2xl font-black text-foreground font-mono my-1">{metrics.included}</span>
                        <div className="w-full bg-emerald-950/40 h-1.5 rounded-full overflow-hidden border border-emerald-500/20">
                          <div 
                            className="bg-emerald-400 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${metrics.processed > 0 ? Math.min(100, (metrics.included / metrics.processed) * 100) : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex flex-col justify-between shadow-sm backdrop-blur-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[11px] text-rose-400 font-extrabold uppercase tracking-wider">Excluded Papers</span>
                          <span className="text-xs font-mono font-bold text-rose-400">
                            {metrics.processed > 0 ? ((metrics.excluded / metrics.processed) * 100).toFixed(1) : '0.0'}%
                          </span>
                        </div>
                        <span className="text-2xl font-black text-foreground font-mono my-1">{metrics.excluded}</span>
                        <div className="w-full bg-rose-950/40 h-1.5 rounded-full overflow-hidden border border-rose-500/20 mb-1">
                          <div 
                            className="bg-rose-500 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${metrics.processed > 0 ? Math.min(100, (metrics.excluded / metrics.processed) * 100) : 0}%` }}
                          />
                        </div>

                        {metrics.excluded > 0 && Object.keys(metrics.exclusion_reasons || {}).length > 0 && (
                          <div className="text-[10px] text-left mt-2 space-y-1.5 border-t border-rose-500/20 pt-2.5 max-h-[140px] overflow-y-auto pr-1">
                            {Object.entries(metrics.exclusion_reasons).map(([reason, count]) => {
                              const pct = ((count as number) / metrics.excluded * 100).toFixed(1);
                              return (
                                <div key={reason} className="flex justify-between items-center bg-rose-500/15 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
                                  <span className="truncate max-w-[140px] font-medium text-rose-200" title={reason}>{reason}</span>
                                  <span className="font-mono font-extrabold text-rose-300">
                                    {count as number} <span className="text-rose-400/70 font-normal">({pct}%)</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {taskType === 'miner' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center flex flex-col justify-center shadow-sm">
                          <span className="text-[10px] text-emerald-400 block font-extrabold mb-1 uppercase tracking-wider">Processed Papers</span>
                          <span className="text-xl font-black text-foreground font-mono">{metrics.processed}</span>
                        </div>
                        <div className="p-3.5 bg-secondary/15 border border-border/50 rounded-xl text-center flex flex-col justify-center shadow-sm">
                          <span className="text-[10px] text-muted-foreground block font-bold mb-1 uppercase tracking-wider">Unprocessed Papers</span>
                          <span className="text-xl font-black text-foreground font-mono">{Math.max(0, metrics.total - metrics.processed)}</span>
                        </div>
                      </div>
                      
                      {metrics.processed > 0 && Object.keys(metrics.not_stated_metrics || {}).length > 0 && (
                        <div className="bg-secondary/15 border border-border/50 rounded-xl p-3.5 shadow-sm backdrop-blur-sm">
                          <div className="font-extrabold text-[10px] uppercase tracking-wider mb-2.5 text-amber-400 flex items-center gap-1.5">
                            <span>Missing / Not Stated Variables</span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {(() => {
                              const formatVariableKey = (key: string): string => {
                                try {
                                  let formatted = key.replace(/^(locate_)?rq\d+([a-z_])?_/, '');
                                  formatted = formatted.replace(/^locate_/, '');
                                  if (!formatted) return key;
                                  return formatted
                                    .split('_')
                                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');
                                } catch (e) {
                                  return key;
                                }
                              };
                              return Object.entries(metrics.not_stated_metrics)
                                .sort((a, b) => b[1] - a[1])
                                .map(([key, count]) => {
                                  const pct = Math.round((count / metrics.processed) * 100);
                                  return (
                                    <div key={key} className="flex justify-between items-center bg-secondary/30 border border-border/30 px-3 py-1.5 rounded-lg text-[10px]">
                                      <span className="truncate max-w-[170px] font-medium text-foreground/90" title={key}>{formatVariableKey(key)}</span>
                                      <span className="font-mono text-rose-400 font-extrabold">{count} ({pct}%)</span>
                                    </div>
                                  );
                                });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Subprocess Console Screen */}
                <div className="bg-[#09090b] border border-border/50 rounded-xl overflow-hidden flex flex-col h-80 min-h-[320px] max-h-[500px] shadow-md">
                  <div className="bg-secondary/25 px-3.5 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-mono text-foreground uppercase font-bold tracking-wider">Execution Log Stream</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {logs.length > 0 && (
                        <span className="text-[9px] font-mono text-muted-foreground/70">{logs.length} log lines</span>
                      )}
                      {logs.length > 0 && (
                        <button 
                          onClick={() => setLogs([])}
                          className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition-colors font-bold uppercase"
                        >
                          Clear Log
                        </button>
                      )}
                    </div>
                  </div>
                  <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3.5 font-mono text-[10px] space-y-1.5 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900/50">
                    {logs.length === 0 ? (
                      <div className="text-muted-foreground/40 italic py-8 text-center flex flex-col items-center justify-center gap-1.5">
                        <Terminal className="w-5 h-5 opacity-20" />
                        <span>Waiting for stage execution log stream...</span>
                      </div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="flex gap-2.5 items-start hover:bg-secondary/10 px-1 py-0.5 rounded transition-colors">
                          <span className="text-muted-foreground/40 shrink-0 select-none">[{new Date().toLocaleTimeString()}]</span>
                          <span className={`font-bold shrink-0 w-[100px] ${
                            log.status === 'ERROR' || log.status === 'FAILED' ? 'text-rose-400' :
                            log.status === 'WARNING' || ['PAUSED_BUDGET', 'PAUSED_USER'].includes(log.status) ? 'text-amber-400' :
                            log.status === 'COMPLETED' ? 'text-emerald-400' :
                            log.status === 'RUNNING' ? 'text-blue-400' :
                            'text-zinc-500'
                          }`}>
                            {log.status}
                          </span>
                          <span className={`break-words flex-1 ${
                            log.status === 'ERROR' || log.status === 'FAILED' ? 'text-rose-300 font-bold' : 
                            log.status === 'WARNING' || ['PAUSED_BUDGET', 'PAUSED_USER'].includes(log.status) ? 'text-amber-300' : 
                            'text-zinc-300'
                          }`}>
                            {log.message}
                            {log.current_paper && <span className="text-primary/80 font-semibold ml-1">({log.current_paper})</span>}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}



        {/* --- AUDIT TRAIL TAB --- */}
        {activeTab === 'audit' && (
          <LLMAuditLogView activeProject={activeProject} showToast={showToast} />
        )}


      </div>
    </div>
  );
}
