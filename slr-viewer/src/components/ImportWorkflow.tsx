import React, { useState, useRef } from 'react';
import { Upload, FileCheck, AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import StorageService from '../StorageService';
import { validateViewerSnapshotSafe, MINIMUM_SCHEMA_VERSION } from '../utils/schemaValidator';
import { decompressViewerData } from '../utils/compression';
import { useViewerData } from '../context/ViewerContext';
import FullscreenErrorModal from './common/FullscreenErrorModal';

export interface ImportWorkflowProps {
  onImportSuccess: (sessionId: number | string) => void;
  onCancel?: () => void;
}

export default function ImportWorkflow({ onImportSuccess, onCancel }: ImportWorkflowProps) {
  const { loadSessions, switchSession, showToast } = useViewerData();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    setInlineError(null);
    setSchemaError(null);
    if (!file.name.endsWith('.slr-viewer') && !file.name.endsWith('.json')) {
      setInlineError('Please select a valid `.slr-viewer` dataset file.');
      return;
    }
    setSelectedFile(file);
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setInlineError(null);
    setSchemaError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setInlineError(null);
    setSchemaError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        let parsed: any;
        try {
          parsed = await decompressViewerData(buffer);
        } catch (jsonErr: any) {
          setSchemaError({
            error: 'Corrupted file format: Unable to parse JSON or decompress dataset file.',
            detectedVersion: 'Invalid Payload',
            requiredVersion: MINIMUM_SCHEMA_VERSION,
            details: { rawError: jsonErr.message }
          });
          setLoading(false);
          return;
        }

        // Strict schema version & structure validation
        const validation = validateViewerSnapshotSafe(parsed);
        if (!validation.isValid) {
          setSchemaError(validation);
          setLoading(false);
          return;
        }

        const session = await StorageService.createSession(selectedFile.name, validation.data);
        await loadSessions();
        setLoading(false);
        if (session.id !== undefined) {
          await switchSession(session.id, 'insight-export-rigor');
          onImportSuccess(session.id);
        }
      } catch (err: any) {
        console.error('Import processing error:', err);
        setSchemaError({
          error: err.message || 'Failed to parse `.slr-viewer` file format.',
          detectedVersion: err.detectedVersion || 'Unknown',
          requiredVersion: MINIMUM_SCHEMA_VERSION,
          details: err.details || {}
        });
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setInlineError('Failed to read file from disk.');
      setLoading(false);
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <div className="bg-card text-card-foreground p-6 sm:p-8 flex flex-col items-center justify-center max-w-xl mx-auto w-full">
      {/* Fullscreen Schema Error Modal */}
      {schemaError && (
        <FullscreenErrorModal
          errorInfo={schemaError}
          filename={selectedFile?.name || 'dataset.slr-viewer'}
          onTryAnotherFile={resetUpload}
          onClose={() => setSchemaError(null)}
        />
      )}

      {/* Header Info */}
      <div className="text-center space-y-2 mb-6 select-none">
        <div className="inline-flex p-3 rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
          <Upload className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Import SLR Viewer Dataset</h2>
        <p className="text-xs text-muted-foreground max-w-md">
          Load an exported <code className="text-foreground bg-secondary px-1.5 py-0.5 rounded font-mono font-bold">.slr-viewer</code> snapshot dataset to visualize PRISMA diagrams, stage comparisons, and final cohorts.
        </p>
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <form
        className={`w-full relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
          dragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border/80 hover:border-primary/50 hover:bg-secondary/20'
        } ${selectedFile ? 'bg-secondary/40 border-primary/40' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".slr-viewer,.json"
          onChange={handleChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-xs text-foreground truncate max-w-xs">{selectedFile.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB • Click or drop to replace
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-xs text-foreground">Click to browse or drag & drop</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                Accepts *.slr-viewer snapshot files (v{MINIMUM_SCHEMA_VERSION}+)
              </p>
            </div>
          </div>
        )}
      </form>

      {/* Inline Warning Notice */}
      {inlineError && (
        <div className="mt-4 w-full p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{inlineError}</span>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between w-full mt-6 gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        ) : <div />}

        <button
          type="button"
          onClick={processFile}
          disabled={!selectedFile || loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/10 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying & Ingesting...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Open & Present</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
