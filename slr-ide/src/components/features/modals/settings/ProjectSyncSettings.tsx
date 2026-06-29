import React from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

interface ProjectSyncSettingsProps {
  form: {
    projectFormCloudProvider: string;
    setProjectFormCloudProvider: (v: string) => void;
    projectFormRemoteName: string;
    setProjectFormRemoteName: (v: string) => void;
    projectFormGDriveDest: string;
    setProjectFormGDriveDest: (v: string) => void;
  };
  testingProjectConnection: boolean;
  projectConnectionTestResult: { success: boolean; message: string; details?: string } | null;
  handleTestProjectConnection: (provider: string, remoteName: string) => void;
}

export default function ProjectSyncSettings({
  form,
  testingProjectConnection,
  projectConnectionTestResult,
  handleTestProjectConnection
}: ProjectSyncSettingsProps) {
  return (
    <div className="space-y-4">
      <div className="bg-secondary/15 border border-border rounded-lg p-4 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
        <p className="font-bold text-foreground">Sync Guidelines:</p>
        <p>Configuring these properties enables the Rclone background synchronizer to link database entries and push/pull cached resources to and from cloud storage.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Provider</label>
          <select
            value={form.projectFormCloudProvider}
            onChange={(e) => form.setProjectFormCloudProvider(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold cursor-pointer"
          >
            <option value="gdrive">Google Drive</option>
            <option value="onedrive">Microsoft OneDrive</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Rclone Remote Name</label>
          <input
            type="text"
            value={form.projectFormRemoteName}
            onChange={(e) => form.setProjectFormRemoteName(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono"
            placeholder={form.projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cloud Destination Path</label>
        <input
          type="text"
          value={form.projectFormGDriveDest}
          onChange={(e) => form.setProjectFormGDriveDest(e.target.value)}
          className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
          placeholder="e.g. SLR_Magic/PDFs"
          required
        />
      </div>

      {/* Connection Test and Setup Help */}
      <div className="pt-2 border-t border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={testingProjectConnection}
            onClick={() => handleTestProjectConnection(form.projectFormCloudProvider, form.projectFormRemoteName)}
            className="px-3.5 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {testingProjectConnection ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Test Connection
          </button>

          {projectConnectionTestResult && (
            <div className={`flex-1 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              projectConnectionTestResult.success 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                : 'bg-destructive/10 text-destructive border-destructive/25'
            }`}>
              {projectConnectionTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{projectConnectionTestResult.message}</span>
            </div>
          )}
        </div>

        {projectConnectionTestResult && !projectConnectionTestResult.success && projectConnectionTestResult.details && (
          <div className="text-[11px] font-mono bg-destructive/5 text-destructive/95 p-2.5 rounded-lg border border-destructive/10 whitespace-pre-wrap max-h-24 overflow-y-auto">
            {projectConnectionTestResult.details}
          </div>
        )}

        <div className="bg-secondary/10 border border-border/40 rounded-lg p-3 text-[11px] text-muted-foreground leading-relaxed space-y-1">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <span>Need help setting up?</span>
          </p>
          <p>To set up a cloud provider remote, install Rclone on your system, run <code className="bg-secondary/50 px-1 py-0.5 rounded font-mono text-foreground">rclone config</code> in your terminal, and create a remote named <code className="bg-secondary/50 px-1 py-0.5 rounded font-mono text-foreground">{form.projectFormRemoteName || (form.projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive')}</code>.</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 font-semibold text-primary">
            <a 
              href={form.projectFormCloudProvider === 'onedrive' ? "https://rclone.org/onedrive/" : "https://rclone.org/drive/"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline flex items-center gap-0.5 inline-flex"
            >
              <span>Rclone {form.projectFormCloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'} Setup Guide</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a 
              href="https://rclone.org/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline flex items-center gap-0.5 inline-flex"
            >
              <span>rclone.org</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
