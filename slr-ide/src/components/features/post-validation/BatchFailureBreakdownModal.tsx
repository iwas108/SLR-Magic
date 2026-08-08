import React from 'react';
import { X, AlertTriangle, CheckCircle, HelpCircle, Layers, FileText } from 'lucide-react';

interface CriticalMissDetail {
  paper_id: string;
  title: string;
  rule_code: string;
  aiScore: number;
  goldScore: number;
  diff: number;
}

interface SchemaDiscrepancyDetail {
  paper_id: string;
  title: string;
  missing_key: string;
}

interface BatchFailureBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchNumber: number | null;
  finalizedAt?: string | null;
  stats: any | null;
}

export function BatchFailureBreakdownModal({
  isOpen,
  onClose,
  batchNumber,
  finalizedAt,
  stats
}: BatchFailureBreakdownModalProps) {
  if (!isOpen || !stats) return null;

  const s3 = stats.s3 || {};
  const s4 = stats.s4 || {};

  const criticalMissRate = s3.critical_miss_rate || 0;
  const s3CiLower = (s3.CI_lower || 0) * 100;
  const s3Passed = s3.passed;

  const schemaIntegrity = s4.schema_integrity_rate || 0;
  const s4CiLower = (s4.CI_lower || 0) * 100;
  const s4Passed = s4.passed;

  const overallPassed = s3Passed && s4Passed;

  const criticalMisses: CriticalMissDetail[] = s3.criticalMissDetails || [];
  const schemaDiscrepancies: SchemaDiscrepancyDetail[] = s4.schemaDiscrepancies || [];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20 select-none">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              overallPassed 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            }`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-foreground">
                  Batch #{batchNumber !== null ? batchNumber : 'N/A'} Quality Control Breakdown
                </h3>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  overallPassed 
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}>
                  {overallPassed ? 'Passed' : 'Failed'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Finalized on {finalizedAt ? new Date(finalizedAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          
          {/* Audit Gating Rules Grid */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Audit Gating Rules Diagnostic Summary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              
              {/* Stage 3 Critical Miss Rate Rule */}
              <div className={`p-3.5 border rounded-xl bg-card space-y-1 ${
                criticalMissRate === 0 
                  ? 'border-emerald-500/30' 
                  : 'border-red-500/40 bg-red-500/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">Stage 3: Critical Miss Rate</span>
                  <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    criticalMissRate === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/15 text-red-500 font-extrabold'
                  }`}>
                    {criticalMissRate === 0 ? '✓ PASSED' : '✗ FAILED'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Actual: <strong className="text-foreground">{criticalMissRate.toFixed(1)}%</strong></span>
                  <span>Target: <strong className="text-foreground">0.0%</strong></span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  Measures QA criteria with a full ≥ 1.0 score deviation between AI & Gold consensus.
                </p>
              </div>

              {/* Stage 3 CI Lower Bound Rule */}
              <div className={`p-3.5 border rounded-xl bg-card space-y-1 ${
                s3CiLower >= 65 
                  ? 'border-emerald-500/30' 
                  : 'border-amber-500/40 bg-amber-500/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">Stage 3: CI Lower Bound</span>
                  <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    s3CiLower >= 65 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/15 text-amber-500 font-extrabold'
                  }`}>
                    {s3CiLower >= 65 ? '✓ PASSED' : '✗ FAILED'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Actual: <strong className="text-foreground">{s3CiLower.toFixed(1)}%</strong></span>
                  <span>Target: <strong className="text-foreground">≥ 65.0%</strong></span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  Statistical confidence interval lower bound for Stage 3 Scientist agreement.
                </p>
              </div>

              {/* Stage 4 Schema Integrity Rule */}
              <div className={`p-3.5 border rounded-xl bg-card space-y-1 ${
                schemaIntegrity === 100 
                  ? 'border-emerald-500/30' 
                  : 'border-red-500/40 bg-red-500/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">Stage 4: Schema Integrity</span>
                  <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    schemaIntegrity === 100 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/15 text-red-500 font-extrabold'
                  }`}>
                    {schemaIntegrity === 100 ? '✓ PASSED' : '✗ FAILED'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Actual: <strong className="text-foreground">{schemaIntegrity.toFixed(1)}%</strong></span>
                  <span>Target: <strong className="text-foreground">100.0%</strong></span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  Requires 100% complete JSON structural compliance across all extracted variables.
                </p>
              </div>

              {/* Stage 4 CI Lower Bound Rule */}
              <div className={`p-3.5 border rounded-xl bg-card space-y-1 ${
                s4CiLower >= 80 
                  ? 'border-emerald-500/30' 
                  : 'border-amber-500/40 bg-amber-500/5'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">Stage 4: CI Lower Bound</span>
                  <span className={`font-mono font-bold text-[11px] px-1.5 py-0.5 rounded ${
                    s4CiLower >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/15 text-amber-500 font-extrabold'
                  }`}>
                    {s4CiLower >= 80 ? '✓ PASSED' : '✗ FAILED'}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Actual: <strong className="text-foreground">{s4CiLower.toFixed(1)}%</strong></span>
                  <span>Target: <strong className="text-foreground">≥ 80.0%</strong></span>
                </div>
                <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                  Statistical confidence interval lower bound for Stage 4 Miner schema integrity.
                </p>
              </div>

            </div>
          </div>

          {/* Paper-Level Failure Table: Stage 3 Critical Misses */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Stage 3 Critical Misses ({criticalMisses.length})
            </h4>

            {criticalMisses.length === 0 ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Zero critical misses recorded in this batch!
              </div>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
                <div className="max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/40 text-[10px] font-extrabold uppercase text-muted-foreground sticky top-0 border-b border-border">
                      <tr>
                        <th className="p-2.5">Paper ID</th>
                        <th className="p-2.5">Criterion</th>
                        <th className="p-2.5 text-center">AI Score</th>
                        <th className="p-2.5 text-center">Gold Score</th>
                        <th className="p-2.5 text-right">Deviation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {criticalMisses.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold text-foreground truncate max-w-[180px]" title={item.paper_id}>
                            {item.paper_id}
                          </td>
                          <td className="p-2.5 font-sans font-bold text-primary">{item.rule_code}</td>
                          <td className="p-2.5 text-center text-muted-foreground">{item.aiScore.toFixed(1)}</td>
                          <td className="p-2.5 text-center font-bold text-foreground">{item.goldScore.toFixed(1)}</td>
                          <td className="p-2.5 text-right font-bold text-red-500">+{item.diff.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Paper-Level Failure Table: Stage 4 Schema Discrepancies */}
          {schemaDiscrepancies.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                Stage 4 Schema Missing Keys ({schemaDiscrepancies.length})
              </h4>
              <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
                <div className="max-h-[160px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/40 text-[10px] font-extrabold uppercase text-muted-foreground sticky top-0 border-b border-border">
                      <tr>
                        <th className="p-2.5">Paper ID</th>
                        <th className="p-2.5">Missing Extraction Key</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {schemaDiscrepancies.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold text-foreground">{item.paper_id}</td>
                          <td className="p-2.5 text-red-500 font-bold">{item.missing_key}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end select-none">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-sm hover:bg-primary/90 transition-all"
          >
            Close Breakdown
          </button>
        </div>

      </div>
    </div>
  );
}
