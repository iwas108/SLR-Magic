import React from 'react';
import { 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  AlertTriangle 
} from 'lucide-react';
import type { GlobalScanSummary, CitationStatus } from '@/lib/services/reference-syncer-types';

interface SyncerStatsHudProps {
  summary: GlobalScanSummary;
  activeFilter: 'ALL' | CitationStatus;
  onFilterChange: (filter: 'ALL' | CitationStatus) => void;
}

export default function SyncerStatsHud({
  summary,
  activeFilter,
  onFilterChange
}: SyncerStatsHudProps) {
  const cards = [
    {
      id: 'ALL' as const,
      label: 'Total Scanned',
      count: summary.totalCitations,
      subtext: `${summary.totalFiles} .tex file(s)`,
      icon: FileText,
      color: 'text-foreground',
      bg: 'bg-secondary/40 border-border'
    },
    {
      id: 'RESOLVED' as const,
      label: 'Auto-Resolved',
      count: summary.resolvedReplacements,
      subtext: `${summary.totalCitations > 0 ? ((summary.resolvedReplacements / summary.totalCitations) * 100).toFixed(1) : 0}% replacement ready`,
      icon: RefreshCw,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10 border-blue-500/30'
    },
    {
      id: 'EXACT_MATCH' as const,
      label: 'Valid In .bib',
      count: summary.exactMatches,
      subtext: 'Already matching bib key',
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/30'
    },
    {
      id: 'AMBIGUOUS' as const,
      label: 'Ambiguous',
      count: summary.ambiguousCitations,
      subtext: 'Multiple candidates found',
      icon: HelpCircle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/30'
    },
    {
      id: 'MISSING' as const,
      label: 'Missing In .bib',
      count: summary.missingFromBib,
      subtext: 'Broken / absent from bib',
      icon: AlertCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/30'
    },
    {
      id: 'SUSPICIOUS' as const,
      label: 'Suspicious / Flagged',
      count: summary.suspiciousFindingsCount,
      subtext: 'Unformatted / in-text patterns',
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10 border-orange-500/30'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        const isSelected = activeFilter === c.id;

        return (
          <button
            key={c.id}
            onClick={() => onFilterChange(c.id)}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden group ${c.bg} ${
              isSelected ? 'ring-2 ring-primary shadow-md scale-[1.02]' : 'hover:border-border/80 hover:bg-secondary/60'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {c.label}
              </span>
              <Icon className={`w-4 h-4 ${c.color} transition-transform group-hover:scale-110`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {c.count}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">
              {c.subtext}
            </p>
          </button>
        );
      })}
    </div>
  );
}
