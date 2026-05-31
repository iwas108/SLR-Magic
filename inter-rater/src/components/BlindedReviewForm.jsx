import React, { useState } from 'react';

const APPRAISAL_FIELDS = [
  'Reviewer_Decision', 'Reviewer_Reasoning', 'Reviewer_Confidence', 'Reviewer_EC_Code',
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name'
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
  ecRules, 
  qualityAssuranceDefinition,
  reasoningTemplate = [],
  onAddReasoningTemplate
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  
  // Resolve exclusion criteria rules (from ecRules array or parsed from string)
  const resolvedECRules = React.useMemo(() => {
    if (ecRules && ecRules.length > 0) return ecRules;
    return [];
  }, [ecRules]);

  // Parse QA definition blocks for rubric lookups
  const qaBlocks = React.useMemo(() => {
    return parseQADefinition(qualityAssuranceDefinition);
  }, [qualityAssuranceDefinition]);

  // Extract all dynamic keys present in the paper record (keys other than standard ones)
  const dynamicKeys = React.useMemo(() => {
    if (!currentRow) return [];
    return Object.keys(currentRow).filter(
      key => !APPRAISAL_FIELDS.includes(key)
    );
  }, [currentRow]);

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
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => handleInputChange('Human_Decision', 'Include')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
              decision === 'Include'
                ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-500/10'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            Include
          </button>
          <button
            type="button"
            onClick={() => handleInputChange('Human_Decision', 'Exclude')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2 ${
              decision === 'Exclude'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/10'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exclude
          </button>
        </div>
      </div>

      {/* 2. Conditional Exclusion Rules (Only if Exclude is chosen) */}
      {decision === 'Exclude' && resolvedECRules.length > 0 && (
        <div className="bg-rose-50/20 dark:bg-rose-950/10 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-3">
          <label className="block text-xs font-bold text-rose-850 dark:text-rose-300 uppercase tracking-wider">
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
                  className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-500 shadow-md shadow-rose-500/5'
                      : 'bg-white dark:bg-gray-800/80 border-gray-250 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-md border ${
                      isSelected
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-rose-50 dark:bg-rose-950/45 border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-350'
                    }`}>
                      {rule.code}
                    </span>
                    {isSelected && (
                      <span className="flex items-center justify-center w-5 h-5 bg-rose-600 dark:bg-rose-500 rounded-full text-white">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal">
                    {rule.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Dynamic Quality Appraisal & Data Extraction (Only if Included / Decision pending) */}
      {decision === 'Include' && dynamicKeys.length > 0 && (
        <div className="space-y-6">
          {dynamicKeys.map((key) => {
            const isQA = key.toLowerCase().startsWith('qa');
            const block = isQA ? getQABlock(key) : null;
            const label = block ? block.title : getFallbackLabel(key);
            const description = block ? block.details.join('\n') : '';

            // Retrieve active response (value & evidence)
            const item = currentRow[key] || { value: '', evidence: '' };

            return (
              <div key={key} className="bg-gray-50/30 dark:bg-gray-900/20 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                    {label} <span className="text-red-500">*</span>
                  </h4>
                  {description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap leading-normal font-medium bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/40 p-2.5 rounded-lg">
                      {description}
                    </p>
                  )}
                </div>

                {isQA ? (
                  // Quality Assurance: Render 1.0, 0.5, 0.0 segmented button options
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
                  // Data Extraction: Render standard text input for value
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

                {/* Evidence field */}
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
        </div>
      )}

      {/* 4. Reviewer Reasoning */}
      <div className="bg-gray-50/50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-150 dark:border-gray-800 space-y-3">
        <label htmlFor="reviewerReasoning" className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
          Reviewer Reasoning / Rationale <span className="text-red-500">*</span>
        </label>
        
        {/* Combined searchable/typable template dropdown */}
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              className="w-full pl-3 pr-8 py-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs text-gray-800 dark:text-gray-250 transition-all"
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
              className="absolute right-2.5 top-3.5 text-gray-400 hover:text-gray-650 dark:hover:text-gray-300"
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
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg text-gray-750 dark:text-gray-300 transition-colors truncate"
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
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all text-gray-850 dark:text-gray-250"
          id="reviewerReasoning"
          rows="3.5"
          value={currentRow.Human_Rationale || currentRow.Reviewer_Reasoning || ''}
          onChange={(e) => handleInputChange('Human_Rationale', e.target.value)}
          placeholder="Justify your inclusion/exclusion decision..."
          required
        />
      </div>
    </div>
  );
};

export default BlindedReviewForm;
