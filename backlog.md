# Orient (Sightline) — Engineering Backlog & Sprint Roadmap

> **Status Tracking:** `[ ] TODO` · `[/] IN_PROGRESS` · `[x] DONE`  
> **Development Loop:** Red (failing test) → Green (minimal code) → Gate (`typecheck`, `lint`, `test`) → Commit (`feat:`, `fix:`, `test:`, `refactor:` referencing ticket ID) → Mark `[x] DONE`.

---

## Sprint 0: Monorepo Foundation & Contract Schemas

Goal: Establish the repository infrastructure, strict TypeScript configurations, testing harnesses, `@orient/schema` Zod data models, and multi-stack golden test fixtures.

- [x] **SPRINT-0.1: Monorepo Tooling & Workspace Setup**
  - Configure root `package.json`, pnpm workspaces, TypeScript strict `tsconfig.base.json`, Vitest, ESLint, and Prettier.
  - Setup scripts: `build`, `test`, `typecheck`, `lint`, `clean`.
  - Acceptance Criteria: `pnpm run typecheck` and `pnpm test` execute cleanly across all packages.

- [x] **SPRINT-0.2: Core Card & Anchor Zod Schemas (`@orient/schema`)**
  - Define `Role`, `CardLevel`, `StalenessState`, and `Source` enums.
  - Implement Zod schema for `Card`: derived fields (fileCount, loc, keyFiles, dependsOn, usedBy, surface, tests, health) and authored fields (purpose, role, why, oneThing, conventions, doNot, decisions, representativeFile).
  - Implement `Anchor` schema (commit, blob, tree, normalized, interface, structure).
  - Acceptance Criteria: Unit tests pass verifying valid cards parse successfully and invalid structures fail with actionable Zod errors.

- [x] **SPRINT-0.3: Agent Reports, Events & API Contract Schemas (`@orient/schema`)**
  - Define `Report` and `ReportItem` schemas for agent writeback.
  - Define SSE event payload schemas (`scan.progress`, `tree.patch`, `card.updated`, `status.changed`, `agent.state`, `inbox.updated`).
  - Define REST API request/response schemas for `/api/projects`, `/api/p/:id/tree`, `/api/p/:id/card`, `/api/p/:id/inbox`, and `/api/p/:id/review`.
  - Acceptance Criteria: Full coverage of all inter-process API boundaries with bidirectional Zod parsing tests.

- [x] **SPRINT-0.4: Defense-in-Depth Schema Guards & Sanitizers (`@orient/schema`)**
  - Implement prompt-injection sanitization functions: strip markdown command triggers, HTML/script tags, and enforce length limits (purpose $\le 140$, why $\le 200$, oneThing $\le 12$ words).
  - Implement path traversal sanitizer: normalize paths and verify relative path does not escape repository root.
  - Acceptance Criteria: Unit tests assert malicious injections (`<script>`, `System: ignore rules`, `../../etc/passwd`) are either stripped or rejected.

- [x] **SPRINT-0.5: Golden Test Fixtures Repository Generation (`@orient/fixtures`)**
  - Create synthetic test fixtures for 3 stacks: Next.js (TypeScript), FastAPI (Python), and Spring Boot (Java).
  - Include representative folder structures, entry points, routes, and expected golden cards.
  - Acceptance Criteria: Fixture directories exist with verified synthetic git histories and snapshot expectations.

---

## Sprint 1: Multi-Tier Hash Engine & Git Scanner (`@orient/core`)

Goal: Deliver high-performance git tree scanning, multi-tier hashing (`blob`, `normalized`, `interface`, `structure`, `tree`), card staleness evaluation, and watcher storm suppression.

- [x] **SPRINT-1.1: Fast Git Tree Scanner & Noise Classifier**
  - Implement scanner executing `git ls-files -s` and untracked non-ignored file enumeration.
  - Implement noise classification filter collapsing build dirs (`node_modules`, `dist`, `.next`, `target`, `__pycache__`, `venv`, lockfiles) into single metadata entries.
  - Acceptance Criteria: Scanner returns structured file nodes for a 10,000-file repository in $< 1.0\text{ s}$.

