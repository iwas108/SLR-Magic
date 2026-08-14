import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { useVisualizerContext } from '../context/VisualizerContext';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import { CustomGroupingManager } from './subcomponents/CustomGroupingManager';
import { BreakdownTablePanel } from './subcomponents/BreakdownTablePanel';
import { LiveSplitPreview } from './subcomponents/LiveSplitPreview';

export function Step2DataMapping() {
  const { layout, config, data, workspace } = useVisualizerContext();
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
    useUmbrellanizer,
    setUseUmbrellanizer,
    splitMultiValues,
    setSplitMultiValues,
    excludeEmpty,
    setExcludeEmpty
  } = config;

  const { availableFields, numericalFields } = data;
  const chartInfo = CHART_TYPES_INFO[chartType];

  return (
    <div className={`flex-1 overflow-hidden w-full h-full ${showLivePreview ? 'flex flex-col lg:flex-row' : 'flex flex-col'}`}>
      <div className={`flex-1 overflow-y-auto p-6 flex flex-col items-center mx-auto w-full space-y-6 ${showLivePreview ? 'max-w-4xl' : 'max-w-5xl'}`}>
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-foreground tracking-tight">
            Step 2: Map Data Fields for <span className="text-primary">{chartInfo.name}</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Configure field assignments tailored specifically for {chartInfo.name.toLowerCase()}.
          </p>
        </div>

        {/* Slot Switcher Bar */}
        {layoutMode !== 'single' && (
          <SlotSwitcherBar showSubtitleEdit={true} />
        )}

      <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        
        {/* 1. Bar Vertical / Bar Horizontal / Funnel / Radar */}
        {['bar_vertical', 'bar_horizontal', 'funnel', 'radar'].includes(chartType) && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">
                {chartType === 'radar' ? 'Primary Series Grouping Variable' : 'Category Field (X-Axis / Slice)'}
              </label>
              <select
                value={primaryField}
                onChange={(e) => setPrimaryField(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                {availableFields.map((f: string) => (
                  <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                ))}
              </select>
            </div>

            {chartType !== 'radar' && (
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

        {/* 2. Stacked Bar / Graph */}
        {['stacked_bar', 'graph'].includes(chartType) && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Primary Category / Source Node</label>
                <select
                  value={primaryField}
                  onChange={(e) => setPrimaryField(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {availableFields.map((f: string) => (
                    <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Sub-Category / Target Node</label>
                <select
                  value={secondaryField}
                  onChange={(e) => setSecondaryField(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {availableFields.map((f: string) => (
                    <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                  ))}
                </select>
              </div>
            </div>

            {chartType === 'stacked_bar' && (
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
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Time / Sequence Field (X-Axis)</label>
              <select
                value={primaryField}
                onChange={(e) => setPrimaryField(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                {availableFields.map((f: string) => (
                  <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                ))}
              </select>
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
          </div>
        )}

        {/* 4. Pie & Donut */}
        {chartType === 'pie_donut' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Slice Category Field</label>
              <select
                value={primaryField}
                onChange={(e) => setPrimaryField(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                {availableFields.map((f: string) => (
                  <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                ))}
              </select>
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
                <select
                  value={primaryField}
                  onChange={(e) => setPrimaryField(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {availableFields.map((f: string) => (
                    <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                  ))}
                </select>
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

        {/* 6. Bubble Chart */}
        {chartType === 'bubble' && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">X-Axis Variable</label>
              <select
                value={numFieldX}
                onChange={(e) => setNumFieldX(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
              >
                {numericalFields.map((f: string) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground block">Y-Axis Variable</label>
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

        {/* 7. Heatmap Matrix */}
        {chartType === 'heatmap' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Row Category (X-Axis)</label>
                <select
                  value={primaryField}
                  onChange={(e) => setPrimaryField(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {availableFields.map((f: string) => (
                    <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">Column Category (Y-Axis)</label>
                <select
                  value={secondaryField}
                  onChange={(e) => setSecondaryField(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                >
                  {availableFields.map((f: string) => (
                    <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 8. Dynamic Multi-Level Depth (Sankey Flow, Sunburst Ring & Treemap) */}
        {['sankey', 'sunburst', 'treemap'].includes(chartType) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <span className="text-xs font-bold text-foreground">
                {chartType === 'sankey' ? 'Sankey Flow' : chartType === 'sunburst' ? 'Sunburst Ring' : 'Treemap Tile'} Depth Levels
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Levels ({sankeyFields.length}):</span>
                <button
                  disabled={sankeyFields.length <= 2}
                  onClick={() => setSankeyFields(sankeyFields.slice(0, sankeyFields.length - 1))}
                  className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                >
                  -
                </button>
                <button
                  disabled={sankeyFields.length >= 6}
                  onClick={() => setSankeyFields([...sankeyFields, availableFields[0] || 'Unspecified'])}
                  className="w-7 h-7 rounded-lg bg-secondary border border-border font-bold text-xs flex items-center justify-center disabled:opacity-40 hover:bg-secondary/80"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sankeyFields.map((fieldVal: string, idx: number) => (
                <div key={idx} className="p-3 bg-secondary/30 border border-border rounded-xl space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    Level {idx + 1} ({idx === 0 ? 'Source / Inner' : idx === sankeyFields.length - 1 ? 'Target / Outer' : 'Intermediate'})
                  </label>
                  <select
                    value={fieldVal}
                    onChange={(e) => {
                      const next = [...sankeyFields];
                      next[idx] = e.target.value;
                      setSankeyFields(next);
                    }}
                    className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  >
                    {availableFields.map((f: string) => (
                      <option key={f} value={f}>{f.startsWith('ext:') ? `Extracted: ${f.substring(4)}` : f}</option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between pt-1">
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
                </div>
              ))}
            </div>
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
        {['bar_vertical', 'bar_horizontal', 'stacked_bar', 'line', 'pie_donut', 'funnel', 'radar', 'boxplot', 'graph', 'heatmap'].includes(chartType) && (
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

        {/* Custom Grouping Layer Component */}
        <CustomGroupingManager />

        {/* Dynamic Real Data Breakdown Table Component */}
        <BreakdownTablePanel />

        {/* Cell Value & Extraction Controls */}
        <div className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-3 pt-3">
          <span className="text-[10px] font-extrabold uppercase text-primary block">
            Cell & Extraction Value Treatment
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={useUmbrellanizer}
                onChange={(e) => setUseUmbrellanizer(e.target.checked)}
                className="rounded border-border text-primary"
              />
              Umbrellanizer Taxonomy
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={splitMultiValues}
                onChange={(e) => setSplitMultiValues(e.target.checked)}
                className="rounded border-border text-primary"
              />
              Split Multi-Value Cells
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
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
