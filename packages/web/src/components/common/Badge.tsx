import React from 'react';
import type { StalenessState, Source, Confidence } from '@orient/schema';

export interface StatusBadgeProps {
  state: StalenessState;
  className?: string;
}

export function StatusBadge({ state, className = '' }: StatusBadgeProps): React.JSX.Element {
  const stateStyles: Record<StalenessState, { fg: string; bg: string; dot: string }> = {
    Fresh: {
      fg: 'text-status-fresh-fg',
      bg: 'bg-status-fresh-bg',
      dot: 'bg-status-fresh-fg'
    },
    Drifted: {
      fg: 'text-status-drifted-fg',
      bg: 'bg-status-drifted-bg',
      dot: 'bg-status-drifted-fg'
    },
    Outdated: {
      fg: 'text-status-outdated-fg',
      bg: 'bg-status-outdated-bg',
      dot: 'bg-status-outdated-fg'
    },
    Affected: {
      fg: 'text-status-affected-fg',
      bg: 'bg-status-affected-bg',
      dot: 'bg-status-affected-fg'
    },
    Unknown: {
      fg: 'text-status-unknown-fg',
      bg: 'bg-status-unknown-bg',
      dot: 'bg-status-unknown-fg'
    }
  };

  const style = stateStyles[state] || stateStyles.Unknown;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.fg} ${className}`}
      data-testid="status-badge"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {state}
    </span>
  );
}

export interface SourceBadgeProps {
  source: Source;
  className?: string;
}

export function SourceBadge({ source, className = '' }: SourceBadgeProps): React.JSX.Element {
  const sourceStyles: Record<Source, string> = {
    'human': 'border-accent text-accent bg-accent/5',
    'agent-reported': 'border-border text-text-muted bg-surface-2',
    'generated': 'border-dashed border-border text-text-muted bg-surface-2'
  };

  const style = sourceStyles[source] || sourceStyles.generated;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono border ${style} ${className}`}
      data-testid="source-badge"
    >
      {source}
    </span>
  );
}

export interface AgentBadgeProps {
  name: string;
  color?: string;
  className?: string;
}

export function AgentBadge({ name, color, className = '' }: AgentBadgeProps): React.JSX.Element {
  // Deterministic agent color based on name hash if not provided
  const palette = ['var(--agent-coral)', 'var(--agent-green)', 'var(--agent-violet)', 'var(--agent-amber)', 'var(--agent-cyan)', 'var(--agent-magenta)'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const assignedColor = color || palette[Math.abs(hash) % palette.length];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-text-muted ${className}`}
      data-testid="agent-badge"
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: assignedColor }}
      />
      {name}
    </span>
  );
}

export interface ConfidenceBadgeProps {
  confidence: Confidence;
  className?: string;
}

export function ConfidenceBadge({ confidence, className = '' }: ConfidenceBadgeProps): React.JSX.Element {
  const styles: Record<Confidence, string> = {
    high: 'text-status-fresh-fg',
    medium: 'text-text-muted',
    low: 'text-status-outdated-fg'
  };

  return (
    <span
      className={`text-xs font-mono ${styles[confidence] || 'text-text-muted'} ${className}`}
      data-testid="confidence-badge"
    >
      {confidence} confidence
    </span>
  );
}
