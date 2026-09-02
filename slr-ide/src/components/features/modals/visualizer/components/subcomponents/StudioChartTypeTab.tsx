import React from 'react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';
import { LayoutTemplateSelector } from './LayoutTemplateSelector';
import type { ChartType } from '../../types';
import { Check } from 'lucide-react';

export interface StudioChartTypeTabProps {
  chartCategoryFilter: string;
  setChartCategoryFilter: (filter: string) => void;
}

export function StudioChartTypeTab({
  chartCategoryFilter,
  setChartCategoryFilter
}: StudioChartTypeTabProps) {
  const { config } = useVisualizerContext();
  const { chartType, setChartType } = config;

  const filteredChartTypes = Object.entries(CHART_TYPES_INFO).filter(([id, info]) => {
    if (chartCategoryFilter === 'all') return true;
    if (chartCategoryFilter === 'categorical') {
      return ['bar_vertical', 'bar_horizontal', 'horizontal_bar_scatter', 'stacked_bar', 'clustered_bar', 'pie_donut', 'radar'].includes(id);
    }
    if (chartCategoryFilter === 'hierarchical') {
      return ['sunburst', 'treemap', 'sankey'].includes(id);
    }
    if (chartCategoryFilter === 'trend') {
      return ['line', 'calendar', 'gauge'].includes(id);
    }
    if (chartCategoryFilter === 'correlation') {
      return ['scatter', 'bubble', 'boxplot'].includes(id);
    }
    if (chartCategoryFilter === 'matrix_flow') {
      return ['heatmap', 'graph', 'sankey', 'bubble'].includes(id);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Figure Layout Template Selector */}
      <LayoutTemplateSelector />

      {/* Chart Format Filter Pills */}
      <div className="space-y-2.5 pt-2 border-t border-border/60">
        <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
          Scientific Visualization Format (18 Charts)
        </label>
        
        <div className="flex flex-wrap gap-1.5 pb-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'categorical', label: 'Categorical' },
            { id: 'hierarchical', label: 'Hierarchical' },
            { id: 'trend', label: 'Trend' },
            { id: 'correlation', label: 'Correlation' },
            { id: 'matrix_flow', label: 'Flow & Matrix' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setChartCategoryFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                chartCategoryFilter === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Chart Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-1">
          {filteredChartTypes.map(([id, info]) => {
            const isSelected = chartType === id;
            const IconComp = info.icon;

            return (
              <button
                key={id}
                type="button"
                onClick={() => setChartType(id as ChartType)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                    : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
                <div>
                  <span className={`text-xs font-bold block leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {info.name.split(' (')[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground block truncate mt-0.5">
                    {info.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
