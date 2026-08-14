'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Sparkles, X, Copy, Download, Check, Search, Filter, FileText, BarChart2, ChevronDown, ChevronUp, Code2, Info, ShieldCheck, Calculator, PieChart } from 'lucide-react';
import { extractMappingReasoning, extractEvidenceQuote } from '@/lib/services/trace-normalizer';

interface LlmContextBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPapers: any[];
  filteredPapers: any[];
  umbrellanizerMap: Record<string, Record<string, string>>;
  projectId: string;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// Largest Remainder Method (Hare-Hamilton Quota) for exact 100.00% quota balancing
function calculateHareHamiltonPercentages(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  
  const exactPcts = counts.map(c => (c / total) * 100);
  const floorPcts = exactPcts.map(p => Math.floor(p * 100) / 100);
  const remainders = exactPcts.map((p, idx) => ({ remainder: p - floorPcts[idx], index: idx }));
  
  const currentSum = Math.round(floorPcts.reduce((a, b) => a + b, 0) * 100);
  const diffCent = 10000 - currentSum; // remaining 0.01% units
  
  remainders.sort((a, b) => b.remainder - a.remainder);
  const result = [...floorPcts];
  for (let i = 0; i < diffCent && i < remainders.length; i++) {
    const idx = remainders[i].index;
    result[idx] = Math.round((result[idx] + 0.01) * 100) / 100;
  }
  return result;
}

