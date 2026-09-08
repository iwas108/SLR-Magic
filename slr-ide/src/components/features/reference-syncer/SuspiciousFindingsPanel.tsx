import React from 'react';
import { AlertTriangle, AlertCircle, HelpCircle, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import type { SuspiciousInTextFinding, CitationOccurrence } from '@/lib/services/reference-syncer-types';

interface SuspiciousFindingsPanelProps {
  suspiciousFindings: SuspiciousInTextFinding[];
  suspiciousCitations: CitationOccurrence[];
  fileName: string;
}

export default function SuspiciousFindingsPanel({
  suspiciousFindings,
  suspiciousCitations,
  fileName
}: SuspiciousFindingsPanelProps) {
  const totalIssues = suspiciousFindings.length + suspiciousCitations.length;

  if (totalIssues === 0) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card text-center">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
        <h4 className="text-sm font-semibold text-foreground">No Suspicious Citations Detected</h4>
        <p className="text-xs text-muted-foreground mt-1">
          All citations in <code className="font-mono text-primary">{fileName}</code> adhere cleanly to standard LaTeX syntax and matching guidelines.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unformatted in-text citation findings */}
      {suspiciousFindings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Unformatted In-Text Citations Detected ({suspiciousFindings.length})
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            The following textual references appear in the LaTeX body as plain text rather than proper <code className="font-mono text-foreground">\cite{`{...}`}</code> or <code className="font-mono text-foreground">\citep{`{...}`}</code> macros:
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {suspiciousFindings.map((finding) => (
              <div
                key={finding.id}
                className="p-2.5 rounded-lg bg-background border border-border/80 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-mono font-semibold text-foreground">Line {finding.lineNumber}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary text-muted-foreground">
                    {finding.patternType}
                  </span>
                </div>
                <div className="font-mono text-xs text-foreground bg-secondary/30 p-1.5 rounded border border-border/40">
                  {finding.snippet}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 pt-0.5">
                  <span className="font-medium">Description:</span>
                  <span>{finding.description}</span>
                </div>
                {finding.suggestedFix && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                    <span>Suggested Action: {finding.suggestedFix}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flagged / Missing / Ambiguous Citations */}
      {suspiciousCitations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Flagged Broken or Ambiguous Macro Citations ({suspiciousCitations.length})
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            These citations inside <code className="font-mono">\cite</code> commands require reviewer attention:
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {suspiciousCitations.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-lg bg-secondary/20 border border-border space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <code className="font-mono font-bold text-rose-500">
                    \{c.command}{`{${c.originalKey}}`}
                  </code>
                  <span className="font-mono text-[10px] text-muted-foreground">Line {c.lineNumber}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Reason: <span className="text-foreground">{c.matchReason}</span>
                </p>
                {c.candidates && c.candidates.length > 0 && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400">
                    Candidate keys in .bib: {c.candidates.join(', ')}
                  </div>
                )}
                {c.suspiciousFlags && (
                  <div className="text-[10px] text-muted-foreground italic">
                    Flags: {c.suspiciousFlags.join(' • ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
