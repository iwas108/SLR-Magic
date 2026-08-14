import React, { useState } from 'react';
import { Sparkles, Plus, Trash2 } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import { getFieldValue } from '../../utils/dataExtractor';

export function CustomGroupingManager() {
  const { props, config, data } = useVisualizerContext();
  const { papers } = props;
  const { chartType, sankeyFields, primaryField, useUmbrellanizer, splitMultiValues, excludeEmpty } = config;
  const {
    levelCustomGroups,
    setLevelCustomGroups,
    levelCustomGroupLinks,
    setLevelCustomGroupLinks
  } = data;

  const [levelNewGroupName, setLevelNewGroupName] = useState<Record<number, string>>({});

  const activeCustomLevelIndices = ['sunburst', 'treemap', 'sankey'].includes(chartType)
    ? sankeyFields.map((f, idx) => (f === CUSTOM_GROUPING_KEY ? idx : -1)).filter(idx => idx !== -1)
    : (primaryField === CUSTOM_GROUPING_KEY ? [0] : []);

  if (activeCustomLevelIndices.length === 0) {
    return (
      <div className="p-3 bg-secondary/10 border border-border/60 rounded-xl flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <span>To create custom macro-domain categories, select <span className="font-bold text-primary">✨ [Custom Grouping Layer]</span> in any Level dropdown above.</span>
        </div>
      </div>
    );
  }

  const extractOpts = {
    useUmbrellanizer,
    umbrellanizerMap: props.umbrellanizerMap,
    splitMultiValues,
    excludeEmpty
  };

  return (
    <div className="space-y-4">
      {activeCustomLevelIndices.map(lIdx => {
        const currentLevelGroups = levelCustomGroups[lIdx] || ['High-Maturity Indoor', 'Other Domains', 'Agriculture'];
        const currentLevelLinks = levelCustomGroupLinks[lIdx] || {};
        const currentNewName = levelNewGroupName[lIdx] || '';

        const subFieldKey = sankeyFields.find((f, i) => f !== CUSTOM_GROUPING_KEY && i > lIdx) || sankeyFields.find(f => f !== CUSTOM_GROUPING_KEY) || primaryField;
        const samplePapers = papers.slice(0, 200);
        const allSubValues = Array.from(new Set(samplePapers.flatMap(p => getFieldValue(p, subFieldKey, extractOpts))))
          .filter(Boolean)
          .filter(v => v !== '[object Object]' && v !== 'Unspecified')
          .sort();

        return (
          <div key={lIdx} className="p-4 bg-secondary/20 border border-border/80 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-extrabold text-foreground">
                  Level {lIdx + 1} Custom Grouping Layer Configuration
                </span>
              </div>
              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Active at Level {lIdx + 1}
              </span>
            </div>

            <div className="pt-2 space-y-4 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground">
                Create custom macro-domain categories for <span className="font-bold text-primary">Level {lIdx + 1}</span> and link sub-field items (<span className="font-bold text-foreground">{subFieldKey.startsWith('ext:') ? subFieldKey.substring(4) : subFieldKey}</span>) to them.
              </p>

              {/* Inline Add New Custom Group Bar */}
              <div className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-xl">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <input
                  type="text"
                  placeholder={`Create custom group name for Level ${lIdx + 1} (e.g. High-Maturity Indoor, Agriculture)...`}
                  value={currentNewName}
                  onChange={(e) => setLevelNewGroupName(prev => ({ ...prev, [lIdx]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && currentNewName.trim()) {
                      const name = currentNewName.trim();
                      if (!currentLevelGroups.includes(name)) {
                        setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: [...(prev[lIdx] || []), name] }));
                      }
                      setLevelNewGroupName(prev => ({ ...prev, [lIdx]: '' }));
                    }
                  }}
                  className="flex-1 bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (currentNewName.trim()) {
                      const name = currentNewName.trim();
                      if (!currentLevelGroups.includes(name)) {
                        setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: [...(prev[lIdx] || []), name] }));
                      }
                      setLevelNewGroupName(prev => ({ ...prev, [lIdx]: '' }));
                    }
                  }}
                  className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Group (Level {lIdx + 1})
                </button>
              </div>

              {/* Sub-Level Field Items Linker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary block">
                    Sub-Items Target Source: <span className="font-extrabold text-foreground">{subFieldKey.startsWith('ext:') ? subFieldKey.substring(4) : subFieldKey}</span> ({allSubValues.length} unique items)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentLevelGroups.map(groupName => {
                    const assignedItems = allSubValues.filter(v => currentLevelLinks[v] === groupName);
                    const unassignedItems = allSubValues.filter(v => !currentLevelLinks[v]);

                    return (
                      <div key={groupName} className="p-3 bg-card border border-border rounded-xl space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                            <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              {groupName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLevelCustomGroups((prev: Record<number, string[]>) => ({
                                  ...prev,
                                  [lIdx]: (prev[lIdx] || []).filter((g: string) => g !== groupName)
                                }));
                                setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
                                  const copy = { ...(prev[lIdx] || {}) };
                                  Object.keys(copy).forEach(k => {
                                    if (copy[k] === groupName) delete copy[k];
                                  });
                                  return { ...prev, [lIdx]: copy };
                                });
                              }}
                              className="text-muted-foreground hover:text-red-500 p-0.5 transition-colors"
                              title="Delete custom group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Assigned Sub-Item Pills */}
                          <div className="flex flex-wrap gap-1.5 pt-2 min-h-[36px]">
                            {assignedItems.length > 0 ? assignedItems.map(item => (
                              <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                                {item}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
                                      const copy = { ...(prev[lIdx] || {}) };
                                      delete copy[item];
                                      return { ...prev, [lIdx]: copy };
                                    });
                                  }}
                                  className="hover:text-red-500 font-extrabold ml-0.5"
                                  title="Unlink sub-item"
                                >
                                  ×
                                </button>
                              </span>
                            )) : (
                              <span className="text-[10.5px] italic text-muted-foreground">No sub-items linked yet</span>
                            )}
                          </div>
                        </div>

                        {/* Link Item Selector */}
                        {unassignedItems.length > 0 && (
                          <div className="pt-2 border-t border-border/40 flex items-center gap-2">
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  const itemToLink = e.target.value;
                                  setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
                                    ...prev,
                                    [lIdx]: { ...(prev[lIdx] || {}), [itemToLink]: groupName }
                                  }));
                                  e.target.value = '';
                                }
                              }}
                              className="w-full bg-secondary/40 border border-border rounded-lg px-2 py-1 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                            >
                              <option value="" disabled>+ Link sub-item to {groupName}...</option>
                              {unassignedItems.map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
