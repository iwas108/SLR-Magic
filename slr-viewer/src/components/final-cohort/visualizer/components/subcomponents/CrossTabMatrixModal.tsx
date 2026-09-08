import React, { useState, useEffect } from 'react';
import { X, Table, Layers, Copy, Download, Check, Maximize2, FileSpreadsheet, Sparkles } from 'lucide-react';
import { formatPercentage } from '../../utils/formatterUtils';
import { formatVariableDisplayName } from '../../utils/dataExtractor';
import type { CrossTabMatrix, DecimalPrecision } from '../../types';

interface CrossTabMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  crossTab: CrossTabMatrix;
  primaryField: string;
  secondaryField: string;
  levelTargetFields?: Record<number, string>;
  metricMode: string;
  style: {
    decimalPrecision?: DecimalPrecision;
    useTildeForCoarse?: boolean;
  };
  totalCohortCount: number;
}

export function CrossTabMatrixModal({
  isOpen,
  onClose,
  crossTab,
  primaryField,
  secondaryField,
  levelTargetFields,
  metricMode,
  style,
  totalCohortCount
}: CrossTabMatrixModalProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'flat'>('matrix');
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const primLabel = primaryField === '__custom_grouping__'
    ? (levelTargetFields?.[0] ? `Custom: ${formatVariableDisplayName(levelTargetFields[0])}` : 'Row Groups')
    : formatVariableDisplayName(primaryField);

  const secLabel = secondaryField === '__custom_grouping__'
    ? (levelTargetFields?.[1] ? `Custom: ${formatVariableDisplayName(levelTargetFields[1])}` : 'Column Groups')
    : formatVariableDisplayName(secondaryField);

  const handleCopyTSV = () => {
    let tsv = '';
    if (activeTab === 'matrix') {
      tsv = `${primLabel} / ${secLabel}\t` + crossTab.seriesList.map(s => s.replace(/\n/g, ' ')).join('\t') + '\tRow Total\n';
      crossTab.categories.forEach(cat => {
        const rowVals = crossTab.seriesList.map(s => crossTab.matrix[cat]?.[s]?.count ?? 0);
        tsv += `${cat.replace(/\n/g, ' ')}\t` + rowVals.join('\t') + `\t${crossTab.rowTotals[cat]?.count ?? 0}\n`;
      });
      const colTotals = crossTab.seriesList.map(s => crossTab.colTotals[s]?.count ?? 0);
      tsv += `Column Total\t` + colTotals.join('\t') + `\t${crossTab.grandTotalCount}\n`;
    } else {
      tsv = `${primLabel}\t${secLabel}\tCount (N)\tPrevalence (%)\tActive Metric\n`;
      crossTab.categories.forEach(cat => {
        crossTab.seriesList.forEach(s => {
          const cell = crossTab.matrix[cat]?.[s];
          if (cell && cell.count > 0) {
            tsv += `${cat.replace(/\n/g, ' ')}\t${s.replace(/\n/g, ' ')}\t${cell.count}\t${formatPercentage(cell.prevalencePct, style.decimalPrecision, style.useTildeForCoarse)}\t${cell.activeMetricVal}\n`;
          }
        });
      });
    }

    navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    let csv = '';
    if (activeTab === 'matrix') {
      csv = `"${primLabel} / ${secLabel}",` + crossTab.seriesList.map(s => `"${s.replace(/\n/g, ' ')}"`).join(',') + ',"Row Total"\n';
      crossTab.categories.forEach(cat => {
        const rowVals = crossTab.seriesList.map(s => crossTab.matrix[cat]?.[s]?.count ?? 0);
        csv += `"${cat.replace(/\n/g, ' ')}",` + rowVals.join(',') + `,${crossTab.rowTotals[cat]?.count ?? 0}\n`;
      });
      const colTotals = crossTab.seriesList.map(s => crossTab.colTotals[s]?.count ?? 0);
      csv += `"Column Total",` + colTotals.join(',') + `,${crossTab.grandTotalCount}\n`;
    } else {
      csv = `"${primLabel}","${secLabel}","Count (N)","Prevalence (%)","Active Metric"\n`;
      crossTab.categories.forEach(cat => {
        crossTab.seriesList.forEach(s => {
          const cell = crossTab.matrix[cat]?.[s];
          if (cell && cell.count > 0) {
            csv += `"${cat.replace(/\n/g, ' ')}","${s.replace(/\n/g, ' ')}",${cell.count},"${formatPercentage(cell.prevalencePct, style.decimalPrecision, style.useTildeForCoarse)}",${cell.activeMetricVal}\n`;
          }
        });
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crosstab_${primaryField}_vs_${secondaryField}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-6xl max-h-[92vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-secondary/40 border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                Cross-Tabulation Matrix & Correlation Synthesis
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <span>{primLabel}</span>
              <span className="text-primary font-black">✕</span>
              <span>{secLabel}</span>
              <span className="text-muted-foreground/60">•</span>
              <span className="text-primary font-bold">N = {totalCohortCount} studies</span>
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center gap-1 p-1 bg-secondary/80 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'matrix' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                Matrix Grid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('flat')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  activeTab === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Long Table
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyTSV}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-secondary text-xs font-bold text-foreground flex items-center gap-1.5 transition-colors shadow-xs"
              title="Copy table to clipboard as TSV for Excel / Google Sheets"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
              {copied ? 'Copied!' : 'Copy TSV'}
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className="px-3 py-1.5 rounded-xl bg-card border border-border hover:bg-secondary text-xs font-bold text-foreground flex items-center gap-1.5 transition-colors shadow-xs"
              title="Download CSV spreadsheet file"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              Download CSV
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ml-1"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - Scrollable Full View */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-card/60">
          {activeTab === 'matrix' ? (
            <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-secondary/80 text-foreground sticky top-0 z-20 border-b border-border text-[11.5px] font-bold shadow-xs">
                  <tr>
                    <th className="px-4 py-3.5 border-r border-border bg-secondary/90 min-w-[200px] max-w-[280px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground">{primLabel}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">↓ Rows \ Columns →</span>
                      </div>
                    </th>
                    {crossTab.seriesList.map(s => (
                      <th key={s} className="px-4 py-3.5 text-center border-r border-border min-w-[120px] whitespace-pre-line leading-snug">
                        {s}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right font-extrabold bg-primary/10 text-primary min-w-[110px] sticky right-0 z-20">
                      Row Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {crossTab.categories.map((cat, idx) => (
                    <tr key={cat} className={`hover:bg-primary/5 transition-colors ${idx % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}`}>
                      <td className="px-4 py-3 font-bold text-foreground border-r border-border whitespace-pre-line leading-snug">
                        {cat}
                      </td>
                      {crossTab.seriesList.map(s => {
                        const cell = crossTab.matrix[cat]?.[s];
                        const count = cell?.count ?? 0;
                        return (
                          <td key={s} className="px-4 py-3 text-center border-r border-border/40">
                            {count > 0 ? (
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-foreground text-sm">{count}</span>
                                <span className="text-[11px] text-muted-foreground block font-mono">
                                  ({formatPercentage(cell?.prevalencePct ?? 0, style.decimalPrecision, style.useTildeForCoarse)})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/30 font-mono text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right font-black text-primary bg-primary/5 sticky right-0 z-10">
                        <span className="text-sm">{crossTab.rowTotals[cat]?.count ?? 0}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/90 font-extrabold text-foreground border-t-2 border-border sticky bottom-0 z-20 shadow-xs">
                  <tr>
                    <td className="px-4 py-3.5 border-r border-border bg-secondary font-black">
                      Column Total
                    </td>
                    {crossTab.seriesList.map(s => (
                      <td key={s} className="px-4 py-3.5 text-center border-r border-border text-primary font-black text-sm">
                        {crossTab.colTotals[s]?.count ?? 0}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right text-primary bg-primary/20 font-black text-base sticky right-0 z-20">
                      {crossTab.grandTotalCount}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-secondary/80 text-foreground sticky top-0 z-20 border-b border-border text-[11.5px] font-bold shadow-xs">
                  <tr>
                    <th className="px-4 py-3.5">{primLabel}</th>
                    <th className="px-4 py-3.5">{secLabel}</th>
                    <th className="px-4 py-3.5 text-center">Paper Count (N)</th>
                    <th className="px-4 py-3.5 text-center">Cohort Prevalence (%)</th>
                    <th className="px-4 py-3.5 text-right font-mono">Metric Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {crossTab.categories.flatMap(cat =>
                    crossTab.seriesList
                      .filter(s => (crossTab.matrix[cat]?.[s]?.count ?? 0) > 0)
                      .map(s => {
                        const cell = crossTab.matrix[cat][s];
                        return (
                          <tr key={`${cat}:::${s}`} className="hover:bg-primary/5 transition-colors">
                            <td className="px-4 py-3 font-bold text-foreground whitespace-pre-line">{cat}</td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-pre-line">{s}</td>
                            <td className="px-4 py-3 text-center font-extrabold text-foreground text-sm">{cell.count}</td>
                            <td className="px-4 py-3 text-center text-muted-foreground font-mono">{cell.prevalencePct}%</td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-primary">{cell.activeMetricVal}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-secondary/40 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span>Total Categories (Rows): <strong className="text-foreground">{crossTab.categories.length}</strong></span>
            <span>•</span>
            <span>Total Series (Columns): <strong className="text-foreground">{crossTab.seriesList.length}</strong></span>
            <span>•</span>
            <span>Total Association Pairs: <strong className="text-primary font-bold">{crossTab.grandTotalCount}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
