import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  ExternalLink, 
  X, 
  BarChart2, 
  Search, 
  Filter 
} from 'lucide-react';
import ClickableCell from './ClickableCell';
import VisualizerModal from './VisualizerModal';
import { useViewerData } from '../../context/ViewerContext';

const DEFAULT_WIDTHS = {
  Paper_ID: 70,
  Title: 150,
  Authors: 100,
  Year: 60,
  DOI: 80,
  Import_Source: 80,
  Local_PDF_Status: 70,
  PDF_Link: 50,
  Publisher: 100,
  citation_count: 50,
  Overall_QA: 90
};

export default function FinalCohortPanel() {
  const {
    activeSession,
    showToast,
    searchTerm,
    setSearchTerm,
    showFilters,
    setShowFilters,
    activeFiltersCount: globalActiveFiltersCount,
    setActiveFiltersCount,
    isVisualizerOpen: globalIsVisualizerOpen,
    setIsVisualizerOpen: globalSetIsVisualizerOpen
  } = useViewerData();
  const projectId = activeSession?.id || 'viewer-project';

  // Read data from the offline session snapshot directly
  const allPapers = useMemo(() => activeSession?.rawData?.final_cohort?.papers || [], [activeSession]);
  const umbrellanizerMap = useMemo(() => activeSession?.rawData?.final_cohort?.umbrellanizer_mappings || {}, [activeSession]);
  const projectData = useMemo(() => activeSession?.rawData?.project || {}, [activeSession]);
  const [minQaScore, setMinQaScore] = useState('');
  const [maxQaScore, setMaxQaScore] = useState('');
  const [selectedExtractedFilters, setSelectedExtractedFilters] = useState({});
  const [pdfFilter, setPdfFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [doiStatusFilter, setDoiStatusFilter] = useState('');
  const [pdfLinkFilter, setPdfLinkFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [publisherFilter, setPublisherFilter] = useState('');

  // Pagination & Sorting States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [sortField, setSortField] = useState('Paper_ID');
  const [sortDirection, setSortDirection] = useState('asc');
  const [internalIsVisualizerOpen, setInternalIsVisualizerOpen] = useState(false);
  const isVisualizerOpen = globalIsVisualizerOpen !== undefined ? globalIsVisualizerOpen : internalIsVisualizerOpen;
  const setIsVisualizerOpen = globalSetIsVisualizerOpen || setInternalIsVisualizerOpen;
  const [selectedPaperId, setSelectedPaperId] = useState(null);

  // Column Width Resizing State
  const [columnWidths, setColumnWidths] = useState({});

  useEffect(() => {
    if (!projectId) return;
    try {
      const saved = localStorage.getItem(`slr_viewer_cohort_column_widths_${projectId}`);
      if (saved) {
        setColumnWidths(JSON.parse(saved));
      } else {
        setColumnWidths({});
      }
    } catch (e) {
      console.error('Failed to load column widths:', e);
    }
  }, [projectId]);

  const getColWidth = useCallback((key, isQa = false, isExt = false) => {
    if (columnWidths[key] !== undefined) return columnWidths[key];
    if (DEFAULT_WIDTHS[key] !== undefined) return DEFAULT_WIDTHS[key];
    if (isQa) return 120;
    if (isExt) return 180;
    return 100;
  }, [columnWidths]);

  const handleResizeStart = (e, colKey, isQa = false, isExt = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.pageX;
    const startWidth = getColWidth(colKey, isQa, isExt);
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(40, Math.min(500, startWidth + deltaX));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    
    const handleMouseUp = (upEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      setColumnWidths(prev => {
        const next = { ...prev, [colKey]: Math.max(40, Math.min(500, startWidth + (upEvent.pageX - startX))) };
        try {
          localStorage.setItem(`slr_viewer_cohort_column_widths_${projectId}`, JSON.stringify(next));
        } catch (e) {
          console.error('Failed to save column widths:', e);
        }
        return next;
      });
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Helper to resolve raw token to umbrellanized value
  const resolveUmbrellanizerValue = useCallback((val, key) => {
    if (val === undefined || val === null || val === '') return '';
    const rawVal = String(val).trim();
    const raw = rawVal.toLowerCase().replace(/\s+/g, ' ');
    const map = umbrellanizerMap[key] || {};
    
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return rawVal;
    
    const mappedVal = map[matchedKey];
    if (!mappedVal) return rawVal;
    
    if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
      return String(mappedVal.umbrella_category || matchedKey).trim();
    }
    if (Array.isArray(mappedVal)) {
      return String(mappedVal[0] || matchedKey).trim();
    }
    return String(mappedVal).trim();
  }, [umbrellanizerMap]);

  // Helper to resolve Umbrellanizer taxonomy mapping justification
  const getUmbrellanizerJustification = useCallback((resolvedVal, key, paper) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');
    if (!extStr) return '';

    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      const extObj = parsed.extracted_data || parsed;
      let rawVal = extObj[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
        rawVal = rawVal.value;
      }
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      const map = umbrellanizerMap[key] || {};
      
      const resolveSingle = (singleRaw) => {
        const r = String(singleRaw).trim();
        const rNorm = r.toLowerCase().replace(/\s+/g, ' ');
        let matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === rNorm);
        
        if (!matchedKey) {
          matchedKey = Object.keys(map).find(k => {
            const mappedVal = map[k];
            if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
              return String(mappedVal.umbrella_category || '').trim().toLowerCase().replace(/\s+/g, ' ') === rNorm;
            }
            return false;
          });
        }

        if (matchedKey) {
          const mappedVal = map[matchedKey];
          if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
            return String(mappedVal.justification || '').trim();
          }
        }
        return '';
      };

      if (Array.isArray(rawVal)) {
        return rawVal.map(resolveSingle).filter(Boolean).join(' || ');
      }
      return resolveSingle(rawVal);
    } catch (e) {}
    return '';
  }, [umbrellanizerMap]);

  // Parse QA Assessment helpers with stage dominance
  const parseQaAssessment = useCallback((paper) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    if (!qaStr) return { score: 0, items: {}, traces: {} };
    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      if (typeof parsed === 'object' && parsed !== null) {
        const qaObj = parsed.qa_scores || parsed;
        const logicTrace = parsed.logic_trace || {};
        const appraisalReasoning = logicTrace.appraisal_reasoning || {};
        
        let score = 0;
        const items = {};
        const traces = {};

        Object.entries(qaObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
          const val = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
          items[k] = String(val);

          let traceVal = appraisalReasoning[k + '_analysis'] || appraisalReasoning[k] || '';
          let evidenceVal = '';

          if (v && typeof v === 'object') {
            if (v.evidence) {
              evidenceVal = String(v.evidence);
            } else if (v.logic_trace?.evidence) {
              evidenceVal = String(v.logic_trace.evidence);
            }
          }
          traces[k] = { extraction_mapping: String(traceVal || ''), evidence: evidenceVal };

          const numVal = parseFloat(String(val));
          if (!isNaN(numVal)) {
            score += numVal;
          } else if (
            val === true ||
            ['YES', 'PASS', 'TRUE'].includes(String(val).toUpperCase().trim())
          ) {
            score += 1;
          }
        });
        return { score, items, traces };
      }
    } catch (e) {
      const num = parseFloat(qaStr);
      if (!isNaN(num)) {
        return { score: num, items: {}, traces: {} };
      }
    }
    return { score: 0, items: {}, traces: {} };
  }, []);

  // Parse Extracted Data helpers with stage dominance
  const parseExtractedData = useCallback((paper) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return {};
    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        const resolved = {};
        Object.entries(extObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace') return;
          let val = v;
          if (v && typeof v === 'object' && 'value' in v) {
            val = v.value;
          }
          
          const rawTokens = [];
          if (Array.isArray(val)) {
            val.forEach(item => {
              if (typeof item === 'string' && item.includes(',') && !k.startsWith('rq8_a')) {
                item.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
              } else if (item !== undefined && item !== null && item !== '') {
                rawTokens.push(String(item).trim());
              }
            });
          } else if (typeof val === 'string') {
            if (val.includes(',') && !k.startsWith('rq8_a')) {
              val.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
            } else if (val.trim()) {
              rawTokens.push(val.trim());
            }
          } else if (val !== undefined && val !== null && val !== '') {
            rawTokens.push(String(val).trim());
          }

          if (rawTokens.length === 0) {
            resolved[k] = '';
          } else {
            const mapped = rawTokens.map(t => resolveUmbrellanizerValue(t, k)).filter(Boolean);
            resolved[k] = mapped.length > 1 ? mapped : (mapped[0] || '');
          }
        });
        return resolved;
      }
    } catch (e) {}
    return {};
  }, [resolveUmbrellanizerValue]);

  // Helper to fetch original raw extracted data before umbrellanizer category mapping
  const getOriginalExtractedVal = useCallback((paper, key) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return null;
    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        let val = extObj[key];
        if (val && typeof val === 'object' && 'value' in val) {
          val = val.value;
        }
        return val;
      }
    } catch (e) {}
    return null;
  }, []);

  // Parse Extracted Data logic traces & quotes dynamically
  const parseExtractedTraces = useCallback((paper) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return { mapping: {}, evidence: {} };
    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      const extObj = parsed.extracted_data || parsed;
      const logicTrace = parsed.logic_trace || extObj.logic_trace || {};
      const locateMapping = logicTrace.extraction_mapping || logicTrace || {};
      
      const mapping = {};
      const evidence = {};
      
      Object.keys(extObj).forEach(key => {
        if (key.startsWith('_') || key === 'logic_trace' || key === '_scientist_logic_trace') return;
        mapping[key] = locateMapping[`locate_${key}`] || locateMapping[key] || '';
        const valObj = extObj[key];
        if (valObj && typeof valObj === 'object') {
          if ('evidence' in valObj) {
            evidence[key] = String(valObj.evidence);
          } else if ('logic_trace' in valObj && valObj.logic_trace && typeof valObj.logic_trace === 'object') {
            evidence[key] = String(valObj.logic_trace.evidence || '');
          }
        }
      });
      
      return { mapping, evidence };
    } catch (e) {}
    return { mapping: {}, evidence: {} };
  }, []);

  // Extract all unique filter options from the dataset dynamically
  const filterOptions = useMemo(() => {
    const qaKeysSet = new Set();
    const extKeysMap = new Map();
    const yearSet = new Set();
    const publisherSet = new Set();

    allPapers.forEach(p => {
      if (p.Year) yearSet.add(String(p.Year).trim());
      const pub = p.Publisher || p.Original_Publisher;
      if (pub && String(pub).trim()) publisherSet.add(String(pub).trim());

      const { items } = parseQaAssessment(p);
      Object.keys(items).forEach(k => qaKeysSet.add(k));

      const ext = parseExtractedData(p);
      Object.entries(ext).forEach(([k, v]) => {
        if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace') return;
        if (v !== undefined && v !== null && v !== '') {
          if (!extKeysMap.has(k)) {
            extKeysMap.set(k, new Set());
          }
          if (Array.isArray(v)) {
            v.forEach(val => extKeysMap.get(k).add(String(val)));
          } else {
            extKeysMap.get(k).add(String(v));
          }
        }
      });
    });

    const extOptions = {};
    extKeysMap.forEach((valSet, key) => {
      extOptions[key] = Array.from(valSet).sort();
    });

    return {
      qaKeys: Array.from(qaKeysSet).sort(),
      extracted: extOptions,
      years: Array.from(yearSet).sort((a, b) => b.localeCompare(a)),
      publishers: Array.from(publisherSet).sort()
    };
  }, [allPapers, parseQaAssessment, parseExtractedData]);

  // Apply deep filtering
  const filteredPapers = useMemo(() => {
    return allPapers.filter(p => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          p.Paper_ID.toLowerCase().includes(term) ||
          (p.Title && p.Title.toLowerCase().includes(term)) ||
          (p.Authors && p.Authors.toLowerCase().includes(term)) ||
          (p.Abstract && p.Abstract.toLowerCase().includes(term));
        
        if (!matchesSearch) return false;
      }

      const { score } = parseQaAssessment(p);
      if (minQaScore !== '' && score < minQaScore) return false;
      if (maxQaScore !== '' && score > maxQaScore) return false;

      const ext = parseExtractedData(p);
      for (const [extKey, targetVals] of Object.entries(selectedExtractedFilters)) {
        if (targetVals && targetVals.length > 0) {
          const val = ext[extKey];
          const origVal = getOriginalExtractedVal(p, extKey);
          
          const valTokens = Array.isArray(val) ? val.map(String) : [String(val || '')];
          const origTokens = Array.isArray(origVal) ? origVal.map(String) : [String(origVal || '')];
          const allTokens = Array.from(new Set([...valTokens, ...origTokens])).filter(Boolean);
          
          const hasMatch = allTokens.some(v => targetVals.includes(v));
          if (!hasMatch) return false;
        }
      }

      if (pdfFilter && p.Local_PDF_Status !== pdfFilter) return false;

      if (sourceFilter) {
        const importSrc = p.Import_Source || '';
        if (sourceFilter === 'manual') {
          if (!['Manual Search', 'Manual Ingestion'].includes(importSrc)) return false;
        } else if (sourceFilter === 'backward') {
          if (importSrc !== 'Backward Snowball') return false;
        } else if (sourceFilter === 'forward') {
          if (importSrc !== 'Forward Snowball') return false;
        } else if (sourceFilter === 'csv') {
          if (['Manual Search', 'Manual Ingestion', 'Backward Snowball', 'Forward Snowball'].includes(importSrc)) return false;
        }
      }

      if (doiStatusFilter) {
        const hasDoi = !!(p.DOI && p.DOI.trim());
        if (doiStatusFilter === 'empty' && hasDoi) return false;
        if (doiStatusFilter === 'has_doi' && !hasDoi) return false;
      }

      if (pdfLinkFilter) {
        const hasLink = !!(p.PDF_Link && p.PDF_Link.trim());
        if (pdfLinkFilter === 'empty' && hasLink) return false;
        if (pdfLinkFilter === 'has_link' && !hasLink) return false;
      }

      // Year Filter
      if (yearFilter && String(p.Year || '').trim() !== yearFilter) return false;

      // Publisher Filter
      if (publisherFilter) {
        const paperPub = String(p.Publisher || p.Original_Publisher || '').trim();
        if (paperPub !== publisherFilter) return false;
      }

      return true;
    });
  }, [allPapers, searchTerm, minQaScore, maxQaScore, selectedExtractedFilters, parseQaAssessment, parseExtractedData, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, yearFilter, publisherFilter]);

  // Client-side Column sorting logic
  const sortedPapers = useMemo(() => {
    const papersCopy = [...filteredPapers];
    if (!sortField) return papersCopy;

    papersCopy.sort((a, b) => {
      let valA = '';
      let valB = '';

      if (sortField.startsWith('qa:')) {
        const qaKey = sortField.substring(3);
        const qaA = parseQaAssessment(a);
        const qaB = parseQaAssessment(b);
        valA = qaA.items[qaKey] || '';
        valB = qaB.items[qaKey] || '';
      } else if (sortField.startsWith('ext:')) {
        const extKey = sortField.substring(4);
        const extA = parseExtractedData(a);
        const extB = parseExtractedData(b);
        const aVal = extA[extKey];
        const bVal = extB[extKey];
        valA = Array.isArray(aVal) ? aVal.join(', ') : String(aVal || '');
        valB = Array.isArray(bVal) ? bVal.join(', ') : String(bVal || '');
      } else if (sortField === 'Overall_QA') {
        const qaA = parseQaAssessment(a);
        const qaB = parseQaAssessment(b);
        valA = qaA.score;
        valB = qaB.score;
      } else if (sortField === 'Publisher') {
        valA = a.Publisher || a.Original_Publisher || '';
        valB = b.Publisher || b.Original_Publisher || '';
      } else {
        valA = a[sortField];
        valB = b[sortField];
      }

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase().trim();
      const strB = String(valB).toLowerCase().trim();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return papersCopy;
  }, [filteredPapers, sortField, sortDirection, parseQaAssessment, parseExtractedData]);

  // Pagination calculations
  const total = sortedPapers.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const paginatedPapers = useMemo(() => {
    const offset = (page - 1) * limit;
    return sortedPapers.slice(offset, offset + limit);
  }, [sortedPapers, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, minQaScore, maxQaScore, selectedExtractedFilters, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, yearFilter, publisherFilter]);

  const clearAllFilters = () => {
    setMinQaScore('');
    setMaxQaScore('');
    setSelectedExtractedFilters({});
    setPdfFilter('');
    setSourceFilter('');
    setDoiStatusFilter('');
    setPdfLinkFilter('');
    setYearFilter('');
    setPublisherFilter('');
    setSearchTerm('');
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (minQaScore !== '') count++;
    if (maxQaScore !== '') count++;
    count += Object.values(selectedExtractedFilters).filter(arr => arr.length > 0).length;
    if (pdfFilter) count++;
    if (sourceFilter) count++;
    if (doiStatusFilter) count++;
    if (pdfLinkFilter) count++;
    if (yearFilter) count++;
    if (publisherFilter) count++;
    return count;
  }, [minQaScore, maxQaScore, selectedExtractedFilters, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter, yearFilter, publisherFilter]);

  useEffect(() => {
    if (setActiveFiltersCount) {
      setActiveFiltersCount(activeFiltersCount);
    }
  }, [activeFiltersCount, setActiveFiltersCount]);

  const toggleExtractedFilterValue = (key, val) => {
    setSelectedExtractedFilters(prev => {
      const current = prev[key] || [];
      const next = current.includes(val) 
        ? current.filter(v => v !== val)
        : [...current, val];
      return { ...prev, [key]: next };
    });
  };

  // High fidelity visual renderers for grid cells
  const getPdfStatusBadge = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
      case 'SYNCED':
      case 'DOWNLOADED':
      case 'MATCHED':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{s}</span>;
      case 'NEEDS_REVIEW':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">REVIEW</span>;
      case 'MISSING':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">{s}</span>;
      case 'FAILED':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">{s}</span>;
      case 'IGNORED':
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">{s}</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-secondary text-muted-foreground border border-border">{s || 'UNKNOWN'}</span>;
    }
  };

  const renderQaVal = (val) => {
    if (!val) return <span className="text-muted-foreground/30">-</span>;
    const normalized = String(val).toUpperCase().trim();
    if (['YES', 'PASS', 'TRUE', '1', '1.0'].includes(normalized)) {
      return <span className="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black">YES</span>;
    }
    if (['NO', 'FAIL', 'FALSE', '0', '0.0'].includes(normalized)) {
      return <span className="px-1 py-0.2 rounded bg-rose-500/10 text-rose-500 text-[9px] font-black">NO</span>;
    }
    return <span className="px-1 py-0.2 rounded bg-secondary text-foreground text-[9px] font-bold">{val}</span>;
  };

  const renderExtractedVal = (val) => {
    if (val === undefined || val === null || val === '') {
      return <span className="text-muted-foreground/30">-</span>;
    }
    
    const processArray = (arr) => {
      const counts = {};
      arr.forEach(item => {
        const s = String(item).trim();
        if (s) {
          counts[s] = (counts[s] || 0) + 1;
        }
      });
      
      const entries = Object.entries(counts);
      if (entries.length === 0) return <span className="text-muted-foreground/30">-</span>;
      
      return (
        <div className="flex flex-wrap gap-1 items-center">
          {entries.map(([item, count], idx) => (
            <span key={idx} className="inline-flex items-center gap-0.5 text-[10px] text-foreground font-semibold">
              {item}
              {count > 1 && (
                <span className="px-0.5 py-0.2 text-[8px] font-black bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded-full leading-none">
                  {count}
                </span>
              )}
              {idx < entries.length - 1 && <span className="text-muted-foreground/45 font-normal">,</span>}
            </span>
          ))}
        </div>
      );
    };

    if (Array.isArray(val)) {
      return processArray(val);
    }
    
    return <span className="text-[10px] text-foreground font-semibold">{String(val)}</span>;
  };

  const handleColumnSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <span className="opacity-30 ml-0.5">⇅</span>;
    }
    return sortDirection === 'asc' ? <span className="text-primary ml-0.5">▲</span> : <span className="text-primary ml-0.5">▼</span>;
  };

  return (
    <div className="space-y-4 flex flex-col h-full overflow-hidden">
      {/* Collapsible Deep Filters Drawer */}
      {showFilters && (
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4 shrink-0 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <span className="text-xs font-bold text-foreground">Deep Cohort Filters</span>
            <button
              onClick={clearAllFilters}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
            >
              Clear All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Overall QA Score Range</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minQaScore}
                  onChange={(e) => setMinQaScore(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxQaScore}
                  onChange={(e) => setMaxQaScore(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium"
                />
              </div>
            </div>

            <div className="space-y-3 col-span-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Extracted Taxonomy Variables</span>
              {Object.keys(filterOptions.extracted).length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No extracted variables found in the current cohort.</span>
              ) : (
                <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-secondary/15 space-y-3">
                  {Object.entries(filterOptions.extracted).map(([key, options]) => (
                    <div key={key} className="space-y-1">
                      <span className="text-[9px] font-extrabold text-foreground uppercase tracking-wider block">{key}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {options.map((opt) => {
                          const isSelected = (selectedExtractedFilters[key] || []).includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => toggleExtractedFilterValue(key, opt)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-secondary hover:bg-secondary/80 border-border text-muted-foreground'
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Quick Attribute Scope</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Status</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={pdfFilter}
                    onChange={(e) => setPdfFilter(e.target.value)}
                  >
                    <option value="">Any PDF Status</option>
                    <option value="IGNORED">IGNORED</option>
                    <option value="MISSING">MISSING</option>
                    <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    <option value="MATCHED">MATCHED</option>
                    <option value="DOWNLOADED">DOWNLOADED</option>
                    <option value="SYNCED">SYNCED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Source Scope</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="">Any Source</option>
                    <option value="manual">Manual Ingestion</option>
                    <option value="backward">Backward Snowball</option>
                    <option value="forward">Forward Snowball</option>
                    <option value="csv">CSV Import</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">DOI Status</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={doiStatusFilter}
                    onChange={(e) => setDoiStatusFilter(e.target.value)}
                  >
                    <option value="">Any DOI</option>
                    <option value="empty">Empty DOI</option>
                    <option value="has_doi">Has DOI</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Year</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                  >
                    <option value="">Any Year</option>
                    {(filterOptions.years || []).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">Publisher</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={publisherFilter}
                    onChange={(e) => setPublisherFilter(e.target.value)}
                  >
                    <option value="">Any Publisher</option>
                    {(filterOptions.publishers || []).map(pub => (
                      <option key={pub} value={pub}>{pub}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Link</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full cursor-pointer"
                    value={pdfLinkFilter}
                    onChange={(e) => setPdfLinkFilter(e.target.value)}
                  >
                    <option value="">Any State</option>
                    <option value="has_link">Has PDF Link</option>
                    <option value="empty">Empty</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabular Table Container - Takes 100% of parent container */}
      <div className="flex-1 flex flex-col overflow-hidden w-full h-full border-t border-border">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/15 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-foreground">Cohort Table View</span>
            <span className="px-2 py-0.5 rounded-full bg-secondary border border-border text-[10px] font-extrabold text-muted-foreground">
              {filteredPapers.length} / {allPapers.length} papers
            </span>
          </div>
        </div>

        {sortedPapers.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-6 text-muted-foreground text-xs italic">
            No papers match the current filters.
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs border-collapse relative table-fixed">
                <thead className="sticky top-0 z-10 bg-secondary border-b border-border shadow-sm">
                  <tr className="text-muted-foreground text-[9px] font-bold uppercase whitespace-nowrap select-none">
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Paper_ID'), minWidth: getColWidth('Paper_ID'), maxWidth: getColWidth('Paper_ID') }}
                      onClick={() => handleColumnSort('Paper_ID')}
                    >
                      <div className="truncate pr-2">ID {renderSortIndicator('Paper_ID')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Paper_ID')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Title'), minWidth: getColWidth('Title'), maxWidth: getColWidth('Title') }}
                      onClick={() => handleColumnSort('Title')}
                    >
                      <div className="truncate pr-2">Title {renderSortIndicator('Title')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Title')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Authors'), minWidth: getColWidth('Authors'), maxWidth: getColWidth('Authors') }}
                      onClick={() => handleColumnSort('Authors')}
                    >
                      <div className="truncate pr-2">Authors {renderSortIndicator('Authors')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Authors')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border text-center cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Year'), minWidth: getColWidth('Year'), maxWidth: getColWidth('Year') }}
                      onClick={() => handleColumnSort('Year')}
                    >
                      <div className="truncate pr-2">Year {renderSortIndicator('Year')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Year')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('DOI'), minWidth: getColWidth('DOI'), maxWidth: getColWidth('DOI') }}
                      onClick={() => handleColumnSort('DOI')}
                    >
                      <div className="truncate pr-2">DOI {renderSortIndicator('DOI')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'DOI')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Import_Source'), minWidth: getColWidth('Import_Source'), maxWidth: getColWidth('Import_Source') }}
                      onClick={() => handleColumnSort('Import_Source')}
                    >
                      <div className="truncate pr-2">Source {renderSortIndicator('Import_Source')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Import_Source')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border text-center cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Local_PDF_Status'), minWidth: getColWidth('Local_PDF_Status'), maxWidth: getColWidth('Local_PDF_Status') }}
                      onClick={() => handleColumnSort('Local_PDF_Status')}
                    >
                      <div className="truncate pr-2">PDF {renderSortIndicator('Local_PDF_Status')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Local_PDF_Status')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('PDF_Link'), minWidth: getColWidth('PDF_Link'), maxWidth: getColWidth('PDF_Link') }}
                      onClick={() => handleColumnSort('PDF_Link')}
                    >
                      <div className="truncate pr-2">Link {renderSortIndicator('PDF_Link')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'PDF_Link')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('Publisher'), minWidth: getColWidth('Publisher'), maxWidth: getColWidth('Publisher') }}
                      onClick={() => handleColumnSort('Publisher')}
                    >
                      <div className="truncate pr-2">Publisher {renderSortIndicator('Publisher')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Publisher')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border text-center cursor-pointer hover:bg-secondary/45 transition-colors relative group" 
                      style={{ width: getColWidth('citation_count'), minWidth: getColWidth('citation_count'), maxWidth: getColWidth('citation_count') }}
                      onClick={() => handleColumnSort('citation_count')}
                    >
                      <div className="truncate pr-2">Cites {renderSortIndicator('citation_count')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'citation_count')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    <th 
                      className="p-2 border-b border-border text-center bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors relative group" 
                      style={{ width: getColWidth('Overall_QA'), minWidth: getColWidth('Overall_QA'), maxWidth: getColWidth('Overall_QA') }}
                      onClick={() => handleColumnSort('Overall_QA')}
                    >
                      <div className="truncate pr-2">QA Score {renderSortIndicator('Overall_QA')}</div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'Overall_QA')}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                      />
                    </th>
                    
                    {/* Dynamic QA Columns */}
                    {filterOptions.qaKeys.map((qaKey) => (
                      <th 
                        key={`head-qa-${qaKey}`} 
                        className="p-2 border-b border-border text-center bg-primary/5 border-l border-border/60 cursor-pointer hover:bg-primary/10 transition-colors relative group"
                        style={{ width: getColWidth(`qa:${qaKey}`, true), minWidth: getColWidth(`qa:${qaKey}`, true), maxWidth: getColWidth(`qa:${qaKey}`, true) }}
                        onClick={() => handleColumnSort(`qa:${qaKey}`)}
                      >
                        <div className="truncate pr-2">{qaKey} {renderSortIndicator(`qa:${qaKey}`)}</div>
                        <div
                          onMouseDown={(e) => handleResizeStart(e, `qa:${qaKey}`, true)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                        />
                      </th>
                    ))}

                    {/* Dynamic Extracted Data Mappings Columns */}
                    {Object.keys(filterOptions.extracted).map((extKey) => (
                      <th 
                        key={`head-ext-${extKey}`} 
                        className="p-2 border-b border-border bg-secondary/50 border-l border-border/60 cursor-pointer hover:bg-secondary/70 transition-colors relative group"
                        style={{ width: getColWidth(`ext:${extKey}`, false, true), minWidth: getColWidth(`ext:${extKey}`, false, true), maxWidth: getColWidth(`ext:${extKey}`, false, true) }}
                        onClick={() => handleColumnSort(`ext:${extKey}`)}
                      >
                        <div className="truncate pr-2">{extKey} {renderSortIndicator(`ext:${extKey}`)}</div>
                        <div
                          onMouseDown={(e) => handleResizeStart(e, `ext:${extKey}`, false, true)}
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize bg-transparent hover:bg-primary border-r border-transparent hover:border-primary/50 transition-colors z-20"
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedPapers.map((p) => {
                    const { score, items, traces } = parseQaAssessment(p);
                    const ext = parseExtractedData(p);
                    const extTraces = parseExtractedTraces(p);

                    const isSelected = selectedPaperId === p.Paper_ID;

                    return (
                      <tr 
                        key={p.Paper_ID} 
                        onClick={() => setSelectedPaperId(p.Paper_ID)}
                        className={`transition-colors group cursor-pointer ${
                          isSelected 
                            ? 'bg-primary/15 dark:bg-primary/25 border-l-2 border-l-primary font-medium' 
                            : 'hover:bg-secondary/20'
                        }`}
                      >
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('Paper_ID'), minWidth: getColWidth('Paper_ID'), maxWidth: getColWidth('Paper_ID') }}
                        >
                          <ClickableCell valueToCopy={p.Paper_ID} className="font-bold text-muted-foreground font-mono text-[10px]">
                            {p.Paper_ID}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('Title'), minWidth: getColWidth('Title'), maxWidth: getColWidth('Title') }}
                        >
                          <ClickableCell valueToCopy={p.Title} className="font-semibold text-foreground text-[10px]" title={p.Title}>
                            {p.Title}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('Authors'), minWidth: getColWidth('Authors'), maxWidth: getColWidth('Authors') }}
                        >
                          <ClickableCell valueToCopy={p.Authors} className="text-muted-foreground text-[10px]" title={p.Authors}>
                            {p.Authors}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50 text-center"
                          style={{ width: getColWidth('Year'), minWidth: getColWidth('Year'), maxWidth: getColWidth('Year') }}
                        >
                          <ClickableCell valueToCopy={String(p.Year || '')} className="font-medium text-foreground/80 justify-center text-[10px]">
                            {p.Year || '-'}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('DOI'), minWidth: getColWidth('DOI'), maxWidth: getColWidth('DOI') }}
                        >
                          <ClickableCell valueToCopy={p.DOI || ''} className="font-mono text-[9px] text-muted-foreground" title={p.DOI}>
                            {p.DOI || '-'}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('Import_Source'), minWidth: getColWidth('Import_Source'), maxWidth: getColWidth('Import_Source') }}
                        >
                          <ClickableCell valueToCopy={p.Import_Source || ''} className="text-muted-foreground text-[10px]">
                            {p.Import_Source || '-'}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50 text-center"
                          style={{ width: getColWidth('Local_PDF_Status'), minWidth: getColWidth('Local_PDF_Status'), maxWidth: getColWidth('Local_PDF_Status') }}
                        >
                          <div className="flex justify-center select-none truncate max-h-[18px]">
                            {getPdfStatusBadge(p.Local_PDF_Status)}
                          </div>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('PDF_Link'), minWidth: getColWidth('PDF_Link'), maxWidth: getColWidth('PDF_Link') }}
                        >
                          <ClickableCell valueToCopy={p.PDF_Link || ''} className="text-muted-foreground text-[10px]">
                            {p.PDF_Link ? (
                              <a
                                href={p.PDF_Link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium text-[9px]"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                Link
                              </a>
                            ) : (
                              <span className="italic opacity-40 text-[9px]">-</span>
                            )}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50"
                          style={{ width: getColWidth('Publisher'), minWidth: getColWidth('Publisher'), maxWidth: getColWidth('Publisher') }}
                        >
                          <ClickableCell valueToCopy={p.Publisher || p.Original_Publisher || ''} className="text-muted-foreground text-[10px]" title={p.Publisher || p.Original_Publisher}>
                            {p.Publisher || p.Original_Publisher || '-'}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50 text-center"
                          style={{ width: getColWidth('citation_count'), minWidth: getColWidth('citation_count'), maxWidth: getColWidth('citation_count') }}
                        >
                          <ClickableCell valueToCopy={String(p.citation_count ?? '')} className="font-mono font-medium text-foreground justify-center text-[10px]">
                            {p.citation_count ?? '-'}
                          </ClickableCell>
                        </td>
                        <td 
                          className="p-2 border-b border-border/50 text-center bg-primary/5"
                          style={{ width: getColWidth('Overall_QA'), minWidth: getColWidth('Overall_QA'), maxWidth: getColWidth('Overall_QA') }}
                        >
                          <ClickableCell valueToCopy={String(score)} className="font-black justify-center text-[10px]">
                            <span className="inline-flex items-center justify-center bg-primary/10 border border-primary/20 text-primary rounded px-1.5 py-0.2 text-[9px] font-black">
                              {score}
                            </span>
                          </ClickableCell>
                        </td>
                        
                        {/* Dynamic QA Columns */}
                        {filterOptions.qaKeys.map((qaKey) => {
                          const val = items[qaKey];
                          const trace = traces[qaKey] || {};
                          const mapping = trace.extraction_mapping || '';
                          const evidence = trace.evidence || '';
                          const paperPdfLink = p.PDF_Link || (p.local_pdf_path ? `/api/pdf/serve?path=${encodeURIComponent(p.local_pdf_path)}` : undefined);

                          return (
                            <td 
                              key={`cell-qa-${p.Paper_ID}-${qaKey}`} 
                              className="p-2 text-center bg-primary/5 border-l border-border/60 border-b border-border/50"
                              style={{ width: getColWidth(`qa:${qaKey}`, true), minWidth: getColWidth(`qa:${qaKey}`, true), maxWidth: getColWidth(`qa:${qaKey}`, true) }}
                            >
                              <ClickableCell 
                                valueToCopy={val}
                                traceInfo={{ mapping, evidence }}
                                pdfLink={paperPdfLink}
                              >
                                {renderQaVal(val)}
                              </ClickableCell>
                            </td>
                          );
                        })}

                        {/* Dynamic Extracted Columns */}
                        {Object.keys(filterOptions.extracted).map((extKey) => {
                          const val = ext[extKey];
                          const mapping = extTraces.mapping[extKey] || '';
                          const evidence = extTraces.evidence[extKey] || '';
                          const justification = getUmbrellanizerJustification(val, extKey, p);
                          const originalVal = getOriginalExtractedVal(p, extKey);
                          const strVal = Array.isArray(val) ? val.join(', ') : String(val || '');
                          const originalStrVal = originalVal ? (Array.isArray(originalVal) ? originalVal.join(', ') : String(originalVal)) : undefined;
                          const paperPdfLink = p.PDF_Link || (p.local_pdf_path ? `/api/pdf/serve?path=${encodeURIComponent(p.local_pdf_path)}` : undefined);

                          return (
                            <td 
                              key={`cell-ext-${p.Paper_ID}-${extKey}`} 
                              className="p-2 border-l border-border/60 border-b border-border/50"
                              style={{ width: getColWidth(`ext:${extKey}`, false, true), minWidth: getColWidth(`ext:${extKey}`, false, true), maxWidth: getColWidth(`ext:${extKey}`, false, true) }}
                            >
                              <ClickableCell
                                valueToCopy={strVal}
                                traceInfo={{ mapping, evidence, justification }}
                                originalValue={originalStrVal}
                                pdfLink={paperPdfLink}
                              >
                                {renderExtractedVal(val)}
                              </ClickableCell>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0 select-none">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">
                Showing {total ? (page - 1) * limit + 1 : 0} to {Math.min(page * limit, total)} of {total} papers
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Rows:</span>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary font-bold cursor-pointer"
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    {[10, 25, 50, 100].map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-secondary border border-border rounded-lg p-0.5">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold px-2 select-none">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <VisualizerModal
        isOpen={isVisualizerOpen}
        onClose={() => setIsVisualizerOpen(false)}
        papers={filteredPapers}
        totalUnfilteredCount={allPapers.length}
        isFiltered={filteredPapers.length < allPapers.length}
        umbrellanizerMap={umbrellanizerMap}
      />
    </div>
  );
}
