import React, { useState } from 'react';
import { Plus, Trash2, Tag, ShieldCheck, ListOrdered, FileJson, CheckCircle, AlertTriangle, Sparkles, Layers } from 'lucide-react';

interface ProjectCalibrationSettingsProps {
  minerSchemaKeys?: string[];
  hasMinerPrompt?: boolean;
  isLoadingMinerPrompt?: boolean;
  onPopulateAllExtractionKeys?: () => void;
  form: {
    projectFormPoolA: string;
    setProjectFormPoolA: (v: string) => void;
    projectFormPoolB: string;
    setProjectFormPoolB: (v: string) => void;
    projectFormPoolC: string;
    setProjectFormPoolC: (v: string) => void;
    projectFormRollingBatchSize: string;
    setProjectFormRollingBatchSize: (v: string) => void;
    projectFormQaDefinition: string;
    projectFormQuestions: string;
    projectFormExclusionCriteria: string;

    // Pool tags (Pool A, B, C)
    projectFormPoolTagsA: any[];
    handleAddPoolTagA: () => void;
    handleUpdatePoolTagA: (idx: number, field: string, val: string) => void;
    handleRemovePoolTagA: (idx: number) => void;

    projectFormPoolTagsB: any[];
    handleAddPoolTagB: () => void;
    handleUpdatePoolTagB: (idx: number, field: string, val: string) => void;
    handleRemovePoolTagB: (idx: number) => void;

    projectFormPoolTagsC: any[];
    handleAddPoolTagC: () => void;
    handleUpdatePoolTagC: (idx: number, field: string, val: string) => void;
    handleRemovePoolTagC: (idx: number) => void;

    // EC Rules (Pool B & C)
    projectFormPoolBEcRules: any[];
    projectFormEcRules: any[];
    handleAddPoolBEcRule: () => void;
    handleUpdatePoolBEcRule: (idx: number, field: string, val: string) => void;
    handleRemovePoolBEcRule: (idx: number) => void;
    handleAddEcRule: () => void;
    handleUpdateEcRule: (idx: number, field: string, val: string) => void;
    handleRemoveEcRule: (idx: number) => void;

    // Reasoning templates (Pool B & C)
    projectFormPoolBReasoningTemplate: string[];
    projectFormReasoningTemplate: string[];
    handleAddPoolBReasoningTemplate: () => void;
    handleUpdatePoolBReasoningTemplate: (idx: number, val: string) => void;
    handleRemovePoolBReasoningTemplate: (idx: number) => void;
    handleAddReasoningTemplate: () => void;
    handleUpdateReasoningTemplate: (idx: number, val: string) => void;
    handleRemoveReasoningTemplate: (idx: number) => void;

    // Pool C QA and extraction rules
    projectFormPoolCQaRules: any[];
    handleAddPoolCQaRule: () => void;
    handleUpdatePoolCQaRule: (idx: number, field: string, val: any) => void;
    handleRemovePoolCQaRule: (idx: number) => void;

    projectFormPoolCExtractionRules: any[];
    handleAddPoolCExtractionRule: () => void;
    handleUpdatePoolCExtractionRule: (idx: number, field: string, val: string) => void;
    handleRemovePoolCExtractionRule: (idx: number) => void;
  };
}

