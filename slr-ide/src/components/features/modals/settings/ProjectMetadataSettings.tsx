import React, { useState } from 'react';
import { BookOpen, Search, Copy, Check, Target, ShieldAlert, Sparkles, HelpCircle, Code } from 'lucide-react';

interface ProjectMetadataSettingsProps {
  form: {
    projectFormName: string;
    setProjectFormName: (v: string) => void;
    projectFormManifesto: string;
    setProjectFormManifesto: (v: string) => void;
    projectFormObjective: string;
    setProjectFormObjective: (v: string) => void;
    projectFormQuestions: string;
    setProjectFormQuestions: (v: string) => void;
    projectFormQaDefinition: string;
    setProjectFormQaDefinition: (v: string) => void;
    projectFormExclusionCriteria: string;
    setProjectFormExclusionCriteria: (v: string) => void;
    projectFormScopusSearchString: string;
    setProjectFormScopusSearchString: (v: string) => void;
    projectFormManualSearchString: string;
    setProjectFormManualSearchString: (v: string) => void;
    projectFormResearchQuestionDescriptions?: Record<string, string>;
    setProjectFormResearchQuestionDescriptions?: (v: Record<string, string>) => void;
  };
}

export default function ProjectMetadataSettings({ form }: ProjectMetadataSettingsProps) {
  const [copiedScopus, setCopiedScopus] = useState(false);
  const [copiedManual, setCopiedManual] = useState(false);

  const copyToClipboard = (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Project Basic Identity */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Project Identity</h4>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Project Scope Name <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            value={form.projectFormName}
            onChange={(e) => form.setProjectFormName(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-bold shadow-inner"
            placeholder="Enter project name..."
            required
          />
        </div>
      </div>

      {/* Systematic Search Queries */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-400" />
            <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Systematic Search Queries</h4>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">Literature Ingestion Strings</span>
        </div>

        {/* Scopus String */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Scopus Database Search String
            </label>
            {form.projectFormScopusSearchString && (
              <button
                type="button"
                onClick={() => copyToClipboard(form.projectFormScopusSearchString, setCopiedScopus)}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
              >
                {copiedScopus ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedScopus ? 'Copied' : 'Copy Query'}
              </button>
            )}
          </div>
          <textarea
            rows={3}
            value={form.projectFormScopusSearchString}
            onChange={(e) => form.setProjectFormScopusSearchString(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono shadow-inner leading-relaxed"
            placeholder='TITLE-ABS-KEY ( ( "systematic literature review" OR "slr" ) AND ( "artificial intelligence" OR "llm" ) )'
          />
        </div>

        {/* Manual / Scholar String */}
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Manual / Google Scholar Search String
            </label>
            {form.projectFormManualSearchString && (
              <button
                type="button"
                onClick={() => copyToClipboard(form.projectFormManualSearchString, setCopiedManual)}
                className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
              >
                {copiedManual ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copiedManual ? 'Copied' : 'Copy Query'}
              </button>
            )}
          </div>
          <textarea
            rows={3}
            value={form.projectFormManualSearchString}
            onChange={(e) => form.setProjectFormManualSearchString(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono shadow-inner leading-relaxed"
            placeholder='allintitle: "systematic literature review" AND "artificial intelligence"'
          />
        </div>
      </div>

      {/* Protocol Scope & Synthesis */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <BookOpen className="w-4 h-4 text-primary" />
          <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Protocol Scope &amp; Objectives</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Research Manifesto
            </label>
            <textarea
              rows={4}
              value={form.projectFormManifesto}
              onChange={(e) => form.setProjectFormManifesto(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium shadow-inner leading-relaxed"
              placeholder="What is this systematic literature review about?"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Research Objective
            </label>
            <textarea
              rows={4}
              value={form.projectFormObjective}
              onChange={(e) => form.setProjectFormObjective(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium shadow-inner leading-relaxed"
              placeholder="What are the key goals and objectives?"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Research Questions (RQs)
          </label>
          <textarea
            rows={4}
            value={form.projectFormQuestions}
            onChange={(e) => form.setProjectFormQuestions(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono shadow-inner leading-relaxed"
            placeholder="RQ1: What machine learning models are used?&#10;RQ2: What dataset domains are evaluated?"
          />
        </div>

        {/* Dynamic Research Question Descriptions Mapping */}
        {(() => {
          const rawLines = (form.projectFormQuestions || '').split('\n').map(l => l.trim()).filter(Boolean);
          if (rawLines.length === 0) return null;

          const parsedQuestions = rawLines.map(line => {
            const match = line.match(/^(rq\s*\d+[a-z]?|\d+[\.\)]|[a-z0-9_-]+)(?:\s*[:\.-]\s*|\s+)(.*)/i);
            if (match) {
              const key = match[1].replace(/\s+/g, '').toUpperCase();
              return { key, label: line };
            }
            return { key: line.substring(0, 15).toUpperCase().replace(/[^A-Z0-9]/g, '_'), label: line };
          });

          return (
            <div className="bg-secondary/20 border border-border/70 rounded-xl p-3.5 space-y-3 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-primary" />
                  Research Question Jinja2 Variable Descriptions
                </span>
                <span className="text-[9px] font-mono font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  {parsedQuestions.length} {parsedQuestions.length === 1 ? 'Question' : 'Questions'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Descriptions mapped here feed the <code className="font-mono text-[9px] bg-secondary/80 px-1 py-0.5 rounded">{"{{ umbrellanizer_target_research_question_description }}"}</code> Jinja2 context variable during LLM synthesis.
              </p>
              <div className="space-y-2 pt-1">
                {parsedQuestions.map((rq, idx) => {
                  const currentDesc = form.projectFormResearchQuestionDescriptions?.[rq.key] || form.projectFormResearchQuestionDescriptions?.[rq.label] || '';
                  return (
                    <div key={idx} className="p-2.5 bg-background/70 border border-border/60 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="font-mono text-primary text-[11px]">{rq.key}</span>
                        <span className="text-[10px] text-muted-foreground font-sans truncate max-w-[300px]">{rq.label}</span>
                      </div>
                      <input
                        type="text"
                        value={currentDesc}
                        onChange={(e) => {
                          const nextDescs = { ...(form.projectFormResearchQuestionDescriptions || {}), [rq.key]: e.target.value, [rq.label]: e.target.value };
                          form.setProjectFormResearchQuestionDescriptions?.(nextDescs);
                        }}
                        placeholder={`Enter detailed description for ${rq.key}...`}
                        className="w-full px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded text-foreground focus:outline-none focus:border-primary font-medium"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Quality Assurance & Exclusion Criteria */}
      <div className="bg-secondary/10 border border-border/60 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-2 pb-1 border-b border-border/40">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">Appraisal &amp; Exclusion Bounds</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Quality Assurance (QA) Definition
            </label>
            <textarea
              rows={4}
              value={form.projectFormQaDefinition}
              onChange={(e) => form.setProjectFormQaDefinition(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium shadow-inner leading-relaxed"
              placeholder="Define QA check bounds..."
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Exclusion Criteria (EC Rules)
            </label>
            <textarea
              rows={4}
              value={form.projectFormExclusionCriteria}
              onChange={(e) => form.setProjectFormExclusionCriteria(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background/80 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium shadow-inner leading-relaxed"
              placeholder="What papers must be discarded?"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
