import React, { useState } from 'react';
import { Upload, FileCheck, AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import StorageService from '../StorageService';
import { normalizeViewerSnapshot } from '../utils/schemaMigration';

export default function ImportWorkflow({ onImportSuccess, onCancel }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    setError(null);
    if (!file.name.endsWith('.slr-viewer') && !file.name.endsWith('.json')) {
      setError('Please select a valid `.slr-viewer` dataset file.');
      return;
    }
    setSelectedFile(file);
  };

  const processFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const parsed = JSON.parse(text);

        // Run central schema validation & normalization
        const normalized = normalizeViewerSnapshot(parsed);

        const session = await StorageService.createSession(selectedFile.name, normalized);
        setLoading(false);
        onImportSuccess(session.id);
      } catch (err) {
        console.error('Import processing error:', err);
        setError(err.message || 'Failed to parse `.slr-viewer` file format.');
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError('Error reading file from disk.');
      setLoading(false);
    };

    reader.readAsText(selectedFile);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Import SLR Viewer Dataset</h2>
          <p className="text-xs text-muted-foreground">
            Select or drag & drop a `.slr-viewer` snapshot file exported from SLR IDE.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-6">
        {/* Drag and drop zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive
              ? 'border-primary bg-primary/5'
              : selectedFile
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-border hover:border-primary/50 bg-secondary/30'
          }`}
        >
          <input
            type="file"
            id="file-upload"
            accept=".slr-viewer,.json"
            onChange={handleChange}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <label
                htmlFor="file-upload"
                className="inline-block text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                Choose a different file
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-foreground text-sm">
                  Drag & Drop `.slr-viewer` file here
                </div>
                <div className="text-xs text-muted-foreground mt-1">or browse from your device</div>
              </div>
              <label
                htmlFor="file-upload"
                className="inline-block px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs rounded-lg cursor-pointer transition-colors border border-border"
              >
                Browse File
              </label>
            </div>
          )}
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-xs text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Import Failed</div>
              <div className="mt-0.5 opacity-90">{error}</div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={processFile}
            disabled={!selectedFile || loading}
            className="flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Parsing Dataset...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Import & Open Viewer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