- [x] **SPRINT-1.2: Multi-Tier Hashing Engine**
  - Implement `blob` hash computation via git object hashing.
  - Implement AST `normalized` hash (stripping trivia, whitespace, and comments).
  - Implement `interface` hash (exports, signatures, routes, imports).
  - Implement folder `structure` hash (sorted child names + types).
  - Acceptance Criteria: Property tests verify code reformatting/whitespace changes alter `blob` hash while preserving `normalized` and `interface` hashes.

- [x] **SPRINT-1.3: Card Staleness State Machine**
  - Implement transition evaluator: `Unknown` → `Fresh` → `Drifted` → `Outdated` → `Affected`.
  - Implement 1-hop reverse dependency invalidation (`Affected` state).
  - Calculate delta summary (`+N exports, -M exports`) when transitioning to `Outdated`.
  - Acceptance Criteria: State machine unit tests cover all 10 state transitions; reverting code to described hash immediately restores `Fresh` status.

- [x] **SPRINT-1.4: Combinatorial State Testing with PICT**
  - Design and run pairwise combinatorial tests using `pypict` for all permutations of file changes (byte change, AST change, export change, structure change, dependency change).
  - Acceptance Criteria: 100% pairwise coverage of state transitions validated against expected status.

- [x] **SPRINT-1.5: Adaptive Watcher & Watcher Storm Suppression**
  - Implement file watcher with 200ms debounce.
  - Implement storm suppression: if events exceed $50$ files/200ms (branch switch, pull, checkout), suppress per-file parsing and execute a single snapshot diff via `git ls-files -s`.
  - Acceptance Criteria: Simulated 5,000-file git checkout triggers snapshot diff without saturating event loop.

---

## Sprint 2: AST Extraction & Language Parsers (`@orient/extractors`)

Goal: Build resilient Tree-sitter WASM parsers for TypeScript, JavaScript, and Python with priority worker pool scheduling.

- [x] **SPRINT-2.1: Tree-Sitter WASM Harness & Priority Worker Pool**
  - Initialize Tree-sitter WASM runtime with worker threads (`worker_threads`).
  - Implement 4-tier priority task queue: P0 (UI active file), P1 (entry points/routes), P2 (watcher edits), P3 (background index).
  - Bounded concurrency to `os.availableParallelism() - 1` (max 4).
  - Acceptance Criteria: Worker pool executes concurrent extractions without blocking main thread.

- [x] **SPRINT-2.2: TypeScript/JavaScript Language Extractor**
  - Implement Tree-sitter queries for ESM/CJS imports and exports.
  - Implement route extractors for Express, Next.js App Router, and Fastify.
  - Extract environment variable accesses (`process.env.XYZ`) and ports.
  - Acceptance Criteria: 100% accurate extraction against Next.js test fixture files.

- [x] **SPRINT-2.3: Python Language Extractor**
  - Implement Tree-sitter queries for Python imports (`import x`, `from x import y`) and functions/classes.
  - Implement route extractors for FastAPI (`@app.get`, `@router.post`) and Flask.
  - Extract environment variable accesses (`os.getenv`, `os.environ`) and ports.
  - Acceptance Criteria: 100% accurate extraction against FastAPI test fixture files.

- [x] **SPRINT-2.4: Import Graph Resolution & Centrality Ranker**
  - Resolve relative and package import specifiers to workspace file paths.
  - Construct directed dependency graph and calculate in-degree/out-degree centrality.
  - Rank top 3 key files per folder by centrality.
  - Acceptance Criteria: Import graph correctly maps dependencies in multi-folder fixture; key files match golden expectations.

---

## Sprint 3: Card Persistence, Hard Gate Validator & Ingestion Engine

