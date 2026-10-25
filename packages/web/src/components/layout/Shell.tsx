import React from 'react';
import {
  Compass,
  Inbox,
  FolderTree,
  Activity,
  HeartPulse,
  Settings,
  Search,
  Bot,
  AlertTriangle,
  GitBranch,
  Eye,
  Sun,
  Moon
} from 'lucide-react';

export type ShellView = 'overview' | 'inbox' | 'explore' | 'activity' | 'health' | 'setup';

export interface ShellProps {
  projectName: string;
  branchName: string;
  activeAgentsCount: number;
  outdatedCount: number;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenCommandPalette: () => void;
  onToggleTheme: () => void;
  isDarkTheme: boolean;
  activeView: ShellView;
  onChangeView: (view: ShellView) => void;
  children: React.ReactNode;
  activeAgentStatus?: string;
}

export function Shell({
  projectName,
  branchName,
  activeAgentsCount,
  outdatedCount,
  isFocusMode,
  onToggleFocusMode,
  onOpenCommandPalette,
  onToggleTheme,
  isDarkTheme,
  activeView,
  onChangeView,
  children,
  activeAgentStatus
}: ShellProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text font-ui">
      {/* 1. Top Bar (48px) */}
      <header
        className="h-12 border-b border-border bg-surface px-4 flex items-center justify-between flex-shrink-0 z-20"
        data-testid="top-bar"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm tracking-tight text-text">
            <Compass className="w-5 h-5 text-accent" />
            <span>{projectName}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-surface-2 border border-border text-xs font-mono text-text-muted">
            <GitBranch className="w-3.5 h-3.5 text-text-faint" />
            <span>{branchName}</span>
          </div>
        </div>

        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-text-faint bg-surface-2/60 hover:bg-surface-2 border border-border rounded-control transition-colors w-72 justify-between"
          data-testid="command-palette-trigger"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Jump, find, or search task...</span>
          </div>
          <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[10px]">
            ⌘K
          </kbd>
        </button>

        {/* Status Indicators & Utility Buttons */}
        <div className="flex items-center gap-3">
          {activeAgentsCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-mono text-status-fresh-fg">
              <Bot className="w-3.5 h-3.5" />
              <span>{activeAgentsCount} agents</span>
            </div>
          )}

          {outdatedCount > 0 && (
            <div className="flex items-center gap-1 text-xs font-mono text-status-outdated-fg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{outdatedCount} outdated</span>
            </div>
          )}

          <div className="h-4 w-px bg-border" />

          <button
            onClick={onToggleFocusMode}
            className={`p-1.5 rounded-control transition-colors ${
              isFocusMode ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
            title="Toggle Focus Mode (F)"
            data-testid="focus-mode-toggle"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-control text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Toggle Theme"
          >
            {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 2. Middle Body (Left Rail + Main Content) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Rail (56px) - Hidden in Focus Mode */}
        {!isFocusMode && (
          <aside
            className="w-14 border-r border-border bg-surface flex flex-col items-center py-3 gap-2 flex-shrink-0 z-10"
            data-testid="left-rail"
          >
            {[
              { id: 'explore' as const, icon: FolderTree, label: 'Explorer' },
              { id: 'inbox' as const, icon: Inbox, label: 'Inbox', badge: 3 },
              { id: 'overview' as const, icon: Compass, label: 'Overview' },
              { id: 'activity' as const, icon: Activity, label: 'Activity' },
              { id: 'health' as const, icon: HeartPulse, label: 'Health' },
              { id: 'setup' as const, icon: Settings, label: 'Setup' }
            ].map((nav) => {
              const Icon = nav.icon;
              const isActive = activeView === nav.id;

              return (
                <button
                  key={nav.id}
                  onClick={() => onChangeView(nav.id)}
                  className={`relative p-2.5 rounded-control transition-colors ${
                    isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-text-muted hover:text-text hover:bg-surface-2'
                  }`}
                  title={nav.label}
                  data-testid={`nav-${nav.id}`}
                >
                  <Icon className="w-5 h-5" />
                  {nav.badge && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-status-outdated-fg" />
                  )}
                </button>
              );
            })}
          </aside>
        )}

        {/* Main Work Area */}
        <main className="flex-1 flex overflow-hidden bg-bg">
          {children}
        </main>
      </div>

      {/* 3. Status Strip (32px) */}
      <footer
        className="h-8 border-t border-border bg-surface px-4 flex items-center justify-between text-xs font-mono text-text-faint flex-shrink-0 z-20"
        data-testid="status-strip"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-status-fresh-fg animate-pulse" />
          <span>
            {activeAgentStatus || 'Orient daemon active on 127.0.0.1:4477 · Stdio MCP connected'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>Local-first map</span>
          <span>·</span>
          <span>Dual-audience verified</span>
        </div>
      </footer>
    </div>
  );
}
