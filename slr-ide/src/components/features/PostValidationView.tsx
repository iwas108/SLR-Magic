'use client';

import React, { useState } from 'react';
import UmbrellanizerView from './post-validation/UmbrellanizerView';
import RollingBatchView from './post-validation/RollingBatchView';

interface PostValidationViewProps {
  projectId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeSubTab: 'umbrellanizer' | 'rolling-batch';
}

export default function PostValidationView({ projectId, showToast, activeSubTab }: PostValidationViewProps) {
  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'umbrellanizer' ? (
          <UmbrellanizerView projectId={projectId} showToast={showToast} />
        ) : (
          <RollingBatchView projectId={projectId} showToast={showToast} />
        )}
      </div>
    </div>
  );
}
