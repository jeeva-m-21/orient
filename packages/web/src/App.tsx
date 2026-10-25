import React, { useState, useEffect } from 'react';
import type { Card } from '@orient/schema';
import { nextjsGoldenCard } from '@orient/fixtures/cards';
import { Shell, type ShellView } from './components/layout/Shell.js';
import { RepositoryTree, type TreeNode } from './components/tree/RepositoryTree.js';
import { CardPanel } from './components/card/CardPanel.js';
import { CodeDrawer } from './components/drawer/CodeDrawer.js';
import { CommandPalette, type CommandPaletteItem } from './components/palette/CommandPalette.js';
import { OverviewScreen } from './components/screens/OverviewScreen.js';
import { ContainerDiagram } from './components/diagrams/ContainerDiagram.js';
import { InboxScreen } from './components/screens/InboxScreen.js';
import { ActivityScreen } from './components/screens/ActivityScreen.js';

const INITIAL_TREE_DATA: TreeNode[] = [
  {
    id: 'root',
    name: 'acme-commerce',
    path: '',
    isFolder: true,
    role: 'entrypoint',
    status: 'Fresh',
    children: [
      {
        id: 'src',
        name: 'src',
        path: 'src',
        isFolder: true,
        children: [
          {
            id: 'src-auth',
            name: 'auth',
            path: 'src/auth',
            isFolder: true,
            role: 'routes',
            fileCount: 3,
            status: 'Fresh',
            agentColor: 'var(--agent-coral)',
            children: [
              { id: 'src-auth-routes', name: 'routes.ts', path: 'src/auth/routes.ts', isFolder: false },
              { id: 'src-auth-jwt', name: 'jwt.ts', path: 'src/auth/jwt.ts', isFolder: false }
            ]
          },
          {
            id: 'src-controllers',
            name: 'controllers',
            path: 'src/controllers',
            isFolder: true,
            role: 'controllers',
            fileCount: 4,
            status: 'Fresh',
            children: [
              { id: 'src-controllers-auth', name: 'authController.ts', path: 'src/controllers/authController.ts', isFolder: false }
            ]
          },
          {
            id: 'src-billing',
            name: 'billing',
            path: 'src/billing',
            isFolder: true,
            role: 'services',
            fileCount: 2,
            status: 'Outdated',
            children: [
              { id: 'src-billing-stripe', name: 'stripe.ts', path: 'src/billing/stripe.ts', isFolder: false }
            ]
          }
        ]
      },
      {
        id: 'noise',
        name: 'node_modules, dist, .turbo',
        path: 'noise',
        isFolder: true,
        isNoise: true
      }
    ]
  }
];

const SAMPLE_CODE_SNIPPETS: Record<string, string> = {
  'src/auth/routes.ts': `import { FastifyInstance } from 'fastify';
import { verifyJwtToken, createSessionToken } from './jwt.js';

export async function authRoutes(app: FastifyInstance) {
  // Login endpoint with brute-force rate limit protection
  app.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
      return reply.status(400).send({ error: 'Missing credentials' });
    }
    const token = createSessionToken(username);
    return { token, status: 'authenticated' };
  });

  app.post('/auth/refresh', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth) return reply.status(401).send({ error: 'Missing token' });
    return { status: 'refreshed' };
  });
}
`,
  'src/auth/jwt.ts': `import crypto from 'node:crypto';

export function createSessionToken(userId: string): string {
  const secret = process.env.JWT_SECRET || 'dev_secret_key';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat: Date.now() })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(\`\${header}.\${payload}\`).digest('base64url');
  return \`\${header}.\${payload}.\${signature}\`;
}
`
};