export default function ProjectCalibrationSettings({ 
  form,
  minerSchemaKeys = [],
  hasMinerPrompt = true,
  isLoadingMinerPrompt = false,
  onPopulateAllExtractionKeys
}: ProjectCalibrationSettingsProps) {
  const [calibrationSubTab, setCalibrationSubTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');

  const qaQuestions = (form.projectFormQaDefinition || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  const researchQuestions = (form.projectFormQuestions || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  const exclusionCriteria = (form.projectFormExclusionCriteria || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      {/* Guidance Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <Layers className="w-5 h-5" />
        </div>
        <div className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
          <p className="font-bold text-foreground text-xs">Calibration Sandbox &amp; Adjudication Pools</p>
          <p>
            Systematic reviews are segmented into calibrated sampling targets to evaluate inter-rater agreement and AI prompt reliability prior to full automated execution.
          </p>
        </div>
      </div>

      {/* Target Sizes Card */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Calibration Pool Targets</h4>
          <span className="text-[10px] text-muted-foreground font-mono">Statistical Bound Sizing</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-background/60 p-3 rounded-lg border border-border/70 text-center">
            <label className="block text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Pool A Target</label>
            <input
              type="number"
              value={form.projectFormPoolA}
              onChange={(e) => form.setProjectFormPoolA(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
            />
            <span className="text-[8px] text-muted-foreground mt-1 block">Fast Filter Calibration</span>
          </div>

          <div className="bg-background/60 p-3 rounded-lg border border-border/70 text-center">
            <label className="block text-[9px] font-bold text-purple-400 uppercase tracking-wider mb-1">Pool B Target</label>
            <input
              type="number"
              value={form.projectFormPoolB}
              onChange={(e) => form.setProjectFormPoolB(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
            />
            <span className="text-[8px] text-muted-foreground mt-1 block">Consensus Calibration</span>
          </div>

          <div className="bg-background/60 p-3 rounded-lg border border-border/70 text-center">
            <label className="block text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Pool C Target</label>
            <input
              type="number"
              value={form.projectFormPoolC}
              onChange={(e) => form.setProjectFormPoolC(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
            />
            <span className="text-[8px] text-muted-foreground mt-1 block">Consensus + QA / Extraction</span>
          </div>

          <div className="bg-background/60 p-3 rounded-lg border border-border/70 text-center">
            <label className="block text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Rolling Batch</label>
            <input
              type="number"
              value={form.projectFormRollingBatchSize}
              onChange={(e) => form.setProjectFormRollingBatchSize(e.target.value)}
              className="w-full px-2 py-1 text-xs bg-secondary/50 border border-border rounded text-foreground focus:outline-none focus:border-primary font-mono text-center font-bold"
            />
            <span className="text-[8px] text-muted-foreground mt-1 block">Post-Validation Sampling</span>
          </div>
        </div>
      </div>

      {/* Pool Sub-Tabs Navigation */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex border-b border-border/70 gap-2 pb-2 select-none">
          {[
            { id: 'pool_a', name: 'Pool A (Fast Filter)', color: 'text-indigo-400' },
            { id: 'pool_b', name: 'Pool B (Consensus)', color: 'text-purple-400' },
            { id: 'pool_c', name: 'Pool C (Consensus + QA)', color: 'text-amber-400' }
          ].map((subTab) => (
            <button
              key={subTab.id}
              type="button"
              onClick={() => setCalibrationSubTab(subTab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                calibrationSubTab === subTab.id
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-background/60 text-muted-foreground hover:text-foreground border border-border/60'
              }`}
            >
              {subTab.name}
            </button>
          ))}
        </div>

        {/* Dynamic Pool Configuration Sections */}
        {(() => {
          const isPoolA = calibrationSubTab === 'pool_a';
          const isPoolB = calibrationSubTab === 'pool_b';
          const isPoolC = calibrationSubTab === 'pool_c';

          const tags = isPoolA ? form.projectFormPoolTagsA : isPoolB ? form.projectFormPoolTagsB : form.projectFormPoolTagsC;
          const ecRules = isPoolB ? form.projectFormPoolBEcRules : form.projectFormEcRules;
          const reasoningTemplates = isPoolB ? form.projectFormPoolBReasoningTemplate : form.projectFormReasoningTemplate;

          const onAddTag = isPoolA ? form.handleAddPoolTagA : isPoolB ? form.handleAddPoolTagB : form.handleAddPoolTagC;
          const onUpdateTag = isPoolA ? form.handleUpdatePoolTagA : isPoolB ? form.handleUpdatePoolTagB : form.handleUpdatePoolTagC;
          const onRemoveTag = isPoolA ? form.handleRemovePoolTagA : isPoolB ? form.handleRemovePoolTagB : form.handleRemovePoolTagC;

          const onAddEcRule = isPoolB ? form.handleAddPoolBEcRule : form.handleAddEcRule;
          const onUpdateEcRule = isPoolB ? form.handleUpdatePoolBEcRule : form.handleUpdateEcRule;
          const onRemoveEcRule = isPoolB ? form.handleRemovePoolBEcRule : form.handleRemoveEcRule;

          const onAddReasoningTemplate = isPoolB ? form.handleAddPoolBReasoningTemplate : form.handleAddReasoningTemplate;
          const onUpdateReasoningTemplate = isPoolB ? form.handleUpdatePoolBReasoningTemplate : form.handleUpdateReasoningTemplate;
          const onRemoveReasoningTemplate = isPoolB ? form.handleRemovePoolBReasoningTemplate : form.handleRemoveReasoningTemplate;

          // Render tags section
          const renderTagsSection = (title: string, tagList: any[], onAdd: any, onUpdate: any, onRemove: any) => (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  <h5 className="text-xs font-bold text-foreground">{title}</h5>
                </div>
                <button
                  type="button"
                  onClick={onAdd}
                  className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Classification Tag
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {tagList.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-xl bg-background/40">
                    No custom tags defined. Click 'Add Classification Tag' to define custom pool categories.
                  </div>
                ) : (
                  tagList.map((tag: any, idx: any) => (
                    <div key={idx} className="flex items-center gap-2 bg-background/80 border border-border/70 p-2 rounded-lg shadow-sm">
                      <div className="w-1/3">
                        <input
                          type="text"
                          value={tag.code || ''}
                          onChange={(e) => onUpdate(idx, 'code', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                          placeholder="Tag Code (e.g. INC)"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={tag.label || ''}
                          onChange={(e) => onUpdate(idx, 'label', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-medium"
                          placeholder="Tag Label (e.g. Include in final review)"
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(idx)}
                        className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors cursor-pointer"
                        title="Remove Tag"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );

          if (isPoolA || isPoolB) {
            return (
              <div className="space-y-5 pt-1">
                {renderTagsSection(
                  isPoolA ? "Classification Tags (Pool A)" : "Classification Tags (Pool B)",
                  tags,
                  onAddTag,
                  onUpdateTag,
                  onRemoveTag
                )}

                {/* EC Rules Section */}
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      <h5 className="text-xs font-bold text-foreground">
                        {isPoolA ? "Exclusion Criteria Rules (Pool A)" : "Exclusion Criteria Rules (Pool B)"}
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={onAddEcRule}
                      className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Exclusion Rule
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {ecRules.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-xl bg-background/40">
                        No exclusion rules mapped. Click 'Add Exclusion Rule' to link short codes to criteria.
                      </div>
                    ) : (
                      ecRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-background/80 border border-border/70 p-2 rounded-lg shadow-sm">
                          <div className="w-1/4">
                            <input
                              type="text"
                              value={rule.code}
                              onChange={(e) => onUpdateEcRule(idx, 'code', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                              placeholder="e.g. EC-1"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <select
                              value={rule.description}
                              onChange={(e) => onUpdateEcRule(idx, 'description', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
                              required
                            >
                              <option value="">-- Select Exclusion Criterion --</option>
                              {exclusionCriteria.map((criterion: string, cIdx: number) => (
                                <option key={cIdx} value={criterion}>{criterion}</option>
                              ))}
                              {rule.description && !exclusionCriteria.includes(rule.description) && (
                                <option value={rule.description}>{rule.description}</option>
                              )}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveEcRule(idx)}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors cursor-pointer"
                            title="Remove Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reasoning Template Section */}
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5 text-primary" />
                      <h5 className="text-xs font-bold text-foreground">
                        {isPoolA ? "Reasoning Templates (Pool A)" : "Reasoning Templates (Pool B)"}
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={onAddReasoningTemplate}
                      className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Reasoning Template
                    </button>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {reasoningTemplates.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-xl bg-background/40">
                        No templates defined. Click 'Add Reasoning Template' to configure standardized rationale snippets.
                      </div>
                    ) : (
                      reasoningTemplates.map((tmpl: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-background/80 border border-border/70 p-2 rounded-lg shadow-sm">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={tmpl}
                              onChange={(e) => onUpdateReasoningTemplate(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-medium"
                              placeholder="Standard rationale text..."
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveReasoningTemplate(idx)}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors cursor-pointer"
                            title="Remove Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          } else if (isPoolC) {
            return (
              <div className="space-y-5 pt-1">
                {renderTagsSection("Classification Tags (Pool C)", tags, onAddTag, onUpdateTag, onRemoveTag)}

                {/* QA Rules Section */}
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                      <h5 className="text-xs font-bold text-foreground">Quality Assessment Rules (QA Mapping)</h5>
                    </div>
                    <button
                      type="button"
                      onClick={form.handleAddPoolCQaRule}
                      className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add QA Rule
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {form.projectFormPoolCQaRules.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-xl bg-background/40">
                        No QA mapping rules defined. Click 'Add QA Rule' to map short code to quality assessment question.
                      </div>
                    ) : (
                      form.projectFormPoolCQaRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex flex-col gap-2 bg-background/80 border border-border/70 p-3 rounded-xl shadow-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-1/4">
                              <input
                                type="text"
                                value={rule.code}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'code', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                                placeholder="QA-1"
                                required
                              />
                            </div>
                            <div className="flex-1">
                              <select
                                value={rule.question}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'question', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
                                required
                              >
                                <option value="">-- Select QA Question --</option>
                                {qaQuestions.map((q: string, qIdx: number) => (
                                  <option key={qIdx} value={q}>{q}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 px-2 select-none border-l border-border/50">
                              <input
                                type="checkbox"
                                id={`fatal-flaw-${idx}`}
                                checked={!!rule.is_fatal_flaw}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'is_fatal_flaw', e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-border text-primary bg-secondary/35 focus:ring-primary cursor-pointer"
                              />
                              <label htmlFor={`fatal-flaw-${idx}`} className="text-[9px] font-bold text-destructive cursor-pointer uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-destructive" /> Fatal Flaw
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => form.handleRemovePoolCQaRule(idx)}
                              className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors cursor-pointer shrink-0"
                              title="Remove Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {/* Scoring Logic Input Fields */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                            <div>
                              <label className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Score 1.0 Logic</label>
                              <input
                                type="text"
                                value={rule.score_1_logic || ''}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'score_1_logic', e.target.value)}
                                className="w-full px-2 py-1 text-[10px] bg-secondary/30 border border-border rounded text-foreground focus:outline-none focus:border-primary font-medium"
                                placeholder="e.g. Fully addressed..."
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Score 0.5 Logic</label>
                              <input
                                type="text"
                                value={rule.score_05_logic || ''}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'score_05_logic', e.target.value)}
                                className="w-full px-2 py-1 text-[10px] bg-secondary/30 border border-border rounded text-foreground focus:outline-none focus:border-primary font-medium"
                                placeholder="e.g. Partially addressed..."
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Score 0.0 Logic</label>
                              <input
                                type="text"
                                value={rule.score_0_logic || ''}
                                onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'score_0_logic', e.target.value)}
                                className="w-full px-2 py-1 text-[10px] bg-secondary/30 border border-border rounded text-foreground focus:outline-none focus:border-primary font-medium"
                                placeholder="e.g. Not addressed..."
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Data Extraction Section */}
                <div className="space-y-3 pt-3 border-t border-border/40">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <FileJson className="w-3.5 h-3.5 text-primary" />
                      <h5 className="text-xs font-bold text-foreground">Data Extraction Rules (JSON Mapping)</h5>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasMinerPrompt && minerSchemaKeys.length > 0 && onPopulateAllExtractionKeys && (
                        <button
                          type="button"
                          onClick={onPopulateAllExtractionKeys}
                          className="px-2.5 py-1 bg-secondary/70 hover:bg-secondary text-foreground border border-border/80 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                          title="Populate all extraction keys from the Miner prompt schema"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Populate from Schema
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={form.handleAddPoolCExtractionRule}
                        className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Extraction Key
                      </button>
                    </div>
                  </div>

                  {/* Missing Miner Prompt Alert Banner */}
                  {!isLoadingMinerPrompt && !hasMinerPrompt && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2.5 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed space-y-0.5">
                        <p className="font-bold">No Miner Prompt Schema Configured for this Project</p>
                        <p className="text-muted-foreground text-[10px]">
                          No active Miner prompt template was found in the Prompt Library for this project. Configure a Miner prompt with a valid <code className="font-mono text-[9px] bg-secondary/50 px-1 py-0.5 rounded">properties.extracted_data.properties</code> schema in <span className="font-semibold text-foreground">Global LLM Settings &gt; Prompt Library</span> to enable schema-driven JSON key selection.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {form.projectFormPoolCExtractionRules.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-xl bg-background/40">
                        No extraction mapping rules defined. Click 'Add Extraction Key' to map JSON payload key to RQ.
                      </div>
                    ) : (
                      form.projectFormPoolCExtractionRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-background/80 border border-border/70 p-2 rounded-lg shadow-sm">
                          <div className="w-1/3">
                            <select
                              value={rule.json_key || ''}
                              onChange={(e) => form.handleUpdatePoolCExtractionRule(idx, 'json_key', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono cursor-pointer"
                              required
                            >
                              <option value="">
                                {minerSchemaKeys.length > 0 ? '-- Select JSON Key --' : '-- No Schema Keys Available --'}
                              </option>
                              {minerSchemaKeys.map((key: string) => (
                                <option key={key} value={key}>
                                  {key}
                                </option>
                              ))}
                              {rule.json_key && !minerSchemaKeys.includes(rule.json_key) && (
                                <option value={rule.json_key}>
                                  {rule.json_key} (Custom / Legacy)
                                </option>
                              )}
                            </select>
                          </div>
                          <div className="flex-1">
                            <select
                              value={rule.question}
                              onChange={(e) => form.handleUpdatePoolCExtractionRule(idx, 'question', e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-md text-foreground focus:outline-none focus:border-primary font-medium cursor-pointer"
                              required
                            >
                              <option value="">-- Select Research Question --</option>
                              {researchQuestions.map((q: string, qIdx: number) => (
                                <option key={qIdx} value={q}>{q}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => form.handleRemovePoolCExtractionRule(idx)}
                            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors cursor-pointer"
                            title="Remove Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    </div>
  );
}
