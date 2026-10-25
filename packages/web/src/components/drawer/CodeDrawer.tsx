import React from 'react';
import { X, Copy, Check, FileCode } from 'lucide-react';

export interface CodeDrawerProps {
  isOpen: boolean;
  filePath: string;
  code: string;
  highlightRange?: [number, number];
  onClose: () => void;
  className?: string;
}

export function CodeDrawer({
  isOpen,
  filePath,
  code,
  highlightRange,
  onClose,
  className = ''
}: CodeDrawerProps): React.JSX.Element | null {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div
      className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] bg-surface border-l border-border shadow-2xl flex flex-col font-ui transition-transform duration-DEFAULT ${className}`}
      data-testid="code-drawer"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2/40">
        <div className="flex items-center gap-2 overflow-hidden">
          <FileCode className="w-4 h-4 text-accent flex-shrink-0" />
          <span className="font-code text-xs font-semibold text-text truncate">
            {filePath}
          </span>
          {highlightRange && (
            <span className="text-[11px] font-mono text-text-faint px-1.5 py-0.5 rounded bg-surface border border-border">
              L{highlightRange[0]}-{highlightRange[1]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text rounded-control hover:bg-surface-2 transition-colors"
            title="Copy Code"
          >
            {copied ? <Check className="w-4 h-4 text-status-fresh-fg" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text rounded-control hover:bg-surface-2 transition-colors"
            title="Close Drawer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Viewer with Line Numbers */}
      <div className="flex-1 overflow-auto p-4 bg-bg text-text font-code text-xs leading-5">
        <pre className="m-0 p-0">
          <code>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted =
                highlightRange && lineNum >= highlightRange[0] && lineNum <= highlightRange[1];

              return (
                <div
                  key={lineNum}
                  className={`flex items-start ${
                    isHighlighted ? 'bg-accent/15 border-l-2 border-accent pl-1 -ml-1.5' : ''
                  }`}
                >
                  <span className="w-8 text-right pr-4 text-text-faint select-none flex-shrink-0">
                    {lineNum}
                  </span>
                  <span className="flex-1 whitespace-pre">{line || ' '}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
