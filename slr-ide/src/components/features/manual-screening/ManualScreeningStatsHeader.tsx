import React from 'react';

interface ManualScreeningStatsHeaderProps {
  stats: any;
  isFullscreen: boolean;
  onFullscreenToggle: () => void;
}

export default function ManualScreeningStatsHeader({
  isFullscreen,
  onFullscreenToggle
}: ManualScreeningStatsHeaderProps) {
  return (
    <button
      onClick={onFullscreenToggle}
      className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 rounded-lg shadow-sm text-xs font-semibold cursor-pointer uppercase tracking-wider"
    >
      {isFullscreen ? 'Exit Workspace' : 'Maximize Workspace'}
    </button>
  );
}
