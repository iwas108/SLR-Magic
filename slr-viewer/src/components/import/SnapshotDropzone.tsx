import React, { useState, useRef } from 'react';
import { Upload, FileCheck, AlertTriangle, Loader2, Sparkles, FolderOpen, ArrowRight, Layers, Clock } from 'lucide-react';
import StorageService, { SessionRecord } from '../../StorageService';
import { validateViewerSnapshotSafe, MINIMUM_SCHEMA_VERSION } from '../../utils/schemaValidator';
import { decompressViewerData } from '../../utils/compression';
import { useViewerData } from '../../context/ViewerContext';
import FullscreenErrorModal from '../common/FullscreenErrorModal';

export interface SnapshotDropzoneProps {
  onSessionLoaded?: (sessionId: number | string) => void;
}

export default function SnapshotDropzone({ onSessionLoaded }: SnapshotDropzoneProps) {
  const { sessions, switchSession, showToast, loadSessions } = useViewerData();
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setInlineError(null);
    setSchemaError(null);

    if (!file.name.endsWith('.slr-viewer') && !file.name.endsWith('.json')) {
      setInlineError('Please select a valid .slr-viewer or .json snapshot dataset file.');
      return;
    }

    setLoading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        let parsed: any;
        try {
          parsed = await decompressViewerData(buffer);
        } catch (jsonErr: any) {
          setSchemaError({
            error: 'Corrupted file format: Unable to parse JSON or decompress dataset snapshot file.',
            detectedVersion: 'Invalid Payload',
            requiredVersion: MINIMUM_SCHEMA_VERSION,
            details: { rawError: jsonErr.message }
          });
          setLoading(false);
          return;
        }

        const validation = validateViewerSnapshotSafe(parsed);
        if (!validation.isValid) {
          setSchemaError(validation);
          setLoading(false);
          return;
        }

        const session = await StorageService.createSession(file.name, validation.data);
        await loadSessions();
        showToast(`Loaded review: ${session.projectName}`, 'success');

        if (session.id) {
          await switchSession(session.id, 'insight-export-rigor');
          if (onSessionLoaded) onSessionLoaded(session.id);
        }
      } catch (err: any) {
        console.error('Snapshot import error:', err);
        setInlineError(err.message || 'Failed to process snapshot dataset.');
        showToast('Import failed: ' + (err.message || 'Unknown error'), 'error');
      } finally {
        setLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setLoading(false);
      setInlineError('Error reading file from disk.');
      showToast('Error reading file from disk', 'error');
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-4xl mx-auto w-full animate-in fade-in duration-300">
      {/* Schema Error Dialog */}
      {schemaError && (
        <FullscreenErrorModal
          errorInfo={schemaError}
          onClose={() => setSchemaError(null)}
          onTryAnotherFile={() => {
            setSchemaError(null);
            fileInputRef.current?.click();
          }}
          filename="uploaded_dataset.slr-viewer"
        />
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".slr-viewer,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Drag-and-Drop Area */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-10 md:p-16 text-center cursor-pointer select-none group relative ${
          dragActive
            ? 'border-primary bg-primary/10 shadow-2xl scale-[1.01]'
            : 'border-border/80 hover:border-primary/50 bg-card/60 hover:bg-card/90 shadow-sm hover:shadow-xl'
        }`}
      >
        <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-inner">
          {loading ? (
            <Loader2 className="w-10 h-10 animate-spin" />
          ) : (
            <Upload className="w-10 h-10" />
          )}
        </div>

        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mb-3">
          Drag & Drop SLR Snapshot
        </h2>

        <p className="text-sm text-muted-foreground max-w-lg mb-6 leading-relaxed">
          Open any exported <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-primary font-bold">.slr-viewer</code> or <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-primary font-bold">.json</code> snapshot file to immediately explore scientific rigor metrics, PRISMA 2020 flowcharts, and 18 interactive ECharts cohorts.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            <span>{loading ? 'Analyzing Dataset...' : 'Browse Snapshot File'}</span>
          </button>
        </div>

        {inlineError && (
          <div className="mt-6 flex items-center gap-2 text-rose-500 text-xs font-semibold bg-rose-500/10 px-4 py-2 rounded-xl border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{inlineError}</span>
          </div>
        )}
      </div>

      {/* Recents / Quick Study Switcher Section */}
      {sessions && sessions.length > 0 && (
        <div className="w-full mt-10 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="w-4 h-4 text-primary" />
              <span>Or Continue With Previously Loaded Review ({sessions.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sessions.slice(0, 4).map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  if (session.id) {
                    switchSession(session.id, 'insight-export-rigor');
                    if (onSessionLoaded) onSessionLoaded(session.id);
                  }
                }}
                className="p-4 rounded-2xl bg-card border border-border/80 hover:border-primary/50 transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-between group"
              >
                <div className="space-y-1 min-w-0 pr-3">
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {session.projectName}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      {session.paperCount} papers
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">v{session.schemaVersion || '1.1.0'}</span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground text-muted-foreground flex items-center justify-center shrink-0 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