export function App(): React.JSX.Element {
  const [currentCard, setCurrentCard] = useState<Card>(nextjsGoldenCard);
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [focusStepIndex, setFocusStepIndex] = useState<number>(0);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ShellView>('explore');

  // Code Drawer State
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerPath, setDrawerPath] = useState<string>('');
  const [drawerCode, setDrawerCode] = useState<string>('');
  const [drawerRange, setDrawerRange] = useState<[number, number] | undefined>(undefined);

  // Global keybindings: Cmd+K for palette, F for Focus Mode
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'f' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleToggleTheme = (): void => {
    setIsDarkTheme((prev) => {
      const next = !prev;
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const handleSelectTreeNode = (node: TreeNode): void => {
    if (node.path === 'src/auth' || node.path === 'src/auth/routes.ts') {
      setCurrentCard({
        ...nextjsGoldenCard,
        id: 'card:folder:src/auth',
        path: 'src/auth',
        derived: {
          ...nextjsGoldenCard.derived,
          keyFiles: [
            { path: 'src/auth/routes.ts', reason: 'Authentication API routes and endpoints' },
            { path: 'src/auth/jwt.ts', reason: 'JWT session signing and verification' }
          ]
        },
        authored: {
          ...nextjsGoldenCard.authored,
          purpose: 'Authentication subsystem managing user login, JWT sessions, and password recovery.',
          role: 'routes',
          oneThing: 'Always verify JWT bearer token before executing protected route logic.',
          conventions: ['Enforce rate limiting on login attempts', 'Export handlers as async functions']
        }
      });
    } else if (node.path === 'src/billing') {
      setCurrentCard({
        ...nextjsGoldenCard,
        id: 'card:folder:src/billing',
        path: 'src/billing',
        state: 'Outdated',
        authored: {
          ...nextjsGoldenCard.authored,
          purpose: 'Payment processing subsystem managing Stripe webhooks and invoices.',
          role: 'services',
          oneThing: 'Always verify Stripe webhook signatures before processing events.'
        }
      });
    } else {
      setCurrentCard({
        ...nextjsGoldenCard,
        id: `card:node:${node.path || 'root'}`,
        path: node.path
      });
    }
  };

  const handleOpenFileInDrawer = (filePath: string, range?: [number, number]): void => {
    setDrawerPath(filePath);
    setDrawerCode(
      SAMPLE_CODE_SNIPPETS[filePath] ||
        `// Source preview for: ${filePath}\n\nexport const module = {\n  path: "${filePath}",\n  verified: true\n};\n`
    );
    setDrawerRange(range || [1, 10]);
    setDrawerOpen(true);
  };

  const paletteItems: CommandPaletteItem[] = [
    { id: 'auth', label: 'src/auth (routes)', path: 'src/auth', type: 'card', category: 'Folders' },
    { id: 'billing', label: 'src/billing (services)', path: 'src/billing', type: 'card', category: 'Folders' },
    { id: 'controllers', label: 'src/controllers (controllers)', path: 'src/controllers', type: 'card', category: 'Folders' },
    { id: 'task-search', label: 'Task Search: "add rate limit to login"', type: 'task', category: 'Search' },
    { id: 'filter-outdated', label: 'Filter: Outdated cards (1)', type: 'status', category: 'Filter' }
  ];

  const handleSelectPaletteItem = (item: CommandPaletteItem): void => {
    if (item.path) {
      handleSelectTreeNode({
        id: item.id,
        name: item.path.split('/').pop() || item.path,
        path: item.path,
        isFolder: true
      });
      setActiveView('explore');
    }
  };

  const startHereCards = ['root', 'src/auth', 'src/controllers', 'src/billing'];

  return (
    <Shell
      projectName="acme-commerce"
      branchName="main"
      activeAgentsCount={2}
      outdatedCount={1}
      isFocusMode={isFocusMode}
      onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      onToggleTheme={handleToggleTheme}
      isDarkTheme={isDarkTheme}
      activeView={activeView}
      onChangeView={setActiveView}
      activeAgentStatus="Claude reported: src/auth updated (Fresh) · Stdio MCP connected"
    >
      {/* 1. If Focus Mode is Active */}
      {isFocusMode ? (
        <div className="flex-1 flex flex-col items-center justify-start p-6 overflow-y-auto">
          {/* Start Here Progress Bar */}
          <div className="w-full max-w-2xl flex items-center justify-between pb-4 mb-2 text-xs font-mono text-text-faint border-b border-border">
            <span>FOCUS MODE · STEP {focusStepIndex + 1} OF {startHereCards.length}</span>
            <div className="flex items-center gap-2">
              <button
                data-testid="focus-back-btn"
                disabled={focusStepIndex === 0}
                onClick={() => setFocusStepIndex((i) => Math.max(0, i - 1))}
                className="px-2 py-1 rounded bg-surface border border-border disabled:opacity-40"
              >
                Back
              </button>
              <button
                data-testid="focus-next-btn"
                disabled={focusStepIndex >= startHereCards.length - 1}
                onClick={() => setFocusStepIndex((i) => Math.min(startHereCards.length - 1, i + 1))}
                className="px-2 py-1 rounded bg-accent text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>

          <div className="w-full max-w-2xl">
            <CardPanel
              card={currentCard}
              onOpenFile={handleOpenFileInDrawer}
              onOpenEditor={(p) => alert(`Open in editor: ${p}`)}
              onNextCard={() => setFocusStepIndex((i) => (i + 1) % startHereCards.length)}
            />
          </div>
        </div>
      ) : activeView === 'overview' ? (
        /* 2. Overview Screen with Container Diagram */
        <div className="flex-1 overflow-y-auto space-y-6">
          <OverviewScreen
            repoCard={nextjsGoldenCard}
            onNavigateToCard={(p) => {
              handleSelectTreeNode({ id: p, name: p, path: p, isFolder: true });
              setActiveView('explore');
            }}
            onStartExploring={() => {
              handleSelectTreeNode({ id: 'src-auth', name: 'auth', path: 'src/auth', isFolder: true });
              setActiveView('explore');
            }}
          />
          <div className="max-w-5xl mx-auto px-8 pb-12">
            <ContainerDiagram
              onSelectNode={(nodeId) => {
                if (nodeId === 'auth') {
                  handleSelectTreeNode({ id: 'src-auth', name: 'auth', path: 'src/auth', isFolder: true });
                  setActiveView('explore');
                }
              }}
            />
          </div>
        </div>
      ) : activeView === 'inbox' ? (
        /* 3. Review Inbox Screen */
        <InboxScreen
          onReviewPath={(p) => {
            handleSelectTreeNode({ id: p, name: p, path: p, isFolder: true });
            setActiveView('explore');
          }}
        />
      ) : activeView === 'activity' ? (
        /* 4. Active Agents Activity Screen */
        <ActivityScreen
          onSelectPath={(p) => {
            handleSelectTreeNode({ id: p, name: p, path: p, isFolder: true });
            setActiveView('explore');
          }}
        />
      ) : (
        /* 5. Explorer Standard View: Tree on Left + Card on Right */
        <div className="flex flex-1 overflow-hidden">
          <div className="w-72 flex-shrink-0">
            <RepositoryTree
              data={INITIAL_TREE_DATA}
              selectedPath={currentCard.path}
              onSelectNode={handleSelectTreeNode}
              onOpenEditor={(p) => alert(`Open in editor: ${p}`)}
            />
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex justify-center">
            <div className="w-full max-w-3xl">
              <CardPanel
                card={currentCard}
                onOpenFile={handleOpenFileInDrawer}
                onOpenEditor={(p) => alert(`Open in editor: ${p}`)}
                onNextCard={() => {
                  handleSelectTreeNode({
                    id: 'src-auth',
                    name: 'auth',
                    path: 'src/auth',
                    isFolder: true
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Code Preview Drawer */}
      <CodeDrawer
        isOpen={drawerOpen}
        filePath={drawerPath}
        code={drawerCode}
        highlightRange={drawerRange}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Cmd+K Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        items={paletteItems}
        onSelectItem={handleSelectPaletteItem}
        onToggleFocusMode={() => setIsFocusMode((prev) => !prev)}
        onToggleTheme={handleToggleTheme}
        onTaskSearch={(q) => {
          setIsCommandPaletteOpen(false);
          alert(`Executing BM25 task search for: "${q}"`);
        }}
      />
    </Shell>
  );
}
