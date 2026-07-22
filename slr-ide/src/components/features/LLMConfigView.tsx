import React, { useState } from 'react';
import { Save, Banknote } from 'lucide-react';

interface LLMConfigViewProps {
  activeProject: any;
  loadProjects: () => void;
  showToast: (msg: string, type: 'success'|'error'|'info'|'warning') => void;
  budgetLimit?: string;
  setBudgetLimit?: (v: string) => void;
  taxRate?: string;
  setTaxRate?: (v: string) => void;
  isInsideModal?: boolean;
}

export default function LLMConfigView({ 
  activeProject, 
  loadProjects, 
  showToast,
  budgetLimit: propBudgetLimit,
  setBudgetLimit: propSetBudgetLimit,
  taxRate: propTaxRate,
  setTaxRate: propSetTaxRate,
  isInsideModal = false
}: LLMConfigViewProps) {
  const [saving, setSaving] = useState(false);
  const [localBudgetLimit, setLocalBudgetLimit] = useState(activeProject?.project_budget_limit || 5.0);
  const [localTaxRate, setLocalTaxRate] = useState(activeProject?.project_tax !== undefined ? activeProject.project_tax : 0.0);

  const budgetLimit = isInsideModal ? (propBudgetLimit ?? '5.0') : localBudgetLimit;
  const setBudgetLimit = isInsideModal ? (propSetBudgetLimit ?? (() => {})) : setLocalBudgetLimit;
  const taxRate = isInsideModal ? (propTaxRate ?? '0.0') : localTaxRate;
  const setTaxRate = isInsideModal ? (propSetTaxRate ?? (() => {})) : setLocalTaxRate;

  React.useEffect(() => {
    if (!isInsideModal) {
      setLocalBudgetLimit(activeProject?.project_budget_limit || 5.0);
      setLocalTaxRate(activeProject?.project_tax !== undefined ? activeProject.project_tax : 0.0);
    }
  }, [activeProject, isInsideModal]);

  if (!activeProject) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activeProject,
          project_budget_limit: Number(budgetLimit),
          project_tax: Number(taxRate)
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast('Budget settings saved successfully', 'success');
        loadProjects(); // reload to update parent state
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save budget settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
      <div className="px-5 py-4 border-b border-border/50 bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Budget Settings</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Project Spend Limits</p>
          </div>
        </div>
        {!isInsideModal && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow hover:bg-primary/90 hover:shadow-md transition-all disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        )}
      </div>

      <div className="flex-1 p-6 space-y-6 text-xs">
        {/* Budget & Safety */}
        <section className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-bold text-destructive">Maximum Project Budget ($)</label>
                <p className="text-[10px] text-destructive/80 font-medium">
                  The LLM pipeline execution will pause if the cumulative token cost of the project exceeds this threshold.
                </p>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                <input 
                  type="number" 
                  min="0.1" step="0.1"
                  value={budgetLimit} 
                  onChange={(e) => setBudgetLimit(e.target.value)}
                  className="w-full bg-background border border-destructive/30 rounded-lg pl-7 pr-3 py-2 font-mono text-sm font-bold text-foreground focus:ring-1 focus:ring-destructive outline-none transition-shadow"
                />
              </div>
            </div>
          </div>

          <div className="bg-secondary/10 border border-border/80 rounded-xl p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-bold text-foreground">Tax Rate (fraction/percentage)</label>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Apply a tax rate multiplier to the calculated token spends (e.g. 0.20 for 20% tax).
                </p>
              </div>
              <div className="relative w-32">
                <input 
                  type="number" 
                  min="0" max="1" step="0.01"
                  value={taxRate} 
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full bg-background border border-border/60 rounded-lg px-3 py-2 font-mono text-sm font-bold text-foreground focus:ring-1 focus:ring-primary outline-none transition-shadow text-right"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
