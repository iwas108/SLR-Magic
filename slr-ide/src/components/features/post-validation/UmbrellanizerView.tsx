'use client';

import React, { useState } from 'react';
import { Play, Loader2, HelpCircle, RotateCw, Copy, Check, X, BarChart3 } from 'lucide-react';
import { useUmbrellanizer } from '@/hooks/useUmbrellanizer';
import { extractMappingReasoning } from '@/lib/services/trace-normalizer';
import UmbrellanizerWizard from './UmbrellanizerWizard';
import QuickOverviewModal from './QuickOverviewModal';

interface UmbrellanizerViewProps {
  projectId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface TooltipState {
  id: string;
  title: string;
  content: string;
}

export default function UmbrellanizerView({ projectId, showToast }: UmbrellanizerViewProps) {
  const [showQuickOverview, setShowQuickOverview] = useState(false);
  const {
    minerPapers,
    umbrellaResults,
    loading,
    wizardStep,
    setWizardStep,
    isRunning,
    runError,
    getExtractedKeys,
    getUniqueTokens,
    runUmbrellanizer,
    loadData,
    activeJobId
  } = useUmbrellanizer(projectId, showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCellClick = (e: React.MouseEvent, id: string, title: string, content: string) => {
    e.stopPropagation();
    if (activeTooltip?.id === id) {
      setActiveTooltip(null);
      return;
    }
    setActiveTooltip({ id, title, content });
  };

  const handleCopy = (e: React.MouseEvent, content: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedId(content);
    setTimeout(() => setCopiedId(null), 2000);
  };

  React.useEffect(() => {
    const handleGlobalClick = () => {
      setActiveTooltip(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const extractedKeys = getExtractedKeys();

  // Find mapping results and parse them
  const mappingsByKey: Record<string, Record<string, { umbrella_category: string; justification: string }>> = {};
  umbrellaResults.forEach((res) => {
    try {
      if (res.status === 'SUCCESS' && res.umbrella_mapping) {
        mappingsByKey[res.extracted_data_key] = JSON.parse(res.umbrella_mapping);
      }
    } catch (e) {
      console.error(`Failed to parse umbrella mapping for key ${res.extracted_data_key}:`, e);
    }
  });

  const getUmbrellaValue = (key: string, rawVal: any) => {
    const isNotStated = (v: any): boolean => {
      if (typeof v === 'string') return v.trim().toUpperCase() === 'NOT_STATED';
      if (Array.isArray(v)) return v.some(item => typeof item === 'string' && item.trim().toUpperCase() === 'NOT_STATED');
      return false;
    };

    if (!rawVal || isNotStated(rawVal)) {
      return {
        isNotStated: true,
        items: [{ value: 'NOT_STATED', count: 1, justification: 'Default mapped.' }]
      };
    }

    const keyMap = mappingsByKey[key];
    if (!keyMap) return null;

    const resolve = (val: string) => {
      const v = String(val).trim();
      if (v.toUpperCase() === 'NOT_STATED') {
        return { value: 'NOT_STATED', justification: 'Default mapped.' };
      }
      const mapped = keyMap[v];
      return mapped ? { value: mapped.umbrella_category, justification: mapped.justification } : null;
    };

    if (Array.isArray(rawVal)) {
      const resolved = rawVal.map(resolve).filter(Boolean) as { value: string; justification: string }[];
      if (resolved.length === 0) return null;
      
      const counts: Record<string, number> = {};
      const justifications: Record<string, string[]> = {};
      resolved.forEach((r) => {
        counts[r.value] = (counts[r.value] || 0) + 1;
        if (!justifications[r.value]) {
          justifications[r.value] = [];
        }
        justifications[r.value].push(r.justification);
      });

      const items = Object.entries(counts).map(([value, count]) => ({
        value,
        count,
        justification: Array.from(new Set(justifications[value])).join(' || ')
      }));

      return {
        isNotStated: false,
        items
      };
    } else if (typeof rawVal === 'string') {
      const resolved = resolve(rawVal);
      if (!resolved) return null;
      return {
        isNotStated: resolved.value === 'NOT_STATED',
        items: [{ value: resolved.value, count: 1, justification: resolved.justification }]
      };
    }
    return null;
  };

  // Filter papers based on search query
  const filteredPapers = minerPapers.filter((paper) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    
    // Check paper basic metadata
    if (paper.Paper_ID.toLowerCase().includes(query)) return true;
    if (paper.Title.toLowerCase().includes(query)) return true;
    if (paper.Authors?.toLowerCase().includes(query)) return true;

    // Check extracted data values & mapped umbrella terms
    for (const key of extractedKeys) {
      const fieldData = paper.extracted_data[key];
      if (fieldData) {
        const rawVal = fieldData.value;
        if (Array.isArray(rawVal)) {
          if (rawVal.some(v => String(v).toLowerCase().includes(query))) return true;
        } else if (rawVal && String(rawVal).toLowerCase().includes(query)) {
          return true;
        }
        
        const umbrellaInfo = getUmbrellaValue(key, rawVal);
        if (umbrellaInfo && umbrellaInfo.items.some(item => item.value.toLowerCase().includes(query))) return true;
      }
    }
    return false;
  });

  // Calculate pagination bounds
  const totalItems = filteredPapers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPapers = filteredPapers.slice(startIndex, startIndex + itemsPerPage);

  // Reset page index if filtered query shrinks dataset size
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Top Controls */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold text-base text-foreground">Post-Pipeline Token Umbrellanizer</h2>
          <p className="text-[10px] text-muted-foreground font-medium">
            Review and run LLM taxonomy normalization across primary datasets passing Miner screening.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Spreadsheet search bar */}
          <input
            type="text"
            placeholder="Search papers or taxonomy terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold w-64 shadow-inner"
          />
          <button
            onClick={loadData}
            disabled={loading}
            title="Refresh paper dataset"
            className="p-1.5 bg-secondary/35 hover:bg-secondary/70 disabled:opacity-40 disabled:cursor-not-allowed border border-border text-foreground rounded-lg transition-colors flex items-center justify-center shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowQuickOverview(true)}
            disabled={loading || extractedKeys.length === 0}
            className="px-4 py-2 bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed border border-border text-foreground font-bold rounded-lg text-xs flex items-center gap-2 shadow-sm transition-all select-none"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Quick Overview
          </button>
          <button
            onClick={() => setWizardStep(1)}
            disabled={loading || extractedKeys.length === 0}
            className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-2 shadow-md shadow-primary/20 transition-all select-none"
          >
            <Play className="w-3.5 h-3.5" />
            Run Umbrellanizer
          </button>
        </div>
      </div>

      {/* Main Table view */}
      <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground font-semibold">Loading primary papers corpus...</span>
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <h3 className="font-bold text-sm text-foreground mb-1">
              {searchQuery ? 'No Matching Search Results' : 'No Miner Passed Papers'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              {searchQuery 
                ? 'Try adjusting your keywords or clearing the search filter.' 
                : 'Currently no papers have passed the Stage 4 Miner pipeline stage with INCLUDE status. Run semantic extraction to feed variables.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto border-b border-border">
              <table className="w-full text-left border-collapse text-[11px] min-w-[1200px]">
                <thead className="bg-secondary/90 border-b-2 border-border/80 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-10 select-none backdrop-blur-md shadow-sm">
                  <tr>
                    <th className="p-3 border-r border-b-2 border-border min-w-[200px] bg-secondary/90 font-extrabold text-foreground tracking-widest text-[9px] border-b-2" rowSpan={2}>Paper Reference</th>
                    {extractedKeys.map((key) => (
                      <th key={key} className="p-2.5 border-r border-border text-center bg-secondary/70 text-foreground font-black tracking-widest text-[9px]" colSpan={3}>
                        {key.replace('rq', 'RQ').replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-border bg-secondary/40 text-[8px] font-extrabold tracking-wide">
                    {extractedKeys.map((key) => (
                      <React.Fragment key={`${key}-headers`}>
                        <th className="p-2 border-r border-border text-left w-36 text-muted-foreground bg-secondary/15 font-bold">Raw Value</th>
                        <th className="p-2 border-r border-border text-left w-36 text-muted-foreground bg-secondary/15 font-bold">Evidence</th>
                        <th className="p-2 border-r border-border text-left w-36 text-primary bg-primary/5 font-extrabold">Umbrella Term</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedPapers.map((paper) => (
                    <tr key={paper.Paper_ID} className="hover:bg-secondary/5 font-semibold text-foreground">
                      <td className="p-2.5 border-r border-border max-w-[240px] truncate leading-normal bg-secondary/5">
                        <div className="font-bold text-foreground font-mono">{paper.Paper_ID}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{paper.Title}</div>
                      </td>
                      {extractedKeys.map((key) => {
                        const data = paper.extracted_data[key];
                        const rawVal = data?.value;
                        const rawEvidence = data?.evidence;
                        const hasRawVal = rawVal && rawVal !== 'NOT_STATED';
                        
                        // Resolve logic_trace.extraction_mapping for hover mapping tooltip using Centralized Trace Normalizer Utility
                        const logicTrace = paper.logic_trace || {};
                        const locateMapping = logicTrace.extraction_mapping || logicTrace || {};
                        const logicTraceText = extractMappingReasoning(key, locateMapping, data) || 'No trace mapping logged.';

                        // Resolve umbrella terms mapping (Rule Q12)
                        const umbrellaInfo = getUmbrellaValue(key, rawVal);

                        const renderRawVal = () => {
                          if (!hasRawVal) return <span className="text-muted-foreground/45 italic font-medium">NOT_STATED</span>;
                          if (Array.isArray(rawVal)) {
                            return (
                              <div className="flex flex-wrap gap-1">
                                {rawVal.map((v, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-secondary/60 text-foreground font-mono text-[9px] border border-border/30 shadow-sm">
                                    {v}
                                  </span>
                                ))}
                              </div>
                            );
                          }
                          return <span className="font-mono text-[10px] font-semibold">{rawVal}</span>;
                        };

                        const isCurrentActive = (type: string) => activeTooltip?.id === `${paper.Paper_ID}-${key}-${type}`;

                        return (
                          <React.Fragment key={`${paper.Paper_ID}-${key}`}>
                            {/* Raw value column with popup on click */}
                            <td 
                              onClick={(e) => hasRawVal && handleCellClick(e, `${paper.Paper_ID}-${key}-trace`, "Extraction Logic Trace", logicTraceText)}
                              className={`p-2 border-r border-border max-w-[150px] transition-colors ${
                                hasRawVal ? 'cursor-pointer hover:bg-secondary/15 select-none' : ''
                              } ${isCurrentActive('trace') ? 'bg-secondary/20' : ''}`}
                            >
                              {renderRawVal()}
                            </td>
                            {/* Evidence column */}
                            <td 
                              onClick={(e) => rawEvidence && rawEvidence !== 'NOT_STATED' && handleCellClick(e, `${paper.Paper_ID}-${key}-evidence`, "Extracted Quote Evidence", rawEvidence)}
                              className={`p-2 border-r border-border max-w-[150px] bg-secondary/5 transition-colors ${
                                rawEvidence && rawEvidence !== 'NOT_STATED' ? 'cursor-pointer hover:bg-secondary/15 select-none' : ''
                              } ${isCurrentActive('evidence') ? 'bg-secondary/20' : ''}`}
                            >
                              <span className="text-muted-foreground truncate block text-[10px]">
                                {rawEvidence && rawEvidence !== 'NOT_STATED' ? rawEvidence : <span className="text-muted-foreground/35 italic">NOT_STATED</span>}
                              </span>
                            </td>
                            {/* Umbrella terms column */}
                            <td 
                              onClick={(e) => {
                                if (umbrellaInfo && !umbrellaInfo.isNotStated) {
                                  const allJustifications = umbrellaInfo.items.map(item => `${item.value}:\n${item.justification}`).join('\n\n');
                                  handleCellClick(e, `${paper.Paper_ID}-${key}-umbrella`, "Normalization Justification", allJustifications);
                                }
                              }}
                              className={`p-2 border-r border-border max-w-[150px] transition-colors ${
                                umbrellaInfo && !umbrellaInfo.isNotStated ? 'cursor-pointer hover:bg-primary/10 select-none' : ''
                              } ${isCurrentActive('umbrella') ? 'bg-primary/10' : ''}`}
                            >
                              {umbrellaInfo ? (
                                umbrellaInfo.isNotStated ? (
                                  <span className="text-muted-foreground/45 italic font-medium select-none">NOT_STATED</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {umbrellaInfo.items.map((item, i) => (
                                      <span key={i} className="px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25 font-mono text-[9px] shadow-sm font-bold">
                                        {item.value}
                                        {item.count > 1 && (
                                          <span className="ml-1 px-1 py-0.2 text-[8px] bg-primary text-primary-foreground rounded-full font-mono">
                                            {item.count}
                                          </span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                )
                              ) : hasRawVal ? (
                                <span className="text-muted-foreground/50 text-[10px] flex items-center gap-1.5 select-none font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/45 animate-ping" />
                                  Pending Run
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30 text-[10px] italic select-none">Not Stated</span>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paging Footer controls */}
            <div className="px-4 py-3 bg-secondary/15 flex items-center justify-between text-xs select-none shrink-0 border-t border-border">
              <div className="flex items-center gap-4 text-muted-foreground font-semibold">
                <span>
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} papers
                </span>
                <div className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="bg-card border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-primary font-bold text-foreground font-mono"
                  >
                    {[10, 20, 50].map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 bg-card hover:bg-secondary border border-border rounded-md font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                >
                  Previous
                </button>
                <span className="font-bold text-foreground font-mono">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 bg-card hover:bg-secondary border border-border rounded-md font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed text-foreground"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Stepper overlay modal */}
      {wizardStep > 0 && (
        <UmbrellanizerWizard
          projectId={projectId}
          extractedKeys={extractedKeys}
          getUniqueTokens={getUniqueTokens}
          runUmbrellanizer={runUmbrellanizer}
          isRunning={isRunning}
          runError={runError}
          activeJobId={activeJobId}
          step={wizardStep}
          setStep={setWizardStep}
          onClose={() => setWizardStep(0)}
        />
      )}

      {/* Quick Overview Modal */}
      {showQuickOverview && (
        <QuickOverviewModal
          projectId={projectId}
          papers={minerPapers}
          extractedKeys={extractedKeys}
          mappingsByKey={mappingsByKey}
          onClose={() => setShowQuickOverview(false)}
        />
      )}

      {/* Global Tooltip Portal Container */}
      {/* Global Tooltip Side-Pane Container */}
      {activeTooltip && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="fixed top-20 right-6 bg-card border border-border p-4 rounded-xl shadow-2xl z-[100] w-80 animate-in slide-in-from-right-5 duration-200 select-text pointer-events-auto flex flex-col max-h-[60vh]"
        >
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2.5 select-none">
            <span className="font-bold text-[10px] uppercase tracking-wider text-primary">{activeTooltip.title}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => handleCopy(e, activeTooltip.content)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Copy to clipboard"
              >
                {copiedId === activeTooltip.content ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => setActiveTooltip(null)}
                className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors"
                title="Dismiss details"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-foreground font-mono leading-relaxed overflow-y-auto whitespace-pre-wrap flex-1">
            {activeTooltip.content}
          </p>
        </div>
      )}
    </div>
  );
}