Goal: Implement rebuildable SQLite caching, durable `.project/cards/` JSON storage, OCC concurrency controls, and hard-gate claim verification.

- [x] **SPRINT-3.1: SQLite Database Engine & Cache Self-Healing**
  - Initialize SQLite (`better-sqlite3`) with WAL mode, `PRAGMA busy_timeout = 5000;`, and memory-mapped IO.
  - Define schema: projects, files, cards, card_versions, reviews, change_events, sessions, import_edges.
  - Implement auto-rebuild: if DB is deleted or corrupt, automatically rescan git and rebuild cache from durable cards.
  - Acceptance Criteria: Deleting `orient.db` and restarting daemon transparently restores all state.

- [x] **SPRINT-3.2: Durable Card Storage (`.project/cards/`)**
  - Read/write card files to `<repo>/.project/cards/<path-hash>.json`.
  - Maintain content-addressed version history.
  - Implement optional git-ref mirror (`refs/orient/cards`).
  - Acceptance Criteria: Cards serialize to formatted JSON without merge conflicts; git ignore rules respected.

- [x] **SPRINT-3.3: Hard Gate Claims Validator**
  - Cross-check all claims in authored fields against parsed AST index: referenced paths, routes, exports, and files must exist.
  - Reject hallucinated paths; downgrade unverifiable claims to `confidence: low`.
  - Check role against fixed 23-item vocabulary.
  - Acceptance Criteria: Validator rejects invalid reports with descriptive rejection errors; valid reports pass into store.

- [x] **SPRINT-3.4: Optimistic Concurrency Control & Per-Path Mutex**
  - Implement integer `version` checking for cards (`expectedVersion`).
  - Implement async per-path in-memory lock during report ingestion.
  - Implement 3-way disjoint slot merge (concurrent non-conflicting field updates merge cleanly; conflicting fields return error).
  - Acceptance Criteria: Simulated concurrent writes from two agents merge non-overlapping fields and reject conflicting ones with status `conflict`.

- [x] **SPRINT-3.5: Audit Logger & Forensics (`~/.config/orient/audit.log`)**
  - Implement Layer 4 append-only structured audit logger.
  - Record timestamp, agent identity, session ID, tool call, validation outcome, and rejected reasons.
  - Redact sensitive snippets and tokens.
  - Acceptance Criteria: Audit log accurately reflects all test ingestion events with zero leaked secret keys.

---

## Sprint 4: Daemon & MCP Server (`@orient/daemon` & `@orient/cli`)

Goal: Implement the Fastify server, loopback security boundaries, SSE event bus, official MCP tools, and CLI commands.

- [x] **SPRINT-4.1: Fastify Daemon Lifecycle & Zombie Cleanup**
  - Implement daemon startup binding strictly to `127.0.0.1`.
  - Port arbitration across `4477..4499`; write state to `~/.config/orient/daemon.json` (`0600` permissions).
  - Zombie lockfile cleanup: probe recorded PID with `process.kill(pid, 0)` on startup.
  - Acceptance Criteria: Daemon starts on 4477, survives stale lockfiles, and shuts down cleanly on SIGTERM/SIGINT.

- [x] **SPRINT-4.2: Layer 1 Entry Security & Path Traversal Guards**
  - Generate 32-byte cryptographic bearer token per run.
  - Enforce token authentication on all HTTP endpoints and SSE streams.
  - Enforce strict `Host` and `Origin` allow-list checks.
  - Path traversal guard: reject any path attempting to escape repository root via `path.relative`.
  - Acceptance Criteria: Security tests verify unauthorized requests, invalid origins, and directory traversal attempts (`../../`) return 401/403.

- [x] **SPRINT-4.3: Realtime Event Bus & SSE Stream**
  - Implement in-process event bus emitting typed events (`scan.progress`, `card.updated`, `status.changed`, `agent.state`, `inbox.updated`).
  - Fastify SSE endpoint `/events?project=` streaming typed JSON payloads.
  - Acceptance Criteria: Client connected to SSE receives live patch events on file changes.

