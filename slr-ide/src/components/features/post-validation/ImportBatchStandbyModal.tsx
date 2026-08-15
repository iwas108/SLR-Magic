import React, { useState } from 'react';
import { Upload, AlertTriangle, CheckCircle, FileText, X, Layers, ArrowRight, RefreshCw } from 'lucide-react';
import { decompressSlrBrowser } from '@/lib/slr-compression';

interface ImportBatchStandbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  projectId: string;
}

interface ReconciledPaper {
  paper_id: string;
  title: string;
  inDb: boolean;
  inR1: boolean;
  inR2: boolean;
  r1Name?: string;
  r2Name?: string;
}

export function ImportBatchStandbyModal({
  isOpen,
  onClose,
  onSuccess,
  showToast,
  projectId
}: ImportBatchStandbyModalProps) {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [parsedData1, setParsedData1] = useState<any | null>(null);
  const [parsedData2, setParsedData2] = useState<any | null>(null);
  const [validating, setValidating] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [reconciledPapers, setReconciledPapers] = useState<ReconciledPaper[]>([]);
  const [dbPaperIds, setDbPaperIds] = useState<Set<string>>(new Set());

  const handleFileChange = async (slot: 1 | 2, file: File | null) => {
    if (!file) {
      if (slot === 1) {
        setFile1(null);
        setParsedData1(null);
      } else {
        setFile2(null);
        setParsedData2(null);
      }
      setReconciledPapers([]);
      return;
    }

    try {
      const json = await decompressSlrBrowser(file);
      if (!json.metadata || !Array.isArray(json.papers)) {
        showToast(`Invalid .slr file format in ${file.name}`, 'error');
        return;
      }
      if (slot === 1) {
        setFile1(file);
        setParsedData1(json);
      } else {
        setFile2(file);
        setParsedData2(json);
      }
    } catch (err: any) {
      showToast(`Error reading file ${file.name}: ${err.message}`, 'error');
    }
  };

  // Run validation whenever both files are loaded or updated
  React.useEffect(() => {
    if (!parsedData1 && !parsedData2) {
      setReconciledPapers([]);
      return;
    }

    const runValidation = async () => {
      setValidating(true);
      try {
        // Fetch ALL paper IDs in project using onlyIds=true query
        let knownDbIds = new Set<string>();
        const papersRes = await fetch(`/api/papers?onlyIds=true`);
        if (papersRes.ok) {
          const idsArray = await papersRes.json();
          if (Array.isArray(idsArray)) {
            knownDbIds = new Set(idsArray);
          }
        }
        setDbPaperIds(knownDbIds);

        const papersMap = new Map<string, ReconciledPaper>();

        if (parsedData1?.papers) {
          const r1Name = parsedData1.metadata?.reviewer_name || 'Reviewer Alpha';
          for (const p of parsedData1.papers) {
            if (!p.Paper_ID) continue;
            papersMap.set(p.Paper_ID, {
              paper_id: p.Paper_ID,
              title: p.Title || p.Paper_ID,
              inDb: knownDbIds.size === 0 || knownDbIds.has(p.Paper_ID),
              inR1: true,
              inR2: false,
              r1Name
            });
          }
        }

        if (parsedData2?.papers) {
          const r2Name = parsedData2.metadata?.reviewer_name || 'Reviewer Beta';
          for (const p of parsedData2.papers) {
            if (!p.Paper_ID) continue;
            const existing = papersMap.get(p.Paper_ID);
            if (existing) {
              existing.inR2 = true;
              existing.r2Name = r2Name;
            } else {
              papersMap.set(p.Paper_ID, {
                paper_id: p.Paper_ID,
                title: p.Title || p.Paper_ID,
                inDb: knownDbIds.size === 0 || knownDbIds.has(p.Paper_ID),
                inR1: false,
                inR2: true,
                r2Name
              });
            }
          }
        }

        setReconciledPapers(Array.from(papersMap.values()));
      } catch (err: any) {
        console.error('Validation error:', err);
      } finally {
        setValidating(false);
      }
    };

    runValidation();
  }, [parsedData1, parsedData2, projectId]);

  const hasMissingDbPapers = reconciledPapers.some(p => !p.inDb);
  const hasReviewerMismatch = reconciledPapers.some(p => !p.inR1 || !p.inR2);
  const canSubmit = parsedData1 && parsedData2 && !submitting && !validating;

  const handleConfirmImport = async () => {
    if (!parsedData1 || !parsedData2) {
      showToast('Please select both Reviewer 1 and Reviewer 2 .slr files.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Ensure reviewer names are distinct to prevent database decision overwrite
      let json1 = { ...parsedData1 };
      let json2 = { ...parsedData2 };

      const name1 = (json1.metadata?.reviewer_name || json1.metadata?.reviewerName || 'Reviewer Alpha').trim();
      const name2 = (json2.metadata?.reviewer_name || json2.metadata?.reviewerName || 'Reviewer Beta').trim();

      if (name1.toLowerCase() === name2.toLowerCase()) {
        json1.metadata = { ...json1.metadata, reviewer_name: `${name1} (File 1)` };
        json2.metadata = { ...json2.metadata, reviewer_name: `${name2} (File 2)` };
      }

      // 1. Import File 1 (Creates rolling batch if none active)
      const res1 = await fetch(`/api/rolling-batch/import?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json1)
      });

      if (!res1.ok) {
        const data1 = await res1.json();
        throw new Error(`Reviewer 1 Import Failed: ${data1.error || 'Unknown error'}`);
      }

      // 2. Import File 2 into the newly created active batch
      const res2 = await fetch(`/api/rolling-batch/import?projectId=${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json2)
      });

      if (!res2.ok) {
        const data2 = await res2.json();
        throw new Error(`Reviewer 2 Import Failed: ${data2.error || 'Unknown error'}`);
      }

      showToast('Successfully initialized batch and imported reviewer files!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to initialize batch from files', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/20 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-xl text-primary">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">Import Batch from Reviewer Files</h3>
              <p className="text-xs text-muted-foreground">Upload Reviewer 1 & 2 .slr files to initialize rolling batch with strict paper checking</p>
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
          
          {/* Dual File Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Reviewer 1 File Slot */}
            <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  Reviewer 1 (.slr file)
                </span>
                {parsedData1 && (
                  <span className="text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded border border-blue-500/20">
                    {parsedData1.papers?.length || 0} papers
                  </span>
                )}
              </div>

              <label className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-card transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                  {file1 ? file1.name : 'Select Reviewer 1 File...'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">.slr formatted JSON</span>
                <input
                  type="file"
                  accept=".slr,.json"
                  onChange={(e) => handleFileChange(1, e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {parsedData1 && (
                <div className="text-[11px] text-muted-foreground bg-card p-2 rounded-lg border border-border/50">
                  <div><strong className="text-foreground">Reviewer:</strong> {parsedData1.metadata?.reviewer_name || 'Reviewer Alpha'}</div>
                  <div><strong className="text-foreground">Batch Number:</strong> #{parsedData1.metadata?.batch_number || 1}</div>
                </div>
              )}
            </div>

            {/* Reviewer 2 File Slot */}
            <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  Reviewer 2 (.slr file)
                </span>
                {parsedData2 && (
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                    {parsedData2.papers?.length || 0} papers
                  </span>
                )}
              </div>

              <label className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-card transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs font-semibold text-foreground truncate max-w-[200px]">
                  {file2 ? file2.name : 'Select Reviewer 2 File...'}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">.slr formatted JSON</span>
                <input
                  type="file"
                  accept=".slr,.json"
                  onChange={(e) => handleFileChange(2, e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {parsedData2 && (
                <div className="text-[11px] text-muted-foreground bg-card p-2 rounded-lg border border-border/50">
                  <div><strong className="text-foreground">Reviewer:</strong> {parsedData2.metadata?.reviewer_name || 'Reviewer Beta'}</div>
                  <div><strong className="text-foreground">Batch Number:</strong> #{parsedData2.metadata?.batch_number || 1}</div>
                </div>
              )}
            </div>

          </div>

          {/* Validation Warnings Summary Banner */}
          {(hasMissingDbPapers || hasReviewerMismatch) && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block">Strict Validation Summary:</strong>
                {hasMissingDbPapers && (
                  <span className="block">• Some paper IDs do not exist in the main project database and will be flagged.</span>
                )}
                {hasReviewerMismatch && (
                  <span className="block">• Paper ID count or list mismatch detected between Reviewer 1 and Reviewer 2 files.</span>
                )}
              </div>
            </div>
          )}

          {/* Reconciliation Table */}
          {reconciledPapers.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Paper Reconciliation Preview ({reconciledPapers.length} Total Papers)
                </h4>
                {validating && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Validating DB IDs...
                  </span>
                )}
              </div>

              <div className="border border-border rounded-xl overflow-hidden bg-card text-xs">
                <div className="max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/40 text-[10px] font-extrabold uppercase text-muted-foreground sticky top-0 border-b border-border">
                      <tr>
                        <th className="p-2.5">Paper ID</th>
                        <th className="p-2.5">Title</th>
                        <th className="p-2.5 text-center">Project DB</th>
                        <th className="p-2.5 text-center">Reviewer 1</th>
                        <th className="p-2.5 text-center">Reviewer 2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {reconciledPapers.map((paper) => (
                        <tr key={paper.paper_id} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-bold text-foreground">{paper.paper_id}</td>
                          <td className="p-2.5 font-sans font-medium text-foreground truncate max-w-[220px]" title={paper.title}>
                            {paper.title}
                          </td>
                          <td className="p-2.5 text-center">
                            {paper.inDb ? (
                              <span className="inline-flex items-center gap-1 text-emerald-500 font-bold text-[10px]">
                                <CheckCircle className="w-3.5 h-3.5" /> Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-500 font-bold text-[10px]">
                                <AlertTriangle className="w-3.5 h-3.5" /> Missing
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {paper.inR1 ? (
                              <span className="text-emerald-500 font-bold">✓ Included</span>
                            ) : (
                              <span className="text-amber-500 font-bold">⚠️ Missing</span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {paper.inR2 ? (
                              <span className="text-emerald-500 font-bold">✓ Included</span>
                            ) : (
                              <span className="text-amber-500 font-bold">⚠️ Missing</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-between items-center select-none">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={!canSubmit}
            className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Confirm & Create Batch
          </button>
        </div>

      </div>
    </div>
  );
}
