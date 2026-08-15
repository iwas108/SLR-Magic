import React from 'react';
import { X, FolderPlus, RefreshCw, Folder, Cloud, BookOpen, Target, ShieldAlert, Sparkles } from 'lucide-react';
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
      goldmine_dest_path: form.goldmineDest,
      cloud_provider: form.cloudProvider,
      rclone_remote_name: form.remoteName,
      pool_tags: form.poolTags
    });
    if (success) {
      form.resetForm();
      onClose();
    }
  };

  const handleCancel = () => {
    form.resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
      <div className="relative bg-card/95 border border-border/80 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 backdrop-blur-xl">
        {/* Top Decorative Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-10" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/70 bg-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                Instantiate New Project Scope
                <span className="flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  <Sparkles className="w-3 h-3" /> FAIR Compliant
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">Define review objectives, cloud mirroring parameters, and calibration pool bounds.</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors hover:bg-secondary/60"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Project Identity & Folder Slug */}
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Folder className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Project Identification</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => form.handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold shadow-inner"
                  placeholder="e.g. Predictive AI in Digital Twins"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Repository Slug <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[9px] text-muted-foreground/80 font-mono">auto-generated</span>
                </div>
                <input
                  type="text"
                  required
                  value={form.folderName}
                  onChange={(e) => form.handleFolderNameChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold font-mono shadow-inner"
                  placeholder="predictive_ai_in_digital_twins"
                />
                <p className="text-[9px] text-muted-foreground mt-1">Directory in <code className="font-mono text-[9px] bg-secondary/60 px-1 py-0.5 rounded">pdf_library/repo/&lt;slug&gt;</code></p>
              </div>
            </div>
          </div>

          {/* Section 2: Cloud Synchronization */}
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <Cloud className="w-4 h-4 text-blue-400" />
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Cloud Mirror &amp; Storage</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Provider</label>
                <select
                  value={form.cloudProvider}
                  onChange={(e) => form.setCloudProvider(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer shadow-inner"
                >
                  <option value="gdrive">Google Drive</option>
                  <option value="onedrive">Microsoft OneDrive</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rclone Remote</label>
                <input
                  type="text"
                  value={form.remoteName}
                  onChange={(e) => form.setRemoteName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono shadow-inner"
                  placeholder={form.cloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Destination Path</label>
                <input
                  type="text"
                  value={form.gdriveDest}
                  onChange={(e) => form.setGdriveDest(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold shadow-inner"
                  placeholder="SLR_Magic/PDFs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Review Protocol Formulation */}
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <BookOpen className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Protocol Scope &amp; Questions</h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Manifesto</label>
                <textarea
                  rows={2}
                  value={form.manifesto}
                  onChange={(e) => form.setManifesto(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold shadow-inner leading-relaxed"
                  placeholder="Summary of the systematic review scope and core questions..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Objective</label>
                <textarea
                  rows={2}
                  value={form.objective}
                  onChange={(e) => form.setObjective(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold shadow-inner leading-relaxed"
                  placeholder="Core goals, hypotheses, and evidence syntheses..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Questions (RQs)</label>
                <textarea
                  rows={3}
                  value={form.questions}
                  onChange={(e) => form.setQuestions(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono shadow-inner leading-relaxed"
                  placeholder="RQ1: What machine learning architectures are utilized?&#10;RQ2: What performance metrics evaluate system latency?"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Boundary & Exclusion Criteria */}
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border border-border/60">
            <div className="flex items-center gap-2 pb-1 border-b border-border/40">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Quality Appraisal &amp; Exclusion</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Quality Assurance Definition</label>
                <textarea
                  rows={2}
                  value={form.qaDefinition}
                  onChange={(e) => form.setQaDefinition(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold shadow-inner leading-relaxed"
                  placeholder="QA1: Does the paper present empirical benchmarks?&#10;QA2: Is the dataset accessible?"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exclusion Criteria (EC Rules)</label>
                <textarea
                  rows={2}
                  value={form.exclusionCriteria}
                  onChange={(e) => form.setExclusionCriteria(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold shadow-inner leading-relaxed"
                  placeholder="EC1: Non-English publication&#10;EC2: Abstract-only or poster presentation"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Calibration Pool Target Bounds */}
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border border-border/60">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-500" />
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Pre-Calibration Pool Targets</h4>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">Statistical Calibration Sample</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-background/60 p-2.5 rounded-lg border border-border/70 text-center">
                <label className="block text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Pool A Target</label>
                <input
                  type="number"
                  value={form.poolA}
                  onChange={(e) => form.setPoolA(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
                <span className="text-[8px] text-muted-foreground mt-0.5 block">Fast Filter</span>
              </div>

              <div className="bg-background/60 p-2.5 rounded-lg border border-border/70 text-center">
                <label className="block text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1">Pool B Target</label>
                <input
                  type="number"
                  value={form.poolB}
                  onChange={(e) => form.setPoolB(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
                <span className="text-[8px] text-muted-foreground mt-0.5 block">Consensus</span>
              </div>

              <div className="bg-background/60 p-2.5 rounded-lg border border-border/70 text-center">
                <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Pool C Target</label>
                <input
                  type="number"
                  value={form.poolC}
                  onChange={(e) => form.setPoolC(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
                <span className="text-[8px] text-muted-foreground mt-0.5 block">Consensus + QA</span>
              </div>

              <div className="bg-background/60 p-2.5 rounded-lg border border-border/70 text-center">
                <label className="block text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Rolling Batch</label>
                <input
                  type="number"
                  value={form.rollingBatchSize}
                  onChange={(e) => form.setRollingBatchSize(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
                />
                <span className="text-[8px] text-muted-foreground mt-0.5 block">Post-Validation</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-border/70 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2.5 bg-secondary/80 text-foreground hover:bg-secondary border border-border/80 font-bold rounded-xl text-xs transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingProject || !form.name.trim() || !form.folderName.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {savingProject ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FolderPlus className="w-4 h-4" />
              )}
              Create Project Scope
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}