import React from 'react';
import {
  Activity,
  Clock
} from 'lucide-react';

export interface AgentSessionActivity {
  agentName: string;
  agentColor: string;
  currentTask: string;
  currentStep: 'plan' | 'edit' | 'test' | 'done';
  touchedPaths: string[];
  lastActive: string;
}

const SAMPLE_AGENTS: AgentSessionActivity[] = [
  {
    agentName: 'Claude Code',
    agentColor: 'var(--agent-coral)',
    currentTask: 'Implementing rate limiting on /auth/login route',
    currentStep: 'edit',
    touchedPaths: ['src/auth/routes.ts', 'src/auth/jwt.ts'],
    lastActive: 'Just now'
  },
  {
    agentName: 'Cursor Agent',
    agentColor: 'var(--agent-cyan)',
    currentTask: 'Refactoring billing subscription webhooks',
    currentStep: 'test',
    touchedPaths: ['src/billing/stripe.ts'],
    lastActive: '2m ago'
  }
];

export interface ActivityScreenProps {
  onSelectPath?: (path: string) => void;
  className?: string;
}

export function ActivityScreen({ onSelectPath, className = '' }: ActivityScreenProps): React.JSX.Element {
  const steps = ['plan', 'edit', 'test', 'done'] as const;

  return (
    <div
      className={`flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-6 font-ui ${className}`}
      data-testid="activity-screen"
    >
      {/* Screen Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="p-2 rounded-control bg-accent/10 text-accent">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text tracking-tight">Active Agent Sessions</h1>
          <p className="text-xs font-mono text-text-muted">Real-time monitoring of agent tasks and touched touchpoints</p>
        </div>
      </div>

      {/* Active Agents Task Cards */}
      <div className="grid gap-4">
        {SAMPLE_AGENTS.map((agent) => (
          <div
            key={agent.agentName}
            className="bg-surface border border-border rounded-card p-5 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: agent.agentColor }}
                />
                <h3 className="text-sm font-semibold text-text">{agent.agentName}</h3>
              </div>
              <span className="text-xs font-mono text-text-faint flex items-center gap-1">
                <Clock className="w-3 h-3" /> {agent.lastActive}
              </span>
            </div>

            <p className="text-xs text-text-muted font-ui">
              <strong>Current Task:</strong> {agent.currentTask}
            </p>

            {/* Step Progress Pill */}
            <div className="flex items-center gap-1 py-1">
              {steps.map((step, idx) => {
                const isCurrent = agent.currentStep === step;
                const isPassed = steps.indexOf(agent.currentStep) >= idx;

                return (
                  <div key={step} className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize transition-colors ${
                        isCurrent
                          ? 'bg-accent text-white font-medium shadow-xs'
                          : isPassed
                          ? 'bg-surface-2 text-text font-medium'
                          : 'bg-surface text-text-faint border border-border'
                      }`}
                    >
                      {step}
                    </span>
                    {idx < steps.length - 1 && (
                      <span className="text-text-faint text-xs">▸</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Touched Touchpoints */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-text-faint font-mono">Touched:</span>
                {agent.touchedPaths.map((p) => (
                  <span
                    key={p}
                    onClick={() => onSelectPath?.(p)}
                    className="font-code text-accent hover:underline cursor-pointer"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
