import React from 'react';
import { ChevronRight, RotateCcw } from 'lucide-react';

export interface CollapsibleToolboxProps {
  id: string;
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  summaryBadge?: React.ReactNode;
  toggleSwitch?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
  };
  onReset?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleToolbox({
  id,
  title,
  icon: Icon,
  isOpen,
  onToggle,
  summaryBadge,
  toggleSwitch,
  onReset,
  children,
  className = ''
}: CollapsibleToolboxProps) {
  return (
    <div className={`border border-border/70 rounded-xl overflow-hidden bg-card/70 transition-all shadow-xs ${isOpen ? 'border-primary/40 ring-1 ring-primary/10' : 'hover:border-border'} ${className}`}>
      {/* Premiere-style Header Bar */}
      <div 
        onClick={onToggle}
        className="w-full px-3.5 py-2.5 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between cursor-pointer select-none transition-colors border-b border-transparent data-[open=true]:border-border/60"
        data-open={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Disclosure Chevron */}
          <div className={`text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90 text-primary' : ''}`}>
            <ChevronRight className="w-4 h-4" />
          </div>

          {/* Icon Badge */}
          <div className="p-1 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Icon className="w-3.5 h-3.5" />
          </div>

          {/* Section Title */}
          <span className="text-xs font-bold text-foreground tracking-tight truncate">
            {title}
          </span>
        </div>

        {/* Right Side: Summary Chip, Toggle Switch, Reset */}
        <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {summaryBadge && (
            <div className="hidden sm:inline-flex items-center text-[10px] font-mono text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-md border border-border/50 truncate max-w-[180px]">
              {summaryBadge}
            </div>
          )}

          {toggleSwitch && (
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-muted-foreground hover:text-foreground">
              <input
                type="checkbox"
                checked={toggleSwitch.checked}
                onChange={(e) => toggleSwitch.onChange(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary accent-primary cursor-pointer"
              />
              {toggleSwitch.label && <span className="hidden md:inline">{toggleSwitch.label}</span>}
            </label>
          )}

          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-secondary/80 transition-colors"
              title="Reset toolbox to defaults"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content Area */}
      {isOpen && (
        <div className="p-3.5 bg-background/40 space-y-4 border-t border-border/50 animate-in fade-in-50 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}
