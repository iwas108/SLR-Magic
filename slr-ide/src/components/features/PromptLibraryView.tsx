'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Edit2, Trash2, Save, Loader, CheckCircle2, X, AlertTriangle, 
  Layers, Search, Star, StarOff, Copy, ChevronDown, ChevronUp, 
  FileCode2, SlidersHorizontal, Terminal, Shield, Sparkles, 
  Check, Info, ExternalLink, RefreshCw, Eye, Link2
} from 'lucide-react';
import { 
  PromptType, 
  PROMPT_TYPE_OPTIONS, 
  DEFAULT_STAGE_SCHEMAS, 
  validatePromptSchema 
} from '@/lib/services/prompt-validator';
import { CANONICAL_STAGE_PROMPTS } from '@/lib/services/prompt-defaults';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

export interface ModelPricing {
  model_id: string;
  provider: string;
  input_token_price: number;
  output_token_price: number;
  thinking_token_price: number;
  batch_discount: number;
  updated_at: string;
}

export interface Prompt {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  prompt_type: PromptType | string | null;
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
  created_at?: string;
  updated_at?: string;
}

export interface PromptLibraryViewProps {
  projectId?: string | null;
  activeProject?: any;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  loadProjects?: () => void;
  pricingModels?: ModelPricing[];
}