- [x] **SPRINT-4.4: Model Context Protocol (MCP) Tools**
  - Implement official MCP SDK server exposing:
    - `get_overview`: Compact repo card (~300 tokens).
    - `get_folder(path)` / `get_file(path)`: Cards with staleness status and delta.
    - `find_for_task(text)`: Lexical BM25 retrieval of ranked files and conventions.
    - `get_conventions(area)`: Coding conventions with code examples.
    - `get_impact(path)`: Reverse dependencies and affected paths.
    - `report(report)`: Agent writeback pipeline with hard gate validation.
  - Acceptance Criteria: Mock agent connects via stdio, queries overview, and successfully submits reports.

- [x] **SPRINT-4.5: CLI Commands & MCP Stdio Shim (`orient`)**
  - Implement CLI subcommands: `open`, `status`, `stop`, `doctor`, `export`, and `mcp`.
  - `mcp` stdio shim ensures daemon is alive and proxies MCP messages over local IPC/HTTP.
  - `doctor` reports git status, node version, port, permissions, and agent hooks health.
  - Acceptance Criteria: `orient status` reports daemon PID; `orient doctor` outputs clean diagnostics.

- [x] **SPRINT-4.6: Security Fuzzing with FFUF**
  - Run `ffuf-web-fuzzing` against daemon endpoints to test path traversal, malformed JSON, auth bypass, and header fuzzing.
  - Acceptance Criteria: Zero unhandled crashes; 100% of fuzzed malicious requests safely rejected.

---

## Sprint 5: Cold Start Bootstrap, Task Search & CI Automation

Goal: Provide cold-start agent bootstrapping, deterministic brief fallback generator, lexical task search, and headless CI verification.

- [x] **SPRINT-5.1: Cold Start Bootstrap Prompt Generator**
  - Generate copyable bootstrap prompt instructing developer's active agent to inspect top-level folders and write cards into `.project/cards/*.json`.
  - Acceptance Criteria: Generated prompt adheres to `@orient/schema` and produces cards that pass hard gate validation.

- [x] **SPRINT-5.2: Fallback LLM Generator & Critic Pass**
  - Construct compact deterministic brief (AST summary, exports, imports, diffs—never full source code).
  - Connect to local Ollama (`http://127.0.0.1:11434`) or user API key.
  - Implement critic pass to prune any generated claim unsupported by the AST brief.
  - Acceptance Criteria: Generator produces valid card JSON; critic pass strips ungrounded hallucinations.

- [x] **SPRINT-5.3: BM25 Lexical Task Search**
  - Implement SQLite Full-Text Search (FTS5) over card `purpose`, `role`, `keyFiles`, routes, exports, and env vars.
  - Expand retrieval along 1-hop import edges.
  - Return ranked files, conventions, and affected touchpoints in $< 100\text{ ms}$.
  - Acceptance Criteria: Task search query "add rate limit to login" returns auth routes and controllers with conventions.

- [x] **SPRINT-5.4: Headless CI/CD Runner (`orient ci`)**
  - Implement `orient ci` command with threshold arguments (`--max-outdated=10%`, `--disallow-unreported=src/auth`).
  - Output JUnit / TAP formatted reports.
  - Auto-export verified `AGENTS.md` and `.project/context.json` snapshots.
  - Acceptance Criteria: Exits 0 when codebase passes thresholds; exits 1 on policy breach.

---

## Sprint 6: Frontend Core Architecture & Explorer UI (`@orient/web`)

Goal: Build the calm, accessible, keyboard-driven web interface with virtualized tree, 10-slot Card panel, code drawer, and command palette.

- [x] **SPRINT-6.1: Web App Foundation & Design Token System**
  - Setup Vite + React + Tailwind + Radix UI primitives.
  - Implement CSS variables design tokens for light and dark themes (default dark) with strict WCAG AA contrast.
  - Establish semantic color isolation (status colors separate from agent identity colors).
  - Acceptance Criteria: Token system verified against design specs; zero hardcoded hex colors outside token definition.

