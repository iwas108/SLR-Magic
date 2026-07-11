'use client';

import React, { useState } from 'react';
import { X, Key, ShieldCheck, AlertCircle, Loader, Eye, EyeOff } from 'lucide-react';

interface VaultKeyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function VaultKeyEditorModal({ isOpen, onClose, onSuccess, showToast }: VaultKeyEditorModalProps) {
  const [keyName, setKeyName] = useState('GEMINI_API_KEY');
  const [plainValue, setPlainValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!plainValue) {
      setError('API Key value is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/vault/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyName,
          plainValue
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save API key to vault');
      }

      showToast?.(`Key '${keyName}' saved and encrypted successfully.`, 'success');
      onSuccess();
      setPlainValue('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card/90 border border-border/80 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Save Key to Vault</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="text-muted-foreground leading-relaxed">
            <p>Input your Gemini API key. This key will be encrypted on the server using AES-256-GCM and saved inside your local SQLite credentials repository.</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Credential Key Name</label>
              <select
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2 outline-none text-foreground transition-all"
                disabled={loading}
              >
                <option value="GEMINI_API_KEY">GEMINI_API_KEY</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">API Key Secret Value</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={plainValue}
                  onChange={(e) => setPlainValue(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 pr-10 outline-none text-foreground transition-all placeholder:text-muted-foreground/30 font-mono"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-3 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            {loading ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Encrypting & Saving...</span>
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Save Encrypted Key
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
