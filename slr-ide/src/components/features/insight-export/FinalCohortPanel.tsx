'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Check, ExternalLink, Eye, Link2, X, Copy } from 'lucide-react';
import { useAppSync } from '@/hooks/useAppSync';

// Condensed clickable cell helper with copy & trace tooltips (expand-on-click removed)
const ClickableCell = ({ 
  children, 
  className = "",
  title,
  valueToCopy,
  traceInfo,
  originalValue
}: { 
  children: React.ReactNode; 
  className?: string;
  title?: string;
  valueToCopy?: string;
  traceInfo?: { mapping?: string; evidence?: string; justification?: string };
  originalValue?: string;
}) => {
  const [activeTooltip, setActiveTooltip] = useState<'value' | 'trace' | null>(null);
  const [copiedType, setCopiedType] = useState<'value' | 'trace-mapping' | 'trace-evidence' | 'trace-justification' | 'original' | null>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Auto close tooltip when clicking outside
  useEffect(() => {
    if (!activeTooltip) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (cellRef.current && !cellRef.current.contains(e.target as Node)) {
        setActiveTooltip(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [activeTooltip]);

  // Listen for custom event to close other tooltips when one opens
  useEffect(() => {
    const handleCloseAll = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.exceptRef !== cellRef) {
        setActiveTooltip(null);
      }
    };
    window.addEventListener('close-all-tooltips', handleCloseAll);
    return () => window.removeEventListener('close-all-tooltips', handleCloseAll);
  }, []);

  const setAndBroadcastTooltip = (type: 'value' | 'trace' | null) => {
    setActiveTooltip(type);
    if (type) {
      window.dispatchEvent(new CustomEvent('close-all-tooltips', { detail: { exceptRef: cellRef } }));
    }
  };

  const handleCopy = (text: string, type: 'value' | 'trace-mapping' | 'trace-evidence' | 'trace-justification' | 'original') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div ref={cellRef} className="relative group/cell w-full h-full min-h-[22px]">
      {/* Content wrapper (always condensed to one line) */}
      <div 
        title={title}
        className={`transition-all duration-150 select-text pr-10 truncate max-h-[18px] overflow-hidden whitespace-nowrap text-ellipsis block ${className}`}
      >
        {children}
      </div>

      {/* Action Buttons on top right (visible on cell hover or when tooltip is open) */}
      <div className={`absolute right-1 top-0.5 flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-opacity duration-150 z-10 ${activeTooltip ? 'opacity-100' : ''}`}>
        {valueToCopy && (
          <button
            onClick={() => setAndBroadcastTooltip(activeTooltip === 'value' ? null : 'value')}
            className={`p-0.5 rounded hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-colors bg-card/90 shadow-sm ${activeTooltip === 'value' ? 'bg-secondary text-primary border-primary/30' : ''}`}
            title="View and copy cell value"
          >
            <Eye className="w-3 h-3" />
          </button>
        )}
        
        {traceInfo && (traceInfo.mapping || traceInfo.evidence || traceInfo.justification) && (
          <button
            onClick={() => setAndBroadcastTooltip(activeTooltip === 'trace' ? null : 'trace')}
            className={`p-0.5 rounded hover:bg-secondary border border-border/40 text-muted-foreground hover:text-foreground transition-colors bg-card/90 shadow-sm ${activeTooltip === 'trace' ? 'bg-secondary text-primary border-primary/30' : ''}`}
            title="View extraction logic trace"
          >
            <Link2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dismissable value copy tooltip */}
      {activeTooltip === 'value' && valueToCopy && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-2">
          <div className="flex justify-between items-center border-b border-border pb-1">
            <span className="font-bold text-[10px] uppercase text-primary">Copy Cell Value</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleCopy(valueToCopy, 'value')}
                className="p-1 hover:bg-secondary rounded border border-border flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedType === 'value' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedType === 'value' ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setActiveTooltip(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium font-mono max-h-24 overflow-y-auto select-all break-all leading-normal">
            {valueToCopy}
          </div>
          {originalValue && originalValue !== valueToCopy && (
            <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5 mt-0.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[10px] uppercase text-muted-foreground">Original Value</span>
                <button
                  onClick={() => handleCopy(originalValue, 'original')}
                  className="p-1 hover:bg-secondary rounded border border-border flex items-center gap-1 text-[9px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedType === 'original' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedType === 'original' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium font-mono max-h-24 overflow-y-auto select-all break-all leading-normal">
                {originalValue}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dismissable trace copy tooltip */}
      {activeTooltip === 'trace' && traceInfo && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-80 p-3 bg-popover border border-border rounded-lg shadow-xl text-left text-[11px] text-popover-foreground flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-border pb-1">
            <span className="font-bold text-[10px] uppercase text-primary">Logic Trace & Details</span>
            <button
              onClick={() => setActiveTooltip(null)}
              className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {traceInfo.mapping && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Mapping Rules / Reasoning</span>
                <button
                  onClick={() => handleCopy(traceInfo.mapping!, 'trace-mapping')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline"
                >
                  {copiedType === 'trace-mapping' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-mapping' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-semibold max-h-20 overflow-y-auto select-all break-words leading-normal">
                {traceInfo.mapping}
              </div>
            </div>
          )}
          
          {traceInfo.evidence && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Evidence Quote</span>
                <button
                  onClick={() => handleCopy(traceInfo.evidence!, 'trace-evidence')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline"
                >
                  {copiedType === 'trace-evidence' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-evidence' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-medium italic max-h-20 overflow-y-auto select-all break-words leading-normal">
                "{traceInfo.evidence}"
              </div>
            </div>
          )}

          {traceInfo.justification && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-extrabold text-muted-foreground">Taxonomy Justification</span>
                <button
                  onClick={() => handleCopy(traceInfo.justification!, 'trace-justification')}
                  className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline"
                >
                  {copiedType === 'trace-justification' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                  {copiedType === 'trace-justification' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-secondary/40 p-2 rounded text-[10px] font-semibold max-h-20 overflow-y-auto select-all break-words leading-normal">
                {traceInfo.justification}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DEFAULT_WIDTHS: Record<string, number> = {
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

interface FinalCohortPanelProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean) => void;
  setActiveFiltersCount: (val: number) => void;
}

export default function FinalCohortPanel({
  projectId,
  showToast,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  setActiveFiltersCount
}: FinalCohortPanelProps) {
  const [allPapers, setAllPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // Sorting States
  const [sortField, setSortField] = useState<string>('Paper_ID');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter States
  const [minQaScore, setMinQaScore] = useState<number | ''>('');
  const [maxQaScore, setMaxQaScore] = useState<number | ''>('');
  const [selectedExtractedFilters, setSelectedExtractedFilters] = useState<Record<string, string[]>>({});
  const [pdfFilter, setPdfFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [doiStatusFilter, setDoiStatusFilter] = useState('');
  const [pdfLinkFilter, setPdfLinkFilter] = useState('');
  const [umbrellanizerMap, setUmbrellanizerMap] = useState<Record<string, Record<string, string>>>({});

  // Column Width Resizing State
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!projectId) return;
    try {
      const saved = localStorage.getItem(`slr_cohort_column_widths_${projectId}`);
      if (saved) {
        setColumnWidths(JSON.parse(saved));
      } else {
        setColumnWidths({});
      }
    } catch (e) {
      console.error('Failed to load column widths:', e);
    }
  }, [projectId]);

  const getColWidth = useCallback((key: string, isQa = false, isExt = false) => {
    if (columnWidths[key] !== undefined) return columnWidths[key];
    if (DEFAULT_WIDTHS[key] !== undefined) return DEFAULT_WIDTHS[key];
    if (isQa) return 120;
    if (isExt) return 180;
    return 100;
  }, [columnWidths]);

  const handleResizeStart = (e: React.MouseEvent, colKey: string, isQa = false, isExt = false) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.pageX;
    const startWidth = getColWidth(colKey, isQa, isExt);
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(40, Math.min(500, startWidth + deltaX));
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      setColumnWidths(prev => {
        const next = { ...prev, [colKey]: Math.max(40, Math.min(500, startWidth + (upEvent.pageX - startX))) };
        try {
          localStorage.setItem(`slr_cohort_column_widths_${projectId}`, JSON.stringify(next));
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
  const resolveUmbrellanizerValue = useCallback((val: any, key: string) => {
    if (val === undefined || val === null || val === '') return '';
    const rawVal = String(val).trim();
    const raw = rawVal.toLowerCase().replace(/\s+/g, ' ');
    const map = umbrellanizerMap[key] || {};
    
    // Case-insensitive key matching
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return rawVal; // Fallback to raw string if unmapped
    
    const mappedVal = map[matchedKey] as any;
    if (!mappedVal) return rawVal;
    
    if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
      return String(mappedVal.umbrella_category || matchedKey).trim();
    }
    if (Array.isArray(mappedVal)) {
      return String(mappedVal[0] || matchedKey).trim();
    }
    return String(mappedVal).trim();
  }, [umbrellanizerMap]);

  // Helper to resolve Umbrellanizer taxonomy mapping justification using the raw database string
  const getUmbrellanizerJustification = useCallback((resolvedVal: any, key: string, paper: any) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');
    if (!extStr) return '';

    try {
      const parsed = JSON.parse(extStr);
      const extObj = parsed.extracted_data || parsed;
      let rawVal = extObj[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      // Unwrap the value if it's stored in an object structure with a 'value' property
      if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
        rawVal = rawVal.value;
      }
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      const map = umbrellanizerMap[key] || {};
      
      const resolveSingle = (singleRaw: any) => {
        const r = String(singleRaw).trim();
        const rNorm = r.toLowerCase().replace(/\s+/g, ' ');
        // 1. Try matching the raw value directly
        let matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === rNorm);
        
        // 2. Try matching the umbrella_category if matching raw failed
        if (!matchedKey) {
          matchedKey = Object.keys(map).find(k => {
            const mappedVal = map[k] as any;
            if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
              return String(mappedVal.umbrella_category || '').trim().toLowerCase().replace(/\s+/g, ' ') === rNorm;
            }
            return false;
          });
        }

        if (matchedKey) {
          const mappedVal = map[matchedKey] as any;
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

  // Fetch all final cohort papers at once for client-side deep filtering
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch a large limit (e.g. 5000) to ensure we get all final cohort papers for client-side filtering
      const res = await fetch(`/api/insight/final-cohort?projectId=${projectId}&limit=5000&page=1`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const papers = json.papers || [];
      setAllPapers(papers);

      // Fetch Umbrellanizer results
      const umbRes = await fetch(`/api/umbrellanizer?project_id=${projectId}`);
      if (umbRes.ok) {
        const umbJson = await umbRes.json();
        const map: Record<string, Record<string, string>> = {};
        if (umbJson.results && Array.isArray(umbJson.results)) {
          umbJson.results.forEach((row: any) => {
            try {
              map[row.extracted_data_key] = JSON.parse(row.umbrella_mapping || '{}');
            } catch (e) {}
          });
        }
        setUmbrellanizerMap(map);
      }
    } catch (err) {
      showToast('Error loading final cohort data', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useAppSync({
    loadPapers: loadData,
    loadProjects: () => {},
    loadCalPapers: () => {},
    loadAssignPapers: () => {},
    loadDuplicatesCount: () => {},
    checkBatchStatus: () => {},
    loadScreeningPapers: () => {}
  });

  // Parse QA Assessment helpers with stage dominance, float score calculation, and trace mappings extraction
  const parseQaAssessment = useCallback((paper: any) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    if (!qaStr) return { score: 0, items: {}, traces: {} };
    try {
      const parsed = JSON.parse(qaStr);
      if (typeof parsed === 'object' && parsed !== null) {
        const qaObj = parsed.qa_scores || parsed;
        const logicTrace = parsed.logic_trace || {};
        const appraisalReasoning = logicTrace.appraisal_reasoning || {};
        
        let score = 0;
        const items: Record<string, string> = {};
        const traces: Record<string, { extraction_mapping?: string; evidence?: string }> = {};

        Object.entries(qaObj).forEach(([k, v]) => {
          const val = (v && typeof v === 'object' && 'value' in v) ? (v as any).value : v;
          items[k] = String(val);

          // Resolve appraisal reasoning for the key (e.g., qa1_aims -> qa1_aims_analysis)
          let traceVal = appraisalReasoning[k + '_analysis'] || appraisalReasoning[k] || '';
          let evidenceVal = '';

          if (v && typeof v === 'object') {
            const vObj = v as any;
            if (vObj.evidence) {
              evidenceVal = String(vObj.evidence);
            } else if (vObj.logic_trace?.evidence) {
              evidenceVal = String(vObj.logic_trace.evidence);
            }
          }
          traces[k] = { extraction_mapping: String(traceVal || ''), evidence: evidenceVal };

          // Parse numeric floats properly to support fractional QA points (e.g. 0.5)
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
  const parseExtractedData = useCallback((paper: any) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return {};
    try {
      const parsed = JSON.parse(extStr);
      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        const resolved: Record<string, any> = {};
        Object.entries(extObj).forEach(([k, v]) => {
          let val = v;
          if (v && typeof v === 'object' && 'value' in v) {
            val = (v as any).value;
          }
          if (Array.isArray(val)) {
            resolved[k] = val.map(item => resolveUmbrellanizerValue(item, k)).filter(Boolean);
          } else {
            resolved[k] = resolveUmbrellanizerValue(val, k);
          }
        });
        return resolved;
      }
    } catch (e) {}
    return {};
  }, [resolveUmbrellanizerValue]);

  // Helper to fetch original raw extracted data before umbrellanizer category mapping
  const getOriginalExtractedVal = useCallback((paper: any, key: string) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return null;
    try {
      const parsed = JSON.parse(extStr);
      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        let val = extObj[key];
        if (val && typeof val === 'object' && 'value' in val) {
          val = (val as any).value;
        }
        return val;
      }
    } catch (e) {}
    return null;
  }, []);

  // Parse Extracted Data logic traces & quotes dynamically from DB fields
  const parseExtractedTraces = useCallback((paper: any) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const extStr = isManualDominant 
      ? (paper.manual_extracted_data || paper.ai_extracted_data || '') 
      : (paper.ai_extracted_data || paper.manual_extracted_data || '');

    if (!extStr) return { mapping: {}, evidence: {} };
    try {
      const parsed = JSON.parse(extStr);
      const extObj = parsed.extracted_data || parsed;
      const logicTrace = parsed.logic_trace || {};
      const locateMapping = logicTrace.extraction_mapping || {};
      
      const mapping: Record<string, string> = {};
      const evidence: Record<string, string> = {};
      
      Object.keys(extObj).forEach(key => {
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
    const qaKeysSet = new Set<string>();
    const extKeysMap = new Map<string, Set<string>>();

    allPapers.forEach(p => {
      const { items } = parseQaAssessment(p);
      Object.keys(items).forEach(k => qaKeysSet.add(k));

      const ext = parseExtractedData(p);
      Object.entries(ext).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          if (!extKeysMap.has(k)) {
            extKeysMap.set(k, new Set());
          }
          if (Array.isArray(v)) {
            v.forEach(val => extKeysMap.get(k)!.add(String(val)));
          } else {
            extKeysMap.get(k)!.add(String(v));
          }
        }
      });
    });

    const extOptions: Record<string, string[]> = {};
    extKeysMap.forEach((valSet, key) => {
      extOptions[key] = Array.from(valSet).sort();
    });

    return {
      qaKeys: Array.from(qaKeysSet).sort(),
      extracted: extOptions
    };
  }, [allPapers, parseQaAssessment, parseExtractedData]);

  // Apply deep filtering
  const filteredPapers = useMemo(() => {
    return allPapers.filter(p => {
      // Search search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesSearch = 
          p.Paper_ID.toLowerCase().includes(term) ||
          (p.Title && p.Title.toLowerCase().includes(term)) ||
          (p.Authors && p.Authors.toLowerCase().includes(term)) ||
          (p.Abstract && p.Abstract.toLowerCase().includes(term));
        
        if (!matchesSearch) return false;
      }

      // QA Overall Score Filter
      const { score } = parseQaAssessment(p);
      if (minQaScore !== '' && score < minQaScore) return false;
      if (maxQaScore !== '' && score > maxQaScore) return false;

      // Extracted Key Filters
      const ext = parseExtractedData(p);
      for (const [extKey, targetVals] of Object.entries(selectedExtractedFilters)) {
        if (targetVals && targetVals.length > 0) {
          const val = ext[extKey];
          if (Array.isArray(val)) {
            const hasMatch = val.some(v => targetVals.includes(String(v)));
            if (!hasMatch) return false;
          } else {
            const valStr = String(val || '');
            if (!targetVals.includes(valStr)) return false;
          }
        }
      }

      // PDF Status Filter
      if (pdfFilter && p.Local_PDF_Status !== pdfFilter) return false;

      // Source Scope Filter
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

      // DOI Status Filter
      if (doiStatusFilter) {
        const hasDoi = !!(p.DOI && p.DOI.trim());
        if (doiStatusFilter === 'empty' && hasDoi) return false;
        if (doiStatusFilter === 'has_doi' && !hasDoi) return false;
      }

      // PDF Link Filter
      if (pdfLinkFilter) {
        const hasLink = !!(p.PDF_Link && p.PDF_Link.trim());
        if (pdfLinkFilter === 'empty' && hasLink) return false;
        if (pdfLinkFilter === 'has_link' && !hasLink) return false;
      }

      return true;
    });
  }, [allPapers, searchTerm, minQaScore, maxQaScore, selectedExtractedFilters, parseQaAssessment, parseExtractedData, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter]);

  // Client-side Column sorting logic
  const sortedPapers = useMemo(() => {
    const papersCopy = [...filteredPapers];
    if (!sortField) return papersCopy;

    papersCopy.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

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
  }, [searchTerm, minQaScore, maxQaScore, selectedExtractedFilters, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter]);

  const clearAllFilters = () => {
    setMinQaScore('');
    setMaxQaScore('');
    setSelectedExtractedFilters({});
    setPdfFilter('');
    setSourceFilter('');
    setDoiStatusFilter('');
    setPdfLinkFilter('');
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
    return count;
  }, [minQaScore, maxQaScore, selectedExtractedFilters, pdfFilter, sourceFilter, doiStatusFilter, pdfLinkFilter]);

  // Sync the active filters count back to the parent page header
  useEffect(() => {
    setActiveFiltersCount(activeFiltersCount);
  }, [activeFiltersCount, setActiveFiltersCount]);

  const toggleExtractedFilterValue = (key: string, val: string) => {
    setSelectedExtractedFilters(prev => {
      const current = prev[key] || [];
      const next = current.includes(val) 
        ? current.filter(v => v !== val)
        : [...current, val];
      return { ...prev, [key]: next };
    });
  };

  // High fidelity visual renderers for grid cells
  const getPdfStatusBadge = (status: string) => {
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

  const renderQaVal = (val: string) => {
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

  // Render extracted values as clean ordinary text with a small badge counter for duplicate values
  const renderExtractedVal = (val: any) => {
    if (val === undefined || val === null || val === '') {
      return <span className="text-muted-foreground/30">-</span>;
    }
    
    const processArray = (arr: any[]) => {
      const counts: Record<string, number> = {};
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
                <span className="px-0.5 py-0.2 text-[8px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full leading-none">
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

  const handleColumnSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIndicator = (field: string) => {
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
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors underline"
            >
              Clear All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Column 1: QA Score Limits */}
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

            {/* Column 3: Extracted Taxonomy Key Filters */}
            <div className="space-y-3 col-span-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Extracted Taxonomy Variables</span>
              {Object.keys(filterOptions.extracted).length === 0 ? (
                <span className="text-xs text-muted-foreground italic">No extracted variables found in the current cohort.</span>
              ) : (
                <div className="max-h-36 overflow-y-auto border border-border rounded-lg p-2 bg-secondary/15 space-y-3">
                  {Object.entries(filterOptions.extracted).map(([key, options]) => (
                    <div key={key} className="space-y-1">
                      <span className="text-[10px] font-bold text-foreground block bg-secondary/35 px-1 py-0.5 rounded">{key}</span>
                      <div className="pl-1 space-y-1">
                        {options.map(val => {
                          const isSelected = (selectedExtractedFilters[key] || []).includes(val);
                          return (
                            <button
                              key={val}
                              onClick={() => toggleExtractedFilterValue(key, val)}
                              className={`w-full flex items-center justify-between text-left text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                isSelected ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-secondary text-muted-foreground'
                              }`}
                            >
                              <span className="truncate pr-2">{val}</span>
                              {isSelected && <Check className="w-3 h-3 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 4: Paper Metadata Filters */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Paper Metadata</span>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Status</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full"
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
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full"
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
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full"
                    value={doiStatusFilter}
                    onChange={(e) => setDoiStatusFilter(e.target.value)}
                  >
                    <option value="">Any DOI</option>
                    <option value="empty">Empty DOI</option>
                    <option value="has_doi">Has DOI</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold text-muted-foreground uppercase">PDF Link</label>
                  <select
                    className="bg-secondary border border-border rounded px-1.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary font-bold w-full"
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

      {/* Wide Tabular Table Container */}
      <div className="flex-1 flex flex-col overflow-hidden bg-card border border-border rounded-xl shadow-sm">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : sortedPapers.length === 0 ? (
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

                    return (
                      <tr key={p.Paper_ID} className="hover:bg-secondary/15 transition-colors group">
                        {/* Essential database columns wrapped in ClickableCell */}
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
                        
                        {/* Dynamic QA Columns with copy popups (logic trace reads appraisal_reasoning) */}
                        {filterOptions.qaKeys.map((qaKey) => {
                          const val = items[qaKey];
                          const trace = traces[qaKey] || {};
                          const mapping = trace.extraction_mapping || '';
                          const evidence = trace.evidence || '';

                          return (
                            <td 
                              key={`cell-qa-${p.Paper_ID}-${qaKey}`} 
                              className="p-2 text-center bg-primary/5 border-l border-border/60 border-b border-border/50"
                              style={{ width: getColWidth(`qa:${qaKey}`, true), minWidth: getColWidth(`qa:${qaKey}`, true), maxWidth: getColWidth(`qa:${qaKey}`, true) }}
                            >
                              <ClickableCell 
                                valueToCopy={val}
                                traceInfo={{ mapping, evidence }}
                              >
                                {renderQaVal(val)}
                              </ClickableCell>
                            </td>
                          );
                        })}

                        {/* Dynamic Extracted Columns with copy popups (includes justification trace details) */}
                        {Object.keys(filterOptions.extracted).map((extKey) => {
                          const val = ext[extKey];
                          const mapping = extTraces.mapping[extKey] || '';
                          const evidence = extTraces.evidence[extKey] || '';
                          const justification = getUmbrellanizerJustification(val, extKey, p);
                          const originalVal = getOriginalExtractedVal(p, extKey);
                          const strVal = Array.isArray(val) ? val.join(', ') : String(val || '');
                          const originalStrVal = originalVal ? (Array.isArray(originalVal) ? originalVal.join(', ') : String(originalVal)) : undefined;

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
                    className="bg-secondary border border-border rounded px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary font-bold"
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
                    className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] font-bold px-2 select-none">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="p-1 hover:bg-background rounded-md text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
