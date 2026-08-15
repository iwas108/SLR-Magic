import React from 'react';
import { 
  VisualizerProvider, 
  useVisualizerContext 
} from './visualizer';
import {
  VisualizerHeader,
  Step1ChartSelector,
  Step2DataMapping,
  Step3StyleCustomization,
  Step4PreviewStage
} from './visualizer/components';
import type { VisualizerModalProps } from './visualizer/types';

export type { VisualizerModalProps } from './visualizer/types';

function VisualizerModalInner() {
  const { config, workspace } = useVisualizerContext();
  const { currentStep } = config;
  const { isFullscreen } = workspace;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 ${
      isFullscreen ? 'p-0' : 'p-4'
    }`}>
      <div className={`bg-card flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen 
          ? 'w-screen h-screen max-w-none max-h-none rounded-none border-0 shadow-none' 
          : 'w-full h-full max-w-[94vw] max-h-[92vh] rounded-2xl border border-border shadow-2xl'
      }`}>
        <VisualizerHeader />
        {currentStep === 1 && <Step1ChartSelector />}
        {currentStep === 2 && <Step2DataMapping />}
        {currentStep === 3 && <Step3StyleCustomization />}
        {currentStep === 4 && <Step4PreviewStage />}
      </div>
    </div>
  );
}

export function VisualizerModal(props: VisualizerModalProps) {
  if (!props.isOpen) return null;

  return (
    <VisualizerProvider props={props}>
      <VisualizerModalInner />
    </VisualizerProvider>
  );
}

export default VisualizerModal;
