import React, { useState } from 'react';

const APPRAISAL_FIELDS = [
  'Reviewer_Decision', 'Reviewer_Reasoning', 'Reviewer_Confidence', 'Reviewer_EC_Code',
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name',
  'Human_QA_Scores', 'Human_Extracted_Data', 'logic_trace', 'logicTrace',
  '_logic_trace', '_scientist_logic_trace', 'qa_scores', 'qaScores',
  'extracted_data', 'extractedData'
];

// Helper to parse QA definitions into blocks
export function parseQADefinition(qaStr) {
  if (!qaStr) return [];
  const lines = qaStr.split('\n');
  const blocks = [];
  let currentBlock = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check if line starts with QA plus number, or number followed by dot/parenthesis
    const isNewBlock = /^(?:qa)?\d+[\.\)\s]/i.test(trimmed) || /^qa\d+/i.test(trimmed);

    if (isNewBlock) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        title: trimmed,
        details: []
      };
    } else {
      if (currentBlock) {
        currentBlock.details.push(trimmed);
      }
    }
  });

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// Helper to parse Exclusion Criteria string into rules if ecRules array is empty
export function parseExclusionCriteria(ecStr) {
  if (!ecStr) return [];
  const lines = ecStr.split('\n');
  const rules = [];
  let currentRule = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const isNewRule = /^ec[-_]?\d+/i.test(trimmed);

    if (isNewRule) {
      if (currentRule) {
        rules.push(currentRule);
      }
      
      const colonIndex = trimmed.indexOf(':');
      let code = '';
      let description = '';
      
      if (colonIndex !== -1) {
        code = trimmed.substring(0, colonIndex).trim();
        description = trimmed.substring(colonIndex + 1).trim();
      } else {
        const match = trimmed.match(/^(ec[-_]?\d+(?:\s*\([^)]+\))?)/i);
        if (match) {
          code = match[1].trim();
          description = trimmed.substring(code.length).trim();
        } else {
          code = trimmed;
          description = '';
        }
      }

      currentRule = {
        code,
        description
      };
    } else {
      if (currentRule) {
        currentRule.description = currentRule.description 
          ? `${currentRule.description} ${trimmed}` 
          : trimmed;
      }
    }
  });

  if (currentRule) {
    rules.push(currentRule);
  }

  return rules;
}

