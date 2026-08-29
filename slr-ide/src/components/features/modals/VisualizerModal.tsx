import React from 'react';
import { 
  VisualizerProvider, 
  useVisualizerContext 
} from './visualizer';
import {
  VisualizerHeader,
  VisualizerStudio
} from './visualizer/components';
import type { VisualizerModalProps } from './visualizer/types';

export type { VisualizerModalProps } from './visualizer/types';

function VisualizerModalInner() {
  const { workspace } = useVisualizerContext();
  const { isFullscreen } = workspace;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 ${
      isFullscreen ? 'p-0' : 'p-2 sm:p-4'
    }`}>
      <div className={`bg-card flex flex-col overflow-hidden transition-all duration-200 ${
        isFullscreen 
          ? 'w-screen h-screen max-w-none max-h-none rounded-none border-0 shadow-none' 
          : 'w-full h-full max-w-[96vw] max-h-[94vh] rounded-2xl border border-border shadow-2xl'
      }`}>
        <VisualizerHeader />
        <VisualizerStudio />
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

