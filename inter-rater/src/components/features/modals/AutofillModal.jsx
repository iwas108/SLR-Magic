import React, { useState } from 'react';

const APPRAISAL_FIELDS = [
  'Human_Decision', 'Human_EC_Trigger', 'Human_Rationale', 'Reviewer_Name',
  'Reviewer_Decision', 'Reviewer_EC_Code', 'Reviewer_Reasoning', 'Reviewer_Confidence'
];

export const parseJSONToAppraisal = (jsonText, session, currentAppraisal = {}) => {
  const data = JSON.parse(jsonText);
  const updates = {};

  const isPoolC = session?.poolType === 'CAL_Pool_C' || session?.poolType === 'pool_c';

  // 1. Parse decision, exclusion code, reasoning
  let decision = null;
  let exclusionCode = null;
  let reasoning = null;

  const finalEval = data.final_evaluation || data.finalEvaluation;
  if (finalEval) {
    decision = finalEval.decision;
    exclusionCode = finalEval.exclusion_code || finalEval.exclusionCode;
    reasoning = finalEval.reasoning || finalEval.rationale;
  }

  if (!decision) decision = data.decision || data.Human_Decision || data.Reviewer_Decision;
  if (!exclusionCode) exclusionCode = data.exclusion_code || data.exclusionCode || data.exclusion || data.Human_EC_Trigger || data.Reviewer_EC_Code;
  if (!reasoning) reasoning = data.reasoning || data.rationale || data.Human_Rationale || data.Reviewer_Reasoning;

  if (decision) {
    const decStr = String(decision).toLowerCase();
    if (decStr.includes('include')) {
      updates.Human_Decision = 'Include';
      updates.Reviewer_Decision = 'Include';
      updates.Human_EC_Trigger = '';
      updates.Reviewer_EC_Code = '';
    } else if (decStr.includes('exclude')) {
      updates.Human_Decision = 'Exclude';
      updates.Reviewer_Decision = 'Exclude';
    }
  }

  if (exclusionCode && exclusionCode !== 'NONE' && exclusionCode !== 'null') {
    updates.Human_EC_Trigger = String(exclusionCode);
    updates.Reviewer_EC_Code = String(exclusionCode);
  } else if (exclusionCode === 'NONE' || exclusionCode === 'null' || (decision && String(decision).toLowerCase().includes('include'))) {
    updates.Human_EC_Trigger = '';
    updates.Reviewer_EC_Code = '';
  }

  if (reasoning) {
    updates.Human_Rationale = String(reasoning);
    updates.Reviewer_Reasoning = String(reasoning);
  }

  // 2. Parse QA Scores
  const qaScoresSource = data.qa_scores || data.qaScores || data.logic_trace || data;
  if (qaScoresSource && typeof qaScoresSource === 'object') {
    if (isPoolC) {
      const qaRules = session?.metadata?.qa_rules || session?.metadata?.qaRules || [];
      const updatedQAScores = { ...(currentAppraisal.Human_QA_Scores || {}) };
      let hasQAScores = false;

      qaRules.forEach(rule => {
        const possibleKeys = [
          rule.code,
          rule.code.toLowerCase(),
          rule.code.replace('-', ''),
          rule.code.replace('-', '').toLowerCase(),
          rule.code.replace('-', '_'),
          rule.code.replace('-', '_').toLowerCase(),
        ];

        const match = rule.code.match(/qa[-_]?(\d+)/i);
        if (match) {
          const num = match[1];
          Object.keys(qaScoresSource).forEach(sourceKey => {
            const nSourceKey = sourceKey.toLowerCase();
            if (
              nSourceKey.startsWith(`qa${num}`) ||
              nSourceKey.startsWith(`qa-${num}`) ||
              nSourceKey.startsWith(`qa_${num}`) ||
              nSourceKey === num ||
              nSourceKey === `gate_${num}` ||
              nSourceKey.includes(`gate_${num}_`)
            ) {
              possibleKeys.push(sourceKey);
            }
          });
        }

        const foundKey = possibleKeys.find(k => qaScoresSource[k] !== undefined);
        if (foundKey) {
          hasQAScores = true;
          const scoreData = qaScoresSource[foundKey];
          if (scoreData && typeof scoreData === 'object') {
            updatedQAScores[rule.code] = {
              value: scoreData.value !== undefined && scoreData.value !== null ? Number(scoreData.value) : null,
              evidence: scoreData.evidence || scoreData.inner_gate_reasoning || scoreData.innerGateReasoning || ''
            };
          } else if (scoreData !== undefined && scoreData !== null) {
            updatedQAScores[rule.code] = {
              value: Number(scoreData),
              evidence: ''
            };
          }
        }
      });

      if (hasQAScores) {
        updates.Human_QA_Scores = updatedQAScores;
      }
    } else {
      const dynamicKeys = Object.keys(currentAppraisal).filter(
        k => !APPRAISAL_FIELDS.includes(k)
      );
      dynamicKeys.forEach(key => {
        if (key.toLowerCase().startsWith('qa')) {
          const match = key.match(/qa[-_]?(\d+)/i);
          const possibleKeys = [key, key.toLowerCase()];
          if (match) {
            const num = match[1];
            Object.keys(qaScoresSource).forEach(sourceKey => {
              const nSourceKey = sourceKey.toLowerCase();
              if (
                nSourceKey.startsWith(`qa${num}`) ||
                nSourceKey.startsWith(`qa-${num}`) ||
                nSourceKey.startsWith(`qa_${num}`) ||
                nSourceKey === num
              ) {
                possibleKeys.push(sourceKey);
              }
            });
          }

          const foundKey = possibleKeys.find(k => qaScoresSource[k] !== undefined);
          if (foundKey) {
            const scoreData = qaScoresSource[foundKey];
            if (scoreData && typeof scoreData === 'object') {
              updates[key] = {
                value: scoreData.value !== undefined && scoreData.value !== null ? String(scoreData.value) : '',
                evidence: scoreData.evidence || ''
              };
            } else if (scoreData !== undefined && scoreData !== null) {
              updates[key] = {
                value: String(scoreData),
                evidence: ''
              };
            }
          }
        }
      });
    }
  }

  // 3. Parse Extracted Data
  const extDataSource = data.extracted_data || data.extractedData || data.logic_trace || data;
  if (extDataSource && typeof extDataSource === 'object') {
    if (isPoolC) {
      const extRules = session?.metadata?.extraction_rules || session?.metadata?.extractionRules || [];
      const updatedExtData = { ...(currentAppraisal.Human_Extracted_Data || {}) };
      let hasExtData = false;

      extRules.forEach(rule => {
        const possibleKeys = [
          rule.json_key,
          rule.json_key.toLowerCase(),
          rule.json_key.replace(/_/g, ''),
          rule.json_key.replace(/_/g, '-'),
        ];

        const extMapping = data.logic_trace?.extraction_mapping || data.logicTrace?.extractionMapping;
        if (extMapping) {
          const expectedTraceKey = `locate_${rule.json_key}`;
          const possibleTraceKeys = [expectedTraceKey, expectedTraceKey.toLowerCase(), expectedTraceKey.replace(/_/g, '')];
          const foundTraceKey = possibleTraceKeys.find(k => extMapping[k] !== undefined);
          if (foundTraceKey) {
            hasExtData = true;
            const traceText = extMapping[foundTraceKey];
            updatedExtData[rule.json_key] = {
              value: updatedExtData[rule.json_key]?.value || '',
              evidence: traceText || ''
            };
          }
        }

        const foundKey = possibleKeys.find(k => extDataSource[k] !== undefined);
        if (foundKey) {
          hasExtData = true;
          const extItem = extDataSource[foundKey];
          if (extItem && typeof extItem === 'object') {
            updatedExtData[rule.json_key] = {
              value: extItem.value !== undefined && extItem.value !== null ? String(extItem.value) : (updatedExtData[rule.json_key]?.value || ''),
              evidence: extItem.evidence || (updatedExtData[rule.json_key]?.evidence || '')
            };
          } else if (extItem !== undefined && extItem !== null) {
            updatedExtData[rule.json_key] = {
              value: String(extItem),
              evidence: updatedExtData[rule.json_key]?.evidence || ''
            };
          }
        }
      });

      if (hasExtData) {
        updates.Human_Extracted_Data = updatedExtData;
      }
    } else {
      const dynamicKeys = Object.keys(currentAppraisal).filter(
        k => !APPRAISAL_FIELDS.includes(k) && !k.toLowerCase().startsWith('qa')
      );
      dynamicKeys.forEach(key => {
        const possibleKeys = [
          key,
          key.toLowerCase(),
          key.replace(/_/g, ''),
          key.replace(/_/g, '-'),
        ];
        const foundKey = possibleKeys.find(k => extDataSource[k] !== undefined);
        if (foundKey) {
          const extItem = extDataSource[foundKey];
          if (extItem && typeof extItem === 'object') {
            updates[key] = {
              value: extItem.value !== undefined && extItem.value !== null ? String(extItem.value) : '',
              evidence: extItem.evidence || ''
            };
          } else if (extItem !== undefined && extItem !== null) {
            updates[key] = {
              value: String(extItem),
              evidence: ''
            };
          }
        }
      });
    }
  }

  if (data.logic_trace) {
    updates.logic_trace = data.logic_trace;
  } else if (data.logicTrace) {
    updates.logic_trace = data.logicTrace;
  }

  return updates;
};

