import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet, X, Download, Check, CheckSquare, Square,
  Search, ShieldCheck, Database, Layers, Sparkles, Filter,
  FileText, ArrowRight, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';

export interface ColumnDefinition {
  key: string;
  label: string;
  category: 'ingestion' | 'metadata' | 'screening' | 'appraisal';
  description: string;
  isIngestionHubDefault?: boolean;
}

export const AVAILABLE_COLUMNS: ColumnDefinition[] = [
  // Ingestion Hub Standard Core (14 Columns)
  { key: 'Paper_ID', label: 'Paper ID', category: 'ingestion', description: 'Deterministic unique paper identifier', isIngestionHubDefault: true },
  { key: 'Import_Date', label: 'Import Date', category: 'ingestion', description: 'Date of paper ingestion (YYYY-MM-DD)', isIngestionHubDefault: true },
  { key: 'Import_Source', label: 'Import Source', category: 'ingestion', description: 'Origin file name or ingest source batch', isIngestionHubDefault: true },
  { key: 'Source', label: 'Source Database', category: 'ingestion', description: 'Academic search database (Scopus, IEEE, etc.)', isIngestionHubDefault: true },
  { key: 'DOI', label: 'DOI', category: 'ingestion', description: 'Digital Object Identifier', isIngestionHubDefault: true },
  { key: 'Title', label: 'Title', category: 'ingestion', description: 'Complete title of research paper', isIngestionHubDefault: true },
  { key: 'Abstract', label: 'Abstract', category: 'ingestion', description: 'Full text abstract', isIngestionHubDefault: true },
  { key: 'Authors', label: 'Authors', category: 'ingestion', description: 'Author names (semicolon-delimited)', isIngestionHubDefault: true },
  { key: 'Year', label: 'Year', category: 'ingestion', description: 'Publication year', isIngestionHubDefault: true },
  { key: 'PDF_Link', label: 'PDF Link', category: 'ingestion', description: 'External or cloud repository PDF link', isIngestionHubDefault: true },
  { key: 'Status', label: 'Status (PDF Status)', category: 'ingestion', description: 'Local PDF state (MATCHED, DOWNLOADED, SYNCED, IGNORED)', isIngestionHubDefault: true },
  { key: 'Original_Publisher', label: 'Original Publisher', category: 'ingestion', description: 'Raw publisher string from indexing source', isIngestionHubDefault: true },
  { key: 'Publisher', label: 'Publisher (Normalized)', category: 'ingestion', description: 'Standardized canonical publisher name', isIngestionHubDefault: true },
  { key: 'citation_count', label: 'Citation Count', category: 'ingestion', description: 'Citation count metrics from indexing service', isIngestionHubDefault: true },

  // Additional Metadata & Lineage
  { key: 'Parent_Paper_ID', label: 'Parent Paper ID', category: 'metadata', description: 'Snowballing parent paper reference identifier' },
  { key: 'Local_PDF_Path', label: 'Local PDF Path', category: 'metadata', description: 'Relative filesystem path to cached/downloaded PDF' },
  { key: 'notes', label: 'Notes', category: 'metadata', description: 'Reviewer manual annotations & comments' },

  // Screening Pipeline & Decisions
  { key: 'Stage', label: 'Effective Stage', category: 'screening', description: 'Highest completed stage (MAX of manual & AI stage)' },
  { key: 'Decision', label: 'Effective Decision', category: 'screening', description: 'Active stage-dominant screening decision' },
  { key: 'manual_stage', label: 'Manual Stage', category: 'screening', description: 'Manual reviewer completed stage number' },
  { key: 'manual_decision', label: 'Manual Decision', category: 'screening', description: 'Manual reviewer decision (INCLUDE, EXCLUDE)' },
  { key: 'manual_exclusion_code', label: 'Manual Exclusion Code', category: 'screening', description: 'Exclusion criteria trigger assigned by reviewer' },
  { key: 'manual_rationale', label: 'Manual Rationale', category: 'screening', description: 'Human screening justification notes' },
  { key: 'ai_stage', label: 'AI Stage', category: 'screening', description: 'AI automated screening completed stage number' },
  { key: 'ai_decision', label: 'AI Decision', category: 'screening', description: 'AI automated screening decision (INCLUDE, EXCLUDE)' },
  { key: 'ai_exclusion_code', label: 'AI Exclusion Code', category: 'screening', description: 'Exclusion criteria trigger identified by AI' },
  { key: 'ai_rationale', label: 'AI Rationale', category: 'screening', description: 'AI generated decision reasoning' },

  // Structured Appraisal & Calibration
  { key: 'manual_quality_assessment', label: 'Manual QA Scores', category: 'appraisal', description: 'Manual quality appraisal criteria evaluation (JSON)' },
  { key: 'manual_extracted_data', label: 'Manual Extracted Data', category: 'appraisal', description: 'Manual research variables extraction (JSON)' },
  { key: 'ai_quality_assessment', label: 'AI QA Scores', category: 'appraisal', description: 'AI quality appraisal evaluation (JSON)' },
  { key: 'ai_extracted_data', label: 'AI Extracted Data', category: 'appraisal', description: 'AI structured research variables extraction (JSON)' },
  { key: 'calibration_pool', label: 'Calibration Pool', category: 'appraisal', description: 'Assigned inter-rater calibration pool (Pool A/B/C)' },
  { key: 'calibration_tag', label: 'Calibration Tag', category: 'appraisal', description: 'Custom pool classification tag (Gold Standard, Anchor, Trap)' }
];

