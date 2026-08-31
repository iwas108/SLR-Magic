import React, { useState, useMemo } from 'react';
import { Sparkles, Plus, Trash2, Zap, Layers, ArrowRight, CheckCircle2, HelpCircle, Edit2, Check, X } from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { CUSTOM_GROUPING_KEY } from '../../constants/defaultConfigs';
import { getFieldValue, stripParentPrefix } from '../../utils/dataExtractor';
import { FieldAutocomplete } from './FieldAutocomplete';

export function CustomGroupingManager() {
  const { props, config, data } = useVisualizerContext();
  const { papers } = props;
  const { chartType, sankeyFields, primaryField, secondaryField, useUmbrellanizer, splitMultiValues, excludeEmpty } = config;
  const {
    levelCustomGroups = {},
    setLevelCustomGroups,
    levelCustomGroupLinks = {},
    setLevelCustomGroupLinks,
    levelTargetFields = {},
    setLevelTargetFields,
    discoveredVariables = [],
    availableFields = []
  } = data;

  const [levelNewGroupName, setLevelNewGroupName] = useState<Record<number, string>>({});
  const [editingGroup, setEditingGroup] = useState<{ lIdx: number; oldName: string; currentName: string } | null>(null);

  const is2DChart = ['clustered_bar', 'stacked_bar', 'heatmap', 'graph'].includes(chartType);
  const isHierarchical = ['sunburst', 'treemap', 'sankey'].includes(chartType);

  const activeCustomLevelIndices: number[] = [];
  if (isHierarchical) {
    sankeyFields.forEach((f, idx) => {
      if (f === CUSTOM_GROUPING_KEY) activeCustomLevelIndices.push(idx);
    });
  } else if (is2DChart) {
    if (primaryField === CUSTOM_GROUPING_KEY) activeCustomLevelIndices.push(0);
    if (secondaryField === CUSTOM_GROUPING_KEY) activeCustomLevelIndices.push(1);
  } else {
    if (primaryField === CUSTOM_GROUPING_KEY) activeCustomLevelIndices.push(0);
  }

  if (activeCustomLevelIndices.length === 0) {
    return null;
  }

  const extractOpts = {
    useUmbrellanizer,
    umbrellanizerMap: props.umbrellanizerMap,
    splitMultiValues,
    excludeEmpty
  };

  const handleAutoParseColon = (lIdx: number, subValues: string[]) => {
    if (!subValues || subValues.length === 0) return;

    const newGroupsSet = new Set<string>();
    const newLinks: Record<string, string> = {};
    let hasStandalone = false;

    subValues.forEach(val => {
      if (!val || val === '[object Object]' || val === 'Unspecified') return;
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        const prefix = val.substring(0, colonIdx).trim();
        if (prefix) {
          newGroupsSet.add(prefix);
          newLinks[val] = prefix;
        } else {
          hasStandalone = true;
          newLinks[val] = 'Other / Standalone';
        }
      } else {
        hasStandalone = true;
        newLinks[val] = 'Other / Standalone';
      }
    });

    const sortedGroups = Array.from(newGroupsSet).sort();
    if (hasStandalone) {
      sortedGroups.push('Other / Standalone');
    }

    if (!levelTargetFields[lIdx]) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: levelTargetFields[lIdx] || 'ext:rq2_operational_domains' }));
    }

    setLevelCustomGroups((prev: Record<number, string[]>) => ({
      ...prev,
      [lIdx]: sortedGroups
    }));

    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
      ...prev,
      [lIdx]: newLinks
    }));
  };

  const handleAutoGroupDirect = (lIdx: number, subValues: string[], fallbackFieldKey?: string) => {
    if (!subValues || subValues.length === 0) return;
    const groups = subValues.slice(0, 12);
    const links: Record<string, string> = {};
    groups.forEach(g => { links[g] = g; });
    if (!levelTargetFields[lIdx] && fallbackFieldKey) {
      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: fallbackFieldKey }));
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: groups }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: links }));
  };

  const handleRenameGroup = (lIdx: number, oldName: string, newName: string) => {
    const trimmed = newName.trim().replace(/\\n/g, '\n');
    if (!trimmed || trimmed === oldName) {
      setEditingGroup(null);
      return;
    }
    setLevelCustomGroups((prev: Record<number, string[]>) => ({
      ...prev,
      [lIdx]: (prev[lIdx] || []).map((g: string) => g === oldName ? trimmed : g)
    }));
    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
      const copy = { ...(prev[lIdx] || {}) };
      Object.keys(copy).forEach(k => {
        if (copy[k] === oldName) copy[k] = trimmed;
      });
      return { ...prev, [lIdx]: copy };
    });
    setEditingGroup(null);
  };

  return (
    <div className="space-y-4 my-3">
      {activeCustomLevelIndices.map(lIdx => {
        const currentLevelGroups = levelCustomGroups[lIdx] || [];
        const currentLevelLinks = levelCustomGroupLinks[lIdx] || {};
        const currentNewName = levelNewGroupName[lIdx] || '';

        const defaultSubFieldKey = is2DChart
          ? (lIdx === 0 
              ? (levelTargetFields[0] || (primaryField !== CUSTOM_GROUPING_KEY ? primaryField : (discoveredVariables?.find(v => v.category === 'extracted' || v.category === 'taxonomy')?.key || 'Year'))) 
              : (levelTargetFields[1] || (secondaryField !== CUSTOM_GROUPING_KEY ? secondaryField : (discoveredVariables?.find(v => v.key.includes('rq2') || v.category === 'extracted')?.key || 'Import_Source'))))
          : (levelTargetFields[lIdx] || sankeyFields.find((f, i) => f !== CUSTOM_GROUPING_KEY && i > lIdx) || sankeyFields.find(f => f !== CUSTOM_GROUPING_KEY) || primaryField);
        
        const subFieldKey = levelTargetFields[lIdx] || defaultSubFieldKey;
        const allSubValues = Array.from(new Set((papers || []).flatMap(p => getFieldValue(p, subFieldKey, extractOpts))))
          .filter(Boolean)
          .filter(v => v !== '[object Object]' && v !== 'Unspecified')
          .sort();

        const colonItemsCount = allSubValues.filter(v => v.includes(':')).length;
        const unassignedItems = allSubValues.filter(v => !currentLevelLinks[v]);

        const levelTitle = is2DChart
          ? (lIdx === 0 ? 'Primary Variable (X-Axis) Custom Grouping' : 'Secondary Variable (Comparison Series) Custom Grouping')
          : `Level ${lIdx + 1} Custom Grouping Layer Configuration`;

        return (
          <div key={lIdx} className="p-4 bg-primary/5 border-2 border-primary/30 rounded-2xl space-y-4 shadow-sm">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-foreground block">
                    {levelTitle}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Partition and group data items for {is2DChart ? (lIdx === 0 ? 'the X-Axis' : 'the Comparison Series') : `Level ${lIdx + 1}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {colonItemsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAutoParseColon(lIdx, allSubValues)}
                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="Automatically discover macro-categories from ':' prefixes"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                    Auto-Group from &apos;:&apos; Prefixes ({colonItemsCount})
                  </button>
                )}
                {currentLevelGroups.length === 0 && allSubValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAutoGroupDirect(lIdx, allSubValues)}
                    className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="Auto-create groups from discovered unique values"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Auto-Create Groups ({allSubValues.length})
                  </button>
                )}
              </div>
            </div>

            {/* Target Data Source Field Selector */}
            <div className="p-3 bg-card border border-border rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Select Data Variable to Group / Stratify:
                </label>
                <span className="text-[11px] font-bold text-muted-foreground">
                  {allSubValues.length} unique values found in cohort
                </span>
              </div>
              <FieldAutocomplete
                value={subFieldKey}
                onChange={(newKey) => {
                  setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: newKey }));
                  // Reset links when target variable changes
                  setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({ ...prev, [lIdx]: {} }));
                }}
                discoveredVariables={discoveredVariables.filter(v => v.key !== CUSTOM_GROUPING_KEY)}
                availableFields={availableFields.filter(f => f !== CUSTOM_GROUPING_KEY)}
                placeholder="Search Research Questions (RQ1..RQn), taxonomy, or metadata..."
              />
            </div>

            {/* Group Creator Input */}
            <div className="flex items-center gap-2 p-2.5 bg-card border border-border rounded-xl">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <input
                type="text"
                placeholder={`Create new group name (e.g. Industrial Implementations, Agricultural Deployments)...`}
                value={currentNewName}
                onChange={(e) => setLevelNewGroupName(prev => ({ ...prev, [lIdx]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && currentNewName.trim()) {
                    const name = currentNewName.trim();
                    if (!currentLevelGroups.includes(name)) {
                      setLevelCustomGroups((prev: Record<number, string[]>) => ({ ...prev, [lIdx]: [...(prev[lIdx] || []), name] }));
                    }
                    if (!levelTargetFields[lIdx]) {
                      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
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
                    if (!levelTargetFields[lIdx]) {
                      setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                    }
                    setLevelNewGroupName(prev => ({ ...prev, [lIdx]: '' }));
                  }
                }}
                className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Group
              </button>
            </div>

            {/* Custom Groups Grid */}
            {currentLevelGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentLevelGroups.map(groupName => {
                  const assignedItems = allSubValues.filter(v => currentLevelLinks[v] === groupName);

                  return (
                    <div key={groupName} className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 flex flex-col justify-between shadow-sm">
                      <div>
                        <div className="flex items-center justify-between pb-2 border-b border-border/60">
                          {editingGroup?.lIdx === lIdx && editingGroup?.oldName === groupName ? (
                            <div className="flex items-center gap-1 flex-1 mr-2">
                              <input
                                type="text"
                                autoFocus
                                value={editingGroup.currentName}
                                onChange={(e) => setEditingGroup({ ...editingGroup, currentName: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameGroup(lIdx, groupName, editingGroup.currentName);
                                  if (e.key === 'Escape') setEditingGroup(null);
                                }}
                                className="flex-1 bg-secondary border border-primary rounded-md px-2 py-1 text-xs font-bold text-foreground focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRenameGroup(lIdx, groupName, editingGroup.currentName)}
                                className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                                title="Save (Enter)"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingGroup(null)}
                                className="p-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs font-black text-foreground flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0" />
                              <span className="whitespace-pre-line leading-tight" title={groupName}>
                                {groupName}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-secondary text-muted-foreground shrink-0 ml-1">
                                {assignedItems.length} items
                              </span>
                            </span>
                          )}
                          <div className="flex items-center gap-1 shrink-0">
                            {(!editingGroup || editingGroup.oldName !== groupName) && (
                              <button
                                type="button"
                                onClick={() => setEditingGroup({ lIdx, oldName: groupName, currentName: groupName.replace(/\n/g, '\\n') })}
                                className="text-muted-foreground hover:text-primary p-1 rounded-md hover:bg-primary/10 transition-colors"
                                title="Rename group"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
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
                              className="text-muted-foreground hover:text-red-500 p-1 rounded-md hover:bg-red-500/10 transition-colors"
                              title="Delete custom group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Assigned Items Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-2 min-h-[32px]">
                          {assignedItems.length > 0 ? assignedItems.map(item => {
                            const displayLabel = stripParentPrefix(item, groupName);
                            return (
                              <span key={item} title={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                                {displayLabel}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => {
                                      const copy = { ...(prev[lIdx] || {}) };
                                      delete copy[item];
                                      return { ...prev, [lIdx]: copy };
                                    });
                                  }}
                                  className="hover:text-red-500 font-black ml-0.5"
                                  title={`Unlink ${item}`}
                                >
                                  ×
                                </button>
                              </span>
                            );
                          }) : (
                            <span className="text-[10.5px] italic text-muted-foreground">No items assigned yet</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Assign Dropdown for This Group */}
                      {unassignedItems.length > 0 && (
                        <div className="pt-2 border-t border-border/40">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                const itemToLink = e.target.value;
                                if (!levelTargetFields[lIdx]) {
                                  setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                                }
                                setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
                                  ...prev,
                                  [lIdx]: { ...(prev[lIdx] || {}), [itemToLink]: groupName }
                                }));
                                e.target.value = '';
                              }
                            }}
                            className="w-full bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-foreground focus:outline-none focus:border-primary"
                          >
                            <option value="" disabled>+ Link unassigned item to &ldquo;{groupName}&rdquo;...</option>
                            {unassignedItems.map(u => {
                              const uDisplay = stripParentPrefix(u, groupName);
                              return (
                                <option key={u} value={u}>{uDisplay !== u ? `${uDisplay} (${u})` : u}</option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-card border border-dashed border-border rounded-xl text-center space-y-2">
                <Sparkles className="w-6 h-6 text-primary mx-auto opacity-60" />
                <p className="text-xs font-bold text-foreground">
                  No Custom Groups Created Yet
                </p>
                <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                  Type a group name in the input above (e.g. <strong>Industrial Implementations</strong> or <strong>Agricultural Deployments</strong>) and click <strong>Add Group</strong> to partition your data.
                </p>
              </div>
            )}

            {/* Unassigned Items Quick Bank */}
            {unassignedItems.length > 0 && currentLevelGroups.length > 0 && (
              <div className="p-3 bg-card border border-border rounded-xl space-y-2">
                <span className="text-[11px] font-extrabold text-muted-foreground block">
                  Unassigned Items ({unassignedItems.length}): Click any group button to assign
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {unassignedItems.map(u => (
                    <div key={u} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-secondary/60 border border-border text-[11px] font-bold text-foreground">
                      <span>{u}</span>
                      <div className="flex items-center gap-0.5 ml-1 border-l border-border/80 pl-1">
                        {currentLevelGroups.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => {
                              if (!levelTargetFields[lIdx]) {
                                setLevelTargetFields((prev: Record<number, string>) => ({ ...prev, [lIdx]: subFieldKey }));
                              }
                              setLevelCustomGroupLinks((prev: Record<number, Record<string, string>>) => ({
                                ...prev,
                                [lIdx]: { ...(prev[lIdx] || {}), [u]: g }
                              }));
                            }}
                            className="px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold transition-all"
                            title={`Assign "${u}" to "${g}"`}
                          >
                            + {g.slice(0, 10)}{g.length > 10 ? '…' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
