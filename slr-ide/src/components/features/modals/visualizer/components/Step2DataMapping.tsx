import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight, Zap, Database, Trash2, Filter } from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { CUSTOM_GROUPING_KEY } from '../constants/defaultConfigs';
import { extractColonPrefixPaths } from '../utils/dataExtractor';
import { useVisualizerContext } from '../context/VisualizerContext';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import { CustomGroupingManager } from './subcomponents/CustomGroupingManager';
import { BreakdownTablePanel } from './subcomponents/BreakdownTablePanel';
import { LiveSplitPreview } from './subcomponents/LiveSplitPreview';
import { RadarDataMappingPanel } from './subcomponents/RadarDataMappingPanel';
import { FieldAutocomplete } from './subcomponents/FieldAutocomplete';

function formatFieldLabel(f: string): string {
  if (f === CUSTOM_GROUPING_KEY) return '✨ [Custom Grouping Layer]';
  if (f.startsWith('ext:macro:')) return `Extracted: ${f.substring(10)} [Level 1: Macro Domain]`;
  if (f.startsWith('ext:sub:')) return `Extracted: ${f.substring(8)} [Level 2: Sub-Category]`;
  if (f.startsWith('ext:leaf:') || f.startsWith('ext:tail:')) return `Extracted: ${f.substring(9)} [Level 3: Taxonomy Leaf / Tail]`;
  if (f.startsWith('raw:leaf:ext:') || f.startsWith('raw:tail:ext:')) return `Extracted: ${f.substring(13)} [Raw Leaf Token (Tail after ':')]`;
  if (f.startsWith('raw:ext:')) return `Extracted: ${f.substring(8)} [Raw Tokens (Full String)]`;
  if (f.startsWith('ext:')) return `Extracted: ${f.substring(4)} [Full Taxonomy String]`;
  return f;
}

