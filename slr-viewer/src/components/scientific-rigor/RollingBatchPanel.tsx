import React from 'react';
import { CheckCircle, AlertCircle, Layers } from 'lucide-react';
import BatchStatisticsCards from './BatchStatisticsCards';

export default function RollingBatchPanel({ rollingBatchQC }: { rollingBatchQC?: any }) {
  if (!rollingBatchQC) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        No rolling batch sequential QC data available in this snapshot.
      </div>
    );
  }

  const {
    batches = [],
    overall_status,
    exit_triggered,
    cumulative_stats,
    individual_batch_stats = [],
    audit_passed = false
  } = rollingBatchQC;

  const completedBatches = batches.filter((b: any) => b.status === 'PASSED' || b.status === 'complete');
  const batchesCount = completedBatches.length > 0 ? completedBatches.length : (batches.length > 0 ? batches.length : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Cumulative Stats Row */}
      <div className="space-y-2 select-none">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequential Audit Progress</h4>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            audit_passed 
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
          }`}>
            {audit_passed ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Sequential Audit Complete (Satisfied)
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                Sequential Audit In Progress (Unsatisfied)
              </>
            )}
          </span>
        </div>

        <BatchStatisticsCards 
          stats={cumulative_stats} 
          auditPassed={audit_passed} 
          batchesCount={batchesCount}
        />
      </div>

      {/* Historical Batch Breakdown */}
      {(completedBatches.length > 0 || batches.length > 0) && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider">Historical Batch Performance</h3>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Finalized Date</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Agreement</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 3: Miss Rate</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Schema Integrity</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: CI Lower</th>
                  <th className="py-2.5 px-3 text-center">Stage 4: Semantic Agreement</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {batches.map((batch: any) => {
                  const indStats = individual_batch_stats.find(
                    (s: any) => s.batchId === batch.id || s.batchNumber === batch.batch_number
                  )?.stats;

                  const batchStats = indStats || cumulative_stats;
                  const isPassed = batchStats?.s3?.passed !== false && batchStats?.s4?.passed !== false;
                  
                  return (
                    <tr key={batch.id || batch.batch_number} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold">#{batch.batch_number}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {batch.finalized_at ? new Date(batch.finalized_at).toLocaleDateString() : (batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'N/A')}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        {batchStats?.s3?.p_hat !== undefined ? `${(batchStats.s3.p_hat * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {batchStats?.s3?.CI_lower !== undefined ? `${(batchStats.s3.CI_lower * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {batchStats?.s3?.critical_miss_rate !== undefined ? (
                          <span className={batchStats.s3.critical_miss_rate === 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"}>
                            {batchStats.s3.critical_miss_rate.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        {batchStats?.s4?.schema_integrity_rate !== undefined 
                          ? `${batchStats.s4.schema_integrity_rate.toFixed(1)}%` 
                          : (batchStats?.s4?.schema_integrity !== undefined ? `${batchStats.s4.schema_integrity.toFixed(1)}%` : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">
                        {batchStats?.s4?.CI_lower !== undefined ? `${(batchStats.s4.CI_lower * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {batchStats?.s4?.semantic_agreement !== undefined ? (
                          <span className="text-amber-500 font-semibold">
                            {batchStats.s4.semantic_agreement.toFixed(1)}%
                          </span>
                        ) : (batchStats?.s4?.exact_match !== undefined ? (
                          <span className="text-amber-500 font-semibold">
                            {batchStats.s4.exact_match.toFixed(1)}%
                          </span>
                        ) : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPassed 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {isPassed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
