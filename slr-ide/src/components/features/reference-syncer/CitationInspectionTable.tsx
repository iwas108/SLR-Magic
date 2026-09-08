import React, { useState } from 'react';
import { 
  Check, 
  X, 
  ArrowRight, 
  ChevronDown, 
  ChevronRight, 
  Edit3, 
  AlertTriangle, 
  FileCode2, 
  ExternalLink,
  BookOpen,
  User,
  RotateCcw
} from 'lucide-react';
import type { CitationOccurrence, CitationStatus } from '@/lib/services/reference-syncer-types';
import { formatAuthorEtAl } from '@/lib/services/reference-syncer-types';

interface CitationInspectionTableProps {
  citations: CitationOccurrence[];
  fileName: string;
  onSetOverride: (fileName: string, originalKey: string, newTargetKey: string) => void;
  onResetOverride?: (fileName: string, originalKey: string) => void;
  onToggleIgnore: (fileName: string, originalKey: string) => void;
}

export default function CitationInspectionTable({
  citations,
  fileName,
  onSetOverride,
  onResetOverride,
  onToggleIgnore
}: CitationInspectionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingCitationId, setEditingCitationId] = useState<string | null>(null);
  const [customKeyInput, setCustomKeyInput] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const startEditing = (citation: CitationOccurrence) => {
    setEditingCitationId(citation.id);
    setCustomKeyInput(citation.userOverride || citation.replacementKey || citation.originalKey);
  };

  const handleReset = (originalKey: string) => {
    if (onResetOverride) {
      onResetOverride(fileName, originalKey);
    } else {
      onSetOverride(fileName, originalKey, '');
    }
  };

  const applyCustomEdit = (originalKey: string) => {
    const trimmed = customKeyInput.trim();
    if (trimmed) {
      onSetOverride(fileName, originalKey, trimmed);
    } else {
      handleReset(originalKey);
    }
    setEditingCitationId(null);
  };

  const getStatusBadge = (status: CitationStatus, isIgnored?: boolean) => {
    if (isIgnored) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground border border-border">
          IGNORED
        </span>
      );
    }
    switch (status) {
      case 'EXACT_MATCH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            VALID
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            RESOLVED
          </span>
        );
      case 'AMBIGUOUS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            AMBIGUOUS
          </span>
        );
      case 'MISSING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            MISSING
          </span>
        );
      case 'SUSPICIOUS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
            SUSPICIOUS
          </span>
        );
      default:
        return null;
    }
  };

  const getFormatBadge = (formatType: CitationOccurrence['formatType']) => {
    switch (formatType) {
      case 'SLR_PAPER_ID':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            SLR Paper_ID
          </span>
        );
      case 'AUTHOR_YEAR':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            AuthorYear
          </span>
        );
      case 'TITLE_FORMAT':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            Title Format
          </span>
        );
      case 'EXACT_BIB':
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Exact Bib
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-secondary text-muted-foreground border border-border">
            Unknown
          </span>
        );
    }
  };

  if (citations.length === 0) {
    return (
      <div className="p-8 text-center bg-card rounded-xl border border-border text-muted-foreground">
        <FileCode2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No citations match the selected filter or search query.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold">
              <th className="py-2.5 px-3 w-8"></th>
              <th className="py-2.5 px-3 w-16">Line</th>
              <th className="py-2.5 px-3 w-28">Status</th>
              <th className="py-2.5 px-3">Original Citation Key</th>
              <th className="py-2.5 px-3 w-8 text-center"></th>
              <th className="py-2.5 px-3 min-w-[320px]">Target Replacement Key</th>
              <th className="py-2.5 px-3 w-48">Resolution Logic</th>
              <th className="py-2.5 px-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {citations.map((c) => {
              const isExpanded = expandedId === c.id;
              const isEditing = editingCitationId === c.id;
              const effectiveTargetKey = c.userOverride || c.replacementKey;
              const hasChange = effectiveTargetKey && effectiveTargetKey !== c.originalKey && !c.isIgnored;

              return (
                <React.Fragment key={c.id}>
                  <tr className={`hover:bg-secondary/30 transition-colors ${isExpanded ? 'bg-secondary/20' : ''}`}>
                    {/* Expand Toggle */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => toggleExpand(c.id)}
                        className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Toggle context preview"
                      >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    </td>

                    {/* Line number */}
                    <td className="py-2 px-3 font-mono text-muted-foreground text-[11px]">
                      L{c.lineNumber}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {getStatusBadge(c.status, c.isIgnored)}
                    </td>

                    {/* Original Key */}
                    <td className="py-2 px-3">
                      <div className="flex flex-col gap-1 max-w-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <code className={`px-1.5 py-0.5 rounded text-[11px] font-mono truncate max-w-xs ${
                            c.status === 'MISSING' 
                              ? 'bg-rose-500/10 text-rose-500 line-through' 
                              : hasChange 
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                              : 'bg-secondary text-foreground'
                          }`} title={c.originalKey}>
                            \{c.command}{c.optArgs || ''}{`{${c.originalKey}}`}
                          </code>
                          {getFormatBadge(c.formatType)}
                        </div>
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="py-2 px-1 text-center text-muted-foreground">
                      {hasChange ? <ArrowRight className="w-3.5 h-3.5 text-primary inline" /> : '—'}
                    </td>

                    {/* Target Replacement Key */}
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={customKeyInput}
                            onChange={(e) => setCustomKeyInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') applyCustomEdit(c.originalKey);
                              if (e.key === 'Escape') setEditingCitationId(null);
                            }}
                            className="bg-background border border-primary rounded px-2 py-1 text-xs font-mono w-48 focus:outline-none"
                            placeholder="Enter replacement key"
                            autoFocus
                          />
                          <button
                            onClick={() => applyCustomEdit(c.originalKey)}
                            className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded cursor-pointer"
                            title="Save replacement key (Enter)"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          {c.userOverride && (
                            <button
                              onClick={() => {
                                handleReset(c.originalKey);
                                setEditingCitationId(null);
                              }}
                              className="p-1 text-amber-500 hover:bg-amber-500/20 rounded cursor-pointer"
                              title="Reset to default suggestion"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setEditingCitationId(null)}
                            className="p-1 text-muted-foreground hover:bg-secondary rounded cursor-pointer"
                            title="Cancel (Esc)"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : c.candidates && c.candidates.length > 1 ? (
                        <div className="flex flex-col gap-1.5 w-full max-w-md py-0.5">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={effectiveTargetKey || ''}
                              onChange={(e) => onSetOverride(fileName, c.originalKey, e.target.value)}
                              className="bg-background border border-amber-500/50 hover:border-amber-500 rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 w-full cursor-pointer shadow-sm transition-colors"
                            >
                              {/* If user entered a custom override not in candidate list, show it prominently */}
                              {c.userOverride && !c.candidates.includes(c.userOverride) && (
                                <option value={c.userOverride}>
                                  ★ Custom Override: {c.userOverride}
                                </option>
                              )}
                              <option value="" disabled>Select Candidate Paper ({c.candidates.length} matches)...</option>
                              {c.candidates.map((candKey) => {
                                const detail = c.candidateDetails?.find(d => d.key === candKey);
                                const author = detail?.author ? formatAuthorEtAl(detail.author) : '';
                                const year = detail?.year ? `(${detail.year})` : '';
                                const title = detail?.title ? `— "${detail.title.length > 55 ? detail.title.slice(0, 55) + '...' : detail.title}"` : '';
                                const optionText = detail 
                                  ? `${candKey} [${author} ${year}] ${title}`.trim()
                                  : candKey;
                                return (
                                  <option 
                                    key={candKey} 
                                    value={candKey} 
                                    title={detail ? `${candKey}\nAuthor: ${detail.author} (${detail.year})\nTitle: ${detail.title}` : candKey}
                                  >
                                    {optionText}
                                  </option>
                                );
                              })}
                            </select>
                            {c.userOverride && (
                              <button
                                onClick={() => handleReset(c.originalKey)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded cursor-pointer transition-colors"
                                title="Reset override back to default"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Custom Override Indicator if not in candidates */}
                          {c.userOverride && !c.candidates.includes(c.userOverride) && (
                            <div className="flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded">
                              <span className="font-semibold uppercase tracking-wider text-[9px]">Custom Override:</span>
                              <code className="font-mono font-bold">{c.userOverride}</code>
                              <button
                                onClick={() => handleReset(c.originalKey)}
                                className="ml-auto text-[9px] underline hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer font-medium"
                              >
                                Revert to Candidates
                              </button>
                            </div>
                          )}

                          {/* Selected Candidate Metadata Preview Card */}
                          {(() => {
                            const activeDetail = c.candidateDetails?.find(d => d.key === effectiveTargetKey);
                            if (activeDetail) {
                              return (
                                <div className="text-[11px] bg-amber-500/10 border border-amber-500/25 rounded-md p-2 space-y-1 max-w-md shadow-sm">
                                  <div className="font-semibold text-foreground line-clamp-2 leading-snug" title={activeDetail.title}>
                                    {activeDetail.title || 'Untitled Paper'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-foreground/85 flex items-center gap-1">
                                      <User className="w-2.5 h-2.5 text-muted-foreground" />
                                      {activeDetail.author || 'Unknown Author'}
                                    </span>
                                    {activeDetail.year && <span>• ({activeDetail.year})</span>}
                                    {activeDetail.doi && (
                                      <span className="text-[9px] text-primary font-mono truncate max-w-[180px]">
                                        DOI: {activeDetail.doi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : effectiveTargetKey ? (
                        <div className="flex flex-col gap-0.5 max-w-sm">
                          <div className="flex items-center gap-1.5">
                            <code className={`px-1.5 py-0.5 rounded text-[11px] font-mono truncate max-w-xs ${
                              c.userOverride 
                                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/30'
                                : hasChange 
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold' 
                                : 'text-muted-foreground'
                            }`} title={effectiveTargetKey}>
                              {effectiveTargetKey}
                            </code>
                            {c.userOverride && (
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] text-purple-500 font-semibold uppercase px-1 py-0.2 rounded bg-purple-500/10 border border-purple-500/20">
                                  Override
                                </span>
                                <button
                                  onClick={() => handleReset(c.originalKey)}
                                  className="p-0.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer transition-colors"
                                  title="Reset override to default"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Show target paper title & author preview if available */}
                          {c.targetMetadata?.title && (
                            <div className="text-[10px] text-muted-foreground line-clamp-1 max-w-xs mt-0.5" title={`${c.targetMetadata.author} (${c.targetMetadata.year})\n${c.targetMetadata.title}`}>
                              <span className="font-medium text-foreground/75">{formatAuthorEtAl(c.targetMetadata.author)}</span>
                              {c.targetMetadata.year && ` (${c.targetMetadata.year})`}: &ldquo;{c.targetMetadata.title}&rdquo;
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px] italic">
                          No replacement found
                        </span>
                      )}
                    </td>

                    {/* Resolution Logic / Match reason */}
                    <td className="py-2 px-3 text-muted-foreground text-[11px]">
                      <div className="truncate max-w-xs" title={c.matchReason}>
                        {c.matchReason}
                      </div>
                      {c.confidence > 0 && c.confidence < 1 && (
                        <div className="text-[9px] text-muted-foreground/80 mt-0.5">
                          Confidence: {(c.confidence * 100).toFixed(0)}%
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEditing(c)}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded cursor-pointer transition-colors"
                          title="Custom Override Key"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onToggleIgnore(fileName, c.originalKey)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                            c.isIgnored
                              ? 'bg-secondary text-muted-foreground border-border hover:bg-secondary/80'
                              : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                          }`}
                          title={c.isIgnored ? 'Include in replacement' : 'Ignore this replacement'}
                        >
                          {c.isIgnored ? 'Restore' : 'Ignore'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expandable Context Preview */}
                  {isExpanded && (
                    <tr className="bg-secondary/15 border-b border-border/40">
                      <td colSpan={8} className="p-3 pl-12">
                        <div className="p-2.5 rounded-lg bg-background border border-border space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-semibold">Context Snippet (Line {c.lineNumber}):</span>
                            <span>File: <code className="font-mono">{fileName}</code></span>
                          </div>
                          <div className="font-mono text-xs text-foreground/90 p-2 bg-secondary/30 rounded border border-border/40 whitespace-pre-wrap leading-relaxed">
                            {c.contextSnippet.split(c.originalKey).map((part, pIdx, arr) => (
                              <React.Fragment key={pIdx}>
                                {part}
                                {pIdx < arr.length - 1 && (
                                  <span className={`px-1 py-0.5 rounded font-bold ${
                                    c.status === 'EXACT_MATCH'
                                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                      : hasChange
                                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                      : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                  }`}>
                                    {c.originalKey}
                                    {hasChange && (
                                      <span className="text-emerald-500 ml-1">
                                        → {effectiveTargetKey}
                                      </span>
                                    )}
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* Dedicated Candidate Paper Review Cards when multiple candidates exist */}
                          {c.candidateDetails && c.candidateDetails.length > 1 && (
                            <div className="mt-3 pt-2.5 border-t border-border/60 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                                  Available Candidate Papers ({c.candidateDetails.length}):
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Click any paper card or button to select it as the target citation key
                                </span>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {c.candidateDetails.map((cand) => {
                                  const isSelected = effectiveTargetKey === cand.key;
                                  return (
                                    <div
                                      key={cand.key}
                                      onClick={() => onSetOverride(fileName, c.originalKey, cand.key)}
                                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                                        isSelected
                                          ? 'bg-amber-500/10 border-amber-500/60 shadow-sm'
                                          : 'bg-background hover:bg-secondary/40 border-border'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1 flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <code className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                              isSelected ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-secondary text-foreground'
                                            }`}>
                                              {cand.key}
                                            </code>
                                            {isSelected && (
                                              <span className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                                                Active Selection
                                              </span>
                                            )}
                                          </div>
                                          <div className="text-xs font-semibold text-foreground leading-snug">
                                            {cand.title || 'Untitled Paper'}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-foreground/80 flex items-center gap-1">
                                              <User className="w-3 h-3 text-muted-foreground" />
                                              {cand.author || 'Unknown Author'}
                                            </span>
                                            {cand.year && <span>• ({cand.year})</span>}
                                            {cand.doi && (
                                              <span className="font-mono text-[10px] text-primary/90">
                                                DOI: {cand.doi}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors mt-0.5 cursor-pointer ${
                                            isSelected
                                              ? 'bg-amber-500 text-white shadow-sm'
                                              : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                                          }`}
                                        >
                                          {isSelected ? '✓ Selected' : 'Select Paper'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {c.suspiciousFlags && c.suspiciousFlags.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-500 pt-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Flags: {c.suspiciousFlags.join(' • ')}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
