'use client';

import React, { useState } from 'react';
import { HelpCircle, FileText, Compass, ChevronDown, ChevronUp } from 'lucide-react';
import { UniqueTokenWithContext } from '@/hooks/useUmbrellanizer';

interface TokenOccurrenceTableProps {
  tokens: UniqueTokenWithContext[];
}

export default function TokenOccurrenceTable({ tokens }: TokenOccurrenceTableProps) {
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden max-h-72 overflow-y-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-secondary/40 border-b border-border sticky top-0 z-10 backdrop-blur-sm">
            <th className="p-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Raw Token</th>
            <th className="p-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-center w-28">Context Traces</th>
            <th className="p-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground text-right w-24">Occurrences</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {tokens.length === 0 ? (
            <tr>
              <td colSpan={3} className="p-4 text-center text-muted-foreground">No unique tokens extracted for this key.</td>
            </tr>
          ) : (
            tokens.map(({ token, count, papers, evidence_quotes = [], logic_traces = [] }) => {
              const isExpanded = expandedToken === token;
              const hasContext = evidence_quotes.length > 0 || logic_traces.length > 0;

              return (
                <React.Fragment key={token}>
                  <tr 
                    onClick={() => hasContext && setExpandedToken(isExpanded ? null : token)}
                    className={`hover:bg-secondary/10 group transition-colors ${hasContext ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-secondary/15' : ''}`}
                  >
                    <td className="p-2 font-semibold font-mono text-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{token}</span>
                        <div className="relative group/tooltip inline-block cursor-help" onClick={(e) => e.stopPropagation()}>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-foreground" />
                          <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover/tooltip:block bg-card border border-border p-2.5 rounded-lg shadow-xl z-50 w-72 max-h-48 overflow-y-auto pointer-events-none text-left">
                            <span className="font-bold text-[9px] uppercase tracking-wide text-muted-foreground block mb-1">
                              Extracted in {papers.length} Papers:
                            </span>
                            <ul className="space-y-1 text-[10px] list-disc pl-3">
                              {papers.map((p) => (
                                <li key={p.id} className="text-foreground leading-snug">
                                  <span className="font-bold font-mono text-primary">{p.id}</span>: {p.title}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 text-center w-28">
                      <div className="flex items-center justify-center gap-1 text-[9px] font-mono">
                        {evidence_quotes.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-0.5" title={`${evidence_quotes.length} evidence quotes captured`}>
                            <FileText className="w-2.5 h-2.5" />
                            {evidence_quotes.length}
                          </span>
                        )}
                        {logic_traces.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold flex items-center gap-0.5" title={`${logic_traces.length} extraction logic traces logged`}>
                            <Compass className="w-2.5 h-2.5" />
                            {logic_traces.length}
                          </span>
                        )}
                        {hasContext && (
                          <span className="text-muted-foreground/60 ml-0.5">
                            {isExpanded ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 font-bold text-right text-primary w-24 font-mono">{count}</td>
                  </tr>

                  {/* Expanded Evidence & Logic Trace Accordion */}
                  {isExpanded && (
                    <tr className="bg-secondary/10">
                      <td colSpan={3} className="p-3 border-t border-border/40 space-y-2">
                        {evidence_quotes.length > 0 && (
                          <div className="space-y-1">
                            <span className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Verbatim Evidence Quotes ({evidence_quotes.length}):
                            </span>
                            <div className="space-y-1 pl-2 border-l-2 border-emerald-500/40 font-mono text-[10px] text-foreground">
                              {evidence_quotes.map((eq, i) => (
                                <div key={i} className="leading-relaxed">
                                  <span className="font-bold text-primary">[{eq.paper_id}]:</span> &ldquo;{eq.quote}&rdquo;
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {logic_traces.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <span className="font-bold text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                              <Compass className="w-3 h-3" />
                              Extraction Logic Traces ({logic_traces.length}):
                            </span>
                            <div className="space-y-1 pl-2 border-l-2 border-indigo-500/40 font-mono text-[10px] text-muted-foreground">
                              {logic_traces.map((lt, i) => (
                                <div key={i} className="leading-relaxed">
                                  <span className="font-bold text-primary">[{lt.paper_id}]:</span> {lt.trace}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
