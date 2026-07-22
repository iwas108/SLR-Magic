'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, CheckCircle2, AlertTriangle, X, Terminal } from 'lucide-react';
import TokenOccurrenceTable from './TokenOccurrenceTable';

interface UmbrellanizerWizardProps {
  projectId: string;
  extractedKeys: string[];
  getUniqueTokens: (key: string) => { token: string; count: number; papers: { id: string; title: string }[] }[];
  runUmbrellanizer: (key: string, templateId: string, targetVariableName: string, rawTokens: string[]) => Promise<void>;
  isRunning: boolean;
  runError: string | null;
  activeJobId: string | null;
  step: number;
  setStep: (step: number) => void;
  onClose: () => void;
}

export default function UmbrellanizerWizard({
  projectId,
  extractedKeys,
  getUniqueTokens,
  runUmbrellanizer,
  isRunning,
  runError,
  activeJobId,
  step,
  setStep,
  onClose
}: UmbrellanizerWizardProps) {
  const [selectedKey, setSelectedKey] = useState(extractedKeys[0] || '');
  const [promptsList, setPromptsList] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [targetVariableName, setTargetVariableName] = useState('');

  // Fetch prompts list inside the project scope
  useEffect(() => {
    fetch(`/api/llm/prompts?project_id=${projectId}&include_global=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPromptsList(data.prompts || []);
          // Automatically pick default configure template if matches
          fetch(`/api/projects/${projectId}`)
            .then((res) => res.json())
            .then((pData) => {
              if (pData.success && pData.project?.llm_config) {
                const config = JSON.parse(pData.project.llm_config);
                const defaultPrompt = config.default_prompts?.umbrellanizer;
                if (defaultPrompt) {
                  setSelectedPromptId(defaultPrompt);
                } else {
                  setSelectedPromptId('');
                }
              }
            });
        }
      })
      .catch((err) => console.error('Failed to load prompts:', err));
  }, [projectId]);

  // Helper function to dynamically map research question
  const getMappedResearchQuestion = (questionsStr: string, key: string) => {
    if (!questionsStr) return '';
    const lines = questionsStr.split('\n').map(l => l.trim()).filter(Boolean);
    const match = key.match(/^rq(\d+)(?:_?([a-z]))?/i);
    if (!match) return '';
    const num = match[1] + (match[2] || '');
    const targetPrefix = `rq${num}`;
    const targetPrefix2 = `rq ${num}`;
    
    const found = lines.find(line => {
      const cleanLine = line.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      return cleanLine.startsWith(targetPrefix) || cleanLine.startsWith(targetPrefix2);
    });
    return found ? ` (${found})` : '';
  };

  // Set targetVariableName dynamically based on selected key's project metadata configuration (Rule Q7)
  useEffect(() => {
    if (!selectedKey) return;
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.project) {
          const rqSuffix = getMappedResearchQuestion(data.project.questions || '', selectedKey);
          setTargetVariableName(`${selectedKey}${rqSuffix}`);
        } else {
          setTargetVariableName(selectedKey);
        }
      })
      .catch(() => setTargetVariableName(selectedKey));
  }, [selectedKey, projectId]);

  const uniqueTokens = getUniqueTokens(selectedKey);
  const rawTokensList = uniqueTokens.map((t) => t.token);
  const activePrompt = promptsList.find((p) => p.id === selectedPromptId);

  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Subscribe to live SSE logs when running
  useEffect(() => {
    if (step !== 3 || !isRunning || !activeJobId) {
      return;
    }

    setLogs([]); // Clear logs
    const eventSource = new EventSource(`/api/llm/screen/logs?jobId=${activeJobId}`);

    eventSource.onmessage = (event) => {
      if (event.data) {
        try {
          const parsed = JSON.parse(event.data);
          const msg = parsed.message || JSON.stringify(parsed);
          setLogs((prev) => [...prev, msg]);
        } catch {
          setLogs((prev) => [...prev, event.data]);
        }
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE EventSource error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, [step, isRunning, activeJobId]);

  const handleStartRun = async () => {
    setStep(3);
    await runUmbrellanizer(selectedKey, selectedPromptId, targetVariableName, rawTokensList);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-xl rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/15">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Token Umbrellanizer Pipeline</h3>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Stepper header */}
        <div className="flex justify-between items-center bg-secondary/5 px-6 py-3 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">
          <span className={step >= 1 ? 'text-primary font-black' : ''}>1. Prompt &amp; Variable</span>
          <span>&gt;</span>
          <span className={step >= 2 ? 'text-primary font-black' : ''}>2. Deduplicated List</span>
          <span>&gt;</span>
          <span className={step >= 3 ? 'text-primary font-black' : ''}>3. Processing LLM</span>
          <span>&gt;</span>
          <span className={step >= 4 ? 'text-primary font-black' : ''}>4. Complete</span>
        </div>

        <div className="p-6 flex-1 overflow-y-auto min-h-0 space-y-4">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Step 1: Setup Variable &amp; Select Prompt</h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Select which extracted data key from the Scientist/Miner output mapping needs to undergo taxonomy categorization.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Target Extraction Variable Key</label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                >
                  <option value="">-- Choose Key --</option>
                  {extractedKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Umbrellanizer Prompt</label>
                {activePrompt ? (
                  <div className="px-3 py-2 bg-secondary/35 border border-border rounded-lg text-xs font-semibold text-foreground">
                    {activePrompt.name} <span className="text-[10px] text-muted-foreground font-mono">({activePrompt.id})</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 p-3.5 bg-destructive/10 border border-destructive/25 text-destructive rounded-lg text-xs leading-normal">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <div>
                        <strong className="font-bold block">No Default Prompt Template Assigned</strong>
                        <span>Please configure the default template for the <strong>Umbrellanizer</strong> task in Project Settings first.</span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-secondary/15 border border-border/50 rounded-lg text-[10px] leading-relaxed text-muted-foreground">
                      <strong className="font-bold block text-foreground uppercase tracking-wider mb-1">How to setup:</strong>
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Close this wizard and open the <strong>Project Settings Modal</strong> (gear icon next to active project).</li>
                        <li>Navigate to the <strong>Prompts</strong> tab.</li>
                        <li>Click <strong>LLM Prompt Library</strong>, choose/edit or create a new template under the <strong>"Umbrellanizer"</strong> stage type, and select it as default.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              {activePrompt && (
                <div className="p-3 bg-secondary/10 border border-border rounded-lg text-[10px] space-y-1">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground block">Prompt Description:</span>
                  <p className="text-foreground leading-normal font-semibold">{activePrompt.description || 'No description provided.'}</p>
                </div>
              )}

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  disabled={!selectedKey || !selectedPromptId}
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground font-semibold rounded-lg text-xs transition-colors"
                >
                  Next: Deduplicate Tokens
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 space-y-1.5">
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Step 2: Review Deduplicated Token Set</h4>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Below are the unique raw tokens gathered across all papers under <code>extracted_data.{selectedKey}</code>. Hover on each token to review paper matching scopes.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Deduplicated Token Set Occurrence Counts</label>
                <TokenOccurrenceTable tokens={uniqueTokens} />
              </div>

              <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-[10px]">
                <span className="font-bold uppercase tracking-wider text-muted-foreground block">Anchor Placeholder Embeds:</span>
                <div className="space-y-1 text-foreground font-mono leading-relaxed">
                  <div><strong>Variable Name:</strong> <span className="text-primary font-bold">{targetVariableName}</span></div>
                  <div><strong>Unique Tokens List:</strong> <span className="text-primary font-bold">{JSON.stringify(rawTokensList)}</span></div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStartRun}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors"
                >
                  Proceed: Run Umbrellanizer LLM
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center w-full">
              {isRunning ? (
                <>
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <div className="w-full px-4">
                    <h4 className="font-bold text-sm text-foreground">Executing Umbrellanizer</h4>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 leading-relaxed">
                      Gemini is generating the semantic umbrella taxonomy mapping. Do not close this workspace.
                    </p>
                    
                    {/* Live Execution Console */}
                    <div className="w-full text-left bg-zinc-950 text-zinc-300 p-3.5 rounded-xl border border-zinc-800 font-mono text-[10px] h-48 overflow-y-auto mt-5 space-y-1 shadow-inner select-text">
                      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest select-none">
                        <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Live Execution Console</span>
                      </div>
                      {logs.length === 0 ? (
                        <span className="italic text-zinc-600 block">Waiting for telemetry connection...</span>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="leading-relaxed whitespace-pre-wrap text-zinc-400">
                            {log}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                </>
              ) : runError ? (
                <>
                  <AlertTriangle className="w-10 h-10 text-destructive animate-bounce" />
                  <div className="w-full px-4">
                    <h4 className="font-bold text-sm text-destructive">Umbrellanizer Execution Failed</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 leading-normal font-mono bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 max-h-24 overflow-y-auto mb-4">
                      {runError}
                    </p>

                    {/* Console log history on failure */}
                    <div className="w-full text-left bg-zinc-950 text-zinc-300 p-3.5 rounded-xl border border-zinc-800 font-mono text-[10px] h-40 overflow-y-auto space-y-1 shadow-inner select-text">
                      <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 mb-2 text-[8px] font-bold text-zinc-500 uppercase tracking-widest select-none">
                        <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Execution Console Log History</span>
                      </div>
                      {logs.length === 0 ? (
                        <span className="italic text-zinc-600 block">No console logs captured.</span>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="leading-relaxed whitespace-pre-wrap text-zinc-500">
                            {log}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-semibold rounded-lg text-xs"
                    >
                      Back to Setup
                    </button>
                    <button
                      type="button"
                      onClick={handleStartRun}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs"
                    >
                      Retry Run
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-pulse" />
              <div>
                <h4 className="font-bold text-sm text-foreground">Taxonomy Normalization Complete!</h4>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                  Gemini has mapped all raw values to umbrella categories. The triple column groups in the table are now fully updated.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs transition-colors"
              >
                Close Wizard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
