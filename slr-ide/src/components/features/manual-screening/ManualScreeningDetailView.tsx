import React, { useState, useEffect } from 'react';
import { 
  Check, X, FileText, ArrowRightLeft, ShieldAlert, 
  HelpCircle, CheckCircle2, ChevronRight, AlertCircle, Trash
} from 'lucide-react';
import { Paper, Project } from '@/types';

interface ManualScreeningDetailViewProps {
  projects: Project[];
  activeProjectId: string;
  selectedPaper: Paper;
  onClose: () => void;
  // Edit Form Fields passed from parent
  manualDecision: string;
  setManualDecision: (v: string) => void;
  manualEcTrigger: string;
  setManualEcTrigger: (v: string) => void;
  manualRationale: string;
  setManualRationale: (v: string) => void;
  manualStage: string;
  setManualStage: (v: string) => void;
  manualQaScores: Record<string, { value: number | null; evidence: string }>;
  setManualQaScores: React.Dispatch<React.SetStateAction<Record<string, { value: number | null; evidence: string }>>>;
  manualExtractedData: Record<string, { value: string; evidence: string }>;
  setManualExtractedData: React.Dispatch<React.SetStateAction<Record<string, { value: string; evidence: string }>>>;
  
  screeningSaving: boolean;
  screeningError: string | null;
  onSave: (paperId: string) => void;
  onClear: (paperId: string) => void;
  onImport: (paper: Paper) => void;
}

