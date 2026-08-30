'use client';

import React, { useMemo, useState } from 'react';
import { 
  Target, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Sliders, 
  Zap,
  Tag,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { useVisualizerContext } from '../../context/VisualizerContext';
import { getFieldValue } from '../../utils/dataExtractor';
import { FieldAutocomplete } from './FieldAutocomplete';

export function RadarDataMappingPanel() {
  const { props, config, data } = useVisualizerContext();
  const { papers, umbrellanizerMap } = props;
  const { availableFields, discoveredVariables } = data;
  const {
    radarMode = 'multi_variable',
    setRadarMode,
    radarVariables = [],
    setRadarVariables,
    radarVariableAliases = {},
    setRadarVariableAliases,
    radarVariableTargets = {},
    setRadarVariableTargets,
    radarShowTarget = true,
    setRadarShowTarget,
    radarTargetName = 'Horticultural Requirement Target',
    setRadarTargetName,
    radarTargetValue = 100,
    setRadarTargetValue,
    radarBaselineName = 'Empirical Cohort Baseline (n={n})',
    setRadarBaselineName,
    primaryField,
    setPrimaryField,
    useUmbrellanizer,
    splitMultiValues,
    excludeEmpty
  } = config;

  const [selectedFieldToAdd, setSelectedFieldToAdd] = useState<string>('');
  const [isMetadataOpen, setIsMetadataOpen] = useState<boolean>(true);

  const totalCohort = papers.length;
  const mappedOpts = { 
    useUmbrellanizer, 
    umbrellanizerMap, 
    splitMultiValues, 
    excludeEmpty 
  };

  // Helper to extract clean auto-alias from variable key
  const getAutoAlias = (key: string): string => {
    if (key.startsWith('cat:')) {
      const rawContent = key.substring(4);
      const lastColon = rawContent.lastIndexOf(':');
      return lastColon !== -1 ? rawContent.substring(lastColon + 1).trim() : rawContent;
    }
    return key
      .replace(/^ext:(macro:|sub:|leaf:|tail:)?/, '')
      .replace(/^raw:(leaf:|tail:)?ext:/, '')
      .replace(/^rq\d*[_:]?/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim() || key;
  };

  // Compute empirical positive counts for active variables
  const variableStats = useMemo(() => {
    const stats: Record<string, { count: number; pct: number }> = {};
    radarVariables.forEach((vKey) => {
      let count = 0;
      papers.forEach(p => {
        const rawVals = getFieldValue(p, vKey, mappedOpts);
        const hasValid = rawVals.some(v => {
          const s = String(v || '').trim().toUpperCase();
          return Boolean(s) && s !== 'NOT_STATED' && s !== 'FALSE' && s !== '0' && s !== 'NONE' && s !== 'UNSPECIFIED' && s !== '[OBJECT OBJECT]';
        });
        if (hasValid) count++;
      });
      const pct = totalCohort > 0 ? Math.round((count / totalCohort) * 100) : 0;
      stats[vKey] = { count, pct };
    });
    return stats;
  }, [radarVariables, papers, mappedOpts, totalCohort]);

  const handleAddVariable = (fieldKey: string) => {
    if (!fieldKey || radarVariables.includes(fieldKey)) return;
    const next = [...radarVariables, fieldKey];
    setRadarVariables(next);
    if (!radarVariableAliases[fieldKey]) {
      setRadarVariableAliases({
        ...radarVariableAliases,
        [fieldKey]: getAutoAlias(fieldKey)
      });
    }
    setSelectedFieldToAdd('');
  };

  const handleRemoveVariable = (fieldKey: string) => {
    setRadarVariables(radarVariables.filter(k => k !== fieldKey));
    const nextAliases = { ...radarVariableAliases };
    delete nextAliases[fieldKey];
    setRadarVariableAliases(nextAliases);
    const nextTargets = { ...radarVariableTargets };
    delete nextTargets[fieldKey];
    setRadarVariableTargets(nextTargets);
  };

  const handleClearAllVariables = () => {
    setRadarVariables([]);
    setRadarVariableAliases({});
    setRadarVariableTargets({});
  };

  const handleMoveVariable = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= radarVariables.length) return;
    const next = [...radarVariables];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setRadarVariables(next);
  };

  const handleSetAlias = (fieldKey: string, alias: string) => {
    setRadarVariableAliases({
      ...radarVariableAliases,
      [fieldKey]: alias
    });
  };

  const handleSetTarget = (fieldKey: string, targetVal: number) => {
    setRadarVariableTargets({
      ...radarVariableTargets,
      [fieldKey]: targetVal
    });
  };

  const handleRebindVariableKey = (oldKey: string, newKey: string) => {
    if (!newKey || oldKey === newKey) return;
    const oldAlias = radarVariableAliases[oldKey] || getAutoAlias(oldKey);
    const oldTarget = radarVariableTargets[oldKey] ?? radarTargetValue;

    const nextVars = radarVariables.map(k => k === oldKey ? newKey : k);
    const nextAliases = { ...radarVariableAliases };
    delete nextAliases[oldKey];
    nextAliases[newKey] = oldAlias;

    const nextTargets = { ...radarVariableTargets };
    delete nextTargets[oldKey];
    nextTargets[newKey] = oldTarget;

    setRadarVariables(nextVars);
    setRadarVariableAliases(nextAliases);
    setRadarVariableTargets(nextTargets);
  };

  const handlePreFillAllExtracted = () => {
    const extFields = availableFields.filter((f: string) => f.startsWith('ext:') || f.startsWith('raw:ext:'));
    const targetFields = extFields.length > 0 ? extFields.slice(0, 8) : availableFields.slice(0, 8);
    const aliases: Record<string, string> = { ...radarVariableAliases };
    targetFields.forEach((f: string) => {
      if (!aliases[f]) aliases[f] = getAutoAlias(f);
    });
    setRadarVariables(targetFields);
    setRadarVariableAliases(aliases);
  };

  const handlePreFillHorticulturalParadox = () => {
    const paradoxDimensions = [
      { terms: ['latency', 'delay', 'execution'], alias: 'Execution Latency', fallback: 'ext:Execution Latency' },
      { terms: ['memory', 'ram', 'flash', 'storage', 'sram'], alias: 'Static Memory', fallback: 'ext:Static Memory' },
      { terms: ['power', 'energy', 'watt', 'battery', 'current', 'profiling'], alias: 'Power Profiling', fallback: 'ext:Power Profiling' },
      { terms: ['envelope', 'explicit', 'constraint', 'bound'], alias: 'Explicit Envelopes', fallback: 'ext:Explicit Envelopes' },
      { terms: ['narrowband', 'lpwan', 'lora', 'lorawan', 'nbiot', 'zigbee', 'ble'], alias: 'Narrowband / LPWAN', fallback: 'ext:Narrowband / LPWAN' },
      { terms: ['harsh', 'environment', 'dust', 'moisture', 'ip6', 'rugged'], alias: 'Harsh Environment', fallback: 'ext:Harsh Environment' },
      { terms: ['agri', 'farm', 'crop', 'greenhouse', 'soil', 'horticulture', 'plant'], alias: 'Agricultural Focus', fallback: 'ext:Agricultural Focus' },
      { terms: ['thermal', 'dissipation', 'heat', 'temperature', 'cooling'], alias: 'Thermal Dissipation', fallback: 'ext:Thermal Dissipation' }
    ];

    const vars: string[] = [];
    const aliases: Record<string, string> = {};

    paradoxDimensions.forEach(dim => {
      let matchedKey = availableFields.find((f: string) => {
        const clean = f.toLowerCase();
        return dim.terms.some(t => clean.includes(t));
      });

      if (!matchedKey) {
        matchedKey = dim.fallback;
      }

      vars.push(matchedKey);
      aliases[matchedKey] = dim.alias;
    });

    setRadarVariables(vars);
    setRadarVariableAliases(aliases);
    setRadarTargetName('Horticultural Requirement Target');
    setRadarBaselineName('Empirical Cohort Baseline (n={n})');
    setRadarTargetValue(100);
    setRadarShowTarget(true);
  };

  return (
    <div className="space-y-4">
      {/* Radar Mode Switcher */}
      <div className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-2xl border border-border/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-foreground">Radar Analysis Mode</span>
          <span className="text-[10px] text-muted-foreground font-mono">Dual-Series / Single</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 bg-card border border-border rounded-xl p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setRadarMode('multi_variable')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all text-center ${
              radarMode === 'multi_variable'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Target className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Requirement Gap (Paradox)</span>
          </button>
          <button
            type="button"
            onClick={() => setRadarMode('qa_breakdown')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all text-center ${
              radarMode === 'qa_breakdown'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">QA Breakdown</span>
          </button>
        </div>
      </div>

      {/* --- MODE A: MULTI-VARIABLE REQUIREMENT GAP --- */}
      {radarMode === 'multi_variable' ? (
        <div className="space-y-3.5">
          {/* Preset & Quick Action Toolbar */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-black text-foreground">
                  Radar Axes ({radarVariables.length})
                </span>
              </div>

              {radarVariables.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllVariables}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold text-destructive hover:bg-destructive/10 border border-destructive/20 flex items-center gap-1 transition-colors"
                  title="Remove all active radar axes"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={handlePreFillHorticulturalParadox}
                className="w-full px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all text-left"
                title="Pre-fill 8 Horticultural Boundary Paradox Dimensions"
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span>Horticultural Paradox Preset</span>
              </button>
              <button
                type="button"
                onClick={handlePreFillAllExtracted}
                className="w-full px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all text-left"
                title="Auto-populate with top extracted variables from active cohort"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Auto-Select Extracted Keys</span>
              </button>
            </div>
          </div>

          {/* Add Variable Autocomplete Search Bar */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 min-w-0">
              <FieldAutocomplete
                value={selectedFieldToAdd}
                onChange={(newKey) => setSelectedFieldToAdd(newKey)}
                discoveredVariables={discoveredVariables}
                availableFields={availableFields}
                placeholder="Search & select variable to add..."
              />
            </div>
            <button
              type="button"
              disabled={!selectedFieldToAdd}
              onClick={() => handleAddVariable(selectedFieldToAdd)}
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold flex items-center gap-1 shadow-xs disabled:opacity-40 transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Axis</span>
            </button>
          </div>

          {/* Active Radar Variables - Responsive Card List */}
          {radarVariables.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-border rounded-2xl bg-secondary/10 space-y-2">
              <Target className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <span className="text-xs font-bold text-foreground block">No Radar Axis Variables Configured</span>
              <span className="text-[11px] text-muted-foreground block max-w-sm mx-auto">
                Click <strong>"Horticultural Paradox Preset"</strong> or search extracted keys above to populate your radar chart.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {radarVariables.map((vKey, idx) => {
                const stats = variableStats[vKey] || { count: 0, pct: 0 };
                const alias = radarVariableAliases[vKey] || getAutoAlias(vKey);
                const targetVal = radarVariableTargets[vKey] ?? radarTargetValue;
                const isPositive = stats.count > 0;

                return (
                  <div 
                    key={vKey} 
                    className="p-3 bg-card border border-border/80 rounded-2xl shadow-xs space-y-2 hover:border-primary/40 transition-all group"
                  >
                    {/* Top Row: Index, Title Alias, Prevalence Badge, Actions */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-black shrink-0 font-mono">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={alias}
                          onChange={(e) => handleSetAlias(vKey, e.target.value)}
                          placeholder="Display Axis Name"
                          className="flex-1 min-w-[120px] bg-secondary/50 border border-border rounded-lg px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                          title="Click to rename display axis title"
                        />
                      </div>

                      {/* Prevalence Badge */}
                      <span 
                        className={`px-2 py-0.5 rounded-full border text-[10.5px] font-extrabold shrink-0 flex items-center gap-1 ${
                          isPositive 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}
                        title={`Found in ${stats.count} of ${totalCohort} papers (${stats.pct}%)`}
                      >
                        {isPositive ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        <span>{stats.count}/{totalCohort} ({stats.pct}%)</span>
                      </span>

                      {/* Action Buttons: Move Up, Move Down, Delete */}
                      <div className="flex items-center gap-0.5 shrink-0 bg-secondary/60 p-0.5 rounded-lg border border-border/60">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveVariable(idx, 'up')}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          title="Move Axis Counter-Clockwise"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === radarVariables.length - 1}
                          onClick={() => handleMoveVariable(idx, 'down')}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                          title="Move Axis Clockwise"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariable(vKey)}
                          className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove This Axis"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Row: Autocomplete Database Key Selector & Target Requirement */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-border/40 text-xs">
                      {/* Database Key Re-binder via FieldAutocomplete */}
                      <div className="sm:col-span-2 space-y-0.5">
                        <label className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <Tag className="w-3 h-3 text-primary/70" />
                          <span>Source Extracted Field:</span>
                        </label>
                        <FieldAutocomplete
                          value={vKey}
                          onChange={(newKey) => handleRebindVariableKey(vKey, newKey)}
                          discoveredVariables={discoveredVariables}
                          availableFields={availableFields}
                          size="sm"
                          showIntegrityWarning={false}
                        />
                      </div>

                      {/* Target Requirement % */}
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-bold text-muted-foreground block">
                          Target Req %:
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={targetVal}
                            onChange={(e) => handleSetTarget(vKey, Number(e.target.value))}
                            className="w-full bg-secondary/40 border border-border/70 rounded-lg px-2 py-1 text-xs font-bold text-center text-foreground focus:outline-none focus:border-primary"
                          />
                          <span className="text-[10px] font-bold text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Series Custom Labels Card - Collapsible */}
          <div className="p-3.5 bg-secondary/20 border border-border/80 rounded-2xl space-y-3">
            <div 
              onClick={() => setIsMetadataOpen(!isMetadataOpen)}
              className="flex items-center justify-between cursor-pointer select-none"
            >
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-black text-foreground">
                  Dual-Series Metadata & Benchmark Settings
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isMetadataOpen ? 'rotate-180' : ''}`} />
            </div>

            {isMetadataOpen && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-muted-foreground block">
                      Requirement Target Series Name
                    </label>
                    <input
                      type="text"
                      value={radarTargetName}
                      onChange={(e) => setRadarTargetName(e.target.value)}
                      placeholder="Horticultural Requirement Target"
                      className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary shadow-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] font-bold text-muted-foreground block">
                        Empirical Baseline Series Name
                      </label>
                      {!radarBaselineName.includes('{n}') && (
                        <button
                          type="button"
                          onClick={() => setRadarBaselineName(`${radarBaselineName.trim()} (n={n})`)}
                          className="text-[9.5px] font-bold text-primary hover:underline"
                        >
                          + Add (n={'{n}'})
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={radarBaselineName}
                      onChange={(e) => setRadarBaselineName(e.target.value)}
                      placeholder="Empirical Cohort Baseline (n={n})"
                      className="w-full bg-card border border-border rounded-xl px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary shadow-xs"
                    />
                    <span className="text-[9.5px] text-muted-foreground font-mono block">
                      Preview: {radarBaselineName.replace('{n}', String(totalCohort))}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border/50">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={radarShowTarget}
                      onChange={(e) => setRadarShowTarget(e.target.checked)}
                      className="rounded border-border text-primary"
                    />
                    <span>Show Target Benchmark Series</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-medium">Default Target:</span>
                    <input
                      type="range"
                      min={50}
                      max={100}
                      value={radarTargetValue}
                      onChange={(e) => setRadarTargetValue(Number(e.target.value))}
                      className="w-20 accent-primary"
                    />
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={radarTargetValue}
                      onChange={(e) => setRadarTargetValue(Number(e.target.value))}
                      className="w-12 bg-card border border-border rounded-lg px-1 py-0.5 text-xs font-bold text-center text-foreground focus:outline-none focus:border-primary shadow-xs"
                    />
                    <span className="text-xs text-muted-foreground font-bold">%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- MODE B: QA BREAKDOWN ACROSS CATEGORIES --- */
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">
              Primary Grouping Variable (Compares QA1 to QA8 per category)
            </label>
            <FieldAutocomplete
              value={primaryField}
              onChange={(newKey) => setPrimaryField(newKey)}
              discoveredVariables={discoveredVariables}
              availableFields={availableFields}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default RadarDataMappingPanel;

