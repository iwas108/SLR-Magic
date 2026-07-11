import React from 'react';

interface DataExtractionComparisonViewProps {
  selectedDiscrepancy: any;
  extractionRules: any[];
  adjudicateExtractedData: Record<string, { value: string, evidence: string }>;
  setAdjudicateExtractedData: React.Dispatch<React.SetStateAction<Record<string, { value: string, evidence: string }>>>;
}

export default function DataExtractionComparisonView({
  selectedDiscrepancy,
  extractionRules,
  adjudicateExtractedData,
  setAdjudicateExtractedData
}: DataExtractionComparisonViewProps) {
  if (!selectedDiscrepancy || !extractionRules || extractionRules.length === 0) return null;

  return (
    <div className="space-y-6 pr-1">
      {extractionRules.map(rule => {
        const r1_ext = JSON.parse(selectedDiscrepancy.r1_extracted_data || '{}');
        const r2_ext = JSON.parse(selectedDiscrepancy.r2_extracted_data || '{}');
        const key = rule.json_key;

        return (
          <div key={key} className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold bg-secondary px-1.5 py-0.5 rounded text-muted-foreground mr-1.5">{key}</span>
                <span className="text-xs font-bold text-foreground">{rule.question}</span>
              </div>
              <div className="flex gap-1 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setAdjudicateExtractedData(prev => ({
                      ...prev,
                      [key]: { value: r1_ext[key]?.value || '', evidence: r1_ext[key]?.evidence || '' }
                    }));
                  }}
                  className="px-2 py-0.5 bg-secondary hover:bg-secondary/85 border border-border text-[9px] font-bold rounded"
                >
                  Alpha
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjudicateExtractedData(prev => ({
                      ...prev,
                      [key]: { value: r2_ext[key]?.value || '', evidence: r2_ext[key]?.evidence || '' }
                    }));
                  }}
                  className="px-2 py-0.5 bg-secondary hover:bg-secondary/85 border border-border text-[9px] font-bold rounded"
                >
                  Beta
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] bg-secondary/35 p-2 rounded-lg text-muted-foreground">
              <div>
                <span className="font-bold text-blue-500">Alpha: </span>
                <span className="font-bold text-foreground block truncate" title={r1_ext[key]?.value}>{r1_ext[key]?.value || '—'}</span>
                <p className="italic mt-0.5 truncate" title={r1_ext[key]?.evidence}>"{r1_ext[key]?.evidence || 'No evidence'}"</p>
              </div>
              <div>
                <span className="font-bold text-emerald-500">Beta: </span>
                <span className="font-bold text-foreground block truncate" title={r2_ext[key]?.value}>{r2_ext[key]?.value || '—'}</span>
                <p className="italic mt-0.5 truncate" title={r2_ext[key]?.evidence}>"{r2_ext[key]?.evidence || 'No evidence'}"</p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Resolved Value</label>
                <textarea
                  rows={1}
                  value={adjudicateExtractedData[key]?.value || ''}
                  onChange={(e) => {
                    setAdjudicateExtractedData(prev => ({
                      ...prev,
                      [key]: { ...prev[key], value: e.target.value }
                    }));
                  }}
                  placeholder="Resolved extracted string..."
                  className="w-full mt-1 bg-card border border-border text-foreground px-2.5 py-1 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Resolved Evidence</label>
                <textarea
                  rows={2}
                  value={adjudicateExtractedData[key]?.evidence || ''}
                  onChange={(e) => {
                    setAdjudicateExtractedData(prev => ({
                      ...prev,
                      [key]: { ...prev[key], evidence: e.target.value }
                    }));
                  }}
                  placeholder="Source quotation..."
                  className="w-full mt-1 bg-card border border-border text-foreground px-2.5 py-1 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
