import React from 'react';
import { GitCommit, ChevronRight } from 'lucide-react';

interface LedgerEntry {
  id: number;
  commit_hash: string;
  project_id: string;
  paper_id: string;
  pool: string;
  adjudicator: string;
  previous_state: string; // JSON string
  resolved_decision: string;
  resolved_ec: string | null;
  resolved_rationale: string;
  commit_message: string;
  timestamp: string;
}

interface AuditLedgerProps {
  ledger: LedgerEntry[];
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  maskAdjudicatorString: (adjudicator: string) => string;
  formatPrevState: (stateStr: string) => string;
}

export default function AuditLedger({
  ledger,
  activePoolTab,
  maskAdjudicatorString,
  formatPrevState
}: AuditLedgerProps) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden select-none">
      <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center">
        <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
          <GitCommit className="w-4 h-4 text-primary" />
          Calibration Audit Ledger ({ledger.length})
        </h4>
      </div>

      {ledger.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-xs">
          No ledger actions recorded yet. Import reviews or resolve discrepancies to build the history.
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto divide-y divide-border text-xs">
          {ledger.map((entry) => (
            <div key={entry.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-muted/10 transition-all animate-in fade-in duration-100">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono bg-secondary px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground">
                    {entry.commit_hash}
                  </span>
                  <strong className="text-foreground">{entry.paper_id}</strong>
                  <span className="text-muted-foreground text-[10px]">
                    by <span className="font-semibold text-foreground">{maskAdjudicatorString(entry.adjudicator)}</span>
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs italic">"{entry.commit_message}"</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[10px]">
                  {formatPrevState(entry.previous_state)}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.resolved_decision === 'Include'
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                  : entry.resolved_decision === 'Exclude'
                    ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}>
                  {entry.resolved_decision} {entry.resolved_ec ? `(${entry.resolved_ec})` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
