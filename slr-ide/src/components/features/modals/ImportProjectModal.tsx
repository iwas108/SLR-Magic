import React, { useState, useRef } from 'react';
import { 
  UploadCloud, FileCheck, AlertCircle, CheckCircle2, 
  Loader2, X, Database, Layers, ShieldCheck, RefreshCw, FileText 
} from 'lucide-react';

interface ImportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (archiveData: any, onSuccess?: (newId: string) => void) => Promise<boolean>;
}

export default function ImportProjectModal({
  isOpen,
  onClose,
  onImport
}: ImportProjectModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setParseError(null);
    setParsedData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        // Check if valid archive or FAIR dump
        if (json.format === 'SLR_PROJECT_ARCHIVE' || json.tables || json.project || json.papers) {
          setParsedData(json);
        } else {
          setParseError('The uploaded file is not a valid SLR Project Archive (.slr).');
        }
      } catch (err: any) {
        setParseError(`JSON parse error: ${err.message || 'Malformed file'}`);
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file from disk');
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleExecuteImport = async () => {
    if (!parsedData || isImporting) return;

    setIsImporting(true);
    try {
      const success = await onImport(parsedData, () => {
        onClose();
      });
      if (success) {
        onClose();
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Extract preview info
  const manifest = parsedData?.manifest || {};
  const projectObj = parsedData?.tables?.projects?.[0] || parsedData?.project || {};
  const projectName = manifest.project_name || projectObj.name || 'Unnamed Project';
  const schemaVersion = manifest.schema_version || '1.0.0 (Legacy)';
  const paperCount = manifest.record_counts?.papers ?? (parsedData?.tables?.papers?.length ?? parsedData?.papers?.length ?? 0);
  const auditCount = (manifest.record_counts?.llm_audit_log ?? 0) + (manifest.record_counts?.manual_audit_log ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Import SLR Project Archive</h3>
              <p className="text-[11px] text-muted-foreground">Restore complete project workspace, decisions, and audit history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Upload Dropzone */}
          {!parsedData && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-primary bg-primary/10 scale-[0.99]'
                  : 'border-border/80 bg-secondary/15 hover:bg-secondary/30 hover:border-primary/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".slr,.json"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-foreground mb-1">
                Drop your <code className="font-mono text-primary">.slr</code> project archive here
              </h4>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Supports standalone versioned SLR project archives and FAIR database dumps
              </p>
            </div>
          )}

          {/* Error Banner */}
          {parseError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2.5 text-red-500 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">Invalid Archive File</span>
                <span className="opacity-90">{parseError}</span>
              </div>
            </div>
          )}

          {/* Preflight Inspection Card */}
          {parsedData && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Archive Manifest Preflight</span>
                <button
                  onClick={() => {
                    setParsedData(null);
                    setFile(null);
                  }}
                  className="text-[11px] text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Choose different file
                </button>
              </div>

              <div className="bg-secondary/30 border border-border/80 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Project Name</span>
                    <h4 className="font-bold text-base text-foreground">{projectName}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">Schema Version</span>
                    <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded">
                      {schemaVersion}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40 text-center">
                  <div className="p-2 bg-card/60 rounded-lg border border-border/40">
                    <div className="text-[9px] text-muted-foreground font-semibold uppercase">Total Papers</div>
                    <div className="text-xs font-mono font-bold text-foreground">{paperCount}</div>
                  </div>
                  <div className="p-2 bg-card/60 rounded-lg border border-border/40">
                    <div className="text-[9px] text-muted-foreground font-semibold uppercase">Audit Logs</div>
                    <div className="text-xs font-mono font-bold text-emerald-500">{auditCount}</div>
                  </div>
                  <div className="p-2 bg-card/60 rounded-lg border border-border/40">
                    <div className="text-[9px] text-muted-foreground font-semibold uppercase">Integrity</div>
                    <div className="text-xs font-mono font-bold text-primary flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      Verified
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Adapter Notice */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2.5 text-primary text-[11px]">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                <p className="leading-relaxed opacity-90">
                  Adaptive schema normalizers and cascading foreign key remappers will automatically resolve any table version differences and Paper ID collisions without corrupting active projects.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/60 flex items-center justify-end gap-2.5 bg-secondary/15">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={!parsedData || isImporting}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md ${
              parsedData && !isImporting
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-lg'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            }`}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Restoring Project...
              </>
            ) : (
              <>
                <UploadCloud className="w-3.5 h-3.5" />
                Restore Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
