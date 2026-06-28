import React from 'react';
import { Calendar, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

interface ProjectActivityLogProps {
  activeProject: any;
}

export default function ProjectActivityLog({ activeProject }: ProjectActivityLogProps) {
  if (!activeProject) return null;

  return (
    <div className="bg-card border border-border rounded-xl shadow-md p-6 space-y-4 w-full">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="space-y-1">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Project Scope Manifesto &amp; Review Protocol
          </h3>
          <p className="text-[10px] text-muted-foreground">Active configuration parameters, research objectives, and quality appraisal definitions.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Active Protocol
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 text-xs">
        {/* Left Column: Manifesto & Objective */}
        <div className="space-y-4 bg-secondary/10 p-4 rounded-xl border border-border/50">
          <div className="space-y-1.5">
            <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              Research Manifesto
            </h4>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
              {activeProject.manifesto || 'No manifesto explicitly defined for this project scope.'}
            </p>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/60">
            <h4 className="font-bold text-foreground text-xs text-primary">Research Objective</h4>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
              {activeProject.objective || 'No research objective explicitly defined.'}
            </p>
          </div>
        </div>

        {/* Right Column: Questions & QA Definitions */}
        <div className="space-y-4 bg-secondary/10 p-4 rounded-xl border border-border/50">
          <div className="space-y-1.5">
            <h4 className="font-bold text-foreground text-xs text-primary">Research Questions (RQs)</h4>
            <div className="text-[11px] font-mono bg-background/50 p-2.5 rounded-lg border border-border/60 text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
              {activeProject.questions || activeProject.research_questions || 'RQ1: Not defined\nRQ2: Not defined'}
            </div>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-border/60">
            <h4 className="font-bold text-foreground text-xs text-primary">Quality Assurance (QA) Definition</h4>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
              {activeProject.qa_definition || 'No QA bounds or appraisal questions defined.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-border text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5 font-mono">
          <Calendar className="w-3.5 h-3.5" />
          <span>Protocol Instantiated: {new Date(activeProject.created_at).toLocaleString()}</span>
        </div>
        <div className="font-mono text-[10px]">
          <span>Destination: {activeProject.gdrive_dest_path || 'SLR_Magic/PDFs'}/{activeProject.folder_name}</span>
        </div>
      </div>
    </div>
  );
}
