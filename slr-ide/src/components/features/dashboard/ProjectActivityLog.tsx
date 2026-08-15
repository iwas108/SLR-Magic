import React, { useState } from 'react';
import { Calendar, ShieldCheck, Sparkles, BookOpen, ChevronDown, ChevronUp, Target, HelpCircle, FileText } from 'lucide-react';

interface ProjectActivityLogProps {
  activeProject: any;
}

export default function ProjectActivityLog({ activeProject }: ProjectActivityLogProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeProject) return null;

  return (
    <div className="bg-card border border-border/80 rounded-2xl shadow-md p-6 space-y-4 w-full">
      <div 
        className="flex items-center justify-between border-b border-border/60 pb-3 cursor-pointer group select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="space-y-1">
          <h3 className="font-extrabold text-xs text-foreground uppercase tracking-wider flex items-center gap-2 group-hover:text-primary transition-colors">
            <Sparkles className="w-4 h-4 text-primary" />
            Project Scope Manifesto &amp; Active Protocol
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 ml-1 text-primary transition-transform" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-1 text-muted-foreground group-hover:text-primary transition-transform" />
            )}
          </h3>
          <p className="text-[11px] text-muted-foreground">Active configuration parameters, research objectives, and quality appraisal definitions.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" /> Active Protocol
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1 text-xs">
            {/* Left Column: Manifesto & Objective */}
            <div className="space-y-4 bg-secondary/15 p-4 rounded-xl border border-border/60">
              <div className="space-y-1.5">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
                  <BookOpen className="w-3.5 h-3.5" />
                  Research Manifesto
                </h4>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                  {activeProject.manifesto || 'No manifesto explicitly defined for this project scope.'}
                </p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-border/40">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
                  <Target className="w-3.5 h-3.5" />
                  Research Objective
                </h4>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                  {activeProject.objective || 'No research objective explicitly defined.'}
                </p>
              </div>
            </div>

            {/* Right Column: Questions & QA Definitions */}
            <div className="space-y-4 bg-secondary/15 p-4 rounded-xl border border-border/60">
              <div className="space-y-1.5">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
                  <FileText className="w-3.5 h-3.5" />
                  Research Questions (RQs)
                </h4>
                <div className="text-[11px] font-mono bg-background/70 p-3 rounded-lg border border-border/70 text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                  {activeProject.questions || activeProject.research_questions || 'RQ1: Not defined\nRQ2: Not defined'}
                </div>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-border/40">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5 text-primary">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Quality Assurance (QA) Definition
                </h4>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap text-[11px]">
                  {activeProject.qa_definition || 'No QA appraisal bounds defined.'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Protocol Instantiated: {new Date(activeProject.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span>Destination: {activeProject.gdrive_dest_path || 'SLR_Magic/PDFs'}/{activeProject.folder_name}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