const BlindedReviewForm = ({ 
  currentRow, 
  handleInputChange, 
  handleDynamicChange, 
  handleNestedDynamicChange,
  ecRules, 
  qaRules = [],
  extractionRules = [],
  isPoolC = false,
  qualityAssuranceDefinition,
  reasoningTemplate = [],
  onAddReasoningTemplate
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  // Extract all dynamic keys present in the paper record (keys other than standard ones)
  const dynamicKeys = React.useMemo(() => {
    if (!currentRow) return [];
    return Object.keys(currentRow).filter(
      key => !APPRAISAL_FIELDS.includes(key)
    );
  }, [currentRow]);

  // Calculate total score and fatal gates status
  const qaCalculations = React.useMemo(() => {
    let sum = 0;
    let totalQuestions = 0;
    let fatalFlaw = false;
    let fatalRulesTriggered = [];
    let completedCount = 0;

    const fatalCodes = ['QA-1', 'QA-2', 'QA-3', 'QA-4', 'QA-6'];

    if (!currentRow) {
      return { sum, totalQuestions, completedCount, allCompleted: false, fatalFlaw, fatalRulesTriggered };
    }

    if (isPoolC && qaRules && qaRules.length > 0) {
      const qaScores = currentRow.Human_QA_Scores || {};
      totalQuestions = qaRules.length;
      qaRules.forEach(rule => {
        const item = qaScores[rule.code];
        const rawVal = item ? (item.value ?? item.score ?? item.val ?? (typeof item === 'object' ? null : item)) : null;
        if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
          const val = Number(rawVal);
          if (!isNaN(val)) {
            sum += val;
            completedCount++;
            if (val === 0.0 && fatalCodes.includes(rule.code)) {
              fatalFlaw = true;
              fatalRulesTriggered.push(rule.code);
            }
          }
        }
      });
    } else {
      // Non-Pool C
      const qaKeys = dynamicKeys.filter(key => key.toLowerCase().startsWith('qa'));
      totalQuestions = qaKeys.length;
      qaKeys.forEach(key => {
        const item = currentRow[key];
        const rawVal = item ? (item.value ?? item.score ?? item.val ?? (typeof item === 'object' ? null : item)) : null;
        if (rawVal !== null && rawVal !== undefined && rawVal !== '') {
          const val = Number(rawVal);
          if (!isNaN(val)) {
            sum += val;
            completedCount++;
            const normalizedKey = key.toUpperCase().replace('_', '-'); // e.g. "QA_1" -> "QA-1"
            const isFatal = fatalCodes.some(code => normalizedKey === code || normalizedKey === code.replace('-', '') || normalizedKey.startsWith(code));
            if (val === 0.0 && isFatal) {
              fatalFlaw = true;
              fatalRulesTriggered.push(key.toUpperCase().replace('_', ' '));
            }
          }
        }
      });
    }

    return {
      sum,
      totalQuestions,
      completedCount,
      allCompleted: completedCount === totalQuestions && totalQuestions > 0,
      fatalFlaw,
      fatalRulesTriggered
    };
  }, [isPoolC, qaRules, currentRow, dynamicKeys]);

  const renderQASummaryBox = () => {
    const { sum, totalQuestions, completedCount, allCompleted, fatalFlaw, fatalRulesTriggered } = qaCalculations;
    if (totalQuestions === 0) return null;

    const scoreExceedsThreshold = sum >= 4.5;
    const isExcluded = fatalFlaw || (allCompleted && !scoreExceedsThreshold);

    return (
      <div className={`mt-4 p-4 rounded-xl border ${
        isExcluded 
          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200' 
          : allCompleted 
            ? 'bg-emerald-50/50 dark:bg-emerald-955/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-250' 
            : 'bg-blue-50/40 dark:bg-blue-955/15 border-blue-150 dark:border-blue-900/30 text-blue-850 dark:text-blue-200'
      } space-y-2.5 transition-all duration-200`}>
        <div className="flex justify-between items-center">
          <span className="text-[11px] font-black uppercase tracking-wider opacity-85">
            QA Scoring Summary
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/60 dark:bg-gray-900/40 border border-current/10">
            {completedCount} / {totalQuestions} Answered
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          {/* Cumulative Score */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold opacity-60 uppercase tracking-wider">Cumulative Score</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black">{sum.toFixed(1)}</span>
              <span className="text-[10px] opacity-60">/ {totalQuestions.toFixed(1)}</span>
            </div>
            {completedCount > 0 && (
              <span className={`text-[10px] font-extrabold flex items-center gap-1 ${
                sum >= 4.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {sum >= 4.5 ? '🟢 Pass (≥ 4.5)' : '🔴 Fail (< 4.5)'}
              </span>
            )}
          </div>

          {/* Fatal Flaw Gate */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold opacity-60 uppercase tracking-wider">Fatal Flaw Gate</span>
            <div className="text-xs font-black flex items-center gap-1.5 h-7">
              {fatalFlaw ? (
                <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1 leading-tight text-[11px]">
                  🚨 Fatal Flaw ({fatalRulesTriggered.join(', ')})
                </span>
              ) : completedCount > 0 ? (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  🛡️ Clear
                </span>
              ) : (
                <span className="opacity-60 font-semibold text-gray-500">No scores yet</span>
              )}
            </div>
            <span className="block text-[9px] opacity-60 leading-tight">QA-1, 2, 3, 4, 6 cannot be 0.0</span>
          </div>
        </div>

        {allCompleted && (
          <div className={`text-center py-1.5 px-3 rounded-lg text-xs font-extrabold border ${
            isExcluded 
              ? 'bg-rose-100/50 dark:bg-rose-900/40 border-rose-200/60' 
              : 'bg-emerald-100/50 dark:bg-emerald-900/40 border-emerald-200/60'
          }`}>
            {isExcluded ? '❌ Automatically Excluded by QA Rules' : '✅ Automatically Included by QA Rules'}
          </div>
        )}
      </div>
    );
  };

  // Resolve exclusion criteria rules (from ecRules array or parsed from string)
  const resolvedECRules = React.useMemo(() => {
    if (ecRules && ecRules.length > 0) return ecRules;
    return [];
  }, [ecRules]);

  // Parse QA definition blocks for rubric lookups
  const qaBlocks = React.useMemo(() => {
    return parseQADefinition(qualityAssuranceDefinition);
  }, [qualityAssuranceDefinition]);


  // Find the matching QA block description for a given key (e.g. qa1_aims)
  const getQABlock = (key) => {
    const match = key.match(/qa(\d+)/i);
    if (!match) return null;
    const numStr = match[1];
    
    // Search blocks starting with the number
    return qaBlocks.find(block => {
      const title = block.title.toLowerCase();
      return title.startsWith(numStr) || 
             title.startsWith(`qa${numStr}`) || 
             title.startsWith(`qa-${numStr}`) ||
             title.includes(` ${numStr}`) ||
             title.includes(`qa ${numStr}`);
    });
  };

  const getFallbackLabel = (key) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const decision = currentRow.Human_Decision || currentRow.Reviewer_Decision || '';

  return (
    <div className="space-y-6">
      {/* 1. Reviewer Decision */}
      <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Inclusion Decision <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleInputChange('Human_Decision', 'Include')}
            className={`group flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 text-center relative overflow-hidden ${
              decision === 'Include'
                ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-900 dark:text-emerald-300 shadow-lg shadow-emerald-500/10'
                : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-700 hover:shadow-sm'
            }`}
          >
            {/* Background Accent glow */}
            <div className={`absolute -right-6 -bottom-6 w-16 h-16 rounded-full transition-all duration-300 ${
              decision === 'Include' ? 'bg-emerald-500/10 scale-150' : 'bg-transparent group-hover:bg-gray-100/50 dark:group-hover:bg-gray-700/30'
            }`} />
            
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2.5 transition-all duration-300 ${
              decision === 'Include'
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white scale-110 shadow-md shadow-emerald-600/20'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:scale-105 group-hover:text-gray-500 dark:group-hover:text-gray-300'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <span className={`text-xs font-extrabold tracking-wide uppercase transition-colors duration-300 ${
              decision === 'Include' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200'
            }`}>
              Include
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Shortcut: Press [I]</span>
          </button>

          <button
            type="button"
            onClick={() => handleInputChange('Human_Decision', 'Exclude')}
            className={`group flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 text-center relative overflow-hidden ${
              decision === 'Exclude'
                ? 'bg-rose-50/50 dark:bg-rose-900/20 border-rose-500 text-rose-900 dark:text-rose-300 shadow-lg shadow-rose-500/10'
                : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/80 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-700 hover:shadow-sm'
            }`}
          >
            {/* Background Accent glow */}
            <div className={`absolute -right-6 -bottom-6 w-16 h-16 rounded-full transition-all duration-300 ${
              decision === 'Exclude' ? 'bg-rose-500/10 scale-150' : 'bg-transparent group-hover:bg-gray-100/50 dark:group-hover:bg-gray-700/30'
            }`} />

            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2.5 transition-all duration-300 ${
              decision === 'Exclude'
                ? 'bg-rose-600 dark:bg-rose-500 text-white scale-110 shadow-md shadow-rose-600/20'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 group-hover:scale-105 group-hover:text-gray-500 dark:group-hover:text-gray-300'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <span className={`text-xs font-extrabold tracking-wide uppercase transition-colors duration-300 ${
              decision === 'Exclude' ? 'text-rose-700 dark:text-rose-400' : 'text-gray-650 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200'
            }`}>
              Exclude
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-medium">Shortcut: Press [E]</span>
          </button>
        </div>
      </div>

      {/* 2. Conditional Exclusion Rules (Only if Exclude is chosen) */}
      {decision === 'Exclude' && resolvedECRules.length > 0 && (
        <div className="bg-rose-50/20 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-3">
          <label className="block text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
            Select Exclusion Trigger <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2.5">
            {resolvedECRules.map((rule, idx) => {
              const isSelected = (currentRow.Human_EC_Trigger || currentRow.Reviewer_EC_Code) === rule.code;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleInputChange('Human_EC_Trigger', rule.code)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 relative overflow-hidden group ${
                    isSelected
                      ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-500 shadow-md shadow-rose-500/5'
                      : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-700'
                  }`}
                >
                  {/* Left Radio Check Indicator */}
                  <div className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'border-rose-500 bg-rose-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-transparent group-hover:border-gray-400 dark:group-hover:border-gray-500'
                  }`}>
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  
                  {/* Rule Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded border tracking-wide uppercase ${
                        isSelected
                          ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                          : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-300'
                      }`}>
                        {rule.code}
                      </span>
                      {idx < 9 && (
                        <span className="text-[10px] text-muted-foreground font-semibold font-mono">
                          Shortcut: [{idx + 1}]
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                      {rule.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Dynamic Quality Appraisal & Data Extraction (Only if Included / Decision pending) */}
      {decision === 'Include' && (
        <div className="space-y-6">
          {isPoolC ? (
            // Pool C Specific Rules Rendering
            <>
              {/* QA Rules section */}
              {qaRules.length > 0 && (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2 mb-2">
                    <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Quality Assessment (QA) Scoring
                    </h3>
                  </div>
                  {qaRules.map((rule) => {
                    const qaScores = currentRow.Human_QA_Scores || {};
                    const item = qaScores[rule.code] || { value: null, evidence: '' };
                    const label = `${rule.code}: ${rule.title || rule.label || rule.description || ''}`;
                    const description = (rule.description && rule.description !== rule.title) ? rule.description : '';

                    return (
                      <div key={rule.code} className="bg-gray-50/30 dark:bg-gray-900/20 p-4 rounded-xl border border-border space-y-3">
                        <div>
                          <h4 className="text-xs font-extrabold text-gray-900 dark:text-white leading-snug">
                            {label} <span className="text-red-500">*</span>
                          </h4>
                          {rule.question && (
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1.5 italic">
                              ❓ {rule.question}
                            </p>
                          )}
                          {description && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal font-medium bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/40 p-2 rounded-lg">
                              {description}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Score Option</label>
                          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                            {['1.0', '0.5', '0.0'].map((val) => {
                              const isSelected = item.value !== null && item.value !== undefined && item.value !== '' && Number(item.value) === Number(val);
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleNestedDynamicChange('Human_QA_Scores', rule.code, 'value', Number(val))}
                                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-sm'
                                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                          
                          {((rule.score_1_logic || rule.score1Logic) || (rule.score_05_logic || rule.score05Logic) || (rule.score_0_logic || rule.score0Logic)) && (
                            <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 space-y-1 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/40 p-2 rounded-lg leading-relaxed font-semibold">
                              {(rule.score_1_logic || rule.score1Logic) && (
                                <div className="flex gap-1.5">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">1.0:</span>
                                  <span>{rule.score_1_logic || rule.score1Logic}</span>
                                </div>
                              )}
                              {(rule.score_05_logic || rule.score05Logic) && (
                                <div className="flex gap-1.5">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">0.5:</span>
                                  <span>{rule.score_05_logic || rule.score05Logic}</span>
                                </div>
                              )}
                              {(rule.score_0_logic || rule.score0Logic) && (
                                <div className="flex gap-1.5">
                                  <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">0.0:</span>
                                  <span>{rule.score_0_logic || rule.score0Logic}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Evidence field */}
                        <div>
                          <label htmlFor={`ev-${rule.code}`} className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Text Evidence / Quote</label>
                          <textarea
                            id={`ev-${rule.code}`}
                            rows="2"
                            placeholder="Extract the justifying quote or evidence from full-text..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-800 dark:text-gray-200"
                            value={item.evidence || ''}
                            onChange={(e) => handleNestedDynamicChange('Human_QA_Scores', rule.code, 'evidence', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    );
                  })}
                  {renderQASummaryBox()}
                </div>
              )}

              {/* Data Extraction rules section */}
              {extractionRules.length > 0 && (
                <div className="space-y-4 pt-4">
                  <div className="border-b border-border pb-2 mb-2">
                    <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Data Extraction Parameters
                    </h3>
                  </div>
                  {extractionRules.map((rule) => {
                    const extData = currentRow.Human_Extracted_Data || {};
                    const item = extData[rule.json_key] || { value: '', evidence: '' };
                    const label = rule.label || rule.title || rule.json_key;
                    const description = (rule.description && rule.description !== rule.label) ? rule.description : '';

                    return (
                      <div key={rule.json_key} className="bg-gray-50/30 dark:bg-gray-900/20 p-4 rounded-xl border border-border space-y-3">
                        <div>
                          <h4 className="text-xs font-extrabold text-gray-900 dark:text-white leading-snug">
                            {label} <span className="text-red-500">*</span>
                          </h4>
                          {rule.question && (
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-1.5 italic">
                              ❓ {rule.question}
                            </p>
                          )}
                          {description && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-normal font-medium bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/40 p-2 rounded-lg">
                              {description}
                            </p>
                          )}
                        </div>

                        <div>
                          <label htmlFor={`val-${rule.json_key}`} className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Extracted Value</label>
                          <input
                            type="text"
                            id={`val-${rule.json_key}`}
                            placeholder="Enter extracted parameter..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-800 dark:text-gray-200"
                            value={Array.isArray(item.value) ? item.value.join(', ') : (item.value || '')}
                            onChange={(e) => handleNestedDynamicChange('Human_Extracted_Data', rule.json_key, 'value', e.target.value)}
                            required
                          />
                        </div>

                        {/* Evidence field */}
                        <div>
                          <label htmlFor={`ev-${rule.json_key}`} className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Text Evidence / Quote</label>
                          <textarea
                            id={`ev-${rule.json_key}`}
                            rows="2"
                            placeholder="Extract the justifying quote or evidence from full-text..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-800 dark:text-gray-200"
                            value={item.evidence || ''}
                            onChange={(e) => handleNestedDynamicChange('Human_Extracted_Data', rule.json_key, 'evidence', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            // Non-Pool C Dynamic Fields
            <div className="space-y-4">
              {dynamicKeys.map((key) => {
                const isQA = key.toLowerCase().startsWith('qa');
                const block = isQA ? getQABlock(key) : null;
                const label = block ? block.title : getFallbackLabel(key);
                const description = block ? block.details.join('\n') : '';
                const item = currentRow[key] || { value: '', evidence: '' };

                return (
                  <div key={key} className="bg-gray-50/30 dark:bg-gray-900/20 p-4 rounded-xl border border-border space-y-3">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                        {label} <span className="text-red-500">*</span>
                      </h4>
                      {description && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-normal font-medium bg-white dark:bg-gray-950 border border-gray-100 dark:border-gray-800/40 p-2.5 rounded-lg">
                          {description}
                        </p>
                      )}
                    </div>

                    {isQA ? (
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Score Option</label>
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl gap-1">
                          {['1.0', '0.5', '0.0'].map((val) => {
                            const isSelected = String(item.value) === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleDynamicChange(key, 'value', val)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isSelected
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor={`val-${key}`} className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Extracted Value</label>
                        <input
                          type="text"
                          id={`val-${key}`}
                          placeholder="Enter extracted parameter..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-800 dark:text-gray-200"
                          value={item.value || ''}
                          onChange={(e) => handleDynamicChange(key, 'value', e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label htmlFor={`ev-${key}`} className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Text Evidence / Quote</label>
                      <textarea
                        id={`ev-${key}`}
                        rows="2.5"
                        placeholder="Extract the justifying quote or evidence from full-text..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-800 dark:text-gray-200"
                        value={item.evidence || ''}
                        onChange={(e) => handleDynamicChange(key, 'evidence', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                );
              })}
              {renderQASummaryBox()}
            </div>
          )}
        </div>
      )}

      {/* 4. Reviewer Reasoning */}
      {!isPoolC && (
        <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-xl border border-border space-y-3">
          <label htmlFor="reviewerReasoning" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Reviewer Reasoning / Rationale <span className="text-red-500">*</span>
          </label>
          
          {/* Combined searchable/typable template dropdown */}
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                className="w-full pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs text-gray-800 dark:text-gray-200 transition-all"
                placeholder="Type to search or add new template..."
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="absolute right-2.5 top-3.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className={`w-3.5 h-3.5 transform transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isDropdownOpen && (
              <>
                {/* Overlay backdrop to dismiss dropdown on click outside */}
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDropdownOpen(false)} 
                />
                
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                  {reasoningTemplate
                    .filter(item => item.toLowerCase().includes(searchVal.toLowerCase()))
                    .map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleInputChange('Human_Rationale', item);
                          setSearchVal('');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg text-gray-700 dark:text-gray-300 transition-colors truncate"
                        title={item}
                      >
                        {item}
                      </button>
                    ))}
                  
                  {searchVal.trim() && !reasoningTemplate.some(t => t.toLowerCase() === searchVal.trim().toLowerCase()) && onAddReasoningTemplate && (
                    <button
                      type="button"
                      onClick={() => {
                        const val = searchVal.trim();
                        onAddReasoningTemplate(val);
                        handleInputChange('Human_Rationale', val);
                        setSearchVal('');
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700/50 mt-1 pt-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Save "{searchVal.trim()}" as template</span>
                    </button>
                  )}

                  {reasoningTemplate.filter(item => item.toLowerCase().includes(searchVal.toLowerCase())).length === 0 && !searchVal.trim() && (
                    <div className="p-2 text-xs text-gray-400 dark:text-gray-500 text-center italic">
                      No templates available. Type to create one!
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <textarea
            className="w-full px-3 py-2 border border-border bg-background rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs transition-all text-foreground"
            id="reviewerReasoning"
            rows="3.5"
            value={currentRow.Human_Rationale || currentRow.Reviewer_Reasoning || ''}
            onChange={(e) => handleInputChange('Human_Rationale', e.target.value)}
            placeholder="Justify your inclusion/exclusion decision..."
            required
          />
        </div>
      )}
    </div>
  );
};

export default BlindedReviewForm;
