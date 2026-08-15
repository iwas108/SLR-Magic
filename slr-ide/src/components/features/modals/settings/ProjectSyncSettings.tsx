import React from 'react';
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Cloud, HardDrive, ShieldCheck, HelpCircle } from 'lucide-react';

interface ProjectSyncSettingsProps {
  form: {
    projectFormCloudProvider: string;
    setProjectFormCloudProvider: (v: string) => void;
    projectFormRemoteName: string;
    setProjectFormRemoteName: (v: string) => void;
    projectFormGDriveDest: string;
    setProjectFormGDriveDest: (v: string) => void;
    projectFormGoldmineDest: string;
    setProjectFormGoldmineDest: (v: string) => void;
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
    <div className="space-y-5">
      {/* Guidance Header */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <Cloud className="w-5 h-5" />
        </div>
        <div className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
          <p className="font-bold text-foreground text-xs">Cloud Mirroring &amp; Rclone Integration</p>
          <p>
            SLR IDE leverages local Rclone processes to automatically mirror acquired PDF repositories and structured Gold Mine extracts to your cloud drive without requiring complex OAuth gateways.
          </p>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-3">
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          Cloud Storage Provider
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => form.setProjectFormCloudProvider('gdrive')}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              form.projectFormCloudProvider === 'gdrive'
                ? 'bg-emerald-500/10 border-emerald-500 text-foreground ring-1 ring-emerald-500/30'
                : 'bg-background/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs">Google Drive</div>
              <div className="text-[10px] text-muted-foreground">Default Rclone remote `gdrive`</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => form.setProjectFormCloudProvider('onedrive')}
            className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left cursor-pointer ${
              form.projectFormCloudProvider === 'onedrive'
                ? 'bg-blue-500/10 border-blue-500 text-foreground ring-1 ring-blue-500/30'
                : 'bg-background/60 border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs">Microsoft OneDrive</div>
              <div className="text-[10px] text-muted-foreground">Enterprise Rclone remote `onedrive`</div>
            </div>
          </button>
        </div>
      </div>

      {/* Rclone Remote & Paths */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <HardDrive className="w-4 h-4 text-primary" />
          <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Remote Configuration &amp; Paths</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Rclone Remote Name
            </label>
            <input
              type="text"
              value={form.projectFormRemoteName}
              onChange={(e) => form.setProjectFormRemoteName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono shadow-inner"
              placeholder={form.projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive'}
            />
            <p className="text-[9px] text-muted-foreground mt-1">Must match remote name in your <code className="font-mono">rclone.conf</code></p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Main Cloud PDF Library Path <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.projectFormGDriveDest}
              onChange={(e) => form.setProjectFormGDriveDest(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold shadow-inner"
              placeholder="e.g. SLR_Magic/PDFs"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Gold Mine Export Path (NotebookLM Destination)
          </label>
          <input
            type="text"
            value={form.projectFormGoldmineDest}
            onChange={(e) => form.setProjectFormGoldmineDest(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-semibold shadow-inner"
            placeholder="e.g. SLR_Magic/Gold_Mine (optional - defaults to Cloud Destination/Gold_Mine_Exports)"
          />
          <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
            Dedicated cloud folder for Gold Mine PDF exports. Uses the same rclone remote. Leave blank to use sub-folder under main cloud destination.
          </p>
        </div>
      </div>

      {/* Connection Test & Health Status */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Connection Health Diagnostic</h4>
          </div>
          <button
            type="button"
            disabled={testingProjectConnection}
            onClick={() => handleTestProjectConnection(form.projectFormCloudProvider, form.projectFormRemoteName)}
            className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {testingProjectConnection ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Test Cloud Remote
          </button>
        </div>

        {projectConnectionTestResult && (
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs animate-in fade-in duration-200 ${
            projectConnectionTestResult.success 
              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
              : 'bg-destructive/10 text-destructive border-destructive/25'
          }`}>
            {projectConnectionTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <div className="font-bold">{projectConnectionTestResult.message}</div>
              {projectConnectionTestResult.details && (
                <pre className="text-[10px] font-mono bg-background/60 p-2 rounded border border-border/60 text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {projectConnectionTestResult.details}
                </pre>
              )}
            </div>
          </div>
        )}

        {/* Setup Help Callout */}
        <div className="bg-secondary/20 border border-border/50 rounded-xl p-3 text-[11px] text-muted-foreground leading-relaxed space-y-2">
          <div className="font-bold text-foreground flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            <span>Rclone Setup Instructions</span>
          </div>
          <p>
            Ensure Rclone is installed on your machine and accessible in your system PATH. Run <code className="bg-secondary/70 px-1.5 py-0.5 rounded font-mono text-foreground">rclone config</code> to configure a remote named <code className="bg-secondary/70 px-1.5 py-0.5 rounded font-mono text-foreground font-bold">{form.projectFormRemoteName || (form.projectFormCloudProvider === 'onedrive' ? 'onedrive' : 'gdrive')}</code>.
          </p>
          <div className="flex flex-wrap gap-3 pt-1 font-semibold text-primary text-[10px]">
            <a 
              href={form.projectFormCloudProvider === 'onedrive' ? "https://rclone.org/onedrive/" : "https://rclone.org/drive/"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline flex items-center gap-1 bg-primary/5 px-2 py-1 rounded border border-primary/20"
            >
              <span>{form.projectFormCloudProvider === 'onedrive' ? 'OneDrive' : 'Google Drive'} Configuration Guide</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a 
              href="https://rclone.org/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:underline flex items-center gap-1 bg-primary/5 px-2 py-1 rounded border border-primary/20"
            >
              <span>Official Rclone Documentation</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
