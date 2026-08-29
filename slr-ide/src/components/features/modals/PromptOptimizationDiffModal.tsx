'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, FileText, CheckCircle2, AlertTriangle, ArrowRight, 
  GitCompare, Save, Copy, Check, ChevronDown, ChevronRight, Layers, FileCheck
} from 'lucide-react';
import { OptimizationState, RequestedPdfItem } from '@/hooks/usePromptStaging';

interface PromptOptimizationDiffModalProps {
  optimizationState: OptimizationState;
  onClose: () => void;
  onContinueWithPdf: (approvedIds: string[]) => void;
  onApplyPrompt: (
    proposedSystemInstruction: string,
    proposedUserTemplate: string,
    actionMode: 'apply_active' | 'fork_new',
    setAsDefault: boolean,
    customName?: string,
    proposedResponseSchema?: any
  ) => void;
}

export default function PromptOptimizationDiffModal({
  optimizationState,
  onClose,
  onContinueWithPdf,
  onApplyPrompt
}: PromptOptimizationDiffModalProps) {
  const {
    isOpen,
    stageNum,
    stageName,
    currentPrompt,
    hasPdfRequests,
    requestedPdfs,
    optimizationResult,
    isLoading,
    isSaving
  } = optimizationState;

  const [activeTab, setActiveTab] = useState<'system' | 'user' | 'schema'>('system');
  const [selectedPdfIds, setSelectedPdfIds] = useState<string[]>([]);
  const [editedSystemPrompt, setEditedSystemPrompt] = useState('');
  const [editedUserTemplate, setEditedUserTemplate] = useState('');
  const [editedResponseSchema, setEditedResponseSchema] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [forkName, setForkName] = useState('');
  const [showForkInput, setShowForkInput] = useState(false);

  // Sync state when optimization result arrives
  useEffect(() => {
    if (requestedPdfs.length > 0) {
      setSelectedPdfIds(requestedPdfs.map(p => p.paper_id));
    }
  }, [requestedPdfs]);

  useEffect(() => {
    if (optimizationResult) {
      setEditedSystemPrompt(optimizationResult.proposed_system_instruction || currentPrompt?.system_instruction || '');
      setEditedUserTemplate(optimizationResult.proposed_user_template || currentPrompt?.user_template || '');
      const baseSchema = currentPrompt?.response_schema || {};
      const initialSchema = optimizationResult.proposed_response_schema || baseSchema;
      setEditedResponseSchema(typeof initialSchema === 'string' ? initialSchema : JSON.stringify(initialSchema, null, 2));
      setForkName(`${stageName} (Optimized v${Date.now().toString().slice(-4)})`);
    }
  }, [optimizationResult, currentPrompt, stageName]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const diagnosis = optimizationResult?.failure_diagnosis;
  const keyMods = optimizationResult?.key_modifications || [];

  const handleTogglePdf = (id: string) => {
    setSelectedPdfIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden font-sans">
        
        {/* Subtle Top Accent */}
        <div className="h-1 bg-primary" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Prompt Optimization
                </span>
                <span className="text-xs text-muted-foreground font-mono">Stage {stageNum} • {stageName}</span>
              </div>
              <h2 className="text-base font-bold text-foreground mt-0.5">
                Calibration Discrepancy Diagnosis & Prompt Revisions
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
              <p className="text-sm font-mono text-purple-700 dark:text-purple-300">
                {hasPdfRequests 
                  ? 'Analyzing attached full-text PDF methodologies and refining prompt diffs...'
                  : 'Analyzing calibration discrepancy patterns and error root-causes...'}
              </p>
              <p className="text-xs text-muted-foreground font-mono">Zero-temperature adversarial prompt synthesis</p>
            </div>
          )}

          {/* STEP 1: HITL PDF Request Approval Drawer */}
          {!isLoading && hasPdfRequests && requestedPdfs.length > 0 && (
            <div className="p-5 rounded-xl border border-amber-400 dark:border-amber-500/40 bg-gradient-to-br from-amber-50/90 via-card to-card dark:from-amber-950/30 dark:via-slate-900/80 dark:to-slate-950 space-y-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    Human-in-the-Loop Review: Full-Text PDF Retrieval Requested
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                    The prompt optimizer identified subtle empirical claims in {requestedPdfs.length} failing paper(s) that require full-text inspection to resolve prompt ambiguities.
                  </p>
                </div>
              </div>

              {/* Requested Papers List */}
              <div className="space-y-2.5">
                {requestedPdfs.map(pdfItem => {
                  const isChecked = selectedPdfIds.includes(pdfItem.paper_id);
                  return (
                    <div
                      key={pdfItem.paper_id}
                      onClick={() => handleTogglePdf(pdfItem.paper_id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isChecked 
                          ? 'bg-amber-100/80 dark:bg-amber-950/40 border-amber-400 dark:border-amber-500/50 shadow-sm' 
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-70'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-foreground">{pdfItem.paper_id}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                              pdfItem.on_disk ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/40' : 'bg-secondary text-muted-foreground border-border'
                            }`}>
                              {pdfItem.on_disk ? 'PDF Available on Disk' : 'Metadata Fallback'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 dark:text-slate-300 font-medium mt-0.5 line-clamp-1 font-sans">
                            {pdfItem.paper_title}
                          </div>
                          <div className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-1 font-sans">
                            <span className="font-semibold">Reason: </span>
                            {pdfItem.technical_rationale}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-[10px] font-mono text-muted-foreground shrink-0">
                        {pdfItem.estimated_token_cost}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons for PDF Approval */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-amber-500/20">
                <button
                  onClick={() => onContinueWithPdf([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Skip & Proceed with Abstract Only
                </button>
                <button
                  onClick={() => onContinueWithPdf(requestedPdfs.map(p => p.paper_id))}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-600/90 hover:bg-amber-600 text-white shadow-md transition-all"
                >
                  Approve All ({requestedPdfs.length} PDFs)
                </button>
                <button
                  onClick={() => onContinueWithPdf(selectedPdfIds)}
                  disabled={selectedPdfIds.length === 0}
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg transition-all disabled:opacity-50"
                >
                  Approve & Attach Selected ({selectedPdfIds.length})
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Diagnosis & Diff Inspection */}
          {!isLoading && optimizationResult && (
            <>
              {/* Failure Diagnosis Card */}
              {diagnosis && (
                <div className="p-4 rounded-xl border border-purple-300 dark:border-purple-500/30 bg-purple-50/90 dark:bg-purple-950/20 space-y-2.5 shadow-sm">
                  <div className="text-xs font-mono font-semibold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                    Diagnostic Analysis & Root Cause Breakdown:
                  </div>
                  {diagnosis.root_causes && (
                    <ul className="space-y-1 pl-4 list-disc text-xs text-slate-800 dark:text-slate-300 font-mono">
                      {diagnosis.root_causes.map((rc: string, i: number) => (
                        <li key={i}>{rc}</li>
                      ))}
                    </ul>
                  )}
                  {diagnosis.false_negative_analysis && (
                    <div className="text-xs text-slate-800 dark:text-slate-300 pt-1 border-t border-purple-200 dark:border-purple-500/20 font-sans">
                      <span className="font-semibold text-pink-700 dark:text-pink-300">False Negatives: </span>
                      {diagnosis.false_negative_analysis}
                    </div>
                  )}
                  {diagnosis.diff_explanation && (
                    <div className="text-xs text-slate-800 dark:text-slate-300 font-sans">
                      <span className="font-semibold text-cyan-700 dark:text-cyan-300">Strategy: </span>
                      {diagnosis.diff_explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Side-by-Side Diff Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('system')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                        activeTab === 'system'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      System Instruction Diff
                    </button>
                    <button
                      onClick={() => setActiveTab('user')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                        activeTab === 'user'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      User Template Diff
                    </button>
                    <button
                      onClick={() => setActiveTab('schema')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                        activeTab === 'schema'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      Response Schema (Descriptions)
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-muted-foreground">
                    {activeTab === 'schema' ? 'Refined property descriptions (Keys & structure locked)' : 'Editable right panel for fine-tuning'}
                  </span>
                </div>

                {/* Side-by-Side Editor Panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Panel: Current Active Prompt / Schema */}
                  <div className="flex flex-col rounded-xl border border-border bg-slate-50 dark:bg-slate-950/60 overflow-hidden shadow-sm">
                    <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900/80 border-b border-border flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground font-semibold">
                        {activeTab === 'schema' ? 'Current Response Schema (Base)' : 'Current Active Prompt (Base)'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-secondary-foreground">
                        {currentPrompt?.id || 'Active'}
                      </span>
                    </div>
                    <textarea
                      readOnly
                      value={
                        activeTab === 'system'
                          ? (currentPrompt?.system_instruction || '')
                          : activeTab === 'user'
                          ? (currentPrompt?.user_template || '')
                          : (typeof currentPrompt?.response_schema === 'string'
                              ? currentPrompt.response_schema
                              : JSON.stringify(currentPrompt?.response_schema || {}, null, 2))
                      }
                      rows={14}
                      className="w-full flex-1 p-3 bg-transparent text-xs font-mono text-slate-700 dark:text-slate-300 resize-none focus:outline-none opacity-80"
                    />
                  </div>

                  {/* Right Panel: Proposed Optimized Prompt / Schema */}
                  <div className="flex flex-col rounded-xl border border-purple-400 dark:border-purple-500/40 bg-purple-50/50 dark:bg-purple-950/10 shadow-sm overflow-hidden">
                    <div className="px-3.5 py-2 bg-purple-100/90 dark:bg-purple-950/60 border-b border-purple-300 dark:border-purple-500/30 flex items-center justify-between">
                      <span className="text-xs font-mono text-purple-800 dark:text-purple-300 font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-500 dark:text-pink-300" />
                        <span>
                          {activeTab === 'schema' ? 'Proposed Response Schema (Enhanced Descriptions)' : 'Proposed Optimized Prompt (Revisions)'}
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            const text = activeTab === 'system' 
                              ? editedSystemPrompt 
                              : activeTab === 'user' 
                              ? editedUserTemplate 
                              : editedResponseSchema;
                            if (!text) return;
                            try {
                              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                                await navigator.clipboard.writeText(text);
                              } else {
                                const ta = document.createElement('textarea');
                                ta.value = text;
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                              }
                            } catch (e) {
                              console.warn('Clipboard write failed:', e);
                            }
                          }}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-200 dark:bg-purple-900/60 hover:bg-purple-300 dark:hover:bg-purple-800 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-500/30 transition-colors"
                        >
                          Copy
                        </button>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-500/30">
                          Optimized
                        </span>
                      </div>
                    </div>
                    <textarea
                      value={activeTab === 'system' ? editedSystemPrompt : activeTab === 'user' ? editedUserTemplate : editedResponseSchema}
                      onChange={(e) => {
                        if (activeTab === 'system') setEditedSystemPrompt(e.target.value);
                        else if (activeTab === 'user') setEditedUserTemplate(e.target.value);
                        else setEditedResponseSchema(e.target.value);
                      }}
                      rows={14}
                      className="w-full flex-1 p-3 bg-transparent text-xs font-mono text-foreground resize-none focus:outline-none border-0"
                    />
                  </div>
                </div>
              </div>

              {/* Fork Custom Name Input */}
              {showForkInput && (
                <div className="p-3 rounded-lg bg-card border border-border space-y-1.5 shadow-sm">
                  <label className="text-xs font-mono text-foreground">Forked Prompt Name in Library:</label>
                  <input
                    type="text"
                    value={forkName}
                    onChange={(e) => setForkName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-background border border-input text-xs font-mono text-foreground focus:outline-none focus:border-purple-500"
                    placeholder="Enter prompt name..."
                  />
                </div>
              )}

              {/* Set as Default Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="setDefaultCheckbox"
                  checked={setAsDefault}
                  onChange={(e) => setSetAsDefault(e.target.checked)}
                  className="rounded border-input text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="setDefaultCheckbox" className="text-xs font-mono text-foreground cursor-pointer">
                  Set as active default prompt for <span className="text-purple-700 dark:text-purple-300 font-semibold">{stageName}</span> in Project Settings
                </label>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card dark:bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancel
          </button>

          {!isLoading && optimizationResult && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (!showForkInput) {
                    setShowForkInput(true);
                  } else {
                    onApplyPrompt(editedSystemPrompt, editedUserTemplate, 'fork_new', setAsDefault, forkName, editedResponseSchema);
                  }
                }}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-semibold bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-all active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" />
                <span>{showForkInput ? 'Confirm Fork as New Prompt' : 'Fork as New Prompt'}</span>
              </button>

              <button
                onClick={() => onApplyPrompt(editedSystemPrompt, editedUserTemplate, 'apply_active', setAsDefault, undefined, editedResponseSchema)}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-mono font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-900/20 border border-purple-400/30 transition-all active:scale-98"
              >
                <Save className="w-3.5 h-3.5 text-purple-200" />
                <span>{isSaving ? 'Applying Changes...' : 'Apply to Active Template'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