function renderFieldOptions(availableFields: string[]) {
  const customGroupFields = availableFields.filter(f => f === CUSTOM_GROUPING_KEY);
  const metadataFields = availableFields.filter(f => !f.startsWith('ext:') && !f.startsWith('raw:ext:') && !f.startsWith('raw:leaf:') && !f.startsWith('raw:tail:') && f !== CUSTOM_GROUPING_KEY);
  const extractedFields = availableFields.filter(f => f.startsWith('ext:') || f.startsWith('raw:ext:') || f.startsWith('raw:leaf:') || f.startsWith('raw:tail:'));

  return (
    <>
      {customGroupFields.length > 0 && (
        <optgroup label="✨ Custom Grouping Layer">
          {customGroupFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
      {extractedFields.length > 0 && (
        <optgroup label="✨ Extracted Variables (3-Tier Taxonomy: Macro / Subcategory / Leaf Tail / Raw)">
          {extractedFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
      {metadataFields.length > 0 && (
        <optgroup label="Standard Metadata Fields">
          {metadataFields.map(f => (
            <option key={f} value={f}>{formatFieldLabel(f)}</option>
          ))}
        </optgroup>
      )}
    </>
  );
}

export function Step2DataMapping() {
  const { props, layout, config, data, workspace } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const { layoutMode } = layout;
  const { showLivePreview } = workspace;
  const {
    chartType,
    setCurrentStep,
    primaryField,
    setPrimaryField,
    secondaryField,
    setSecondaryField,
    metricMode,
    setMetricMode,
    sankeyFields,
    setSankeyFields,
    sankeyMaxNodes,
    setSankeyMaxNodes,
    sankeyLevelPathFilters,
    setSankeyLevelPathFilters,
    tailLabelStyle,
    setTailLabelStyle,
    limitCategories,
    setLimitCategories,
    maxCategoriesCount,
    setMaxCategoriesCount,
    numFieldX,
    setNumFieldX,
    numFieldY,
    setNumFieldY,
    numFieldSize,
    setNumFieldSize,
    bubbleMode,
    setBubbleMode,
    lineMode,
    setLineMode,
    useUmbrellanizer,
    setUseUmbrellanizer,
    splitMultiValues,
    setSplitMultiValues,
    excludeEmpty,
    setExcludeEmpty
  } = config;

  const { availableFields, discoveredVariables, numericalFields } = data;
  const chartInfo = CHART_TYPES_INFO[chartType];

  const levelColonPaths = useMemo(() => {
    return sankeyFields.map(f => {
      return extractColonPrefixPaths(papers, f, {
        useUmbrellanizer,
        umbrellanizerMap
      });
    });
  }, [papers, sankeyFields, useUmbrellanizer, umbrellanizerMap]);

  return (
    <div className={`flex-1 overflow-hidden w-full h-full ${showLivePreview ? 'flex flex-col lg:flex-row' : 'flex flex-col'}`}>
      <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center mx-auto w-full space-y-6 ${showLivePreview ? 'max-w-4xl' : 'max-w-5xl'}`}>
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-0.5">
            <h3 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Step 2: Map Data Fields for <span className="text-primary">{chartInfo.name}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Configure field assignments tailored specifically for {chartInfo.name.toLowerCase()}.
            </p>
          </div>

          <button
            type="button"
            onClick={() => config.handleAutoOptimizeActiveSlot(papers, umbrellanizerMap)}
            className="px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all hover:scale-105 shrink-0"
            title="Automatically optimize chart parameters for this mapped dataset"
          >
            <Zap className="w-4 h-4 text-primary animate-pulse" />
            Smart Auto-Optimize
          </button>
        </div>

        {/* Slot Switcher Bar */}
        {layoutMode !== 'single' && (
          <SlotSwitcherBar showSubtitleEdit={true} />
        )}

      <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        
        {/* 1. Bar Vertical / Bar Horizontal / Funnel */}
        {['bar_vertical', 'bar_horizontal', 'funnel'].includes(chartType) && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                Category Field (X-Axis / Slice)
              </label>
              <FieldAutocomplete
                value={primaryField}
                onChange={(newKey) => setPrimaryField(newKey)}
                discoveredVariables={discoveredVariables}
                availableFields={availableFields}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
              <select
                value={metricMode}
                onChange={(e) => setMetricMode(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="count">Paper Record Count (N)</option>
                <option value="paper_prevalence">Paper Prevalence (% of Cohort Papers)</option>
                <option value="tag_share">Tag Share (% of Total Extracted Tags)</option>
                <option value="avg_citation">Average Citation Count</option>
                <option value="avg_qa">Average Overall QA Score</option>
              </select>
            </div>

            {primaryField === CUSTOM_GROUPING_KEY && (
              <CustomGroupingManager />
            )}
          </div>
        )}

        {/* 1b. Radar Chart (Multi-Variable Requirement Gap & Boundary Paradox) */}
        {chartType === 'radar' && (
          <RadarDataMappingPanel />
        )}

        {/* 2. Clustered Bar / Stacked Bar / Graph */}
        {['clustered_bar', 'stacked_bar', 'graph'].includes(chartType) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Primary Category / Base Axis</label>
                <FieldAutocomplete
                  value={primaryField}
                  onChange={(newKey) => setPrimaryField(newKey)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Comparison Series / Sub-Category</label>
                <FieldAutocomplete
                  value={secondaryField}
                  onChange={(newKey) => setSecondaryField(newKey)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>
            </div>

            {(primaryField === CUSTOM_GROUPING_KEY || secondaryField === CUSTOM_GROUPING_KEY) && (
              <CustomGroupingManager />
            )}

            {['clustered_bar', 'stacked_bar'].includes(chartType) && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
                <select
                  value={metricMode}
                  onChange={(e) => setMetricMode(e.target.value as any)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="count">Paper Record Count (N)</option>
                  <option value="paper_prevalence">Paper Prevalence (% of Cohort Papers)</option>
                  <option value="tag_share">Tag Share (% of Total Extracted Tags)</option>
                  <option value="avg_citation">Average Citation Count</option>
                  <option value="avg_qa">Average Overall QA Score</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* 3. Line Chart */}
        {chartType === 'line' && (
          <div className="space-y-4">
            <div className="space-y-2 p-3 bg-secondary/30 rounded-2xl border border-border/80">
              <span className="text-xs font-black text-foreground block">Line Chart Paradigm</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLineMode('cohort_trend')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left ${
                    lineMode !== 'epistemic_simulation'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="font-bold">Cohort Trend</div>
                  <div className="text-[10px] opacity-75">Empirical Synthesis</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLineMode('epistemic_simulation')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-left ${
                    lineMode === 'epistemic_simulation'
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : 'bg-card border-border/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="font-bold">Epistemic Simulation</div>
                  <div className="text-[10px] opacity-75">Uncertainty Trajectory</div>
                </button>
              </div>
            </div>

            {lineMode !== 'epistemic_simulation' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Time / Sequence Field (X-Axis)</label>
                  <FieldAutocomplete
                    value={primaryField}
                    onChange={(newKey) => setPrimaryField(newKey)}
                    discoveredVariables={discoveredVariables}
                    availableFields={availableFields}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Y-Axis Metric</label>
                  <select
                    value={metricMode}
                    onChange={(e) => setMetricMode(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="count">Paper Record Count (N)</option>
                    <option value="paper_prevalence">Paper Prevalence (% of Cohort Papers)</option>
                    <option value="tag_share">Tag Share (% of Total Extracted Tags)</option>
                    <option value="avg_citation">Average Citation Count</option>
                    <option value="avg_qa">Average Overall QA Score</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
                <span className="text-xs font-bold text-primary block">Mathematical Trajectory Simulation Active</span>
                <span className="text-[11px] text-muted-foreground block">
                  Modeling comparative state uncertainty propagation (Static Architecture vs Discrete Recursive Estimator with Semantic Trigger Threshold). Use Step 3 (Fine-Tune) to adjust time horizons, mathematical drift rates, and threshold values.
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. Pie & Donut */}
        {chartType === 'pie_donut' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Slice Category Field</label>
              <FieldAutocomplete
                value={primaryField}
                onChange={(newKey) => setPrimaryField(newKey)}
                discoveredVariables={discoveredVariables}
                availableFields={availableFields}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Metric Calculation</label>
              <select
                value={metricMode}
                onChange={(e) => setMetricMode(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="count">Paper Record Count (N)</option>
                <option value="paper_prevalence">Paper Prevalence (% of Cohort Papers)</option>
                <option value="tag_share">Tag Share (% of Total Extracted Tags)</option>
                <option value="avg_citation">Average Citation Count</option>
                <option value="avg_qa">Average Overall QA Score</option>
              </select>
            </div>
          </div>
        )}

        {/* 5. Scatter & Boxplot */}
        {['scatter', 'boxplot'].includes(chartType) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Category Variable (X-Axis)</label>
              {chartType === 'boxplot' ? (
                <FieldAutocomplete
                  value={primaryField}
                  onChange={(newKey) => setPrimaryField(newKey)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              ) : (
                <select
                  value={numFieldX}
                  onChange={(e) => setNumFieldX(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Y-Axis Continuous Numerical Metric</label>
              <select
                value={numFieldY}
                onChange={(e) => setNumFieldY(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* 6. Bubble Chart (Categorical 2D Cross-Tabulation Matrix & Continuous 3D) */}
        {chartType === 'bubble' && (
          <div className="space-y-4">
            <div className="p-3 bg-secondary/30 rounded-2xl border border-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">Bubble Chart Paradigm</span>
                <span className="text-[10px] text-muted-foreground block">
                  {bubbleMode === 'categorical_matrix' 
                    ? '2D Categorical Cross-Tabulation (Discovered Cohort Variables × RQ Domains)'
                    : 'Continuous 3D Scatter (Numerical X × Numerical Y × Numerical Size)'}
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Primary Dimension / X-Axis Category</label>
                    <FieldAutocomplete
                      value={primaryField}
                      onChange={(newKey) => setPrimaryField(newKey)}
                      discoveredVariables={discoveredVariables}
                      availableFields={availableFields}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground block">Secondary Dimension / Y-Axis Category</label>
                    <FieldAutocomplete
                      value={secondaryField}
                      onChange={(newKey) => setSecondaryField(newKey)}
                      discoveredVariables={discoveredVariables}
                      availableFields={availableFields}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Bubble Sizing Metric</label>
                  <select
                    value={metricMode}
                    onChange={(e) => setMetricMode(e.target.value as any)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="count">Paper Record Count (N)</option>
                    <option value="paper_prevalence">Paper Prevalence (% of Cohort Papers)</option>
                    <option value="tag_share">Tag Share (% of Total Extracted Tags)</option>
                    <option value="avg_citation">Average Citation Count</option>
                    <option value="avg_qa">Average Overall QA Score</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">X-Axis Continuous Variable</label>
                  <select
                    value={numFieldX}
                    onChange={(e) => setNumFieldX(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Y-Axis Continuous Variable</label>
                  <select
                    value={numFieldY}
                    onChange={(e) => setNumFieldY(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground block">Bubble Size Metric</label>
                  <select
                    value={numFieldSize}
                    onChange={(e) => setNumFieldSize(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Heatmap Matrix */}
        {chartType === 'heatmap' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Row Category (X-Axis)</label>
                <FieldAutocomplete
                  value={primaryField}
                  onChange={(newKey) => setPrimaryField(newKey)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Column Category (Y-Axis)</label>
                <FieldAutocomplete
                  value={secondaryField}
                  onChange={(newKey) => setSecondaryField(newKey)}
                  discoveredVariables={discoveredVariables}
                  availableFields={availableFields}
                />
              </div>
            </div>
          </div>
        )}

        {/* 8. Dynamic Multi-Level Depth (Sankey Flow, Sunburst Ring & Treemap) */}
        {['sankey', 'sunburst', 'treemap'].includes(chartType) && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <span className="text-xs font-bold text-foreground">
                {chartType === 'sankey' ? 'Sankey Flow' : chartType === 'sunburst' ? 'Sunburst Ring' : 'Treemap Tile'} Depth Levels
              </span>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* 1-Click Auto-Expand 3-Tier Hierarchy Preset */}
                {availableFields.some((f: string) => f.startsWith('ext:macro:')) && (
                  <div className="flex items-center gap-1.5 bg-card border border-amber-500/30 rounded-lg px-2 py-1 shadow-sm">
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                    <span className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400">⚡ Auto-Expand 3-Tier Hierarchy:</span>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const k = e.target.value;
                          setSankeyFields([
                            `ext:macro:${k}`,
                            `ext:sub:${k}`,
                            `ext:leaf:${k}`
                          ]);
                          e.target.value = '';
                        }
                      }}
                      className="bg-secondary/40 border border-border rounded px-1.5 py-0.5 text-[11px] font-extrabold text-foreground focus:outline-none focus:border-primary"
                    >
                      <option value="" disabled>Select Extracted Variable...</option>
                      {Array.from(new Set(
                        availableFields
                          .filter((f: string) => f.startsWith('ext:macro:'))
                          .map((f: string) => f.substring(10))
                      )).map((k: string) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Levels ({sankeyFields.length}):</span>
                  <button
                    disabled={sankeyFields.length <= (chartType === 'sankey' ? 2 : 1)}
                    onClick={() => {
                      if (sankeyFields.length > (chartType === 'sankey' ? 2 : 1)) {
                        setSankeyFields(sankeyFields.slice(0, sankeyFields.length - 1));
                      }
                    }}
                    className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                    title={sankeyFields.length <= (chartType === 'sankey' ? 2 : 1) ? 'Minimum levels reached' : 'Remove last level'}
                  >
                    -
                  </button>
                  <button
                    disabled={sankeyFields.length >= 6}
                    onClick={() => setSankeyFields([...sankeyFields, availableFields[0] || 'Unspecified'])}
                    className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                    title="Add level"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sankeyFields.map((fieldVal: string, idx: number) => {
                const availablePaths = levelColonPaths[idx] || { fullPaths: [], segments: [] };
                const hasPaths = (availablePaths.fullPaths?.length || 0) > 0 || (availablePaths.segments?.length || 0) > 0;

                return (
                  <div key={idx} className="p-3 bg-secondary/30 border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground block">
                        Level {idx + 1} ({idx === 0 ? 'Source / Inner' : idx === sankeyFields.length - 1 ? 'Target / Outer' : 'Intermediate'})
                      </label>
                      {sankeyFields.length > (chartType === 'sankey' ? 2 : 1) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSankeyFields(sankeyFields.filter((_, i) => i !== idx));
                            const nextFilters = { ...sankeyLevelPathFilters };
                            delete nextFilters[idx];
                            setSankeyLevelPathFilters(nextFilters);
                          }}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title={`Remove Level ${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <FieldAutocomplete
                      value={fieldVal}
                      onChange={(newKey) => {
                        const next = [...sankeyFields];
                        next[idx] = newKey;
                        setSankeyFields(next);
                        if (sankeyLevelPathFilters[idx]) {
                          const nextFilters = { ...sankeyLevelPathFilters };
                          delete nextFilters[idx];
                          setSankeyLevelPathFilters(nextFilters);
                        }
                      }}
                      discoveredVariables={discoveredVariables}
                      availableFields={availableFields}
                      size="sm"
                      showIntegrityWarning={false}
                    />

                    {/* Colon-separated Path Filter */}
                    {hasPaths && (
                      <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border/40 text-[10.5px]">
                        <span className="text-muted-foreground font-bold flex items-center gap-1 shrink-0">
                          <Filter className="w-3 h-3 text-primary/70" />
                          <span>Path Filter:</span>
                        </span>
                        <select
                          value={sankeyLevelPathFilters[idx] || ''}
                          onChange={(e) => {
                            const nextFilters = { ...sankeyLevelPathFilters };
                            if (e.target.value) {
                              nextFilters[idx] = e.target.value;
                            } else {
                              delete nextFilters[idx];
                            }
                            setSankeyLevelPathFilters(nextFilters);
                          }}
                          className="bg-card border border-border/80 rounded px-1.5 py-0.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-primary max-w-[150px] truncate"
                        >
                          <option value="">All Paths (Full Tree)</option>
                          {availablePaths.segments && availablePaths.segments.length > 0 && (
                            <optgroup label="🌟 Cross-Parent Segments (Includes All Parents)">
                              {availablePaths.segments.map(seg => (
                                <option key={`seg:${seg}`} value={`* : ${seg}`}>
                                  Segment: {seg} (All Parents)
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {availablePaths.fullPaths && availablePaths.fullPaths.length > 0 && (
                            <optgroup label="🌳 Specific Hierarchy Branches">
                              {availablePaths.fullPaths.map(p => (
                                <option key={`path:${p}`} value={p}>
                                  Branch: {p}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-muted-foreground">
                          Max Nodes (Top N):
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          placeholder="Unlimited"
                          value={sankeyMaxNodes[idx] || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Math.max(0, Number(e.target.value)) : 0;
                            setSankeyMaxNodes({ ...sankeyMaxNodes, [idx]: val });
                          }}
                          className="w-24 bg-card border border-border rounded-md px-2 py-0.5 text-[11px] font-bold text-foreground text-right focus:outline-none focus:border-primary"
                        />
                      </div>

                      {Number(sankeyMaxNodes[idx]) >= 2 && (
                        <div className="flex items-center justify-between pt-0.5">
                          <label className="text-[10px] font-bold text-muted-foreground">
                            Tail Label Style:
                          </label>
                          <select
                            value={tailLabelStyle || 'comma_list'}
                            onChange={(e) => setTailLabelStyle(e.target.value as any)}
                            className="bg-card border border-border rounded-md px-1.5 py-0.5 text-[10px] font-bold text-foreground focus:outline-none focus:border-primary max-w-[130px]"
                          >
                            <option value="comma_list">Comma List (A, B)</option>
                            <option value="other_count">Other (K items)</option>
                            <option value="other_items">Other: Items...</option>
                            <option value="plain_other">Plain "Other"</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {sankeyFields.includes(CUSTOM_GROUPING_KEY) && (
              <CustomGroupingManager />
            )}
          </div>
        )}

        {/* 9. Gauge KPI Dial Settings */}
        {chartType === 'gauge' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">KPI Target Indicator</label>
              <select
                value={metricMode}
                onChange={(e) => setMetricMode(e.target.value as any)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="avg_qa">Average Overall QA Score Target (%)</option>
                <option value="count">PDF Acquisition Completeness Ratio (%)</option>
                <option value="avg_citation">Average Citation Yield</option>
              </select>
            </div>
          </div>
        )}

        {/* Category Data Limiting Option */}
        {['bar_vertical', 'bar_horizontal', 'clustered_bar', 'stacked_bar', 'line', 'pie_donut', 'funnel', 'radar', 'boxplot', 'graph', 'heatmap'].includes(chartType) && (
          <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={limitCategories}
                  onChange={(e) => setLimitCategories(e.target.checked)}
                  className="rounded border-border text-primary"
                />
                Enable Category Limiting (Group Minority Tail into "Other")
              </label>
            </div>

            {limitCategories && (
              <div className="flex items-center gap-3 pt-1">
                <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  Max Categories to Show (Top N-1 + "Other"):
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={maxCategoriesCount}
                  onChange={(e) => setMaxCategoriesCount(Math.max(2, Number(e.target.value)))}
                  className="w-24 bg-card border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Dynamic Real Data Breakdown Table Component */}
        <BreakdownTablePanel />

        {/* Streamlined Extraction & Cell Treatment Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-secondary/20 border border-border/80 rounded-xl">
          <span className="text-xs font-bold text-foreground">
            Data Processing Options
          </span>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground hover:text-primary">
              <input
                type="checkbox"
                checked={splitMultiValues}
                onChange={(e) => setSplitMultiValues(e.target.checked)}
                className="rounded border-border text-primary"
              />
              Split Multi-Value Cells
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground hover:text-primary">
              <input
                type="checkbox"
                checked={excludeEmpty}
                onChange={(e) => setExcludeEmpty(e.target.checked)}
                className="rounded border-border text-primary"
              />
              Exclude Unspecified
            </label>
          </div>
        </div>

      </div>

      {/* Step 2 Footer */}
      <div className="w-full flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep(1)}
          className="px-5 py-2.5 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Layout & Types
        </button>
        <button
          onClick={() => setCurrentStep(3)}
          className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        >
          Proceed to Style Customization
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      </div>

      {showLivePreview && <LiveSplitPreview />}
    </div>
  );
}
