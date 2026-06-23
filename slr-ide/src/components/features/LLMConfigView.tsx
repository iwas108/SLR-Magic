import React, { useState, useEffect } from 'react';
import { Save, Settings2, Database, BrainCircuit, Activity, Banknote } from 'lucide-react';

interface LLMConfigViewProps {
  activeProject: any;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void;
}

export default function LLMConfigView({ activeProject, loadProjects, showToast }: LLMConfigViewProps) {
  const [pricingModels, setPricingModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [saving, setSaving] = useState(false);

  // Parse existing config or use defaults
  const existingConfig = activeProject?.llm_config ? JSON.parse(activeProject.llm_config) : {};
  
  const [provider, setProvider] = useState(existingConfig.provider || 'google');
  const [modelId, setModelId] = useState(existingConfig.model_id || 'gemini-1.5-flash');
  const [executionMode, setExecutionMode] = useState(existingConfig.execution_mode || 'standard');
  const [promptTemplate, setPromptTemplate] = useState(existingConfig.prompt_template_id || 'default-screen');
  const [concurrency, setConcurrency] = useState(existingConfig.concurrency_limit || 5);
  const [batchQueueSize, setBatchQueueSize] = useState(existingConfig.batch_queue_size || 100);
  const [temperature, setTemperature] = useState(existingConfig.temperature || 0.0);
  const [budgetLimit, setBudgetLimit] = useState(activeProject?.project_budget_limit || 5.0);
  const [maxTokens, setMaxTokens] = useState(existingConfig.max_tokens !== undefined ? existingConfig.max_tokens : 2000);
  const [topP, setTopP] = useState(existingConfig.top_p !== undefined ? existingConfig.top_p : 0.9);
  const [topK, setTopK] = useState(existingConfig.top_k !== undefined ? existingConfig.top_k : 40);
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/llm/pricing')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPricingModels(data.models);
        }
      })
      .catch(err => console.error('Failed to load pricing models', err))
      .finally(() => setLoadingModels(false));
  }, []);

  useEffect(() => {
    if (!activeProject?.id) return;
    fetch(`/api/llm/prompts?project_id=${activeProject.id}&include_global=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTemplates(data.prompts);
        }
      })
      .catch(err => console.error('Failed to load prompt templates', err));
  }, [activeProject?.id]);

  const handleSave = async () => {
    if (!activeProject) return;
    setSaving(true);
    
    const configToSave = {
      provider,
      model_id: modelId,
      execution_mode: executionMode,
      prompt_template_id: promptTemplate,
      concurrency_limit: Number(concurrency),
      batch_queue_size: Number(batchQueueSize),
      temperature: Number(temperature),
      max_tokens: Number(maxTokens),
      top_p: Number(topP),
      top_k: provider !== 'openai' && topK !== '' ? Number(topK) : undefined
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeProject,
          project_budget_limit: Number(budgetLimit),
          llm_config: JSON.stringify(configToSave)
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('LLM Configuration saved successfully', 'success');
        loadProjects(); // reload to update parent state
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showToast(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredModels = pricingModels.filter(m => m.provider === provider);

  // Update model ID if provider changes and current model isn't in new provider
  useEffect(() => {
    if (filteredModels.length > 0 && !filteredModels.find(m => m.model_id === modelId)) {
      setModelId(filteredModels[0].model_id);
    }
  }, [provider, filteredModels, modelId]);

  if (!activeProject) return null;

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="px-5 py-4 border-b border-border/50 bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <Settings2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">LLM Configuration</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Engine Parameters</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow hover:bg-primary/90 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Config'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Model Selection Group */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BrainCircuit className="w-3.5 h-3.5" /> Model Architecture
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Provider</label>
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
              >
                <option value="google">Google (Gemini)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Model Selection</label>
              <select 
                value={modelId} 
                onChange={(e) => setModelId(e.target.value)}
                disabled={loadingModels}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow disabled:opacity-50"
              >
                {loadingModels ? (
                  <option>Loading models...</option>
                ) : filteredModels.length === 0 ? (
                  <option>No models available</option>
                ) : (
                  filteredModels.map(m => (
                    <option key={m.model_id} value={m.model_id}>{m.model_id}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </section>

        {/* Execution Engine Group */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Execution Engine
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Execution Mode</label>
              <select 
                value={executionMode} 
                onChange={(e) => setExecutionMode(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
              >
                <option value="standard">Standard (Synchronous)</option>
                <option value="flex">Flex / Dynamic (If available)</option>
                <option value="batch">Cloud Batch (24h Turnaround)</option>
              </select>
              <p className="text-[10px] text-muted-foreground">Batch mode offers ~50% discount on supported providers.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Prompt Template</label>
              <select 
                value={promptTemplate} 
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
              >
                {availableTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.project_id ? '(Project)' : '(Global)'}
                  </option>
                ))}
                {availableTemplates.length === 0 && (
                  <>
                    <option value="default-screen">Standard Boolean Screen</option>
                    <option value="cot-screen">Chain of Thought Screen</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Concurrency Limit</label>
              <input 
                type="number" 
                min="1" max="50"
                value={concurrency} 
                onChange={(e) => setConcurrency(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Batch Queue Size</label>
              <input 
                type="number" 
                min="10" max="5000"
                value={batchQueueSize} 
                onChange={(e) => setBatchQueueSize(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
                disabled={executionMode !== 'batch'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Temperature</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" max="1" step="0.1"
                  value={temperature} 
                  onChange={(e) => setTemperature(e.target.value)}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs font-mono w-6">{temperature}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Max Output Tokens</label>
              <input 
                type="number" 
                min="1" max="16000"
                value={maxTokens} 
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Top P</label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="0" max="1" step="0.05"
                  value={topP} 
                  onChange={(e) => setTopP(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-xs font-mono w-8">{topP}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Top K</label>
              <input 
                type="number" 
                min="1" max="500"
                value={topK} 
                onChange={(e) => setTopK(e.target.value !== '' ? Number(e.target.value) : '')}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow"
                disabled={provider === 'openai'}
                placeholder={provider === 'openai' ? 'N/A' : '40'}
              />
            </div>
          </div>
        </section>

        {/* Budget & Safety */}
        <section className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Banknote className="w-3.5 h-3.5" /> Budget & Safety Guardrails
          </h4>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-bold text-destructive">Maximum Project Budget ($)</label>
                <p className="text-[10px] text-destructive/80 font-medium">
                  The Python worker will strictly pause execution if estimated token costs exceed this limit.
                </p>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input 
                  type="number" 
                  min="0.1" step="0.1"
                  value={budgetLimit} 
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-background border border-destructive/30 rounded-lg pl-7 pr-3 py-2 font-mono text-sm font-bold text-foreground focus:ring-1 focus:ring-destructive outline-none transition-shadow"
                />
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