const AutofillModal = ({ isOpen, onClose, onAutofill, session, currentAppraisal }) => {
  const [jsonText, setJsonText] = useState('');
  const [validation, setValidation] = useState({
    isValid: false,
    error: null,
    updates: null,
    summary: null
  });

  if (!isOpen) return null;

  const poolName = session?.poolType || 'Unknown Pool';

  const handleTextChange = (e) => {
    const val = e.target.value;
    setJsonText(val);

    if (!val.trim()) {
      setValidation({ isValid: false, error: null, updates: null, summary: null });
      return;
    }

    try {
      const updates = parseJSONToAppraisal(val, session, currentAppraisal);
      const summaryList = [];

      if (updates.Human_Decision) {
        summaryList.push(`Decision: ${updates.Human_Decision}`);
      }
      if (updates.Human_EC_Trigger) {
        summaryList.push(`Exclusion: ${updates.Human_EC_Trigger}`);
      }
      if (updates.Human_Rationale) {
        const truncated = updates.Human_Rationale.length > 50
          ? updates.Human_Rationale.substring(0, 50) + '...'
          : updates.Human_Rationale;
        summaryList.push(`Reasoning: "${truncated}"`);
      }
      if (updates.Human_QA_Scores) {
        const count = Object.keys(updates.Human_QA_Scores).length;
        summaryList.push(`QA Scores: ${count} criteria populated`);
      }
      if (updates.Human_Extracted_Data) {
        const count = Object.keys(updates.Human_Extracted_Data).length;
        summaryList.push(`Data Extraction: ${count} keys populated`);
      }

      // Check if there are other dynamic fields (e.g. non-Pool C dynamic fields)
      const dynamicKeys = Object.keys(updates).filter(
        k => !['Human_Decision', 'Reviewer_Decision', 'Human_EC_Trigger', 'Reviewer_EC_Code', 'Human_Rationale', 'Reviewer_Reasoning', 'Human_QA_Scores', 'Human_Extracted_Data', 'logic_trace'].includes(k)
      );
      if (dynamicKeys.length > 0) {
        const qaCount = dynamicKeys.filter(k => k.toLowerCase().startsWith('qa')).length;
        const extCount = dynamicKeys.length - qaCount;
        if (qaCount > 0) summaryList.push(`QA Scores: ${qaCount} criteria populated`);
        if (extCount > 0) summaryList.push(`Data Extraction: ${extCount} keys populated`);
      }

      if (summaryList.length === 0) {
        setValidation({
          isValid: true,
          error: null,
          updates,
          summary: ['Valid JSON, but no matching review keys could be mapped.']
        });
      } else {
        setValidation({
          isValid: true,
          error: null,
          updates,
          summary: summaryList
        });
      }
    } catch (err) {
      setValidation({
        isValid: false,
        error: err.message,
        updates: null,
        summary: null
      });
    }
  };

  const handleApply = () => {
    if (validation.isValid && validation.updates) {
      onAutofill(validation.updates);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-155 dark:border-gray-700 flex flex-col relative z-10 transform scale-100 transition-all max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3.5 border-b border-gray-150 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
                JSON Autofill Validator
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase mt-0.5">
                Active Pool: <span className="text-indigo-600 dark:text-indigo-400">{poolName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-655 dark:hover:text-gray-250 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0 text-sm">
          <p className="text-xs text-gray-550 dark:text-gray-300 leading-relaxed font-medium">
            Paste the JSON logic trace output for this study. The system will automatically validate the syntax and map the values to auto-populate the active review form.
          </p>

          <textarea
            value={jsonText}
            onChange={handleTextChange}
            placeholder={`Paste raw JSON here...\nExample:\n{\n  "final_evaluation": {\n    "decision": "INCLUDE",\n    "reasoning": "No explicit exclusion found."\n  }\n}`}
            className="w-full h-56 p-3 font-mono text-[11px] border border-gray-300 dark:border-gray-750 bg-gray-50 dark:bg-gray-900 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-gray-800 dark:text-gray-200 transition-all resize-none shrink-0"
          />

          {/* Validation Status Block */}
          {!jsonText.trim() ? (
            <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-800 text-xs font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-605 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Waiting for JSON input...
            </div>
          ) : !validation.isValid ? (
            <div className="p-3 bg-rose-50/50 dark:bg-rose-950/10 rounded-xl border border-rose-200 dark:border-rose-900/30 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <span className="text-base shrink-0 leading-none">❌</span>
              <div className="space-y-1">
                <span className="font-bold block">Invalid JSON Syntax</span>
                <span className="font-mono text-[10px] opacity-90 block leading-normal">{validation.error}</span>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/40 dark:bg-emerald-955/10 rounded-xl border border-emerald-250 dark:border-emerald-900/30 text-xs text-emerald-850 dark:text-emerald-300 flex items-start gap-2.5">
              <span className="text-base shrink-0 leading-none">🟢</span>
              <div className="space-y-2 flex-1 min-w-0">
                <span className="font-black block uppercase tracking-wider text-[10px] text-emerald-750 dark:text-emerald-450">JSON Parsed Successfully</span>
                <div className="space-y-1.5">
                  <span className="font-bold opacity-80 block">Detected parameters to autofill:</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {validation.summary.map((sum, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-emerald-100/50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/40 rounded-md font-semibold text-[10px] tracking-wide text-emerald-800 dark:text-emerald-350"
                      >
                        {sum}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3.5 border-t border-gray-150 dark:border-gray-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-650 hover:bg-gray-100 dark:hover:bg-gray-700/60 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!validation.isValid}
            className={`px-5 py-2 text-xs font-bold rounded-xl shadow-md transition-all text-white ${
              validation.isValid
                ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer active:scale-95'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed shadow-none'
            }`}
          >
            Apply Autofill
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutofillModal;
