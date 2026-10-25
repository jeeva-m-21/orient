import React, { useState } from 'react';
import {
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export interface InboxItem {
  id: string;
  type: 'unreported' | 'outdated' | 'collision' | 'dependency';
  path: string;
  title: string;
  description: string;
  recency: string;
  severity: 'high' | 'medium' | 'low';
}

const INITIAL_INBOX_ITEMS: InboxItem[] = [
  {
    id: 'item-1',
    type: 'outdated',
    path: 'src/billing',
    title: 'Outdated Card: Stripe Webhook Changes',
    description: 'Files in src/billing were modified during task "Add subscription webhooks". Interface hash drifted.',
    recency: '5m ago',
    severity: 'high'
  },
  {
    id: 'item-2',
    type: 'dependency',
    path: 'package.json',
    title: 'New External Dependency Added',
    description: 'Added "@stripe/stripe-js@^4.0.0" without corresponding entry in billing card conventions.',
    recency: '12m ago',
    severity: 'medium'
  },
  {
    id: 'item-3',
    type: 'unreported',
    path: 'src/controllers/authController.ts',
    title: 'Unreported Change: Route Logic Touchpoint',
    description: 'File edited without agent card report submitted via MCP report.',
    recency: '25m ago',
    severity: 'medium'
  }
];

export interface InboxScreenProps {
  onReviewPath?: (path: string) => void;
  className?: string;
}

export function InboxScreen({ onReviewPath, className = '' }: InboxScreenProps): React.JSX.Element {
  const [items, setItems] = useState<InboxItem[]>(INITIAL_INBOX_ITEMS);

  const handleMarkReviewed = (id: string): void => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMarkAllReviewed = (): void => {
    setItems([]);
  };

  const severityBadge = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-status-error-bg text-status-error-fg">
            <ShieldAlert className="w-3 h-3" /> High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-status-outdated-bg text-status-outdated-fg">
            <AlertTriangle className="w-3 h-3" /> Attention
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-surface-2 text-text-muted">
            <Clock className="w-3 h-3" /> Info
          </span>
        );
    }
  };

  return (
    <div
      className={`flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6 font-ui ${className}`}
      data-testid="inbox-screen"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-control bg-accent/10 text-accent">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text tracking-tight">Review Inbox</h1>
            <p className="text-xs font-mono text-text-muted">Prioritized changes requiring engineer attention</p>
          </div>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleMarkAllReviewed}
            data-testid="mark-all-reviewed-btn"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control border border-border hover:bg-surface-2 text-text transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-status-fresh-fg" /> Mark All Reviewed
          </button>
        )}
      </div>

      {/* Item List or Calm Empty State */}
      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-surface border border-border rounded-card p-4 shadow-sm hover:border-accent/40 transition-colors space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {severityBadge(item.severity)}
                  <span className="font-code text-xs text-text font-semibold">{item.path}</span>
                </div>
                <span className="text-xs font-mono text-text-faint">{item.recency}</span>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text">{item.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed mt-0.5">{item.description}</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <button
                  onClick={() => onReviewPath?.(item.path)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                >
                  Review Diff & Card <ArrowRight className="w-3 h-3" />
                </button>

                <button
                  onClick={() => handleMarkReviewed(item.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-control bg-surface-2 hover:bg-surface-2/80 text-text active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-fresh-fg" /> Mark Reviewed
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Calm Honest Empty State */
        <div
          data-testid="empty-inbox-state"
          className="bg-surface border border-border rounded-card p-12 text-center space-y-3"
        >
          <div className="inline-flex p-3 rounded-full bg-status-fresh-bg text-status-fresh-fg mb-1">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-text">All Clear</h2>
          <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
            No cards or changes need your attention right now. All active project areas are verified fresh.
          </p>
        </div>
      )}
    </div>
  );
}
