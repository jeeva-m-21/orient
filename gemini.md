# Orient (Sightline) — Agent Engineering Guide & Autonomous Workflow

> **Project:** Orient (Sightline)  
> **Core Thesis:** A local-first, agent-agnostic project map that eliminates comprehension debt for developers and provides shared, verified project memory for AI coding agents.  
> **Invariant:** *Git is the source of truth for "what" (code & structure); agents/developers provide the "why" (intent & rationale).* Deterministic parsing always supersedes generative guessing.

---

## 1. Autonomous Skill Activation Matrix

Whenever a task matches a trigger below, **proactively activate and execute the corresponding skill workflow** without waiting for human prompting:

| Domain / Trigger | Active Skill | Autonomous Workflow & Expected Standard |
|---|---|---|
| **Any Bug or Test Failure** | `systematic-debugging` | Investigate root cause before proposing or editing code. Trace data flow, reproduce minimally, isolate checkpoint failures. Never guess. |
| **New Feature or Bugfix Code** | `test-driven-development` | **Red-Green-Refactor:** 1. Write failing test for acceptance criteria; 2. Run and verify it fails for expected reason; 3. Write minimal code to pass; 4. Run gate checks; 5. Commit atomically referencing ticket ID. |
| **Input Validation, Boundaries, File I/O** | `defense-in-depth` | **Enforce the 4 Layers:** 1. Entry validation (token, Host/Origin, path traversal `path.relative`); 2. Business logic (AST/git cross-check, prompt injection length caps/sanitization); 3. Environment guards (block `.env*`, keys, mutating git); 4. Audit instrumentation (`~/.config/orient/audit.log`). |
| **State Machine & Combinatorial Testing** | `pict-test-designer` (`pypict`) | Generate pairwise combinatorial test suites for the 5-hash engine (`blob`, `normalized`, `interface`, `structure`, `tree`) and card states (`Fresh`, `Drifted`, `Outdated`, `Affected`, `Unknown`). |
| **Frontend UI / Components / Motion** | `emil-design-eng`, `design-taste-frontend`, `impeccable` | Zero AI slop. Calm IDE-blueprint aesthetic. Fixed 10-slot card anatomy. Semantic color isolation (status colors never decorate; agent colors never signal status). Dark/light AA contrast. Full keyboard navigation. |
| **Web UI Verification & E2E Journeys** | `webapp-testing` / `playwright` | Verify end-to-end user journeys (Meera post-agent review in <90s, Arjun Start Here path, Kabir single-pane Focus mode). Capture screenshots and console logs. |
| **Security Fuzzing & API Boundaries** | `ffuf-web-fuzzing` | Fuzz daemon HTTP & SSE endpoints for path traversal, authentication bypass, header injection, and malformed payload resilience. |
| **Code Review & Quality Gates** | `requesting-code-review`, `receiving-code-review` | Technical rigor at sprint gates. Verify contract adherence, performance budgets, and zero leaked secrets before merging. |
| **Ticket / Sprint Verification** | `verification-before-completion` | Run native checks (`npm run check`, `npm test`) and inspect test results before claiming completion or committing. |

---

## 2. Architectural Guardrails & Invariants

### 2.1 The 4-Layer Defense-in-Depth Model
1. **Layer 1 (Entry Point):**
   - Bind strictly to `127.0.0.1`.
   - Per-run 32-byte hex bearer token required on HTTP and SSE (`Authorization: Bearer <token>`).
   - Host header restricted to `127.0.0.1:<port>` / `localhost:<port>`. Origin checked against loopback.
   - Path traversal guard: Normalize all paths and enforce `path.relative(repoRoot, resolvedPath)` has no `..` and does not escape repo boundaries.
   - All external inputs validated through `@orient/schema` Zod definitions.
2. **Layer 2 (Business Logic):**
   - Card claims validator: Citing nonexistent paths, symbols, or routes rejects or downgrades to `confidence: low`.
   - Prompt injection defense: Free-text fields sanitized (strip markdown instructions, script tags, backticks), character-whitelisted, and hard-capped (purpose $\le 140$ chars; why $\le 200$ chars; oneThing $\le 12$ words).
   - Pinned edits: Human edits set `pinned: true` and are never silently overwritten by agent reports.
