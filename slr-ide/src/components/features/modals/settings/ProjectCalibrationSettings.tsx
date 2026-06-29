import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface ProjectCalibrationSettingsProps {
  form: {
    projectFormPoolA: string;
    setProjectFormPoolA: (v: string) => void;
    projectFormPoolB: string;
    setProjectFormPoolB: (v: string) => void;
    projectFormPoolC: string;
    setProjectFormPoolC: (v: string) => void;
    projectFormQaDefinition: string;
    projectFormQuestions: string;

    // Pool tags (Pool A)
    projectFormPoolTags: any[];
    handleAddPoolTag: () => void;
    handleUpdatePoolTag: (idx: number, field: string, val: string) => void;
    handleRemovePoolTag: (idx: number) => void;

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

export default function ProjectCalibrationSettings({ form }: ProjectCalibrationSettingsProps) {
  const [calibrationSubTab, setCalibrationSubTab] = useState<'pool_a' | 'pool_b' | 'pool_c'>('pool_a');

  const qaQuestions = (form.projectFormQaDefinition || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  const researchQuestions = (form.projectFormQuestions || '')
    .split('\n')
    .map((line: string) => line.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="bg-secondary/15 border border-border rounded-lg p-4 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
        <p className="font-bold text-foreground">Calibration Guidelines:</p>
        <p>Before launching consensus screening, projects are segmented into calibration targets to test screening alignment.</p>
        <p>Adjust target sizes and define classification tags for each pool below.</p>
      </div>

      {/* Pool Sub-tabs */}
      <div className="flex border-b border-border/80 text-[10px] font-bold uppercase tracking-wider gap-4 pb-0.5 select-none">
        {[
          { id: 'pool_a', name: 'Pool A (Fast Filter)' },
          { id: 'pool_b', name: 'Pool B (Consensus)' },
          { id: 'pool_c', name: 'Pool C (Consensus + QA)' }
        ].map((subTab) => (
          <button
            key={subTab.id}
            type="button"
            onClick={() => setCalibrationSubTab(subTab.id as any)}
            className={`pb-2 transition-all relative ${
              calibrationSubTab === subTab.id
                ? 'text-foreground border-b-2 border-primary font-black'
                : 'text-muted-foreground hover:text-foreground font-semibold'
            }`}
          >
            {subTab.name}
          </button>
        ))}
      </div>

      <div className="space-y-4 pt-1">
        <div>
          <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            {calibrationSubTab === 'pool_a' ? 'Pool A Target Size' : calibrationSubTab === 'pool_b' ? 'Pool B Target Size' : 'Pool C Target Size'}
          </label>
          <input
            type="number"
            value={
              calibrationSubTab === 'pool_a' ? form.projectFormPoolA : calibrationSubTab === 'pool_b' ? form.projectFormPoolB : form.projectFormPoolC
            }
            onChange={(e) => {
              if (calibrationSubTab === 'pool_a') form.setProjectFormPoolA(e.target.value);
              else if (calibrationSubTab === 'pool_b') form.setProjectFormPoolB(e.target.value);
              else form.setProjectFormPoolC(e.target.value);
            }}
            className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-mono font-bold"
          />
        </div>

        {/* Sub-tab specific configurations */}
        {(() => {
          const isPoolA = calibrationSubTab === 'pool_a';
          const isPoolB = calibrationSubTab === 'pool_b';
          const isPoolC = calibrationSubTab === 'pool_c';

          const tags = isPoolA ? form.projectFormPoolTags : [];
          const ecRules = isPoolB ? form.projectFormPoolBEcRules : form.projectFormEcRules;
          const reasoningTemplates = isPoolB ? form.projectFormPoolBReasoningTemplate : form.projectFormReasoningTemplate;

          const onAddTag = isPoolA ? form.handleAddPoolTag : () => {};
          const onUpdateTag = isPoolA ? form.handleUpdatePoolTag : () => {};
          const onRemoveTag = isPoolA ? form.handleRemovePoolTag : () => {};

          const onAddEcRule = isPoolB ? form.handleAddPoolBEcRule : form.handleAddEcRule;
          const onUpdateEcRule = isPoolB ? form.handleUpdatePoolBEcRule : form.handleUpdateEcRule;
          const onRemoveEcRule = isPoolB ? form.handleRemovePoolBEcRule : form.handleRemoveEcRule;

          const onAddReasoningTemplate = isPoolB ? form.handleAddPoolBReasoningTemplate : form.handleAddReasoningTemplate;
          const onUpdateReasoningTemplate = isPoolB ? form.handleUpdatePoolBReasoningTemplate : form.handleUpdateReasoningTemplate;
          const onRemoveReasoningTemplate = isPoolB ? form.handleRemovePoolBReasoningTemplate : form.handleRemoveReasoningTemplate;

          if (isPoolA) {
            return (
              <div className="pt-4 mt-4 border-t border-border/50 space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h4 className="text-[11px] font-bold text-foreground">Classification Tags (Pool A)</h4>
                    <p className="text-[9px] text-muted-foreground">Define custom tag labels for fast initial filtering.</p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddTag}
                    className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Tag
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {tags.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                      No tags defined. Click 'Add Tag' to create custom classifications.
                    </div>
                  ) : (
                    tags.map((tag: any, idx: any) => (
                      <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                        <div className="w-1/3">
                          <input
                            type="text"
                            value={tag.label}
                            onChange={(e) => onUpdateTag(idx, 'label', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold"
                            placeholder="Tag Label"
                            required
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={tag.description}
                            onChange={(e) => onUpdateTag(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                            placeholder="Tag Description..."
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveTag(idx)}
                          className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          } else if (isPoolB) {
            return (
              <div className="pt-4 mt-4 border-t border-border/50 space-y-6">
                {/* EC Rules Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[11px] font-bold text-foreground">Exclusion Criteria Rules (Pool B)</h4>
                      <p className="text-[9px] text-muted-foreground">Define explicit exclusion rule keys for consensus filtering.</p>
                    </div>
                    <button
                      type="button"
                      onClick={onAddEcRule}
                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Rule
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {ecRules.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                        No exclusion rules defined. Click 'Add Rule' to define criteria.
                      </div>
                    ) : (
                      ecRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                          <div className="w-1/4">
                            <input
                              type="text"
                              value={rule.code}
                              onChange={(e) => onUpdateEcRule(idx, 'code', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                              placeholder="Rule Code"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={rule.description}
                              onChange={(e) => onUpdateEcRule(idx, 'description', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                              placeholder="Rule Description..."
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveEcRule(idx)}
                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Reasoning Template Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[11px] font-bold text-foreground">Reasoning Templates</h4>
                      <p className="text-[9px] text-muted-foreground">Pre-defined rationale strings for review decisions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={onAddReasoningTemplate}
                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Template
                    </button>
                  </div>

                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {reasoningTemplates.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                        No templates defined. Click 'Add Template' to define rationales.
                      </div>
                    ) : (
                      reasoningTemplates.map((tmpl: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={tmpl}
                              onChange={(e) => onUpdateReasoningTemplate(idx, e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
                              placeholder="Template text..."
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveReasoningTemplate(idx)}
                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
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
              <div className="pt-4 mt-4 border-t border-border/50 space-y-6">
                {/* QA Rules Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[11px] font-bold text-foreground">Quality Assessment Rules (QA Mapping)</h4>
                      <p className="text-[9px] text-muted-foreground">Map a custom short code to a project Quality Appraisal question.</p>
                    </div>
                    <button
                      type="button"
                      onClick={form.handleAddPoolCQaRule}
                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Rule
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {form.projectFormPoolCQaRules.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                        No QA mapping rules defined. Click 'Add Rule' to map code to question.
                      </div>
                    ) : (
                      form.projectFormPoolCQaRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                          <div className="w-1/4">
                            <input
                              type="text"
                              value={rule.code}
                              onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'code', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                              placeholder="QA Code"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <select
                              value={rule.question}
                              onChange={(e) => form.handleUpdatePoolCQaRule(idx, 'question', e.target.value)}
                              className="w-full px-2 py-1.5 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
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
                              className="w-3 h-3 rounded border-border text-primary bg-secondary/35 focus:ring-primary focus:ring-opacity-25 cursor-pointer"
                            />
                            <label htmlFor={`fatal-flaw-${idx}`} className="text-[9px] font-bold text-muted-foreground cursor-pointer uppercase tracking-wider">
                              Fatal Flaw
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => form.handleRemovePoolCQaRule(idx)}
                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Data Extraction Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[11px] font-bold text-foreground">Data Extraction Rules (JSON Mapping)</h4>
                      <p className="text-[9px] text-muted-foreground">Map a target JSON key to a project Research Question.</p>
                    </div>
                    <button
                      type="button"
                      onClick={form.handleAddPoolCExtractionRule}
                      className="px-2.5 py-1 bg-secondary text-foreground hover:bg-secondary/80 border border-border font-bold rounded-lg text-[10px] transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Key Map
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {form.projectFormPoolCExtractionRules.length === 0 ? (
                      <div className="text-[10px] text-muted-foreground italic text-center py-4 border border-dashed border-border/60 rounded-lg bg-secondary/5">
                        No extraction mapping rules defined. Click 'Add Key Map' to map JSON key to question.
                      </div>
                    ) : (
                      form.projectFormPoolCExtractionRules.map((rule: any, idx: any) => (
                        <div key={idx} className="flex items-center gap-2 bg-secondary/15 border border-border p-2 rounded-lg">
                          <div className="w-1/4">
                            <input
                              type="text"
                              value={rule.json_key}
                              onChange={(e) => form.handleUpdatePoolCExtractionRule(idx, 'json_key', e.target.value)}
                              className="w-full px-2 py-1 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-bold font-mono"
                              placeholder="JSON Key"
                              required
                            />
                          </div>
                          <div className="flex-1">
                            <select
                              value={rule.question}
                              onChange={(e) => form.handleUpdatePoolCExtractionRule(idx, 'question', e.target.value)}
                              className="w-full px-2 py-1.5 text-[11px] bg-secondary/35 border border-border rounded-md text-foreground focus:outline-none focus:border-primary font-semibold"
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
                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
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
