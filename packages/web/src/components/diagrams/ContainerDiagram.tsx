import React, { useState } from 'react';
import { Code, Layers } from 'lucide-react';

export interface DiagramNode {
  id: string;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'client' | 'gateway' | 'service' | 'database' | 'external';
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  inferred?: boolean;
}

const DEFAULT_NODES: DiagramNode[] = [
  { id: 'client', label: 'Web Browser', subtitle: 'Next.js Client Components', x: 40, y: 120, width: 160, height: 70, type: 'client' },
  { id: 'gateway', label: 'API Gateway', subtitle: 'Fastify / App Router', x: 260, y: 120, width: 160, height: 70, type: 'gateway' },
  { id: 'auth', label: 'Auth Service', subtitle: 'JWT & Session Rotation', x: 480, y: 60, width: 160, height: 70, type: 'service' },
  { id: 'billing', label: 'Billing Service', subtitle: 'Invoices & Subscriptions', x: 480, y: 180, width: 160, height: 70, type: 'service' },
  { id: 'db', label: 'PostgreSQL DB', subtitle: 'User records & state', x: 700, y: 60, width: 160, height: 70, type: 'database' },
  { id: 'stripe', label: 'Stripe API', subtitle: 'External Payment Gateway', x: 700, y: 180, width: 160, height: 70, type: 'external' }
];

const DEFAULT_EDGES: DiagramEdge[] = [
  { from: 'client', to: 'gateway', label: 'HTTP / JSON' },
  { from: 'gateway', to: 'auth', label: 'verifySession' },
  { from: 'gateway', to: 'billing', label: 'processCheckout' },
  { from: 'auth', to: 'db', label: 'SELECT / INSERT' },
  { from: 'billing', to: 'stripe', label: 'Webhooks', inferred: true }
];

export interface ContainerDiagramProps {
  onSelectNode?: (nodeId: string) => void;
  className?: string;
}

export function ContainerDiagram({ onSelectNode, className = '' }: ContainerDiagramProps): React.JSX.Element {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const handleNodeClick = (nodeId: string): void => {
    const next = selectedNodeId === nodeId ? null : nodeId;
    setSelectedNodeId(next);
    if (next && onSelectNode) {
      onSelectNode(next);
    }
  };

  const generateMermaid = (): string => {
    let md = 'graph LR\n';
    for (const node of DEFAULT_NODES) {
      md += `  ${node.id}["${node.label} (${node.subtitle})"]\n`;
    }
    for (const edge of DEFAULT_EDGES) {
      if (edge.inferred) {
        md += `  ${edge.from} -.->|${edge.label || ''}| ${edge.to}\n`;
      } else {
        md += `  ${edge.from} -->|${edge.label || ''}| ${edge.to}\n`;
      }
    }
    return md;
  };

  const handleCopyMermaid = async (): Promise<void> => {
    await navigator.clipboard.writeText(generateMermaid());
    setCopiedMermaid(true);
    setTimeout(() => setCopiedMermaid(false), 2000);
  };

  const isConnected = (nodeId: string): boolean => {
    if (!selectedNodeId) return true;
    if (nodeId === selectedNodeId) return true;
    return DEFAULT_EDGES.some(
      (e) => (e.from === selectedNodeId && e.to === nodeId) || (e.to === selectedNodeId && e.from === nodeId)
    );
  };

  return (
    <div
      className={`bg-surface border border-border rounded-card p-6 shadow-sm space-y-4 font-ui ${className}`}
      data-testid="container-diagram"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold text-text tracking-tight">System Container Topology</h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMermaid}
            data-testid="export-mermaid-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-control border border-border hover:bg-surface-2 text-text transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            {copiedMermaid ? 'Copied Mermaid!' : 'Export Mermaid'}
          </button>
        </div>
      </div>

      {/* SVG Canvas with Deterministic Layout */}
      <div className="w-full overflow-x-auto bg-bg border border-border/60 rounded-control p-4">
        <svg viewBox="0 0 900 280" className="w-full h-auto min-w-[700px]">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="var(--text-faint)" />
            </marker>
          </defs>

          {/* Render Edges */}
          {DEFAULT_EDGES.map((edge, idx) => {
            const fromNode = DEFAULT_NODES.find((n) => n.id === edge.from);
            const toNode = DEFAULT_NODES.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.width;
            const y1 = fromNode.y + fromNode.height / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + toNode.height / 2;

            const isEdgeActive =
              !selectedNodeId || edge.from === selectedNodeId || edge.to === selectedNodeId;

            return (
              <g key={idx} opacity={isEdgeActive ? 1 : 0.2} className="transition-opacity duration-fast">
                <path
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={edge.inferred ? 'var(--status-drifted-fg)' : 'var(--border)'}
                  strokeWidth="1.5"
                  strokeDasharray={edge.inferred ? '4 4' : undefined}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    fill="var(--text-faint)"
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {edge.label} {edge.inferred ? '(inferred)' : ''}
                  </text>
                )}
              </g>
            );
          })}

          {/* Render Nodes */}
          {DEFAULT_NODES.map((node) => {
            const active = isConnected(node.id);
            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                data-testid={`diagram-node-${node.id}`}
                onClick={() => handleNodeClick(node.id)}
                className="cursor-pointer transition-all duration-fast"
                opacity={active ? 1 : 0.25}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx="8"
                  fill="var(--surface)"
                  stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isSelected ? '2' : '1'}
                />
                <text
                  x={node.x + 12}
                  y={node.y + 26}
                  fill="var(--text)"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="sans-serif"
                >
                  {node.label}
                </text>
                <text
                  x={node.x + 12}
                  y={node.y + 44}
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {node.subtitle}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