export default function ManualScreeningDetailView({
  projects,
  activeProjectId,
  selectedPaper,
  onClose,
  manualDecision,
  setManualDecision,
  manualEcTrigger,
  setManualEcTrigger,
  manualRationale,
  setManualRationale,
  manualStage,
  setManualStage,
  manualQaScores,
  setManualQaScores,
  manualExtractedData,
  setManualExtractedData,
  screeningSaving,
  screeningError,
  onSave,
  onClear,
  onImport
}: ManualScreeningDetailViewProps) {
  const activeProj = projects.find(p => String(p.id) === String(activeProjectId));

  // Load criteria configs from project schema
  const getEcRules = () => {
    if (!activeProj) return [];
    
    if (manualStage === 'fast_filter') {
      const field = activeProj.ec_rules;
      if (!field) return [];
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch {
        return [];
      }
    }
    
    if (manualStage === 'gatekeeper') {
      const field = activeProj.pool_b_ec_rules;
      if (!field) return [];
      try {
        return typeof field === 'string' ? JSON.parse(field) : field;
      } catch {
        return [];
      }
    }
    
    if (manualStage === 'scientist') {
      const field = activeProj.pool_c_qa_rules;
      if (!field) return [];
      try {
        const parsed = typeof field === 'string' ? JSON.parse(field) : field;
        const mapped = parsed.map((rule: any) => ({
          code: `FATAL_FLAW_${rule.code}`,
          description: `Fatal Flaw: ${rule.question || ''}`
        }));
        mapped.push({
          code: 'CUMULATIVE_BELOW_4.5',
          description: 'Cumulative score below 4.5/8.0'
        });
        return mapped;
      } catch {
        return [];
      }
    }
    
    return [];
  };

  const getQaRules = () => {
    if (!activeProj || !activeProj.pool_c_qa_rules) return [];
    try {
      return typeof activeProj.pool_c_qa_rules === 'string' 
        ? JSON.parse(activeProj.pool_c_qa_rules) 
        : activeProj.pool_c_qa_rules;
    } catch {
      return [];
    }
  };

  const getExtractionRules = () => {
    if (!activeProj || !activeProj.pool_c_extraction_rules) return [];
    try {
      return typeof activeProj.pool_c_extraction_rules === 'string' 
        ? JSON.parse(activeProj.pool_c_extraction_rules) 
        : activeProj.pool_c_extraction_rules;
    } catch {
      return [];
    }
  };

  const ecRules = getEcRules();
  const qaRules = getQaRules();
  const extractionRules = getExtractionRules();

  // Toggle stage options depending on pool
  const renderStageSelector = () => (
    <div>
      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Screening Stage</label>
      <select
        value={manualStage}
        onChange={(e) => setManualStage(e.target.value)}
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
      >
        <option value="fast_filter">Fast Filter (Title-Abstract)</option>
        <option value="gatekeeper">Gatekeeper (Full-text)</option>
        <option value="scientist">Scientist (Quality Appraisal)</option>
        <option value="miner">Miner (Data Extraction)</option>
      </select>
    </div>
  );

  // Scientist stage auto-decision calculator (Dual-Gate Quality Cutoff)
  React.useEffect(() => {
    if (manualStage === 'scientist') {
      let total = 0;
      let answeredCount = 0;
      let fatalTriggered = '';
      
      qaRules.forEach((rule: any) => {
        const scoreObj = manualQaScores[rule.code];
        const val = scoreObj ? scoreObj.value : null;
        if (val !== null && val !== undefined) {
          total += val;
          answeredCount++;
          
          const isFatal = rule.is_fatal_flaw || ['QA1', 'QA2', 'QA3', 'QA4', 'QA6'].includes(rule.code?.toUpperCase().replace(/[^A-Z0-9]/g, ''));
          if (isFatal && val === 0.0) {
            fatalTriggered = `FATAL_FLAW_${rule.code}`;
          }
        }
      });

      if (fatalTriggered) {
        setManualDecision('EXCLUDE');
        setManualEcTrigger(fatalTriggered);
      } else if (answeredCount === qaRules.length && qaRules.length > 0) {
        if (total < 4.5) {
          setManualDecision('EXCLUDE');
          setManualEcTrigger('CUMULATIVE_BELOW_4.5');
        } else {
          setManualDecision('INCLUDE');
          setManualEcTrigger('');
        }
      } else {
        setManualDecision('');
        setManualEcTrigger('');
      }
    }
  }, [manualStage, manualQaScores, qaRules, setManualDecision, setManualEcTrigger]);

  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto flex flex-col space-y-6 border-l border-border/80">
      
      {/* Detail View Header controls */}
      <div className="flex items-center justify-between shrink-0 select-none pb-2 border-b border-border/40">
        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Manual Screening detail</span>
        <div className="flex items-center gap-2">
          {/* Adjudication Copy Trigger */}
          {!!selectedPaper.Human_Decision && !selectedPaper.manual_decision && (
            <button
              onClick={() => onImport(selectedPaper)}
              className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-extrabold rounded-lg border border-primary/20 flex items-center gap-1 transition-all cursor-pointer"
              title="Pre-fill values from calibration reviews"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Import from Calibration</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="px-3 py-1 bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-[10px] font-extrabold rounded-lg border border-border flex items-center gap-1 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Details</span>
          </button>
        </div>
      </div>

      {/* Main Content Workspace Layout */}
      <div className="flex flex-col xl:flex-row gap-6 w-full pb-8">
        
        {/* Left Side: Metadata Card */}
        <div className="flex-1 space-y-5">
          <div className="bg-card border border-border p-5 rounded-xl space-y-4 shadow-sm">
            <div>
              <span className="font-mono text-[9px] font-bold text-muted-foreground/80 block uppercase">
                Paper ID: {selectedPaper.Paper_ID}
              </span>
              <h2 className="font-bold text-base text-foreground leading-snug mt-1">
                {selectedPaper.Title}
              </h2>
            </div>

            {/* Metadata Fields Grid */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border/60 text-xs font-semibold text-muted-foreground">
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Authors</span>
                <span className="text-foreground">{selectedPaper.Authors || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Year</span>
                <span className="text-foreground">{selectedPaper.Year || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Publisher</span>
                <span className="text-foreground">{selectedPaper.Publisher || selectedPaper.Original_Publisher || '—'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">DOI</span>
                <span className="text-foreground font-mono truncate block" title={selectedPaper.DOI || ''}>
                  {selectedPaper.DOI || '—'}
                </span>
              </div>
            </div>

            {/* Abstract */}
            {selectedPaper.Abstract && (
              <div className="pt-3 border-t border-border/60">
                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider block mb-1">Abstract</span>
                <p className="text-xs text-foreground font-medium leading-relaxed max-h-48 overflow-y-auto pr-1">
                  {selectedPaper.Abstract}
                </p>
              </div>
            )}

            {/* Notes / Findings */}
            {selectedPaper.notes && (
              <div className="pt-3 border-t border-border/60">
                <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider block mb-1">General Notes</span>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed italic">
                  {selectedPaper.notes}
                </p>
              </div>
            )}
          </div>

          {/* AI Decision Info Reference */}
          {(selectedPaper.AI_Decision || selectedPaper.AI_Rationale) && (
            <div className="bg-secondary/15 border border-border/40 rounded-xl p-4 space-y-2">
              <span className="block text-[9px] text-muted-foreground/70 font-black uppercase tracking-wider">AI Screening Context Reference</span>
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="block text-[9px] text-muted-foreground/60">Decision</span>
                  <span className={`inline-block px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-extrabold uppercase border ${
                    selectedPaper.AI_Decision === 'INCLUDE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {selectedPaper.AI_Decision || 'PENDING'}
                  </span>
                </div>
                {selectedPaper.AI_EC_Trigger && selectedPaper.AI_EC_Trigger !== 'NONE' && (
                  <div>
                    <span className="block text-[9px] text-muted-foreground/60">AI Exclusion Trigger</span>
                    <span className="text-foreground text-xs font-bold block mt-0.5">{selectedPaper.AI_EC_Trigger}</span>
                  </div>
                )}
              </div>
              {selectedPaper.AI_Rationale && (
                <div className="pt-1.5 border-t border-border/20">
                  <span className="block text-[9px] text-muted-foreground/60">AI Reasoning Rationale</span>
                  <p className="text-[11px] text-muted-foreground font-medium mt-0.5 leading-relaxed italic line-clamp-3" title={selectedPaper.AI_Rationale}>
                    "{selectedPaper.AI_Rationale}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Active Decisions Input Form Panel */}
        <div className="w-full xl:w-[480px] space-y-4">
          <div className="bg-card border border-border p-5 rounded-xl space-y-4 shadow-sm">
            <span className="text-[10px] text-primary uppercase font-black tracking-wider block">Decision Panel</span>

            {/* Error notifications */}
            {screeningError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{screeningError}</span>
              </div>
            )}

            <div className="space-y-4">
              {renderStageSelector()}

              {manualStage !== 'scientist' ? (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Human Decision Override</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val: 'INCLUDE', label: 'Include', activeColor: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
                        { val: 'EXCLUDE', label: 'Exclude', activeColor: 'bg-rose-600 text-white border-rose-600 shadow-sm' }
                      ].map((item) => {
                        const isActive = manualDecision === item.val;
                        return (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setManualDecision(item.val)}
                            className={`px-3 py-2 border rounded-lg text-center text-xs font-bold transition-all cursor-pointer flex-1 ${
                              isActive
                                ? item.activeColor
                                : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exclusions checklist dropdown */}
                  {manualDecision === 'EXCLUDE' && ecRules.length > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Exclusion Criterion Triggered</label>
                      <select
                        value={manualEcTrigger}
                        onChange={(e) => setManualEcTrigger(e.target.value)}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="">Select criteria...</option>
                        {ecRules.map((rule: any) => (
                          <option key={rule.code} value={rule.code}>
                            {rule.code} - {rule.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              ) : (
                /* Scientist stage auto-calculated info banner */
                <div className="p-3 bg-secondary/30 rounded-lg border border-border/80 text-xs space-y-1.5">
                  <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60 font-black">Quality appraisal stats (Auto-calculated)</span>
                  <div className="flex justify-between font-bold">
                    <span>Cumulative Score:</span>
                    <span className="text-foreground">{(() => {
                      let total = 0;
                      qaRules.forEach((rule: any) => {
                        const scoreObj = manualQaScores[rule.code];
                        if (scoreObj && scoreObj.value !== null) {
                          total += scoreObj.value;
                        }
                      });
                      return `${total.toFixed(1)} / ${qaRules.length}.0`;
                    })()}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Calculated Decision:</span>
                    <span className={manualDecision === 'INCLUDE' ? 'text-emerald-500' : manualDecision === 'EXCLUDE' ? 'text-rose-500' : 'text-amber-500'}>
                      {manualDecision || 'PENDING'}
                    </span>
                  </div>
                  {manualDecision === 'EXCLUDE' && manualEcTrigger && (
                    <div className="text-[10px] text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded">
                      Exclusion trigger: {manualEcTrigger}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase">
                    Rationale / Exclusion Justification
                  </label>
                  {/* Reasoning Templates Quick Insertion dropdown */}
                  {(() => {
                    const templates = (() => {
                      const raw = manualStage === 'gatekeeper'
                        ? activeProj?.pool_b_reasoning_template
                        : activeProj?.reasoning_template;
                      if (!raw) return [];
                      try {
                        return typeof raw === 'string' ? JSON.parse(raw) : raw;
                      } catch {
                        if (typeof raw === 'string') return [raw];
                        return Array.isArray(raw) ? raw : [];
                      }
                    })();

                    if (!templates || templates.length === 0) return null;

                    return (
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            setManualRationale(manualRationale ? `${manualRationale}\n${val}` : val);
                            e.target.value = '';
                          }
                        }}
                        className="bg-transparent border-0 text-[10px] font-extrabold text-primary hover:underline focus:outline-none max-w-[180px] cursor-pointer"
                      >
                        <option value="">+ Insert Template...</option>
                        {templates.map((tpl: string, idx: number) => (
                          <option key={idx} value={tpl} className="bg-card text-foreground">
                            {tpl.length > 30 ? `${tpl.substring(0, 30)}...` : tpl}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>
                <textarea
                  rows={4}
                  placeholder="Provide details on inclusion/exclusion reasons..."
                  value={manualRationale}
                  onChange={(e) => setManualRationale(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-none focus:border-primary font-medium leading-relaxed"
                />
              </div>

              {/* Quality Appraisal rules checklist (Scientist) */}
              {manualStage === 'scientist' && qaRules.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="block text-[9px] text-muted-foreground font-black uppercase tracking-wider border-b border-border pb-1">
                    Quality Appraisal Rules Check
                  </span>
                  {qaRules.map((rule: any) => {
                    const currentVal = manualQaScores[rule.code]?.value;
                    const currentEv = manualQaScores[rule.code]?.evidence || '';
                    
                    return (
                      <div key={rule.code} className="p-3 bg-secondary/20 rounded-lg border border-border/40 space-y-2">
                        <div className="flex justify-between items-start gap-3">
                          <span className="text-xs font-bold text-foreground">
                            {rule.code}: {rule.question}
                          </span>
                          {rule.is_fatal_flaw && (
                            <span className="px-1.5 py-0.2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[7px] font-black shrink-0">
                              Fatal Flaw
                            </span>
                          )}
                        </div>
                        
                        <div className="flex gap-1 select-none">
                          {[
                            { val: 1.0, label: 'Yes (1.0)' },
                            { val: 0.5, label: 'Partial (0.5)' },
                            { val: 0.0, label: 'No (0.0)' }
                          ].map((sc) => (
                            <button
                              key={sc.val}
                              type="button"
                              onClick={() => setManualQaScores(prev => ({
                                ...prev,
                                [rule.code]: { value: sc.val, evidence: currentEv }
                              }))}
                              className={`flex-1 py-1 rounded border text-[10px] font-extrabold uppercase transition-colors cursor-pointer ${
                                currentVal === sc.val
                                  ? 'bg-primary border-primary text-primary-foreground'
                                  : 'bg-secondary border-border text-muted-foreground hover:bg-secondary/80'
                              }`}
                            >
                              {sc.label}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={1.5}
                          placeholder="Evidence snippet from full-text..."
                          value={currentEv}
                          onChange={(e) => {
                            const evText = e.target.value;
                            setManualQaScores(prev => ({
                              ...prev,
                              [rule.code]: { value: currentVal ?? null, evidence: evText }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded p-1.5 text-[11px] text-foreground focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Data Extraction variables (Miner) */}
              {manualStage === 'miner' && extractionRules.length > 0 && (
                <div className="space-y-3 pt-2">
                  <span className="block text-[9px] text-muted-foreground font-black uppercase tracking-wider border-b border-border pb-1">
                    Data Extraction Variables
                  </span>
                  {extractionRules.map((rule: any) => {
                    const currentVal = manualExtractedData[rule.json_key]?.value || '';
                    const currentEv = manualExtractedData[rule.json_key]?.evidence || '';
                    
                    return (
                      <div key={rule.json_key} className="p-3 bg-secondary/20 rounded-lg border border-border/40 space-y-2">
                        <label className="block text-xs font-bold text-foreground">
                          {rule.json_key} - <span className="text-muted-foreground">{rule.question}</span>
                        </label>
                        
                        <input
                          type="text"
                          placeholder="Extracted value..."
                          value={currentVal}
                          onChange={(e) => {
                            const v = e.target.value;
                            setManualExtractedData(prev => ({
                              ...prev,
                              [rule.json_key]: { value: v, evidence: currentEv }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary font-semibold"
                        />

                        <textarea
                          rows={2}
                          placeholder="Location/Evidence snippet from paper..."
                          value={currentEv}
                          onChange={(e) => {
                            const evText = e.target.value;
                            setManualExtractedData(prev => ({
                              ...prev,
                              [rule.json_key]: { value: currentVal, evidence: evText }
                            }));
                          }}
                          className="w-full bg-background border border-border rounded p-1.5 text-[11px] text-foreground focus:outline-none focus:border-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions Submit buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onSave(selectedPaper.Paper_ID)}
                disabled={screeningSaving}
                className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {screeningSaving ? 'Saving...' : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Decision</span>
                  </>
                )}
              </button>

              {selectedPaper.manual_decision && (
                <button
                  onClick={() => onClear(selectedPaper.Paper_ID)}
                  disabled={screeningSaving}
                  className="px-3.5 py-2 border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="Wipe and clear manual decisions"
                >
                  <Trash className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Local PDF status view alert */}
          {!selectedPaper.Local_PDF_Path && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <span className="block font-bold">Local PDF File Offline</span>
                <span className="text-[10px] leading-relaxed text-muted-foreground/80 block mt-0.5">
                  Gatekeeper, Scientist, and Miner stages require full-text inspection. Execute the Data Acquisition pipeline first to sync PDF file.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
