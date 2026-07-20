import React from 'react';
import { X, Plus, RefreshCw } from 'lucide-react';
import { useProjectForm } from '@/hooks/useProjectForm';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (projectData: any) => Promise<boolean>;
  savingProject: boolean;
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreateProject,
  savingProject
}: CreateProjectModalProps) {
  const form = useProjectForm();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onCreateProject({
      name: form.name,
      folder_name: form.folderName,
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
      cloud_provider: form.cloudProvider,
      rclone_remote_name: form.remoteName,
      pool_tags: form.poolTags
    });
    if (success) {
      form.resetForm();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-primary" />
            Create New Project Scope
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => form.setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                placeholder="e.g. SLR Magic Validation"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Unique Folder Name (Slug) *</label>
              <input
                type="text"
                required
                value={form.folderName}
                onChange={(e) => form.setFolderName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                placeholder="e.g. slr_magic_validation"
              />
              <p className="text-[8px] text-muted-foreground mt-0.5">Used for specialized pdf_library/repo folder</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Destination Path</label>
              <input
                type="text"
                value={form.gdriveDest}
                onChange={(e) => form.setGdriveDest(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                placeholder="SLR_Magic/PDFs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Provider</label>
              <select
                value={form.cloudProvider}
                onChange={(e) => form.setCloudProvider(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
              >
                <option value="gdrive">Google Drive</option>
                <option value="onedrive">Microsoft OneDrive</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Remote Name</label>
              <input
                type="text"
                value={form.remoteName}
                onChange={(e) => form.setRemoteName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
                placeholder={form.cloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Manifesto</label>
            <textarea
              rows={2}
              value={form.manifesto}
              onChange={(e) => form.setManifesto(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
              placeholder="What is this systematic literature review about?"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Objective</label>
            <textarea
              rows={2}
              value={form.objective}
              onChange={(e) => form.setObjective(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
              placeholder="What are the key goals and objectives?"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Questions</label>
            <textarea
              rows={2}
              value={form.questions}
              onChange={(e) => form.setQuestions(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
              placeholder="RQ1: ...&#10;RQ2: ..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Quality Assurance Definition</label>
              <textarea
                rows={2}
                value={form.qaDefinition}
                onChange={(e) => form.setQaDefinition(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                placeholder="Define QA check bounds..."
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exclusion Criteria</label>
              <textarea
                rows={2}
                value={form.exclusionCriteria}
                onChange={(e) => form.setExclusionCriteria(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                placeholder="What papers must be discarded?"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="block text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2">Pre-Calibration Pools Target Size</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool A Target</label>
                <input
                  type="number"
                  value={form.poolA}
                  onChange={(e) => form.setPoolA(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool B Target</label>
                <input
                  type="number"
                  value={form.poolB}
                  onChange={(e) => form.setPoolB(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Pool C Target</label>
                <input
                  type="number"
                  value={form.poolC}
                  onChange={(e) => form.setPoolC(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rolling Batch</label>
                <input
                  type="number"
                  value={form.rollingBatchSize}
                  onChange={(e) => form.setRollingBatchSize(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-end gap-3">
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
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}