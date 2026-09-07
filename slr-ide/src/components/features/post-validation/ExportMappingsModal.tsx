'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Download, FileSpreadsheet, FileJson, CheckCircle2, Loader2, Table, Sparkles, Layers } from 'lucide-react';

interface ExportMappingsModalProps {
  projectId: string;
  extractedKeys: string[];
  mappingsByKey: Record<string, Record<string, { umbrella_category: string; justification: string }>>;
  initialKey?: string | null;
  onClose: () => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ExportMappingsModal({
  projectId,
  extractedKeys,
  mappingsByKey,
  initialKey,
  onClose,
  showToast
}: ExportMappingsModalProps) {
  const [selectedKey, setSelectedKey] = useState<string>(initialKey || 'all');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [projectQuestions, setProjectQuestions] = useState('');

  // Fetch project questions for human-readable labels
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.project) {
          setProjectQuestions(data.project.research_questions || data.project.questions || '');
        }
      })
      .catch((err) => console.error('Failed to load project details for export:', err));
  }, [projectId]);

  // Helper to map research question label
  const getMappedResearchQuestion = (key: string) => {
    if (!projectQuestions) return key.replace('rq', 'RQ').replace(/_/g, ' ');
    const lines = projectQuestions.split('\n').map((l) => l.trim()).filter(Boolean);
    const match = key.match(/^rq(\d+)(?:_?([a-z])(?![a-z]))?/i);
    if (!match) return key.replace('rq', 'RQ').replace(/_/g, ' ');

    const num = match[1] + (match[2] || '');
    const targetPrefix = `rq${num}`.toLowerCase();
    const targetPrefix2 = `rq ${num}`.toLowerCase();


    const found = lines.find((line) => {
      const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
    });
    return found || key.replace('rq', 'RQ').replace(/_/g, ' ');
  };

  // Keys that actually have successful mappings
  const mappedKeys = useMemo(() => {
    return extractedKeys.filter((k) => mappingsByKey[k] && Object.keys(mappingsByKey[k]).length > 0);
  }, [extractedKeys, mappingsByKey]);

  // Statistics calculation for live summary
  const summaryStats = useMemo(() => {
    const activeKeys = selectedKey === 'all' ? mappedKeys : [selectedKey].filter((k) => mappingsByKey[k]);
    let totalTokens = 0;
    activeKeys.forEach((k) => {
      const map = mappingsByKey[k] || {};
      totalTokens += Object.keys(map).length;
    });
    return {
      variableCount: activeKeys.length,
      tokenCount: totalTokens
    };
  }, [selectedKey, mappedKeys, mappingsByKey]);

  const handleExport = async (targetFormat?: 'csv' | 'json') => {
    const fmt = targetFormat || format;
    setIsExporting(true);
    try {
      let url = `/api/umbrellanizer/export?projectId=${encodeURIComponent(projectId)}&format=${fmt}`;
      if (selectedKey && selectedKey !== 'all') {
        url += `&key=${encodeURIComponent(selectedKey)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Export failed with HTTP ${res.status}`);
      }

      // Read response as Blob and trigger browser file download
      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') || '';
      const match = contentDisposition.match(/filename="?([^";]+)"?/i);
      const fallbackName = `umbrellanizer_mappings_${projectId}_${selectedKey}.${fmt}`;
      const filename = match ? match[1] : fallbackName;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast?.(`Successfully exported taxonomy mappings (${filename})`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Export mappings error:', err);
      showToast?.(err.message || 'Failed to export mappings', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Export Taxonomy Mappings</h3>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Export raw-to-umbrella category mappings with justifications and literature prevalence for SLR methodology reporting.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {mappedKeys.length === 0 ? (
            <div className="p-6 bg-secondary/20 border border-border/80 rounded-xl text-center space-y-2">
              <Layers className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <h4 className="font-bold text-xs text-foreground">No Mapped Variables Found</h4>
              <p className="text-[11px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                None of your extracted variables have completed an Umbrellanizer taxonomy induction run yet. Please run Umbrellanizer on at least one variable first.
              </p>
            </div>
          ) : (
            <>
              {/* Scope Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Scope (Variables to Export):</span>
                  <span className="text-[10px] text-muted-foreground font-mono font-semibold">
                    {mappedKeys.length} mapped variable{mappedKeys.length !== 1 ? 's' : ''} available
                  </span>
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full bg-secondary/35 border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="all">All Mapped Variables ({mappedKeys.length} variables)</option>
                  {mappedKeys.map((k) => (
                    <option key={k} value={k}>
                      {getMappedResearchQuestion(k)} ({Object.keys(mappingsByKey[k] || {}).length} terms)
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Selection Cards */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  Export File Format:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* CSV Option */}
                  <div
                    onClick={() => setFormat('csv')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                      format === 'csv'
                        ? 'bg-primary/10 border-primary shadow-sm text-foreground'
                        : 'bg-secondary/15 border-border hover:bg-secondary/30 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                        <FileSpreadsheet className={`w-4 h-4 ${format === 'csv' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span>CSV Spreadsheet</span>
                      </div>
                      {format === 'csv' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      Formatted table with UTF-8 BOM for Microsoft Excel, Google Sheets, or manuscript appendixes.
                    </p>
                  </div>

                  {/* JSON Option */}
                  <div
                    onClick={() => setFormat('json')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                      format === 'json'
                        ? 'bg-primary/10 border-primary shadow-sm text-foreground'
                        : 'bg-secondary/15 border-border hover:bg-secondary/30 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                        <FileJson className={`w-4 h-4 ${format === 'json' ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span>JSON Structured Data</span>
                      </div>
                      {format === 'json' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      FAIR-compliant hierarchical payload containing metadata, variable groups, justifications, and paper IDs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Summary HUD Box */}
              <div className="bg-secondary/20 border border-border/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Selected Scope:</span>
                  <span className="font-bold text-foreground font-mono">
                    {selectedKey === 'all' ? 'All Mapped Variables' : selectedKey}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Total Variables Included:</span>
                  <span className="font-bold text-foreground font-mono">{summaryStats.variableCount}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Total Raw Terms Mapped:</span>
                  <span className="font-bold text-primary font-mono">{summaryStats.tokenCount} terms</span>
                </div>
                <div className="pt-2 border-t border-border/60">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                    Export Schema Columns:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['Variable Key', 'Research Question', 'Raw Value', 'Umbrellanizer Value', 'Justification', 'Occurrences', 'Paper IDs'].map(
                      (col) => (
                        <span
                          key={col}
                          className="px-1.5 py-0.5 rounded bg-card border border-border text-[9px] font-mono text-muted-foreground"
                        >
                          {col}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-secondary/10">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isExporting || mappedKeys.length === 0}
              onClick={() => handleExport(format)}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-primary/20 transition-all disabled:opacity-40 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download {format.toUpperCase()}
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
