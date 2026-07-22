import React, { useState } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';
import LLMConfigView from '../LLMConfigView';
import PromptLibraryView from '../PromptLibraryView';
import ProjectMetadataSettings from './settings/ProjectMetadataSettings';
import ProjectCalibrationSettings from './settings/ProjectCalibrationSettings';
import ProjectSyncSettings from './settings/ProjectSyncSettings';

import { useProjectForm } from '@/hooks/useProjectForm';

function getPathsFromSchema(schemaStr?: string | null): string[] {
  if (!schemaStr) return [];
  try {
    const schema = JSON.parse(schemaStr);
    const paths: string[] = [];

    function traverse(obj: any, currentPath: string = '') {
      if (!obj || typeof obj !== 'object') return;

      if (obj.type === 'object' && obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          const prop = obj.properties[key];
          traverse(prop, newPath);
        });
      } else if (obj.properties) {
        Object.keys(obj.properties).forEach(key => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          traverse(obj.properties[key], newPath);
        });
      } else {
        if (currentPath) {
          paths.push(currentPath);
        }
      }
    }

    traverse(schema);
    return paths;
  } catch (e) {
    return [];
  }
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: any[];
  project: any;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSaveProject: (projectId: string, projectData: any) => Promise<boolean>;
  savingProject: boolean;
  testingProjectConnection: boolean;
  projectConnectionTestResult: { success: boolean; message: string; details?: string } | null;
  handleTestProjectConnection: (provider: string, remoteName: string) => void;
}

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  projects,
  project,
  loadProjects,
  showToast,
  onSaveProject,
  savingProject,
  testingProjectConnection,
  projectConnectionTestResult,
  handleTestProjectConnection
}: ProjectSettingsModalProps) {
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync' | 'llm' | 'prompts'>('metadata');

  const form = useProjectForm(project);

  const [promptsList, setPromptsList] = useState<any[]>([]);
  const [manualModes, setManualModes] = useState<Record<string, boolean>>({});

  const [defaultPrompts, setDefaultPrompts] = useState<Record<string, string>>(() => {
    try {
      const cfg = project?.llm_config ? JSON.parse(project.llm_config) : {};
      return cfg.default_prompts || {};
    } catch {
      return {};
    }
  });

  const [schemaMappings, setSchemaMappings] = useState<Record<string, { decision: string; exclusion_trigger: string; rationale: string }>>(() => {
    try {
      const cfg = project?.llm_config ? JSON.parse(project.llm_config) : {};
      return cfg.schema_mappings || {};
    } catch {
      return {};
    }
  });

  React.useEffect(() => {
    try {
      const cfg = project?.llm_config ? JSON.parse(project.llm_config) : {};
      setDefaultPrompts(cfg.default_prompts || {});
      setSchemaMappings(cfg.schema_mappings || {});
    } catch {
      setDefaultPrompts({});
      setSchemaMappings({});
    }
  }, [project]);

  React.useEffect(() => {
    if (!isOpen || !project?.id) return;
    fetch(`/api/llm/prompts?project_id=${project.id}&include_global=true`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPromptsList(data.prompts || []);
        }
      })
      .catch(err => console.error('Failed to load prompts in modal:', err));
  }, [isOpen, project?.id]);

  if (!isOpen) return null;

  const mappedForm = {
    projectFormName: form.name,
    setProjectFormName: form.setName,
    projectFormManifesto: form.manifesto,
    setProjectFormManifesto: form.setManifesto,
    projectFormObjective: form.objective,
    setProjectFormObjective: form.setObjective,
    projectFormQuestions: form.questions,
    setProjectFormQuestions: form.setQuestions,
    projectFormQaDefinition: form.qaDefinition,
    setProjectFormQaDefinition: form.setQaDefinition,
    projectFormExclusionCriteria: form.exclusionCriteria,
    setProjectFormExclusionCriteria: form.setExclusionCriteria,
    projectFormPoolA: form.poolA,
    setProjectFormPoolA: form.setPoolA,
    projectFormPoolB: form.poolB,
    setProjectFormPoolB: form.setPoolB,
    projectFormPoolC: form.poolC,
    setProjectFormPoolC: form.setPoolC,
    projectFormRollingBatchSize: form.rollingBatchSize,
    setProjectFormRollingBatchSize: form.setRollingBatchSize,
    projectFormGDriveDest: form.gdriveDest,
    setProjectFormGDriveDest: form.setGdriveDest,
    projectFormGoldmineDest: form.goldmineDest,
    setProjectFormGoldmineDest: form.setGoldmineDest,
    projectFormCloudProvider: form.cloudProvider,
    setProjectFormCloudProvider: form.setCloudProvider,
    projectFormRemoteName: form.remoteName,
    setProjectFormRemoteName: form.setRemoteName,
    
    // Pool configurations
    projectFormPoolTagsA: form.poolTags?.pool_a || [],
    handleAddPoolTagA: () => form.handleAddPoolTag('pool_a'),
    handleUpdatePoolTagA: (idx: number, field: string, val: string) => form.handleUpdatePoolTag('pool_a', idx, field as any, val),
    handleRemovePoolTagA: (idx: number) => form.handleRemovePoolTag('pool_a', idx),

    projectFormPoolTagsB: form.poolTags?.pool_b || [],
    handleAddPoolTagB: () => form.handleAddPoolTag('pool_b'),
    handleUpdatePoolTagB: (idx: number, field: string, val: string) => form.handleUpdatePoolTag('pool_b', idx, field as any, val),
    handleRemovePoolTagB: (idx: number) => form.handleRemovePoolTag('pool_b', idx),

    projectFormPoolTagsC: form.poolTags?.pool_c || [],
    handleAddPoolTagC: () => form.handleAddPoolTag('pool_c'),
    handleUpdatePoolTagC: (idx: number, field: string, val: string) => form.handleUpdatePoolTag('pool_c', idx, field as any, val),
    handleRemovePoolTagC: (idx: number) => form.handleRemovePoolTag('pool_c', idx),
    
    projectFormPoolBEcRules: form.poolBEcRules,
    projectFormEcRules: form.ecRules,
    handleAddPoolBEcRule: form.handleAddPoolBEcRule,
    handleUpdatePoolBEcRule: (idx: number, field: string, val: string) => form.handleUpdatePoolBEcRule(idx, field as any, val),
    handleRemovePoolBEcRule: form.handleRemovePoolBEcRule,
    handleAddEcRule: form.handleAddEcRule,
    handleUpdateEcRule: (idx: number, field: string, val: string) => form.handleUpdateEcRule(idx, field as any, val),
    handleRemoveEcRule: form.handleRemoveEcRule,
    
    projectFormPoolBReasoningTemplate: form.poolBReasoningTemplate,
    projectFormReasoningTemplate: form.reasoningTemplate,
    handleAddPoolBReasoningTemplate: form.handleAddPoolBReasoningTemplate,
    handleUpdatePoolBReasoningTemplate: form.handleUpdatePoolBReasoningTemplate,
    handleRemovePoolBReasoningTemplate: form.handleRemovePoolBReasoningTemplate,
    handleAddReasoningTemplate: form.handleAddReasoningTemplate,
    handleUpdateReasoningTemplate: form.handleUpdateReasoningTemplate,
    handleRemoveReasoningTemplate: form.handleRemoveReasoningTemplate,
    
    projectFormPoolCQaRules: form.poolCQaRules,
    handleAddPoolCQaRule: form.handleAddPoolCQaRule,
    handleUpdatePoolCQaRule: (idx: number, field: string, val: any) => form.handleUpdatePoolCQaRule(idx, field as any, val),
    handleRemovePoolCQaRule: form.handleRemovePoolCQaRule,
    
    projectFormPoolCExtractionRules: form.poolCExtractionRules,
    handleAddPoolCExtractionRule: form.handleAddPoolCExtractionRule,
    handleUpdatePoolCExtractionRule: (idx: number, field: string, val: string) => form.handleUpdatePoolCExtractionRule(idx, field as any, val),
    handleRemovePoolCExtractionRule: form.handleRemovePoolCExtractionRule
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    
    let currentLlmConfig = {};
    try {
      currentLlmConfig = project.llm_config ? JSON.parse(project.llm_config) : {};
    } catch {}
    
    const updatedLlmConfig = {
      ...currentLlmConfig,
      default_prompts: defaultPrompts,
      schema_mappings: schemaMappings
    };

    const success = await onSaveProject(project.id, {
      name: form.name,
      manifesto: form.manifesto,
      objective: form.objective,
      questions: form.questions,
      qa_definition: form.qaDefinition,
      exclusion_criteria: form.exclusionCriteria,
      pool_a_size: Number(form.poolA),
      pool_b_size: Number(form.poolB),
      pool_c_size: Number(form.poolC),
      rolling_batch_size: Number(form.rollingBatchSize),
      gdrive_dest_path: form.gdriveDest,
      goldmine_dest_path: form.goldmineDest,
      cloud_provider: form.cloudProvider,
      rclone_remote_name: form.remoteName,
      pool_tags: form.poolTags,
      ec_rules: form.ecRules,
      reasoning_template: form.reasoningTemplate,
      pool_b_ec_rules: form.poolBEcRules,
      pool_b_reasoning_template: form.poolBReasoningTemplate,
      pool_c_qa_rules: form.poolCQaRules,
      pool_c_extraction_rules: form.poolCExtractionRules,
      project_budget_limit: Number(form.projectBudgetLimit),
      project_tax: Number(form.projectTax),
      llm_config: JSON.stringify(updatedLlmConfig)
    });
    if (success) {
      showToast('Project configuration saved successfully', 'success');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Project Settings: <span className="text-primary">{form.name}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-secondary/5 px-4 select-none">
          {(['metadata', 'calibration', 'sync', 'llm', 'prompts'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setProjectSettingsTab(tab)}
              className={`px-4 py-3 text-xs font-semibold border-b-2 transition-all capitalize ${
                projectSettingsTab === tab ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'sync' ? 'Cloud Sync' : tab === 'llm' ? 'Budget Settings' : tab}
            </button>
          ))}
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-6 space-y-4 flex-1">
            
            {/* Tab Content: Metadata */}
            {projectSettingsTab === 'metadata' && (
              <ProjectMetadataSettings form={mappedForm} />
            )}

            {/* Tab Content: Pre-Calibration */}
            {projectSettingsTab === 'calibration' && (
              <ProjectCalibrationSettings form={mappedForm} />
            )}

            {/* Tab Content: Sync */}
            {projectSettingsTab === 'sync' && (
              <ProjectSyncSettings
                form={mappedForm}
                testingProjectConnection={testingProjectConnection}
                projectConnectionTestResult={projectConnectionTestResult}
                handleTestProjectConnection={handleTestProjectConnection}
              />
            )}

            {/* Tab Content: LLM Configuration */}
            {projectSettingsTab === 'llm' && (
              <div className="flex-1 min-h-0 h-full">
                <LLMConfigView 
                  activeProject={project} 
                  loadProjects={loadProjects} 
                  showToast={showToast}
                  budgetLimit={form.projectBudgetLimit}
                  setBudgetLimit={form.setProjectBudgetLimit}
                  taxRate={form.projectTax}
                  setTaxRate={form.setProjectTax}
                  isInsideModal={true}
                />
              </div>
            )}

            {/* Tab Content: Project Prompts */}
            {projectSettingsTab === 'prompts' && (
              <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-y-auto max-h-[60vh] pr-1">
                <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-4 shrink-0">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Default Stage Prompts &amp; Schema Mapping</h4>
                  <p className="text-[10px] text-muted-foreground">Select the default template executed for each stage, and configure key paths to map output JSON to mandatory database columns.</p>
                  
                  <div className="space-y-4">
                    {([
                      { id: 'fast_filter', name: 'Fast Filter', desc: 'Metadata Screening', hasMapping: true },
                      { id: 'gatekeeper', name: 'Gatekeeper', desc: 'PDF Screening', hasMapping: true },
                      { id: 'scientist', name: 'Scientist', desc: 'Quality Assessment', hasMapping: true },
                      { id: 'miner', name: 'Miner', desc: 'Structured Data Extraction', hasMapping: false },
                      { id: 'umbrellanizer', name: 'Umbrellanizer', desc: 'Token Normalization', hasMapping: false }
                    ] as const).map((stage) => (
                      <div key={stage.id} className="p-3 bg-card border border-border/40 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-foreground">{stage.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-2">({stage.desc})</span>
                          </div>
                          <select
                            value={defaultPrompts[stage.id] || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDefaultPrompts(prev => ({ ...prev, [stage.id]: val }));
                            }}
                            className="bg-secondary/35 border border-border rounded-md px-2.5 py-1 text-xs outline-none font-semibold text-foreground w-64"
                          >
                            <option value="">-- No Default Selected --</option>
                            {promptsList.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                            ))}
                          </select>
                        </div>

                        {stage.hasMapping && defaultPrompts[stage.id] && (() => {
                          const selectedPrompt = promptsList.find(p => p.id === defaultPrompts[stage.id]);
                          const schemaPaths = getPathsFromSchema(selectedPrompt?.response_schema);
                          
                          const renderField = (key: 'decision' | 'exclusion_trigger' | 'rationale', label: string, placeholder: string) => {
                            const fieldKey = `${stage.id}_${key}`;
                            const isManual = manualModes[fieldKey] || schemaPaths.length === 0;
                            const currentValue = schemaMappings[stage.id]?.[key] || '';
                            
                            return (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[9px] font-bold text-muted-foreground uppercase">{label}</label>
                                  {schemaPaths.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setManualModes(prev => ({ ...prev, [fieldKey]: !isManual }))}
                                      className="text-[8px] text-primary hover:underline font-bold"
                                    >
                                      {isManual ? 'Use Schema' : 'Manual'}
                                    </button>
                                  )}
                                </div>
                                {isManual ? (
                                  <input
                                    type="text"
                                    placeholder={placeholder}
                                    value={currentValue}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSchemaMappings(prev => ({
                                        ...prev,
                                        [stage.id]: { ...(prev[stage.id] || { decision: '', exclusion_trigger: '', rationale: '' }), [key]: val }
                                      }));
                                    }}
                                    className="w-full bg-secondary/20 border border-border/60 rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none"
                                  />
                                ) : (
                                  <select
                                    value={currentValue}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSchemaMappings(prev => ({
                                        ...prev,
                                        [stage.id]: { ...(prev[stage.id] || { decision: '', exclusion_trigger: '', rationale: '' }), [key]: val }
                                      }));
                                    }}
                                    className="w-full bg-secondary/20 border border-border/60 rounded px-2 py-1.5 text-[10px] text-foreground font-mono focus:outline-none"
                                  >
                                    <option value="">-- Select Path --</option>
                                    {schemaPaths.map(path => (
                                      <option key={path} value={path}>{path}</option>
                                    ))}
                                    {currentValue && !schemaPaths.includes(currentValue) && (
                                      <option value={currentValue}>{currentValue} (Custom)</option>
                                    )}
                                  </select>
                                )}
                              </div>
                            );
                          };

                          return (
                            <div className="grid grid-cols-3 gap-3 border-t border-border/30 pt-2 animate-in fade-in duration-150">
                              {renderField('decision', 'Decision Key Path', 'e.g. final_evaluation.decision')}
                              {renderField('exclusion_trigger', 'Exclusion Trigger Key Path', 'e.g. final_evaluation.exclusion_code')}
                              {renderField('rationale', 'Rationale Key Path', 'e.g. final_evaluation.reasoning')}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="border-t border-border/40 pt-4 shrink-0">
                  <PromptLibraryView projectId={project?.id || null} showToast={showToast} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border flex justify-end gap-3 bg-secondary/10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProject}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5"
            >
              {savingProject && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Save Configurations
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}