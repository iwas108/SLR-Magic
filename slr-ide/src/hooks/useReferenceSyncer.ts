'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { 
  GlobalScanSummary, 
  ScannedFileResult, 
  CitationOccurrence, 
  CitationStatus,
  BibDatabaseStatus
} from '@/lib/services/reference-syncer-types';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

export interface ExportedSyncedFile {
  originalName: string;
  syncedName: string;
  content: string;
  replacementsCount: number;
  sizeBytes: number;
}

export function useReferenceSyncer(
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void,
  projectId?: string
) {
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scanSummary, setScanSummary] = useState<GlobalScanSummary | null>(null);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<'ALL' | CitationStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // BibTeX Database Status & Auto-Reload state
  const [bibStatus, setBibStatus] = useState<BibDatabaseStatus | null>(null);
  const [isReloadingBib, setIsReloadingBib] = useState(false);
  const [hasBibChangedSinceScan, setHasBibChangedSinceScan] = useState(false);

  // Per-file overrides: fileName -> originalKey -> targetReplacementKey
  const [manualOverrides, setManualOverrides] = useState<Record<string, Record<string, string>>>({});
  
  // Per-file ignored keys: fileName -> Array of originalKeys
  const [ignoredKeys, setIgnoredKeys] = useState<Record<string, string[]>>({});

  const [diffModalFile, setDiffModalFile] = useState<ScannedFileResult | null>(null);
  const [exportedFiles, setExportedFiles] = useState<ExportedSyncedFile[] | null>(null);

  /**
   * Fetch current status of db/references.bib
   */
  const checkBibStatus = useCallback(async (silent = true) => {
    try {
      const res = await fetch('/api/reference-syncer/bib');
      const data = await res.json();
      if (data.success && data.status) {
        setBibStatus(prev => {
          if (prev && (prev.mtimeMs !== data.status.mtimeMs || prev.sizeBytes !== data.status.sizeBytes)) {
            if (!silent) {
              showToast(`db/references.bib updated on disk (${data.status.totalEntries} entries)`, 'info');
            }
            setHasBibChangedSinceScan(true);
          }
          return data.status;
        });
      }
    } catch (e) {
      if (!silent) console.error('[useReferenceSyncer] Failed to fetch bib status:', e);
    }
  }, [showToast]);

  const checkBibStatusRef = useRef(checkBibStatus);
  checkBibStatusRef.current = checkBibStatus;

  /**
   * Force reload references.bib from disk
   */
  const reloadBibDatabase = useCallback(async () => {
    setIsReloadingBib(true);
    try {
      const res = await fetch('/api/reference-syncer/bib?reload=true');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reload references.bib');
      }
      setBibStatus(data.status);
      showToast(`db/references.bib reloaded: ${data.status?.totalEntries || 0} entries`, 'success');
      broadcastSync('SYNC_REFERENCES_BIB');

      // If files are already loaded, trigger re-scan with fresh bibData
      if (uploadedFiles.length > 0) {
        await scanFiles(uploadedFiles);
        setHasBibChangedSinceScan(false);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error reloading references.bib', 'error');
    } finally {
      setIsReloadingBib(false);
    }
  }, [uploadedFiles, showToast]);

  /**
   * Direct file upload to replace db/references.bib
   */
  const uploadAndReplaceBib = useCallback(async (file: File) => {
    setIsReloadingBib(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/reference-syncer/bib', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to replace references.bib');
      }
      setBibStatus(data.status);
      showToast(`db/references.bib replaced: ${data.totalEntries} entries`, 'success');
      broadcastSync('SYNC_REFERENCES_BIB');

      if (uploadedFiles.length > 0) {
        await scanFiles(uploadedFiles);
        setHasBibChangedSinceScan(false);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error replacing references.bib', 'error');
    } finally {
      setIsReloadingBib(false);
    }
  }, [uploadedFiles, showToast]);

  // Window Focus listener: Detects external file changes as soon as user returns to app
  useEffect(() => {
    checkBibStatusRef.current(true);

    const onFocus = () => {
      checkBibStatusRef.current(false);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  // Cross-tab BroadcastChannel listener
  useEffect(() => {
    const unsubscribe = subscribeSyncChannel((type) => {
      if (type === 'SYNC_REFERENCES_BIB') {
        checkBibStatusRef.current(false);
      }
    });
    return unsubscribe;
  }, []);

  // Server-Sent Events listener for real-time fs.watch push updates
  useEffect(() => {
    let evtSource: EventSource | null = null;
    try {
      evtSource = new EventSource('/api/events');
      evtSource.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'BIB_DATABASE_UPDATED') {
            checkBibStatusRef.current(false);
          }
        } catch (e) {
          // ignore non-json
        }
      };
    } catch (err) {
      // EventSource fallback
    }

    return () => {
      if (evtSource) evtSource.close();
    };
  }, []);

  /**
   * Process raw file array by sending to /api/reference-syncer/scan
   */
  const scanFiles = useCallback(async (files: { name: string; content: string }[]) => {
    if (files.length === 0) return;
    setIsScanning(true);
    setExportedFiles(null);
    try {
      const res = await fetch('/api/reference-syncer/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, projectId })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan files');
      }

      setScanSummary(data.summary);
      setUploadedFiles(files);
      setActiveFileIndex(0);
      setHasBibChangedSinceScan(false);
      checkBibStatusRef.current(true);
      showToast(`Scanned ${files.length} file(s) across ${data.bibCount || 0} references`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error scanning files', 'error');
    } finally {
      setIsScanning(false);
    }
  }, [projectId, showToast]);

  /**
   * Upload user files via drag-and-drop or input
   */
  const handleFilesUpload = useCallback(async (fileList: FileList | File[]) => {
    const filesArray = Array.from(fileList);
    const texFiles = filesArray.filter(f => f.name.endsWith('.tex') || f.name.endsWith('.txt') || f.name.endsWith('.latex'));

    if (texFiles.length === 0) {
      showToast('Please select at least one .tex file to scan', 'warning');
      return;
    }

    const readFiles: { name: string; content: string }[] = [];
    for (const f of texFiles) {
      const text = await f.text();
      readFiles.push({ name: f.name, content: text });
    }

    await scanFiles(readFiles);
  }, [scanFiles, showToast]);

  /**
   * One-click loader for sample .tex files from tmp/
   */
  const handleLoadSampleFiles = useCallback(async () => {
    setIsScanning(true);
    setExportedFiles(null);
    try {
      const url = projectId 
        ? `/api/reference-syncer/scan?sample=true&projectId=${encodeURIComponent(projectId)}`
        : '/api/reference-syncer/scan?sample=true';
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load sample files');
      }

      setScanSummary(data.summary);
      const mappedFiles = (data.summary?.files || []).map((f: any) => ({
        name: f.fileName,
        content: f.processedContent || ''
      }));
      setUploadedFiles(mappedFiles);
      setActiveFileIndex(0);
      setHasBibChangedSinceScan(false);
      checkBibStatusRef.current(true);
      showToast(`Loaded and scanned ${data.summary?.totalFiles || 0} sample files from tmp/`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error loading sample files', 'error');
    } finally {
      setIsScanning(false);
    }
  }, [projectId, showToast]);

  /**
   * Manual override of a replacement key (pass null or empty string to reset)
   */
  const handleSetOverride = useCallback((fileName: string, originalKey: string, newTargetKey: string | null) => {
    const trimmed = newTargetKey ? newTargetKey.trim() : '';
    setManualOverrides(prev => {
      const fileMap = { ...(prev[fileName] || {}) };
      if (!trimmed) {
        delete fileMap[originalKey];
      } else {
        fileMap[originalKey] = trimmed;
      }
      return {
        ...prev,
        [fileName]: fileMap
      };
    });
    if (!trimmed) {
      showToast(`Reset override for "${originalKey}"`, 'info');
    } else {
      showToast(`Replacement updated for "${originalKey}"`, 'info');
    }
  }, [showToast]);

  /**
   * Reset a manual override back to default
   */
  const handleResetOverride = useCallback((fileName: string, originalKey: string) => {
    handleSetOverride(fileName, originalKey, null);
  }, [handleSetOverride]);

  /**
   * Toggle ignoring a replacement (leaving it untouched)
   */
  const handleToggleIgnore = useCallback((fileName: string, originalKey: string) => {
    setIgnoredKeys(prev => {
      const current = prev[fileName] || [];
      const isAlreadyIgnored = current.includes(originalKey);
      const updated = isAlreadyIgnored
        ? current.filter(k => k !== originalKey)
        : [...current, originalKey];
      return {
        ...prev,
        [fileName]: updated
      };
    });
  }, []);

  /**
   * Current active file result
   */
  const activeFileResult = useMemo<ScannedFileResult | null>(() => {
    if (!scanSummary || !scanSummary.files || scanSummary.files.length === 0) return null;
    return scanSummary.files[activeFileIndex] || scanSummary.files[0];
  }, [scanSummary, activeFileIndex]);

  /**
   * Filtered citations list for active file
   */
  const filteredCitations = useMemo<CitationOccurrence[]>(() => {
    if (!activeFileResult) return [];
    const fileOverrides = manualOverrides[activeFileResult.fileName] || {};
    const fileIgnored = ignoredKeys[activeFileResult.fileName] || [];

    return activeFileResult.citations
      .map(c => ({
        ...c,
        userOverride: fileOverrides[c.originalKey] !== undefined ? fileOverrides[c.originalKey] : null,
        isIgnored: fileIgnored.includes(c.originalKey)
      }))
      .filter(c => {
        if (activeFilter !== 'ALL' && c.status !== activeFilter) return false;
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          const matchesOrig = c.originalKey.toLowerCase().includes(s);
          const matchesRepl = (c.replacementKey || '').toLowerCase().includes(s);
          const matchesSnippet = c.contextSnippet.toLowerCase().includes(s);
          const matchesReason = c.matchReason.toLowerCase().includes(s);
          return matchesOrig || matchesRepl || matchesSnippet || matchesReason;
        }
        return true;
      });
  }, [activeFileResult, activeFilter, searchTerm, manualOverrides, ignoredKeys]);

  /**
   * Compute finalized synchronized content for a specific file
   */
  const getFileSyncedContent = useCallback((fileRes: ScannedFileResult): { content: string; replacementsCount: number } => {
    const fileOverrides = manualOverrides[fileRes.fileName] || {};
    const fileIgnored = ignoredKeys[fileRes.fileName] || [];

    const effectiveMap: Record<string, string> = {};
    for (const c of fileRes.citations) {
      if (fileIgnored.includes(c.originalKey)) continue;

      if (fileOverrides[c.originalKey]) {
        if (fileOverrides[c.originalKey] !== c.originalKey) {
          effectiveMap[c.originalKey] = fileOverrides[c.originalKey];
        }
      } else if (c.status === 'RESOLVED' && c.replacementKey && c.replacementKey !== c.originalKey) {
        effectiveMap[c.originalKey] = c.replacementKey;
      }
    }

    // Original file content
    const orig = uploadedFiles.find(f => f.name === fileRes.fileName)?.content || fileRes.processedContent;
    
    // Replace citations safely
    const syncedContent = orig.replace(
      /\\([a-zA-Z*]*cite[a-zA-Z*]*)((?:\s*\[[^\]]*\])*)\s*\{([^}]+)\}/g,
      (fullMatch, cmd, optArgs, rawKeys) => {
        const keys = rawKeys.split(',');
        let hasChanges = false;
        const newKeys = keys.map((rawK: string) => {
          const k = rawK.trim();
          if (effectiveMap[k]) {
            hasChanges = true;
            return rawK.replace(k, effectiveMap[k]);
          }
          return rawK;
        });
        return hasChanges ? `\\${cmd}${optArgs}{${newKeys.join(',')}}` : fullMatch;
      }
    );

    return {
      content: syncedContent,
      replacementsCount: Object.keys(effectiveMap).length
    };
  }, [manualOverrides, ignoredKeys, uploadedFiles]);

  /**
   * Prepares export data and generates downloadable files
   */
  const prepareExport = useCallback(async () => {
    if (!scanSummary) return;
    setIsExporting(true);

    try {
      const payloadFiles = scanSummary.files.map(fileRes => {
        const fileOverrides = manualOverrides[fileRes.fileName] || {};
        const fileIgnored = ignoredKeys[fileRes.fileName] || [];
        const replacements: Record<string, string> = {};

        for (const c of fileRes.citations) {
          if (fileIgnored.includes(c.originalKey)) continue;
          if (fileOverrides[c.originalKey]) {
            if (fileOverrides[c.originalKey] !== c.originalKey) {
              replacements[c.originalKey] = fileOverrides[c.originalKey];
            }
          } else if (c.status === 'RESOLVED' && c.replacementKey && c.replacementKey !== c.originalKey) {
            replacements[c.originalKey] = c.replacementKey;
          }
        }

        const origContent = uploadedFiles.find(f => f.name === fileRes.fileName)?.content || fileRes.processedContent;

        return {
          name: fileRes.fileName,
          content: origContent,
          replacements
        };
      });

      const res = await fetch('/api/reference-syncer/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payloadFiles })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to export synchronized files');

      setExportedFiles(data.exportedFiles);
      showToast(`Ready! ${data.exportedFiles.length} file(s) generated for download`, 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Error exporting files', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [scanSummary, manualOverrides, ignoredKeys, uploadedFiles, showToast]);

  /**
   * Direct download for a single file
   */
  const downloadSingleFile = useCallback((file: ExportedSyncedFile) => {
    try {
      const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.syncedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${file.syncedName}`, 'success');
    } catch (err) {
      showToast(`Failed to download ${file.syncedName}`, 'error');
    }
  }, [showToast]);

  /**
   * Download all files sequentially
   */
  const downloadAllFiles = useCallback(() => {
    if (!exportedFiles || exportedFiles.length === 0) return;
    exportedFiles.forEach((f, idx) => {
      setTimeout(() => {
        downloadSingleFile(f);
      }, idx * 250);
    });
    showToast(`Downloading all ${exportedFiles.length} files...`, 'info');
  }, [exportedFiles, downloadSingleFile, showToast]);

  /**
   * Export execution summary report in Markdown or JSON
   */
  const exportSummaryReport = useCallback((format: 'markdown' | 'json' = 'markdown') => {
    if (!scanSummary) return;

    let content = '';
    let fileName = `reference_sync_summary_${new Date().toISOString().slice(0, 10)}`;

    if (format === 'markdown') {
      fileName += '.md';
      content = `# Reference Syncer Execution Summary Report\n\n`;
      content += `Date: ${new Date().toLocaleString()}\n`;
      content += `Total Files Scanned: ${scanSummary.totalFiles}\n`;
      content += `Total Citations: ${scanSummary.totalCitations}\n`;
      content += `Exact Matches (In Bib): ${scanSummary.exactMatches}\n`;
      content += `Auto-Resolved Replacements: ${scanSummary.resolvedReplacements}\n`;
      content += `Ambiguous Citations: ${scanSummary.ambiguousCitations}\n`;
      content += `Missing from Bib: ${scanSummary.missingFromBib}\n`;
      content += `Suspicious / In-Text Findings: ${scanSummary.suspiciousFindingsCount}\n\n`;

      content += `## File-by-File Breakdown\n\n`;
      content += `| File Name | Total Citations | Replaced | Preserved | Ambiguous | Missing | Suspicious Findings |\n`;
      content += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
      for (const f of scanSummary.files) {
        content += `| \`${f.fileName}\` | ${f.stats.total} | ${f.stats.replaced} | ${f.stats.exact} | ${f.stats.ambiguous} | ${f.stats.missing} | ${f.suspiciousFindings.length} |\n`;
      }
    } else {
      fileName += '.json';
      content = JSON.stringify(scanSummary, null, 2);
    }

    const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${fileName}`, 'success');
  }, [scanSummary, showToast]);

  const reset = useCallback(() => {
    setUploadedFiles([]);
    setScanSummary(null);
    setManualOverrides({});
    setIgnoredKeys({});
    setExportedFiles(null);
    setActiveFileIndex(0);
  }, []);

  return {
    uploadedFiles,
    isScanning,
    isExporting,
    scanSummary,
    activeFileIndex,
    setActiveFileIndex,
    activeFileResult,
    activeFilter,
    setActiveFilter,
    searchTerm,
    setSearchTerm,
    manualOverrides,
    ignoredKeys,
    filteredCitations,
    diffModalFile,
    setDiffModalFile,
    exportedFiles,
    handleFilesUpload,
    handleLoadSampleFiles,
    handleSetOverride,
    handleResetOverride,
    handleToggleIgnore,
    getFileSyncedContent,
    prepareExport,
    downloadSingleFile,
    downloadAllFiles,
    exportSummaryReport,
    bibStatus,
    isReloadingBib,
    hasBibChangedSinceScan,
    reloadBibDatabase,
    uploadAndReplaceBib,
    checkBibStatus,
    reset
  };
}
