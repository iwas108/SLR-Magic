import React, { useState, useMemo } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import { getMappedFieldValue, formatVariableDisplayName, discoverColonDepth, discoverColonSegmentsByLevel, extractCleanTaxonomyKey } from '../../utils/dataExtractor';
import { FieldAutocomplete } from './FieldAutocomplete';
import { BreakdownTablePanel } from './BreakdownTablePanel';
import { RadarDataMappingPanel } from './RadarDataMappingPanel';
import { 
  Database, 
  Sparkles, 
  Table, 
  ChevronRight, 
  Sliders, 
  Layers, 
  Plus, 
  Minus, 
  Trash2, 
  HelpCircle,
  Filter,
  X
} from 'lucide-react';

export interface StudioDataTabProps {
  onOpenCustomGroupingModal: (targetSlotIndex?: number) => void;
  onOpenCrossTabModal: () => void;
}

function FieldColonSegmentPicker({
  fieldKey,
  onFieldChange,
  papers,
  useUmbrellanizer,
  umbrellanizerMap
}: {
  fieldKey: string;
  onFieldChange: (newKey: string) => void;
  papers: any[];
  useUmbrellanizer: boolean;
  umbrellanizerMap: any;
}) {
  const cleanKey = extractCleanTaxonomyKey(fieldKey);

  if (!cleanKey) return null;
  const depth = discoverColonDepth(papers, cleanKey, { useUmbrellanizer, umbrellanizerMap });
  if (depth <= 1) return null;

  // Detect current segment index
  let currentSegIdx = -1;
  if (fieldKey.includes('lv1:') || fieldKey.includes('macro:')) currentSegIdx = 0;
  else if (fieldKey.includes('lv2:') || fieldKey.includes('sub:')) currentSegIdx = 1;
  else if (fieldKey.includes('lv3:') || fieldKey.includes('leaf:')) currentSegIdx = 2;
  else {
    const matchLv = fieldKey.match(/^ext:lv(\d+):/);
    if (matchLv) currentSegIdx = parseInt(matchLv[1], 10) - 1;
    const matchSeg = fieldKey.match(/^ext:segment:(\d+):/);
    if (matchSeg) currentSegIdx = parseInt(matchSeg[1], 10);
  }

  // Detect scope
  const scopeMatch = fieldKey.match(/\[(.*)\]$/);
  const currentScope = scopeMatch ? scopeMatch[1].trim() : '';

  const segmentsByLevel = discoverColonSegmentsByLevel(papers, cleanKey, {
    useUmbrellanizer,
    umbrellanizerMap
  });

  const candidateSegments: string[] = [];
  Object.entries(segmentsByLevel).forEach(([sLvlStr, segList]) => {
    const sLvl = Number(sLvlStr);
    if (sLvl !== currentSegIdx) {
      (segList || []).forEach(seg => {
        if (!candidateSegments.includes(seg)) candidateSegments.push(seg);
      });
    }
  });

  const setSegmentAndScope = (newSegIdx: number, newScope: string) => {
    let prefix = 'ext:';
    if (newSegIdx >= 0) {
      prefix = `ext:lv${newSegIdx + 1}:`;
    }
    const scopeSuffix = newScope ? `[${newScope}]` : '';
    onFieldChange(`${prefix}${cleanKey}${scopeSuffix}`);
  };

  return (
    <div className="mt-1.5 p-2 bg-secondary/20 rounded-xl border border-border/60 space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold text-muted-foreground">Extract Colon Segment:</span>
        <button
          type="button"
          onClick={() => setSegmentAndScope(-1, currentScope)}
          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
            currentSegIdx === -1
              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
              : 'bg-card hover:bg-secondary text-foreground border-border'
          }`}
          title="Use full unsegmented field"
        >
          Full (All)
        </button>
        {Array.from({ length: depth }).map((_, s) => {
          const isSelected = currentSegIdx === s;
          const sLabel = s === 0 ? 'Lv1 (Macro)' : s === 1 ? 'Lv2 (Sub)' : s === 2 ? 'Lv3 (Leaf)' : `Lv${s + 1}`;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSegmentAndScope(s, currentScope)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card hover:bg-secondary text-foreground border-border'
              }`}
            >
              {sLabel}
            </button>
          );
        })}
      </div>

      <div className="pt-1.5 border-t border-border/40 space-y-1">
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
            <Filter className="w-2.5 h-2.5 text-primary" />
            Parent Scope Filter:
          </span>
          {currentScope && (
            <button
              type="button"
              onClick={() => setSegmentAndScope(currentSegIdx, '')}
              className="text-[9.5px] font-bold text-destructive hover:underline flex items-center gap-0.5"
            >
              <X className="w-2.5 h-2.5" /> Clear Scope
            </button>
          )}
        </div>

        {currentScope ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
              Scoped to: &ldquo;{currentScope}&rdquo;
              <button
                type="button"
                onClick={() => setSegmentAndScope(currentSegIdx, '')}
                className="hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        ) : (
          candidateSegments.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground/80 mr-0.5">Filter by:</span>
              {candidateSegments.slice(0, 8).map(seg => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSegmentAndScope(currentSegIdx >= 0 ? currentSegIdx : (depth > 2 ? 2 : 1), seg)}
                  className="px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-card hover:bg-primary/10 hover:text-primary border border-border/60 transition-all"
                >
                  +{seg}
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function StudioDataTab({ onOpenCustomGroupingModal, onOpenCrossTabModal }: StudioDataTabProps) {
  const { props, config, data } = useVisualizerContext();
  const {
    chartType,
    primaryField,
    setPrimaryField,
    secondaryField,
    setSecondaryField,
    sankeyFields,
    setSankeyFields,
    sankeyLevelPathFilters,
    setSankeyLevelPathFilters,
    numFieldX,
    setNumFieldX,
    numFieldY,
    setNumFieldY,
    numFieldSize,
    setNumFieldSize,
    bubbleMode,
    setBubbleMode,
    lineMode,
    setLineMode
  } = config;

  const { papers, umbrellanizerMap } = props;
  const { 
    availableFields, 
    discoveredVariables, 
    numericalFields,
    levelCustomGroups,
    setLevelCustomGroups,
    levelCustomGroupLinks,
    setLevelCustomGroupLinks,
    levelTargetFields,
    setLevelTargetFields
  } = data;
  const [showBreakdownTable, setShowBreakdownTable] = useState<boolean>(false);

  // Dynamic prevalence calculation for custom grouping layers (Level 0 and Level 1)
  const primCustomPrevalence = useMemo(() => {
    if (primaryField !== CUSTOM_GROUPING_KEY || !papers || papers.length === 0) return undefined;
    const positiveSet = new Set<any>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, CUSTOM_GROUPING_KEY, {
        subFieldKey: levelTargetFields?.[0],
        levelIdx: 0,
        levelCustomGroups,
        levelCustomGroupLinks,
        levelTargetFields,
        excludeEmpty: true,
        useUmbrellanizer: config.useUmbrellanizer,
        umbrellanizerMap,
        splitMultiValues: config.splitMultiValues
      });
      const valid = vals.filter(v => v && v !== 'Unassigned / Other' && v !== 'Unassigned' && v !== 'Unspecified');
      if (valid.length > 0) {
        positiveSet.add(p.Paper_ID || p.id || p.title || p.Title || p);
      }
    });
    const pos = positiveSet.size;
    const tot = papers.length;
    const pct = tot > 0 ? Math.round((pos / tot) * 100) : 0;
    return { positivePaperCount: pos, totalCohortCount: tot, prevalencePct: pct };
  }, [primaryField, papers, levelTargetFields, levelCustomGroups, levelCustomGroupLinks, config.useUmbrellanizer, umbrellanizerMap, config.splitMultiValues]);

  const secCustomPrevalence = useMemo(() => {
    if (secondaryField !== CUSTOM_GROUPING_KEY || !papers || papers.length === 0) return undefined;
    const positiveSet = new Set<any>();
    papers.forEach(p => {
      const vals = getMappedFieldValue(p, CUSTOM_GROUPING_KEY, {
        subFieldKey: levelTargetFields?.[1],
        levelIdx: 1,
        levelCustomGroups,
        levelCustomGroupLinks,
        levelTargetFields,
        excludeEmpty: true,
        useUmbrellanizer: config.useUmbrellanizer,
        umbrellanizerMap,
        splitMultiValues: config.splitMultiValues
      });
      const valid = vals.filter(v => v && v !== 'Unassigned / Other' && v !== 'Unassigned' && v !== 'Unspecified');
      if (valid.length > 0) {
        positiveSet.add(p.Paper_ID || p.id || p.title || p.Title || p);
      }
    });
    const pos = positiveSet.size;
    const tot = papers.length;
    const pct = tot > 0 ? Math.round((pos / tot) * 100) : 0;
    return { positivePaperCount: pos, totalCohortCount: tot, prevalencePct: pct };
  }, [secondaryField, papers, levelTargetFields, levelCustomGroups, levelCustomGroupLinks, config.useUmbrellanizer, umbrellanizerMap, config.splitMultiValues]);

  // Per-level dynamic prevalence calculation for Sankey / Sunburst / Treemap hierarchical rings
  const getSankeyLevelPrevalence = useMemo(() => {
    return (lIdx: number, field: string) => {
      if (field !== CUSTOM_GROUPING_KEY || !papers || papers.length === 0) return undefined;
      const targetKey = levelTargetFields?.[lIdx] || (sankeyFields[lIdx] !== CUSTOM_GROUPING_KEY ? sankeyFields[lIdx] : undefined) || sankeyFields.find((f, i) => f !== CUSTOM_GROUPING_KEY && i !== lIdx) || primaryField || 'Year';
      const positiveSet = new Set<any>();
      papers.forEach(p => {
        const vals = getMappedFieldValue(p, CUSTOM_GROUPING_KEY, {
          subFieldKey: targetKey,
          levelIdx: lIdx,
          levelCustomGroups,
          levelCustomGroupLinks,
          levelTargetFields,
          excludeEmpty: true,
          useUmbrellanizer: config.useUmbrellanizer,
          umbrellanizerMap,
          splitMultiValues: config.splitMultiValues
        });
        const valid = vals.filter(v => v && v !== 'Unassigned / Other' && v !== 'Unassigned' && v !== 'Unspecified');
        if (valid.length > 0) {
          positiveSet.add(p.Paper_ID || p.id || p.title || p.Title || p);
        }
      });
      const pos = positiveSet.size;
      const tot = papers.length;
      const pct = tot > 0 ? Math.round((pos / tot) * 100) : 0;
      return { positivePaperCount: pos, totalCohortCount: tot, prevalencePct: pct };
    };
  }, [sankeyFields, primaryField, papers, levelTargetFields, levelCustomGroups, levelCustomGroupLinks, config.useUmbrellanizer, umbrellanizerMap, config.splitMultiValues]);

  return (
    <div className="space-y-5">
      {/* Radar Chart Multi-Dimension Mapping */}
      {chartType === 'radar' && (
        <RadarDataMappingPanel />
      )}
      {/* 1. Line Chart Paradigm Selector */}
      {chartType === 'line' && (
        <div className="space-y-2 p-3 bg-secondary/30 rounded-2xl border border-border/80">
          <label className="text-xs font-bold text-foreground block">
            Line Chart Scientific Paradigm:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLineMode('cohort_trend')}
              className={`p-2 rounded-xl border text-left transition-all ${
                lineMode !== 'epistemic_simulation'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                  : 'bg-card border-border hover:bg-secondary/40 text-foreground'
              }`}
            >
              <div className="font-bold text-xs">Empirical SLR Trend</div>
              <div className="text-[10px] opacity-75">Publication Trajectory</div>
            </button>
            <button
              type="button"
              onClick={() => setLineMode('epistemic_simulation')}
              className={`p-2 rounded-xl border text-left transition-all ${
                lineMode === 'epistemic_simulation'
                  ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/20'
                  : 'bg-card border-border hover:bg-secondary/40 text-foreground'
              }`}
            >
              <div className="font-bold text-xs">Epistemic Simulation</div>
              <div className="text-[10px] opacity-75">Uncertainty Trajectory</div>
            </button>
          </div>
        </div>
      )}

      {/* 2. Primary Categorical Variable */}
      {((chartType === 'line' && lineMode !== 'epistemic_simulation') || [
        'bar_vertical', 
        'bar_horizontal', 
        'horizontal_bar_scatter', 
        'stacked_bar', 
        'clustered_bar', 
        'pie_donut', 
        'funnel', 
        'heatmap', 
        'graph', 
        'boxplot'
      ].includes(chartType)) && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>
              {chartType === 'horizontal_bar_scatter'
                ? 'Primary Variable / Horizontal Bar Category (e.g. Operational Domains):'
                : 'Primary Variable / X-Axis Category:'}
            </span>
            <button
              type="button"
              onClick={() => onOpenCustomGroupingModal(0)}
              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 shrink-0 ml-2"
              title="Manage Custom Groupings & Thematic Clusters"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Custom Groups</span>
            </button>
          </label>
          <FieldAutocomplete
            value={primaryField}
            onChange={(newVal) => setPrimaryField(newVal)}
            discoveredVariables={discoveredVariables}
            availableFields={availableFields}
            customPrevalence={primCustomPrevalence}
          />
          <FieldColonSegmentPicker
            fieldKey={primaryField}
            onFieldChange={setPrimaryField}
            papers={papers}
            useUmbrellanizer={config.useUmbrellanizer}
            umbrellanizerMap={umbrellanizerMap}
          />
        </div>
      )}

      {/* 3. Secondary Series / Grouping Variable */}
      {['stacked_bar', 'clustered_bar', 'horizontal_bar_scatter', 'heatmap', 'graph'].includes(chartType) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">
              {chartType === 'horizontal_bar_scatter'
                ? 'Secondary Variable / Boundary Disclosure Rate (e.g. Physical Threshold Reporting):'
                : 'Secondary Variable / Series Dimension:'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenCustomGroupingModal(1)}
                className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
                title="Manage Custom Groupings & Thematic Clusters"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Custom Groups</span>
              </button>
              {secondaryField && secondaryField !== CUSTOM_GROUPING_KEY && (
                <button
                  type="button"
                  onClick={onOpenCrossTabModal}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Table className="w-3 h-3" />
                  View 2D Matrix
                </button>
              )}
            </div>
          </div>
          <FieldAutocomplete
            value={secondaryField}
            onChange={(newVal) => setSecondaryField(newVal)}
            discoveredVariables={discoveredVariables}
            availableFields={availableFields}
            customPrevalence={secCustomPrevalence}
          />
          <FieldColonSegmentPicker
            fieldKey={secondaryField}
            onFieldChange={setSecondaryField}
            papers={papers}
            useUmbrellanizer={config.useUmbrellanizer}
            umbrellanizerMap={umbrellanizerMap}
          />
        </div>
      )}

      {/* 4. Multi-Level Hierarchy Fields (Sankey, Sunburst, Treemap) */}
      {['sankey', 'sunburst', 'treemap'].includes(chartType) && (
        <div className="space-y-3 p-3 bg-secondary/30 rounded-2xl border border-border/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-foreground">Hierarchy Stratification Levels</label>
            <button
              type="button"
              onClick={() => {
                if (sankeyFields.length < 5) {
                  setSankeyFields([...sankeyFields, discoveredVariables[sankeyFields.length]?.key || 'Year']);
                }
              }}
              disabled={sankeyFields.length >= 5}
              className="px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Level
            </button>
          </div>

          <div className="space-y-2">
            {sankeyFields.map((field, idx) => (
              <div key={idx} className="space-y-1 p-2 bg-card rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    Level {idx + 1} {idx === 0 ? '(Root / Inner)' : idx === sankeyFields.length - 1 ? '(Leaf / Outer)' : '(Intermediate)'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenCustomGroupingModal(idx)}
                      className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5 mr-1.5"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                      Custom Groups
                    </button>
                    {sankeyFields.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSankeyFields(sankeyFields.filter((_, i) => i !== idx));
                          const reindexRecord = <T,>(rec: Record<number, T> | undefined): Record<number, T> => {
                            if (!rec) return {};
                            const res: Record<number, T> = {};
                            Object.entries(rec).forEach(([k, v]) => {
                              const n = Number(k);
                              if (n < idx) res[n] = v;
                              else if (n > idx) res[n - 1] = v;
                            });
                            return res;
                          };
                          if (config.setLevelScopeFilters) config.setLevelScopeFilters((prev: Record<number, string>) => reindexRecord(prev));
                          if (config.setLevelSegmentIndices) config.setLevelSegmentIndices((prev: Record<number, number>) => reindexRecord(prev));
                          if (setLevelCustomGroups) setLevelCustomGroups((prev: Record<number, string[]>) => reindexRecord(prev));
                          if (setLevelCustomGroupLinks) setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => reindexRecord(prev));
                          if (setLevelTargetFields) setLevelTargetFields((prev: Record<number, string>) => reindexRecord(prev));
                        }}
                        className="text-muted-foreground hover:text-red-500 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <FieldAutocomplete
                  value={field}
                  onChange={(newVal) => {
                    const next = [...sankeyFields];
                    next[idx] = newVal;
                    setSankeyFields(next);
                    // If base variable changed, reset stale scope filter & segment index
                    const oldBase = field.replace(/^ext:(macro:|sub:|leaf:|tail:|lv\d+:|segment:\d+:)?/, '').replace(/^raw:(leaf:|tail:)?ext:/, '').replace(/^ext:/, '');
                    const newBase = newVal.replace(/^ext:(macro:|sub:|leaf:|tail:|lv\d+:|segment:\d+:)?/, '').replace(/^raw:(leaf:|tail:)?ext:/, '').replace(/^ext:/, '');
                    if (oldBase !== newBase) {
                      config.setLevelScopeFilters((prev: Record<number, string>) => {
                        const copy = { ...prev };
                        delete copy[idx];
                        return copy;
                      });
                      config.setLevelSegmentIndices((prev: Record<number, number>) => {
                        const copy = { ...prev };
                        delete copy[idx];
                        return copy;
                      });
                    }
                  }}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                  customPrevalence={getSankeyLevelPrevalence(idx, field)}
                />

                {/* Dynamic Colon Segment Selector for Multi-Tier Taxonomy Fields */}
                {(() => {
                  const targetVarKey = field === CUSTOM_GROUPING_KEY ? (levelTargetFields?.[idx] || primaryField) : field;
                  if (!targetVarKey) return null;
                  const depth = discoverColonDepth(papers, targetVarKey, { useUmbrellanizer: config.useUmbrellanizer, umbrellanizerMap });
                  if (depth <= 1) return null;

                  const currentSegIdx = config.levelSegmentIndices?.[idx] ?? (
                    field.includes('lv1') || field.includes('macro') ? 0 :
                    field.includes('lv2') || field.includes('sub') ? 1 :
                    field.includes('lv3') || field.includes('leaf') ? 2 : idx
                  );

                  return (
                    <div className="mt-1.5 p-2 bg-secondary/20 rounded-xl border border-border/60 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-muted-foreground">Extract Colon Segment:</span>
                        {Array.from({ length: depth }).map((_, s) => {
                          const isSelected = currentSegIdx === s;
                          const sLabel = s === 0 ? 'Lv1 (Macro)' : s === 1 ? 'Lv2 (Sub)' : s === 2 ? 'Lv3 (Leaf)' : `Lv${s + 1}`;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                config.setLevelSegmentIndices((prev: Record<number, number>) => ({
                                  ...prev,
                                  [idx]: s
                                }));
                              }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border transition-all ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                  : 'bg-card hover:bg-secondary text-foreground border-border'
                              }`}
                              title={`Extract segment ${s + 1} (0-indexed ${s}) from colon-separated taxonomy`}
                            >
                              {sLabel}
                            </button>
                          );
                        })}
                      </div>

                      {/* Parent Scope Filter: Discover and filter by intermediate parent segments */}
                      {(() => {
                        const segmentsByLevel = discoverColonSegmentsByLevel(papers, targetVarKey, {
                          useUmbrellanizer: config.useUmbrellanizer,
                          umbrellanizerMap
                        });
                        // Candidate filter values come from all segments OTHER than the current extracted segment
                        const candidateSegments: string[] = [];
                        Object.entries(segmentsByLevel).forEach(([sLvlStr, segList]) => {
                          const sLvl = Number(sLvlStr);
                          if (sLvl !== currentSegIdx) {
                            const list = (segList as string[]) || [];
                            list.forEach((seg: string) => {
                              if (!candidateSegments.includes(seg)) candidateSegments.push(seg);
                            });
                          }
                        });

                        const currentScope = config.levelScopeFilters?.[idx] || '';

                        return (
                          <div className="pt-1.5 border-t border-border/40 space-y-1">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                <Filter className="w-2.5 h-2.5 text-primary" />
                                Parent Scope Filter:
                              </span>
                              {currentScope && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    config.setLevelScopeFilters((prev: Record<number, string>) => {
                                      const next = { ...prev };
                                      delete next[idx];
                                      return next;
                                    });
                                  }}
                                  className="text-[9.5px] font-bold text-destructive hover:underline flex items-center gap-0.5"
                                >
                                  <X className="w-2.5 h-2.5" /> Clear Scope
                                </button>
                              )}
                            </div>

                            {/* Active scope indicator badge */}
                            {currentScope ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 text-[10px] font-black">
                                  <span>Scoped to: <strong>"{currentScope}"</strong></span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      config.setLevelScopeFilters((prev: Record<number, string>) => {
                                        const next = { ...prev };
                                        delete next[idx];
                                        return next;
                                      });
                                    }}
                                    className="hover:text-destructive p-0.5"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              </div>
                            ) : null}

                            {/* Suggestion Pills */}
                            {candidateSegments.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                <span className="text-[9.5px] text-muted-foreground italic">Filter by:</span>
                                {candidateSegments.slice(0, 8).map(seg => {
                                  const isScopeSelected = currentScope.toLowerCase() === seg.toLowerCase();
                                  return (
                                    <button
                                      key={seg}
                                      type="button"
                                      onClick={() => {
                                        config.setLevelScopeFilters((prev: Record<number, string>) => ({
                                          ...prev,
                                          [idx]: isScopeSelected ? '' : seg
                                        }));
                                      }}
                                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold border transition-all ${
                                        isScopeSelected
                                          ? 'bg-primary text-primary-foreground border-primary font-bold'
                                          : 'bg-card hover:bg-secondary text-muted-foreground border-border'
                                      }`}
                                      title={`Filter level ${idx + 1} extraction to only include tokens matching "${seg}"`}
                                    >
                                      {seg}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {/* Custom Scope input */}
                            <div className="flex items-center gap-1 pt-0.5">
                              <input
                                type="text"
                                value={currentScope}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  config.setLevelScopeFilters((prev: Record<number, string>) => ({
                                    ...prev,
                                    [idx]: val
                                  }));
                                }}
                                placeholder="Custom scope (e.g. Edge Hosted)..."
                                className="flex-1 bg-card border border-border rounded px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:border-primary/60 font-mono"
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {field === CUSTOM_GROUPING_KEY && (
                  <div className="mt-1.5 p-2 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] font-bold text-foreground truncate">
                          Source: <strong className="text-primary font-mono">{formatVariableDisplayName(levelTargetFields?.[idx] || (sankeyFields[idx] !== CUSTOM_GROUPING_KEY ? sankeyFields[idx] : undefined) || sankeyFields.find((f, i) => f !== CUSTOM_GROUPING_KEY && i !== idx) || primaryField || 'Year')}</strong>
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 text-[9.5px] font-black font-mono">
                          {(levelCustomGroups?.[idx] || []).length} groups
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCustomGroupingModal(idx)}
                      className="px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-black transition-all flex items-center gap-1 shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      Edit Groups
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Bubble Chart 2D Matrix / Continuous Mapping */}
      {chartType === 'bubble' && (
        <div className="space-y-3.5 p-3 bg-secondary/30 rounded-2xl border border-border/80">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-foreground block">Bubble Chart Paradigm</span>
              <span className="text-[10px] text-muted-foreground block">
                {bubbleMode === 'categorical_matrix'
                  ? '2D Categorical Matrix (Standard SLR)'
                  : 'Continuous 3D Scatter (Numerical X × Y × Size)'}
              </span>
            </div>
            <select
              value={bubbleMode || 'categorical_matrix'}
              onChange={(e) => setBubbleMode(e.target.value as any)}
              className="bg-card border border-border rounded-xl px-2.5 py-1 text-xs font-bold text-foreground"
            >
              <option value="categorical_matrix">2D Categorical Matrix (Standard SLR)</option>
              <option value="numerical_3d">Continuous 3D Scatter</option>
            </select>
          </div>

          {bubbleMode === 'categorical_matrix' ? (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Primary Dimension / X-Axis Category:</span>
                  <button
                    type="button"
                    onClick={() => onOpenCustomGroupingModal(0)}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Custom Groups
                  </button>
                </label>
                <FieldAutocomplete
                  value={primaryField}
                  onChange={(newVal) => setPrimaryField(newVal)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground">
                    Secondary Dimension / Y-Axis Category:
                  </label>
                  {secondaryField && (
                    <button
                      type="button"
                      onClick={onOpenCrossTabModal}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                    >
                      <Table className="w-3 h-3" />
                      View 2D Matrix
                    </button>
                  )}
                </div>
                <FieldAutocomplete
                  value={secondaryField}
                  onChange={(newVal) => setSecondaryField(newVal)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground block">X-Axis Continuous Field</label>
                <select
                  value={numFieldX}
                  onChange={(e) => setNumFieldX(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                >
                  {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground block">Y-Axis Continuous Field</label>
                <select
                  value={numFieldY}
                  onChange={(e) => setNumFieldY(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                >
                  {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-foreground block">Bubble Size Dimension</label>
                <select
                  value={numFieldSize}
                  onChange={(e) => setNumFieldSize(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground"
                >
                  {numericalFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Universal Custom Grouping, Stratification & Metric Studio Launcher Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onOpenCustomGroupingModal(0)}
          className="w-full p-3.5 rounded-2xl bg-primary/10 hover:bg-primary/20 border-2 border-primary/30 text-primary font-black text-xs flex items-center justify-between transition-all shadow-xs active:scale-[0.99] group"
          title="Open Comprehensive Custom Grouping, Thematic Stratification, Extraction Protocols & Scientific Metric Studio"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="font-black text-xs text-foreground">Custom Grouping & Stratification Studio</div>
              <div className="text-[10px] text-muted-foreground font-medium">Manage groups, tail bundling, taxonomy, splits & metrics</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-primary opacity-80 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Cohort Statistical Breakdown Inspector */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowBreakdownTable(!showBreakdownTable)}
          className="w-full p-2.5 rounded-xl border border-border bg-card hover:bg-secondary/60 text-foreground font-bold text-xs flex items-center justify-between transition-colors shadow-xs"
        >
          <span className="flex items-center gap-2">
            <Table className="w-4 h-4 text-primary" />
            {showBreakdownTable ? 'Hide Cohort Statistical Breakdown' : 'Inspect Cohort Statistical Breakdown'}
          </span>
          <ChevronRight className={`w-4 h-4 transition-transform ${showBreakdownTable ? 'rotate-90' : ''}`} />
        </button>

        {showBreakdownTable && (
          <div className="mt-2">
            <BreakdownTablePanel />
          </div>
        )}
      </div>
    </div>
  );
}
