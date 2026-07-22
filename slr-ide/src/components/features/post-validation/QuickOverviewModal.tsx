'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronDown, ChevronUp, BarChart3, Download, HelpCircle, Printer } from 'lucide-react';
import { MinerPaper } from '@/hooks/useUmbrellanizer';
import { TaxonomyTrendsPrintDocument } from './TaxonomyTrendsPrintDocument';

interface QuickOverviewModalProps {
  projectId: string;
  papers: MinerPaper[];
  extractedKeys: string[];
  mappingsByKey: Record<string, Record<string, { umbrella_category: string; justification: string }>>;
  onClose: () => void;
}

interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
  justifications: string[];
}

export default function QuickOverviewModal({
  projectId,
  papers,
  extractedKeys,
  mappingsByKey,
  onClose
}: QuickOverviewModalProps) {
  const [projectQuestions, setProjectQuestions] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(extractedKeys[0] || null);
  const [activeJustificationKey, setActiveJustificationKey] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Fetch project questions for dynamic labels
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.project) {
          setProjectQuestions(data.project.research_questions || data.project.questions || '');
        }
      })
      .catch((err) => console.error('Failed to load project details for overview:', err));
  }, [projectId]);

  const handleDownloadJson = () => {
    const downloadData = {
      project_id: projectId,
      total_papers: papers.length,
      trends: Object.fromEntries(
        extractedKeys.map(key => [
          key,
          (stats[key] || []).map(s => ({
            category: s.category,
            count: s.count,
            percentage: Number(s.percentage.toFixed(2)),
            justifications: s.justifications
          }))
        ])
      )
    };
    const blob = new Blob([JSON.stringify(downloadData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project_${projectId}_umbrellanizer_trends.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 200);
  };

  // Helper function to dynamically map research question
  const getMappedResearchQuestion = (key: string) => {
    if (!projectQuestions) return key.replace('rq', 'RQ').replace(/_/g, ' ');
    const lines = projectQuestions.split('\n').map(l => l.trim()).filter(Boolean);
    const match = key.match(/^rq(\d+)(?:_?([a-z]))?/i);
    if (!match) return key.replace('rq', 'RQ').replace(/_/g, ' ');
    
    const num = match[1] + (match[2] || '');
    const targetPrefix = `rq${num}`;
    const targetPrefix2 = `rq ${num}`;
    
    const found = lines.find(line => {
      const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
    });
    return found || key.replace('rq', 'RQ').replace(/_/g, ' ');
  };

  // Compute stats for each key
  const stats = useMemo(() => {
    const results: Record<string, CategoryStat[]> = {};
    const totalPapers = papers.length;

    extractedKeys.forEach((key) => {
      const frequency: Record<string, number> = {};
      const justifications: Record<string, Set<string>> = {};
      const keyMap = mappingsByKey[key] || {};

      papers.forEach((paper) => {
        const fieldData = paper.extracted_data[key];
        if (!fieldData) return;

        let rawVal = fieldData.value;
        if (!rawVal) return;

        // Collect resolved items
        const resolvedSet = new Set<string>();

        const processVal = (val: any) => {
          const v = String(val).trim();
          if (!v) return;
          // Resolve mapping
          const mapped = keyMap[v];
          const resolvedVal = mapped ? mapped.umbrella_category : v;
          resolvedSet.add(resolvedVal);
          
          if (mapped && mapped.justification) {
            if (!justifications[resolvedVal]) {
              justifications[resolvedVal] = new Set<string>();
            }
            justifications[resolvedVal].add(mapped.justification);
          }
        };

        if (Array.isArray(rawVal)) {
          rawVal.forEach(processVal);
        } else {
          processVal(rawVal);
        }

        // Increment frequency (Rule: counts only once per paper)
        resolvedSet.forEach((cat) => {
          frequency[cat] = (frequency[cat] || 0) + 1;
        });
      });

      // Map to stats structure and sort
      const keyStats: CategoryStat[] = Object.entries(frequency)
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalPapers > 0 ? (count / totalPapers) * 100 : 0,
          justifications: Array.from(justifications[category] || [])
        }))
        .sort((a, b) => b.count - a.count);

      results[key] = keyStats;
    });

    return results;
  }, [papers, extractedKeys, mappingsByKey]);

  return (
    <>
      {/* Standalone A4 Print Template (only visible during window.print()) */}
      <TaxonomyTrendsPrintDocument
        papersCount={papers.length}
        extractedKeys={extractedKeys}
        stats={stats}
        getMappedResearchQuestion={getMappedResearchQuestion}
      />

      {/* Screen Modal Dialog (Hidden during window.print()) */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
        <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-foreground">Taxonomy Trends Quick Overview</h3>
                <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                  Deduplicated category distributions across all {papers.length} Miner-passed papers.
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-4">
            {extractedKeys.map((key) => {
              const label = getMappedResearchQuestion(key);
              const isExpanded = expandedKey === key;
              const categoryStats = stats[key] || [];

              return (
                <div key={key} className="border border-border rounded-xl overflow-hidden bg-secondary/5">
                {/* Accordion Header */}
                <button
                  onClick={() => setExpandedKey(expandedKey === key ? null : key)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-secondary/10 hover:bg-secondary/20 transition-colors text-left"
                >
                  <span className="font-bold text-xs text-foreground tracking-wide line-clamp-1">{label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground font-mono bg-card border border-border px-1.5 py-0.5 rounded font-bold">
                      {categoryStats.length} categories
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground print:hidden" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground print:hidden" />
                    )}
                  </div>
                </button>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 border-t border-border bg-card/40 space-y-3.5">
                    {categoryStats.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-muted-foreground italic font-semibold">
                        No normalized categories or raw values populated yet.
                      </div>
                    ) : (
                      categoryStats.map((stat, idx) => {
                        const itemKey = `${key}-${stat.category}`;
                        const isJustActive = isPrinting || activeJustificationKey === itemKey;
                        return (
                          <div key={idx} className="space-y-1.5 border-b border-border/10 pb-2.5 last:border-b-0 last:pb-0">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-foreground">
                              {stat.justifications.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveJustificationKey(isJustActive ? null : itemKey)}
                                  className="text-primary hover:underline font-bold select-none text-left flex items-center gap-1 cursor-pointer focus:outline-none"
                                >
                                  <span className={`truncate max-w-[240px] ${stat.category === 'NOT_STATED' ? 'italic text-muted-foreground/75 font-mono' : ''}`}>{stat.category}</span>
                                  <HelpCircle className="w-3 h-3 text-primary/60 shrink-0 print:hidden" />
                                </button>
                              ) : (
                                <span className={`truncate max-w-[80%] font-medium ${stat.category === 'NOT_STATED' ? 'italic text-muted-foreground/70 font-mono bg-secondary/30 px-1.5 py-0.5 rounded border border-border/40 text-[9px]' : 'text-muted-foreground'}`}>{stat.category}</span>
                              )}
                              <span className="font-mono text-muted-foreground font-medium">
                                {stat.count} paper{stat.count > 1 ? 's' : ''} ({stat.percentage.toFixed(2)}%)
                              </span>
                            </div>
                            {/* Progress Bar */}
                            <div className="w-full bg-secondary/20 rounded-full h-1.5 overflow-hidden border border-border/10 shadow-inner">
                              <div 
                                className="bg-primary h-full rounded-full transition-all duration-500 shadow-sm"
                                style={{ width: `${stat.percentage}%` }}
                              />
                            </div>

                            {/* Inline Justification accordion */}
                            {isJustActive && (
                              <div className="p-2.5 bg-secondary/25 rounded-lg border border-border/30 font-mono text-[9px] text-zinc-400 space-y-1.5 mt-1 select-text animate-in fade-in slide-in-from-top-1 duration-150 text-left">
                                <span className="font-bold text-[8px] uppercase tracking-wider text-primary block">Normalization Justifications:</span>
                                {stat.justifications.map((j: string, i: number) => (
                                  <div key={i} className="leading-relaxed whitespace-pre-wrap">
                                    {stat.justifications.length > 1 ? `${i + 1}. ` : ''}{j}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/10 flex justify-between items-center select-none print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-primary/10 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON
            </button>
            <button
              onClick={handlePrintPdf}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print PDF
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs"
          >
            Close Overview
          </button>
        </div>

      </div>
    </div>
    </>
  );
}
