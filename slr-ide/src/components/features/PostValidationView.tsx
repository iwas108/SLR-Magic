'use client';

import React, { useState } from 'react';
import UmbrellanizerView from './post-validation/UmbrellanizerView';

interface PostValidationViewProps {
  projectId: string;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function PostValidationView({ projectId, showToast }: PostValidationViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'umbrellanizer' | 'rolling-batch'>('umbrellanizer');

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Header and Sub-tab selector */}
      <div className="flex items-center justify-between border-b border-border bg-card p-4 rounded-xl shadow-sm">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setActiveSubTab('umbrellanizer')}
            className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all ${
              activeSubTab === 'umbrellanizer'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            1. Umbrellanizer
          </button>
          <button
            onClick={() => setActiveSubTab('rolling-batch')}
            className={`text-xs font-bold uppercase tracking-wider pb-2 border-b-2 transition-all ${
              activeSubTab === 'rolling-batch'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            2. Rolling Batch
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'umbrellanizer' ? (
          <UmbrellanizerView projectId={projectId} showToast={showToast} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-card/40 border border-dashed border-border rounded-2xl p-8 text-center">
            <h3 className="font-bold text-sm text-foreground mb-1">Rolling Batch Engine</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Continuous queueing and worker matching systems for sliding review cohorts. This engine is currently on standby.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
