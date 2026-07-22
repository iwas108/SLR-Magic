import React, { useState } from 'react';
import { ArrowLeft, Target, Table, DollarSign, ChevronDown, ChevronUp, BookOpen, HelpCircle, AlertCircle } from 'lucide-react';
import ScientificRigorPanel from './scientific-rigor/ScientificRigorPanel';
import FinalCohortPanel from './final-cohort/FinalCohortPanel';
import AccountingPanel from './accounting/AccountingPanel';

export default function ProjectViewer({ sessionData, activeTab, setActiveTab, onBack }) {
  const [showMetadata, setShowMetadata] = useState(false);

  const project = sessionData?.project || {};
  const scientificRigorData = sessionData?.scientific_rigor;
  const finalCohortData = sessionData?.final_cohort;
  const accountingData = sessionData?.accounting;

  const currentTab = activeTab || 'insight-export-rigor';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 bg-card border border-border rounded-xl shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
              title="Back to Sessions Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-foreground">{project.name || 'Untitled SLR Project'}</h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded">
                  Snapshot Dataset
                </span>
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors ml-2"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {showMetadata ? 'Hide Manifesto' : 'View Manifesto & Objectives'}
                  {showMetadata ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exported on {sessionData?.export_date ? new Date(sessionData.export_date).toLocaleString() : (sessionData?.exportDate ? new Date(sessionData.exportDate).toLocaleString() : '—')}
              </p>
            </div>
          </div>

          {/* Quick Sub-tab Navigation */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 border border-border rounded-xl w-full md:w-auto">
            <button
              onClick={() => setActiveTab('insight-export-rigor')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                currentTab === 'insight-export-rigor'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-emerald-500" />
              Scientific Rigor
            </button>

            <button
              onClick={() => setActiveTab('insight-export-cohort')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                currentTab === 'insight-export-cohort'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-indigo-500" />
              Final Cohort
            </button>

            <button
              onClick={() => setActiveTab('insight-export-accounting')}
              className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                currentTab === 'insight-export-accounting'
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-500" />
              Accounting
            </button>
          </div>
        </div>

        {/* Collapsible Project Manifesto & Objectives Drawer */}
        {showMetadata && (
          <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {project.research_manifesto && (
              <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  Research Manifesto
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed whitespace-pre-line">
                  {project.research_manifesto}
                </p>
              </div>
            )}

            {project.research_questions && (
              <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  Research Questions (RQs)
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed whitespace-pre-line">
                  {project.research_questions}
                </p>
              </div>
            )}

            {project.exclusion_criteria && (
              <div className="p-3 bg-secondary/40 rounded-lg border border-border space-y-1 md:col-span-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  Exclusion Criteria Rules
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed whitespace-pre-line">
                  {project.exclusion_criteria}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Tab Panel */}
      {currentTab === 'insight-export-rigor' && (
        <ScientificRigorPanel scientificRigorData={scientificRigorData} projectData={project} />
      )}

      {currentTab === 'insight-export-cohort' && (
        <FinalCohortPanel finalCohortData={finalCohortData} projectData={project} />
      )}

      {currentTab === 'insight-export-accounting' && (
        <AccountingPanel accountingData={accountingData} />
      )}
    </div>
  );
}
