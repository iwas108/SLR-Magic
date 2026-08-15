'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, Loader, CheckCircle2, X, AlertTriangle, Layers } from 'lucide-react';
import { 
  PromptType, 
  PROMPT_TYPE_OPTIONS, 
  DEFAULT_STAGE_SCHEMAS, 
  validatePromptSchema 
} from '@/lib/services/prompt-validator';

interface Prompt {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  prompt_type: PromptType | string | null;
  system_prompt: string;
  user_prompt_template: string | null;
  response_schema: string | null;
  is_active: number;
}

interface PromptLibraryViewProps {
  projectId?: string | null; // null for global prompts
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function PromptLibraryView({ projectId = null, showToast }: PromptLibraryViewProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);
  const [saving, setSaving] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const url = projectId ? `/api/llm/prompts?project_id=${projectId}` : '/api/llm/prompts';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts);
      } else {
        showToast?.('Failed to load prompts', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error loading prompts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, [projectId]);

  const validateSchemaField = (type: string | null | undefined, schemaValue: string | null | undefined) => {
    if (!schemaValue || !schemaValue.trim()) {
      setSchemaError(null);
      return;
    }
    const valResult = validatePromptSchema(type, schemaValue);
    if (!valResult.isValid) {
      setSchemaError(valResult.error);
    } else {
      setSchemaError(null);
    }
  };

  const handlePromptTypeChange = (newType: PromptType) => {
    const defaultSchema = DEFAULT_STAGE_SCHEMAS[newType];
    const defaultSchemaStr = defaultSchema ? JSON.stringify(defaultSchema, null, 2) : '';

    const currentSchema = editingPrompt?.response_schema || '';
    // If schema is empty or matches a default schema, update to selected type's default schema
    const shouldUpdateSchema = !currentSchema.trim() || Object.values(DEFAULT_STAGE_SCHEMAS).some(
      s => JSON.stringify(s) === JSON.stringify(tryParse(currentSchema))
    );

    const updatedPrompt = {
      ...editingPrompt,
      prompt_type: newType,
      response_schema: shouldUpdateSchema ? defaultSchemaStr : currentSchema
    };

    setEditingPrompt(updatedPrompt);
    validateSchemaField(newType, updatedPrompt.response_schema);
  };

  const tryParse = (str: string) => {
    try { return JSON.parse(str); } catch { return null; }
  };

  const handleSave = async () => {
    if (!editingPrompt?.name || !editingPrompt?.system_prompt) {
      showToast?.('Name and System Prompt are required', 'warning');
      return;
    }

    if (!editingPrompt.prompt_type) {
      showToast?.('Please select a Prompt Type / Pipeline Stage', 'warning');
      return;
    }

    const valResult = validatePromptSchema(editingPrompt.prompt_type, editingPrompt.response_schema);
    if (!valResult.isValid) {
      setSchemaError(valResult.error);
      showToast?.(valResult.error || 'Schema validation error', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...editingPrompt,
        project_id: projectId
      };

      const res = await fetch('/api/llm/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const resData = await res.json();
        showToast?.(resData.message || 'Prompt saved successfully', 'success');
        setEditingPrompt(null);
        setSchemaError(null);
        fetchPrompts();
      } else {
        const errorData = await res.json();
        showToast?.(errorData.error || 'Failed to save prompt', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error saving prompt', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    try {
      const res = await fetch(`/api/llm/prompts?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast?.('Prompt deleted', 'success');
        fetchPrompts();
      } else {
        showToast?.('Failed to delete prompt', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error deleting prompt', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 text-xs">
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <div>
          <h3 className="text-xs font-bold text-foreground">Prompt Library</h3>
          <p className="text-[10px] text-muted-foreground">
            {projectId ? 'Manage project-specific prompts' : 'Manage global shared prompts'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const initialType = 'fast_filter';
            setEditingPrompt({ 
              name: '', 
              prompt_type: initialType,
              system_prompt: '', 
              user_prompt_template: '', 
              response_schema: JSON.stringify(DEFAULT_STAGE_SCHEMAS[initialType], null, 2), 
              is_active: 1 
            });
            setSchemaError(null);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md shadow hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Prompt</span>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader className="w-5 h-5 animate-spin text-primary" />
          <span className="text-[10px] font-medium">Loading prompts...</span>
        </div>
      ) : editingPrompt ? (
        <div className="flex-1 overflow-y-auto bg-secondary/10 border border-border rounded-lg p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-2 border-b border-border/50 pb-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-foreground">{editingPrompt.id ? 'Edit Prompt' : 'New Prompt'}</h4>
              {editingPrompt.id && (
                editingPrompt.project_id === null && projectId ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                    Global Default (Saves as Project Copy)
                  </span>
                ) : editingPrompt.project_id ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    Project-Specific
                  </span>
                ) : (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                    Global Shared
                  </span>
                )
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingPrompt.is_active === 1}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, is_active: e.target.checked ? 1 : 0 })}
                  className="rounded border-border bg-secondary"
                />
                Active
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Prompt Name</label>
                <input
                  type="text"
                  className="w-full bg-secondary/35 border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none font-semibold"
                  value={editingPrompt.name || ''}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                  placeholder="e.g., Abstract Screening Prompt"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Prompt Type / Pipeline Stage</label>
                <select
                  className="w-full bg-secondary/35 border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none font-semibold"
                  value={editingPrompt.prompt_type || ''}
                  onChange={(e) => handlePromptTypeChange(e.target.value as PromptType)}
                >
                  <option value="" disabled>-- Select Prompt Type --</option>
                  {PROMPT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label} ({opt.stageName})</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Description (Optional)</label>
              <input
                type="text"
                className="w-full bg-secondary/35 border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none font-semibold"
                value={editingPrompt.description || ''}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                placeholder="Brief description of when to use this prompt"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">System Prompt</label>
              <textarea
                className="w-full bg-secondary/35 border border-border rounded-md px-3 py-2 text-[11px] font-mono text-foreground focus:border-primary focus:outline-none min-h-[100px]"
                value={editingPrompt.system_prompt || ''}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, system_prompt: e.target.value })}
                placeholder="You are an expert researcher..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">User Prompt Template (Optional)</label>
              <textarea
                className="w-full bg-secondary/35 border border-border rounded-md px-3 py-2 text-[11px] font-mono text-foreground focus:border-primary focus:outline-none min-h-[60px]"
                value={editingPrompt.user_prompt_template || ''}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, user_prompt_template: e.target.value })}
                placeholder="Analyze this paper: {{title}} {{abstract}}"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Use {'{{variables}}'} to denote template insertions.</p>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Structured Output JSON Schema (Standardized Baseline)
                </label>
                {schemaError && (
                  <span className="text-[9px] text-red-400 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {schemaError}
                  </span>
                )}
              </div>
              <textarea
                className={`w-full bg-secondary/35 border ${schemaError ? 'border-red-500/60' : 'border-border'} rounded-md px-3 py-2 text-[11px] font-mono text-foreground focus:outline-none min-h-[120px]`}
                value={editingPrompt.response_schema || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditingPrompt({ ...editingPrompt, response_schema: val });
                  validateSchemaField(editingPrompt.prompt_type, val);
                }}
                placeholder='{ "type": "object", "properties": { ... } }'
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setEditingPrompt(null); setSchemaError(null); }}
              className="px-3 py-1.5 bg-secondary text-foreground hover:bg-secondary/80 border border-border text-xs font-semibold rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!schemaError}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-md shadow transition-colors disabled:opacity-50"
            >
              {saving ? <Loader className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span>Save Prompt</span>
            </button>
          </div>
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg text-muted-foreground p-8 text-center space-y-2">
          <p className="text-sm font-semibold">No prompts found</p>
          <p className="text-xs">Create your first {projectId ? 'project' : 'global'} prompt to get started.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {prompts.map((prompt) => {
            const opt = PROMPT_TYPE_OPTIONS.find(o => o.id === prompt.prompt_type);
            const promptTypeLabel = opt ? opt.label : (prompt.prompt_type || 'Unspecified Stage');
            return (
              <div key={prompt.id} className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors flex flex-col gap-2 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="text-xs font-bold text-foreground">{prompt.name}</h5>
                      <span className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-primary/20">
                        <Layers className="w-3 h-3" /> {promptTypeLabel}
                      </span>
                      {prompt.is_active === 1 ? (
                        <span className="bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="bg-muted text-muted-foreground text-[9px] font-bold px-1.5 py-0.5 rounded border border-border">
                          Inactive
                        </span>
                      )}
                    </div>
                    {prompt.description && <p className="text-[10px] text-muted-foreground mt-0.5">{prompt.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setEditingPrompt(prompt); setSchemaError(null); }}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Edit Prompt"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(prompt.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                      title="Delete Prompt"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-secondary/20 rounded p-2 border border-border/50 max-h-24 overflow-y-auto">
                  <p className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground leading-relaxed line-clamp-3">
                    {prompt.system_prompt}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
