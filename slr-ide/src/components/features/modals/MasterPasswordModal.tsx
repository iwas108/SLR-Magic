'use client';

import React, { useState } from 'react';
import { X, Lock, KeyRound, ShieldCheck, AlertCircle, Loader } from 'lucide-react';

interface MasterPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSetup: boolean;
  onSuccess: (password: string) => void;
}

export default function MasterPasswordModal({ isOpen, onClose, isSetup, onSuccess }: MasterPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Password is required');
      return;
    }

    if (isSetup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          action: isSetup ? 'setup' : 'unlock'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      onSuccess(password);
      setPassword('');
      setConfirmPassword('');
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
        {/* Decorative background gradients */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-36 h-36 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              {isSetup ? 'Setup Master Password' : 'Unlock Encrypted Vault'}
            </h3>
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
            {isSetup ? (
              <p>Create a master password to secure your API keys locally. Keys are encrypted using AES-256-GCM. <strong>If forgotten, keys cannot be recovered.</strong></p>
            ) : (
              <p>Enter your master password to unlock the encrypted vault. This password is cached only in system memory for your active session.</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Master Password</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 pl-9 outline-none text-foreground transition-all placeholder:text-muted-foreground/30"
                  disabled={loading}
                />
                <KeyRound className="w-3.5 h-3.5 text-muted-foreground/50 absolute left-3 top-3" />
              </div>
            </div>

            {isSetup && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <label className="font-bold text-muted-foreground">Confirm Password</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-secondary/40 border border-border/80 focus:border-primary/80 rounded-xl px-3 py-2 pl-9 outline-none text-foreground transition-all placeholder:text-muted-foreground/30"
                    disabled={loading}
                  />
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 absolute left-3 top-3" />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
          >
            {loading ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isSetup ? 'Initialize Vault' : 'Unlock Vault'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