- [x] **SPRINT-6.2: Virtualized Repository Tree Component**
  - Integrate `react-arborist` for virtualized rendering of large trees (up to 50,000 files).
  - Render role glyphs, file counts, agent activity pulses, and status dots.
  - Noise group row: single collapsed line for dependencies and build artifacts.
  - Full keyboard navigation: Up/Down arrows, Left/Right expand/collapse, `Enter` select, `o` open in editor, `r` mark reviewed.
  - Acceptance Criteria: Tree scrolls smoothly at 60fps on 10,000-file repository fixture.

- [x] **SPRINT-6.3: Signature 10-Slot Card Component**
  - Header: path in code font, one-line purpose, badges row (status, source, agent, confidence).
  - Body slots in strict order: 1. One thing; 2. Role + evidence tooltip; 3. Key files; 4. Depends on / Used by; 5. Surface; 6. Conventions; 7. Do not; 8. Why / Origin; 9. Health; 10. Evidence citations.
  - Outdated banner at top showing precise delta (`+N exports, -M exports`) with preserved dimmed text.
  - Tabs: Card, Code, Changes, Links.
  - Acceptance Criteria: Card renders identically across folders; slots never shift order; tooltips cite verified evidence.

- [x] **SPRINT-6.4: Code Preview Drawer & Editor Integration**
  - Implement drawer previewing syntax-highlighted code via Shiki.
  - Implement deep links to IDEs (`vscode://file/...`, Cursor, JetBrains).
  - "Copy context" button copying an agent-ready markdown summary.
  - Acceptance Criteria: Clicking a key file opens syntax-highlighted preview with line numbers and editor launch button.

- [x] **SPRINT-6.5: Command Palette (`Cmd/Ctrl+K`)**
  - Global modal palette powered by `cmdk` (Radix).
  - 3 result groups: 1. Go to file/folder; 2. Commands (toggle density, refresh, export); 3. Find for task (retrieval list, not chat).
  - `Enter` opens in UI; `Cmd+Enter` opens in editor.
  - Acceptance Criteria: `Cmd+K` opens instantly; task search returns ranked results in $< 100\text{ ms}$.

- [x] **SPRINT-6.6: Playwright E2E UI Journey Verification**
  - Setup Playwright test harness for local web UI.
  - Test journeys: 1. Open repository & render shell/tree/card; 2. Keyboard tree navigation & card update; 3. Command Palette search & jump; 4. Code drawer open; 5. Focus mode toggle.
  - Acceptance Criteria: 100% passing Playwright journeys with recorded screenshots in artifact directory.

---

## Sprint 7: Overview, Inbox, Activity & Diagrams

Goal: Implement the high-level Overview screen, Container/Neighborhood diagrams with ELK, the review Inbox, Activity timeline, and single-pane Focus mode.

- [x] **SPRINT-7.1: Overview Screen & Runtime Strip**
  - Render Repo card: name, one-line purpose, stack versions, entry points, copyable run commands.
  - Render Runtime strip: live chips for detected ports/services with up/down indicator and compose source tooltip.
  - Top 5 structural findings (duplicate configs, untested areas, unused folders).
  - Freshness summary: percentage fresh, outdated count, unreported count.
  - Start Here path with [Start] button.
  - Acceptance Criteria: New user can understand repo stack, commands, and health in $< 10\text{ s}$.

- [x] **SPRINT-7.2: Container & Neighborhood Diagrams (ELK Layout)**
  - Implement React Flow canvas with ELK layered left-to-right deterministic layout.
  - Container diagram: capped at 7 visible nodes with expandable clusters.
  - Neighborhood view: selected card + direct 1-hop imports/importers.
  - Inferred edges badged with dashed lines and "inferred" label.
  - Export diagram as SVG or Mermaid.
  - Acceptance Criteria: Diagrams layout deterministically without crossing hairballs; selecting nodes dims unrelated elements.