3. **Layer 3 (Environment Guards):**
   - Hard blacklist: Never read or serve `.env*`, `*.pem`, `*.key`, `id_rsa`, `.git/config`, `credentials*`.
   - Read-only Git: Daemon runs only non-mutating git queries (`ls-files`, `rev-parse`, `status`, `diff`, `hash-object`).
   - File permissions: Config directory `0700`, token file `0600`.
4. **Layer 4 (Audit Instrumentation):**
   - Append-only structured log at `~/.config/orient/audit.log` recording all MCP requests, report validations, rejected claims, and fallback LLM dispatches.

### 2.2 Scalability & Concurrency
- **Multi-Agent OCC:** Optimistic Concurrency Control via integer `version` field. Per-path in-memory mutex serializes write-backs. Concurrent non-conflicting field updates merge cleanly; conflicting fields return `{ status: "conflict" }`.
- **SQLite WAL Mode:** `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA mmap_size = 268435456;`.
- **Watcher Storm Suppression:** Normal edits ($\le 50$ files/sec) use 200ms debounce. If event rate exceeds $50$ files in 200ms (branch switch / `git checkout`), pause individual queue and perform an atomic snapshot diff via `git ls-files -s`.
- **Priority Worker Pool:** Bounded tree-sitter worker pool (`os.availableParallelism() - 1`, max 4) prioritizing active UI cards (P0), routes/entrypoints (P1), recent edits (P2), background tree (P3).
- **Ephemeral Rebuildable Cache:** SQLite is a cache; durable source of truth is git + `.project/cards/*.json`. Database corruption triggers instant auto-rebuild.

---

## 3. Project Structure & Monorepo Topology

```
orient/
├── packages/
│   ├── schema/          # @orient/schema: Zod types for Card, Report, Events, API, MCP
│   ├── core/            # Scanner, tree-sitter parsers, hash engine, card service, ranker
│   ├── daemon/          # Fastify server, SSE, watcher, MCP tool handlers, project registry
│   ├── cli/             # orient CLI (init, open, status, stop, remove, doctor, mcp, ci)
│   ├── web/             # React SPA (Vite + Tailwind + Radix + React Arborist + ELK)
│   ├── adapters/        # Agent config installers (Claude Code, Cursor, Windsurf, Copilot)
│   ├── extractors/      # Language queries (TS/JS, Python, Go, Rust)
│   └── fixtures/        # Multi-stack test repositories (Next.js, FastAPI, Spring Boot)
├── docs/                # PRD.md, ARCHITECTURE.md, DESIGN.md
├── backlog.md           # Sprints, tickets, and execution status
└── gemini.md            # This autonomous workflow orchestration manual
```

---

## 4. Engineering Build Loop (Per Ticket)

Each ticket in `backlog.md` (`SPRINT-N.X`) strictly follows:

1. **Red:** Write failing tests matching acceptance criteria. Confirm they fail for the intended reason.
2. **Green:** Implement the minimal code that passes tests while preserving contracts and docstrings.
3. **Gate:** Run native checks:
   - Type check: `pnpm run typecheck` / `tsc --noEmit`
   - Test runner: `pnpm test`
   - Lint check: `pnpm run lint`
4. **Commit:** Atomic git commit (`feat:`, `fix:`, `test:`, `refactor:`), citing the ticket ID (e.g. `feat(schema): define card zod schema [SPRINT-0.1]`).
5. **Mark Done:** Update ticket to `[x] DONE` in `backlog.md`.

---

## 5. Automated CI/CD & Governance (`orient ci`)

To ensure comprehension debt never breaches production:
```bash
# Verify repo freshness and card validity
npx orient ci --max-outdated=10% --disallow-unreported=src/auth,src/payments

# Export snapshots for context-free agents
npx orient export --format=agents-md
```
Exit 0 indicates clean compliance; exit 1 blocks PR merges on policy breach.
