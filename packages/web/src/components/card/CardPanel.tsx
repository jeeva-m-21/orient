import React, { useState } from 'react';
import type { Card } from '@orient/schema';
import { StatusBadge, SourceBadge, AgentBadge, ConfidenceBadge } from '../common/Badge.js';
import {
  FileCode,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  FolderGit2,
  Network,
  Terminal,
  Activity
} from 'lucide-react';

export interface CardPanelProps {
  card: Card;
  onOpenFile?: (path: string, range?: [number, number]) => void;
  onOpenEditor?: (path: string) => void;
  onMarkReviewed?: (cardId: string) => void;
  onNextCard?: () => void;
  className?: string;
}

export function CardPanel({
  card,
  onOpenFile,
  onOpenEditor,
  onMarkReviewed,
  onNextCard,
  className = ''
}: CardPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'card' | 'code' | 'changes' | 'links'>('card');
  const [isReviewed, setIsReviewed] = useState(false);

  const { authored, derived, meta, state } = card;

  const handleMarkReviewed = (): void => {
    setIsReviewed(true);
    if (onMarkReviewed) {
      onMarkReviewed(card.id);
    }
  };

  return (
    <div
      className={`flex flex-col h-full bg-surface border border-border rounded-card overflow-hidden shadow-sm ${className}`}
      data-testid="card-panel"
    >
      {/* 1. Header Region */}
      <div className="p-6 border-b border-border bg-surface-2/40">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-accent" />
            <h2 className="font-code text-lg font-semibold text-text tracking-tight">
              {card.path || 'root repository'}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge state={state} />
            <SourceBadge source={meta.source} />
            {meta.agent && <AgentBadge name={meta.agent.name} color={meta.agent.color} />}
            <ConfidenceBadge confidence={meta.confidence} />
          </div>
        </div>

        <p className="text-sm text-text-muted font-ui line-clamp-2">
          {authored.purpose}
        </p>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-border/50">
          {(['card', 'code', 'changes', 'links'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-control transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-2'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Signature 10-Slot Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Slot 1: Role */}
        <section className="flex items-center gap-3">
          <span className="text-xs uppercase font-mono tracking-wider text-text-faint w-28 flex-shrink-0">
            Role
          </span>
          <span className="px-2.5 py-0.5 rounded-control font-code text-xs font-medium bg-surface-2 border border-border text-text">
            {authored.role}
          </span>
        </section>

        {/* Slot 2: One Thing to Remember */}
        {authored.oneThing && (
          <section className="p-3.5 bg-accent/5 border-l-3 border-accent rounded-r-control">
            <div className="text-xs font-mono uppercase tracking-wider text-accent font-semibold mb-1">
              Core Invariant
            </div>
            <p className="text-sm font-medium text-text">
              {authored.oneThing}
            </p>
          </section>
        )}

        {/* Slot 3: Why & Architectural Context */}
        <section className="space-y-1.5">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint">
            Why It Exists
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">
            {authored.why}
          </p>
          {authored.contrast && (
            <p className="text-xs text-text-faint italic mt-1">
              Contrast: {authored.contrast}
            </p>
          )}
        </section>

        {/* Slot 4: Key Files & Entry Points */}
        <section className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5" /> Key Files & Entry Points
          </h3>
          <div className="grid gap-1.5">
            {derived.keyFiles.map((kf) => (
              <div
                key={kf.path}
                onClick={() => onOpenFile?.(kf.path)}
                className="flex items-center justify-between p-2 rounded-control bg-surface-2/60 hover:bg-surface-2 border border-border/40 hover:border-border cursor-pointer transition-colors group"
                data-testid={`key-file-${kf.path}`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-code text-xs text-accent font-medium truncate group-hover:underline">
                    {kf.path}
                  </span>
                </div>
                <span className="text-xs text-text-faint truncate max-w-[50%] text-right">
                  {kf.reason}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Slot 5: Dependencies & Used By (1-Hop Topology) */}
        <section className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5" /> 1-Hop Graph Topology
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-surface-2/40 border border-border/40 rounded-control">
              <span className="text-text-faint font-mono block mb-1.5">Depends On:</span>
              {derived.dependsOn.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {derived.dependsOn.map((dep) => (
                    <span key={dep} className="px-2 py-0.5 rounded bg-surface border border-border font-code text-text-muted">
                      {dep}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-text-faint italic">No internal dependencies</span>
              )}
            </div>

            <div className="p-3 bg-surface-2/40 border border-border/40 rounded-control">
              <span className="text-text-faint font-mono block mb-1.5">Used By:</span>
              {derived.usedBy.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {derived.usedBy.map((ub) => (
                    <span key={ub} className="px-2 py-0.5 rounded bg-surface border border-border font-code text-text-muted">
                      {ub}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-text-faint italic">Leaf node or entrypoint</span>
              )}
            </div>
          </div>
        </section>

        {/* Slot 6: Surface (Routes, Exports, Env Vars, Ports) */}
        <section className="space-y-2">
          <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5" /> Exported Surface & Endpoints
          </h3>
          <div className="p-3 bg-surface-2/40 border border-border/40 rounded-control space-y-2 text-xs">
            {derived.surface.routes.length > 0 && (
              <div>
                <span className="text-text-faint font-mono block mb-1">HTTP Routes:</span>
                <div className="flex flex-wrap gap-1">
                  {derived.surface.routes.map((r) => (
                    <span key={`${r.method}-${r.path}`} className="px-2 py-0.5 rounded bg-surface border border-border font-code text-text">
                      <strong className="text-accent">{r.method}</strong> {r.path}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {derived.surface.exports.length > 0 && (
              <div>
                <span className="text-text-faint font-mono block mb-1">Public Exports:</span>
                <div className="flex flex-wrap gap-1">
                  {derived.surface.exports.map((exp) => (
                    <span key={exp} className="px-2 py-0.5 rounded bg-surface border border-border font-code text-text-muted">
                      {exp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {derived.surface.envVars.length > 0 && (
              <div>
                <span className="text-text-faint font-mono block mb-1">Required Environment Variables:</span>
                <div className="flex flex-wrap gap-1">
                  {derived.surface.envVars.map((env) => (
                    <span key={env} className="px-2 py-0.5 rounded bg-surface border border-border font-code text-status-drifted-fg">
                      {env}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Slot 7: Conventions & Invariants */}
        {authored.conventions.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-text-faint">
              Team Conventions & Patterns
            </h3>
            <ul className="space-y-1 text-sm text-text-muted list-disc list-inside">
              {authored.conventions.map((conv, idx) => (
                <li key={idx} className="leading-relaxed">
                  {conv}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Slot 8: Do Not (Guardrails) */}
        {authored.doNot.length > 0 && (
          <section className="p-3 bg-status-error-bg/30 border border-status-error-fg/30 rounded-control space-y-1.5">
            <h3 className="text-xs font-mono uppercase tracking-wider text-status-error-fg font-semibold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Do Not
            </h3>
            <ul className="space-y-1 text-xs text-text-muted list-disc list-inside">
              {authored.doNot.map((dn, idx) => (
                <li key={idx} className="leading-relaxed">
                  {dn}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Slot 9: Tests & Health */}
        <section className="flex items-center justify-between p-3 bg-surface-2/40 border border-border/40 rounded-control text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-text-faint" />
            <span className="font-mono text-text-muted">
              {derived.tests.present ? (
                <span className="text-status-fresh-fg font-medium">✓ Tests present</span>
              ) : (
                <span className="text-status-outdated-fg font-medium">⚠ No tests found</span>
              )}
            </span>
            <span className="text-text-faint">·</span>
            <span className="text-text-faint">{derived.fileCount} files</span>
            <span className="text-text-faint">·</span>
            <span className="text-text-faint">{derived.loc} LOC</span>
          </div>
          <span className="text-text-faint font-mono">
            {derived.health.todoCount} TODOs
          </span>
        </section>

        {/* Slot 10: Origin, Evidence & Hashes */}
        <section className="pt-4 border-t border-border/50 flex items-center justify-between text-xs text-text-faint font-code">
          <span>Commit: {meta.anchor.commit.slice(0, 7)}</span>
          <span>Updated: {new Date(meta.updatedAt).toLocaleDateString()}</span>
        </section>
      </div>

      {/* 3. Action Footer Region */}
      <div className="p-4 border-t border-border bg-surface-2/30 flex items-center justify-between">
        <button
          onClick={() => onOpenEditor?.(card.path)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control border border-border hover:bg-surface-2 text-text active:scale-[0.98] transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Open in Editor
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkReviewed}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-control border transition-all active:scale-[0.98] ${
              isReviewed
                ? 'bg-status-fresh-bg text-status-fresh-fg border-status-fresh-fg/30'
                : 'border-border text-text hover:bg-surface-2'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {isReviewed ? 'Reviewed' : 'Mark Reviewed'}
          </button>

          <button
            onClick={onNextCard}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-control bg-accent hover:bg-accent/90 text-white active:scale-[0.98] transition-all"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
