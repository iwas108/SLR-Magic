'use client';

import React, { useState } from 'react';
import { FileOutput, BarChart, Settings, Database, CloudUpload } from 'lucide-react';
import AccountingPanel from './insight-export/AccountingPanel';
import ScientificRigorPanel from './insight-export/ScientificRigorPanel';
import FinalCohortPanel from './insight-export/FinalCohortPanel';
import FairDataExportPanel from './insight-export/FairDataExportPanel';
import CloudGoldMinePanel from './insight-export/CloudGoldMinePanel';

interface InsightExportViewProps {
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  activeTab: string;
  searchTerm?: string;
  setSearchTerm?: (val: string) => void;
  showFilters?: boolean;
  setShowFilters?: (val: boolean) => void;
  activeFiltersCount?: number;
  setActiveFiltersCount?: (val: number) => void;
  isVisualizerOpen?: boolean;
  setIsVisualizerOpen?: (val: boolean) => void;
  isLlmContextBuilderOpen?: boolean;
  setIsLlmContextBuilderOpen?: (val: boolean) => void;
}

export default function InsightExportView({
  projectId,
  showToast,
  activeTab,
  searchTerm,
  setSearchTerm,
  showFilters,
  setShowFilters,
  activeFiltersCount,
  setActiveFiltersCount,
  isVisualizerOpen,
  setIsVisualizerOpen,
  isLlmContextBuilderOpen,
  setIsLlmContextBuilderOpen
}: InsightExportViewProps) {
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground font-medium">Please activate a project to view Insights & Exports.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-background overflow-hidden ${activeTab === 'insight-export-cohort' ? '' : 'rounded-lg border border-border'}`}>
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className={`flex-1 overflow-auto bg-background ${activeTab === 'insight-export-cohort' ? 'p-0 flex flex-col h-full' : 'p-4'}`}>
          {activeTab === 'insight-export-accounting' && <AccountingPanel projectId={projectId} showToast={showToast} />}
          {activeTab === 'insight-export-rigor' && <ScientificRigorPanel projectId={projectId} showToast={showToast} />}
          {activeTab === 'insight-export-cohort' && (
            <FinalCohortPanel
              projectId={projectId}
              showToast={showToast}
              searchTerm={searchTerm || ''}
              setSearchTerm={setSearchTerm || (() => {})}
              showFilters={showFilters || false}
              setShowFilters={setShowFilters || (() => {})}
              setActiveFiltersCount={setActiveFiltersCount || (() => {})}
              isVisualizerOpen={isVisualizerOpen}
              setIsVisualizerOpen={setIsVisualizerOpen}
              isLlmContextBuilderOpen={isLlmContextBuilderOpen}
              setIsLlmContextBuilderOpen={setIsLlmContextBuilderOpen}
            />
          )}
          {activeTab === 'insight-export-fair-data' && <FairDataExportPanel projectId={projectId} showToast={showToast} />}
          {activeTab === 'insight-export-gold-mine' && <CloudGoldMinePanel projectId={projectId} showToast={showToast} />}
        </div>
      </div>
    </div>
  );
}
