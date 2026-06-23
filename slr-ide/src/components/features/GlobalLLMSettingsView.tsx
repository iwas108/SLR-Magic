'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Loader, CheckCircle2, Save } from 'lucide-react';

export default function GlobalLLMSettingsView({ showToast }: { showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void }) {
  const [envData, setEnvData] = useState({
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: ''
  });
  const [pricingStr, setPricingStr] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [savingEnv, setSavingEnv] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/config/env').then(res => res.json()),
      fetch('/api/llm/pricing').then(res => res.json())
    ]).then(([envRes, pricingRes]) => {
      if (envRes.success) {
        setEnvData({
          OPENAI_API_KEY: envRes.data.OPENAI_API_KEY || '',
          GEMINI_API_KEY: envRes.data.GEMINI_API_KEY || '',
          ANTHROPIC_API_KEY: envRes.data.ANTHROPIC_API_KEY || ''
        });
      }
      if (pricingRes.success) {
        setPricingStr(JSON.stringify(pricingRes.models, null, 2));
      }
      setLoading(false);
    }).catch(err => {
      console.error(err);
      showToast?.('Failed to load global LLM settings', 'error');
      setLoading(false);
    });
  }, [showToast]);

  const handleSaveEnv = async () => {
    setSavingEnv(true);
    try {
      const res = await fetch('/api/config/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envData)
      });
      if (res.ok) {
        showToast?.('API Keys saved successfully to .env.local', 'success');
      } else {
        showToast?.('Failed to save API Keys', 'error');
      }
    } catch (err) {
      showToast?.('Error saving API Keys', 'error');
    } finally {
      setSavingEnv(false);
    }
  };

  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      const models = JSON.parse(pricingStr);
      if (!Array.isArray(models)) {
        throw new Error('Pricing data must be a JSON array of models');
      }
      const res = await fetch('/api/llm/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models })
      });
      if (res.ok) {
        showToast?.('Model pricing saved successfully', 'success');
      } else {
        const errorData = await res.json();
        showToast?.(errorData.error || 'Failed to save model pricing', 'error');
      }
    } catch (err: any) {
      showToast?.(err.message || 'Invalid JSON format', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs font-medium">Loading LLM settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      {/* API Keys */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-foreground border-b border-border pb-2">Global API Keys</h4>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">OpenAI API Key</label>
            <input
              type="password"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
              value={envData.OPENAI_API_KEY}
              onChange={(e) => setEnvData({ ...envData, OPENAI_API_KEY: e.target.value })}
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Gemini API Key</label>
            <input
              type="password"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
              value={envData.GEMINI_API_KEY}
              onChange={(e) => setEnvData({ ...envData, GEMINI_API_KEY: e.target.value })}
              placeholder="AIza..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-muted-foreground">Anthropic API Key</label>
            <input
              type="password"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px]"
              value={envData.ANTHROPIC_API_KEY}
              onChange={(e) => setEnvData({ ...envData, ANTHROPIC_API_KEY: e.target.value })}
              placeholder="sk-ant-..."
            />
          </div>
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSaveEnv}
            disabled={savingEnv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {savingEnv ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save API Keys
          </button>
        </div>
      </div>

      {/* Model Pricing */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-foreground border-b border-border pb-2">Model Pricing Definitions</h4>
        <p className="text-[10px] text-muted-foreground">Provide a JSON array of model definitions. These are used globally to calculate costs.</p>
        <div className="space-y-1.5">
          <textarea
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary font-mono text-[11px] h-48"
            value={pricingStr}
            onChange={(e) => setPricingStr(e.target.value)}
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSavePricing}
            disabled={savingPricing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {savingPricing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Pricing
          </button>
        </div>
      </div>
    </div>
  );
}
