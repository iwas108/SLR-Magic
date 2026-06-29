import React from 'react';
import { Cloud, Play, RefreshCw } from 'lucide-react';

interface RcloneSettingsTabProps {
  configs: Record<string, string>;
  showPathsHelp: boolean;
  setShowPathsHelp: React.Dispatch<React.SetStateAction<boolean>>;
  handleChange: (key: string, value: string) => void;
  testing: boolean;
  handleTestConnection: () => void;
  testResult: { success: boolean; message: string; details?: string } | null;
}

export default function RcloneSettingsTab({
  configs,
  showPathsHelp,
  setShowPathsHelp,
  handleChange,
  testing,
  handleTestConnection,
  testResult
}: RcloneSettingsTabProps) {
  return (
    <div className="space-y-6 text-xs animate-in fade-in duration-200">
      {/* Rclone Forms */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Rclone Executable Path</label>
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.RCLONE_EXECUTABLE_PATH || ''}
            onChange={(e) => handleChange('RCLONE_EXECUTABLE_PATH', e.target.value)}
            placeholder="rclone"
          />
          <p className="text-[10px] text-muted-foreground">Leave as &apos;rclone&apos; if it is in your system PATH.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground flex justify-between">
            <span>Custom rclone.conf Path (Optional)</span>
            <button 
              onClick={() => setShowPathsHelp(prev => !prev)} 
              type="button" 
              className="text-primary hover:underline font-semibold text-[10px]"
            >
              {showPathsHelp ? 'Hide Default Locations' : 'Show Default Locations'}
            </button>
          </label>
          
          {showPathsHelp && (
            <div className="bg-secondary/45 border border-border rounded-xl p-3 text-[10px] text-muted-foreground space-y-1.5 font-sans leading-relaxed animate-in fade-in duration-200">
              <p className="font-bold text-foreground">Standard Config File Paths:</p>
              <div>
                <span className="font-semibold text-foreground">Windows:</span>
                <code className="block mt-0.5 bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[9px]">C:\Users\&lt;Username&gt;\AppData\Roaming\rclone\rclone.conf</code>
              </div>
              <div>
                <span className="font-semibold text-foreground">macOS / Linux:</span>
                <code className="block mt-0.5 bg-background border border-border rounded px-1.5 py-0.5 font-mono text-[9px]">~/.config/rclone/rclone.conf</code>
              </div>
            </div>
          )}

          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
            value={configs.RCLONE_CONFIG_PATH || ''}
            onChange={(e) => handleChange('RCLONE_CONFIG_PATH', e.target.value)}
            placeholder="e.g. C:\Users\Username\AppData\Roaming\rclone\rclone.conf"
          />
          <p className="text-[10px] text-muted-foreground">Leave empty to use Rclone&apos;s default config location.</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-muted-foreground">Sync Mode</label>
          <select
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary text-xs cursor-pointer"
            value={configs.RCLONE_SYNC_MODE || 'incremental'}
            onChange={(e) => handleChange('RCLONE_SYNC_MODE', e.target.value)}
          >
            <option value="incremental">Incremental Update (rclone copy) - Safely keeps extra files on GDrive</option>
            <option value="mirror">Mirror Sync (rclone sync) - Deletes files on GDrive if they do not exist locally</option>
          </select>
          <p className="text-[10px] text-muted-foreground">Select whether to incrementally copy new files or perform a strict mirror sync.</p>
        </div>
      </div>

      {/* Connection Verification Tool */}
      <div className="border border-border/80 rounded-lg p-4 bg-secondary/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-bold text-foreground">Verify Connectivity</h4>
            <p className="text-[10px] text-muted-foreground">Test if Rclone can successfully connect to the active project's cloud remote.</p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Test Connection
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg border text-[11px] animate-in slide-in-from-top-1 ${
            testResult.success 
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' 
              : 'bg-destructive/15 border-destructive/25 text-destructive-foreground'
          }`}>
            <p className="font-bold">{testResult.success ? 'Success' : 'Connection Failed'}</p>
            <p className="mt-0.5">{testResult.message}</p>
            {testResult.details && (
              <pre className="mt-1.5 p-2 bg-background border border-border rounded font-mono text-[9px] overflow-x-auto whitespace-pre-wrap max-h-24">
                {testResult.details}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
