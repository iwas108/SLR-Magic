import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TaxonomyTrendsPrintDocumentProps {
  papersCount: number;
  extractedKeys: string[];
  stats: Record<string, any[]>;
  getMappedResearchQuestion: (key: string) => { title?: string; question?: string } | null;
  showRaw?: boolean;
}

export const TaxonomyTrendsPrintDocument: React.FC<TaxonomyTrendsPrintDocumentProps> = ({
  papersCount,
  extractedKeys,
  stats,
  getMappedResearchQuestion,
  showRaw = false
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
            <div className="inline-block bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200 print-exact-color mb-1">
              Mode: {showRaw ? 'Raw Extracted Values' : 'Umbrellanized Taxonomy'}
            </div>
            <br />
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
        {extractedKeys.map((key) => {
          const rq = getMappedResearchQuestion(key);
          const distribution = stats[key] || [];
          if (distribution.length === 0) return null;

          return (
            <div key={key} className="print-avoid-break border border-slate-300 rounded-lg p-4 bg-slate-50 print-exact-color shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3 border-b border-slate-200 pb-2">
                <div>
                  <h3 className="font-extrabold text-sm text-indigo-950">
                    {rq?.title || key.toUpperCase()}
                  </h3>
                  {rq?.question && (
                    <p className="text-xs text-slate-700 mt-0.5 italic">
                      "{rq.question}"
                    </p>
                  )}
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 print-exact-color shrink-0">
                  {key}
                </span>
              </div>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-700 font-bold text-[10px] uppercase">
                    <th className="py-1.5 px-2">Category / Tag</th>
                    <th className="py-1.5 px-2 text-right">Paper Count</th>
                    <th className="py-1.5 px-2 text-right">Distribution (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {distribution.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-100">
                      <td className="py-1 px-2 font-medium text-slate-900">{item.name}</td>
                      <td className="py-1 px-2 text-right font-mono text-slate-800">{item.count}</td>
                      <td className="py-1 px-2 text-right font-mono font-bold text-indigo-900">
                        {item.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
