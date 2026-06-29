import React, { useState } from 'react';
import { Settings, X, RefreshCw } from 'lucide-react';
import LLMConfigView from '../LLMConfigView';
import PromptLibraryView from '../PromptLibraryView';
import ProjectMetadataSettings from './settings/ProjectMetadataSettings';
import ProjectCalibrationSettings from './settings/ProjectCalibrationSettings';
import ProjectSyncSettings from './settings/ProjectSyncSettings';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: any[];
  editingProjectId: string | null;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  form: {
    projectFormName: string;
    setProjectFormName: (v: string) => void;
    projectFormManifesto: string;
    setProjectFormManifesto: (v: string) => void;
    projectFormObjective: string;
    setProjectFormObjective: (v: string) => void;
    projectFormQuestions: string;
    setProjectFormQuestions: (v: string) => void;
    projectFormQaDefinition: string;
    setProjectFormQaDefinition: (v: string) => void;
    projectFormExclusionCriteria: string;
    setProjectFormExclusionCriteria: (v: string) => void;
    projectFormPoolA: string;
    setProjectFormPoolA: (v: string) => void;
    projectFormPoolB: string;
    setProjectFormPoolB: (v: string) => void;
    projectFormPoolC: string;
    setProjectFormPoolC: (v: string) => void;
    projectFormGDriveDest: string;
    setProjectFormGDriveDest: (v: string) => void;
    projectFormCloudProvider: string;
    setProjectFormCloudProvider: (v: string) => void;
    projectFormRemoteName: string;
    setProjectFormRemoteName: (v: string) => void;
    
    // Pool configurations
    projectFormPoolTags: any[];
    handleAddPoolTag: () => void;
    handleUpdatePoolTag: (idx: number, field: string, val: string) => void;
    handleRemovePoolTag: (idx: number) => void;
    
    projectFormPoolBEcRules: any[];
    projectFormEcRules: any[];
    handleAddPoolBEcRule: () => void;
    handleUpdatePoolBEcRule: (idx: number, field: string, val: string) => void;
    handleRemovePoolBEcRule: (idx: number) => void;
    handleAddEcRule: () => void;
    handleUpdateEcRule: (idx: number, field: string, val: string) => void;
    handleRemoveEcRule: (idx: number) => void;
    
    projectFormPoolBReasoningTemplate: string[];
    projectFormReasoningTemplate: string[];
    handleAddPoolBReasoningTemplate: () => void;
    handleUpdatePoolBReasoningTemplate: (idx: number, val: string) => void;
    handleRemovePoolBReasoningTemplate: (idx: number) => void;
    handleAddReasoningTemplate: () => void;
    handleUpdateReasoningTemplate: (idx: number, val: string) => void;
    handleRemoveReasoningTemplate: (idx: number) => void;
    
    projectFormPoolCQaRules: any[];
    handleAddPoolCQaRule: () => void;
    handleUpdatePoolCQaRule: (idx: number, field: string, val: any) => void;
    handleRemovePoolCQaRule: (idx: number) => void;
    
    projectFormPoolCExtractionRules: any[];
    handleAddPoolCExtractionRule: () => void;
    handleUpdatePoolCExtractionRule: (idx: number, field: string, val: string) => void;
    handleRemovePoolCExtractionRule: (idx: number) => void;
  };
  handleSaveProjectManifesto: (e: React.FormEvent) => void;
  savingProject: boolean;
  testingProjectConnection: boolean;
  projectConnectionTestResult: { success: boolean; message: string; details?: string } | null;
  handleTestProjectConnection: (provider: string, remoteName: string) => void;
}

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  projects,
  editingProjectId,
  loadProjects,
  showToast,
  form,
  handleSaveProjectManifesto,
  savingProject,
  testingProjectConnection,
  projectConnectionTestResult,
  handleTestProjectConnection
}: ProjectSettingsModalProps) {
  const [projectSettingsTab, setProjectSettingsTab] = useState<'metadata' | 'calibration' | 'sync' | 'llm' | 'prompts'>('metadata');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              Project Settings: <span className="text-primary">{form.projectFormName}</span>
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
              {tab === 'sync' ? 'Cloud Sync' : tab === 'llm' ? 'LLM Config' : tab}
            </button>
          ))}
        </div>

        {/* Form Container */}
        <form onSubmit={handleSaveProjectManifesto} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-6 space-y-4 flex-1">
            
            {/* Tab Content: Metadata */}
            {projectSettingsTab === 'metadata' && (
              <ProjectMetadataSettings form={form} />
            )}

            {/* Tab Content: Pre-Calibration */}
            {projectSettingsTab === 'calibration' && (
              <ProjectCalibrationSettings form={form} />
            )}

            {/* Tab Content: Sync */}
            {projectSettingsTab === 'sync' && (
              <ProjectSyncSettings
                form={form}
                testingProjectConnection={testingProjectConnection}
                projectConnectionTestResult={projectConnectionTestResult}
                handleTestProjectConnection={handleTestProjectConnection}
              />
            )}

            {/* Tab Content: LLM Configuration */}
            {projectSettingsTab === 'llm' && (
              <div className="flex-1 min-h-0 h-full">
                <LLMConfigView activeProject={projects.find((p: any) => String(p.id) === String(editingProjectId))} loadProjects={loadProjects} showToast={showToast} />
              </div>
            )}

            {/* Tab Content: Project Prompts */}
            {projectSettingsTab === 'prompts' && (
              <div className="flex-1 min-h-0 h-full">
                <PromptLibraryView projectId={editingProjectId} showToast={showToast} />
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