export const INGESTION_HUB_COLUMNS = AVAILABLE_COLUMNS.filter(c => c.isIngestionHubDefault).map(c => c.key);
export const MINIMAL_COLUMNS = ['Paper_ID', 'DOI', 'Title', 'Authors', 'Year', 'Source'];
export const SCREENING_COLUMNS = [
  'Paper_ID', 'Title', 'DOI', 'Stage', 'Decision',
  'manual_stage', 'manual_decision', 'manual_exclusion_code', 'manual_rationale',
  'ai_stage', 'ai_decision', 'ai_exclusion_code', 'ai_rationale'
];

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPaperIds: Set<string>;
  totalPapers: number;
  activeProjectId?: string;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function ExportCsvModal({
  isOpen,
  onClose,
  selectedPaperIds,
  totalPapers,
  activeProjectId,
  showToast
}: ExportCsvModalProps) {
  const selectedCount = selectedPaperIds.size;
  const hasSelected = selectedCount > 0;

  // Export scope: 'selected' vs 'all'
  const [exportScope, setExportScope] = useState<'selected' | 'all'>('all');
  
  // Selected columns set
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(INGESTION_HUB_COLUMNS));
  
  // Search filter for columns
  const [columnSearch, setColumnSearch] = useState('');
  
  // Active category filter tab: 'all' | 'ingestion' | 'metadata' | 'screening' | 'appraisal'
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Loading state
  const [isExporting, setIsExporting] = useState(false);

  // Sync default scope on modal open
  React.useEffect(() => {
    if (isOpen) {
      setExportScope(hasSelected ? 'selected' : 'all');
      setSelectedColumns(new Set(INGESTION_HUB_COLUMNS));
      setColumnSearch('');
      setActiveCategory('all');
    }
  }, [isOpen, hasSelected]);

  // Check if current selection matches Ingestion Hub preset exactly
  const isIngestionHubPreset = useMemo(() => {
    if (selectedColumns.size !== INGESTION_HUB_COLUMNS.length) return false;
    return INGESTION_HUB_COLUMNS.every(col => selectedColumns.has(col));
  }, [selectedColumns]);

  // Preset handlers
  const applyPreset = (preset: 'ingestion_hub' | 'all' | 'minimal' | 'screening') => {
    if (preset === 'ingestion_hub') {
      setSelectedColumns(new Set(INGESTION_HUB_COLUMNS));
    } else if (preset === 'all') {
      setSelectedColumns(new Set(AVAILABLE_COLUMNS.map(c => c.key)));
    } else if (preset === 'minimal') {
      setSelectedColumns(new Set(MINIMAL_COLUMNS));
    } else if (preset === 'screening') {
      setSelectedColumns(new Set(SCREENING_COLUMNS));
    }
  };

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      filteredColumns.forEach(c => next.add(c.key));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedColumns(prev => {
      const next = new Set(prev);
      filteredColumns.forEach(c => next.delete(c.key));
      return next;
    });
  };

  // Filter columns by category and search
  const filteredColumns = useMemo(() => {
    return AVAILABLE_COLUMNS.filter(col => {
      const matchesCategory = activeCategory === 'all' || col.category === activeCategory;
      const matchesSearch = 
        col.key.toLowerCase().includes(columnSearch.toLowerCase()) ||
        col.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
        col.description.toLowerCase().includes(columnSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, columnSearch]);

  const targetPaperCount = exportScope === 'selected' ? selectedCount : totalPapers;

  // Handle CSV Generation & Download
  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      showToast?.('Please select at least one column to export', 'warning');
      return;
    }

    if (exportScope === 'selected' && selectedCount === 0) {
      showToast?.('No papers selected in the database table', 'warning');
      return;
    }

    setIsExporting(true);
    try {
      const payload: any = {
        projectId: activeProjectId,
        scope: exportScope,
        columns: Array.from(selectedColumns)
      };

      if (exportScope === 'selected') {
        payload.paperIds = Array.from(selectedPaperIds);
      }

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate CSV export');
      }

      // Resolve attachment filename from header or fallback
      const disposition = res.headers.get('Content-Disposition');
      let filename = `papers_export_${exportScope}_${new Date().toISOString().split('T')[0]}.csv`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast?.(`Exported ${targetPaperCount} papers with ${selectedColumns.size} columns successfully!`, 'success');
      onClose();
    } catch (err: any) {
      console.error('Export CSV Error:', err);
      showToast?.(err.message || 'Export failed', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">Export Papers to CSV</h3>
                {isIngestionHubPreset && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Ingestion Hub Ready
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Configure paper export scope and column selection for Ingestion Hub or custom analysis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors bg-secondary/50 hover:bg-secondary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* STEP 1: Export Scope Selection */}
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              1. Select Export Scope
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Selected Papers Only */}
              <button
                type="button"
                onClick={() => hasSelected && setExportScope('selected')}
                disabled={!hasSelected}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
                  !hasSelected
                    ? 'opacity-50 cursor-not-allowed bg-secondary/10 border-border/50'
                    : exportScope === 'selected'
                    ? 'bg-primary/10 border-primary shadow-sm'
                    : 'bg-secondary/20 border-border hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-foreground flex items-center gap-2">
                    <CheckSquare className={`w-4 h-4 ${exportScope === 'selected' ? 'text-primary' : 'text-muted-foreground'}`} />
                    Selected Papers Only
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    hasSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {selectedCount} selected
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {hasSelected
                    ? `Export only the ${selectedCount} paper(s) currently checked in the database table.`
                    : 'No papers currently checked. Select checkboxes in the table to enable this option.'}
                </p>
              </button>

              {/* Option B: All Project Papers */}
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  exportScope === 'all'
                    ? 'bg-primary/10 border-primary shadow-sm'
                    : 'bg-secondary/20 border-border hover:bg-secondary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-foreground flex items-center gap-2">
                    <Database className={`w-4 h-4 ${exportScope === 'all' ? 'text-primary' : 'text-muted-foreground'}`} />
                    All Project Papers
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-foreground border border-border">
                    {totalPapers} total
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Export all {totalPapers} bibliography papers contained in the active project.
                </p>
              </button>
            </div>
          </div>

          {/* STEP 2: Quick Column Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                2. Quick Presets
              </label>
              <span className="text-[11px] font-semibold text-foreground">
                <strong className="text-primary">{selectedColumns.size}</strong> of {AVAILABLE_COLUMNS.length} columns selected
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('ingestion_hub')}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isIngestionHubPreset
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 ring-1 ring-emerald-500/30'
                    : 'bg-secondary/30 text-foreground border-border hover:bg-secondary/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Ingestion Hub Preset (14)
              </button>

              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  selectedColumns.size === AVAILABLE_COLUMNS.length
                    ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/30'
                    : 'bg-secondary/30 text-foreground border-border hover:bg-secondary/60'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-primary" />
                All Columns ({AVAILABLE_COLUMNS.length})
              </button>

              <button
                type="button"
                onClick={() => applyPreset('minimal')}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  selectedColumns.size === MINIMAL_COLUMNS.length && MINIMAL_COLUMNS.every(c => selectedColumns.has(c))
                    ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/30'
                    : 'bg-secondary/30 text-foreground border-border hover:bg-secondary/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Minimal Bibliographic (6)
              </button>

              <button
                type="button"
                onClick={() => applyPreset('screening')}
                className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  selectedColumns.size === SCREENING_COLUMNS.length && SCREENING_COLUMNS.every(c => selectedColumns.has(c))
                    ? 'bg-primary/15 text-primary border-primary/30 ring-1 ring-primary/30'
                    : 'bg-secondary/30 text-foreground border-border hover:bg-secondary/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Screening Decisions (13)
              </button>
            </div>

            {/* Ingestion Hub Compatibility Banner */}
            {isIngestionHubPreset && (
              <div className="mt-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">100% Ingestion Hub Compatible:</span>
                  <p className="text-[11px] text-emerald-400/90 mt-0.5">
                    This file adheres directly to the <code className="font-mono text-emerald-300">00_Raw_Harvest</code> schema. It can be directly re-imported into SLR-IDE Ingestion Hub or Google Sheets without requiring manual column mapping.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Granular Column Selection */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                3. Customize Export Columns
              </label>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Select All
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={deselectAllFiltered}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
                >
                  Deselect All
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={() => applyPreset('ingestion_hub')}
                  className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset to Ingestion Preset
                </button>
              </div>
            </div>

            {/* Filter toolbar: Category tabs & search input */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-secondary/15 p-2 rounded-lg border border-border/50">
              <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All Columns' },
                  { id: 'ingestion', label: 'Ingestion Core' },
                  { id: 'metadata', label: 'Metadata' },
                  { id: 'screening', label: 'Screening & Decisions' },
                  { id: 'appraisal', label: 'Appraisal & Calibration' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCategory(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      activeCategory === tab.id
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter columns..."
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-secondary/50 border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Columns Checkbox Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 border border-border/60 rounded-xl bg-secondary/10">
              {filteredColumns.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-muted-foreground/60" />
                  No columns matching "{columnSearch}"
                </div>
              ) : (
                filteredColumns.map(col => {
                  const isChecked = selectedColumns.has(col.key);
                  return (
                    <div
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`p-2.5 rounded-lg border cursor-pointer select-none transition-all flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-primary/10 border-primary/40 text-foreground'
                          : 'bg-secondary/20 border-border/40 hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-foreground truncate font-mono">
                            {col.key}
                          </span>
                          {col.isIngestionHubDefault && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-400 shrink-0">
                              Hub
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {col.description}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-secondary/25 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Exporting:</span>
            <strong className="text-foreground font-semibold">
              {targetPaperCount} {targetPaperCount === 1 ? 'paper' : 'papers'}
            </strong>
            <span>•</span>
            <strong className="text-foreground font-semibold">
              {selectedColumns.size} {selectedColumns.size === 1 ? 'column' : 'columns'}
            </strong>
            <span className="text-[11px] text-muted-foreground">
              ({exportScope === 'selected' ? 'Selected subset' : 'Full project database'})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-4 py-2 bg-secondary text-foreground border border-border hover:bg-secondary/80 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || selectedColumns.size === 0 || targetPaperCount === 0}
              className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating CSV...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export CSV ({targetPaperCount})
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