export default function LlmContextBuilderModal({
  isOpen,
  onClose,
  allPapers,
  filteredPapers,
  umbrellanizerMap,
  projectId,
  showToast
}: LlmContextBuilderModalProps) {
  // Scope selection: 'filtered' | 'full'
  const [scope, setScope] = useState<'filtered' | 'full'>('filtered');

  // Metadata field selections
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeAuthors, setIncludeAuthors] = useState(true);
  const [includeYear, setIncludeYear] = useState(true);
  const [includeDoi, setIncludeDoi] = useState(true);
  const [includeCitationStr, setIncludeCitationStr] = useState(true);
  const [includeQa, setIncludeQa] = useState(true);

  // Output value component inclusions
  const [includeRawValue, setIncludeRawValue] = useState(true);
  const [includeUmbrellanizedValue, setIncludeUmbrellanizedValue] = useState(true);
  const [includeTaxonomyJustification, setIncludeTaxonomyJustification] = useState(true);
  const [includeMappingReasoning, setIncludeMappingReasoning] = useState(true);
  const [includeEvidenceQuote, setIncludeEvidenceQuote] = useState(true);

  // Baked Statistics & LLM Directives selections
  const [includeBakedStats, setIncludeBakedStats] = useState(true);
  const [includeLlmDirectives, setIncludeLlmDirectives] = useState(true);
  const [includeCohortStats, setIncludeCohortStats] = useState(true);
  const [includeVariableDistributions, setIncludeVariableDistributions] = useState(true);
  const [includeCategoryPaperMappings, setIncludeCategoryPaperMappings] = useState(true);
  const [includeNotStatedMetrics, setIncludeNotStatedMetrics] = useState(true);
  const [includeRawTokenFrequencies, setIncludeRawTokenFrequencies] = useState(false);

  // Search filter for extracted keys
  const [keySearchTerm, setKeySearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  // Selected papers based on scope
  const targetPapers = useMemo(() => {
    return scope === 'filtered' ? filteredPapers : allPapers;
  }, [scope, filteredPapers, allPapers]);

  // Helper to extract stage-dominant extracted_data string
  const getExtractedDataStr = useCallback((paper: any): string => {
    const isNonEmpty = (str: any) => typeof str === 'string' && str.trim() !== '' && str.trim() !== '{}' && str.trim() !== '[]' && str.trim() !== 'null';
    const hasManual = isNonEmpty(paper.manual_extracted_data);
    const hasAi = isNonEmpty(paper.ai_extracted_data);
    if (hasManual && hasAi) {
      return (paper.manual_stage || 0) >= (paper.ai_stage || 0) ? paper.manual_extracted_data : paper.ai_extracted_data;
    }
    if (hasManual) return paper.manual_extracted_data;
    if (hasAi) return paper.ai_extracted_data;
    return '';
  }, []);

  // Discover all unique extracted data keys across all target papers
  const availableExtractedKeys = useMemo(() => {
    const keyCounts = new Map<string, number>();

    allPapers.forEach(p => {
      const extStr = getExtractedDataStr(p);
      if (!extStr) return;
      try {
        const parsed = JSON.parse(extStr);
        const extObj = parsed.extracted_data || parsed;
        Object.keys(extObj).forEach(k => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
          const val = extObj[k];
          if (val !== undefined && val !== null && val !== '') {
            keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
          }
        });
      } catch (e) {}
    });

    return Array.from(keyCounts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [allPapers, getExtractedDataStr]);

  // Selected Extracted Data Keys state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize selected keys ONCE when availableExtractedKeys is computed for the open modal
  React.useEffect(() => {
    if (isOpen && availableExtractedKeys.length > 0 && !isInitialized) {
      setSelectedKeys(new Set(availableExtractedKeys.map(k => k.key)));
      setIsInitialized(true);
    }
  }, [isOpen, availableExtractedKeys, isInitialized]);

  // Reset initialization status when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen]);

  // Filtered extracted keys based on search input
  const filteredExtractedKeys = useMemo(() => {
    if (!keySearchTerm.trim()) return availableExtractedKeys;
    const term = keySearchTerm.toLowerCase();
    return availableExtractedKeys.filter(item => item.key.toLowerCase().includes(term));
  }, [availableExtractedKeys, keySearchTerm]);

  // Select / Deselect All Handlers
  const handleSelectAllKeys = () => {
    setSelectedKeys(new Set(availableExtractedKeys.map(k => k.key)));
  };

  const handleClearAllKeys = () => {
    setSelectedKeys(new Set());
  };

  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Helper to resolve Umbrellanizer mapped value
  const resolveUmbrellanizerValue = useCallback((val: any, key: string) => {
    if (val === undefined || val === null || val === '') return '';
    const rawVal = String(val).trim();
    const raw = rawVal.toLowerCase().replace(/\s+/g, ' ');
    const map = umbrellanizerMap[key] || {};
    
    const matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === raw);
    if (!matchedKey) return rawVal;
    
    const mappedVal = map[matchedKey] as any;
    if (!mappedVal) return rawVal;
    
    if (typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
      return String(mappedVal.umbrella_category || matchedKey).trim();
    }
    if (Array.isArray(mappedVal)) {
      return String(mappedVal[0] || matchedKey).trim();
    }
    return String(mappedVal).trim();
  }, [umbrellanizerMap]);

  // Helper to resolve Umbrellanizer justification
  const getUmbrellanizerJustification = useCallback((key: string, paper: any) => {
    const extStr = getExtractedDataStr(paper);
    if (!extStr) return '';

    try {
      const parsed = JSON.parse(extStr);
      const extObj = parsed.extracted_data || parsed;
      let rawVal = extObj[key];
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
        rawVal = rawVal.value;
      }
      if (rawVal === undefined || rawVal === null || rawVal === '') return '';

      const map = umbrellanizerMap[key] || {};
      
      const resolveSingle = (singleRaw: any) => {
        const r = String(singleRaw).trim();
        const rNorm = r.toLowerCase().replace(/\s+/g, ' ');
        let matchedKey = Object.keys(map).find(k => k.trim().toLowerCase().replace(/\s+/g, ' ') === rNorm);
        
        if (!matchedKey) {
          matchedKey = Object.keys(map).find(k => {
            const mappedVal = map[k] as any;
            if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
              return String(mappedVal.umbrella_category || '').trim().toLowerCase().replace(/\s+/g, ' ') === rNorm;
            }
            return false;
          });
        }

        if (matchedKey) {
          const mappedVal = map[matchedKey] as any;
          if (mappedVal && typeof mappedVal === 'object' && !Array.isArray(mappedVal)) {
            return String(mappedVal.justification || '').trim();
          }
        }
        return '';
      };

      if (Array.isArray(rawVal)) {
        return rawVal.map(resolveSingle).filter(Boolean).join(' || ');
      }
      return resolveSingle(rawVal);
    } catch (e) {}
    return '';
  }, [umbrellanizerMap, getExtractedDataStr]);

  // Helper to parse logic traces and evidence quotes using Centralized Trace Normalizer Utility
  const parseExtractedTraces = useCallback((paper: any) => {
    const extStr = getExtractedDataStr(paper);

    if (!extStr) return { mapping: {}, evidence: {} };
    try {
      const parsed = JSON.parse(extStr);
      const extObj = parsed.extracted_data || parsed;
      const logicTrace = parsed.logic_trace || extObj.logic_trace || paper.logic_trace || {};
      const locateMapping = logicTrace.extraction_mapping || logicTrace || {};
      
      const mapping: Record<string, string> = {};
      const evidence: Record<string, string> = {};
      
      Object.keys(extObj).forEach(key => {
        if (key.startsWith('_') || key === 'logic_trace' || key === '_scientist_logic_trace') return;
        
        const valObj = extObj[key];
        mapping[key] = extractMappingReasoning(key, locateMapping, valObj);
        evidence[key] = extractEvidenceQuote(key, valObj);
      });
      
      return { mapping, evidence };
    } catch (e) {}
    return { mapping: {}, evidence: {} };
  }, [getExtractedDataStr]);

  // Helper to parse Quality Assessment score
  const parseQaAssessment = useCallback((paper: any) => {
    const isManualDominant = (paper.manual_stage || 0) >= (paper.ai_stage || 0);
    const qaStr = isManualDominant 
      ? (paper.manual_quality_assessment || paper.ai_quality_assessment || '') 
      : (paper.ai_quality_assessment || paper.manual_quality_assessment || '');

    if (!qaStr) return { score: 0, items: {} };
    try {
      const parsed = typeof qaStr === 'string' ? JSON.parse(qaStr) : qaStr;
      if (typeof parsed === 'object' && parsed !== null) {
        const qaObj = parsed.qa_scores || parsed;
        let score = 0;
        const items: Record<string, string> = {};

        Object.entries(qaObj).forEach(([k, v]) => {
          if (k.startsWith('_') || k === 'logic_trace' || k === '_scientist_logic_trace' || k === 'qa_scores') return;
          let rawVal: any = v;
          if (v !== null && v !== undefined && typeof v === 'object') {
            const vObj = v as any;
            if ('score' in vObj) rawVal = vObj.score;
            else if ('value' in vObj) rawVal = vObj.value;
          }
          const valStr = (rawVal !== undefined && rawVal !== null) ? String(rawVal) : '';
          items[k] = valStr;
          const numVal = parseFloat(valStr);
          if (!isNaN(numVal)) score += numVal;
          else if (rawVal === true || ['YES', 'PASS', 'TRUE'].includes(valStr.toUpperCase().trim())) score += 1;
        });
        return { score, items };
      }
    } catch (e) {
      const num = parseFloat(qaStr);
      if (!isNaN(num)) return { score: num, items: {} };
    }
    return { score: 0, items: {} };
  }, []);

  // Format citation string helper (e.g. "Author et al., 2024")
  const formatCitation = useCallback((authors: string, year: any) => {
    let authorShort = 'Unknown Author';
    if (authors && authors.trim()) {
      const parts = authors.split(/;|,| and /i).map(s => s.trim()).filter(Boolean);
      if (parts.length === 1) authorShort = parts[0];
      else if (parts.length === 2) authorShort = `${parts[0]} & ${parts[1]}`;
      else if (parts.length > 2) authorShort = `${parts[0]} et al.`;
    }
    const yearStr = year ? String(year).trim() : 'n.d.';
    return `${authorShort}, ${yearStr}`;
  }, []);

  // Calculate pre-computed Baked Statistics
  const bakedStatistics = useMemo(() => {
    if (!includeBakedStats || targetPapers.length === 0) return null;

    const statsObj: Record<string, any> = {};

    // 1. Cohort Metadata Statistics
    if (includeCohortStats) {
      const yearMap = new Map<string, number>();
      const authorMap = new Map<string, number>();
      const publisherMap = new Map<string, number>();
      const qaScores: number[] = [];
      const qaCriteriaCompliance: Record<string, number> = {};

      targetPapers.forEach(paper => {
        // Year
        const y = paper.Year ? String(paper.Year).trim() : 'Unspecified';
        yearMap.set(y, (yearMap.get(y) || 0) + 1);

        // Authors
        if (paper.Authors || paper.Author) {
          const authors = (paper.Authors || paper.Author).split(/;|,| and /i).map((s: string) => s.trim()).filter(Boolean);
          authors.forEach((auth: string) => {
            authorMap.set(auth, (authorMap.get(auth) || 0) + 1);
          });
        }

        // Publishers
        const pub = (paper.Publisher || paper.Original_Publisher || '').trim();
        if (pub) {
          publisherMap.set(pub, (publisherMap.get(pub) || 0) + 1);
        }

        // QA scores
        const { score, items } = parseQaAssessment(paper);
        qaScores.push(score);
        Object.entries(items).forEach(([k, v]) => {
          const num = parseFloat(v);
          const passed = !isNaN(num) ? num > 0 : ['YES', 'PASS', 'TRUE'].includes(String(v).toUpperCase().trim());
          if (passed) {
            qaCriteriaCompliance[k] = (qaCriteriaCompliance[k] || 0) + 1;
          }
        });
      });

      // Year distribution calculation with Hare-Hamilton quota balancing
      const sortedYears = Array.from(yearMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
      const yearCounts = sortedYears.map(item => item[1]);
      const yearPercentages = calculateHareHamiltonPercentages(yearCounts);
      const yearDistribution: Record<string, any> = {};
      sortedYears.forEach(([yr, cnt], idx) => {
        yearDistribution[yr] = {
          count: cnt,
          paper_prevalence_pct: yearPercentages[idx]
        };
      });

      // Top Authors (top 10)
      const topAuthors = Array.from(authorMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([author, count]) => ({
          author,
          paper_count: count,
          paper_prevalence_pct: Math.round((count / targetPapers.length) * 10000) / 100
        }));

      // Top Publishers (top 10)
      const topPublishers = Array.from(publisherMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([publisher, count]) => ({
          publisher,
          paper_count: count,
          paper_prevalence_pct: Math.round((count / targetPapers.length) * 10000) / 100
        }));

      // QA Summary Metrics
      const totalQa = qaScores.reduce((a, b) => a + b, 0);
      const meanQa = qaScores.length > 0 ? Math.round((totalQa / qaScores.length) * 100) / 100 : 0;
      const sortedQa = [...qaScores].sort((a, b) => a - b);
      const medianQa = sortedQa.length > 0 ? sortedQa[Math.floor(sortedQa.length / 2)] : 0;
      const minQa = sortedQa.length > 0 ? sortedQa[0] : 0;
      const maxQa = sortedQa.length > 0 ? sortedQa[sortedQa.length - 1] : 0;

      const criteriaComplianceSummary: Record<string, any> = {};
      Object.entries(qaCriteriaCompliance).forEach(([crit, count]) => {
        criteriaComplianceSummary[crit] = {
          passed_count: count,
          pass_rate_pct: Math.round((count / targetPapers.length) * 10000) / 100
        };
      });

      statsObj.cohort_summary = {
        total_papers: targetPapers.length,
        year_distribution: yearDistribution,
        top_authors: topAuthors,
        top_publishers: topPublishers,
        quality_assessment_stats: {
          mean_score: meanQa,
          median_score: medianQa,
          min_score: minQa,
          max_score: maxQa,
          criteria_compliance: criteriaComplianceSummary
        }
      };
    }

    // 2. Variable Distributions (for selected keys)
    if (includeVariableDistributions) {
      const distributions: Record<string, any> = {};

      Array.from(selectedKeys).forEach(key => {
        const categoryPaperCountMap = new Map<string, number>();
        const categoryTagCountMap = new Map<string, number>();
        const categoryPaperIdsMap = new Map<string, Set<string>>();
        const rawTokenCountMap = new Map<string, number>();
        let notStatedCount = 0;
        let totalTags = 0;

        targetPapers.forEach(paper => {
          const paperId = paper.Paper_ID || paper.id || 'unknown';
          const extStr = getExtractedDataStr(paper);
          let rawTokens: string[] = [];

          if (extStr) {
            try {
              const parsed = JSON.parse(extStr);
              const extObj = parsed.extracted_data || parsed;
              let val = extObj[key];
              if (val && typeof val === 'object' && 'value' in val) {
                val = (val as any).value;
              }

              if (Array.isArray(val)) {
                val.forEach(item => {
                  if (typeof item === 'string' && item.includes(',') && !key.startsWith('rq8_a')) {
                    item.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
                  } else if (item !== undefined && item !== null && item !== '') {
                    rawTokens.push(String(item).trim());
                  }
                });
              } else if (typeof val === 'string') {
                if (val.includes(',') && !key.startsWith('rq8_a')) {
                  val.split(',').forEach(t => t.trim() && rawTokens.push(t.trim()));
                } else if (val.trim()) {
                  rawTokens.push(val.trim());
                }
              } else if (val !== undefined && val !== null && val !== '') {
                rawTokens.push(String(val).trim());
              }
            } catch (e) {}
          }

          // Filter out NOT_STATED tokens
          const validTokens = rawTokens.filter(t => t.toUpperCase() !== 'NOT_STATED' && t.trim() !== '');

          if (validTokens.length === 0) {
            notStatedCount++;
          } else {
            const paperCategoriesSeen = new Set<string>();

            validTokens.forEach(t => {
              totalTags++;
              rawTokenCountMap.set(t, (rawTokenCountMap.get(t) || 0) + 1);

              const umbrellaVal = resolveUmbrellanizerValue(t, key) || t;
              categoryTagCountMap.set(umbrellaVal, (categoryTagCountMap.get(umbrellaVal) || 0) + 1);

              if (!paperCategoriesSeen.has(umbrellaVal)) {
                paperCategoriesSeen.add(umbrellaVal);
                categoryPaperCountMap.set(umbrellaVal, (categoryPaperCountMap.get(umbrellaVal) || 0) + 1);

                if (!categoryPaperIdsMap.has(umbrellaVal)) {
                  categoryPaperIdsMap.set(umbrellaVal, new Set());
                }
                categoryPaperIdsMap.get(umbrellaVal)!.add(paperId);
              }
            });
          }
        });

        // Sorted Categories
        const sortedCats = Array.from(categoryTagCountMap.entries()).sort((a, b) => b[1] - a[1]);
        const catTagCounts = sortedCats.map(c => c[1]);
        const catTagPercentages = calculateHareHamiltonPercentages(catTagCounts);

        const categoryBreakdowns = sortedCats.map(([cat, tagCount], idx) => {
          const paperCount = categoryPaperCountMap.get(cat) || 0;
          const paperPrevalencePct = Math.round((paperCount / targetPapers.length) * 10000) / 100;
          const catItem: Record<string, any> = {
            category: cat,
            tag_count: tagCount,
            tag_share_pct: catTagPercentages[idx],
            paper_count: paperCount,
            paper_prevalence_pct: paperPrevalencePct
          };

          if (includeCategoryPaperMappings) {
            catItem.paper_ids = Array.from(categoryPaperIdsMap.get(cat) || []).sort();
          }

          return catItem;
        });

        const varStat: Record<string, any> = {
          total_papers_with_data: targetPapers.length - notStatedCount,
          total_extracted_tags: totalTags
        };

        if (includeNotStatedMetrics) {
          varStat.not_stated_count = notStatedCount;
          varStat.not_stated_pct = Math.round((notStatedCount / targetPapers.length) * 10000) / 100;
        }

        varStat.categories = categoryBreakdowns;

        if (includeRawTokenFrequencies) {
          varStat.raw_tokens = Array.from(rawTokenCountMap.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([token, count]) => ({ token, count }));
        }

        distributions[key] = varStat;
      });

      statsObj.variable_distributions = distributions;
    }

    return Object.keys(statsObj).length > 0 ? statsObj : null;
  }, [
    includeBakedStats,
    includeCohortStats,
    includeVariableDistributions,
    includeCategoryPaperMappings,
    includeNotStatedMetrics,
    includeRawTokenFrequencies,
    targetPapers,
    selectedKeys,
    getExtractedDataStr,
    parseQaAssessment,
    resolveUmbrellanizerValue
  ]);

  // Generate complete LLM Context JSON payload
  const generatedJson = useMemo(() => {
    if (!isOpen) return '';

    const exportTimestamp = new Date().toISOString();

    const papersData = targetPapers.map(paper => {
      const paperItem: Record<string, any> = {
        paper_id: paper.Paper_ID || paper.id || ''
      };

      // Citation Details
      const citationObj: Record<string, any> = {};
      if (includeCitationStr) {
        citationObj.formatted = formatCitation(paper.Authors || paper.Author || '', paper.Year);
      }
      if (includeTitle) citationObj.title = paper.Title || '';
      if (includeAuthors) citationObj.authors = paper.Authors || paper.Author || '';
      if (includeYear) citationObj.year = paper.Year ? Number(paper.Year) : null;
      if (includeDoi) citationObj.doi = paper.DOI || paper.doi || '';

      if (Object.keys(citationObj).length > 0) {
        paperItem.citation = citationObj;
      }

      // QA Assessment
      if (includeQa) {
        const { score, items } = parseQaAssessment(paper);
        paperItem.quality_assessment = {
          total_score: score,
          criteria_breakdown: items
        };
      }

      // Extracted Data variables mapping
      const extStr = getExtractedDataStr(paper);
      const { mapping: traceMapping, evidence: traceEvidence } = parseExtractedTraces(paper);
      const extractedMap: Record<string, any> = {};

      if (extStr) {
        try {
          const parsed = JSON.parse(extStr);
          const extObj = parsed.extracted_data || parsed;

          Array.from(selectedKeys).forEach(key => {
            let rawVal = extObj[key];
            if (rawVal && typeof rawVal === 'object' && 'value' in rawVal) {
              rawVal = (rawVal as any).value;
            }

            const keyDataObj: Record<string, any> = {};

            if (includeRawValue) {
              keyDataObj.raw_value = rawVal !== undefined && rawVal !== null ? rawVal : '';
            }

            if (includeUmbrellanizedValue) {
              keyDataObj.umbrellanized_value = rawVal !== undefined && rawVal !== null ? resolveUmbrellanizerValue(rawVal, key) : '';
            }

            if (includeTaxonomyJustification) {
              keyDataObj.taxonomy_justification = getUmbrellanizerJustification(key, paper);
            }

            if (includeMappingReasoning) {
              keyDataObj.mapping_reasoning = traceMapping[key] || '';
            }

            if (includeEvidenceQuote) {
              keyDataObj.evidence_quote = traceEvidence[key] || '';
            }

            // Only add key if it has non-empty values
            if (Object.keys(keyDataObj).length > 0) {
              extractedMap[key] = keyDataObj;
            }
          });
        } catch (e) {}
      }

      paperItem.extracted_data = extractedMap;
      return paperItem;
    });

    const payload: Record<string, any> = {
      system_context: {
        tool: "SLR Magic - LLM Context Builder",
        project_id: projectId,
        export_timestamp: exportTimestamp,
        total_papers_exported: targetPapers.length,
        export_scope: scope === 'filtered' ? 'filtered_cohort' : 'full_cohort',
        schema_legend: {
          paper_id: "Unique identifier of the paper in the SLR cohort",
          citation: "Bibliographic details for inline textual citations and references",
          quality_assessment: "Methodological rigor appraisal scores and breakdown",
          extracted_data: {
            raw_value: "Original extracted text/value from the paper",
            umbrellanized_value: "Standardized taxonomy category mapped by Umbrellanizer",
            taxonomy_justification: "Reasoning and evidence for taxonomy categorization",
            mapping_reasoning: "Traceability explanation of where/how data was located in paper",
            evidence_quote: "Direct text quote snippet extracted from paper source text"
          },
          baked_statistics: "Pre-computed, quota-balanced ground-truth distributions, counts, and percentages for authoritative synthesis"
        }
      }
    };

    // LLM Directives & Ground-Truth Policy
    if (includeLlmDirectives) {
      payload.llm_directives = {
        ground_truth_policy: "STRICT_GROUND_TRUTH_ENFORCEMENT",
        system_instruction: "You are an expert scientific researcher analyzing a systematic literature review dataset. All statistical numbers, percentages, distributions, and metrics provided in 'baked_statistics' are authoritative, pre-calculated, quota-balanced ground truth.",
        rules: [
          "RULE 1 (STRICT ADHERENCE): DO NOT recalculate, re-sum, estimate, or derive your own numerical values, percentages, or proportions from the 'papers' array.",
          "RULE 2 (NO HALLUCINATION): ALWAYS cite and use the exact numerical values, frequencies, and percentages from 'baked_statistics' when writing textual narrations, executive summaries, or generating chart figures.",
          "RULE 3 (EVIDENCE ATTRIBUTION): When discussing individual categories, concepts, or findings, attribute citations and evidence using the specific paper_ids provided in the category 'paper_ids' array or matching paper records in 'papers'."
        ]
      };
    }

    // Baked Statistics Root Object
    if (bakedStatistics) {
      payload.baked_statistics = bakedStatistics;
    }

    payload.papers = papersData;

    return JSON.stringify(payload, null, 2);
  }, [
    isOpen,
    targetPapers,
    projectId,
    scope,
    includeTitle,
    includeAuthors,
    includeYear,
    includeDoi,
    includeCitationStr,
    includeQa,
    includeRawValue,
    includeUmbrellanizedValue,
    includeTaxonomyJustification,
    includeMappingReasoning,
    includeEvidenceQuote,
    includeLlmDirectives,
    bakedStatistics,
    selectedKeys,
    formatCitation,
    getExtractedDataStr,
    parseExtractedTraces,
    parseQaAssessment,
    resolveUmbrellanizerValue,
    getUmbrellanizerJustification
  ]);

  // Estimated Token & Byte statistics
  const payloadStats = useMemo(() => {
    const charCount = generatedJson.length;
    const estimatedTokens = Math.ceil(charCount / 4);
    const sizeKb = (charCount / 1024).toFixed(1);
    return { charCount, estimatedTokens, sizeKb };
  }, [generatedJson]);

  // Copy JSON Handler
  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(generatedJson);
      setCopied(true);
      showToast('LLM Context JSON copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  // Download JSON Handler
  const handleDownloadJson = () => {
    try {
      const blob = new Blob([generatedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `llm_context_${projectId}_${scope}_${new Date().toISOString().slice(0, 10)}.json`;
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Downloaded ${filename}`, 'success');
    } catch (err) {
      showToast('Failed to download JSON file', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                LLM Context Builder
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Gemini 3.1 Pro Ready
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Export structured cohort data with baked ground-truth statistics, taxonomy justifications, and citation evidence.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Export Paper Scope Toggle */}
          <div className="bg-secondary/25 border border-border p-4 rounded-xl space-y-2">
            <label className="font-bold text-foreground flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-primary" />
              Target Paper Cohort Scope
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  scope === 'filtered'
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded-full ${scope === 'filtered' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-bold text-xs">Filtered Cohort</div>
                  <div className="text-[11px] text-muted-foreground">
                    Exports {filteredPapers.length} papers matching active table search & filters
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('full')}
                className={`p-3 rounded-lg border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  scope === 'full'
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                <div className={`mt-0.5 p-1 rounded-full ${scope === 'full' ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>
                  <Check className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-bold text-xs">Full Cohort</div>
                  <div className="text-[11px] text-muted-foreground">
                    Exports all {allPapers.length} papers in the final included cohort
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Baked Statistics & LLM Directives Configuration */}
          <div className="bg-secondary/25 border border-border p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-2 text-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Baked Statistics & Ground-Truth Directives
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeBakedStats}
                  onChange={(e) => setIncludeBakedStats(e.target.checked)}
                  className="rounded border-border text-emerald-500 focus:ring-emerald-500 h-3.5 w-3.5"
                />
                <span className="font-bold text-xs text-foreground">Include Baked Statistics</span>
              </label>
            </div>

            {includeBakedStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {[
                  {
                    label: 'LLM Ground-Truth Directives',
                    desc: 'Forbid LLM from recalculating numbers',
                    state: includeLlmDirectives,
                    setState: setIncludeLlmDirectives
                  },
                  {
                    label: 'Cohort Summary Stats',
                    desc: 'Year, Author, Publisher & QA stats',
                    state: includeCohortStats,
                    setState: setIncludeCohortStats
                  },
                  {
                    label: 'Variable Category Distributions',
                    desc: 'Pre-balanced counts & tag share %',
                    state: includeVariableDistributions,
                    setState: setIncludeVariableDistributions
                  },
                  {
                    label: 'Category Paper Mappings',
                    desc: 'Include paper_ids lists per category',
                    state: includeCategoryPaperMappings,
                    setState: setIncludeCategoryPaperMappings
                  },
                  {
                    label: 'NOT_STATED Frequency Metrics',
                    desc: 'Missing/not-stated rates per variable',
                    state: includeNotStatedMetrics,
                    setState: setIncludeNotStatedMetrics
                  },
                  {
                    label: 'Raw Token Frequencies',
                    desc: 'Pre-umbrellanization token counts',
                    state: includeRawTokenFrequencies,
                    setState: setIncludeRawTokenFrequencies
                  }
                ].map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg bg-card border border-border hover:bg-secondary/40 cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.state}
                      onChange={(e) => item.setState(e.target.checked)}
                      className="rounded border-border text-emerald-500 focus:ring-emerald-500 h-3.5 w-3.5 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-foreground leading-tight">{item.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 3. Paper Metadata & Citation Fields */}
          <div className="bg-secondary/25 border border-border p-4 rounded-xl space-y-3">
            <label className="font-bold text-foreground flex items-center gap-2 text-xs">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Paper Metadata & Citation Details (Per Paper)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Formatted Citation String', state: includeCitationStr, setState: setIncludeCitationStr },
                { label: 'Paper Title', state: includeTitle, setState: setIncludeTitle },
                { label: 'Authors', state: includeAuthors, setState: setIncludeAuthors },
                { label: 'Publication Year', state: includeYear, setState: setIncludeYear },
                { label: 'DOI Identifier', state: includeDoi, setState: setIncludeDoi },
                { label: 'QA Appraisal Score & Items', state: includeQa, setState: setIncludeQa }
              ].map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border hover:bg-secondary/40 cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.setState(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                  />
                  <span className="font-medium text-xs text-foreground">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 4. Output Field Attributes */}
          <div className="bg-secondary/25 border border-border p-4 rounded-xl space-y-3">
            <label className="font-bold text-foreground flex items-center gap-2 text-xs">
              <Info className="w-3.5 h-3.5 text-emerald-500" />
              Extracted Data Schema Components (Per Variable)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Raw Value (raw_value)', state: includeRawValue, setState: setIncludeRawValue },
                { label: 'Umbrellanized Category (umbrellanized_value)', state: includeUmbrellanizedValue, setState: setIncludeUmbrellanizedValue },
                { label: 'Taxonomy Justification (taxonomy_justification)', state: includeTaxonomyJustification, setState: setIncludeTaxonomyJustification },
                { label: 'Extraction Location Reasoning (mapping_reasoning)', state: includeMappingReasoning, setState: setIncludeMappingReasoning },
                { label: 'Evidence Quote Snippet (evidence_quote)', state: includeEvidenceQuote, setState: setIncludeEvidenceQuote }
              ].map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border hover:bg-secondary/40 cursor-pointer select-none transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={item.state}
                    onChange={(e) => item.setState(e.target.checked)}
                    className="rounded border-border text-emerald-500 focus:ring-emerald-500 h-3.5 w-3.5"
                  />
                  <span className="font-medium text-xs text-foreground">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 5. Dynamic Extracted Variable Selection */}
          <div className="bg-secondary/25 border border-border p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-4">
              <label className="font-bold text-foreground flex items-center gap-2 text-xs">
                <BarChart2 className="w-3.5 h-3.5 text-primary" />
                Select Extracted Data Variables ({selectedKeys.size} of {availableExtractedKeys.length} selected)
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllKeys}
                  className="px-2 py-1 bg-card hover:bg-secondary border border-border text-foreground rounded font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllKeys}
                  className="px-2 py-1 bg-card hover:bg-secondary border border-border text-foreground rounded font-semibold text-[11px] transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Key Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search extracted variables by name..."
                value={keySearchTerm}
                onChange={(e) => setKeySearchTerm(e.target.value)}
                className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary placeholder-muted-foreground/60"
              />
            </div>

            {/* Scrollable Key Checkboxes Grid */}
            <div className="max-h-48 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1 pt-1">
              {filteredExtractedKeys.length === 0 ? (
                <div className="col-span-full py-4 text-center text-muted-foreground font-medium">
                  No extracted variables match your search query.
                </div>
              ) : (
                filteredExtractedKeys.map(({ key, count }) => {
                  const isChecked = selectedKeys.has(key);
                  return (
                    <label
                      key={key}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer select-none transition-colors ${
                        isChecked
                          ? 'bg-primary/10 border-primary/40 text-foreground font-semibold'
                          : 'bg-card border-border hover:bg-secondary/40 text-muted-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleKey(key)}
                          className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 shrink-0"
                        />
                        <span className="truncate text-xs">{key}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground shrink-0 font-medium">
                        {count} p.
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* 6. Live JSON Preview (Collapsible) */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="w-full px-4 py-3 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between font-bold text-xs text-foreground transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-500" />
                Live JSON Payload Preview
                <span className="font-normal text-muted-foreground">
                  ({payloadStats.sizeKb} KB · ~{payloadStats.estimatedTokens.toLocaleString()} tokens)
                </span>
              </span>
              {showPreview ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showPreview && (
              <div className="p-4 bg-slate-950 text-emerald-400 font-mono text-[11px] max-h-64 overflow-auto border-t border-border select-text leading-relaxed">
                <pre>{generatedJson}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 border-t border-border bg-secondary/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
            <div>
              Papers: <span className="font-bold text-foreground">{targetPapers.length}</span>
            </div>
            <div>
              Variables: <span className="font-bold text-foreground">{selectedKeys.size}</span>
            </div>
            <div>
              Baked Stats: <span className="font-bold text-emerald-500">{includeBakedStats ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div>
              Est. Tokens: <span className="font-bold text-emerald-500">~{payloadStats.estimatedTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-bold text-xs rounded-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-primary" />}
              {copied ? 'Copied to Clipboard!' : 'Copy JSON'}
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
