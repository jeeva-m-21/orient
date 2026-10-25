import React, { useState, useMemo } from 'react';
import type { StalenessState } from '@orient/schema';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Search
} from 'lucide-react';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  role?: string;
  fileCount?: number;
  status?: StalenessState;
  agentColor?: string;
  isNoise?: boolean;
  children?: TreeNode[];
}

export interface RepositoryTreeProps {
  data: TreeNode[];
  selectedPath?: string;
  onSelectNode: (node: TreeNode) => void;
  onOpenEditor?: (path: string) => void;
  onMarkReviewed?: (path: string) => void;
  className?: string;
}

export function RepositoryTree({
  data,
  selectedPath,
  onSelectNode,
  onOpenEditor,
  onMarkReviewed,
  className = ''
}: RepositoryTreeProps): React.JSX.Element {
  const [filterText, setFilterText] = useState('');
  const [filterMode, setFilterMode] = useState<'path' | 'all'>('path');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root', 'src']));

  const toggleExpand = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const statusDotColors: Record<StalenessState, string> = {
    Fresh: 'bg-status-fresh-fg',
    Drifted: 'bg-status-drifted-fg',
    Outdated: 'bg-status-outdated-fg',
    Affected: 'bg-status-affected-fg',
    Unknown: 'bg-status-unknown-fg'
  };

  const filteredData = useMemo(() => {
    if (!filterText.trim()) return data;
    const lower = filterText.toLowerCase();

    function matchNode(node: TreeNode): TreeNode | null {
      const nameMatches = node.name.toLowerCase().includes(lower);
      const pathMatches = node.path.toLowerCase().includes(lower);
      const isMatch = filterMode === 'path' ? pathMatches : nameMatches || pathMatches;

      if (node.isFolder && node.children) {
        const matchedChildren = node.children
          .map(matchNode)
          .filter((c): c is TreeNode => c !== null);

        if (matchedChildren.length > 0 || isMatch) {
          return { ...node, children: matchedChildren };
        }
      }

      return isMatch ? node : null;
    }

    return data.map(matchNode).filter((n): n is TreeNode => n !== null);
  }, [data, filterText, filterMode]);

  const renderTree = (nodes: TreeNode[], depth: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id);
      const isSelected = selectedPath === node.path;

      if (node.isNoise) {
        return (
          <div
            key={node.id}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            className="flex items-center gap-2 py-1.5 px-2 text-xs text-text-faint italic select-none"
          >
            <span>📁</span>
            <span>{node.name} (dependencies & build artifacts)</span>
          </div>
        );
      }

      return (
        <div key={node.id} className="select-none">
          <div
            onClick={() => {
              if (node.isFolder) {
                toggleExpand(node.id);
              }
              onSelectNode(node);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSelectNode(node);
              } else if (e.key === 'ArrowRight' && node.isFolder && !isExpanded) {
                toggleExpand(node.id);
              } else if (e.key === 'ArrowLeft' && node.isFolder && isExpanded) {
                toggleExpand(node.id);
              } else if (e.key === 'o' && onOpenEditor) {
                onOpenEditor(node.path);
              } else if (e.key === 'r' && onMarkReviewed) {
                onMarkReviewed(node.path);
              }
            }}
            tabIndex={0}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            className={`flex items-center justify-between py-1.5 px-2 rounded-control cursor-pointer transition-colors text-xs font-mono group focus:outline-none focus:ring-1 focus:ring-accent ${
              isSelected
                ? 'bg-accent/15 text-text font-medium border-l-2 border-accent'
                : 'text-text-muted hover:text-text hover:bg-surface-2'
            }`}
            data-testid={`tree-node-${node.path}`}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {node.isFolder ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(node.id);
                  }}
                  className="p-0.5 hover:text-text text-text-faint"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-3.5" />
              )}

              {node.isFolder ? (
                isExpanded ? (
                  <FolderOpen className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                )
              ) : (
                <File className="w-3.5 h-3.5 text-text-faint flex-shrink-0" />
              )}

              <span className="truncate">{node.name}</span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {node.fileCount !== undefined && node.fileCount > 0 && (
                <span className="text-[11px] text-text-faint">{node.fileCount}</span>
              )}

              {node.agentColor && (
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: node.agentColor }}
                  title="Recent agent activity"
                />
              )}

              {node.status && (
                <span
                  className={`w-2 h-2 rounded-full ${statusDotColors[node.status] || 'bg-status-unknown-fg'}`}
                  title={`Status: ${node.status}`}
                />
              )}
            </div>
          </div>

          {node.isFolder && isExpanded && node.children && (
            <div>{renderTree(node.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className={`flex flex-col h-full bg-surface border-r border-border ${className}`}
      data-testid="repository-tree"
    >
      {/* Tree Search & Mode Filter Bar */}
      <div className="p-2.5 border-b border-border bg-surface-2/30 space-y-2">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-text-faint" />
          <input
            type="text"
            placeholder="Filter files (/)..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full pl-8 pr-2 py-1 text-xs font-mono bg-surface border border-border rounded-control text-text placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-text-faint">EXPLORER</span>
          <div className="flex items-center bg-surface border border-border rounded-control p-0.5">
            <button
              onClick={() => setFilterMode('path')}
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                filterMode === 'path' ? 'bg-surface-2 text-text font-medium' : 'text-text-faint hover:text-text'
              }`}
            >
              Path
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-1.5 py-0.5 rounded-sm transition-colors ${
                filterMode === 'all' ? 'bg-surface-2 text-text font-medium' : 'text-text-faint hover:text-text'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      {/* Virtualized/Scrollable Nodes Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredData.length > 0 ? (
          renderTree(filteredData)
        ) : (
          <div className="p-4 text-center text-xs text-text-faint font-mono">
            No matching files found
          </div>
        )}
      </div>
    </div>
  );
}
