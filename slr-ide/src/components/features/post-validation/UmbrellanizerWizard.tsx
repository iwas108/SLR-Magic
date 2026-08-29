'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Loader2, CheckCircle2, AlertTriangle, X, Terminal, ChevronDown, ChevronUp, Copy, Check, Trash2 } from 'lucide-react';
import TokenOccurrenceTable from './TokenOccurrenceTable';
import { UniqueTokenWithContext } from '@/hooks/useUmbrellanizer';

interface UmbrellanizerWizardProps {
  projectId: string;
  extractedKeys: string[];
  getUniqueTokens: (key: string) => UniqueTokenWithContext[];
  runUmbrellanizer: (key: string, templateId: string, targetVariableName: string, rawTokens: string[], richTokens?: UniqueTokenWithContext[]) => Promise<void>;
  dropUmbrellanizerKey?: (key: string) => Promise<boolean>;
  mappingsByKey?: Record<string, Record<string, { umbrella_category: string; justification: string }>>;
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
  dropUmbrellanizerKey,
  mappingsByKey,
  isRunning,
  runError,
  activeJobId,
  step,
  setStep,
  onClose
}: UmbrellanizerWizardProps) {
  const [selectedKey, setSelectedKey] = useState(extractedKeys[0] || '');
  const [isDroppingKey, setIsDroppingKey] = useState(false);
  const [promptsList, setPromptsList] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [projectDefaultPromptId, setProjectDefaultPromptId] = useState<string | null>(null);
  const [targetVariableName, setTargetVariableName] = useState('');
  const [targetVariableDescription, setTargetVariableDescription] = useState('');

  useEffect(() => {
    fetch(`/api/llm/prompts?project_id=${projectId}&include_global=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const loadedPrompts = data.prompts || [];
          setPromptsList(loadedPrompts);
          // Automatically pick default configured template if matches, or fallback to first available umbrellanizer template
          fetch(`/api/projects/${projectId}`)
            .then((res) => res.json())
            .then((pData) => {
              if (pData.success && pData.project?.llm_config) {
                const config = JSON.parse(pData.project.llm_config);
                const defaultPrompt = config.default_prompts?.umbrellanizer;
                if (defaultPrompt) {
                  setProjectDefaultPromptId(defaultPrompt);
                }
                if (defaultPrompt && loadedPrompts.some((p: any) => p.id === defaultPrompt)) {
                  setSelectedPromptId(defaultPrompt);
                } else {
                  const umbTemplate = loadedPrompts.find((p: any) => p.prompt_type === 'umbrellanizer');
                  setSelectedPromptId(umbTemplate ? umbTemplate.id : (loadedPrompts[0]?.id || ''));
                }
              } else {
                const umbTemplate = loadedPrompts.find((p: any) => p.prompt_type === 'umbrellanizer');
                setSelectedPromptId(umbTemplate ? umbTemplate.id : (loadedPrompts[0]?.id || ''));
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

          let desc = '';
          if (data.project.llm_config) {
            try {
              const pCfg = typeof data.project.llm_config === 'string' ? JSON.parse(data.project.llm_config) : data.project.llm_config;
              const rqDescs = pCfg.research_question_descriptions || {};
              const match = selectedKey.match(/^rq\s*\d+[a-z]?/i);
              const codeKey = match ? match[0].toUpperCase().replace(/\s+/g, '') : '';
              desc = rqDescs[codeKey] || rqDescs[selectedKey] || '';
            } catch (e) {}
          }
          setTargetVariableDescription(desc);
        } else {
          setTargetVariableName(selectedKey);
          setTargetVariableDescription('');
        }
      })
      .catch(() => {
        setTargetVariableName(selectedKey);
        setTargetVariableDescription('');
      });
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

  const richTokensMarkdown = useMemo(() => {
    if (!uniqueTokens || uniqueTokens.length === 0) return 'No tokens extracted.';
    return uniqueTokens.map((t) => {
      const paperList = t.papers.map(p => p.id).join(', ');
      let block = `### Extracted Token: "${t.token}" (Occurrences: ${t.count} paper${t.count > 1 ? 's' : ''} [${paperList}])\n`;
      if (t.evidence_quotes && t.evidence_quotes.length > 0) {
        block += `- **Verbatim Evidence Quotes**:\n`;
        t.evidence_quotes.forEach(eq => {
          block += `  * [${eq.paper_id}]: "${eq.quote}"\n`;
        });
      } else {
        block += `- **Verbatim Evidence Quotes**: None extracted.\n`;
      }
      if (t.logic_traces && t.logic_traces.length > 0) {
        block += `- **Extraction Logic Traces**:\n`;
        t.logic_traces.forEach(lt => {
          block += `  * [${lt.paper_id}]: ${lt.trace}\n`;
        });
      } else {
        block += `- **Extraction Logic Traces**: None logged.\n`;
      }
      return block;
    }).join('\n');
  }, [uniqueTokens]);

  const umbrellanizerPrompts = useMemo(() => {
    return promptsList.filter((p) => p.prompt_type === 'umbrellanizer');
  }, [promptsList]);

  const [showFullMarkdown, setShowFullMarkdown] = useState(true);
  const [showLivePromptModal, setShowLivePromptModal] = useState(false);
  const [copiedContext, setCopiedContext] = useState(false);

  const totalEvidenceCount = useMemo(() => {
    return uniqueTokens.reduce((acc, t) => acc + (t.evidence_quotes?.length || 0), 0);
  }, [uniqueTokens]);

  const totalTraceCount = useMemo(() => {
    return uniqueTokens.reduce((acc, t) => acc + (t.logic_traces?.length || 0), 0);
  }, [uniqueTokens]);

  const hydratedUserPrompt = useMemo(() => {
    if (!activePrompt) return '';
    const tmpl = activePrompt.user_prompt_template || '';
    return tmpl
      .replace(/\{\{\s*target_variable\s*\}\}/gi, targetVariableName || selectedKey)
      .replace(/\{\{\s*umbrellanizer_target_research_question\s*\}\}/gi, targetVariableName || selectedKey)
      .replace(/\{\{\s*target_variable_description\s*\}\}/gi, targetVariableDescription || 'None mapped in Project Settings.')
      .replace(/\{\{\s*umbrellanizer_target_research_question_description\s*\}\}/gi, targetVariableDescription || 'None mapped in Project Settings.')
      .replace(/\{\{\s*raw_tokens_with_context\s*\}\}/gi, richTokensMarkdown)
      .replace(/\{\{\s*umbrellanizer_rich_tokens_context\s*\}\}/gi, richTokensMarkdown)
      .replace(/\{\{\s*rich_tokens_context\s*\}\}/gi, richTokensMarkdown)
      .replace(/\{\{\s*raw_tokens\s*\}\}/gi, JSON.stringify(rawTokensList))
      .replace(/\{\{\s*umbrellanizer_raw_tokens_array\s*\}\}/gi, JSON.stringify(rawTokensList));
  }, [activePrompt, targetVariableName, selectedKey, targetVariableDescription, richTokensMarkdown, rawTokensList]);

  const handleCopyMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(richTokensMarkdown);
    setCopiedContext(true);
    setTimeout(() => setCopiedContext(false), 2000);
  };

  const handleStartRun = async () => {
    setStep(3);
    await runUmbrellanizer(selectedKey, selectedPromptId, targetVariableName, rawTokensList, uniqueTokens);
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
                {selectedKey && mappingsByKey && mappingsByKey[selectedKey] && (
                  <div className="flex items-center justify-between p-2.5 bg-primary/10 border border-primary/25 rounded-lg text-xs mt-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      <span className="text-[10px] text-foreground font-semibold">
                        Active taxonomy mapping exists ({Object.keys(mappingsByKey[selectedKey]).length} terms mapped).
                      </span>
                    </div>
                    {dropUmbrellanizerKey && (
                      <button
                        type="button"
                        disabled={isDroppingKey}
                        onClick={async () => {
                          if (!confirm(`Are you sure you want to drop the existing Umbrellanizer taxonomy for "${selectedKey}"?`)) return;
                          setIsDroppingKey(true);
                          try {
                            await dropUmbrellanizerKey(selectedKey);
                          } finally {
                            setIsDroppingKey(false);
                          }
                        }}
                        className="px-2 py-0.5 bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/30 rounded font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
                      >
                        {isDroppingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Drop Mapping
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Umbrellanizer Prompt Template</label>
                  {activePrompt && (
                    <span className="text-[9px] font-mono text-primary font-bold">
                      {activePrompt.id === projectDefaultPromptId ? '⭐ Project Default' : activePrompt.id === 'default-umbrellanizer' ? '🌐 Global Canonical' : 'Custom'}
                    </span>
                  )}
                </div>
                {umbrellanizerPrompts.length > 0 ? (
                  <select
                    value={selectedPromptId}
                    onChange={(e) => setSelectedPromptId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                  >
                    {umbrellanizerPrompts.map((p) => {
                      const isProjDefault = p.id === projectDefaultPromptId;
                      const isGlobalDefault = p.id === 'default-umbrellanizer';
                      const label = `${p.name} ${isProjDefault ? '⭐ [Project Default]' : isGlobalDefault ? '🌐 [Global Default]' : p.project_id ? '[Project Custom]' : '[Global]'}`;
                      return (
                        <option key={p.id} value={p.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
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
                <div className="p-3 bg-secondary/10 border border-border rounded-lg text-[10px] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground block">Prompt Configuration:</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{activePrompt.id}</span>
                  </div>
                  <p className="text-foreground leading-normal font-semibold">{activePrompt.description || 'Cross-study taxonomy harmonization engine.'}</p>
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
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Step 2: Review Deduplicated Token Set</h4>
                  <button
                    type="button"
                    onClick={() => setShowLivePromptModal(true)}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="Preview complete hydrated prompt that will be sent to LLM"
                  >
                    <Terminal className="w-3 h-3" />
                    Preview Full Hydrated Prompt
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Below are the unique raw tokens gathered across all papers under <code>extracted_data.{selectedKey}</code>. Hover or click on tokens to inspect evidence quotes and logic traces.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Deduplicated Token Set ({uniqueTokens.length} tokens, {totalEvidenceCount} quotes, {totalTraceCount} traces)
                  </label>
                </div>
                <TokenOccurrenceTable tokens={uniqueTokens} />
              </div>

              <div className="bg-card border border-border rounded-lg p-3 space-y-2 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-muted-foreground block">Anchor Placeholder Embeds (Jinja2 Context Variables):</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyMarkdown}
                      className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer select-none"
                    >
                      {copiedContext ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      {copiedContext ? 'Copied Outline' : 'Copy Rich Outline'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-foreground font-mono leading-relaxed">
                  <div>
                    <strong className="text-primary font-bold">{"{{ target_variable }}"}</strong> / <strong className="text-muted-foreground">{"{{ umbrellanizer_target_research_question }}"}:</strong>{' '}
                    <span className="text-foreground">{targetVariableName || selectedKey}</span>
                  </div>
                  <div>
                    <strong className="text-primary font-bold">{"{{ target_variable_description }}"}</strong> / <strong className="text-muted-foreground">{"{{ umbrellanizer_target_research_question_description }}"}:</strong>{' '}
                    <span className="text-foreground italic">{targetVariableDescription || 'None mapped in Project Settings.'}</span>
                  </div>
                  <div className="border-t border-border/40 pt-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="text-emerald-500 font-bold">{"{{ raw_tokens_with_context }}"}</strong> / <strong className="text-muted-foreground">{"{{ umbrellanizer_rich_tokens_context }}"}:</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowFullMarkdown(!showFullMarkdown)}
                        className="text-[9px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-0.5 cursor-pointer"
                      >
                        {showFullMarkdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {showFullMarkdown ? 'Collapse' : 'Expand Outline'}
                      </button>
                    </div>
                    {showFullMarkdown ? (
                      <div className="mt-1 p-2 bg-secondary/30 rounded border border-border/50 max-h-48 overflow-y-auto whitespace-pre-wrap text-[9px] text-zinc-300 select-text">
                        {richTokensMarkdown}
                      </div>
                    ) : (
                      <div className="text-muted-foreground/75 text-[9px] truncate">
                        Formatted Markdown Outline ({uniqueTokens.length} tokens, {totalEvidenceCount} evidence quotes, {totalTraceCount} logic traces)
                      </div>
                    )}
                  </div>
                  <div className="border-t border-border/40 pt-1.5 text-muted-foreground">
                    <strong className="text-primary font-bold">{"{{ raw_tokens }}"}</strong> / <strong className="text-muted-foreground">{"{{ umbrellanizer_raw_tokens_array }}"}:</strong>{' '}
                    <span className="truncate block text-[9px] text-muted-foreground/80">{JSON.stringify(rawTokensList)}</span>
                  </div>
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

      {/* Live Hydrated Full Prompt Preview Modal */}
      {showLivePromptModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Live Hydrated LLM Prompt Preview</h3>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Template: {activePrompt?.name} ({activePrompt?.id}) &bull; Variable: {selectedKey}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLivePromptModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold">
                  <span>1. System Persona &amp; Grounding Instruction:</span>
                  <span className="text-primary">{activePrompt?.llm_config ? JSON.parse(activePrompt.llm_config || '{}').model_id || 'gemini-2.5-flash' : 'gemini-2.5-flash'}</span>
                </div>
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto text-[11px]">
                  {activePrompt?.system_prompt || activePrompt?.system_instruction || 'No system instruction.'}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold">
                  <span className="text-emerald-500">2. Fully Hydrated User Prompt (with Enriched Evidence &amp; Traces):</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(hydratedUserPrompt)}
                    className="text-primary hover:underline text-[10px] flex items-center gap-1 cursor-pointer font-bold font-sans"
                  >
                    <Copy className="w-3 h-3" /> Copy Full Prompt
                  </button>
                </div>
                <div className="p-3 bg-zinc-950 border border-emerald-500/30 rounded-lg text-emerald-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto text-[11px] select-text">
                  {hydratedUserPrompt || 'No template rendered.'}
                </div>
              </div>

              {activePrompt?.response_schema && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">3. JSON Structured Output Schema:</span>
                  <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-400 text-[10px] max-h-36 overflow-y-auto leading-relaxed">
                    {typeof activePrompt.response_schema === 'string'
                      ? JSON.stringify(JSON.parse(activePrompt.response_schema), null, 2)
                      : JSON.stringify(activePrompt.response_schema, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end p-3 border-t border-border bg-secondary/10">
              <button
                type="button"
                onClick={() => setShowLivePromptModal(false)}
                className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
