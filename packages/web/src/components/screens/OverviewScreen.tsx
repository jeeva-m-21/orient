import React from 'react';
import {
  Compass,
  Play,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';
import type { Card } from '@orient/schema';

export interface OverviewScreenProps {
  repoCard: Card;
  onNavigateToCard: (path: string) => void;
  onStartExploring: () => void;
  className?: string;
}

export function OverviewScreen({
  repoCard,
  onNavigateToCard,
  onStartExploring,
  className = ''
}: OverviewScreenProps): React.JSX.Element {
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  const handleCopy = (cmd: string): void => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const stack = ['TypeScript 5.6', 'Next.js 15 (App Router)', 'Tailwind CSS', 'PostgreSQL'];
  const runCommands = [
    { label: 'Start Development', cmd: 'pnpm dev' },
    { label: 'Run Full Test Suite', cmd: 'pnpm test' },
    { label: 'Verify Architecture in CI', cmd: 'orient ci' }
  ];

  const findings = [
    { id: '1', title: 'Untested payment webhook logic', path: 'src/billing', severity: 'warn' },
    { id: '2', title: 'Outdated card metadata', path: 'src/billing', severity: 'info' },
    { id: '3', title: 'High centrality module (12 reverse imports)', path: 'src/auth/jwt.ts', severity: 'info' }
  ];

  return (
    <div
      className={`flex-1 overflow-y-auto p-8 space-y-8 max-w-5xl mx-auto font-ui ${className}`}
      data-testid="overview-screen"
    >
      {/* 1. Repo Hero Card */}
      <div className="bg-surface border border-border rounded-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-control bg-accent/10 text-accent">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text tracking-tight">acme-commerce</h1>
              <p className="text-xs font-mono text-text-muted">Repository Overview & Verification</p>
            </div>
          </div>
          <button
            onClick={onStartExploring}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-accent hover:bg-accent/90 text-white font-medium text-xs active:scale-[0.98] transition-all shadow-xs"
            data-testid="start-here-btn"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start Here Path
          </button>
        </div>

        <p className="text-sm text-text-muted leading-relaxed font-ui">
          {repoCard.authored.purpose}
        </p>

        {/* Stack Version Badges */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
          <span className="text-xs font-mono text-text-faint mr-2">Stack:</span>
          {stack.map((item) => (
            <span
              key={item}
              className="px-2.5 py-0.5 rounded-control font-code text-xs font-medium bg-surface-2 border border-border text-text-muted"
            >
              {item}
            </span>
          ))}
        </div>

        {/* Copyable Run Commands */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {runCommands.map(({ label, cmd }) => (
            <div
              key={cmd}
              onClick={() => handleCopy(cmd)}
              className="flex items-center justify-between p-2.5 rounded-control bg-surface-2/60 hover:bg-surface-2 border border-border cursor-pointer transition-colors group"
            >
              <div>
                <span className="text-[11px] text-text-faint block">{label}</span>
                <span className="font-code text-xs text-text font-medium">{cmd}</span>
              </div>
              <button className="text-text-faint group-hover:text-text p-1">
                {copiedCmd === cmd ? (
                  <Check className="w-3.5 h-3.5 text-status-fresh-fg" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Runtime Strip */}
      <div className="bg-surface border border-border rounded-card p-4 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-text-faint">
          <Terminal className="w-4 h-4 text-accent" />
          <span>RUNTIME SERVICES:</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface-2 border border-border">
            <span className="w-2 h-2 rounded-full bg-status-fresh-fg" />
            <span className="text-text">web :3000</span>
            <span className="text-status-fresh-fg">up</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface-2 border border-border">
            <span className="w-2 h-2 rounded-full bg-status-fresh-fg" />
            <span className="text-text">api :4477</span>
            <span className="text-status-fresh-fg">up</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface-2 border border-border">
            <span className="w-2 h-2 rounded-full bg-status-outdated-fg" />
            <span className="text-text">postgres :5432</span>
            <span className="text-status-outdated-fg">down</span>
          </div>
        </div>
      </div>

      {/* 3. Freshness Summary & Architecture Findings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Freshness Summary Card */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-status-fresh-fg" /> Architecture Freshness
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold font-code text-text">86%</span>
            <span className="text-xs font-mono text-status-fresh-fg">VERIFIED FRESH</span>
          </div>
          <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden flex">
            <div className="bg-status-fresh-fg h-full" style={{ width: '86%' }} />
            <div className="bg-status-outdated-fg h-full" style={{ width: '14%' }} />
          </div>
          <div className="flex justify-between text-xs font-mono text-text-faint pt-1">
            <span>6 Fresh cards</span>
            <span>1 Outdated card</span>
            <span>0 Unreported</span>
          </div>
        </div>

        {/* Structural Findings (Top 3) */}
        <div className="bg-surface border border-border rounded-card p-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-status-drifted-fg" /> Top Findings
          </h3>
          <div className="space-y-2">
            {findings.map((finding) => (
              <div
                key={finding.id}
                onClick={() => onNavigateToCard(finding.path)}
                className="flex items-center justify-between p-2 rounded-control bg-surface-2/40 hover:bg-surface-2 border border-border/40 hover:border-border cursor-pointer transition-colors text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${finding.severity === 'warn' ? 'bg-status-outdated-fg' : 'bg-accent'}`} />
                  <span className="text-text font-medium">{finding.title}</span>
                </div>
                <div className="flex items-center gap-1 text-accent font-code font-medium">
                  <span>{finding.path}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
