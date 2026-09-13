import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  FileText,
  BookOpen,
  Sparkles,
  Maximize2,
  Minimize2,
  Database,
  Quote,
  Layers,
  Search,
  CheckCircle2,
  Cloud,
  FileCheck,
  AlertTriangle,
  Code
} from 'lucide-react';
import { extractMappingReasoning, extractEvidenceQuote } from '@/lib/services/trace-normalizer';
import {
  resolveUmbrellanizerValue,
  getUmbrellanizerJustification,
  getStageDominantExtractedDataStr,
  getStageDominantQualityAssessmentStr
} from '@/lib/services/taxonomy-resolver';

export interface CohortPaperDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: any | null;
  umbrellanizerMap?: Record<string, Record<string, string>>;
  mode: 'ide' | 'viewer';
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  currentIndex?: number;
  totalCount?: number;
}

export function CohortPaperDetailsModal({
  isOpen,
  onClose,
  paper,
  umbrellanizerMap = {},
  mode,
  onNavigate,
  hasPrev,
  hasNext,
  currentIndex = 0,
  totalCount = 0
}: CohortPaperDetailsModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'extraction' | 'qa' | 'raw'>('extraction');
  const [activeLeftTab, setActiveLeftTab] = useState<'pdf' | 'abstract'>('pdf');
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Self-hydrating Umbrellanizer mappings fallback
  const [internalUmbrellanizerMap, setInternalUmbrellanizerMap] = useState<Record<string, any>>(umbrellanizerMap || {});

  useEffect(() => {
    if (umbrellanizerMap && Object.keys(umbrellanizerMap).length > 0) {
      setInternalUmbrellanizerMap(umbrellanizerMap);
    }
  }, [umbrellanizerMap]);

  useEffect(() => {
    const projId = paper?.Project_ID || paper?.project_id;
    if (mode === 'ide' && (!internalUmbrellanizerMap || Object.keys(internalUmbrellanizerMap).length === 0) && projId) {
      fetch(`/api/umbrellanizer?project_id=${encodeURIComponent(projId)}`)
        .then(res => res.ok ? res.json() : null)
        .then(json => {
          if (json?.results && Array.isArray(json.results)) {
            const map: Record<string, any> = {};
            json.results.forEach((row: any) => {
              try {
                map[row.extracted_data_key] = JSON.parse(row.umbrella_mapping || '{}');
              } catch (e) {}
            });
            setInternalUmbrellanizerMap(map);
          }
        })
        .catch(() => {});
    }
  }, [mode, paper, internalUmbrellanizerMap]);

  const effectiveUmbrellanizerMap = useMemo(() => {
    return (umbrellanizerMap && Object.keys(umbrellanizerMap).length > 0) ? umbrellanizerMap : internalUmbrellanizerMap;
  }, [umbrellanizerMap, internalUmbrellanizerMap]);

  // Defensive navigation state resolution
  const effectiveHasPrev = hasPrev !== undefined ? hasPrev : (currentIndex > 1);
  const effectiveHasNext = hasNext !== undefined ? hasNext : (currentIndex > 0 && totalCount > 0 && currentIndex < totalCount);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && effectiveHasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && effectiveHasNext && onNavigate) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, effectiveHasPrev, effectiveHasNext, onNavigate, onClose]);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  // Parse QA Assessment using Stage-Dominant resolution
  const qaData = useMemo(() => {
    if (!paper) return { score: 0, items: {}, traces: {} };
    const qaStr = getStageDominantQualityAssessmentStr(paper);

    // If no QA payload exists, check for direct Overall_QA / overall_qa field
    if (!qaStr) {
      const directOverall = parseFloat(String(paper.Overall_QA ?? paper.overall_qa ?? '0')) || 0;
      return { score: directOverall, items: {}, traces: {} };
    }

    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      if (typeof parsed === 'object' && parsed !== null) {
        // Support all variations: parsed.qa_scores, parsed.scores, or parsed directly
        const scores = parsed.qa_scores || parsed.scores || parsed;
        const logicTrace = parsed.logic_trace || {};
        const reasoningTrace = logicTrace.appraisal_reasoning || parsed.appraisal_reasoning || logicTrace || {};

        let calculatedSum = 0;
        const items: Record<string, any> = {};
        const traces: Record<string, any> = {};

        Object.entries(scores).forEach(([k, v]) => {
          if (
            k === 'overall_score' || 
            k === 'total_score' || 
            k.startsWith('_') || 
            k === 'logic_trace' || 
            k === '_scientist_logic_trace' || 
            k === 'qa_scores' || 
            k === 'final_evaluation'
          ) return;

          let rawScore: any = v;
          let evidenceVal = '';

          if (v !== null && v !== undefined) {
            if (typeof v === 'object') {
              const vObj = v as any;
              if ('score' in vObj && vObj.score !== undefined && vObj.score !== null) {
                rawScore = vObj.score;
              } else if ('value' in vObj && vObj.value !== undefined && vObj.value !== null) {
                rawScore = vObj.value;
              } else {
                const entries = Object.entries(vObj);
                const nonTextMatch = entries.find(([key, val]) => {
                  const kLower = key.toLowerCase();
                  const isMeta = ['exact_quote', 'quote', 'evidence', 'text', 'snippet', 'reasoning', 'justification', 'analysis', 'rationale', 'explanation', 'logic_trace'].includes(kLower);
                  return !isMeta && (typeof val === 'number' || typeof val === 'boolean' || (typeof val === 'string' && val.length < 50));
                });
                rawScore = nonTextMatch ? nonTextMatch[1] : '';
              }

              if (typeof rawScore === 'object' && rawScore !== null) {
                if ('score' in rawScore) rawScore = (rawScore as any).score;
                else if ('value' in rawScore) rawScore = (rawScore as any).value;
                else rawScore = '';
              }

              if (vObj.exact_quote) evidenceVal = String(vObj.exact_quote);
              else if (vObj.quote) evidenceVal = String(vObj.quote);
              else if (vObj.evidence) evidenceVal = String(vObj.evidence);
              else if (vObj.text) evidenceVal = String(vObj.text);
              else if (vObj.logic_trace?.evidence) evidenceVal = String(vObj.logic_trace.evidence);
            }
          }

          const valStr = (rawScore !== undefined && rawScore !== null) ? String(rawScore) : '';
          const numVal = parseFloat(valStr);
          if (!isNaN(numVal)) {
            items[k] = numVal;
            calculatedSum += numVal;
          } else if (
            rawScore === true ||
            ['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())
          ) {
            items[k] = 1;
            calculatedSum += 1;
          } else {
            items[k] = valStr;
          }

          // Resolve reasoning / rationale (e.g. qa1_aims_analysis, qa1_aims, or nested rationale)
          const analysis = reasoningTrace[k + '_analysis'] 
            || reasoningTrace[k] 
            || (typeof v === 'object' && ((v as any).rationale || (v as any).justification || (v as any).reasoning || (v as any).analysis))
            || '';

          traces[k] = {
            rationale: String(analysis || ''),
            evidence: evidenceVal,
            extraction_mapping: String(analysis || '')
          };
        });

        // Resolve explicit overall_score or total_score if provided
        const explicitTotal = parsed.overall_score !== undefined && parsed.overall_score !== null
          ? Number(parsed.overall_score)
          : (parsed.total_score !== undefined && parsed.total_score !== null ? Number(parsed.total_score) : undefined);

        const finalScore = (explicitTotal !== undefined && !isNaN(explicitTotal) && explicitTotal > 0)
          ? explicitTotal
          : (calculatedSum > 0 
              ? Math.round(calculatedSum * 10) / 10 
              : (parseFloat(String(paper.Overall_QA ?? paper.overall_qa ?? '0')) || 0));

        return { score: finalScore, items, traces };
      }
    } catch (e) {
      const num = parseFloat(String(qaStr));
      if (!isNaN(num)) {
        return { score: num, items: {}, traces: {} };
      }
    }

    const fallbackScore = parseFloat(String(paper.Overall_QA ?? paper.overall_qa ?? '0')) || 0;
    return { score: fallbackScore, items: {}, traces: {} };
  }, [paper]);

  // Parse Extracted Data using Stage-Dominant resolution
  const { extractedData, rawExtObj, tracesMap, rawTokensMap } = useMemo(() => {
    if (!paper) return { extractedData: {}, rawExtObj: {}, tracesMap: {}, rawTokensMap: {} };
    const extStr = getStageDominantExtractedDataStr(paper);
    if (!extStr) return { extractedData: {}, rawExtObj: {}, tracesMap: {}, rawTokensMap: {} };

    try {
      const parsed = typeof extStr === 'string' ? JSON.parse(extStr) : extStr;
      if (typeof parsed === 'object' && parsed !== null) {
        const extObj = parsed.extracted_data || parsed;
        const tracesObj = parsed.extraction_mapping || parsed.logic_trace?.extraction_mapping || parsed.logic_trace || {};
        const resolved: Record<string, any> = {};
        const rawTokensMap: Record<string, string[]> = {};

        Object.entries(extObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace') return;
          let val = v;
          if (v && typeof v === 'object' && 'value' in v) {
            val = (v as any).value;
          }

          const rawTokens: string[] = [];
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

          rawTokensMap[k] = rawTokens;

          if (rawTokens.length === 0) {
            resolved[k] = '';
          } else {
            const mapped = Array.from(new Set(rawTokens.map(t => resolveUmbrellanizerValue(t, k, true, effectiveUmbrellanizerMap)).filter(Boolean)));
            resolved[k] = mapped.length > 1 ? mapped : (mapped[0] || '');
          }
        });

        return { extractedData: resolved, rawExtObj: extObj, tracesMap: tracesObj, rawTokensMap };
      }
    } catch (e) {}
    return { extractedData: {}, rawExtObj: {}, tracesMap: {}, rawTokensMap: {} };
  }, [paper, effectiveUmbrellanizerMap]);

  if (!isOpen || !paper) return null;

  // Local PDF status and path
  const rawLocalPdfPath = paper.Local_PDF_Path || paper.local_pdf_path;
  const localPdfPath = typeof rawLocalPdfPath === 'string' ? rawLocalPdfPath.trim() : '';
  const isValidPdfPath = !!localPdfPath && localPdfPath !== 'null' && localPdfPath !== 'undefined';
  const pdfStatusStr = String(paper.Local_PDF_Status || paper.local_pdf_status || '').toUpperCase();
  const hasLocalPdf = mode === 'ide' && isValidPdfPath && !['MISSING', 'FAILED', 'IGNORED'].includes(pdfStatusStr);
  const cloudPdfUrl = paper.PDF_Link || paper.pdf_link || paper.cloud_pdf_url || '';

  // Filter extracted keys
  const filteredExtractedKeys = Object.keys(extractedData).filter(k => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    const val = String(extractedData[k] || '').toLowerCase();
    const rawVal = String(rawExtObj[k] || '').toLowerCase();
    const just = getUmbrellanizerJustification(extractedData[k], k, paper, effectiveUmbrellanizerMap).toLowerCase();
    return k.toLowerCase().includes(q) || val.includes(q) || rawVal.includes(q) || just.includes(q);
  });

  // Filter QA keys
  const filteredQaKeys = Object.keys(qaData.items).filter(k => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return k.toLowerCase().includes(q) || String(qaData.items[k] || '').toLowerCase().includes(q);
  });

  return (
    <div className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-150 ${
      isFullscreen ? 'p-0' : 'p-2 sm:p-4'
    }`}>
      <div className={`bg-card border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-200 ${
        isFullscreen ? 'w-screen h-screen rounded-none border-0' : 'w-full h-full max-w-[96vw] max-h-[94vh] rounded-2xl'
      }`}>
        
        {/* Top Header Bar */}
        <div className="h-16 px-4 sm:px-6 border-b border-border bg-secondary/30 flex items-center justify-between shrink-0 gap-3">
          {/* Left: Paper ID, Navigation, Badges */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Paper Index Navigation */}
            <div className="flex items-center gap-1 bg-secondary/80 border border-border rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('prev')}
                disabled={!effectiveHasPrev}
                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Previous Paper (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-foreground px-1.5">
                {currentIndex > 0 ? `${currentIndex} / ${totalCount}` : paper.Paper_ID}
              </span>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate('next')}
                disabled={!effectiveHasNext}
                className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Next Paper (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Paper Title & Citation Meta */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md shrink-0">
                  {paper.Paper_ID}
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-foreground truncate max-w-lg" title={paper.Title}>
                  {paper.Title || 'Untitled Paper'}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 truncate">
                <span>{paper.Authors || 'Unknown Authors'}</span>
                <span>•</span>
                <span>{paper.Year || '-'}</span>
                <span>•</span>
                <span>{paper.Publisher || paper.Original_Publisher || 'Publisher N/A'}</span>
                <span>•</span>
                <span className="font-mono font-semibold text-foreground">{paper.citation_count ?? 0} citations</span>
              </div>
            </div>
          </div>

          {/* Right: Actions, Overall QA Score, Cloud/Local PDF Link, Fullscreen, Close */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Overall QA Score Badge */}
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-xl px-2.5 py-1 text-xs font-bold text-primary shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>QA: {qaData.score} / 8.0</span>
            </div>

            {/* Open Synced Cloud PDF Button (viewer mode OR in IDE mode when local PDF is missing but cloud link exists) */}
            {(mode === 'viewer' || (!hasLocalPdf && cloudPdfUrl)) && (
              <a
                href={cloudPdfUrl || (paper.DOI ? `https://doi.org/${paper.DOI}` : '#')}
                target="_blank"
                rel="noreferrer"
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs ${
                  cloudPdfUrl 
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                    : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
                }`}
                title="Open Synced Cloud PDF Document in new tab"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Open Cloud PDF</span>
                <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
              </a>
            )}

            {/* In SLR-IDE: Open Local PDF in New Tab if present */}
            {mode === 'ide' && hasLocalPdf && (
              <a
                href={`/api/pdf/serve?path=${encodeURIComponent(localPdfPath)}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground hover:text-primary border border-border font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                title="Open Local PDF in new browser tab"
              >
                <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">Open Tab</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/50 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Screen (Left: PDF / Abstract, Right: Extraction & QA) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Pane (50%): Paper Documentation / PDF Source */}
          <div className="w-full md:w-1/2 h-full flex flex-col border-b md:border-b-0 md:border-r border-border bg-secondary/10 overflow-hidden">
            {/* Left Pane Toolbar */}
            <div className="px-4 py-2 border-b border-border bg-card/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {mode === 'ide' && hasLocalPdf && (
                  <div className="inline-flex p-0.5 rounded-lg bg-secondary border border-border text-[10px]">
                    <button
                      type="button"
                      onClick={() => setActiveLeftTab('pdf')}
                      className={`px-2 py-0.5 rounded-md transition-all font-bold ${
                        activeLeftTab === 'pdf' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Local Sourced PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLeftTab('abstract')}
                      className={`px-2 py-0.5 rounded-md transition-all font-bold ${
                        activeLeftTab === 'abstract' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      Abstract & Info
                    </button>
                  </div>
                )}
                {(mode === 'viewer' || !hasLocalPdf) && (
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    {mode === 'viewer' ? 'Paper Documentation & Cloud Sync' : 'Paper Documentation & Sourced Records'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {paper.DOI && (
                  <a
                    href={`https://doi.org/${paper.DOI}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-mono transition-colors"
                    title="Open Digital Object Identifier (DOI)"
                  >
                    <span>doi:{paper.DOI}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Left Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
              {mode === 'ide' && hasLocalPdf && activeLeftTab === 'pdf' ? (
                <div className="w-full h-full relative rounded-xl overflow-hidden border border-border bg-background shadow-xs">
                  <iframe
                    src={`/api/pdf/serve?path=${encodeURIComponent(localPdfPath)}#toolbar=1`}
                    className="w-full h-full border-none"
                    title="Local Sourced PDF Document"
                  />
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl mx-auto">
                  {/* Cloud PDF Action Banner for Viewer or IDE when local PDF is not yet downloaded */}
                  {(mode === 'viewer' || (!hasLocalPdf && cloudPdfUrl)) && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 shadow-xs">
                      <div>
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Cloud className="w-4 h-4 text-primary" />
                          {mode === 'viewer' ? 'Synced Cloud Full-Text Literature' : 'Cloud Full-Text Literature'}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {mode === 'viewer'
                            ? 'Full-text PDF document is synced and verified in the cloud repository.'
                            : 'Local PDF has not been fetched to disk yet. You can inspect the cloud-synced document directly.'}
                        </p>
                      </div>
                      {cloudPdfUrl ? (
                        <a
                          href={cloudPdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                        >
                          <span>Open Cloud PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No cloud link recorded</span>
                      )}
                    </div>
                  )}

                  {/* Abstract Card */}
                  <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5" />
                        Abstract
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(paper.Abstract || '', 'abstract')}
                        className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        {copiedKey === 'abstract' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey === 'abstract' ? 'Copied' : 'Copy Abstract'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line select-text">
                      {paper.Abstract || 'No abstract available for this paper record.'}
                    </p>
                  </div>

                  {/* Bibliographic Metadata Table */}
                  <div className="p-4 rounded-xl bg-card border border-border shadow-xs space-y-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 pb-1 border-b border-border/60">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Bibliographic Ingestion Metadata
                    </span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Digital Object Identifier (DOI)</span>
                        <span className="font-mono text-foreground">{paper.DOI || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Publication Year</span>
                        <span className="font-semibold text-foreground">{paper.Year || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Publisher</span>
                        <span className="text-foreground">{paper.Publisher || paper.Original_Publisher || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Import Source</span>
                        <span className="text-foreground">{paper.Import_Source || paper.Source || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Citations Count</span>
                        <span className="font-mono font-bold text-foreground">{paper.citation_count ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground block">Local PDF Status</span>
                        <span className="font-mono text-[10px] font-bold uppercase text-primary">{paper.Local_PDF_Status || paper.local_pdf_status || 'UNKNOWN'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Pane (50%): Comprehensive Extraction, Logic Traces & QA Breakdown */}
          <div className="w-full md:w-1/2 h-full flex flex-col bg-card overflow-hidden">
            {/* Right Pane Tabs & Search Filter */}
            <div className="px-4 py-2.5 border-b border-border bg-secondary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <div className="inline-flex p-0.5 rounded-lg bg-secondary border border-border text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveRightTab('extraction')}
                  className={`px-3 py-1 rounded-md transition-all font-bold flex items-center gap-1.5 ${
                    activeRightTab === 'extraction' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Database className="w-3 h-3" />
                  <span>Variables & Traces ({Object.keys(extractedData).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('qa')}
                  className={`px-3 py-1 rounded-md transition-all font-bold flex items-center gap-1.5 ${
                    activeRightTab === 'qa' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Quality Appraisal ({Object.keys(qaData.items).length > 0 ? `${Object.keys(qaData.items).length}/8` : '8/8'})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRightTab('raw')}
                  className={`px-3 py-1 rounded-md transition-all font-bold flex items-center gap-1.5 ${
                    activeRightTab === 'raw' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  <span>Raw JSON</span>
                </button>
              </div>

              {/* Search Within Details */}
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter fields..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-secondary/70 border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-medium"
                />
              </div>
            </div>

            {/* Right Pane Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              
              {/* TAB 1: Extracted Variables & Logic Traces (RQs) */}
              {activeRightTab === 'extraction' && (
                <div className="space-y-4">
                  {filteredExtractedKeys.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-xs">
                      No extracted variables matched your search filter.
                    </div>
                  ) : (
                    filteredExtractedKeys.map((key) => {
                      const mappedVal = extractedData[key];
                      const rawVal = rawExtObj[key];
                      const keyRawTokens = rawTokensMap[key] || [];
                      const actualRawVal = (rawVal && typeof rawVal === 'object' && 'value' in rawVal) ? rawVal.value : rawVal;
                      const reasoning = extractMappingReasoning(key, tracesMap, rawVal);
                      const evidenceQuote = extractEvidenceQuote(key, rawVal, tracesMap) || extractEvidenceQuote(key, tracesMap[key]) || (typeof tracesMap[key] === 'string' ? tracesMap[key] : '');

                      // Compute Umbrellanizer justification per token and overall
                      const tokenJustifications: { rawToken: string; mappedCategory: string; justification: string }[] = [];
                      keyRawTokens.forEach(t => {
                        const mappedCat = resolveUmbrellanizerValue(t, key, true, effectiveUmbrellanizerMap);
                        const just = getUmbrellanizerJustification(t, key, paper, effectiveUmbrellanizerMap);
                        if (just) {
                          tokenJustifications.push({ rawToken: t, mappedCategory: mappedCat, justification: just });
                        }
                      });

                      const fallbackJust = getUmbrellanizerJustification(actualRawVal ?? mappedVal, key, paper, effectiveUmbrellanizerMap);
                      if (tokenJustifications.length === 0 && fallbackJust) {
                        tokenJustifications.push({
                          rawToken: Array.isArray(actualRawVal) ? actualRawVal.join(', ') : String(actualRawVal || ''),
                          mappedCategory: Array.isArray(mappedVal) ? mappedVal.join(', ') : String(mappedVal || ''),
                          justification: fallbackJust
                        });
                      }

                      const uniqueJustifications = Array.from(new Set(tokenJustifications.map(tj => tj.justification)));
                      const isUniformJustification = uniqueJustifications.length === 1;
                      const umbrellanizerJustification = uniqueJustifications.join(' || ') || fallbackJust || '';

                      const formattedKey = key
                        .replace(/_/g, ' ')
                        .replace(/^rq\d+[a-z]?\s*/i, '')
                        .toUpperCase();

                      return (
                        <div
                          key={key}
                          className="p-4 rounded-xl border border-border/80 bg-secondary/15 hover:border-border transition-colors space-y-3 shadow-xs"
                        >
                          {/* Variable Header & Category Badge */}
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/50">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                                {key}
                              </span>
                              <span className="text-xs font-bold text-foreground">
                                {formattedKey}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopy(Array.isArray(mappedVal) ? mappedVal.join(', ') : String(mappedVal || ''), `val-${key}`)}
                              className="text-[10px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors shrink-0"
                            >
                              {copiedKey === `val-${key}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === `val-${key}` ? 'Copied' : 'Copy Value'}</span>
                            </button>
                          </div>

                          {/* Top Grid: Umbrellanized Value & Raw Extracted Tokens */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Umbrellanized Value (Canonical Taxonomy) */}
                            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                <Sparkles className="w-3 h-3 text-primary" />
                                Umbrellanized Value (Taxonomy)
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {Array.isArray(mappedVal) && mappedVal.length > 0 ? (
                                  mappedVal.map((v, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-xs font-bold shadow-2xs"
                                    >
                                      {v}
                                    </span>
                                  ))
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30 text-xs font-bold shadow-2xs">
                                    {mappedVal || 'None / Not Stated'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Raw Extracted Literal Token(s) */}
                            <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                                Raw Extracted Literal Token(s)
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap font-mono">
                                {keyRawTokens.length > 0 ? (
                                  keyRawTokens.map((t, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded bg-background/80 border border-border text-[11px] text-foreground font-mono">
                                      {t}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground italic font-sans">
                                    {actualRawVal ? String(typeof actualRawVal === 'object' ? JSON.stringify(actualRawVal) : actualRawVal) : 'None / Not Stated'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Umbrellanizer Taxonomy Justification */}
                          {umbrellanizerJustification && (
                            <div className="space-y-1.5 bg-indigo-500/5 dark:bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20 shadow-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5" />
                                  Umbrellanizer Taxonomy Justification
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(umbrellanizerJustification, `umb-just-${key}`)}
                                  className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  {copiedKey === `umb-just-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                  <span>{copiedKey === `umb-just-${key}` ? 'Copied' : 'Copy Justification'}</span>
                                </button>
                              </div>

                              {!isUniformJustification && tokenJustifications.length > 1 ? (
                                <div className="space-y-2 pt-1">
                                  {tokenJustifications.map((tj, idx) => (
                                    <div key={idx} className="text-xs text-foreground/90 space-y-0.5 border-l-2 border-indigo-500/40 pl-2.5">
                                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                        <span className="font-mono bg-background/60 px-1.5 py-0.2 rounded border border-border/60">{tj.rawToken}</span>
                                        <span>→</span>
                                        <span className="font-bold">{tj.mappedCategory}</span>
                                      </div>
                                      <p className="text-[11px] text-foreground/80 leading-relaxed italic">
                                        "{tj.justification}"
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {tokenJustifications.length > 0 && tokenJustifications[0].rawToken && (
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                                      <span className="font-mono bg-background/60 px-1.5 py-0.2 rounded border border-border/60">
                                        {tokenJustifications.map(t => t.rawToken).join(', ')}
                                      </span>
                                      <span>→</span>
                                      <span className="font-bold">
                                        {Array.isArray(mappedVal) ? mappedVal.join(', ') : String(mappedVal || '')}
                                      </span>
                                    </div>
                                  )}
                                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                                    {umbrellanizerJustification}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mapping Reasoning (Stage 4 Miner) */}
                          {reasoning && (
                            <div className="space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/40">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Literature Extraction Reasoning (Stage 4 Miner):
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(reasoning, `reason-${key}`)}
                                  className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                  {copiedKey === `reason-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                  <span>{copiedKey === `reason-${key}` ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                                {reasoning}
                              </p>
                            </div>
                          )}

                          {/* Direct Verbatim Evidence Quote */}
                          {evidenceQuote && (
                            <div className="space-y-1 bg-primary/5 p-2.5 rounded-lg border border-primary/20">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                                  <Quote className="w-3 h-3" />
                                  Verbatim Literature Evidence Quote:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(evidenceQuote, `quote-${key}`)}
                                  className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                                >
                                  {copiedKey === `quote-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                  <span>{copiedKey === `quote-${key}` ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <p className="text-xs text-foreground italic leading-relaxed border-l-2 border-primary pl-2.5">
                                "{evidenceQuote}"
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: Quality Assessment & Appraisal Breakdown (QAs) */}
              {activeRightTab === 'qa' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-foreground">
                        Stage 3 Scientist Quality Appraisal
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Double-blind calibrated appraisal across 8 scientific rigor dimensions.
                      </p>
                    </div>
                    <div className="px-3 py-1 rounded-xl bg-primary text-primary-foreground font-black text-xs shadow-xs">
                      Total: {qaData.score} / 8.0
                    </div>
                  </div>

                  {filteredQaKeys.map((key) => {
                    const rawScore = qaData.items[key];
                    const numScore = typeof rawScore === 'number' ? rawScore : parseFloat(String(rawScore));
                    const score = isNaN(numScore) ? 0 : numScore;
                    const trace = qaData.traces[key] || {};
                    const rationale = (typeof trace === 'object' && trace !== null)
                      ? (trace.rationale || trace.justification || trace.reasoning || trace.extraction_mapping || '')
                      : (typeof trace === 'string' ? trace : '');
                    const evidenceQuote = (typeof trace === 'object' && trace !== null) ? trace.evidence : '';

                    return (
                      <div
                        key={key}
                        className="p-4 rounded-xl border border-border/80 bg-secondary/15 space-y-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-primary uppercase bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                              {key.toUpperCase()}
                            </span>
                            <span className="text-xs font-bold text-foreground">
                              {key.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </div>

                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                            score >= 1.0 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : score >= 0.5 
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}>
                            Score: {score}
                          </span>
                        </div>

                        {rationale && (
                          <div className="space-y-1 bg-secondary/30 p-2.5 rounded-lg border border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Appraisal Justification & Analysis:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(rationale, `qa-${key}`)}
                                className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                              >
                                {copiedKey === `qa-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>{copiedKey === `qa-${key}` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                              {rationale}
                            </p>
                          </div>
                        )}

                        {evidenceQuote && (
                          <div className="space-y-1 bg-primary/5 p-2.5 rounded-lg border border-primary/20">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                                <Quote className="w-3 h-3" />
                                Verbatim Literature Evidence Quote:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(evidenceQuote, `quote-qa-${key}`)}
                                className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                              >
                                {copiedKey === `quote-qa-${key}` ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                                <span>{copiedKey === `quote-qa-${key}` ? 'Copied' : 'Copy'}</span>
                              </button>
                            </div>
                            <p className="text-xs text-foreground italic leading-relaxed border-l-2 border-primary pl-2.5">
                              "{evidenceQuote}"
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 3: Raw Ingestion Payload */}
              {activeRightTab === 'raw' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-border">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Database Paper Object</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(JSON.stringify(paper, null, 2), 'raw-json')}
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'raw-json' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'raw-json' ? 'Copied' : 'Copy Complete JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-secondary/40 border border-border rounded-xl text-[11px] font-mono overflow-x-auto text-foreground select-all leading-relaxed">
                    {JSON.stringify(paper, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-2.5 border-t border-border bg-secondary/30 flex items-center justify-between shrink-0 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">Navigation:</span>
            <span>Use Left / Right arrow keys to switch papers, Esc to close.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-bold border border-border transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
export default CohortPaperDetailsModal;
