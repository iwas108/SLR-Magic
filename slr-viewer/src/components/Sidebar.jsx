import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileOutput,
  Sun,
  Moon,
  Laptop,
  ChevronLeft,
  ChevronRight,
  Eye,
  Target,
  Table,
  DollarSign,
  Upload,
  Database,
  GitFork
} from 'lucide-react';
import { useViewerData } from '../context/ViewerContext';

export default function Sidebar({ theme, setTheme, onOpenImportModal }) {
  const { activeTab, setActiveTab, activeSession } = useViewerData();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('slr_viewer_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('slr_viewer_sidebar_collapsed', String(nextState));
  };

  const activeProjectName = activeSession?.projectName || 'No Active Workspace';

  return (
    <aside
      className={`border-r border-border bg-card text-card-foreground flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Upper Navigation */}
      <div className={`flex flex-col flex-1 overflow-y-auto transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        {/* Header Logo */}
        <div className={`flex items-center justify-between py-3 mb-6 border-b border-border/50 pb-4 transition-all duration-300 ${isCollapsed ? 'flex-col gap-4 px-1' : 'flex-row px-2'}`}>
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg tracking-wider shadow-md shadow-primary/20 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="transition-opacity duration-300 opacity-100 whitespace-nowrap">
                <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                  SLR Viewer
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    SPA
                  </span>
                </h1>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest block truncate max-w-[140px]" title={activeProjectName}>
                  {activeProjectName}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-all duration-150 cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-4">
          {/* Section 1: Workspaces & Dashboard */}
          <div>
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Workspaces
              </p>
            )}
            <div className="space-y-1">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                } ${isCollapsed ? 'justify-center p-2.5' : ''}`}
                title="Workspace Dashboard"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>Sessions Board</span>}
              </button>
            </div>
          </div>

          {/* Section 2: Insight & Export */}
          <div>
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Insight & Export
              </p>
            )}
            <div className="space-y-1">
              {[
                { id: 'insight-export-workflow', label: 'Research Workflow', icon: GitFork },
                { id: 'insight-export-rigor', label: 'Scientific Rigor', icon: Target },
                { id: 'insight-export-cohort', label: 'Final Cohort', icon: Table },
                { id: 'insight-export-accounting', label: 'Accounting', icon: DollarSign },
                { id: 'insight-export-fair-data', label: 'FAIR Data Export', icon: Database }
              ].map((child) => {
                const isChildActive = activeTab === child.id;
                const ChildIcon = child.icon;
                return (
                  <button
                    key={child.id}
                    onClick={() => setActiveTab(child.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 text-left cursor-pointer ${
                      isChildActive
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    } ${isCollapsed ? 'justify-center p-2.5' : ''}`}
                    title={child.label}
                  >
                    <ChildIcon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>{child.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Footer Theme Switcher */}
      <div className={`border-t border-border bg-secondary/20 transition-all duration-300 ${isCollapsed ? 'p-2' : 'p-4'}`}>
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
                title={`${mode.label} Mode`}
              >
                <ModeIcon className="w-3.5 h-3.5 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
