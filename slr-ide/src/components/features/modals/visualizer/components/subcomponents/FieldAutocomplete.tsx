'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  ChevronDown, 
  X, 
  Check, 
  Tag, 
  Layers, 
  Award, 
  FileText, 
  Sparkles,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { 
  DiscoveredVariable, 
  VariableCategory, 
  formatVariableDisplayName,
  extractRqCode,
  CUSTOM_GROUPING_KEY 
} from '@/lib/services/cohort-data-source';

export interface FieldAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  discoveredVariables?: DiscoveredVariable[];
  availableFields?: string[];
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md';
  filterCategories?: VariableCategory[];
  showPrevalence?: boolean;
  showIntegrityWarning?: boolean;
  disabled?: boolean;
}

export function FieldAutocomplete({
  value,
  onChange,
  discoveredVariables = [],
  availableFields = [],
  placeholder = 'Search or select variable...',
  className = '',
  size = 'md',
  filterCategories,
  showPrevalence = true,
  showIntegrityWarning = true,
  disabled = false
}: FieldAutocompleteProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Synthesize candidate variables if discoveredVariables is empty
  const variableList = useMemo((): DiscoveredVariable[] => {
    if (discoveredVariables && discoveredVariables.length > 0) {
      if (filterCategories && filterCategories.length > 0) {
        return discoveredVariables.filter(v => filterCategories.includes(v.category));
      }
      return discoveredVariables;
    }

    // Fallback synthesis from availableFields string array
    return availableFields.map(f => {
      let category: VariableCategory = 'metadata';
      if (f === CUSTOM_GROUPING_KEY) category = 'custom_group';
      else if (f.startsWith('ext:macro:') || f.startsWith('ext:sub:') || f.startsWith('ext:leaf:')) category = 'taxonomy';
      else if (f.startsWith('ext:') || f.startsWith('raw:ext:') || f.startsWith('raw:leaf:')) category = 'extracted';
      else if (f.startsWith('qa:') || f === 'Overall_QA') category = 'qa';

      const rawKey = f.replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '').replace(/^raw:(leaf:|tail:)?ext:/, '');
      const rqCode = extractRqCode(f);

      return {
        key: f,
        rawKey,
        rqCode,
        displayName: formatVariableDisplayName(f),
        category,
        dataType: 'categorical',
        positivePaperCount: 0,
        totalCohortCount: 0,
        prevalencePct: 0,
        sampleValues: []
      };
    });
  }, [discoveredVariables, availableFields, filterCategories]);

  // Current active variable object
  const activeVariable = useMemo(() => {
    return variableList.find(v => v.key === value || v.rawKey === value);
  }, [variableList, value]);

  // Filtered list based on search query
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return variableList;
    const q = searchQuery.toLowerCase().trim();
    return variableList.filter(v => {
      return (
        v.key.toLowerCase().includes(q) ||
        v.rawKey.toLowerCase().includes(q) ||
        (v.rqCode && v.rqCode.toLowerCase().includes(q)) ||
        v.displayName.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.sampleValues.some(s => s.toLowerCase().includes(q))
      );
    });
  }, [variableList, searchQuery]);

  // Group filtered variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<VariableCategory, DiscoveredVariable[]> = {
      taxonomy_category: [],
      taxonomy: [],
      extracted: [],
      qa: [],
      metadata: [],
      custom_group: []
    };

    filteredList.forEach(v => {
      groups[v.category]?.push(v);
    });

    return groups;
  }, [filteredList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Reset highlight index when query changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredList[highlightedIndex]) {
        handleSelect(filteredList[highlightedIndex].key);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      e.preventDefault();
    }
  };

  const handleSelect = (key: string) => {
    onChange(key);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  const getCategoryIcon = (category: VariableCategory) => {
    switch (category) {
      case 'taxonomy_category':
        return <Layers className="w-3.5 h-3.5 text-teal-500" />;
      case 'extracted':
        return <Tag className="w-3.5 h-3.5 text-blue-500" />;
      case 'taxonomy':
        return <Layers className="w-3.5 h-3.5 text-purple-500" />;
      case 'qa':
        return <Award className="w-3.5 h-3.5 text-amber-500" />;
      case 'custom_group':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
      case 'metadata':
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getCategoryLabel = (category: VariableCategory) => {
    switch (category) {
      case 'taxonomy_category':
        return 'Specific Taxonomy Categories (Macro / Sub)';
      case 'extracted':
        return 'Extracted Research Variables';
      case 'taxonomy':
        return '3-Tier Taxonomy (Macro / Sub / Leaf)';
      case 'qa':
        return 'Quality Appraisal (QA) Scores';
      case 'custom_group':
        return 'Custom Grouping Layer';
      case 'metadata':
      default:
        return 'Bibliographic Metadata';
    }
  };

  const displayValue = isOpen 
    ? searchQuery 
    : (activeVariable ? activeVariable.displayName : formatVariableDisplayName(value || ''));

  const isZeroHits = activeVariable && activeVariable.positivePaperCount === 0 && activeVariable.totalCohortCount > 0 && value !== '';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Searchable Input Bar */}
      <div 
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`flex items-center gap-2 bg-card border rounded-xl transition-all cursor-text shadow-xs ${
          isOpen 
            ? 'border-primary ring-2 ring-primary/20 bg-background' 
            : 'border-border hover:border-primary/40'
        } ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-2 text-xs'} ${
          disabled ? 'opacity-50 cursor-not-allowed bg-secondary/30' : ''
        }`}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? searchQuery : displayValue}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
          onKeyDown={handleKeyDown}
          placeholder={value ? displayValue : placeholder}
          className="flex-1 bg-transparent border-none outline-none text-foreground font-bold text-xs placeholder:text-muted-foreground/60 min-w-0"
        />

        {/* Selected RQ Badge */}
        {!isOpen && activeVariable?.rqCode && (
          <span className="px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9.5px] font-mono font-black shrink-0">
            {activeVariable.rqCode}
          </span>
        )}

        {/* Live Prevalence Badge on Selected Item */}
        {!isOpen && activeVariable && showPrevalence && activeVariable.totalCohortCount > 0 && (
          <span 
            className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold shrink-0 font-mono ${
              activeVariable.positivePaperCount > 0
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            {activeVariable.positivePaperCount}/{activeVariable.totalCohortCount} ({activeVariable.prevalencePct}%)
          </span>
        )}

        {/* Clear Button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            title="Clear Selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Zero Hits Scientific Integrity Warning */}
      {showIntegrityWarning && isZeroHits && !isOpen && (
        <div className="mt-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[10.5px] font-bold flex items-center justify-between gap-1.5 shadow-xs">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            <span className="truncate">Key has 0 hits in active cohort (N={activeVariable.totalCohortCount})</span>
          </div>
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          ref={listRef}
          className="absolute left-0 top-full mt-1.5 z-[100] bg-card/95 border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[380px] flex flex-col backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 w-full min-w-[300px] sm:min-w-[390px] max-w-[480px]"
        >
          {/* Header Stats */}
          <div className="px-3 py-1.5 bg-secondary/70 border-b border-border/80 text-[10px] font-extrabold uppercase text-muted-foreground flex items-center justify-between shrink-0">
            <span>Discovered Variables ({filteredList.length})</span>
            <span className="font-mono text-[9px] text-muted-foreground/70">Hover for Details</span>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-2 divide-y divide-border/40 max-h-[190px]">
            {filteredList.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                <Search className="w-5 h-5 mx-auto text-muted-foreground/40 mb-1" />
                <span className="font-bold block">No variables match "{searchQuery}"</span>
                <span className="text-[10px] block">Try searching by topic, RQ code (e.g. RQ1), or keyword</span>
              </div>
            ) : (
              (Object.entries(groupedVariables) as [VariableCategory, DiscoveredVariable[]][]).map(([cat, items]) => {
                if (!items || items.length === 0) return null;

                return (
                  <div key={cat} className="pt-1.5 first:pt-0 space-y-1">
                    <div className="px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                      {getCategoryIcon(cat)}
                      <span>{getCategoryLabel(cat)}</span>
                    </div>

                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const isSelected = item.key === value || item.rawKey === value;
                        const isHighlighted = filteredList.indexOf(item) === highlightedIndex;

                        return (
                          <div
                            key={item.key}
                            title={`${item.displayName}\nKey: ${item.key}\nPrevalence: ${item.positivePaperCount}/${item.totalCohortCount} (${item.prevalencePct}% of cohort)\nSamples: ${item.sampleValues.join(', ') || 'N/A'}`}
                            onClick={() => handleSelect(item.key)}
                            onMouseEnter={() => setHighlightedIndex(filteredList.indexOf(item))}
                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between gap-1.5 ${
                              isSelected 
                                ? 'bg-primary text-primary-foreground font-bold shadow-xs' 
                                : isHighlighted 
                                ? 'bg-secondary text-foreground' 
                                : 'hover:bg-secondary/60 text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                item.positivePaperCount > 0 
                                  ? (isSelected ? 'bg-primary-foreground' : 'bg-blue-500') 
                                  : 'bg-muted-foreground/40'
                              }`} />

                              {/* RQ Code Badge Chip */}
                              {item.rqCode && (
                                <span className={`px-1.5 py-0.2 rounded font-mono font-black text-[9px] shrink-0 border ${
                                  isSelected 
                                    ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30'
                                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                }`}>
                                  {item.rqCode}
                                </span>
                              )}

                              <div className="truncate min-w-0 flex-1">
                                <span className="truncate block leading-tight text-[11px]">{item.displayName}</span>
                                {item.sampleValues.length > 0 && (
                                  <span className={`text-[9.5px] block truncate font-normal ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                    e.g., {item.sampleValues.slice(0, 3).join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Prevalence Pill */}
                            {showPrevalence && item.totalCohortCount > 0 && (
                              <span 
                                className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-extrabold shrink-0 font-mono ${
                                  isSelected 
                                    ? 'bg-primary-foreground/20 text-primary-foreground' 
                                    : item.positivePaperCount > 0 
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                                    : 'bg-muted/50 text-muted-foreground border border-border/50'
                                }`}
                              >
                                {item.positivePaperCount}/{item.totalCohortCount} ({item.prevalencePct}%)
                              </span>
                            )}

                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Live Hover Inspection Drawer */}
          {filteredList[highlightedIndex] && (
            <div className="p-2 bg-secondary/90 border-t border-border/80 text-xs space-y-1 shrink-0 backdrop-blur-sm animate-in fade-in duration-75">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 font-extrabold text-foreground min-w-0 flex-1">
                  {filteredList[highlightedIndex].rqCode && (
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[9px] font-mono font-black shrink-0">
                      {filteredList[highlightedIndex].rqCode}
                    </span>
                  )}
                  <span className="truncate text-[11px] font-bold text-foreground">
                    {filteredList[highlightedIndex].displayName}
                  </span>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-black font-mono bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {filteredList[highlightedIndex].positivePaperCount}/{filteredList[highlightedIndex].totalCohortCount} ({filteredList[highlightedIndex].prevalencePct}%)
                </span>
              </div>

              {/* Key & Category Sub-bar */}
              <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground font-mono truncate">
                <span className="bg-background/90 px-1 py-0.2 rounded border border-border/60 truncate font-mono text-[9px] max-w-[200px]">
                  {filteredList[highlightedIndex].key}
                </span>
                <span className="shrink-0 text-muted-foreground/60">•</span>
                <span className="shrink-0 font-sans font-medium text-[9.5px] truncate">{getCategoryLabel(filteredList[highlightedIndex].category)}</span>
              </div>

              {/* All Sample Literature Values */}
              {filteredList[highlightedIndex].sampleValues.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex flex-wrap gap-1 max-h-[38px] overflow-y-auto">
                    {filteredList[highlightedIndex].sampleValues.map((s, sIdx) => (
                      <span key={sIdx} className="px-1.5 py-0.2 rounded bg-background border border-border/60 text-[9px] text-foreground font-medium">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FieldAutocomplete;
