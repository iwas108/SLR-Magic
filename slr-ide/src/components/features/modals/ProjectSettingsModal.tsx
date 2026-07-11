import React, { useState } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';
import LLMConfigView from '../LLMConfigView';
import PromptLibraryView from '../PromptLibraryView';
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
    projectFormGDriveDest: form.gdriveDest,
    setProjectFormGDriveDest: form.setGdriveDest,
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
      gdrive_dest_path: form.gdriveDest,
      cloud_provider: form.cloudProvider,
      rclone_remote_name: form.remoteName,
      pool_tags: form.poolTags,
      ec_rules: form.ecRules,
      reasoning_template: form.reasoningTemplate,
      pool_b_ec_rules: form.poolBEcRules,
      pool_b_reasoning_template: form.poolBReasoningTemplate,
      pool_c_qa_rules: form.poolCQaRules,
      pool_c_extraction_rules: form.poolCExtractionRules
    });
    if (success) {
      onClose();
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
                <LLMConfigView activeProject={project} loadProjects={loadProjects} showToast={showToast} />
              </div>
            )}

            {/* Tab Content: Project Prompts */}
            {projectSettingsTab === 'prompts' && (
              <div className="flex-1 min-h-0 h-full">
                <PromptLibraryView projectId={project?.id || null} showToast={showToast} />
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