- [x] **SPRINT-7.3: Inbox Screen & Review Tracking**
  - Implement Inbox displaying up to 5 prioritized items (unreported changes, outdated touched cards, collisions, new dependencies).
  - Score items: $\text{severity} \times \text{recency} \times (1 - \text{seen})$.
  - "Mark reviewed" action records `(path, hash, timestamp)`.
  - Empty state displays calm "All clear".
  - Acceptance Criteria: Clicking an inbox item jumps tree to path and opens delta diff; reviewing all items transitions to "All clear".

- [x] **SPRINT-7.4: Activity Screen & Agent Monitoring**
  - Top agent bar: agent name, stable color, current task sentence, step pill (plan ▸ edit ▸ test ▸ done).
  - Timeline of file change bursts grouped by agent task session.
  - Collision warning banner if multiple agents edit the same directory.
  - Unreported changes pinned at top.
  - Acceptance Criteria: Multiple agents executing edits are attributed with distinct colors; collisions trigger banner.

- [x] **SPRINT-7.5: Single-Pane Focus Mode & Adaptivity**
  - Focus Mode (`F` key): collapses tree and sidebar, rendering a single centered card (max 640px) with larger type and Back/Next navigation.
  - Suggested automatically after repeated dense view abandonment (never forced).
  - Start Here ordered progression: 1 of 6, 2 of 6, etc.
  - Acceptance Criteria: Focus mode toggles cleanly via shortcut; keyboard walks Start Here path smoothly.

---

## Sprint 8: Agent Adapters, End-to-End Verification & Production Packaging

Goal: Build agent config installers (`orient init`), execute Playwright end-to-end user persona testing, verify performance benchmarks, and assemble production distribution.

- [x] **SPRINT-8.1: Agent Adapters & Config Manifest (`orient init` / `remove`)**
  - Implement detection and installers for Claude Code (`.claude/`), Cursor (`.cursor/`), Windsurf (`.windsurf/`), Copilot, and Aider.
  - Show formatted visual diff preview before writing configs.
  - Record written changes in config manifest (`path`, `before-hash`, `inserted-block-id`).
  - `orient remove` cleanly reverts all modified files using manifest.
  - Acceptance Criteria: `orient init` correctly configures agent MCP; `orient remove` restores files to bit-for-bit original state.

- [x] **SPRINT-8.2: End-to-End Persona Journey Testing with Playwright**
  - Implement automated E2E tests validating usability pass criteria:
    - Meera Journey: Agent finishes task → open Inbox → review delta in $< 90\text{ s}$.
    - Arjun Journey: Onboarding student → Start Here path → locate login route in $< 2\text{ min}$.
    - Kabir Journey: Low-focus mode → Focus mode navigation → identify top 4 folder purposes.
    - Priya Journey: Senior lead audit → Overview findings → locate fragile/untested modules.
  - Acceptance Criteria: All 4 persona E2E journey tests pass green in CI.

- [ ] **SPRINT-8.3: Scalability & Performance Benchmark Verification**
  - Generate synthetic 10,000-file and 50,000-file repositories.
  - Enforce CI performance gates: first tree render $< 1.0\text{ s}$, full derived facts scan $< 45\text{ s}$, memory $< 120\text{ MB}$.
  - Acceptance Criteria: Performance benchmark passes with zero budget regressions.

- [ ] **SPRINT-8.4: Production Packaging & CLI Verification (`npm pack`)**
  - Bundle SPA assets into daemon public directory; bundle vendored WASM grammars.
  - Verify `npx orient` runs standalone without global npm installation.
  - Verify `orient doctor` passes all environment and permission checks.
  - Acceptance Criteria: `npm pack` outputs lean archive ($< 100\text{ MB}$); clean install runs out of the box on Linux, macOS, and Windows.
