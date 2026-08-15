import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { Sparkles, Eye } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { SLOT_METADATA, formatSubfigureLabel } from '../../constants/layoutPresets';
import { CHART_TYPES_INFO } from '../../constants/chartTypes';

export function LiveSplitPreview() {
  const { layout, config, style, generateSlotOption } = useVisualizerContext();
  const { activeSlot, layoutMode, activeSlotsList } = layout;
  const { slotsConfig } = config;
  const { subfigureLabelStyle } = style;

  const chartDomRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  const slotMeta = SLOT_METADATA[activeSlot];
  const slotCfg = slotsConfig[activeSlot];
  const chartType = slotCfg?.chartType || 'bar_vertical';
  const chartInfo = CHART_TYPES_INFO[chartType];
  const subfigureIndex = activeSlotsList.indexOf(activeSlot);
  const subfigureLabel = subfigureIndex >= 0 ? formatSubfigureLabel(subfigureIndex, subfigureLabelStyle) : '';

  // Initialize and update ECharts instance
  useEffect(() => {
    if (!chartDomRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartDomRef.current, undefined, {
        renderer: 'canvas'
      });
    }

    try {
      const option = generateSlotOption(activeSlot);
      chartInstanceRef.current.setOption(option, true);
      chartInstanceRef.current.resize();
    } catch (err) {
      console.warn('Failed to render live split preview option:', err);
    }
  }, [activeSlot, generateSlotOption, slotsConfig, style]);

  // Handle auto-resize
  useEffect(() => {
    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };

    const dom = chartDomRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (dom && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        chartInstanceRef.current?.resize();
      });
      resizeObserver.observe(dom);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && dom) resizeObserver.unobserve(dom);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full lg:w-[480px] xl:w-[540px] bg-card border border-border rounded-2xl flex flex-col overflow-hidden shadow-sm shrink-0 self-stretch my-2 mr-2">
      {/* Panel Header */}
      <div className="p-3 px-4 bg-secondary/30 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {layoutMode !== 'single' && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-black">
              {slotMeta.name} {subfigureLabel ? `[${subfigureLabel}]` : ''}
            </span>
          )}
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            {chartInfo?.name || 'Live Chart'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live Sync</span>
        </div>
      </div>

      {/* Interactive Chart Canvas */}
      <div className="flex-1 relative bg-secondary/10 flex items-center justify-center p-3 min-h-[360px]">
        <div 
          ref={chartDomRef} 
          className="w-full h-full min-h-[340px]" 
        />
      </div>

      {/* Sub-caption / Tip Footer */}
      <div className="p-2.5 px-4 bg-secondary/20 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" />
          Updates live as you configure fields and styles.
        </span>
        {layoutMode !== 'single' && (
          <span className="text-[10px] italic">
            Configuring {slotMeta.name}
          </span>
        )}
      </div>
    </div>
  );
}
