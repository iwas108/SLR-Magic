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
