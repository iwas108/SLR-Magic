import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Database,
  Bookmark,
  Plus,
  Search,
  Upload,
  Download,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Layers,
  BarChart2,
  FolderPlus,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Eye
} from 'lucide-react';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import type { VisualizerPresetPayload, SavedChart } from '../../types';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

export interface ChartLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  currentPresetPayload: VisualizerPresetPayload;
  onLoadPreset: (payload: VisualizerPresetPayload) => void;
  isViewerMode?: boolean;
  viewerSavedCharts?: SavedChart[];
  onViewerSaveChart?: (chart: SavedChart) => void;
  onViewerDeleteChart?: (id: string) => void;
}

const EMPTY_SAVED_CHARTS: SavedChart[] = [];

export function ChartLibraryModal({
  isOpen,
  onClose,
  projectId,
  currentPresetPayload,
  onLoadPreset,
  isViewerMode = false,
  viewerSavedCharts = EMPTY_SAVED_CHARTS,
  onViewerSaveChart,
  onViewerDeleteChart
}: ChartLibraryModalProps) {
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Chart Form State
  const [isSavingNew, setIsSavingNew] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Legacy JSON File Input Ref
  const legacyFileInputRef = useRef<HTMLInputElement>(null);

  // Mutable refs to prevent infinite re-render loops and stale closures (AGENTS.md Rule 3.3)
  const isFetchingRef = useRef<boolean>(false);
  const viewerSavedChartsRef = useRef<SavedChart[]>(viewerSavedCharts);
  viewerSavedChartsRef.current = viewerSavedCharts;

  // Auto-clear notification after 4s
  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  // Fetch saved charts from database or viewer props
  const fetchCharts = useCallback(async () => {
    if (!isOpen || isFetchingRef.current) return;

    if (isViewerMode) {
      // Load from viewer snapshot and localStorage
      let localSaved: SavedChart[] = [];
      let deletedIds = new Set<string>();
      try {
        const deletedStored = localStorage.getItem(`slr_viewer_deleted_charts_${projectId}`);
        if (deletedStored) {
          const parsedDel = JSON.parse(deletedStored);
          if (Array.isArray(parsedDel)) {
            deletedIds = new Set(parsedDel);
          }
        }
      } catch (e) {
        console.error('Failed to parse viewer deleted charts:', e);
      }

      try {
        const stored = localStorage.getItem(`slr_viewer_saved_charts_${projectId}`);
        if (stored) {
          localSaved = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to parse viewer local saved charts:', e);
      }

      // Merge viewer snapshot charts with local additions (avoid duplicate IDs, filter deleted)
      const mergedMap = new Map<string, SavedChart>();
      (viewerSavedChartsRef.current || []).forEach(c => {
        if (!deletedIds.has(c.id)) mergedMap.set(c.id, c);
      });
      localSaved.forEach(c => {
        if (!deletedIds.has(c.id)) mergedMap.set(c.id, c);
      });
      setCharts(Array.from(mergedMap.values()).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      return;
    }

    // SLR-IDE Database Fetch
    isFetchingRef.current = true;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/charts?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.charts)) {
        setCharts(data.charts);
      } else {
        setCharts([]);
      }
    } catch (err: any) {
      console.error('Failed to load saved charts from database:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load charts from database' });
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [isOpen, isViewerMode, projectId]);

  const fetchChartsRef = useRef(fetchCharts);
  fetchChartsRef.current = fetchCharts;

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCharts();
      setIsSavingNew(false);
      setNewTitle('');
      setNewDescription('');
    }
  }, [isOpen, fetchCharts]);

  // Multi-Tab Agnostic Broadcast Channel Synchronization (Rule 3.3)
  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeSyncChannel((type) => {
      if (type === 'SYNC_CHARTS') {
        fetchChartsRef.current();
      }
    });
    return () => unsub();
  }, [isOpen]);

  // Sync snapshot charts in viewer mode if props change
  useEffect(() => {
    if (isOpen && isViewerMode) {
      fetchChartsRef.current();
    }
  }, [isOpen, isViewerMode, viewerSavedCharts]);

  // Save current studio state as new chart
  const handleSaveCurrentChart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter a chart title' });
      return;
    }

    setIsSubmitting(true);
    const activeChartType = currentPresetPayload.slots?.slot_a?.chartType || 'bar_vertical';
    const activeLayoutMode = currentPresetPayload.layoutMode || 'single';

    try {
      if (isViewerMode) {
        // Save in viewer local storage
        const newChart: SavedChart = {
          id: `chart-viewer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          project_id: projectId,
          title: newTitle.trim(),
          description: newDescription.trim(),
          chart_type: activeChartType,
          layout_mode: activeLayoutMode,
          config_payload: JSON.stringify(currentPresetPayload),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (onViewerSaveChart) {
          onViewerSaveChart(newChart);
        } else {
          // Fallback to localStorage directly
          const stored = localStorage.getItem(`slr_viewer_saved_charts_${projectId}`);
          const list: SavedChart[] = stored ? JSON.parse(stored) : [];
          list.unshift(newChart);
          localStorage.setItem(`slr_viewer_saved_charts_${projectId}`, JSON.stringify(list));
        }

        setCharts(prev => [newChart, ...prev]);
        setIsSavingNew(false);
        setNewTitle('');
        setNewDescription('');
        setStatusMessage({ type: 'success', text: `Saved "${newChart.title}" to local viewer library` });
      } else {
        // Save in SLR-IDE centralized SQLite database
        const res = await fetch('/api/charts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            title: newTitle.trim(),
            description: newDescription.trim(),
            chartType: activeChartType,
            layoutMode: activeLayoutMode,
            configPayload: currentPresetPayload
          })
        });

        const data = await res.json();
        if (data.success && data.chart) {
          setCharts(prev => [data.chart, ...prev.filter(c => c.id !== data.chart.id)]);
          setIsSavingNew(false);
          setNewTitle('');
          setNewDescription('');
          setStatusMessage({ type: 'success', text: `Saved "${data.chart.title}" to centralized database` });
          broadcastSync('SYNC_CHARTS');
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Failed to save chart' });
        }
      }
    } catch (err: any) {
      console.error('Save chart failed:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save chart' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Overwrite existing saved chart with current studio setup
  const handleOverwriteChart = async (chart: SavedChart) => {
    if (!confirm(`Overwrite "${chart.title}" with current studio customizations?`)) return;

    const activeChartType = currentPresetPayload.slots?.slot_a?.chartType || chart.chart_type;
    const activeLayoutMode = currentPresetPayload.layoutMode || chart.layout_mode;

    try {
      if (isViewerMode) {
        const updatedChart: SavedChart = {
          ...chart,
          chart_type: activeChartType,
          layout_mode: activeLayoutMode,
          config_payload: JSON.stringify(currentPresetPayload),
          updated_at: new Date().toISOString()
        };

        if (onViewerSaveChart) {
          onViewerSaveChart(updatedChart);
        } else {
          const stored = localStorage.getItem(`slr_viewer_saved_charts_${projectId}`);
          let list: SavedChart[] = stored ? JSON.parse(stored) : [];
          list = list.map(c => c.id === chart.id ? updatedChart : c);
          localStorage.setItem(`slr_viewer_saved_charts_${projectId}`, JSON.stringify(list));
        }

        try {
          const deletedStored = localStorage.getItem(`slr_viewer_deleted_charts_${projectId}`);
          if (deletedStored) {
            const list: string[] = JSON.parse(deletedStored);
            const nextList = list.filter(id => id !== chart.id);
            localStorage.setItem(`slr_viewer_deleted_charts_${projectId}`, JSON.stringify(nextList));
          }
        } catch (e) {}

        setCharts(prev => prev.map(c => c.id === chart.id ? updatedChart : c));
        setStatusMessage({ type: 'success', text: `Updated "${chart.title}"` });
      } else {
        const res = await fetch('/api/charts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: chart.id,
            projectId,
            title: chart.title,
            description: chart.description,
            chartType: activeChartType,
            layoutMode: activeLayoutMode,
            configPayload: currentPresetPayload
          })
        });
        const data = await res.json();
        if (data.success && data.chart) {
          setCharts(prev => prev.map(c => c.id === chart.id ? data.chart : c));
          setStatusMessage({ type: 'success', text: `Updated "${chart.title}" in database` });
          broadcastSync('SYNC_CHARTS');
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update chart' });
    }
  };

  // Delete saved chart
  const handleDeleteChart = async (chart: SavedChart) => {
    if (!confirm(`Are you sure you want to delete "${chart.title}" from the library?`)) return;

    try {
      if (isViewerMode) {
        // Record deleted chart ID in tombstone list so snapshot charts don't resurrect
        try {
          const deletedStored = localStorage.getItem(`slr_viewer_deleted_charts_${projectId}`);
          const deletedList: string[] = deletedStored ? JSON.parse(deletedStored) : [];
          if (!deletedList.includes(chart.id)) {
            deletedList.push(chart.id);
            localStorage.setItem(`slr_viewer_deleted_charts_${projectId}`, JSON.stringify(deletedList));
          }
        } catch (e) {
          console.error('Failed to save viewer deleted charts tombstone:', e);
        }

        if (onViewerDeleteChart) {
          onViewerDeleteChart(chart.id);
        }
        const stored = localStorage.getItem(`slr_viewer_saved_charts_${projectId}`);
        if (stored) {
          const list: SavedChart[] = JSON.parse(stored);
          const filtered = list.filter(c => c.id !== chart.id);
          localStorage.setItem(`slr_viewer_saved_charts_${projectId}`, JSON.stringify(filtered));
        }
        setCharts(prev => prev.filter(c => c.id !== chart.id));
        setStatusMessage({ type: 'success', text: `Deleted "${chart.title}"` });
      } else {
        const res = await fetch(`/api/charts?id=${encodeURIComponent(chart.id)}&projectId=${encodeURIComponent(projectId)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          setCharts(prev => prev.filter(c => c.id !== chart.id));
          setStatusMessage({ type: 'success', text: `Deleted "${chart.title}" from database` });
          broadcastSync('SYNC_CHARTS');
        } else {
          setStatusMessage({ type: 'error', text: data.error || 'Failed to delete chart' });
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete chart' });
    }
  };

  // Import Legacy JSON Preset into Database / Library
  const handleImportLegacyJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rawContent = evt.target?.result as string;
        const parsed: VisualizerPresetPayload = JSON.parse(rawContent);

        // Derive title from filename or preset
        const baseFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const derivedTitle = baseFileName.charAt(0).toUpperCase() + baseFileName.slice(1);
        const activeChartType = parsed.slots?.slot_a?.chartType || parsed.chartType || 'bar_vertical';
        const activeLayoutMode = parsed.layoutMode || 'single';

        if (isViewerMode) {
          const importedChart: SavedChart = {
            id: `chart-legacy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            project_id: projectId,
            title: derivedTitle,
            description: `Imported from legacy JSON: ${file.name}`,
            chart_type: activeChartType,
            layout_mode: activeLayoutMode,
            config_payload: rawContent,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          if (onViewerSaveChart) {
            onViewerSaveChart(importedChart);
          } else {
            const stored = localStorage.getItem(`slr_viewer_saved_charts_${projectId}`);
            const list: SavedChart[] = stored ? JSON.parse(stored) : [];
            list.unshift(importedChart);
            localStorage.setItem(`slr_viewer_saved_charts_${projectId}`, JSON.stringify(list));
          }

          setCharts(prev => [importedChart, ...prev]);
          setStatusMessage({ type: 'success', text: `Imported "${derivedTitle}" into library` });
          // Also offer to load it immediately
          onLoadPreset(parsed);
          onClose();
        } else {
          const res = await fetch('/api/charts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              title: derivedTitle,
              description: `Imported from legacy JSON: ${file.name}`,
              chartType: activeChartType,
              layoutMode: activeLayoutMode,
              configPayload: parsed
            })
          });
          const data = await res.json();
          if (data.success && data.chart) {
            setCharts(prev => [data.chart, ...prev]);
            setStatusMessage({ type: 'success', text: `Imported "${derivedTitle}" into database library` });
            broadcastSync('SYNC_CHARTS');
            onLoadPreset(parsed);
            onClose();
          } else {
            setStatusMessage({ type: 'error', text: data.error || 'Failed to import legacy JSON' });
          }
        }
      } catch (err: any) {
        alert('Invalid JSON preset format.');
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (e.target) e.target.value = '';
  };

  // Load a saved chart into studio
  const handleLoadChart = (chart: SavedChart) => {
    try {
      const payload: VisualizerPresetPayload = JSON.parse(chart.config_payload);
      onLoadPreset(payload);
      onClose();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Failed to parse chart payload' });
    }
  };

  // Export a saved chart as legacy JSON (for file backup/interoperability)
  const handleExportLegacyJson = (chart: SavedChart) => {
    try {
      const blob = new Blob([chart.config_payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chart.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}-preset.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Export failed' });
    }
  };

  // Filtered charts list
  const filteredCharts = useMemo(() => {
    if (!searchQuery.trim()) return charts;
    const q = searchQuery.toLowerCase();
    return charts.filter(c => 
      c.title.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      c.chart_type.toLowerCase().includes(q) ||
      (CHART_TYPES_INFO[c.chart_type as keyof typeof CHART_TYPES_INFO]?.name || '').toLowerCase().includes(q)
    );
  }, [charts, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Project Chart Library
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Check className="w-2.5 h-2.5" />
                  FAIR Compliant
                </span>
                {isViewerMode ? (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">
                    Viewer Snapshot
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                    Centralized SQLite Database
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved charts are stored centrally with project metadata for reproducible publication synthesis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchCharts}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
              title="Refresh charts list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {statusMessage && (
          <div className={`px-6 py-2 text-xs font-bold flex items-center justify-between border-b ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
          }`}>
            <span>{statusMessage.text}</span>
            <button onClick={() => setStatusMessage(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar & Save New Form */}
        <div className="p-4 sm:px-6 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search saved charts by title, description, chart type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary/60 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Save Current Studio Setup Button */}
            <button
              type="button"
              onClick={() => setIsSavingNew(!isSavingNew)}
              className="px-3 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Save Current Setup</span>
            </button>

            {/* Import Legacy JSON Button */}
            <button
              type="button"
              onClick={() => legacyFileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs transition-all flex items-center gap-1.5"
              title="Import legacy .json preset file into centralized library"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>Import Legacy JSON</span>
            </button>

            <input
              ref={legacyFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportLegacyJson}
            />
          </div>
        </div>

        {/* Save Current Studio Form Drawer */}
        {isSavingNew && (
          <form onSubmit={handleSaveCurrentChart} className="px-6 py-4 bg-primary/5 border-b border-primary/20 flex flex-col gap-3 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                Save Active Studio Setup to Library
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {currentPresetPayload.layoutMode?.toUpperCase()} • {currentPresetPayload.slots?.slot_a?.chartType || 'Chart'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">Chart Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RQ3a Edge Hardware Distribution"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">Description / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Horizontal bar showing 46 study cohort papers across 8 categories"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-1">
              <button
                type="button"
                onClick={() => setIsSavingNew(false)}
                className="px-3 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save to Library'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Charts Grid List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background/50">
          {isLoading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-medium">Loading saved charts from database...</span>
            </div>
          ) : filteredCharts.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center p-6 text-center">
              <div className="p-3 rounded-full bg-secondary/80 text-muted-foreground mb-3">
                <BarChart2 className="w-8 h-8 opacity-60" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {searchQuery ? 'No matching charts found' : 'No saved charts yet'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {searchQuery 
                  ? `No charts matched "${searchQuery}". Try a different search query.` 
                  : 'Save your active chart customization to the database library or import from legacy JSON.'}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setIsSavingNew(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Current Setup Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCharts.map((chart) => {
                const chartInfo = CHART_TYPES_INFO[chart.chart_type as keyof typeof CHART_TYPES_INFO];
                let parsedConfig: VisualizerPresetPayload | null = null;
                try {
                  parsedConfig = JSON.parse(chart.config_payload);
                } catch (e) {}

                const slotA = parsedConfig?.slots?.slot_a;
                const slotB = parsedConfig?.slots?.slot_b;
                const formattedDate = new Date(chart.updated_at).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div
                    key={chart.id}
                    className="p-4 rounded-xl border border-border/70 bg-card hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Row: Chart Type & Layout Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <BarChart2 className="w-2.5 h-2.5" />
                            {chartInfo?.name || chart.chart_type}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-muted-foreground text-[10px] font-mono uppercase">
                            {chart.layout_mode}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formattedDate}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {chart.title}
                      </h4>
                      {chart.description ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {chart.description}
                        </p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground/60 mt-1">
                          No description provided
                        </p>
                      )}

                      {/* Slot breakdown chip */}
                      {slotA && (
                        <div className="mt-3 p-2 rounded-lg bg-secondary/40 border border-border/40 text-[10px] text-muted-foreground flex flex-col gap-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">
                              Slot A: {CHART_TYPES_INFO[slotA.chartType as keyof typeof CHART_TYPES_INFO]?.name || slotA.chartType}
                            </span>
                            <span className="font-mono text-[9px] text-primary">
                              {slotA.primaryField || 'Unassigned'}
                            </span>
                          </div>
                          {slotB && chart.layout_mode !== 'single' && (
                            <div className="flex items-center justify-between border-t border-border/40 pt-0.5 mt-0.5">
                              <span className="font-semibold text-foreground">
                                Slot B: {CHART_TYPES_INFO[slotB.chartType as keyof typeof CHART_TYPES_INFO]?.name || slotB.chartType}
                              </span>
                              <span className="font-mono text-[9px] text-primary">
                                {slotB.primaryField || 'Unassigned'}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadChart(chart)}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                        title="Load this saved chart configuration into the studio"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Load into Studio</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOverwriteChart(chart)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors border border-border/40"
                          title="Overwrite this saved chart with current studio settings"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportLegacyJson(chart)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                          title="Export as legacy JSON preset file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChart(chart)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors border border-border/40"
                          title="Delete chart from library"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-secondary/30 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
          <span>{filteredCharts.length} saved chart{filteredCharts.length === 1 ? '' : 's'} in library</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
