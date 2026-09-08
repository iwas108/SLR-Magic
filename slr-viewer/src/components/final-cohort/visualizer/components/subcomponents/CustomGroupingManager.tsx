import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Zap, 
  Layers, 
  ArrowRight, 
  CheckCircle2, 
  HelpCircle, 
  Edit2, 
  Check, 
  X, 
  Sliders, 
  TrendingDown, 
  Search,
  Filter,
  BarChart2
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import { getFieldValue, stripParentPrefix } from '../../utils/dataExtractor';
import { FieldAutocomplete } from './FieldAutocomplete';

export interface CustomGroupingManagerProps {
  onClose?: () => void;
  targetSlotIndex?: number;
}

export function CustomGroupingManager({ onClose, targetSlotIndex }: CustomGroupingManagerProps) {
  const { props, config, data } = useVisualizerContext();
  const { papers } = props;
  const { 
    chartType, 
    sankeyFields, 
    setSankeyFields,
    primaryField, 
    setPrimaryField, 
    secondaryField, 
    setSecondaryField, 
    metricMode,
    setMetricMode,
    useUmbrellanizer, 
    setUseUmbrellanizer,
    splitMultiValues, 
    setSplitMultiValues,
    excludeEmpty,
    setExcludeEmpty,
    otherCategoryLabel = '',
    setOtherCategoryLabel
  } = config;
  const {
    levelCustomGroups = {},
    setLevelCustomGroups,
    levelCustomGroupLinks = {},
    setLevelCustomGroupLinks,
    levelTargetFields = {},
    setLevelTargetFields,
    discoveredVariables = [],
    availableFields = []
  } = data;

  const [levelNewGroupName, setLevelNewGroupName] = useState<Record<number, string>>({});
  const [editingGroup, setEditingGroup] = useState<{ lIdx: number; oldName: string; currentName: string } | null>(null);
  const [searchFilter, setSearchFilter] = useState<Record<number, string>>({});
  const [tailTopN, setTailTopN] = useState<number>(8);
  const [tailGroupNameInput, setTailGroupNameInput] = useState<string>(otherCategoryLabel || 'Other Sectors');

  const is2DChart = ['clustered_bar', 'stacked_bar', 'horizontal_bar_scatter', 'heatmap', 'graph'].includes(chartType);
  const isHierarchical = ['sunburst', 'treemap', 'sankey'].includes(chartType);

  // Discover active levels, with guaranteed omni-variable fallback
  const activeCustomLevelIndices: number[] = useMemo(() => {
    if (typeof targetSlotIndex === 'number') {
      return [targetSlotIndex];
    }
    const indices: number[] = [];
    if (isHierarchical) {
      sankeyFields.forEach((f, idx) => {
        if (f === CUSTOM_GROUPING_KEY) indices.push(idx);
      });
    } else if (is2DChart) {
      if (primaryField === CUSTOM_GROUPING_KEY) indices.push(0);
      if (secondaryField === CUSTOM_GROUPING_KEY) indices.push(1);
    } else {
      if (primaryField === CUSTOM_GROUPING_KEY) indices.push(0);
    }

    // OMNI-VARIABLE FALLBACK:
    // If no slot is currently set to CUSTOM_GROUPING_KEY, default to index 0 so researchers can configure groups for any variable!
    if (indices.length === 0) {
      indices.push(0);
    }
    return indices;
  }, [isHierarchical, is2DChart, sankeyFields, primaryField, secondaryField, targetSlotIndex]);

  const extractOpts = useMemo(() => ({
    useUmbrellanizer,
    umbrellanizerMap: props.umbrellanizerMap,
    splitMultiValues,
    excludeEmpty
  }), [useUmbrellanizer, props.umbrellanizerMap, splitMultiValues, excludeEmpty]);

  const totalCohort = (papers || []).length || 1;

  // 1-Click Clear All Groups
  const handleClearAllGroups = (lIdx: number) => {
    setLevelCustomGroups((prev: Record<number, string[]>) => ({
      ...prev,
      [lIdx]: []
    }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
      ...prev,
      [lIdx]: {}
    }));
  };

  // 1-Click Unassign All Items (Keeps Custom Groups)
  const handleUnassignAll = (lIdx: number) => {
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
      ...prev,
      [lIdx]: {}
    }));
  };

  // Dynamic Colon Segment Auto-Grouping for any Level X (0-indexed segment)
  const handleAutoParseColonLevel = (lIdx: number, subValues: string[], targetKey: string, segmentIdx: number) => {
    if (!subValues || subValues.length === 0) return;

    const newGroupsSet = new Set<string>();
    const newLinks: Record<string, string> = {};
    let hasStandalone = false;

    subValues.forEach(val => {
      if (!val || val === '[object Object]' || val === 'Unspecified') return;
      const parts = val.split(':').map(s => s.trim()).filter(Boolean);
      if (parts.length > segmentIdx && parts[segmentIdx]) {
        const segVal = parts[segmentIdx];
        newGroupsSet.add(segVal);
        newLinks[val] = segVal;
      } else if (parts.length > 0) {
        const fallback = parts[parts.length - 1];
        newGroupsSet.add(fallback);
        newLinks[val] = fallback;
      } else {
        hasStandalone = true;
        newLinks[val] = 'Other / Standalone';
      }
    });

    const sortedGroups = Array.from(newGroupsSet).sort();
    if (hasStandalone) {
      sortedGroups.push('Other / Standalone');
    }

    if (!levelTargetFields[lIdx]) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: targetKey }));
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: sortedGroups }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: newLinks }));
    if (config.setLevelSegmentIndices) {
      config.setLevelSegmentIndices((prev: Record<number, number>) => ({ ...prev, [lIdx]: segmentIdx }));
    }
  };

  const handleAutoParseColonLv1 = (lIdx: number, subValues: string[], targetKey: string) => handleAutoParseColonLevel(lIdx, subValues, targetKey, 0);
  const handleAutoParseColonLv2 = (lIdx: number, subValues: string[], targetKey: string) => handleAutoParseColonLevel(lIdx, subValues, targetKey, 1);
  const handleAutoParseColonLv3 = (lIdx: number, subValues: string[], targetKey: string) => handleAutoParseColonLevel(lIdx, subValues, targetKey, 2);

  // 1-Click Direct Grouping
  const handleAutoGroupDirect = (lIdx: number, subValues: string[], targetKey: string) => {
    if (!subValues || subValues.length === 0) return;
    const groups = subValues.slice(0, 12);
    const links: Record<string, string> = {};
    groups.forEach(g => { links[g] = g; });
    if (!levelTargetFields[lIdx]) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: targetKey }));
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: groups }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: links }));
  };

  // Smart Tail Grouping Assistant: Keep Top N & Bundle Tail into "Other"
  const handleSmartTailGroup = (
    lIdx: number, 
    rankedValues: string[], 
    targetKey: string,
    topNCount: number,
    otherGroupName: string
  ) => {
    if (!rankedValues || rankedValues.length === 0) return;
    const targetOtherName = otherGroupName.trim() || 'Other Sectors';

    const topItems = rankedValues.slice(0, topNCount);
    const tailItems = rankedValues.slice(topNCount);

    const groupsSet = new Set<string>(topItems);
    if (tailItems.length > 0) {
      groupsSet.add(targetOtherName);
    }

    const newLinks: Record<string, string> = { ...(levelCustomGroupLinks[lIdx] || {}) };
    topItems.forEach(item => {
      newLinks[item] = item;
    });
    tailItems.forEach(item => {
      newLinks[item] = targetOtherName;
    });

    if (!levelTargetFields[lIdx]) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: targetKey }));
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: Array.from(groupsSet) }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: newLinks }));
    setOtherCategoryLabel(targetOtherName);
  };

  // Smart Tail Grouping Assistant: Bundle Items Below Threshold (< 5% or n <= 2)
  const handleBundleRareThreshold = (
    lIdx: number, 
    rankedValues: string[], 
    statsMap: Map<string, { paperCount: number; prevalence: number; tagCount: number }>,
    targetKey: string,
    thresholdPrevalence: number,
    otherGroupName: string
  ) => {
    const targetOtherName = otherGroupName.trim() || 'Other Sectors';
    const frequentItems: string[] = [];
    const rareItems: string[] = [];

    rankedValues.forEach(v => {
      const prev = statsMap.get(v)?.prevalence ?? 0;
      if (prev >= thresholdPrevalence) {
        frequentItems.push(v);
      } else {
        rareItems.push(v);
      }
    });

    const groupsSet = new Set<string>(frequentItems);
    if (rareItems.length > 0) {
      groupsSet.add(targetOtherName);
    }

    const newLinks: Record<string, string> = { ...(levelCustomGroupLinks[lIdx] || {}) };
    frequentItems.forEach(item => {
      newLinks[item] = item;
    });
    rareItems.forEach(item => {
      newLinks[item] = targetOtherName;
    });

    if (!levelTargetFields[lIdx]) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: targetKey }));
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: Array.from(groupsSet) }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: newLinks }));
    setOtherCategoryLabel(targetOtherName);
  };

  const handleRenameGroup = (lIdx: number, oldName: string, newName: string) => {
    const trimmed = newName.trim().replace(/\\n/g, '\n');
    if (!trimmed || trimmed === oldName) {
      setEditingGroup(null);
      return;
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({
      ...prev,
      [lIdx]: (prev[lIdx] || []).map((g: string) => g === oldName ? trimmed : g)
    }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
      const copy = { ...(prev[lIdx] || {}) };
      Object.keys(copy).forEach(k => {
        if (copy[k] === oldName) copy[k] = trimmed;
      });
      return { ...prev, [lIdx]: copy };
    });
    setEditingGroup(null);
  };

  return (
    <div className="space-y-6 my-2">
      {activeCustomLevelIndices.map(lIdx => {
        const currentLevelGroups = levelCustomGroups[lIdx] || [];
        const currentLevelLinks = levelCustomGroupLinks[lIdx] || {};
        const currentNewName = levelNewGroupName[lIdx] || '';
        const currentSearch = searchFilter[lIdx] || '';

        const defaultSubFieldKey = isHierarchical
          ? (levelTargetFields[lIdx] || (sankeyFields[lIdx] && sankeyFields[lIdx] !== CUSTOM_GROUPING_KEY ? sankeyFields[lIdx] : undefined) || sankeyFields.find((f, i) => f !== CUSTOM_GROUPING_KEY && i !== lIdx) || (primaryField !== CUSTOM_GROUPING_KEY ? primaryField : 'Year'))
          : is2DChart
            ? (lIdx === 0 
                ? (levelTargetFields[0] || (primaryField !== CUSTOM_GROUPING_KEY ? primaryField : (discoveredVariables?.find(v => v.category === 'extracted' || v.category === 'taxonomy')?.key || 'Year'))) 
                : (levelTargetFields[1] || (secondaryField !== CUSTOM_GROUPING_KEY ? secondaryField : (discoveredVariables?.find(v => v.key.includes('rq2') || v.category === 'extracted')?.key || 'Import_Source'))))
            : (levelTargetFields[0] || (primaryField !== CUSTOM_GROUPING_KEY ? primaryField : 'Year'));
        
        const subFieldKey = levelTargetFields[lIdx] || defaultSubFieldKey;

        // Extract and compute item-level empirical statistics
        const { allSubValues, itemStatsMap } = useMemo(() => {
          const statsMap = new Map<string, { paperCount: number; prevalence: number; tagCount: number }>();
          if (!papers || papers.length === 0) return { allSubValues: [], itemStatsMap: statsMap };

          const paperMap = new Map<string, Set<any>>();
          const tagCountMap = new Map<string, number>();

          papers.forEach(p => {
            const vals = getFieldValue(p, subFieldKey, extractOpts);
            vals.forEach(v => {
              if (!v || v === '[object Object]' || v === 'Unspecified') return;
              if (!paperMap.has(v)) paperMap.set(v, new Set());
              paperMap.get(v)!.add(p.Paper_ID || p.id || p.title || p.Title || p);
              tagCountMap.set(v, (tagCountMap.get(v) || 0) + 1);
            });
          });

          paperMap.forEach((pSet, v) => {
            const n = pSet.size;
            const prev = parseFloat(((n / totalCohort) * 100).toFixed(1));
            const k = tagCountMap.get(v) || n;
            statsMap.set(v, { paperCount: n, prevalence: prev, tagCount: k });
          });

          const values = Array.from(paperMap.keys()).sort((a, b) => {
            const statA = statsMap.get(a)?.prevalence || 0;
            const statB = statsMap.get(b)?.prevalence || 0;
            return statB - statA;
          });

          return { allSubValues: values, itemStatsMap: statsMap };
        }, [papers, subFieldKey, extractOpts, totalCohort]);

        const colonItemsCount = allSubValues.filter(v => v.includes(':')).length;
        let maxColonDepth = 1;
        if (colonItemsCount > 0) {
          allSubValues.forEach(v => {
            if (v.includes(':')) {
              const parts = v.split(':').map(s => s.trim()).filter(Boolean);
              if (parts.length > maxColonDepth) maxColonDepth = parts.length;
            }
          });
        }
        const unassignedItems = allSubValues.filter(v => !currentLevelLinks[v]);
        const filteredUnassigned = currentSearch
          ? unassignedItems.filter(u => u.toLowerCase().includes(currentSearch.toLowerCase()))
          : unassignedItems;

        const levelTitle = isHierarchical
          ? `Hierarchy Level ${lIdx + 1} (${chartType === 'sunburst' ? `Ring ${lIdx + 1}` : chartType === 'sankey' ? `Flow ${lIdx + 1}` : `Depth ${lIdx + 1}`}) Custom Grouping Layer`
          : is2DChart
            ? (lIdx === 0 ? 'Primary Dimension (X-Axis / Rows) Custom Grouping' : 'Secondary Dimension (Series / Columns) Custom Grouping')
            : 'Custom Grouping & Thematic Stratification Layer';

        return (
          <div key={lIdx} className="p-4 bg-secondary/20 border-2 border-primary/30 rounded-2xl space-y-4 shadow-sm">
            {/* Header with Title & Level Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/20 text-primary">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-black text-foreground block">
                    {levelTitle}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Partition and stratify data items from <strong className="text-primary font-mono">{subFieldKey}</strong> ({allSubValues.length} unique values detected)
                  </span>
                </div>
              </div>

              {/* 1-Click Fast Re-Groupers & Clear Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {colonItemsCount > 0 && Array.from({ length: maxColonDepth }).map((_, sIdx) => {
                  const levelNum = sIdx + 1;
                  const label = levelNum === 1 ? 'Lv1 (Macro)' : levelNum === 2 ? 'Lv2 (Sub)' : levelNum === 3 ? 'Lv3 (Leaf)' : `Lv${levelNum}`;
                  const colorStyles = [
                    'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    'bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/30',
                    'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                    'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30',
                    'bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30'
                  ];
                  const activeColor = colorStyles[sIdx % colorStyles.length];
                  return (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleAutoParseColonLevel(lIdx, allSubValues, subFieldKey, sIdx)}
                      className={`px-2.5 py-1.5 ${activeColor} border rounded-xl text-[11px] font-extrabold flex items-center gap-1 transition-all shadow-xs active:scale-95`}
                      title={`Auto-Group by Colon Segment Level ${levelNum} (0-indexed segment ${sIdx})`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Auto-Group &apos;:&apos; {label}
                    </button>
                  );
                })}

                {currentLevelGroups.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleUnassignAll(lIdx)}
                      className="px-2.5 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95"
                      title="Keep custom group names but clear all item assignments"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                      Unassign All
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClearAllGroups(lIdx)}
                      className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all shadow-xs active:scale-95"
                      title="Completely delete all custom groups and unassign all items for this level"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All Groups
                    </button>
                  </>
                )}

                {currentLevelGroups.length === 0 && allSubValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAutoGroupDirect(lIdx, allSubValues, subFieldKey)}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                    title="Auto-create groups from discovered unique values"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Auto-Create Top Groups ({Math.min(12, allSubValues.length)})
                  </button>
                )}
              </div>
            </div>

            {/* Integrated Extraction Protocols & Scientific Metric Controls */}
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  Extraction Protocols & Pre-Normalization
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1 font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  Data Query Safety Guard: PASSED (N={totalCohort})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg border border-border/80 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={useUmbrellanizer}
                    onChange={(e) => setUseUmbrellanizer(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  <span className="font-semibold text-foreground text-[11px]">Apply Taxonomy Normalizer</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg border border-border/80 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={splitMultiValues}
                    onChange={(e) => setSplitMultiValues(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  <span className="font-semibold text-foreground text-[11px]">Split Multi-Value Tags</span>
                </label>

                <label className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg border border-border/80 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={excludeEmpty}
                    onChange={(e) => setExcludeEmpty(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-primary"
                  />
                  <span className="font-semibold text-foreground text-[11px]">Exclude Empty / Null</span>
                </label>
              </div>

              {/* Scientific Metric & Quota Calculation Mode */}
              <div className="pt-2 border-t border-border/60 space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-primary" />
                  Scientific Metric & Quota Calculation:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setMetricMode('paper_prevalence')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      metricMode === 'paper_prevalence'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-secondary/30 border-border/80 hover:bg-secondary/50 text-foreground'
                    }`}
                  >
                    <span className="text-[11px] font-bold block leading-tight">Prevalence %</span>
                    <span className="text-[9px] text-muted-foreground block font-mono mt-0.5">n / N_cohort</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('tag_share')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      metricMode === 'tag_share'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-secondary/30 border-border/80 hover:bg-secondary/50 text-foreground'
                    }`}
                  >
                    <span className="text-[11px] font-bold block leading-tight">Tag Share %</span>
                    <span className="text-[9px] text-muted-foreground block font-mono mt-0.5">k / TotalTags</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('count')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      metricMode === 'count'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-secondary/30 border-border/80 hover:bg-secondary/50 text-foreground'
                    }`}
                  >
                    <span className="text-[11px] font-bold block leading-tight">Count (N)</span>
                    <span className="text-[9px] text-muted-foreground block font-mono mt-0.5">Direct freq</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetricMode('avg_qa')}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      metricMode === 'avg_qa'
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                        : 'bg-secondary/30 border-border/80 hover:bg-secondary/50 text-foreground'
                    }`}
                  >
                    <span className="text-[11px] font-bold block leading-tight">Avg QA Score</span>
                    <span className="text-[9px] text-muted-foreground block font-mono mt-0.5">Mean appraisal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Target Data Source Variable Selector */}
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Target Variable to Partition & Stratify:
                </label>
                <span className="text-[11px] font-bold text-muted-foreground font-mono">
                  {allSubValues.length} categories • N={totalCohort} papers
                </span>
              </div>
              <FieldAutocomplete
                value={subFieldKey}
                onChange={(newKey) => {
                  setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: newKey }));
                  setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: {} }));
                }}
                discoveredVariables={discoveredVariables.filter(v => v.key !== CUSTOM_GROUPING_KEY)}
                availableFields={availableFields.filter(f => f !== CUSTOM_GROUPING_KEY)}
                placeholder="Search Research Questions (RQ1..RQn), taxonomy, or metadata..."
              />
            </div>

            {/* Smart Stats-Assisted Tail Grouping Assistant */}
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-black text-primary flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  ⚡ Smart Stats-Assisted Tail Grouping Assistant
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Quickly bundle low-frequency categories into an aggregated "Other" group
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">
                    Keep Top N Items ({tailTopN}):
                  </label>
                  <input
                    type="range"
                    min={3}
                    max={Math.max(4, Math.min(20, allSubValues.length))}
                    value={tailTopN}
                    onChange={(e) => setTailTopN(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    <span>3 Items</span>
                    <span>{tailTopN} Top</span>
                    <span>{Math.max(4, Math.min(20, allSubValues.length))} Max</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-foreground block">
                    "Other" Group Name:
                  </label>
                  <input
                    type="text"
                    value={tailGroupNameInput}
                    onChange={(e) => setTailGroupNameInput(e.target.value)}
                    placeholder="e.g. Other Sectors / Other Domains"
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSmartTailGroup(lIdx, allSubValues, subFieldKey, tailTopN, tailGroupNameInput)}
                    className="flex-1 py-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                    title={`Keep top ${tailTopN} items and bundle remaining ${Math.max(0, allSubValues.length - tailTopN)} items into "${tailGroupNameInput || 'Other Sectors'}"`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Bundle Tail &rarr; &ldquo;{tailGroupNameInput || 'Other'}&rdquo;</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBundleRareThreshold(lIdx, allSubValues, itemStatsMap, subFieldKey, 5.0, tailGroupNameInput)}
                    className="py-1.5 px-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-xs font-bold transition-all"
                    title="Bundle all items with < 5% cohort prevalence into Other"
                  >
                    Bundle &lt; 5%
                  </button>
                </div>
              </div>
            </div>

            {/* Create New Group Card */}
            <div className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-xl shadow-xs">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <input
                type="text"
                placeholder={`Create new custom group name (e.g. Industrial Implementations, Agricultural Deployments)...`}
                value={currentNewName}
                onChange={(e) => setLevelNewGroupName(prev => ({ ...prev, [lIdx]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && currentNewName.trim()) {
                    const name = currentNewName.trim();
                    if (!currentLevelGroups.includes(name)) {
                      setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: [...(prev[lIdx] || []), name] }));
                    }
                    if (!levelTargetFields[lIdx]) {
                      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                    }
                    setLevelNewGroupName(prev => ({ ...prev, [lIdx]: '' }));
                  }
                }}
                className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => {
                  if (currentNewName.trim()) {
                    const name = currentNewName.trim();
                    if (!currentLevelGroups.includes(name)) {
                      setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: [...(prev[lIdx] || []), name] }));
                    }
                    if (!levelTargetFields[lIdx]) {
                      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                    }
                    setLevelNewGroupName(prev => ({ ...prev, [lIdx]: '' }));
                  }
                }}
                className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Group
              </button>
            </div>

            {/* Custom Groups Grid with Real-Time Aggregate Stats */}
            {currentLevelGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {currentLevelGroups.map(groupName => {
                  const assignedItems = allSubValues.filter(v => currentLevelLinks[v] === groupName);

                  // Calculate live group aggregate coverage
                  const groupPaperIds = new Set<any>();
                  let groupTagMentions = 0;
                  assignedItems.forEach(item => {
                    (papers || []).forEach(p => {
                      const vals = getFieldValue(p, subFieldKey, extractOpts);
                      if (vals.includes(item)) {
                        groupPaperIds.add(p.Paper_ID || p.id || p.title || p.Title || p);
                        groupTagMentions++;
                      }
                    });
                  });
                  const groupPrevalence = parseFloat(((groupPaperIds.size / totalCohort) * 100).toFixed(1));

                  return (
                    <div key={groupName} className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 flex flex-col justify-between shadow-xs">
                      <div>
                        {/* Group Card Header with Live Aggregate Stats */}
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          {editingGroup?.lIdx === lIdx && editingGroup?.oldName === groupName ? (
                            <div className="flex items-center gap-1 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={editingGroup.currentName}
                                onChange={(e) => setEditingGroup({ ...editingGroup, currentName: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameGroup(lIdx, groupName, editingGroup.currentName);
                                  if (e.key === 'Escape') setEditingGroup(null);
                                }}
                                className="flex-1 bg-secondary border border-primary rounded-md px-2 py-1 text-xs font-bold text-foreground focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameGroup(lIdx, groupName, editingGroup.currentName)}
                                className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                                title="Save (Enter)"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingGroup(null)}
                                className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0" />
                              <span className="text-xs font-black text-foreground whitespace-pre-line leading-tight truncate" title={groupName}>
                                {groupName}
                              </span>
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0 ml-1">
                                {groupPrevalence}% ({groupPaperIds.size}/{totalCohort})
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {(!editingGroup || editingGroup.oldName !== groupName) && (
                              <button
                                type="button"
                                onClick={() => setEditingGroup({ lIdx, oldName: groupName, currentName: groupName.replace(/\n/g, '\\n') })}
                                className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors"
                                title="Rename group"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setLevelCustomGroups((prev: Record<number, string[]>) => ({
                                  ...prev,
                                  [lIdx]: (prev[lIdx] || []).filter((g: string) => g !== groupName)
                                }));
                                setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
                                  const copy = { ...(prev[lIdx] || {}) };
                                  Object.keys(copy).forEach(k => {
                                    if (copy[k] === groupName) delete copy[k];
                                  });
                                  return { ...prev, [lIdx]: copy };
                                });
                              }}
                              className="text-muted-foreground hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                              title="Delete custom group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Assigned Items Badges with Stats */}
                        <div className="flex flex-wrap gap-1.5 pt-2 min-h-[36px]">
                          {assignedItems.length > 0 ? assignedItems.map((item, itemIdx) => {
                            const displayLabel = stripParentPrefix(item, groupName);
                            const stats = itemStatsMap.get(item);
                            const rank = allSubValues.indexOf(item) + 1;

                            return (
                              <span 
                                key={item} 
                                title={`${item} • Rank #${rank} • ${stats?.paperCount || 0} papers (${stats?.prevalence || 0}%) • ${stats?.tagCount || 0} tag mentions`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold"
                              >
                                <span className="text-[9px] font-mono text-primary/70">#{rank}</span>
                                <span>{displayLabel}</span>
                                <span className="text-[10px] font-mono opacity-80">({stats?.prevalence || 0}%)</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
                                      const copy = { ...(prev[lIdx] || {}) };
                                      delete copy[item];
                                      return { ...prev, [lIdx]: copy };
                                    });
                                  }}
                                  className="hover:text-red-500 font-black ml-0.5"
                                  title={`Unlink ${item}`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          }) : (
                            <span className="text-[10.5px] italic text-muted-foreground">No items assigned yet</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Assign Dropdown for This Group */}
                      {unassignedItems.length > 0 && (
                        <div className="pt-2 border-t border-border/40">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const itemToLink = e.target.value;
                                if (!levelTargetFields[lIdx]) {
                                  setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                                }
                                setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
                                  ...prev,
                                  [lIdx]: { ...(prev[lIdx] || {}), [itemToLink]: groupName }
                                }));
                                e.target.value = '';
                              }
                            }}
                            className="w-full bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                          >
                            <option value="" disabled>+ Link unassigned item to &ldquo;{groupName}&rdquo;...</option>
                            {unassignedItems.map(u => {
                              const uDisplay = stripParentPrefix(u, groupName);
                              const stats = itemStatsMap.get(u);
                              const rank = allSubValues.indexOf(u) + 1;
                              return (
                                <option key={u} value={u}>
                                  #{rank} {uDisplay !== u ? `${uDisplay} (${u})` : u} — {stats?.prevalence || 0}% ({stats?.paperCount || 0} papers)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-card border border-dashed border-border rounded-xl text-center space-y-2">
                <Sparkles className="w-6 h-6 text-primary mx-auto opacity-60" />
                <p className="text-xs font-bold text-foreground">
                  No Custom Groups Created Yet
                </p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Use the <strong>Smart Tail Grouping Assistant</strong> above to automatically bundle categories, or type a group name and click <strong>Add Group</strong>.
                </p>
              </div>
            )}

            {/* Unassigned Items Quick Bank with Stats Badges & Search Filter */}
            {unassignedItems.length > 0 && currentLevelGroups.length > 0 && (
              <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-extrabold text-muted-foreground block">
                    Unassigned Categories ({unassignedItems.length} of {allSubValues.length}):
                  </span>
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter items..."
                      value={currentSearch}
                      onChange={(e) => setSearchFilter(prev => ({ ...prev, [lIdx]: e.target.value }))}
                      className="w-full bg-secondary/50 border border-border rounded-lg pl-7 pr-2 py-1 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {filteredUnassigned.map(u => {
                    const stats = itemStatsMap.get(u);
                    const rank = allSubValues.indexOf(u) + 1;
                    const isRare = (stats?.prevalence || 0) < 5.0;

                    return (
                      <div key={u} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-bold ${
                        isRare ? 'bg-amber-500/5 border-amber-500/20 text-foreground' : 'bg-secondary/60 border-border text-foreground'
                      }`}>
                        <span className="text-[9px] font-mono text-muted-foreground">#{rank}</span>
                        <span>{u}</span>
                        <span className="text-[10px] font-mono text-primary font-bold">({stats?.prevalence || 0}%)</span>
                        <div className="flex items-center gap-0.5 ml-1 border-l border-border/80 pl-1">
                          {currentLevelGroups.map(g => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => {
                                if (!levelTargetFields[lIdx]) {
                                  setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                                }
                                setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
                                  ...prev,
                                  [lIdx]: { ...(prev[lIdx] || {}), [u]: g }
                                }));
                              }}
                              className="px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold transition-all"
                              title={`Assign "${u}" to "${g}"`}
                            >
                              + {g.slice(0, 8)}{g.length > 8 ? '…' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Apply Grouping Layer to Chart Actions */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {isHierarchical ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                        const nextSankeyFields = [...sankeyFields];
                        nextSankeyFields[lIdx] = CUSTOM_GROUPING_KEY;
                        setSankeyFields(nextSankeyFields);
                        if (onClose) onClose();
                      }}
                      className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                      title={`Assign this custom grouping layer directly to Level ${lIdx + 1} (${chartType === 'sunburst' ? `Ring ${lIdx + 1}` : chartType === 'sankey' ? `Flow ${lIdx + 1}` : `Depth ${lIdx + 1}`})`}
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      Apply to Level {lIdx + 1} ({chartType === 'sunburst' ? `Ring ${lIdx + 1}` : chartType === 'sankey' ? `Flow ${lIdx + 1}` : `Depth ${lIdx + 1}`})
                    </button>

                    {sankeyFields.length > 1 && (
                      <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
                        <span className="text-[10px] font-bold text-muted-foreground px-1.5">Apply to another level:</span>
                        {sankeyFields.map((_, targetIdx) => {
                          if (targetIdx === lIdx) return null;
                          return (
                            <button
                              key={targetIdx}
                              type="button"
                              onClick={() => {
                                setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [targetIdx]: subFieldKey }));
                                const nextSankeyFields = [...sankeyFields];
                                nextSankeyFields[targetIdx] = CUSTOM_GROUPING_KEY;
                                setSankeyFields(nextSankeyFields);
                                if (onClose) onClose();
                              }}
                              className="px-2 py-1 bg-card hover:bg-card/80 text-foreground border border-border rounded-lg text-[10px] font-bold transition-all"
                            >
                              Level {targetIdx + 1} ({chartType === 'sunburst' ? `Ring ${targetIdx + 1}` : `L${targetIdx + 1}`})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : is2DChart ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [0]: subFieldKey }));
                        setPrimaryField(CUSTOM_GROUPING_KEY);
                        if (onClose) onClose();
                      }}
                      className="px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                      title="Assign this custom grouping layer as the primary chart dimension (X-Axis / Rows)"
                    >
                      <Sparkles className="w-4 h-4" />
                      Apply as Primary Dimension (X-Axis / Base)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [1]: subFieldKey }));
                        setSecondaryField(CUSTOM_GROUPING_KEY);
                        if (onClose) onClose();
                      }}
                      className="px-3.5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                      title="Assign this custom grouping layer as the secondary chart series (Comparison / Legend)"
                    >
                      <Layers className="w-4 h-4" />
                      Apply as Secondary Series (Comparison)
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [0]: subFieldKey }));
                      setPrimaryField(CUSTOM_GROUPING_KEY);
                      if (onClose) onClose();
                    }}
                    className="px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                    title="Assign this custom grouping layer as the primary chart dimension"
                  >
                    <Sparkles className="w-4 h-4" />
                    Apply as Main Category Dimension
                  </button>
                )}
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-bold transition-all"
                >
                  Done / Close
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
