import React from 'react';

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
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Name</label>
        <input
          type="text"
          value={form.projectFormName}
          onChange={(e) => form.setProjectFormName(e.target.value)}
          className="w-full px-3 py-1.5 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
          placeholder="Enter project name..."
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Scopus Search String</label>
        <textarea
          rows={4}
          value={form.projectFormScopusSearchString}
          onChange={(e) => form.setProjectFormScopusSearchString(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono min-h-[100px] leading-relaxed"
          placeholder="TITLE-ABS-KEY ( ( &quot;systematic literature review&quot; OR &quot;slr&quot; ) AND ( &quot;artificial intelligence&quot; OR &quot;llm&quot; ) )"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Manual / Google Scholar Search String</label>
        <textarea
          rows={4}
          value={form.projectFormManualSearchString}
          onChange={(e) => form.setProjectFormManualSearchString(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono min-h-[100px] leading-relaxed"
          placeholder="allintitle: &quot;systematic literature review&quot; AND &quot;artificial intelligence&quot;"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Manifesto</label>
        <textarea
          rows={5}
          value={form.projectFormManifesto}
          onChange={(e) => form.setProjectFormManifesto(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
          placeholder="What is this systematic literature review about?"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Objective</label>
        <textarea
          rows={5}
          value={form.projectFormObjective}
          onChange={(e) => form.setProjectFormObjective(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
          placeholder="What are the key goals and objectives?"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Research Questions</label>
        <textarea
          rows={5}
          value={form.projectFormQuestions}
          onChange={(e) => form.setProjectFormQuestions(e.target.value)}
          className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold font-mono min-h-[120px] leading-relaxed"
          placeholder="RQ1: ...&#10;RQ2: ..."
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
          <div className="bg-secondary/15 border border-border/60 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Research Question Descriptions Mapping (for Umbrellanizer {"{{ umbrellanizer_target_research_question_description }}"})
              </span>
              <span className="text-[9px] font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                {parsedQuestions.length} {parsedQuestions.length === 1 ? 'Question' : 'Questions'} Detected
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Map each line-by-line research question with a detailed description to feed into the <code>{"{{ umbrellanizer_target_research_question_description }}"}</code> Jinja2 context variable during LLM execution.
            </p>
            <div className="space-y-2 pt-1">
              {parsedQuestions.map((rq, idx) => {
                const currentDesc = form.projectFormResearchQuestionDescriptions?.[rq.key] || form.projectFormResearchQuestionDescriptions?.[rq.label] || '';
                return (
                  <div key={idx} className="p-2.5 bg-secondary/30 border border-border/40 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-foreground">
                      <span className="font-mono text-primary">{rq.key}</span>
                      <span className="text-[10px] text-muted-foreground font-sans line-clamp-1">{rq.label}</span>
                    </div>
                    <input
                      type="text"
                      value={currentDesc}
                      onChange={(e) => {
                        const nextDescs = { ...(form.projectFormResearchQuestionDescriptions || {}), [rq.key]: e.target.value, [rq.label]: e.target.value };
                        form.setProjectFormResearchQuestionDescriptions?.(nextDescs);
                      }}
                      placeholder={`Enter detailed description for ${rq.key}...`}
                      className="w-full px-2.5 py-1 text-xs bg-card border border-border/80 rounded text-foreground focus:outline-none focus:border-primary font-medium"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Quality Assurance Definition</label>
          <textarea
            rows={5}
            value={form.projectFormQaDefinition}
            onChange={(e) => form.setProjectFormQaDefinition(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
            placeholder="Define QA check bounds..."
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Exclusion Criteria</label>
          <textarea
            rows={5}
            value={form.projectFormExclusionCriteria}
            onChange={(e) => form.setProjectFormExclusionCriteria(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-secondary/35 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold min-h-[120px] leading-relaxed"
            placeholder="What papers must be discarded?"
          />
        </div>
      </div>
    </div>
  );
}
