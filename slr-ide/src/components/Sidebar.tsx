'use client';

import React from 'react';
import { LayoutDashboard, Database, ShieldAlert, Play, BadgeCheck, FileOutput, Sun, Moon, Laptop, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeProject?: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: string;
  setTheme: (theme: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, theme, setTheme, onOpenSettings }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
    setMounted(true);
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

  interface MenuItem {
    id: string;
    label: string;
    icon: any;
    disabled: boolean;
    badge?: string;
    children?: { id: string; label: string; badge?: string }[];
  }

  const [expandedParents, setExpandedParents] = React.useState<Record<string, boolean>>({
    'paper-database': true,
    'pre-calibration': true,
    'full-execution': true,
    'post-validation': true,
    'insight-export': true,
  });

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, disabled: false },
    {
      id: 'paper-database',
      label: 'Paper Database',
      icon: Database,
      disabled: false,
      children: [
        { id: 'paper-database-ingestion', label: 'Ingestion Hub' },
        { id: 'paper-database-raw', label: 'Raw Data' }
      ]
    },
    {
      id: 'pre-calibration',
      label: 'Pre-Calibration',
      icon: ShieldAlert,
      disabled: false,
      children: [
        { id: 'pre-calibration-statistics', label: 'Statistics' },
        { id: 'pre-calibration-papers', label: 'Papers' }
      ]
    },
    {
      id: 'full-execution',
      label: 'Pipeline Execution',
      icon: Play,
      disabled: false,
      children: [
        { id: 'pipeline-data-acquisition', label: 'Data Acquisition Pipeline' },
        { id: 'pipeline-llm-operations', label: 'LLM Operations Pipeline' },
        { id: 'pipeline-manual-screening', label: 'Manual Screening Pipeline' },
        { id: 'pipeline-remote-workers', label: 'Remote Workers' }
      ]
    },
    {
      id: 'post-validation',
      label: 'Post-Validation',
      icon: BadgeCheck,
      disabled: false,
      children: [
        { id: 'post-validation-umbrellanizer', label: 'Umbrellanizer' },
        { id: 'post-validation-rolling-batch', label: 'Rolling Batch' }
      ]
    },
    {
      id: 'insight-export',
      label: 'Insight & Export',
      icon: FileOutput,
      disabled: false,
      children: [
        { id: 'insight-export-accounting', label: 'Accounting' },
        { id: 'insight-export-rigor', label: 'Scientific Rigor' },
        { id: 'insight-export-cohort', label: 'Final Cohort' },
        { id: 'insight-export-fair-data', label: 'FAIR Data Export' },
        { id: 'insight-export-gold-mine', label: 'Cloud Gold Mine' }
      ]
    },
  ];

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    if (item.children && item.children.length > 0) {
      setExpandedParents(prev => ({
        ...prev,
        [item.id]: !prev[item.id]
      }));
      setActiveTab(item.children[0].id);
    } else {
      setActiveTab(item.id);
    }
  };

  const isParentOfActive = (item: MenuItem) => {
    return item.children?.some(child => child.id === activeTab) || false;
  };

  return (
    <aside className={`border-r border-border bg-card text-card-foreground flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Upper Navigation */}
      <div className={`flex flex-col flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center justify-between py-4 mb-6 transition-all duration-300 ${isCollapsed ? 'flex-col gap-4 px-1' : 'flex-row px-3'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-lg tracking-wider shadow-md shadow-primary/20 shrink-0">
              SLR
            </div>
            {!isCollapsed && (
              <div className="transition-opacity duration-300 opacity-100 whitespace-nowrap">
                <h1 className="font-bold text-sm tracking-tight">SLR Magic</h1>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Desktop Hub</span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id || isParentOfActive(item);

            const Component = item.children ? 'div' : 'button';

            return (
              <div key={item.id} className="space-y-1">
                <Component
                  {...(item.children ? {} : { disabled: item.disabled })}
                  onClick={() => handleItemClick(item)}
                  className={`relative w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-200 group text-left cursor-pointer ${
                    isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                      : item.disabled
                      ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${!item.disabled && 'group-hover:scale-110'}`} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {isCollapsed && !item.children && (
                    <span className="absolute left-14 scale-0 rounded bg-popover border border-border px-2 py-1 text-xs font-medium text-popover-foreground shadow-md transition-all duration-200 group-hover:scale-100 z-50 whitespace-nowrap pointer-events-none origin-left">
                      {item.label}
                    </span>
                  )}
                  {isCollapsed && item.children && (
                    <div className="absolute left-14 top-0 scale-0 group-hover:scale-100 flex flex-col bg-popover border border-border rounded-lg p-2 shadow-lg transition-all duration-200 z-50 min-w-44 origin-left text-left pointer-events-auto">
                      <div className="px-2 py-1 font-bold text-[10px] text-muted-foreground uppercase border-b border-border mb-1.5 tracking-wider">
                        {item.label}
                      </div>
                      <div className="space-y-1">
                        {item.children.map((child) => {
                          const isChildActive = activeTab === child.id;
                          return (
                            <button
                              key={child.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab(child.id);
                              }}
                              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                isChildActive
                                  ? 'bg-primary text-primary-foreground font-semibold'
                                  : 'text-foreground hover:bg-secondary'
                              }`}
                            >
                              {child.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Component>

                {!isCollapsed && item.children && expandedParents[item.id] && (
                  <div className="pl-6 mt-1 space-y-1 animate-in slide-in-from-top-1 duration-150">
                    {item.children.map((child) => {
                      const isChildActive = activeTab === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => setActiveTab(child.id)}
                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-150 text-left ${
                            isChildActive
                              ? 'bg-secondary text-foreground font-semibold border-l-2 border-primary pl-2'
                              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                          }`}
                        >
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer Settings & Theme */}
      <div className={`border-t border-border bg-secondary/20 space-y-4 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className={`relative w-full flex items-center rounded-lg text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 text-left group cursor-pointer ${
            isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
          }`}
        >
          <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
          {!isCollapsed && <span>Global Settings</span>}
          {isCollapsed && (
            <span className="absolute left-14 scale-0 rounded bg-popover border border-border px-2 py-1 text-xs font-medium text-popover-foreground shadow-md transition-all duration-200 group-hover:scale-100 z-50 whitespace-nowrap pointer-events-none origin-left">
              Global Settings
            </span>
          )}
        </button>

        {/* Theme Selectors */}
        <div className={`flex items-center bg-secondary rounded-lg border border-border p-1 ${isCollapsed ? 'flex-col gap-1' : 'justify-between'}`}>
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
                className={`relative group/theme w-full flex justify-center py-1.5 rounded-md text-muted-foreground transition-all duration-150 hover:text-foreground cursor-pointer ${
                  isSelected ? 'bg-background text-foreground shadow-sm border border-border/50' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <ModeIcon className="w-3.5 h-3.5 shrink-0" />
                {isCollapsed && (
                  <span className="absolute left-14 scale-0 rounded bg-popover border border-border px-2 py-1 text-xs font-medium text-popover-foreground shadow-md transition-all duration-200 group-hover/theme:scale-100 z-50 whitespace-nowrap pointer-events-none origin-left">
                    {mode.label} Mode
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

