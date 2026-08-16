import { useState, useEffect, useCallback, useRef } from 'react';
import { broadcastSync, subscribeSyncChannel } from '@/lib/sync-utils';

export function useIngestion(
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void,
  papers: any[] = [],
  loadPapers?: () => void,
  activeProjectId?: string
) {
  // Ingestion states
  const [csvSource, setCsvSource] = useState('');
  const [csvSourceSelect, setCsvSourceSelect] = useState('IEEE Xplore');
  const [csvCustomSource, setCsvCustomSource] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportDate, setCsvImportDate] = useState('');
  
  const [manualSource, setManualSource] = useState('Backward Snowball');
  const [manualImportDate, setManualImportDate] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthors, setManualAuthors] = useState('');
  const [manualDoi, setManualDoi] = useState('');
  const [manualCitationCount, setManualCitationCount] = useState('');
  const [manualAbstract, setManualAbstract] = useState('');
  const [manualIngesting, setManualIngesting] = useState(false);
  const [manualParentPaperId, setManualParentPaperId] = useState('');
  const [manualParentSearch, setManualParentSearch] = useState('');
  const [showParentSuggestions, setShowParentSuggestions] = useState(false);
  const [parentPaperSuggestions, setParentPaperSuggestions] = useState<any[]>([]);
  const [selectedParentPaper, setSelectedParentPaper] = useState<any>(null);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewPapers, setPreviewPapers] = useState<any[]>([]);
  const [previewStats, setPreviewStats] = useState({ total: 0, newCount: 0, dupCount: 0 });
  const [importing, setImporting] = useState(false);
  const [syncCitations, setSyncCitations] = useState(false);
  const [existingHashes, setExistingHashes] = useState<{ DOI: string; Title: string }[]>([]);

  // Purge Mode States
  const [purgeMode, setPurgeMode] = useState(false);
  const [purgeCandidates, setPurgeCandidates] = useState<{ safe: any[]; processed: any[]; blocked: any[] }>({ safe: [], processed: [], blocked: [] });
  const [loadingPurgeCheck, setLoadingPurgeCheck] = useState(false);

  // We load existing hashes when the ingestion view mounts or active project changes
  const loadHashes = useCallback(async () => {
    try {
      const url = `/api/papers?onlyHashes=true${activeProjectId ? `&projectId=${encodeURIComponent(activeProjectId)}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExistingHashes(data);
      }
    } catch (err) {
      console.error('Error loading paper hashes for duplicate check:', err);
    }
  }, [activeProjectId]);

  useEffect(() => {
    loadHashes();
  }, [loadHashes]);

  // Multi-tab sync subscription
  useEffect(() => {
    const unsub = subscribeSyncChannel((syncType) => {
      if (syncType === 'SYNC_PAPERS' || syncType === 'SYNC_PROJECTS') {
        loadHashes();
      }
    });
    return unsub;
  }, [loadHashes]);

  // Filter parent paper suggestions via database query
  useEffect(() => {
    if (!manualParentSearch.trim()) {
      setParentPaperSuggestions([]);
      return;
    }

    let active = true;
    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/papers?search=${encodeURIComponent(manualParentSearch)}&limit=10`);
        if (res.ok && active) {
          const data = await res.json();
          setParentPaperSuggestions(data.papers || []);
        }
      } catch (err) {
        console.error('Error fetching parent paper suggestions:', err);
      }
    };

    // Debounce to prevent hammering database on fast typing
    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [manualParentSearch]);

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    const result: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (const line of lines) {
      if (!line.trim()) continue;
      const row: string[] = [];
      let inQuotes = false;
      let cell = '';
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(cell.trim());
          cell = '';
        } else {
          cell += char;
        }
      }
      row.push(cell.trim());
      result.push(row.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"')));
    }

    if (result.length > 0) {
      const headers = result[0];
      setCsvHeaders(headers);
      setCsvData(result.slice(1));
      
      const targetColumns = [
        'Paper_ID', 'Import_Date', 'Import_Source', 'Source', 'DOI', 'Title', 'Abstract', 'Authors', 'Year', 
        'PDF_Link', 'Status', 'Original_Publisher', 'Publisher', 'citation_count', 'Parent_Paper_ID'
      ];
      const initialMapping: Record<string, string> = {};
      
      targetColumns.forEach(col => {
        const cleanC = col.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Strict mapping exceptions
        if (col === 'PDF_Link') {
          initialMapping[col] = ''; // Always empty by default
          return;
        }

        if (col === 'Publisher') {
          initialMapping[col] = ''; // Always empty by default
          return;
        }

        if (col === 'Parent_Paper_ID') {
          const matched = headers.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH === 'parentpaperid' || cleanH === 'parent_paper_id' || cleanH === 'parentid';
          });
          initialMapping[col] = matched || '';
          return;
        }

        if (col === 'citation_count') {
          const matched = headers.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH === 'citedby' || cleanH === 'citationcount' || cleanH === 'citations' || cleanH === 'cited_by';
          });
          initialMapping[col] = matched || '';
          return;
        }

        if (col === 'Original_Publisher') {
          const matched = headers.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH === 'publisher' || cleanH === 'originalpublisher' || cleanH === 'original_publisher';
          });
          initialMapping[col] = matched || '';
          return;
        }
        
        if (col === 'Authors') {
          let matched = headers.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
            return cleanH === 'authorfullnames' || cleanH === 'authorsfullnames';
          });
          if (!matched) {
            matched = headers.find(h => {
              const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanH === 'authors' || cleanH === 'author';
            });
          }
          initialMapping[col] = matched || '';
          return;
        }

        const matched = headers.find(h => {
          const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanH.includes(cleanC) || cleanC.includes(cleanH);
        });
        initialMapping[col] = matched || '';
      });
      setColumnMapping(initialMapping);
    }
  };

  useEffect(() => {
    if (csvData.length === 0 || Object.keys(columnMapping).length === 0) return;

    const headerIndices: Record<string, number> = {};
    Object.entries(columnMapping).forEach(([target, source]) => {
      headerIndices[target] = csvHeaders.indexOf(source);
    });

    const parsedPapers = csvData.map((row, idx) => {
      const p: any = {};
      Object.entries(headerIndices).forEach(([target, colIdx]) => {
        p[target] = colIdx !== -1 ? row[colIdx] : '';
      });
      
      if (!p.Paper_ID) p.Paper_ID = `TEMP_P_${idx + 1}`;
      if (!p.Import_Date) p.Import_Date = new Date().toISOString().split('T')[0];
      if (!p.Import_Source) p.Import_Source = csvFile?.name || 'CSV Ingestion';
      if (!p.Status) p.Status = '';
      
      return p;
    });

    let newCount = 0;
    let dupCount = 0;
    
    const checkedPapers = parsedPapers.map(p => {
      const cleanTitle = p.Title?.toLowerCase().replace(/\s+/g, '') || '';
      const doi = p.DOI?.trim() || '';

      const isDuplicate = existingHashes.some(ep => {
        if (doi && ep.DOI && ep.DOI.trim().toLowerCase() === doi.toLowerCase()) {
          return true;
        }
        const cleanEpTitle = ep.Title?.toLowerCase().replace(/\s+/g, '') || '';
        return cleanTitle === cleanEpTitle;
      });

      if (isDuplicate) {
        dupCount++;
      } else {
        newCount++;
      }

      return { ...p, isDuplicate };
    });

    setPreviewPapers(checkedPapers);
    setPreviewStats({ total: parsedPapers.length, newCount, dupCount });

    if (purgeMode) {
      setLoadingPurgeCheck(true);
      fetch('/api/papers/purge-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvPapers: parsedPapers })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPurgeCandidates({
            safe: data.safe || [],
            processed: data.processed || [],
            blocked: data.blocked || []
          });
        }
      })
      .catch(err => {
        console.error('Error running purge check:', err);
        showToast('Failed to run purge matching check', 'error');
      })
      .finally(() => {
        setLoadingPurgeCheck(false);
      });
    }

  }, [columnMapping, csvData, existingHashes, csvFile, purgeMode]);

  const handleImport = async (onSuccess?: () => void) => {
    setImporting(true);
    try {
      const isPreserveMode = csvSourceSelect === 'Preserve from CSV';
      const effectiveSource = csvSourceSelect === 'Other'
        ? (csvCustomSource.trim() || 'Other')
        : (csvSourceSelect || csvSource || 'CSV Import');

      const resolveRowSources = (p: any) => {
        let itemSource = effectiveSource;
        let itemImportSource = effectiveSource;

        if (isPreserveMode) {
          itemSource = p.Source || p.Import_Source || effectiveSource;
          itemImportSource = p.Import_Source || p.Source || effectiveSource;
        } else if (p.Source && ['Backward Snowball', 'Forward Snowball', 'Manual Search', 'Manual Ingestion'].includes(p.Source)) {
          // Auto-preserve explicit snowballing classifications from imported CSV
          itemSource = p.Source;
          itemImportSource = p.Import_Source || p.Source;
        }

        return {
          ...p,
          Import_Source: itemImportSource,
          Import_Date: csvImportDate || p.Import_Date || new Date().toISOString().split('T')[0],
          Source: itemSource,
          Parent_Paper_ID: p.Parent_Paper_ID || ''
        };
      };

      const papersToSend = syncCitations
        ? previewPapers.map(resolveRowSources)
        : previewPapers.filter(p => !p.isDuplicate).map(resolveRowSources);

      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          papers: papersToSend,
          syncCitations: syncCitations
        })
      });

      if (res.ok) {
        const data = await res.json();
        let msg = `Successfully imported ${data.imported} papers!`;
        if (data.skipped > 0 && !syncCitations) {
          msg += ` (Skipped ${data.skipped} duplicates)`;
        }
        if (syncCitations && data.updatedCitations > 0) {
          msg += ` Mapped and synced citation count data for ${data.updatedCitations} existing papers.`;
        }
        showToast(msg, 'success');
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvData([]);
        setPreviewPapers([]);
        broadcastSync('SYNC_PAPERS');
        if (onSuccess) onSuccess();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed to import papers: ${errData.error || res.statusText || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error importing papers: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handlePurge = async (onSuccess?: () => void) => {
    setImporting(true);
    try {
      const paperIdsToDelete = [
        ...purgeCandidates.safe.map(p => p.Paper_ID),
        ...purgeCandidates.processed.map(p => p.Paper_ID)
      ];

      const res = await fetch('/api/papers/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperIds: paperIdsToDelete })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`Successfully purged ${data.deletedPapers} papers! (Deleted ${data.deletedPdfs} project PDFs)`, 'success');
        setCsvFile(null);
        setCsvHeaders([]);
        setCsvData([]);
        setPreviewPapers([]);
        setPurgeCandidates({ safe: [], processed: [], blocked: [] });
        broadcastSync('SYNC_PAPERS');
        if (loadPapers) loadPapers();
        if (onSuccess) onSuccess();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed to purge papers: ${errData.error || res.statusText || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error purging papers: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) {
      showToast('Paper title is required', 'error');
      return;
    }

    setManualIngesting(true);
    try {
      const parsedYear = parseInt(manualYear, 10);
      const parsedCitations = parseInt(manualCitationCount, 10);
      const p = {
        Paper_ID: `TEMP_M_${Date.now()}`,
        Title: manualTitle.trim(),
        Authors: manualAuthors.trim(),
        Year: !isNaN(parsedYear) ? parsedYear : null,
        DOI: manualDoi.trim(),
        citation_count: !isNaN(parsedCitations) ? parsedCitations : 0,
        Abstract: manualAbstract.trim(),
        Import_Date: manualImportDate || new Date().toISOString().split('T')[0],
        Import_Source: manualSource || 'Manual Ingestion',
        Source: manualSource || 'Manual Ingestion',
        Status: '',
        Local_PDF_Status: 'MISSING',
        Parent_Paper_ID: manualParentPaperId || '',
        Original_Publisher: '',
        Publisher: ''
      };

      const res = await fetch('/api/papers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: [p] })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.skipped > 0) {
          showToast('This paper already exists in the database (duplicate title/DOI)', 'warning');
        } else {
          showToast('Manual paper ingested successfully', 'success');
          // Reset
          setManualTitle('');
          setManualAuthors('');
          setManualYear('');
          setManualDoi('');
          setManualCitationCount('');
          setManualAbstract('');
          setManualParentPaperId('');
          setManualParentSearch('');
          setSelectedParentPaper(null);
          if (loadPapers) loadPapers();
          broadcastSync('SYNC_PAPERS');
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(`Failed to ingest paper: ${errData.error || res.statusText}`, 'error');
      }
    } catch (err: any) {
      showToast(`Error ingesting paper: ${err.message || err}`, 'error');
    } finally {
      setManualIngesting(false);
    }
  };

  return {
    csvSource, setCsvSource,
    csvSourceSelect, setCsvSourceSelect,
    csvCustomSource, setCsvCustomSource,
    csvFile, setCsvFile,
    csvImportDate, setCsvImportDate,
    manualSource, setManualSource,
    manualImportDate, setManualImportDate,
    manualYear, setManualYear,
    manualTitle, setManualTitle,
    manualAuthors, setManualAuthors,
    manualDoi, setManualDoi,
    manualCitationCount, setManualCitationCount,
    manualAbstract, setManualAbstract,
    manualIngesting,
    manualParentPaperId, setManualParentPaperId,
    manualParentSearch, setManualParentSearch,
    showParentSuggestions, setShowParentSuggestions,
    parentPaperSuggestions, setParentPaperSuggestions,
    selectedParentPaper, setSelectedParentPaper,
    csvHeaders, setCsvHeaders,
    csvData, setCsvData,
    columnMapping, setColumnMapping,
    previewPapers, setPreviewPapers,
    previewStats, setPreviewStats,
    importing, setImporting,
    syncCitations, setSyncCitations,
    purgeMode, setPurgeMode,
    purgeCandidates, setPurgeCandidates,
    loadingPurgeCheck,
    handleCsvSelect,
    handleImport,
    handlePurge,
    handleManualIngest
  };
}
