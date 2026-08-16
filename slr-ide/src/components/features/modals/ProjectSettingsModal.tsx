import React, { useState } from 'react';
import { Settings, X, RefreshCw, BookOpen, Layers, Cloud, Banknote, Sparkles, CheckCircle2 } from 'lucide-react';
import LLMConfigView from '../LLMConfigView';
import ProjectMetadataSettings from './settings/ProjectMetadataSettings';
import ProjectCalibrationSettings from './settings/ProjectCalibrationSettings';
import ProjectSyncSettings from './settings/ProjectSyncSettings';

import { useProjectForm } from '@/hooks/useProjectForm';

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
  initialTab?: 'metadata' | 'calibration' | 'sync' | 'llm';
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
  handleTestProjectConnection,
  initialTab = 'metadata'
}: ProjectSettingsModalProps) {
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync' | 'llm'>(initialTab);
  const [minerSchemaKeys, setMinerSchemaKeys] = useState<string[]>([]);
  const [hasMinerPrompt, setHasMinerPrompt] = useState<boolean>(true);
  const [isLoadingMinerPrompt, setIsLoadingMinerPrompt] = useState<boolean>(false);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setProjectSettingsTab(initialTab);
    }
  }, [isOpen, initialTab]);

  React.useEffect(() => {
    if (!isOpen || !project?.id) {
      setMinerSchemaKeys([]);
      setHasMinerPrompt(true);
      return;
    }

    let isMounted = true;
    setIsLoadingMinerPrompt(true);

    fetch(`/api/llm/prompts?project_id=${project.id}&include_global=true`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.prompts)) {
          const minerPrompts = data.prompts.filter((p: any) => p.prompt_type === 'miner');
          if (minerPrompts.length === 0) {
            setHasMinerPrompt(false);
            setMinerSchemaKeys([]);
            return;
          }

          let defaultMinerId = '';
          if (project.llm_config) {
            try {
              const pCfg = JSON.parse(project.llm_config);
              defaultMinerId = pCfg.default_prompts?.miner || '';
            } catch (e) {}
          }

          // Pick mapped stage default prompt, or active project prompt, or global baseline
          const activePrompt = (defaultMinerId && minerPrompts.find((p: any) => p.id === defaultMinerId))
            || minerPrompts.find((p: any) => p.is_active === 1 && p.project_id !== null)
            || minerPrompts.find((p: any) => p.is_active === 1)
            || minerPrompts[0];
          setHasMinerPrompt(true);

          if (activePrompt?.response_schema) {
            try {
              const parsed = typeof activePrompt.response_schema === 'string'
                ? JSON.parse(activePrompt.response_schema)
                : activePrompt.response_schema;

              const extProps = parsed?.properties?.extracted_data?.properties;
              if (extProps && typeof extProps === 'object') {
                const keys = Object.keys(extProps).filter(k => k && (typeof extProps[k] === 'object' || typeof extProps[k] === 'string'));
                setMinerSchemaKeys(keys);
              } else {
                setMinerSchemaKeys([]);
              }
            } catch (err) {
              console.error('Failed to parse miner response_schema:', err);
              setMinerSchemaKeys([]);
            }
          } else {
            setMinerSchemaKeys([]);
          }
        } else {
          setHasMinerPrompt(false);
          setMinerSchemaKeys([]);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load miner prompts for project:', err);
        setHasMinerPrompt(false);
        setMinerSchemaKeys([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingMinerPrompt(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, project?.id]);

  const form = useProjectForm(project);

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
    projectFormScopusSearchString: form.scopusSearchString,
    setProjectFormScopusSearchString: form.setScopusSearchString,
    projectFormManualSearchString: form.manualSearchString,
    setProjectFormManualSearchString: form.setManualSearchString,
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
    handleRemovePoolCExtractionRule: form.handleRemovePoolCExtractionRule,
    projectFormResearchQuestionDescriptions: form.researchQuestionDescriptions,
    setProjectFormResearchQuestionDescriptions: form.setResearchQuestionDescriptions
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    let existingLlmConfig: any = {};
    try {
      existingLlmConfig = project.llm_config ? JSON.parse(project.llm_config) : {};
    } catch (err) {
      existingLlmConfig = {};
    }

    const updatedLlmConfig = {
      ...existingLlmConfig,
      research_question_descriptions: form.researchQuestionDescriptions
    };

    const success = await onSaveProject(project.id, {
      name: form.name,
      manifesto: form.manifesto,
      objective: form.objective,
      questions: form.questions,
      qa_definition: form.qaDefinition,
      exclusion_criteria: form.exclusionCriteria,
      scopus_search_string: form.scopusSearchString,
      manual_search_string: form.manualSearchString,
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

  const navTabs = [
    { id: 'metadata', label: 'Scope & Search Queries', icon: BookOpen },
    { id: 'calibration', label: 'Calibration & Pools', icon: Layers },
    { id: 'sync', label: 'Cloud Sync & Rclone', icon: Cloud },
    { id: 'llm', label: 'Budget & Safety', icon: Banknote }
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
      <div className="relative bg-card/95 border border-border/80 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 backdrop-blur-xl">
        {/* Top Decorative Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-10" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-secondary/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-foreground">
                  Project Settings
                </h3>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                  {form.name || project?.name}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono bg-secondary/60 px-2 py-0.5 rounded border border-border/60">
                  slug: {project?.folder_name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Configure FAIR protocol bounds, calibration rules, and cloud mirroring.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-secondary/60 cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-border/70 bg-secondary/10 px-6 gap-2 select-none shrink-0 overflow-x-auto py-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = projectSettingsTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setProjectSettingsTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-primary/30'
                    : 'bg-background/50 text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-border/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
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
              <ProjectCalibrationSettings 
                form={mappedForm} 
                minerSchemaKeys={minerSchemaKeys}
                hasMinerPrompt={hasMinerPrompt}
                isLoadingMinerPrompt={isLoadingMinerPrompt}
                onPopulateAllExtractionKeys={() => form.handlePopulateAllPoolCExtractionRules(minerSchemaKeys)}
              />
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
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-border/70 flex items-center justify-between bg-secondary/15 shrink-0">
            <span className="text-[11px] text-muted-foreground font-mono">
              Changes update active database configuration immediately.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-secondary/80 text-foreground hover:bg-secondary border border-border/80 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProject}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {savingProject ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Save Configurations
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}