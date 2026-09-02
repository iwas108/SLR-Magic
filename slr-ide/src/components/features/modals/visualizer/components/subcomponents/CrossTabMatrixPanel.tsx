import React, { useState, useMemo } from 'react';
import { Table, Copy, Download, Layers, Maximize2 } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { getMappedFieldValue, computeMetricValue, limitCategoryMap, formatVariableDisplayName } from '../../utils/dataExtractor';
import { formatPercentage, formatRatio } from '../../utils/formatterUtils';
import type { CrossTabMatrix, CrossTabCell } from '../../types';
import { CrossTabMatrixModal } from './CrossTabMatrixModal';

export function CrossTabMatrixPanel() {
  const { props, config, style, data } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const {
    primaryField,
    secondaryField,
    metricMode,
    limitCategories,
    maxCategoriesCount,
    otherCategoryLabel = 'Other',
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    sankeyFields
  } = config;
  const {
    levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields
  } = data;

  const [activeTab, setActiveTab] = useState<'matrix' | 'flat'>('matrix');
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isOther = (cat: string) => cat === (otherCategoryLabel || 'Other') || cat === 'Other';

  const primLabel = primaryField === '__custom_grouping__'
    ? (levelTargetFields?.[0] ? `Custom: ${formatVariableDisplayName(levelTargetFields[0])}` : 'Row Groups')
    : formatVariableDisplayName(primaryField);

  const secLabel = secondaryField === '__custom_grouping__'
    ? (levelTargetFields?.[1] ? `Custom: ${formatVariableDisplayName(levelTargetFields[1])}` : 'Column Groups')
    : formatVariableDisplayName(secondaryField);

  const mappedOpts = useMemo(() => ({
    useUmbrellanizer,
    umbrellanizerMap,
    splitMultiValues,
    excludeEmpty,
    customCategoryMap,
    levelCustomGroups,
    levelCustomGroupLinks,
    levelTargetFields,
    sankeyFields,
    primaryField
  }), [useUmbrellanizer, umbrellanizerMap, splitMultiValues, excludeEmpty, customCategoryMap, levelCustomGroups, levelCustomGroupLinks, levelTargetFields, sankeyFields, primaryField]);

  // Compute Cross-Tabulation Matrix Data
  const crossTab: CrossTabMatrix = useMemo(() => {
    const catSet = new Set<string>();
    const seriesSet = new Set<string>();
    const rawMap = new Map<string, Map<string, any[]>>();
    let totalExtractedTags = 0;

    papers.forEach(p => {
      const primVals = getMappedFieldValue(p, primaryField, {
        ...mappedOpts,
        levelIdx: 0,
        subFieldKey: levelTargetFields?.[0],
        unpackMacroToChildren: true
      });
      const secVals = getMappedFieldValue(p, secondaryField, {
        ...mappedOpts,
        primaryField: secondaryField,
        levelIdx: 1,
        subFieldKey: levelTargetFields?.[1],
        unpackMacroToChildren: false
      });

      primVals.forEach(pv => {
        catSet.add(pv);
        secVals.forEach(sv => {
          totalExtractedTags++;
          seriesSet.add(sv);
          if (!rawMap.has(pv)) rawMap.set(pv, new Map());
          if (!rawMap.get(pv)!.has(sv)) rawMap.get(pv)!.set(sv, []);
          rawMap.get(pv)!.get(sv)!.push(p);
        });
      });
    });

    const primAggregatePapersMap = new Map<string, any[]>();
    catSet.forEach(cat => {
      const pList: any[] = [];
      rawMap.get(cat)?.forEach(list => pList.push(...list));
      primAggregatePapersMap.set(cat, pList);
    });

    const limitedPrimMap = limitCategoryMap(
      primAggregatePapersMap,
      limitCategories,
      maxCategoriesCount,
      (list) => computeMetricValue(list, metricMode, papers.length, totalExtractedTags),
      otherCategoryLabel || 'Other'
    );

    let categories = Array.from(limitedPrimMap.keys()).sort((a, b) => {
      if (isOther(a)) return 1;
      if (isOther(b)) return -1;
      return a.localeCompare(b);
    });

    let seriesList = Array.from(seriesSet).sort();

    if (excludeEmpty) {
      categories = categories.filter(c => c !== 'Unassigned / Other' && c !== 'Unassigned');
      seriesList = seriesList.filter(s => s !== 'Unassigned / Other' && s !== 'Unassigned');
    }

    const matrix: Record<string, Record<string, CrossTabCell>> = {};
    const rowTotals: Record<string, { count: number; activeMetricVal: number }> = {};
    const colTotals: Record<string, { count: number; activeMetricVal: number }> = {};
    let grandTotalCount = 0;

    seriesList.forEach(s => {
      colTotals[s] = { count: 0, activeMetricVal: 0 };
    });

    categories.forEach(cat => {
      matrix[cat] = {};
      let rCount = 0;
      let rMetricSum = 0;

      seriesList.forEach(s => {
        let groupPapers: any[] = [];
        if (isOther(cat)) {
          limitedPrimMap.get(cat)?.forEach(p => {
            const secVals = getMappedFieldValue(p, secondaryField, mappedOpts);
            if (secVals.includes(s)) groupPapers.push(p);
          });
        } else {
          groupPapers = rawMap.get(cat)?.get(s) || [];
        }

        const uniquePaperIds = new Set(groupPapers.map(p => p.Paper_ID || p.id || p.title || p.Title || p));
        const count = uniquePaperIds.size;
        const activeMetricVal = computeMetricValue(groupPapers, metricMode, papers.length, totalExtractedTags);
        const prevalencePct = papers.length > 0 ? parseFloat(((count / papers.length) * 100).toFixed(2)) : 0;
        const tagSharePct = totalExtractedTags > 0 ? parseFloat(((groupPapers.length / totalExtractedTags) * 100).toFixed(2)) : 0;

        matrix[cat][s] = {
          primaryCat: cat,
          seriesKey: s,
          count,
          prevalencePct,
          tagSharePct,
          activeMetricVal
        };

        rCount += count;
        rMetricSum += activeMetricVal;

        colTotals[s].count += count;
        colTotals[s].activeMetricVal += activeMetricVal;
      });

      rowTotals[cat] = { count: rCount, activeMetricVal: parseFloat(rMetricSum.toFixed(2)) };
      grandTotalCount += rCount;
    });

    const grandTotalMetricVal = Object.values(rowTotals).reduce((acc, r) => acc + r.activeMetricVal, 0);

    return {
      categories,
      seriesList,
      matrix,
      rowTotals,
      colTotals,
      grandTotalCount,
      grandTotalMetricVal: parseFloat(grandTotalMetricVal.toFixed(2))
    };
  }, [papers, primaryField, secondaryField, metricMode, limitCategories, maxCategoriesCount, mappedOpts]);

  // Export / Copy Handlers
  const handleCopyTSV = () => {
    let tsv = '';
    if (activeTab === 'matrix') {
      tsv = `${primaryField} / ${secondaryField}\t` + crossTab.seriesList.join('\t') + '\tRow Total\n';
      crossTab.categories.forEach(cat => {
        const rowVals = crossTab.seriesList.map(s => crossTab.matrix[cat]?.[s]?.count ?? 0);
        tsv += `${cat}\t` + rowVals.join('\t') + `\t${crossTab.rowTotals[cat]?.count ?? 0}\n`;
      });
      const colTotals = crossTab.seriesList.map(s => crossTab.colTotals[s]?.count ?? 0);
      tsv += `Column Total\t` + colTotals.join('\t') + `\t${crossTab.grandTotalCount}\n`;
    } else {
      tsv = `${primaryField}\t${secondaryField}\tCount (N)\tPrevalence (%)\tActive Metric\n`;
      crossTab.categories.forEach(cat => {
        crossTab.seriesList.forEach(s => {
          const cell = crossTab.matrix[cat]?.[s];
          if (cell && cell.count > 0) {
            tsv += `${cat}\t${s}\t${cell.count}\t${formatPercentage(cell.prevalencePct, style.decimalPrecision, style.useTildeForCoarse)}\t${cell.activeMetricVal}\n`;
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
      csv = `"${primaryField} / ${secondaryField}",` + crossTab.seriesList.map(s => `"${s}"`).join(',') + ',"Row Total"\n';
      crossTab.categories.forEach(cat => {
        const rowVals = crossTab.seriesList.map(s => crossTab.matrix[cat]?.[s]?.count ?? 0);
        csv += `"${cat}",` + rowVals.join(',') + `,${crossTab.rowTotals[cat]?.count ?? 0}\n`;
      });
      const colTotals = crossTab.seriesList.map(s => crossTab.colTotals[s]?.count ?? 0);
      csv += `"Column Total",` + colTotals.join(',') + `,${crossTab.grandTotalCount}\n`;
    } else {
      csv = `"${primaryField}","${secondaryField}","Count (N)","Prevalence (%)","Active Metric"\n`;
      crossTab.categories.forEach(cat => {
        crossTab.seriesList.forEach(s => {
          const cell = crossTab.matrix[cat]?.[s];
          if (cell && cell.count > 0) {
            csv += `"${cat}","${s}",${cell.count},"${formatPercentage(cell.prevalencePct, style.decimalPrecision, style.useTildeForCoarse)}",${cell.activeMetricVal}\n`;
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
    <div className="space-y-3">
      {/* Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'matrix' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            Cross-Tabulation Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flat')}
            className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'flat' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Flattened Long Table
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            title="Open Table in Fullscreen Modal Dialog"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Modal View
          </button>
          <button
            type="button"
            onClick={handleCopyTSV}
            className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary text-xs font-bold text-foreground flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5 text-primary" />
            {copied ? 'Copied!' : 'Copy TSV'}
          </button>
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary text-xs font-bold text-foreground flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Matrix View */}
      {activeTab === 'matrix' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm max-h-[380px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-secondary/70 text-foreground sticky top-0 z-10 border-b border-border text-[11px] font-bold">
              <tr>
                <th className="px-3 py-2.5 border-r border-border">
                  {primLabel} \ {secLabel}
                </th>
                {crossTab.seriesList.map(s => (
                  <th key={s} className="px-3 py-2.5 text-center border-r border-border min-w-[90px] whitespace-pre-line leading-tight">
                    {s}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-extrabold bg-secondary text-primary min-w-[90px]">
                  Row Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {crossTab.categories.map((cat, idx) => (
                <tr key={cat} className={idx % 2 === 0 ? 'bg-card' : 'bg-secondary/20'}>
                  <td className="px-3 py-2 font-bold text-foreground border-r border-border whitespace-pre-line leading-tight">
                    {cat}
                  </td>
                  {crossTab.seriesList.map(s => {
                    const cell = crossTab.matrix[cat]?.[s];
                    const count = cell?.count ?? 0;
                    return (
                      <td key={s} className="px-3 py-2 text-center border-r border-border/60">
                        {count > 0 ? (
                          <div>
                            <span className="font-bold text-foreground">{count}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              ({formatPercentage(cell?.prevalencePct ?? 0, style.decimalPrecision, style.useTildeForCoarse)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40 font-mono">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-extrabold text-primary bg-secondary/30">
                    {crossTab.rowTotals[cat]?.count ?? 0}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-secondary/80 font-extrabold text-foreground border-t-2 border-border sticky bottom-0">
              <tr>
                <td className="px-3 py-2 border-r border-border">Column Total</td>
                {crossTab.seriesList.map(s => (
                  <td key={s} className="px-3 py-2 text-center border-r border-border text-primary">
                    {crossTab.colTotals[s]?.count ?? 0}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-primary bg-primary/10">
                  {crossTab.grandTotalCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Flattened View */}
      {activeTab === 'flat' && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm max-h-[380px]">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-secondary/70 text-foreground sticky top-0 z-10 border-b border-border text-[11px] font-bold">
              <tr>
                <th className="px-3 py-2.5">{primLabel}</th>
                <th className="px-3 py-2.5">{secLabel}</th>
                <th className="px-3 py-2.5 text-center">Paper Count (N)</th>
                <th className="px-3 py-2.5 text-center">Prevalence (%)</th>
                <th className="px-3 py-2.5 text-right">Active Metric Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {crossTab.categories.flatMap(cat =>
                crossTab.seriesList
                  .filter(s => (crossTab.matrix[cat]?.[s]?.count ?? 0) > 0)
                  .map(s => {
                    const cell = crossTab.matrix[cat][s];
                    return (
                      <tr key={`${cat}:::${s}`} className="hover:bg-secondary/30">
                        <td className="px-3 py-2 font-bold text-foreground">{cat}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s}</td>
                        <td className="px-3 py-2 text-center font-bold text-foreground">{cell.count}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{cell.prevalencePct}%</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">{cell.activeMetricVal}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded Modal View */}
      <CrossTabMatrixModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        crossTab={crossTab}
        primaryField={primaryField}
        secondaryField={secondaryField}
        levelTargetFields={levelTargetFields}
        metricMode={metricMode}
        style={style}
        totalCohortCount={papers.length}
      />
    </div>
  );
}
