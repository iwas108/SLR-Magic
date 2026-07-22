import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const TaxonomyTrendsPrintDocument = ({
  papersCount,
  extractedKeys,
  stats,
  getMappedResearchQuestion
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (!mounted) return null;

  const content = (
    <div className="taxonomy-trends-standalone-print-root hidden print:block print:w-full print:bg-white print:text-black print:p-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            overflow: visible !important;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          }
          /* Hide entire main application tree (including sidebar & app layout) */
          body > *:not(.taxonomy-trends-standalone-print-root) {
            display: none !important;
          }
          .taxonomy-trends-standalone-print-root {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            z-index: 9999999 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-exact-color {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>

      {/* Report Header */}
      <div className="border-b-2 border-indigo-600 pb-4 mb-6 print-exact-color">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-indigo-950 uppercase tracking-tight">
              Systematic Literature Review: Taxonomy Trends Report
            </h1>
            <p className="text-xs text-indigo-700 font-semibold mt-1">
              Deduplicated category distributions across all {papersCount} Miner-passed cohort papers.
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-600 font-mono space-y-0.5">
            <div className="inline-block bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200 print-exact-color">
              Generated: {dateStr}
            </div>
            <div className="text-slate-500 font-bold mt-0.5">
              Cohort Size: <span className="text-indigo-700 font-extrabold">{papersCount} Papers</span>
            </div>
          </div>
        </div>
      </div>

      {/* Research Questions List */}
      <div className="space-y-6">
        {extractedKeys.map((key, qIdx) => {
          const label = getMappedResearchQuestion(key);
          const categoryStats = stats[key] || [];

          return (
            <div key={key} className="border border-indigo-200 border-l-4 border-l-indigo-600 rounded-xl p-4 bg-indigo-50/20 space-y-3 print-exact-color">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                <h2 className="text-xs font-black text-indigo-950 tracking-wide uppercase">
                  RQ{qIdx + 1}: {label}
                </h2>
                <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-100/80 border border-indigo-200 px-2 py-0.5 rounded-full print-exact-color">
                  {categoryStats.length} categories
                </span>
              </div>

              {/* Category Breakdown */}
              {categoryStats.length === 0 ? (
                <div className="text-xs italic text-slate-400 py-1">No taxonomy extraction data available.</div>
              ) : (
                <div className="space-y-3">
                  {categoryStats.map((stat, idx) => (
                    <div key={idx} className="print-avoid-break space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-bold text-slate-900 ${stat.category === 'NOT_STATED' ? 'italic text-amber-700 font-mono' : ''}`}>
                          {stat.category}
                        </span>
                        <span className="font-mono text-indigo-700 font-extrabold text-[11px]">
                          {stat.count} paper{stat.count > 1 ? 's' : ''} ({stat.percentage.toFixed(1)}%)
                        </span>
                      </div>

                      {/* High Contrast Color Progress Bar */}
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden print-exact-color">
                        <div
                          className="bg-indigo-600 h-full rounded-full print-exact-color"
                          style={{ width: `${Math.max(stat.percentage, 2)}%` }}
                        />
                      </div>

                      {/* Normalization Rationale / Justifications */}
                      {stat.justifications && stat.justifications.length > 0 && (
                        <div className="mt-1.5 pl-2.5 py-1 pr-2 bg-indigo-50/60 border-l-2 border-indigo-400 rounded-r font-mono text-[9px] text-slate-700 space-y-0.5 print-exact-color">
                          <span className="font-bold text-indigo-900 block uppercase tracking-wider text-[8px]">Justifications:</span>
                          {stat.justifications.map((j, jIdx) => (
                            <div key={jIdx} className="leading-relaxed">
                              {stat.justifications.length > 1 ? `${jIdx + 1}. ` : ''}{j}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
