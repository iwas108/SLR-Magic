import React, { useState } from 'react';
import { BookOpen, Search, Copy, Check, Target, ShieldAlert, Sparkles, HelpCircle, Code, Plus, Trash2, Database, Globe } from 'lucide-react';
import { SearchQuery } from '@/types';

const STANDARD_DATABASES = [
  'Scopus',
  'Web of Science',
  'IEEE Xplore',
  'PubMed',
  'ACM Digital Library',
  'Google Scholar',
  'ScienceDirect',
  'SpringerLink',
  'Dimensions',
  'Other'
];

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
    projectFormScopusSearchString?: string;
    setProjectFormScopusSearchString?: (v: string) => void;
    projectFormManualSearchString?: string;
    setProjectFormManualSearchString?: (v: string) => void;
    projectFormSearchQueries?: SearchQuery[];
    handleAddSearchQuery?: (source?: string) => void;
    handleUpdateSearchQuery?: (idx: number, field: keyof SearchQuery, val: string) => void;
    handleRemoveSearchQuery?: (idx: number) => void;
    projectFormResearchQuestionDescriptions?: Record<string, string>;
    setProjectFormResearchQuestionDescriptions?: (v: Record<string, string>) => void;
  };
}

export default function ProjectMetadataSettings({ form }: ProjectMetadataSettingsProps) {
  const [copiedQueryId, setCopiedQueryId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedQueryId(id);
    setTimeout(() => {
      setCopiedQueryId((current) => (current === id ? null : current));
    }, 2000);
  };

  const [copiedDescKey, setCopiedDescKey] = useState<string | null>(null);
  const [selectedRqKey, setSelectedRqKey] = useState<string>('');

  const copyDescToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedDescKey(key);
    setTimeout(() => {
      setCopiedDescKey((current) => (current === key ? null : current));
    }, 2000);
  };

  const rawQuestions = form.projectFormQuestions || '';
  const parsedQuestions = React.useMemo(() => {
    const rawLines = rawQuestions.split('\n').map((l) => l.trim()).filter(Boolean);
    return rawLines.map((line) => {
      const match = line.match(/^(rq\s*\d+[a-z]?|\d+[\.\)]|[a-z0-9_-]+)(?:\s*[:\.-]\s*|\s+)(.*)/i);
      if (match) {
        const key = match[1].replace(/\s+/g, '').toUpperCase();
        return { key, label: line, rawTitle: match[2]?.trim() || line };
      }
      return { key: line.substring(0, 15).toUpperCase().replace(/[^A-Z0-9]/g, '_'), label: line, rawTitle: line };
    });
  }, [rawQuestions]);

  const activeRq = parsedQuestions.find((q) => q.key === selectedRqKey) || parsedQuestions[0] || null;
  const activeRqKey = activeRq?.key || '';
  const activeDesc = activeRq
    ? form.projectFormResearchQuestionDescriptions?.[activeRq.key] || form.projectFormResearchQuestionDescriptions?.[activeRq.label] || ''
    : '';

  const configuredCount = parsedQuestions.filter((rq) => {
    const desc = form.projectFormResearchQuestionDescriptions?.[rq.key] || form.projectFormResearchQuestionDescriptions?.[rq.label] || '';
    return desc && desc.trim().length > 0;
  }).length;

  const searchQueries = form.projectFormSearchQueries || [];

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
            <span className="text-[9px] font-mono font-bold text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
              {searchQueries.length} {searchQueries.length === 1 ? 'Database' : 'Databases'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => form.handleAddSearchQuery?.()}
            className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/90 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Database Query
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Document the exact search strings and database documentation used for literature harvest across academic sources (e.g. Scopus, Web of Science, IEEE Xplore, PubMed).
        </p>

        {/* Dynamic List of Search Queries */}
        {searchQueries.length > 0 ? (
          <div className="space-y-3 pt-1">
            {searchQueries.map((sq, idx) => {
              const queryKey = sq.id || `query-${idx}`;
              const isCopied = copiedQueryId === queryKey;
              const isStandardDb = STANDARD_DATABASES.includes(sq.source) && sq.source !== 'Other';
              const selectValue = isStandardDb ? sq.source : 'Other';

              return (
                <div key={queryKey} className="p-3.5 bg-background/80 border border-border/70 rounded-xl space-y-3 shadow-sm hover:border-border transition-all">
                  {/* Top Bar: Database Selector & Actions */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <span className="flex items-center justify-center w-5 h-5 rounded-md bg-secondary/80 text-[10px] font-mono font-bold text-muted-foreground border border-border/60 shrink-0">
                        #{idx + 1}
                      </span>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-[420px]">
                        <div className="relative flex-1">
                          <select
                            value={selectValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'Other') {
                                if (isStandardDb) {
                                  form.handleUpdateSearchQuery?.(idx, 'source', 'Custom Database');
                                }
                              } else {
                                form.handleUpdateSearchQuery?.(idx, 'source', val);
                              }
                            }}
                            className="w-full bg-secondary/50 border border-border/80 rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary cursor-pointer"
                          >
                            {STANDARD_DATABASES.map((dbName) => (
                              <option key={dbName} value={dbName}>
                                {dbName === 'Other' ? 'Other / Custom...' : dbName}
                              </option>
                            ))}
                          </select>
                        </div>

                        {!isStandardDb && (
                          <input
                            type="text"
                            placeholder="Enter custom database name..."
                            value={sq.source}
                            onChange={(e) => form.handleUpdateSearchQuery?.(idx, 'source', e.target.value)}
                            className="flex-1 px-2.5 py-1.5 text-xs bg-secondary/40 border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary font-semibold"
                          />
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {sq.query && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(sq.query, queryKey)}
                          className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20"
                          title="Copy search query string"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => form.handleRemoveSearchQuery?.(idx)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                        title="Remove database search query"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Search Query Expression Textarea */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      Search Expression / Query String
                    </label>
                    <textarea
                      rows={3}
                      value={sq.query}
                      onChange={(e) => form.handleUpdateSearchQuery?.(idx, 'query', e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono shadow-inner leading-relaxed resize-y"
                      placeholder={`TITLE-ABS-KEY ( ( "systematic literature review" OR "slr" ) AND ( "artificial intelligence" ) )`}
                    />
                  </div>

                  {/* Documentation Notes / Filter details */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                      Documentation Notes &amp; Filters (Optional)
                    </label>
                    <input
                      type="text"
                      value={sq.description || ''}
                      onChange={(e) => form.handleUpdateSearchQuery?.(idx, 'description', e.target.value)}
                      placeholder="e.g. Searched on 2026-05-12, filters: Years 2018-2026, English only, Article and Conference papers"
                      className="w-full px-2.5 py-1.5 text-[11px] bg-secondary/30 border border-border/60 rounded-lg text-muted-foreground focus:text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="p-6 bg-background/50 border border-dashed border-border/80 rounded-xl text-center space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-foreground">No Search Queries Documented</h5>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Add search queries to record database search strings for your literature review protocol.
              </p>
            </div>
            <button
              type="button"
              onClick={() => form.handleAddSearchQuery?.()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Database Query
            </button>
          </div>
        )}

        {/* Quick Add Preset Chips */}
        <div className="pt-2 border-t border-border/30 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            Quick Add Database Preset:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['Scopus', 'Web of Science', 'IEEE Xplore', 'PubMed', 'Google Scholar'].map((dbPreset) => (
              <button
                key={dbPreset}
                type="button"
                onClick={() => form.handleAddSearchQuery?.(dbPreset)}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary/60 hover:bg-secondary text-foreground hover:text-primary border border-border/60 transition-colors cursor-pointer"
              >
                + {dbPreset}
              </button>
            ))}
          </div>
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
        <div className="bg-secondary/20 border border-border/70 rounded-xl p-3.5 space-y-3.5 mt-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Code className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                Research Question Jinja2 Variable Descriptions
              </span>
            </div>
            {parsedQuestions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/80 border border-border/60">
                  {parsedQuestions.length} {parsedQuestions.length === 1 ? 'Question' : 'Questions'}
                </span>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                  configuredCount === parsedQuestions.length && parsedQuestions.length > 0
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                    : configuredCount > 0
                    ? 'text-primary bg-primary/10 border-primary/20'
                    : 'text-muted-foreground bg-secondary/60 border-border/60'
                }`}>
                  {configuredCount}/{parsedQuestions.length} Configured
                </span>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground leading-normal">
            Descriptions mapped here feed the <code className="font-mono text-[9px] bg-secondary/80 px-1 py-0.5 rounded">{"{{ target_variable_description }}"}</code> (and <code className="font-mono text-[9px] bg-secondary/80 px-1 py-0.5 rounded">{"{{ umbrellanizer_target_research_question_description }}"}</code>) Jinja2 context variable during LLM synthesis.
          </p>

          {parsedQuestions.length === 0 ? (
            <div className="p-4 bg-background/50 border border-dashed border-border/80 rounded-lg text-center space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">
                No Research Questions defined yet
              </p>
              <p className="text-[10px] text-muted-foreground">
                Enter your research questions (e.g. <code className="font-mono text-[9px] bg-secondary/80 px-1 py-0.5 rounded">RQ1: What ML architectures are used?</code>) in the Research Questions box above to unlock Jinja2 variable descriptions.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Dropdown Selector & Quick Switch Chips */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                    Select Target Research Question (RQ)
                  </label>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Dropdown &amp; quick chips
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={activeRqKey}
                    onChange={(e) => setSelectedRqKey(e.target.value)}
                    className="w-full bg-background/90 border border-border/80 rounded-lg px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary cursor-pointer shadow-inner"
                  >
                    {parsedQuestions.map((rq) => {
                      const desc = form.projectFormResearchQuestionDescriptions?.[rq.key] || form.projectFormResearchQuestionDescriptions?.[rq.label] || '';
                      const isConfigured = Boolean(desc && desc.trim().length > 0);
                      return (
                        <option key={rq.key} value={rq.key}>
                          [{rq.key}] {rq.label.length > 70 ? rq.label.substring(0, 70) + '...' : rq.label} {isConfigured ? '✓ (Configured)' : '(Empty)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Quick Selection Chips if multiple RQs */}
                {parsedQuestions.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[9px] font-semibold text-muted-foreground mr-1">Quick Select:</span>
                    {parsedQuestions.map((rq) => {
                      const isActive = rq.key === activeRqKey;
                      const desc = form.projectFormResearchQuestionDescriptions?.[rq.key] || form.projectFormResearchQuestionDescriptions?.[rq.label] || '';
                      const isConfigured = Boolean(desc && desc.trim().length > 0);
                      return (
                        <button
                          key={rq.key}
                          type="button"
                          onClick={() => setSelectedRqKey(rq.key)}
                          className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer border ${
                            isActive
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/30'
                              : 'bg-background/70 hover:bg-secondary/80 text-muted-foreground hover:text-foreground border-border/70'
                          }`}
                        >
                          <span>{rq.key}</span>
                          {isConfigured && (
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active RQ Details Card & Multiline Fulltext Textarea */}
              {activeRq && (
                <div className="p-3 bg-background/80 border border-border/70 rounded-xl space-y-2.5 shadow-sm">
                  {/* RQ Info Banner */}
                  <div className="flex items-start justify-between gap-2 p-2.5 bg-secondary/30 rounded-lg border border-border/50">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary text-xs font-black px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                          {activeRq.key}
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                          activeDesc.trim().length > 0
                            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
                        }`}>
                          {activeDesc.trim().length > 0 ? 'Description Configured' : 'Empty Description'}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground font-medium pt-0.5 leading-snug">
                        {activeRq.label}
                      </p>
                    </div>

                    {activeDesc.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => copyDescToClipboard(activeDesc, activeRq.key)}
                        className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer bg-primary/10 px-2 py-1 rounded-md border border-primary/20 shrink-0"
                        title="Copy current description"
                      >
                        {copiedDescKey === activeRq.key ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {copiedDescKey === activeRq.key ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>

                  {/* Fulltext Multiline Textarea */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Research Question Scope &amp; Context Description (Multiline Fulltext)
                      </label>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {activeDesc.length} chars • {activeDesc ? activeDesc.split('\n').length : 0} {activeDesc && activeDesc.split('\n').length === 1 ? 'line' : 'lines'}
                      </span>
                    </div>

                    <textarea
                      rows={5}
                      value={activeDesc}
                      onChange={(e) => {
                        const val = e.target.value;
                        const nextDescs = {
                          ...(form.projectFormResearchQuestionDescriptions || {}),
                          [activeRq.key]: val,
                          [activeRq.label]: val
                        };
                        form.setProjectFormResearchQuestionDescriptions?.(nextDescs);
                      }}
                      placeholder={`Enter comprehensive multiline description for ${activeRq.key}...\n\nExample:\n- Scope & Focus: Identify deep learning models used for anomaly detection.\n- Inclusion bounds: Supervised, semi-supervised, and self-supervised architectures.\n- Exclude: Non-deep ML models or pure statistical heuristics.`}
                      className="w-full px-3 py-2 text-xs bg-background border border-border/80 rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium shadow-inner leading-relaxed resize-y min-h-[110px]"
                    />
                  </div>

                  {/* Footer Helpers */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      Multiline descriptions will be injected as fulltext context into prompt templates during LLM execution.
                    </span>
                    {activeDesc.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextDescs = {
                            ...(form.projectFormResearchQuestionDescriptions || {}),
                            [activeRq.key]: '',
                            [activeRq.label]: ''
                          };
                          form.setProjectFormResearchQuestionDescriptions?.(nextDescs);
                        }}
                        className="text-[10px] text-destructive hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear description
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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