export default function PromptLibraryView({ 
  projectId = null, 
  activeProject, 
  showToast,
  loadProjects,
  pricingModels: passedPricingModels
}: PromptLibraryViewProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingModels, setPricingModels] = useState<ModelPricing[]>(passedPricingModels || []);

  // Filtering & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'ALL' | 'PROJECT' | 'GLOBAL'>('ALL');

  // Expanded inline preview row IDs
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, 'system' | 'template' | 'schema' | 'config'>>({});

  // Editor Modal / Drawer state
  const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);
  const [editorTab, setEditorTab] = useState<'info' | 'template' | 'schema' | 'config'>('info');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [setAsDefaultOnSave, setSetAsDefaultOnSave] = useState(false);

  // Quick Action States
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState<string | null>(null);

  const effectiveProjectId = projectId || activeProject?.id || null;
  const [localDefaultsOverride, setLocalDefaultsOverride] = useState<Record<string, string>>({});

  // Active Project Default Prompts Mapping with Optimistic Reactivity
  const defaultPromptsMap: Record<string, string> = useMemo(() => {
    let baseMap: Record<string, string> = {};
    try {
      const cfg = activeProject?.llm_config ? JSON.parse(activeProject.llm_config) : {};
      baseMap = cfg.default_prompts || {};
    } catch {
      baseMap = {};
    }
    return { ...baseMap, ...localDefaultsOverride };
  }, [activeProject?.llm_config, localDefaultsOverride]);

  // Fetch prompts list
  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const url = effectiveProjectId 
        ? `/api/llm/prompts?project_id=${effectiveProjectId}&include_global=true` 
        : '/api/llm/prompts';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts || []);
      } else {
        showToast?.('Failed to load prompt templates', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error loading prompt templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch pricing models if not passed
  const fetchPricingModels = async () => {
    if (passedPricingModels && passedPricingModels.length > 0) return;
    try {
      const res = await fetch('/api/llm/pricing');
      const data = await res.json();
      if (data.success) {
        setPricingModels(data.models || []);
      }
    } catch (err) {
      console.error('Failed to load pricing models:', err);
    }
  };

  const fetchPromptsRef = useRef(fetchPrompts);
  fetchPromptsRef.current = fetchPrompts;

  const loadProjectsRef = useRef(loadProjects);
  loadProjectsRef.current = loadProjects;

  useEffect(() => {
    fetchPrompts();
    fetchPricingModels();
  }, [effectiveProjectId]);

  // Multi-tab sync subscription using mutable refs to prevent stale closures (§3.3)
  useEffect(() => {
    const unsub = subscribeSyncChannel((event) => {
      if (event === 'SYNC_PROJECTS' || event === 'SYNC_PROMPTS') {
        fetchPromptsRef.current();
        loadProjectsRef.current?.();
      }
    });
    return () => {
      unsub();
    };
  }, []);

  // Schema Validator Helper
  const validateSchemaField = (type: string | null | undefined, schemaValue: string | null | undefined) => {
    if (!schemaValue || !schemaValue.trim()) {
      setSchemaError('JSON Schema is required.');
      return;
    }
    const valResult = validatePromptSchema(type, schemaValue);
    if (!valResult.isValid) {
      setSchemaError(valResult.error);
    } else {
      setSchemaError(null);
    }
  };

  const tryParse = (str: string) => {
    try { return JSON.parse(str); } catch { return null; }
  };

  // Helper to extract JSON Schema property count
  const countSchemaProperties = (schemaStr: string | null | undefined): number => {
    if (!schemaStr) return 0;
    try {
      const parsed = JSON.parse(schemaStr);
      if (parsed && typeof parsed === 'object' && parsed.properties) {
        return Object.keys(parsed.properties).length;
      }
      return 0;
    } catch {
      return 0;
    }
  };

  // Toggle Row Expansion
  const toggleRowExpansion = (promptId: string, defaultTab: 'system' | 'template' | 'schema' | 'config' = 'system') => {
    setExpandedRowIds(prev => {
      const next = { ...prev };
      if (next[promptId]) {
        delete next[promptId];
      } else {
        next[promptId] = defaultTab;
      }
      return next;
    });
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, copyKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedState(copyKey);
    setTimeout(() => setCopiedState(null), 2000);
    showToast?.('Copied to clipboard', 'info');
  };

  // 1-Click Set as Default Action
  const handleSetAsDefault = async (prompt: Prompt) => {
    if (!effectiveProjectId) {
      showToast?.('Please activate a project before setting default prompts.', 'warning');
      return;
    }
    if (!prompt.prompt_type) {
      showToast?.('Cannot set default: prompt has no assigned pipeline stage.', 'warning');
      return;
    }

    setSettingDefaultId(prompt.id);
    // Instant optimistic update for 0ms visual latency
    const targetStage = prompt.prompt_type;
    setLocalDefaultsOverride(prev => ({ ...prev, [targetStage]: prompt.id }));

    try {
      const res = await fetch('/api/llm/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_default',
          project_id: effectiveProjectId,
          prompt_type: targetStage,
          prompt_id: prompt.id
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast?.(`"${prompt.name}" set as active default for ${getStageOption(targetStage)?.label || targetStage}!`, 'success');
        loadProjects?.();
        broadcastSync('SYNC_PROJECTS');
      } else {
        // Rollback optimistic update on error
        setLocalDefaultsOverride(prev => {
          const next = { ...prev };
          delete next[targetStage];
          return next;
        });
        showToast?.(data.error || 'Failed to set default prompt', 'error');
      }
    } catch (err) {
      console.error(err);
      // Rollback optimistic update on exception
      setLocalDefaultsOverride(prev => {
        const next = { ...prev };
        delete next[targetStage];
        return next;
      });
      showToast?.('Error setting default prompt', 'error');
    } finally {
      setSettingDefaultId(null);
    }
  };

  // Clone / Fork Prompt
  const handleClonePrompt = (sourcePrompt: Prompt) => {
    let parsedConfig: any = {};
    try {
      parsedConfig = sourcePrompt.llm_config ? JSON.parse(sourcePrompt.llm_config) : {};
    } catch (e) {
      parsedConfig = {};
    }

    setEditingPrompt({
      name: `${sourcePrompt.name} (Fork)`,
      description: sourcePrompt.description ? `Forked from ${sourcePrompt.name}. ${sourcePrompt.description}` : `Forked from ${sourcePrompt.name}`,
      prompt_type: sourcePrompt.prompt_type,
      system_prompt: sourcePrompt.system_prompt,
      user_prompt_template: sourcePrompt.user_prompt_template,
      response_schema: sourcePrompt.response_schema,
      is_active: 1,
      model_id: parsedConfig.model_id || 'gemini-2.5-flash',
      execution_mode: parsedConfig.execution_mode || 'flex',
      thinking_level: parsedConfig.thinking_level || 'none',
      temperature: parsedConfig.temperature !== undefined ? parsedConfig.temperature : 0.0,
      max_tokens: parsedConfig.max_tokens !== undefined ? parsedConfig.max_tokens : 2000,
      top_p: parsedConfig.top_p !== undefined ? parsedConfig.top_p : 0.9,
      top_k: parsedConfig.top_k !== undefined ? parsedConfig.top_k : 40,
      request_delay: parsedConfig.request_delay !== undefined ? parsedConfig.request_delay : 1.0,
      interaction_chaining: parsedConfig.interaction_chaining !== undefined ? parsedConfig.interaction_chaining : true,
      concurrency: parsedConfig.concurrency !== undefined ? parsedConfig.concurrency : 1,
      timeout_seconds: parsedConfig.timeout_seconds !== undefined ? parsedConfig.timeout_seconds : 900,
      discount: parsedConfig.discount !== undefined ? parsedConfig.discount : 0.0
    });
    setSetAsDefaultOnSave(false);
    setEditorTab('info');
    validateSchemaField(sourcePrompt.prompt_type, sourcePrompt.response_schema);
  };

  // Start Editing Prompt
  const startEditingPrompt = (prompt: Prompt) => {
    let parsedConfig: any = {};
    try {
      parsedConfig = prompt.llm_config ? JSON.parse(prompt.llm_config) : {};
    } catch (e) {
      parsedConfig = {};
    }

    setEditingPrompt({
      ...prompt,
      model_id: parsedConfig.model_id || 'gemini-2.5-flash',
      execution_mode: parsedConfig.execution_mode || 'flex',
      thinking_level: parsedConfig.thinking_level || 'none',
      temperature: parsedConfig.temperature !== undefined ? parsedConfig.temperature : 0.0,
      max_tokens: parsedConfig.max_tokens !== undefined ? parsedConfig.max_tokens : 2000,
      top_p: parsedConfig.top_p !== undefined ? parsedConfig.top_p : 0.9,
      top_k: parsedConfig.top_k !== undefined ? parsedConfig.top_k : 40,
      request_delay: parsedConfig.request_delay !== undefined ? parsedConfig.request_delay : 1.0,
      interaction_chaining: parsedConfig.interaction_chaining !== undefined ? parsedConfig.interaction_chaining : true,
      concurrency: parsedConfig.concurrency !== undefined ? parsedConfig.concurrency : 1,
      timeout_seconds: parsedConfig.timeout_seconds !== undefined ? parsedConfig.timeout_seconds : 900,
      discount: parsedConfig.discount !== undefined ? parsedConfig.discount : 0.0
    });

    const isCurrentDefault = prompt.prompt_type && defaultPromptsMap[prompt.prompt_type] === prompt.id;
    setSetAsDefaultOnSave(!!isCurrentDefault);
    setEditorTab('info');
    validateSchemaField(prompt.prompt_type, prompt.response_schema);
  };

  // Start Creating New Prompt
  const startCreatingPrompt = (initialType: PromptType = 'fast_filter') => {
    const defaultSchema = DEFAULT_STAGE_SCHEMAS[initialType];
    const defaultSchemaStr = defaultSchema ? JSON.stringify(defaultSchema, null, 2) : '';

    setEditingPrompt({
      name: '',
      description: '',
      prompt_type: initialType,
      system_prompt: '',
      user_prompt_template: '',
      response_schema: defaultSchemaStr,
      is_active: 1,
      model_id: 'gemini-2.5-flash',
      execution_mode: 'flex',
      thinking_level: 'none',
      temperature: 0.0,
      max_tokens: 2000,
      top_p: 0.9,
      top_k: 40,
      request_delay: 1.0,
      interaction_chaining: true,
      concurrency: 1,
      timeout_seconds: 900,
      discount: 0.0
    });
    setSetAsDefaultOnSave(true);
    setEditorTab('info');
    validateSchemaField(initialType, defaultSchemaStr);
  };

  // Save Prompt in Editor
  const handleSavePrompt = async () => {
    if (!editingPrompt?.name || !editingPrompt?.system_prompt) {
      showToast?.('Template Name and System Instructions are required', 'warning');
      return;
    }
    if (!editingPrompt?.prompt_type) {
      showToast?.('Please select a Pipeline Stage classification', 'warning');
      return;
    }

    const valResult = validatePromptSchema(editingPrompt.prompt_type, editingPrompt.response_schema);
    if (!valResult.isValid) {
      setSchemaError(valResult.error);
      showToast?.(valResult.error || 'Schema validation error', 'error');
      return;
    }

    setSavingPrompt(true);
    try {
      const llmConfigPayload = {
        model_id: editingPrompt.model_id || 'gemini-2.5-flash',
        execution_mode: editingPrompt.execution_mode || 'flex',
        thinking_level: editingPrompt.thinking_level || 'none',
        temperature: editingPrompt.temperature !== undefined ? editingPrompt.temperature : 0.0,
        max_tokens: editingPrompt.max_tokens !== undefined ? editingPrompt.max_tokens : 2000,
        top_p: editingPrompt.top_p !== undefined ? editingPrompt.top_p : 0.9,
        top_k: editingPrompt.top_k !== undefined ? editingPrompt.top_k : 40,
        request_delay: editingPrompt.request_delay !== undefined ? editingPrompt.request_delay : 1.0,
        interaction_chaining: editingPrompt.interaction_chaining !== undefined ? editingPrompt.interaction_chaining : true,
        concurrency: editingPrompt.concurrency !== undefined ? editingPrompt.concurrency : 1,
        timeout_seconds: editingPrompt.timeout_seconds !== undefined ? editingPrompt.timeout_seconds : 900,
        discount: editingPrompt.discount !== undefined ? editingPrompt.discount : 0.0
      };

      const payload = {
        id: editingPrompt.id,
        project_id: effectiveProjectId,
        name: editingPrompt.name,
        description: editingPrompt.description || null,
        prompt_type: editingPrompt.prompt_type,
        system_prompt: editingPrompt.system_prompt,
        user_prompt_template: editingPrompt.user_prompt_template || null,
        response_schema: editingPrompt.response_schema || null,
        llm_config: JSON.stringify(llmConfigPayload),
        is_active: editingPrompt.is_active !== undefined ? editingPrompt.is_active : 1,
        set_as_default: setAsDefaultOnSave
      };

      const res = await fetch('/api/llm/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (res.ok && resData.success) {
        showToast?.(resData.message || 'Prompt saved successfully', 'success');

        // If user requested setting as default and we got an ID
        const savedId = resData.id;
        if (setAsDefaultOnSave && effectiveProjectId && editingPrompt.prompt_type && savedId) {
          setLocalDefaultsOverride(prev => ({ ...prev, [editingPrompt.prompt_type!]: savedId }));
          await fetch('/api/llm/prompts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set_default',
              project_id: effectiveProjectId,
              prompt_type: editingPrompt.prompt_type,
              prompt_id: savedId
            })
          });
          loadProjects?.();
        }

        setEditingPrompt(null);
        setSchemaError(null);
        fetchPrompts();
        broadcastSync('SYNC_PROJECTS');
      } else {
        showToast?.(resData.error || 'Failed to save prompt', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error saving prompt template', 'error');
    } finally {
      setSavingPrompt(false);
    }
  };

  // Delete Prompt
  const handleDeletePrompt = async (promptId: string) => {
    if (!confirm('Are you sure you want to delete this prompt template?')) return;
    try {
      const res = await fetch(`/api/llm/prompts?id=${promptId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast?.('Prompt template deleted', 'success');
        fetchPrompts();
        broadcastSync('SYNC_PROJECTS');
      } else {
        const data = await res.json();
        showToast?.(data.error || 'Failed to delete prompt template', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error deleting prompt template', 'error');
    }
  };

  // Helper to get stage option info
  const getStageOption = (type: string | null | undefined) => {
    return PROMPT_TYPE_OPTIONS.find(o => o.id === type);
  };

  // Filtered prompts list
  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      // Stage filter
      if (selectedStageFilter !== 'ALL' && p.prompt_type !== selectedStageFilter) {
        return false;
      }
      // Scope filter
      if (selectedScopeFilter === 'PROJECT' && p.project_id === null) {
        return false;
      }
      if (selectedScopeFilter === 'GLOBAL' && p.project_id !== null) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.name?.toLowerCase().includes(q);
        const descMatch = p.description?.toLowerCase().includes(q);
        const sysMatch = p.system_prompt?.toLowerCase().includes(q);
        const stageMatch = p.prompt_type?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !sysMatch && !stageMatch) {
          return false;
        }
      }
      return true;
    });
  }, [prompts, selectedStageFilter, selectedScopeFilter, searchQuery]);

  // Stage default summary items
  const stageSummary = useMemo(() => {
    return PROMPT_TYPE_OPTIONS.map(stage => {
      const assignedId = defaultPromptsMap[stage.id];
      const assignedPrompt = prompts.find(p => p.id === assignedId);
      const totalForStage = prompts.filter(p => p.prompt_type === stage.id).length;
      return {
        ...stage,
        assignedPrompt,
        totalForStage
      };
    });
  }, [prompts, defaultPromptsMap]);

  return (
    <div className="flex flex-col h-full space-y-4 text-xs">
      
      {/* --- TOP BAR: HEADER & CREATE BUTTON --- */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground">Prompt Template Library</h3>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              {prompts.length} {prompts.length === 1 ? 'Template' : 'Templates'}
            </span>
            {effectiveProjectId ? (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Project Scoped ({effectiveProjectId})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                Global Shared Library
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Configure system rules, Jinja2 dynamic variables, structured JSON response schemas, and assign active defaults per pipeline stage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchPrompts}
            disabled={loading}
            className="p-2 bg-secondary/40 hover:bg-secondary border border-border/80 rounded-xl text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
            title="Refresh templates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => startCreatingPrompt('fast_filter')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* --- STAGE DEFAULTS OVERVIEW STRIP --- */}
      <div className="bg-secondary/15 border border-border/70 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-bold text-foreground text-xs">Active Stage Defaults</span>
            <span className="text-[10px] text-muted-foreground">(Directly executed by pipeline runner)</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {Object.keys(defaultPromptsMap).length} / {PROMPT_TYPE_OPTIONS.length} Stages Configured
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {stageSummary.map((stage) => {
            const hasDefault = !!stage.assignedPrompt;
            return (
              <div 
                key={stage.id}
                onClick={() => setSelectedStageFilter(stage.id === selectedStageFilter ? 'ALL' : stage.id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                  selectedStageFilter === stage.id 
                    ? 'border-primary bg-primary/10 shadow-sm' 
                    : hasDefault 
                    ? 'border-border/80 bg-card/60 hover:border-primary/50' 
                    : 'border-dashed border-border/60 bg-secondary/10 hover:border-border'
                }`}
                title={`Filter by ${stage.label}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase truncate">
                    {stage.label.replace('The ', '')}
                  </span>
                  {hasDefault ? (
                    <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}
                </div>
                <div className="mt-1">
                  {hasDefault ? (
                    <div className="text-[10px] font-bold text-foreground truncate" title={stage.assignedPrompt?.name}>
                      {stage.assignedPrompt?.name}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground/60 italic">
                      No Default
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- SEARCH & FILTER BAR --- */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates, system rules, JSON schemas..."
            className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scope pills */}
        <div className="flex items-center bg-secondary/30 border border-border/80 p-0.5 rounded-xl gap-0.5">
          <button
            onClick={() => setSelectedScopeFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
              selectedScopeFilter === 'ALL' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Scopes ({prompts.length})
          </button>
          <button
            onClick={() => setSelectedScopeFilter('PROJECT')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
              selectedScopeFilter === 'PROJECT' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Project-Specific ({prompts.filter(p => p.project_id !== null).length})
          </button>
          <button
            onClick={() => setSelectedScopeFilter('GLOBAL')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-all ${
              selectedScopeFilter === 'GLOBAL' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Global Defaults ({prompts.filter(p => p.project_id === null).length})
          </button>
        </div>
      </div>

      {/* --- STAGE FILTER PILLS --- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedStageFilter('ALL')}
          className={`px-3 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap transition-all ${
            selectedStageFilter === 'ALL'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60'
          }`}
        >
          All Stages ({prompts.length})
        </button>
        {PROMPT_TYPE_OPTIONS.map((opt) => {
          const count = prompts.filter(p => p.prompt_type === opt.id).length;
          const isActive = selectedStageFilter === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setSelectedStageFilter(opt.id)}
              className={`px-2.5 py-1 rounded-lg font-bold text-[10px] whitespace-nowrap flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60'
              }`}
            >
              <span>{opt.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* --- MAIN CONTENT: COMPREHENSIVE DATA TABLE --- */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 py-16">
          <Loader className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading prompt templates &amp; stage configurations...</span>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl text-muted-foreground p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-secondary/40 flex items-center justify-center text-primary">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">No Prompt Templates Found</p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {searchQuery || selectedStageFilter !== 'ALL' || selectedScopeFilter !== 'ALL'
                ? 'No templates match your active filters. Try clearing your search or stage selection.'
                : 'Create your first prompt template or import global baseline templates.'}
            </p>
          </div>
          {(searchQuery || selectedStageFilter !== 'ALL' || selectedScopeFilter !== 'ALL') ? (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStageFilter('ALL');
                setSelectedScopeFilter('ALL');
              }}
              className="px-3 py-1.5 bg-secondary text-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-all"
            >
              Clear All Filters
            </button>
          ) : (
            <button
              onClick={() => startCreatingPrompt('fast_filter')}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow hover:bg-primary/90 transition-all"
            >
              Create New Template
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto border border-border/80 rounded-xl bg-card/40 backdrop-blur-sm">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-secondary/30 font-bold border-b border-border/80 text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">Pipeline Stage</th>
                <th className="p-3">Template Name &amp; Scope</th>
                <th className="p-3 text-center">Stage Default</th>
                <th className="p-3">Model &amp; Config</th>
                <th className="p-3">Schema &amp; Output</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrompts.map((p) => {
                const stageOpt = getStageOption(p.prompt_type);
                const isDefault = p.prompt_type && defaultPromptsMap[p.prompt_type] === p.id;
                const isExpanded = !!expandedRowIds[p.id];
                const activeTabDrawer = expandedRowIds[p.id] || 'system';

                let parsedConfig: any = {};
                try {
                  parsedConfig = p.llm_config ? JSON.parse(p.llm_config) : {};
                } catch {
                  parsedConfig = {};
                }

                const modelId = parsedConfig.model_id || 'gemini-2.5-flash';
                const temp = parsedConfig.temperature !== undefined ? parsedConfig.temperature : 0.0;
                const execMode = parsedConfig.execution_mode || 'flex';
                const thinkingLevel = parsedConfig.thinking_level || 'none';
                const schemaKeyCount = countSchemaProperties(p.response_schema);
                const isSettingThisDefault = settingDefaultId === p.id;

                return (
                  <React.Fragment key={p.id}>
                    <tr 
                      className={`border-b border-border/40 hover:bg-secondary/15 transition-colors align-middle ${
                        isDefault ? 'bg-amber-500/[0.03]' : ''
                      } ${isExpanded ? 'bg-secondary/20' : ''}`}
                    >
                      {/* 1. Index & Expand chevron */}
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleRowExpansion(p.id)}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded transition-all"
                          title={isExpanded ? 'Collapse preview' : 'Expand preview'}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-primary" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* 2. Pipeline Stage */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[10px] border border-primary/20 w-fit">
                            <Layers className="w-3 h-3" />
                            {stageOpt?.label || p.prompt_type || 'Unspecified'}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {stageOpt?.stageName || ''}
                          </span>
                        </div>
                      </td>

                      {/* 3. Template Name & Scope */}
                      <td className="p-3">
                        <div className="space-y-0.5 max-w-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => toggleRowExpansion(p.id)}
                              className="font-bold text-foreground hover:text-primary transition-colors text-left text-xs"
                            >
                              {p.name}
                            </button>
                            {p.project_id === null ? (
                              <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-bold text-[8px] uppercase border border-blue-500/20">
                                Global Shared
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[8px] uppercase border border-emerald-500/20">
                                Project Copy
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1" title={p.description || ''}>
                            {p.description || 'No description provided.'}
                          </p>
                        </div>
                      </td>

                      {/* 4. Active Stage Default */}
                      <td className="p-3 text-center">
                        {isDefault ? (
                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 font-bold text-[10px] border border-amber-500/30 shadow-sm animate-in fade-in duration-200">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>ACTIVE DEFAULT</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetAsDefault(p)}
                            disabled={isSettingThisDefault || !effectiveProjectId}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary/50 hover:bg-primary/20 text-muted-foreground hover:text-primary text-[10px] font-semibold border border-border/80 transition-all disabled:opacity-40"
                            title={effectiveProjectId ? `Set "${p.name}" as active default for ${stageOpt?.label || 'this stage'}` : 'Select a project to set defaults'}
                          >
                            {isSettingThisDefault ? (
                              <Loader className="w-3 h-3 animate-spin" />
                            ) : (
                              <StarOff className="w-3 h-3" />
                            )}
                            <span>Set as Default</span>
                          </button>
                        )}
                      </td>

                      {/* 5. Model & Config */}
                      <td className="p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-primary shrink-0" />
                            <span className="font-mono font-bold text-[10px] text-foreground">{modelId}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono flex-wrap">
                            <span className="px-1 py-0.2 rounded bg-secondary/60">T={temp}</span>
                            <span className="px-1 py-0.2 rounded bg-secondary/60 uppercase">{execMode}</span>
                            {thinkingLevel !== 'none' && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold">
                                {thinkingLevel}
                              </span>
                            )}
                            {parsedConfig.interaction_chaining === false ? (
                              <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20" title="Stateless evaluation (Chaining disabled)">
                                stateless
                              </span>
                            ) : (
                              <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20" title="Multi-turn interaction chaining active">
                                chained
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 6. Schema & Output */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-secondary/50 border border-border/60">
                            <FileCode2 className="w-3 h-3 text-primary" />
                            <span>{schemaKeyCount} Properties</span>
                          </span>
                        </div>
                      </td>

                      {/* 7. Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Preview Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(p.id)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all"
                            title="Quick preview prompt & schema"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Clone / Fork */}
                          <button
                            type="button"
                            onClick={() => handleClonePrompt(p)}
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="Clone as new template"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => startEditingPrompt(p)}
                            className="p-1.5 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-all font-bold"
                            title="Edit template"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete (Only for project-specific) */}
                          {p.project_id !== null && (
                            <button
                              type="button"
                              onClick={() => handleDeletePrompt(p.id)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                              title="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* --- EXPANDABLE INLINE PREVIEW DRAWER --- */}
                    {isExpanded && (
                      <tr className="bg-secondary/[0.08] border-b border-border/60">
                        <td colSpan={7} className="p-4">
                          <div className="bg-secondary/20 border border-border/80 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            
                            {/* Drawer sub-tab switcher */}
                            <div className="flex items-center justify-between border-b border-border/60 pb-2">
                              <div className="flex items-center gap-1">
                                {[
                                  { id: 'system', name: 'System Instructions' },
                                  { id: 'template', name: 'Jinja2 User Template' },
                                  { id: 'schema', name: 'Structured JSON Schema' },
                                  { id: 'config', name: 'LLM Parameters' }
                                ].map((tab) => (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setExpandedRowIds(prev => ({ ...prev, [p.id]: tab.id as any }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                      activeTabDrawer === tab.id
                                        ? 'bg-card text-foreground shadow-sm border border-border/80'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    {tab.name}
                                  </button>
                                ))}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditingPrompt(p)}
                                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit in Full Studio
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleRowExpansion(p.id)}
                                  className="p-1 rounded text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Drawer Content */}
                            <div className="min-h-[120px]">
                              
                              {/* 1. System Prompt Preview */}
                              {activeTabDrawer === 'system' && (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                    <span>Injected as Gemini system persona guidelines and decision constraints:</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(p.system_prompt || '', `sys_${p.id}`)}
                                      className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground font-bold flex items-center gap-1 transition-all"
                                    >
                                      {copiedState === `sys_${p.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      <span>Copy System Text</span>
                                    </button>
                                  </div>
                                  <div className="bg-background/80 border border-border/60 rounded-xl p-3 max-h-60 overflow-y-auto font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                                    {p.system_prompt || 'No system prompt defined.'}
                                  </div>
                                </div>
                              )}

                              {/* 2. User Template Preview */}
                              {activeTabDrawer === 'template' && (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                    <span>Dynamic user prompt populated at runtime with paper variables:</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(p.user_prompt_template || '', `tmpl_${p.id}`)}
                                      className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground font-bold flex items-center gap-1 transition-all"
                                    >
                                      {copiedState === `tmpl_${p.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      <span>Copy Template</span>
                                    </button>
                                  </div>
                                  <div className="bg-background/80 border border-border/60 rounded-xl p-3 max-h-60 overflow-y-auto font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                                    {p.user_prompt_template || 'Default dynamic paper payload.'}
                                  </div>
                                </div>
                              )}

                              {/* 3. JSON Schema Preview */}
                              {activeTabDrawer === 'schema' && (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                                    <span>Gemini Structured Output constraint schema:</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(p.response_schema || '', `sch_${p.id}`)}
                                      className="px-2 py-0.5 rounded bg-secondary hover:bg-secondary/80 text-foreground font-bold flex items-center gap-1 transition-all"
                                    >
                                      {copiedState === `sch_${p.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                      <span>Copy JSON Schema</span>
                                    </button>
                                  </div>
                                  <div className="bg-background/80 border border-border/60 rounded-xl p-3 max-h-60 overflow-y-auto font-mono text-[11px] text-emerald-400 leading-relaxed whitespace-pre-wrap">
                                    {p.response_schema ? (
                                      JSON.stringify(tryParse(p.response_schema) || p.response_schema, null, 2)
                                    ) : (
                                      'No response schema specified.'
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 4. LLM Config Preview */}
                              {activeTabDrawer === 'config' && (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 text-[11px]">
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Model ID</span>
                                      <span className="font-mono font-bold text-foreground truncate block">{modelId}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Speed Mode</span>
                                      <span className="font-bold text-foreground uppercase">{execMode}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Thinking Level</span>
                                      <span className="font-bold text-foreground uppercase">{thinkingLevel}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Temperature</span>
                                      <span className="font-mono font-bold text-foreground">{temp}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Top-P</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.top_p ?? 0.9}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Top-K</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.top_k ?? 40}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Max Tokens</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.max_tokens ?? 2000}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Concurrency</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.concurrency ?? 1}</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Request Delay</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.request_delay ?? 1.0}s</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Timeout</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.timeout_seconds ?? 900}s</span>
                                    </div>
                                    <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl">
                                      <span className="text-[9px] text-muted-foreground font-bold uppercase block">Discount</span>
                                      <span className="font-mono font-bold text-foreground">{parsedConfig.discount !== undefined ? `${Math.round(parsedConfig.discount * 100)}% (${parsedConfig.discount})` : '0% (0.0)'}</span>
                                    </div>
                                  </div>

                                  {/* Interaction Chaining Summary Bar */}
                                  <div className="p-2.5 bg-background/60 border border-border/60 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span className="text-[10px] text-muted-foreground font-bold uppercase">Interaction Chaining:</span>
                                      <span className="text-[11px] text-foreground">
                                        {parsedConfig.interaction_chaining !== false 
                                          ? 'Multi-Turn history linked via previous_interaction_id'
                                          : 'Stateless isolated single-turn evaluations'
                                        }
                                      </span>
                                    </div>
                                    {parsedConfig.interaction_chaining !== false ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        Chaining Active
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                                        Disabled (Stateless)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- FULL-FEATURED TABBED EDITOR MODAL --- */}
      {editingPrompt && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/80 bg-secondary/15">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-foreground text-sm">
                      {editingPrompt.id ? 'Edit Prompt Template' : 'Create Prompt Template'}
                    </h4>
                    {editingPrompt.id && (
                      editingPrompt.project_id === null && effectiveProjectId ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                          Global Default (Saves as Project-Specific Copy)
                        </span>
                      ) : editingPrompt.project_id ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                          Project-Specific Template
                        </span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                          Global Shared Template
                        </span>
                      )
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Configure LLM instructions, Jinja2 placeholders, JSON schema, and execution parameters.
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => { setEditingPrompt(null); setSchemaError(null); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Editor Sub-Tab Bar & Default Checkbox */}
            <div className="flex flex-wrap items-center justify-between px-4 pt-3 border-b border-border/60 bg-secondary/5 gap-2">
              <div className="flex gap-1">
                {[
                  { id: 'info', name: 'General & System' },
                  { id: 'template', name: 'Prompt Template' },
                  { id: 'schema', name: 'Structured JSON Schema' },
                  { id: 'config', name: 'LLM Parameters' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEditorTab(tab.id as any)}
                    className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 ${
                      editorTab === tab.id
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* Set as Stage Default Checkbox */}
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={setAsDefaultOnSave}
                  onChange={(e) => setSetAsDefaultOnSave(e.target.checked)}
                  className="rounded border-border bg-secondary accent-primary w-3.5 h-3.5"
                />
                <span className="flex items-center gap-1 text-foreground">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  Set as Active Default for this Stage
                </span>
              </label>
            </div>

            {/* Editor Form Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* TAB 1: General Info & System Rules */}
              {editorTab === 'info' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Template Name *</label>
                      <input
                        type="text"
                        value={editingPrompt.name || ''}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Abstract Screening Prompt V2"
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-semibold outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Pipeline Stage *</label>
                      <select
                        value={editingPrompt.prompt_type || ''}
                        onChange={(e) => {
                          const newType = e.target.value as PromptType;
                          const defaultSchema = DEFAULT_STAGE_SCHEMAS[newType];
                          const defaultSchemaStr = defaultSchema ? JSON.stringify(defaultSchema, null, 2) : '';
                          const currentSchema = editingPrompt.response_schema || '';
                          const shouldUpdateSchema = !currentSchema.trim() || Object.values(DEFAULT_STAGE_SCHEMAS).some(
                            s => JSON.stringify(s) === JSON.stringify(tryParse(currentSchema))
                          );
                          setEditingPrompt(prev => ({
                            ...prev,
                            prompt_type: newType,
                            response_schema: shouldUpdateSchema ? defaultSchemaStr : currentSchema
                          }));
                          validateSchemaField(newType, shouldUpdateSchema ? defaultSchemaStr : currentSchema);
                        }}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold outline-none transition-all"
                      >
                        <option value="" disabled>-- Select Pipeline Stage --</option>
                        {PROMPT_TYPE_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label} ({opt.stageName})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Description</label>
                      <input
                        type="text"
                        value={editingPrompt.description || ''}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Short summary of when to use this prompt..."
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">System Instructions *</label>
                      <span className="text-[9px] text-muted-foreground">Injected into Gemini system context</span>
                    </div>
                    <textarea
                      rows={12}
                      value={editingPrompt.system_prompt || ''}
                      onChange={(e) => setEditingPrompt(prev => ({ ...prev, system_prompt: e.target.value }))}
                      placeholder="You are an expert systematic review screening assistant. Evaluate candidate papers strictly against inclusion criteria..."
                      className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 text-xs font-mono text-foreground outline-none resize-y min-h-[180px] leading-relaxed transition-all"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: User Prompt Template & Variables */}
              {editorTab === 'template' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Dynamic User Template (Jinja2 Format)</label>
                    <textarea
                      rows={10}
                      value={editingPrompt.user_prompt_template || ''}
                      onChange={(e) => setEditingPrompt(prev => ({ ...prev, user_prompt_template: e.target.value }))}
                      placeholder="Title: {{ Title }}\nAbstract: {{ Abstract }}\n\nDecision rules:\n{{ rules }}"
                      className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 text-xs font-mono text-foreground outline-none resize-y min-h-[160px] leading-relaxed transition-all"
                    />
                    <span className="text-[9px] text-muted-foreground">Use double curly braces like <code>{'{{ Title }}'}</code> to reference dynamic paper fields.</span>
                  </div>

                  {/* Jinja2 Context Variables Helper */}
                  <details className="bg-secondary/20 border border-border/60 rounded-xl p-3 text-[10px] text-muted-foreground" open={editingPrompt.prompt_type === 'umbrellanizer'}>
                    <summary className="font-bold text-foreground cursor-pointer select-none flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Available Jinja2 Context Variables ({editingPrompt.prompt_type === 'umbrellanizer' ? 'Umbrellanizer Stage 5' : editingPrompt.prompt_type || 'General'})
                      </span>
                      <span className="text-primary text-[9px]">Toggle Details</span>
                    </summary>
                    
                    {editingPrompt.prompt_type === 'umbrellanizer' ? (
                      <div className="space-y-2 mt-2 pt-2 border-t border-border/40 font-mono text-[10px]">
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <strong className="text-emerald-500 font-bold block mb-0.5">{'{{ raw_tokens_with_context }}'}</strong>
                          <span className="text-foreground font-sans block leading-relaxed">
                            <strong>(Recommended)</strong> Deduplicated list of raw extracted tokens with verbatim paper evidence quotes, Miner extraction logic traces, and paper occurrence citations formatted as a structured Markdown outline.
                          </span>
                          <span className="text-muted-foreground font-mono text-[9px] block mt-1">Alias: <code>{'{{ umbrellanizer_rich_tokens_context }}'}</code></span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="p-2 bg-secondary/30 border border-border/50 rounded-lg">
                            <strong className="text-primary font-bold block mb-0.5">{'{{ target_variable }}'}</strong>
                            <span className="text-foreground font-sans block leading-tight">
                              Target SLR extraction variable or Research Question dimension (e.g., RQ3a Hardware).
                            </span>
                            <span className="text-muted-foreground font-mono text-[9px] block mt-0.5">Alias: <code>{'{{ umbrellanizer_target_research_question }}'}</code></span>
                          </div>
                          <div className="p-2 bg-secondary/30 border border-border/50 rounded-lg">
                            <strong className="text-primary font-bold block mb-0.5">{'{{ target_variable_description }}'}</strong>
                            <span className="text-foreground font-sans block leading-tight">
                              Taxonomic description and family grouping guidelines configured in Project Settings.
                            </span>
                            <span className="text-muted-foreground font-mono text-[9px] block mt-0.5">Alias: <code>{'{{ umbrellanizer_target_research_question_description }}'}</code></span>
                          </div>
                          <div className="p-2 bg-secondary/30 border border-border/50 rounded-lg md:col-span-2">
                            <strong className="text-zinc-400 font-bold block mb-0.5">{'{{ raw_tokens }}'}</strong>
                            <span className="text-muted-foreground font-sans block leading-tight">
                              (Legacy) JSON array of deduplicated raw tokens extracted across Miner-passed papers without quote context (e.g. <code>[&quot;Raspberry Pi 4&quot;, &quot;Jetson Nano&quot;]</code>).
                            </span>
                            <span className="text-muted-foreground font-mono text-[9px] block mt-0.5">Alias: <code>{'{{ umbrellanizer_raw_tokens_array }}'}</code></span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2 pt-2 border-t border-border/40 font-mono text-[10px]">
                        {editingPrompt.prompt_type && CANONICAL_STAGE_PROMPTS[editingPrompt.prompt_type as keyof typeof CANONICAL_STAGE_PROMPTS]?.variable_dict ? (
                          <div className="space-y-1 mb-2">
                            <span className="font-bold uppercase tracking-wider text-[9px] text-primary block">Stage-Specific Placeholders:</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {Object.entries(CANONICAL_STAGE_PROMPTS[editingPrompt.prompt_type as keyof typeof CANONICAL_STAGE_PROMPTS].variable_dict).map(([varTag, desc]) => (
                                <div key={varTag} className="p-1.5 bg-secondary/30 rounded border border-border/50">
                                  <strong className="text-primary">{varTag}</strong>: <span className="text-foreground font-sans">{desc}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <span className="font-bold uppercase tracking-wider text-[9px] text-muted-foreground block">Paper Metadata &amp; Manuscript Placeholders:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div><strong className="text-foreground">{'{{ Title }}'}</strong>: Paper Title</div>
                          <div><strong className="text-foreground">{'{{ Abstract }}'}</strong>: Paper Abstract</div>
                          <div><strong className="text-foreground">{'{{ Authors }}'}</strong>: Author List</div>
                          <div><strong className="text-foreground">{'{{ Year }}'}</strong>: Publication Year</div>
                          <div><strong className="text-foreground">{'{{ DOI }}'}</strong>: Digital Object Identifier</div>
                          <div><strong className="text-foreground">{'{{ Source }}'}</strong>: Ingestion Source (Scopus/PubMed)</div>
                          <div><strong className="text-foreground">{'{{ PDF_Link }}'}</strong>: PDF Download URL</div>
                          <div><strong className="text-foreground">{'{{ citation_count }}'}</strong>: Citation Count</div>
                        </div>
                      </div>
                    )}
                  </details>
                </div>
              )}

              {/* TAB 3: Structured Output JSON Schema */}
              {editorTab === 'schema' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Structured Output JSON Schema *</label>
                      {schemaError ? (
                        <span className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {schemaError}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Valid Schema
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={12}
                      value={editingPrompt.response_schema || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingPrompt(prev => ({ ...prev, response_schema: val }));
                        validateSchemaField(editingPrompt.prompt_type, val);
                      }}
                      placeholder='{ "type": "object", "properties": { ... } }'
                      className={`w-full bg-secondary/40 border ${schemaError ? 'border-red-500/60' : 'border-border/80'} focus:border-primary/80 rounded-xl px-3 py-2 text-xs font-mono text-foreground outline-none resize-y min-h-[200px] leading-relaxed transition-all`}
                    />
                  </div>

                  <div className="flex items-center gap-2">
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
                      className="px-3 py-1 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-bold rounded-lg border border-border/80 transition-all"
                    >
                      Format JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingPrompt.prompt_type && DEFAULT_STAGE_SCHEMAS[editingPrompt.prompt_type as PromptType]) {
                          const defSchema = JSON.stringify(DEFAULT_STAGE_SCHEMAS[editingPrompt.prompt_type as PromptType], null, 2);
                          setEditingPrompt(prev => ({ ...prev, response_schema: defSchema }));
                          validateSchemaField(editingPrompt.prompt_type, defSchema);
                        }
                      }}
                      className="px-3 py-1 bg-secondary/60 hover:bg-secondary text-primary text-xs font-bold rounded-lg border border-border/80 transition-all"
                    >
                      Reset to Methodology Default Schema
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: LLM Configuration */}
              {editorTab === 'config' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* 1. Core Model & Execution Speed Mode */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Gemini Model</label>
                      <select
                        value={editingPrompt.model_id || 'gemini-2.5-flash'}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, model_id: e.target.value }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold outline-none transition-all"
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
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Execution Speed Mode</label>
                      <select
                        value={editingPrompt.execution_mode || 'flex'}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, execution_mode: e.target.value }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold outline-none transition-all"
                      >
                        <option value="flex">Flex Mode (Batched &amp; Discounted)</option>
                        <option value="standard">Standard Mode (Real-time)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Thinking Level</label>
                      <select
                        value={editingPrompt.thinking_level || 'none'}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, thinking_level: e.target.value }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-bold outline-none transition-all"
                      >
                        <option value="none">None</option>
                        <option value="minimal">Minimal</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>

                  {/* 2. Sampling Parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Temperature</label>
                        <span className="text-[10px] font-mono text-primary font-bold">{editingPrompt.temperature ?? 0.0}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={editingPrompt.temperature ?? 0.0}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top-P Sampling</label>
                        <span className="text-[10px] font-mono text-primary font-bold">{editingPrompt.top_p ?? 0.9}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={editingPrompt.top_p ?? 0.9}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, top_p: Number(e.target.value) }))}
                        className="w-full accent-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Top-K Limit</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingPrompt.top_k ?? 40}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, top_k: Number(e.target.value) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Max Output Tokens</label>
                      <input
                        type="number"
                        min="1"
                        max="64000"
                        value={editingPrompt.max_tokens ?? 2000}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, max_tokens: Number(e.target.value) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                      />
                    </div>
                  </div>

                  {/* 3. Runtime Concurrency, Pacing & Timeouts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Concurrency Limit</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={editingPrompt.concurrency ?? 1}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, concurrency: Number(e.target.value) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Request Delay (Seconds)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={editingPrompt.request_delay ?? 1.0}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, request_delay: Number(e.target.value) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Timeout (Seconds)</label>
                      <input
                        type="number"
                        min="30"
                        max="3600"
                        value={editingPrompt.timeout_seconds ?? 900}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, timeout_seconds: Number(e.target.value) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Cost Discount Rate</label>
                        <span className="text-[10px] font-mono text-primary font-bold">{Math.round((editingPrompt.discount ?? 0.0) * 100)}%</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={editingPrompt.discount ?? 0.0}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, discount: Math.min(1.0, Math.max(0.0, Number(e.target.value))) }))}
                        className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-1.5 text-xs text-foreground font-mono outline-none"
                        placeholder="0.0 - 1.0"
                      />
                    </div>
                  </div>

                  {/* 4. Multi-Turn Interaction Chaining Card */}
                  <div className="p-3 bg-secondary/20 border border-border/70 rounded-xl flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary mt-0.5">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <label 
                            htmlFor="chaining-toggle"
                            className="text-xs font-bold text-foreground cursor-pointer"
                          >
                            Multi-Turn Interaction Chaining (`previous_interaction_id`)
                          </label>
                          {editingPrompt.interaction_chaining !== false ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                              Chaining Active
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[9px] font-bold border border-amber-500/20">
                              Stateless
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
                          When enabled, passes the prior Gemini interaction session ID to preserve conversational reasoning across sequential stages on the same paper. Uncheck to execute isolated, stateless evaluations (recommended if testing single stages or encountering 404 session timeouts).
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        id="chaining-toggle"
                        type="checkbox"
                        checked={editingPrompt.interaction_chaining !== false}
                        onChange={(e) => setEditingPrompt(prev => ({ ...prev, interaction_chaining: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border/80 bg-secondary/15">
              <button
                type="button"
                onClick={() => { setEditingPrompt(null); setSchemaError(null); }}
                className="px-4 py-2 border border-border rounded-xl hover:bg-secondary text-xs font-bold text-foreground transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrompt}
                disabled={savingPrompt || !!schemaError}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 disabled:opacity-40"
              >
                {savingPrompt ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save Template</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
