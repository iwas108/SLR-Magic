import React, { useState, useMemo } from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import { getMappedFieldValue } from '../../utils/dataExtractor';
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
  HelpCircle 
} from 'lucide-react';

export interface StudioDataTabProps {
  onOpenCustomGroupingModal: (targetSlotIndex?: number) => void;
  onOpenCrossTabModal: () => void;
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
    levelCustomGroupLinks,
    levelTargetFields
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
                        onClick={() => setSankeyFields(sankeyFields.filter((_, i) => i !== idx))}
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
                  }}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
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
