'use client';

import React from 'react';
import { LayoutDashboard, Database, ShieldAlert, Play, BadgeCheck, FileOutput, Sun, Moon, Laptop, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, theme, setTheme, onOpenSettings }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, disabled: false },
    { id: 'database', label: 'Paper Database', icon: Database, disabled: false },
    { id: 'pre-calibration', label: 'Pre-Calibration', icon: ShieldAlert, disabled: false },
    { id: 'full-execution', label: 'Full Execution', icon: Play, disabled: true, badge: 'On Hold' },
    { id: 'post-validation', label: 'Post-Validation', icon: BadgeCheck, disabled: true, badge: 'On Hold' },
    { id: 'accounting-export', label: 'Accounting & Export', icon: FileOutput, disabled: true, badge: 'On Hold' },
  ];

  return (
    <aside className="w-64 border-r border-border bg-card text-card-foreground flex flex-col justify-between shrink-0 select-none">
      {/* Upper Navigation */}
      <div className="flex flex-col flex-1 p-4 overflow-y-auto">
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-lg tracking-wider shadow-md shadow-primary/20">
            SLR
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">SLR Magic</h1>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Desktop Hub</span>
          </div>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => !item.disabled && setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 group text-left ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                    : item.disabled
                    ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${!item.disabled && 'group-hover:scale-110'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Settings & Theme */}
      <div className="p-4 border-t border-border bg-secondary/20 space-y-4">
        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 text-left"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span>Global Settings</span>
        </button>

        {/* Theme Selectors */}
        <div className="flex items-center justify-between p-1 bg-secondary rounded-lg border border-border">
          {[
            { id: 'light', icon: Sun, label: 'Light' },
            { id: 'dark', icon: Moon, label: 'Dark' },
            { id: 'system', icon: Laptop, label: 'System' }
          ].map((mode) => {
            const ModeIcon = mode.icon;
            const isSelected = theme === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => setTheme(mode.id)}
                title={`${mode.label} Mode`}
                className={`flex-1 flex justify-center py-1.5 rounded-md text-muted-foreground transition-all duration-150 hover:text-foreground ${
                  isSelected ? 'bg-background text-foreground shadow-sm border border-border/50' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <ModeIcon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
