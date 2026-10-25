import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import {
  Search,
  Folder,
  Filter,
  Eye,
  Sun,
  Sparkles
} from 'lucide-react';

export interface CommandPaletteItem {
  id: string;
  label: string;
  path?: string;
  type: 'card' | 'status' | 'action' | 'task';
  category: string;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandPaletteItem[];
  onSelectItem: (item: CommandPaletteItem) => void;
  onToggleFocusMode?: () => void;
  onToggleTheme?: () => void;
  onTaskSearch?: (query: string) => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  items,
  onSelectItem,
  onToggleFocusMode,
  onToggleTheme,
  onTaskSearch
}: CommandPaletteProps): React.JSX.Element | null {
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcut listener for Cmd+K and Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-xs p-4"
      onClick={onClose}
      data-testid="command-palette-backdrop"
    >
      <div
        className="w-full max-w-xl bg-surface border border-border rounded-card shadow-2xl overflow-hidden font-ui"
        onClick={(e) => e.stopPropagation()}
        data-testid="command-palette"
      >
        <Command label="Orient Command Palette" className="flex flex-col">
          <div className="flex items-center px-4 py-3 border-b border-border bg-surface-2/30">
            <Search className="w-4 h-4 text-text-faint mr-2.5 flex-shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Jump to card, search task, or run command (Cmd+K)..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim() && onTaskSearch) {
                  onTaskSearch(searchQuery);
                }
              }}
              className="w-full bg-transparent text-sm text-text placeholder:text-text-faint focus:outline-none font-ui"
              data-testid="command-palette-input"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-text-faint font-mono">
              No results found for &quot;{searchQuery}&quot;
            </Command.Empty>

            {/* Built-in Actions */}
            <Command.Group heading="Global Actions" className="text-[11px] font-mono text-text-faint px-2 py-1">
              {onToggleFocusMode && (
                <Command.Item
                  onSelect={() => {
                    onToggleFocusMode();
                    onClose();
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs rounded-control text-text cursor-pointer hover:bg-surface-2 aria-selected:bg-accent/15 aria-selected:text-accent font-ui"
                >
                  <Eye className="w-3.5 h-3.5" /> Toggle Focus Mode (F)
                </Command.Item>
              )}

              {onToggleTheme && (
                <Command.Item
                  onSelect={() => {
                    onToggleTheme();
                    onClose();
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs rounded-control text-text cursor-pointer hover:bg-surface-2 aria-selected:bg-accent/15 aria-selected:text-accent font-ui"
                >
                  <Sun className="w-3.5 h-3.5" /> Toggle Dark / Light Theme
                </Command.Item>
              )}
            </Command.Group>

            {/* Cards & Items */}
            <Command.Group heading="Architecture Cards" className="text-[11px] font-mono text-text-faint px-2 py-1">
              {items.map((item) => (
                <Command.Item
                  key={item.id}
                  value={item.label}
                  onSelect={() => {
                    onSelectItem(item);
                    onClose();
                  }}
                  className="flex items-center justify-between px-3 py-2 text-xs rounded-control text-text cursor-pointer hover:bg-surface-2 aria-selected:bg-accent/15 aria-selected:text-accent font-ui"
                  data-testid={`palette-item-${item.id}`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {item.type === 'card' ? (
                      <Folder className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                    ) : item.type === 'task' ? (
                      <Sparkles className="w-3.5 h-3.5 text-status-fresh-fg flex-shrink-0" />
                    ) : (
                      <Filter className="w-3.5 h-3.5 text-text-faint flex-shrink-0" />
                    )}
                    <span className="font-code truncate">{item.label}</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-faint">{item.category}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-surface-2/20 text-[11px] font-mono text-text-faint">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </Command>
      </div>
    </div>
  );
}
