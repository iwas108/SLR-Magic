import React from 'react';
import { ArrowRightLeft, CheckCircle2 } from 'lucide-react';

interface DiscrepancyTableProps {
  stats: any;
  activePoolTab: 'pool_a' | 'pool_b' | 'pool_c';
  qaRules: any[];
  openAdjudicationWorkspace: (disc: any) => void;
  renderPoolCReviewerSummary: (scores: any, rules: any[]) => string;
}

export default function DiscrepancyTable({
  stats,
  activePoolTab,
  qaRules,
  openAdjudicationWorkspace,
  renderPoolCReviewerSummary
}: DiscrepancyTableProps) {
  if (!stats || !stats.isCalibrated || !stats.discrepancies) return null;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-200">
      <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center select-none">
        <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
          <ArrowRightLeft className="w-4 h-4 text-amber-500" />
          Calibration Discrepancies ({stats.discrepancies.length})
        </h4>
        <span className="text-xs text-muted-foreground">Click a row to adjudicate paper</span>
      </div>

      {stats.discrepancies.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-1.5" />
          <p className="text-sm font-bold text-foreground">Zero Discrepancies Found!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Both reviewers are in perfect alignment on all papers.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground font-bold border-b border-border select-none">
                <th className="px-4 py-3">Paper ID</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Reviewer Alpha</th>
                <th className="px-4 py-3">Reviewer Beta</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.discrepancies.map((disc: any) => (
                <tr
                  key={disc.paper_id}
                  onClick={() => openAdjudicationWorkspace(disc)}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {disc.paper_id}
                      {disc.is_resolved && (
                        <span title="Discrepancy Resolved">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-sm truncate text-foreground" title={disc.title}>{disc.title}</td>
                  <td className="px-4 py-3">
                    {activePoolTab === 'pool_c' ? (
                      <span className="font-bold text-blue-500">
                        {renderPoolCReviewerSummary(disc.r1_qa_scores, qaRules)}
                      </span>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r1_decision === 'Include'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-red-500/15 text-red-700 dark:text-red-400'
                      }`}>
                        {disc.r1_decision}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {activePoolTab === 'pool_c' ? (
                      <span className="font-bold text-emerald-500">
                        {renderPoolCReviewerSummary(disc.r2_qa_scores, qaRules)}
                      </span>
                    ) : (
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${disc.r2_decision === 'Include'
                        ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                        : 'bg-red-500/15 text-red-700 dark:text-red-400'
                      }`}>
                        {disc.r2_decision}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {disc.is_resolved ? (
                      <span className="px-2.5 py-1 bg-green-500/15 text-green-700 dark:text-green-400 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        Resolved
                      </span>
                    ) : (
                      <button className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors text-[10px]">
                        Adjudicate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
