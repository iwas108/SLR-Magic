'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useNdjsonStream } from '@/hooks/useNdjsonStream';

interface VectorBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  loadVectorStatus: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function VectorBuildModal({
  isOpen,
  onClose,
  loadVectorStatus,
  showToast
}: VectorBuildModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<'idle' | 'pdf_cache' | 'paper_corpus' | 'complete' | 'failed'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [counts, setCounts] = useState<{ pdfs: number; papers: number } | null>(null);

  if (!isOpen) return null;

  const logEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const { connect: connectNdjson, cancelStream } = useNdjsonStream({
    onEvent: (parsed) => {
      if (parsed.event === 'log') {
        setLogs(prev => [...prev, `[Build Log]: ${parsed.message}`]);
        // Dynamic phase update based on log messages
        if (parsed.message.includes('Phase 2')) {
          setCurrentPhase('paper_corpus');
        }
      } else if (parsed.event === 'embedding') {
        const current = parsed.current;
        const total = parsed.total;
        const source = parsed.source;

        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        setProgress(pct);

        const sourceLabel = source === 'pdf_cache' ? 'PDF Cache' : 'Paper Corpus';
        setLogs(prev => {
          // Replace last log if it was progress
          const last = prev[prev.length - 1];
          if (last && last.includes('Progress:')) {
            return [...prev.slice(0, -1), `[Progress]: Embedding ${sourceLabel} — ${current}/${total} (${pct}%)`];
          }
          return [...prev, `[Progress]: Embedding ${sourceLabel} — ${current}/${total} (${pct}%)`];
        });
      } else if (parsed.event === 'complete') {
        setCurrentPhase('complete');
        setProgress(100);
        setCounts({ pdfs: parsed.pdf_vectors, papers: parsed.paper_vectors });
        setLogs(prev => [...prev, `[System]: Vector build finished. PDF vectors: ${parsed.pdf_vectors}, Paper vectors: ${parsed.paper_vectors}`]);
        showToast('Vector index built successfully!', 'success');
        loadVectorStatus();
      } else if (parsed.event === 'error') {
        throw new Error(parsed.message);
      }
    },
    onError: (err) => {
      setLogs(prev => [...prev, `[Error]: ${err.message || 'Unknown build failure'}`]);
      setCurrentPhase('failed');
      showToast(err.message || 'Failed to build index', 'error');
      setIsRunning(false);
    },
    onComplete: () => {
      setIsRunning(false);
    }
  });

  const runBuild = async (rebuild: boolean = false) => {
    setIsRunning(true);
    setProgress(0);
    setCounts(null);
    setCurrentPhase('pdf_cache');
    setLogs(['[System]: Spawning vector index builder subprocess...', `[System]: Rebuild parameter set to: ${rebuild}`]);

    try {
      await connectNdjson('/api/vectors/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rebuild })
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setLogs(prev => [...prev, '[System]: Build cancelled by user.']);
        showToast('Index build cancelled.', 'info');
      }
      setIsRunning(false);
    }
  };

  const handleCancel = () => {
    cancelStream();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="w-[500px] max-h-[550px] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-secondary/10">
          <div className="flex items-center gap-2">
            <Loader2 className={`w-4 h-4 text-primary ${isRunning ? 'animate-spin' : ''}`} />
            <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Vector Index Builder</h3>
          </div>
          <button
            disabled={isRunning}
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {currentPhase === 'idle' ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vectorizing your corpus generates dense representations of paper titles, abstracts, and PDF page-1 text using <strong className="text-foreground">nomic-embed-text-v1.5</strong>. This powers offline semantic search and smart matching.
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => runBuild(false)}
                  className="py-3 px-4 bg-primary hover:bg-primary/95 text-primary-foreground font-bold text-xs uppercase rounded-lg tracking-wider transition-colors cursor-pointer text-center"
                >
                  Incremental Build
                </button>
                <button
                  onClick={() => runBuild(true)}
                  className="py-3 px-4 bg-secondary hover:bg-secondary/80 border border-border text-foreground font-bold text-xs uppercase rounded-lg tracking-wider transition-colors cursor-pointer text-center"
                >
                  Force Full Rebuild
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                  <span>
                    {currentPhase === 'pdf_cache' && 'Phase 1: Embedding PDFs'}
                    {currentPhase === 'paper_corpus' && 'Phase 2: Embedding Papers'}
                    {currentPhase === 'complete' && 'Indexing Complete'}
                    {currentPhase === 'failed' && 'Indexing Failed'}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border/50">
                  <div 
                    className={`h-full transition-all duration-300 rounded-full ${
                      currentPhase === 'failed' ? 'bg-destructive' :
                      currentPhase === 'complete' ? 'bg-emerald-500' : 'bg-primary'
                    }`} 
                    style={{ width: `${progress}%` }} 
                  />
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg border border-border/40 text-[10px] font-semibold">
                {currentPhase === 'complete' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-emerald-400">Successfully indexed {counts?.papers} papers and {counts?.pdfs} PDFs.</span>
                  </>
                ) : currentPhase === 'failed' ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <span className="text-destructive">Build failed. See logs below.</span>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    <span>Processing batches... please do not close this window.</span>
                  </>
                )}
              </div>

              {/* Console log output */}
              <div className="h-44 bg-black/95 rounded-lg border border-zinc-800 p-3 overflow-y-auto font-mono text-[9px] text-zinc-300 space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="leading-relaxed whitespace-pre-wrap">{log}</div>
                ))}
                <div ref={logEndRef} />
              </div>

              {/* Action buttons */}
              <div className="flex justify-end">
                {isRunning ? (
                  <button
                    onClick={handleCancel}
                    className="py-1.5 px-4 bg-destructive hover:bg-destructive/80 text-white font-bold text-xs uppercase rounded-lg tracking-wider transition-colors shadow"
                  >
                    Cancel Build
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentPhase('idle')}
                    className="py-1.5 px-4 bg-secondary hover:bg-secondary/80 border border-border text-foreground font-bold text-xs uppercase rounded-lg tracking-wider transition-colors shadow"
                  >
                    Back
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
