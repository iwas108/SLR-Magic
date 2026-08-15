import React from 'react';
import { ChevronDown, ArrowRight, AlertTriangle } from 'lucide-react';
import { CHART_TYPES_INFO } from '../constants/chartTypes';
import { useVisualizerContext } from '../context/VisualizerContext';
import { LayoutTemplateSelector } from './subcomponents/LayoutTemplateSelector';
import { SlotSwitcherBar } from './subcomponents/SlotSwitcherBar';
import type { ChartType } from '../types';

export function Step1ChartSelector() {
  const { props, layout, config } = useVisualizerContext();
  const { papers, totalUnfilteredCount, isFiltered } = props;
  const { layoutMode } = layout;
  const { chartType, setChartType, setCurrentStep } = config;

  const chartInfo = CHART_TYPES_INFO[chartType];
  const IconComp = chartInfo.icon;

  const handleSelectChart = (selectedType: ChartType) => {
    setChartType(selectedType);
    config.autoOptimizeSlot(layout.activeSlot, papers, props.umbrellanizerMap);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center max-w-5xl mx-auto w-full space-y-6">
      {isFiltered && (
        <div className="w-full max-w-xl p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
          <div>
            <span className="font-bold text-xs block">Cohort Table View Filter Active</span>
            <p className="text-[11px] opacity-90 leading-tight">
              The chart datasource is currently filtered ({papers.length} of {totalUnfilteredCount || papers.length} papers displayed). Generated figures will reflect only this filtered subset.
            </p>
          </div>
        </div>
      )}

      <div className="text-center space-y-2">
        <h3 className="text-xl font-bold text-foreground tracking-tight">Step 1: Choose Layout & Chart Types</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Select a publication layout template (single or composite multi-block) and assign chart formats to each slot.
        </p>
      </div>

      {/* Layout Template Selector */}
      <LayoutTemplateSelector />

      {/* Slot Switcher when Multi-Block layout is active */}
      {layoutMode !== 'single' && (
        <SlotSwitcherBar showSubtitleEdit={true} />
      )}

      {/* Primary Dropdown Selector for Active Slot */}
      <div className="w-full max-w-md space-y-2">
        <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block text-center">
          Chart Format for Active Slot ({chartInfo.name})
        </label>
        <div className="relative">
          <select
            value={chartType}
            onChange={(e) => handleSelectChart(e.target.value as ChartType)}
            className="w-full bg-secondary border-2 border-primary/40 rounded-xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-primary appearance-none shadow-sm cursor-pointer"
          >
            {Object.entries(CHART_TYPES_INFO).map(([id, info]) => (
              <option key={id} value={id}>
                {info.name} — ({info.category})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Active Selected Chart Card */}
      <div className="w-full bg-card border border-border rounded-2xl p-6 shadow-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <IconComp className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-foreground">{chartInfo.name}</h4>
            <span className="text-[10px] font-extrabold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              {chartInfo.category}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Description</span>
            <p className="text-xs text-foreground font-medium">{chartInfo.description}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-primary block">Recommended SLR Use Case</span>
            <p className="text-xs text-muted-foreground font-medium">{chartInfo.slrUseCase}</p>
          </div>
        </div>
      </div>

      {/* Quick Choice Grid */}
      <div className="w-full space-y-3">
        <span className="text-xs font-bold text-muted-foreground uppercase block text-center">
          Or pick visually from all 17 templates:
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {Object.entries(CHART_TYPES_INFO).map(([id, info]) => {
            const ItemIcon = info.icon;
            const isSelected = chartType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectChart(id as ChartType)}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-sm scale-105 font-bold'
                    : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                }`}
              >
                <ItemIcon className="w-4 h-4" />
                <span className="text-[10px] leading-tight font-semibold line-clamp-1">{info.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1 Footer */}
      <div className="w-full flex justify-end pt-4">
        <button
          onClick={() => setCurrentStep(2)}
          className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
        >
          Proceed to Data Mapping
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
