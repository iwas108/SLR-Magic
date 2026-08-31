import { createContext, useContext } from 'react';
import type * as echarts from 'echarts';
import type { useVisualizerLayout } from '../hooks/useVisualizerLayout';
import type { useVisualizerConfig } from '../hooks/useVisualizerConfig';
import type { useVisualizerData } from '../hooks/useVisualizerData';
import type { useVisualizerStyle } from '../hooks/useVisualizerStyle';
import type { useVisualizerCamera } from '../hooks/useVisualizerCamera';
import type { useVisualizerWorkspace } from '../hooks/useVisualizerWorkspace';
import type { useVisualizerPresets } from '../hooks/useVisualizerPresets';
import type { useChartCanvas } from '../hooks/useChartCanvas';
import type { VisualizerModalProps, SlotId } from '../types';

export interface VisualizerContextValue {
  props: VisualizerModalProps;
  layout: ReturnType<typeof useVisualizerLayout>;
  config: ReturnType<typeof useVisualizerConfig>;
  data: ReturnType<typeof useVisualizerData>;
  style: ReturnType<typeof useVisualizerStyle>;
  camera: ReturnType<typeof useVisualizerCamera>;
  workspace: ReturnType<typeof useVisualizerWorkspace>;
  presets: ReturnType<typeof useVisualizerPresets>;
  canvas: ReturnType<typeof useChartCanvas>;
  generateSlotOption: (slotId: SlotId, overrides?: any) => echarts.EChartsOption;
}

export const VisualizerContext = createContext<VisualizerContextValue | null>(null);

export function useVisualizerContext() {
  const context = useContext(VisualizerContext);
  if (!context) {
    throw new Error('useVisualizerContext must be used within a VisualizerProvider');
  }
  return context;
}
