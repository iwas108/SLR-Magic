'use client';

import React from 'react';
import { X, Settings, Sliders, Type, Layout, Image as ImageIcon } from 'lucide-react';

export interface PrismaConfig {
  collapseEmptyColumn: boolean;
  colorTheme: 'appTheme' | 'monochrome';
  fontFamily: string;
  baseFontSize: number;
  boxBorderRadius: number;
  boxPadding: number;
  exportScale: number;
}

interface PrismaConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PrismaConfig;
  onChange: (newConfig: PrismaConfig) => void;
  otherMethodsCount: number;
}

export default function PrismaConfigModal({
  isOpen,
  onClose,
  config,
  onChange,
  otherMethodsCount
}: PrismaConfigModalProps) {
  if (!isOpen) return null;

  const updateKey = <K extends keyof PrismaConfig>(key: K, value: PrismaConfig[K]) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  const isCollapseDisabled = otherMethodsCount > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/10">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Configure PRISMA Flowchart</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          
          {/* Layout Configuration */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5" /> Layout Settings
            </h4>
            <div className="p-4 bg-secondary/20 border border-border/65 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="collapseEmptyColumn"
                  checked={config.collapseEmptyColumn && !isCollapseDisabled}
                  disabled={isCollapseDisabled}
                  onChange={(e) => updateKey('collapseEmptyColumn', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="space-y-1">
                  <label
                    htmlFor="collapseEmptyColumn"
                    className={`text-xs font-semibold ${
                      isCollapseDisabled ? 'text-muted-foreground cursor-not-allowed' : 'text-foreground cursor-pointer'
                    }`}
                  >
                    Collapse Empty Column
                  </label>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    {isCollapseDisabled
                      ? `Disabled: "Other Methods" column contains papers (n = ${otherMethodsCount}).`
                      : 'If there are no papers identified via other methods, collapse the right column and center the database flow.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Theme & Style */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Color Theme Preset
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateKey('colorTheme', 'appTheme')}
                className={`p-3 border rounded-lg text-left transition-all ${
                  config.colorTheme === 'appTheme'
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card text-foreground hover:bg-secondary/40'
                }`}
              >
                <div className="text-xs font-semibold">App Theme</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Matches light/dark mode styles of the application.
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateKey('colorTheme', 'monochrome')}
                className={`p-3 border rounded-lg text-left transition-all ${
                  config.colorTheme === 'monochrome'
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-border bg-card text-foreground hover:bg-secondary/40'
                }`}
              >
                <div className="text-xs font-semibold">Journal Monochrome</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  Strict black text, white background, black borders for print.
                </div>
              </button>
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5" /> Typography Settings
            </h4>
            <div className="p-4 bg-secondary/20 border border-border/65 rounded-lg space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Font Family</label>
                <select
                  value={config.fontFamily}
                  onChange={(e) => updateKey('fontFamily', e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="Inter, system-ui, sans-serif">Inter (Modern Sans)</option>
                  <option value="Arial, sans-serif">Arial (Clean Sans)</option>
                  <option value="Times New Roman, serif">Times New Roman (Academic Serif)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-foreground">
                  <span className="font-semibold">Base Font Size</span>
                  <span className="font-mono text-muted-foreground">{config.baseFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                  value={config.baseFontSize}
                  onChange={(e) => updateKey('baseFontSize', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Box Styling */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" /> Box Design & Spacing
            </h4>
            <div className="p-4 bg-secondary/20 border border-border/65 rounded-lg space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-foreground">
                  <span className="font-semibold">Box Border Radius</span>
                  <span className="font-mono text-muted-foreground">{config.boxBorderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={config.boxBorderRadius}
                  onChange={(e) => updateKey('boxBorderRadius', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-foreground">
                  <span className="font-semibold">Box Padding</span>
                  <span className="font-mono text-muted-foreground">{config.boxPadding}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="40"
                  step="1"
                  value={config.boxPadding}
                  onChange={(e) => updateKey('boxPadding', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Export Quality */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Image Export Scale
            </h4>
            <div className="p-4 bg-secondary/20 border border-border/65 rounded-lg space-y-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-foreground">Scale / Resolution Multiplier</label>
                <select
                  value={config.exportScale}
                  onChange={(e) => updateKey('exportScale', parseInt(e.target.value))}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="1">1x Web (2400 x 1700 px)</option>
                  <option value="2">2x Retina High-DPI (4800 x 3400 px)</option>
                  <option value="4">4x Print/300DPI Elsevier Ready (9600 x 6800 px)</option>
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Higher scale values increase the backing canvas resolution for high-quality print publications, preserving perfect text clarity.
              </p>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-secondary/10 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
}
