# Orient — Product Requirements Document (PRD)

> **Working name:** Orient (placeholder)
> **Version:** 0.1 (draft for validation)
> **Status:** Pre-build, hypotheses unvalidated
> **One-liner:** A local, agent-agnostic project map that helps developers understand the folder structure of code an AI agent built, and gives agents the same map so they stop exploring blind.

---

## 1. Summary

AI coding agents now create whole projects in minutes. The developer who asked for the project ends up owning a codebase they did not write and cannot quickly explain. This gap is **comprehension debt**.

Orient is a local tool (an npm package that runs a daemon on `127.0.0.1` and serves a web UI) that:

1. **Maps** a repository: folders, files, roles, dependencies, entry points, ports, APIs.
2. **Describes** every folder and file with structured "cards", written mostly by the AI agents that made the changes (agents report to Orient, Orient does not re-read everything with its own LLM).
3. **Anchors** every card to git state, so a card is automatically marked *outdated* when the code it describes changes.
4. **Serves the same cards to agents** through MCP so a context-free agent can get oriented in one call.
5. **Shows** developers a calm, visual, keyboard-friendly UI: tree, card, diagrams, inbox of things needing review.

It is for **developers** (students to seniors), not non-technical users. It is **not a chatbot**.

---

## 2. Problem

### 2.1 Problem statement
Developers who delegate to AI agents cannot build a mental model of the result fast enough. They cannot answer "what is this folder for, why does it exist, what depends on it, can I safely change it?" without opening many files.

### 2.2 Evidence to gather (currently assumptions)
| # | Assumption | How to validate |
|---|---|---|
| A1 | Devs using agents daily feel they do not understand parts of their own repos | 10 interviews, ask what they do *after* an agent finishes |
| A2 | Existing answers ("ask the agent to explain") are slow, inconsistent, and vanish with the chat | Side-by-side test vs. asking the agent |
| A3 | Students/juniors want to learn architecture from their own AI-built code | Prototype test with 5 students |
| A4 | Agents given a project map make fewer wrong-file edits and use fewer tokens | Benchmark: 10 tasks x 3 repos, with/without |
| A5 | Agents will report reliably enough (>=70-80% of folder creations) via hooks/MCP/rules | Measure in real sessions |
| A6 | Devs will tolerate a local daemon + MCP config install | Install-funnel measurement |

### 2.3 Why now
Agent usage is mainstream; multi-agent workflows (several tools in one repo) are growing; each agent re-explores the repo every session; no cross-agent, persistent, verified project memory exists that is also designed for humans.

---

## 3. Vision, goals, non-goals

### 3.1 Vision
Any developer can open any AI-built project and, within two minutes, correctly say what each top-level folder does, where to add a feature, and what is risky.

### 3.2 Goals (v1)
| ID | Goal | Measure |
|---|---|---|
| G1 | Fast orientation | Time to first correct answer to "where would I add an endpoint?" <= 2 min for 80% of test users |
| G2 | Trustworthy descriptions | >= 95% of displayed claims verifiable against parsed code; false-outdated rate < 15% |
| G3 | Zero-friction setup | Install to first useful screen <= 60 s; no account |
| G4 | Agent usefulness | >= 25% fewer files read / tokens on benchmark tasks with Orient MCP |
| G5 | Works with any agent | File-watcher mode works for 100% of agents; richer mode for >= 3 agents at launch |
| G6 | Habit | >= 40% of weekly users open Inbox after an agent run |

### 3.3 Non-goals (v1)
- Not a chat/Q&A interface.
- Not a sprint board or project manager.
- Not a code editor or reviewer replacing PR review.
- Not for non-technical users (no metaphor-heavy simplification, no gamification).
- Not a cloud service. No accounts, no code upload by default.
- Not a whole-repo force-directed graph.
- Not a documentation generator for publishing.

---

## 4. Users and personas

| Persona | Role | Situation | Core need | Dealbreaker |
|---|---|---|---|---|
| **Arjun** | 2nd-year CS student | Scaffolded a project with an agent; cannot explain `middleware/`, `services/` | Learn real architecture via own code | Jargon wall; being talked down to |
| **Meera** | Mid-level dev | Uses agents daily, reviews output between meetings | Re-orient fast after each agent run; know what to review | Anything slower than reading the diff |
| **Priya** | Senior dev / tech lead | Inherited an AI-built repo or runs multiple agents | Orientation in 2 min; spot fragile areas | A wrong label; explaining the obvious |
| **Kabir** | Dev with low focus span | Overwhelmed by dense UIs, loses thread in large repos | One thing at a time; always a clear next step | Having to decide where to look |

**Primary persona for v1 launch:** to be decided after interviews. Default plan: **Meera** (Inbox as front door) with **Kabir/Arjun** served by Start Here path + Focus mode, and **Priya** served by density settings.

### 4.1 Jobs to be done
- When an AI agent finishes a task, I want to know what needs my attention so I can review only that.
- When I open a project an agent built, I want to understand its structure so I can work in it confidently.
- When I need to add a feature, I want to know where it goes and what it touches so I do not break things.
- When I start a new agent session, I want the agent to already know the repo so I stop repeating context.
- When I am learning, I want real concepts explained using my own code.

---

## 5. Product scope

### 5.1 Release phases

| Phase | Contents |
|---|---|
| **MVP (Alpha)** | CLI + daemon, git-based scan, tree with noise collapse, derived facts (stack, scripts, ports, entry points, imports), card schema + hash-based status, cold-start flow with bootstrap prompt, Explorer (tree + card), Overview, Health basics, MCP server with `get_overview`, `find_for_task`, `report` |
| **v1 (Beta)** | Inbox, Start Here path, Mark reviewed, Activity timeline, Agents & Setup page, container diagram + neighborhood view, command palette with task search, Focus mode, density setting, `AGENTS.md` export, editor deep links |
| **v1.x** | Learn mode (concept chips, predict-then-reveal), editor extension panel, branch/worktree switcher, team-shareable cards via git ref |
| **v2** | Request sequence diagrams, ER diagrams, build time-lapse replay, multi-repo workspace, optional hosted sync |

### 5.2 Feature areas
1. Installation and project opening
2. Scanning and derived facts
3. Cards (authoring, verification, staleness)
4. Explorer UI
5. Overview and diagrams
6. Inbox and review tracking
7. Activity and agent monitoring
8. Health
9. Agent interface (MCP + exported files)
10. Learn mode
11. Settings and adaptivity
12. Privacy and security

---

## 6. User flows

### 6.1 First open
```
npx orient init  ->  detects git root, agents, writes configs (after diff preview)
npx orient       ->  starts daemon, opens localhost:4477/p/<repo>
0s   tree appears (git ls-files), noise collapsed
2s   stack, entry points, scripts, ports
5s   imports, hash-based status dots
10s+ descriptions arrive progressively OR cards "Unknown" with:
     [Generate with your agent]  [Use a small model]  [Skip]
```

### 6.2 Return after agent run (Meera)
Open -> lands on **Inbox** -> <= 5 prioritized items -> click -> tree jumps, card shows delta since described/reviewed -> Mark reviewed -> next -> empty Inbox = "All clear".

### 6.3 Task-driven lookup
`Cmd/Ctrl+K` -> type task -> ranked files, convention to follow, what it touches -> open card -> Open in editor / Copy context.

### 6.4 Learning (Arjun, Kabir)
Start Here -> Next -> short card -> concept chip -> optional predict-then-reveal -> Mark reviewed -> Next.

### 6.5 Audit (Priya)
Overview -> findings (duplicate configs, unused folders, untested areas) -> Health -> Evidence tab -> export `AGENTS.md`.

### 6.6 Landing rule
First visit -> Overview. Return visit with pending Inbox items -> Inbox. Otherwise -> last selection. One-click switch always available.

### 6.7 Agent flow
Agent starts -> calls `get_overview` -> calls `find_for_task` -> works -> calls `report` at events (new folder, dependency, route, port, task end) -> Orient verifies claims against git/parse.

---

## 7. Functional requirements

Priority: **P0** = MVP, **P1** = v1, **P2** = later.

### 7.1 Installation and opening
| ID | Requirement | Pri |
|---|---|---|
| F-INS-1 | `npx orient init` detects git root, even from subfolders | P0 |
| F-INS-2 | `init` detects installed agents (Claude Code, Cursor, Windsurf, Copilot, Cline, Codex, Aider, via config dirs/files) | P0 |
| F-INS-3 | `init` shows a **diff preview** before writing any agent config (MCP entry, hook, rules snippet) and requires confirmation | P0 |
| F-INS-4 | `orient remove` cleanly reverts all written configs and local data | P0 |
| F-INS-5 | `orient` / `orient open` starts the daemon if needed and opens the browser to the repo | P0 |
| F-INS-6 | Launcher page lists recent projects with status dots, active-agent projects, folder drop zone | P1 |
| F-INS-7 | Deep links `/p/<repo>/explore/<path>` open directly to a card | P0 |
| F-INS-8 | `orient status` / `stop` | P0 |
| F-INS-9 | Optional "start on login" | P2 |
| F-INS-10 | No account or network call required for any P0 feature | P0 |

### 7.2 Scanning
| ID | Requirement | Pri |
|---|---|---|
| F-SCN-1 | Initial tree from `git ls-files` (+ untracked non-ignored), honoring `.gitignore` | P0 |
| F-SCN-2 | Noise detection (deps, build output, caches, lockfiles, generated) collapsed to one line | P0 |
| F-SCN-3 | Detect stack, entry points, run scripts (package.json, Makefile, Dockerfile, compose, pyproject, pom, etc.) | P0 |
| F-SCN-4 | Detect ports from compose, `.env.example`, scripts, config; show up/down if probable | P0 |
| F-SCN-5 | Parse imports/exports/routes/env vars via tree-sitter for supported languages (TS/JS, Python first; Java, Go, Rust next) | P0 |
| F-SCN-6 | Unsupported languages degrade gracefully: tree + hashes only, flagged "limited analysis" | P0 |
| F-SCN-7 | Incremental rescans on file change (hash-based) | P0 |
| F-SCN-8 | Scan progress shown as a quiet status line; UI usable while scanning | P0 |
| F-SCN-9 | Never read `.env`, key files, or paths listed in user deny-list | P0 |
| F-SCN-10 | 10,000-file repo: tree interactive < 2 s, full derived scan < 60 s | P1 |

### 7.3 Cards
| ID | Requirement | Pri |
|---|---|---|
| F-CRD-1 | Card exists at three levels: repo, folder, file (symbol level on request, P2) | P0 |
| F-CRD-2 | Card fields split into **derived** (recomputed by parser) and **authored** (agent/LLM/human) | P0 |
| F-CRD-3 | Authored fields: purpose, role, why, conventions, do_not, decisions, representative_file, one_thing_to_remember | P0 |
| F-CRD-4 | Role chosen from a fixed vocabulary (see Architecture doc) | P0 |
| F-CRD-5 | Every card stores source (`agent-reported`, `generated`, `human`) and confidence | P0 |
| F-CRD-6 | Every claim carries evidence (file:line, import edge) viewable on hover | P0 |
| F-CRD-7 | Cards anchored to git hashes (blob, tree, normalized, interface, structure) | P0 |
| F-CRD-8 | Status states: Fresh, Drifted, Outdated, Affected, Unknown | P0 |
| F-CRD-9 | Outdated card shows **delta since described** (added/removed exports, files) | P0 |
| F-CRD-10 | Cards keyed by content hash so branch switches/reverts reuse them | P1 |
| F-CRD-11 | Human edits are pinned; code change flags them for review, never silently overwritten | P1 |
| F-CRD-12 | Validator rejects cards citing nonexistent files/symbols/routes | P0 |
| F-CRD-13 | "Wrong" / "Unclear" feedback button per card; feeds regeneration | P1 |
| F-CRD-14 | Stored one file per folder to avoid merge conflicts; optional git-ref sharing | P1 |
| F-CRD-15 | Card text sanitized and length-capped (prompt-injection defense) | P0 |

### 7.4 Explorer UI
| ID | Requirement | Pri |
|---|---|---|
| F-EXP-1 | Virtualized tree with role badge, status dot, agent marker per row | P0 |
| F-EXP-2 | Card panel with fixed slots and tabs (Card, Code, Changes, Links) | P0 |
| F-EXP-3 | Keyboard navigation (arrows, `/` filter, `o` open in editor, `r` mark reviewed) | P0 |
| F-EXP-4 | Open in editor via `vscode://`, Cursor, JetBrains URI | P0 |
| F-EXP-5 | Code preview drawer with syntax highlighting | P0 |
| F-EXP-6 | URL reflects selection and tab | P0 |
| F-EXP-7 | "Copy context" copies a compact agent-ready summary of the selection | P1 |

### 7.5 Overview and diagrams
| ID | Requirement | Pri |
|---|---|---|
| F-OVW-1 | Repo card: stack, entry points, how to run, ports, top-level folder roles | P0 |
| F-OVW-2 | Freshness summary and top findings | P0 |
| F-OVW-3 | Container diagram, max 7 visible nodes, left-to-right fixed layout, clusters expandable | P1 |
| F-OVW-4 | Neighborhood view: selected item + direct imports/importers only | P1 |
| F-OVW-5 | Every diagram edge validated against parsed imports; LLM-inferred edges badged "inferred" | P1 |
| F-OVW-6 | Export diagram as Mermaid/SVG | P1 |
| F-OVW-7 | Treemap/tree toggle for folder map | P1 |

### 7.6 Inbox and review
| ID | Requirement | Pri |
|---|---|---|
| F-INB-1 | Single ranked list of items needing human eyes, capped at 5 with "show more" | P1 |
| F-INB-2 | Item types: unreported change, outdated card on recently-edited path, collision, failing test, new dependency, new port/env var | P1 |
| F-INB-3 | Mark reviewed records (path, hash, time); later change shows "changed since you reviewed" | P1 |
| F-INB-4 | Opening a card >= 3 s counts as "seen" (not "understood") | P1 |
| F-INB-5 | Empty state: calm "All clear" | P1 |

### 7.7 Activity and agents
| ID | Requirement | Pri |
|---|---|---|
| F-ACT-1 | Live agent list: name, stable color, current task sentence, step (plan/edit/test/done/waiting) | P1 |
| F-ACT-2 | Timeline of change events grouped per agent task | P1 |
| F-ACT-3 | Attribution via hooks/MCP; "unknown agent" shown honestly when undetectable | P1 |
| F-ACT-4 | Unreported changes pinned to top | P1 |
| F-ACT-5 | Collision warning when two agents touch the same folder | P1 |
| F-ACT-6 | Bottom status strip, quiet unless attention needed | P1 |
| F-ACT-7 | Branch/worktree switcher | P2 |

### 7.8 Health and Agents & Setup
| ID | Requirement | Pri |
|---|---|---|
| F-HLT-1 | Counts by state and by source; list of outdated/unknown cards | P0 |
| F-HLT-2 | "Refresh these cards" via user's agent prompt or small model | P1 |
| F-HLT-3 | Per-agent report rate | P1 |
| F-SET-1 | Connected agents with status, last report, install/uninstall per agent | P1 |
| F-SET-2 | Export `AGENTS.md` / `.project/context.json` | P1 |
| F-SET-3 | Model settings: none, user API key, local model (Ollama) | P1 |
| F-SET-4 | Density (compact/comfortable), Focus mode, theme | P1 |

### 7.9 Agent interface (MCP)
| Tool | Purpose | Pri |
|---|---|---|
| `get_overview()` | Repo card (~300 tokens) | P0 |
| `get_folder(path)` / `get_file(path)` | Cards with status and delta | P0 |
| `find_for_task(text)` | Likely files, conventions, impact | P0 |
| `get_conventions(area)` | How things are done here | P1 |
| `get_impact(path)` | What depends on this | P1 |
| `report(...)` | Write-back of changes and decisions | P0 |

Every response includes status (`fresh/outdated/...`) and source. When unknown, return "unknown, read the file" and never guess.

### 7.10 Learn mode (P1.x)
- Concept chips attached to real code locations ("Repository pattern, in `services/userRepo.ts`").
- Predict-then-reveal questions generated from the call graph (answer verifiable).
- Familiar-anchor explanations based on user's known languages.
- Off by default. Concepts never repeat once the user taps "got it."

### 7.11 Adaptivity (P1)
- Local-only behavior signals: card expansion, skips, abandonment.
- Suggests Focus mode or compact density; never forces it.
- All adaptation visible and reversible in Settings.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| **Performance** | First tree render < 1 s on 10k files; UI interactions < 100 ms; status recompute for whole repo < 500 ms using `git ls-files -s` |
| **Privacy** | Local-first. No telemetry without explicit opt-in. Code never leaves the machine unless user configures a model API. Send diffs/briefs, not full repos |
| **Security** | Bind `127.0.0.1` only; per-run random token; check `Host`/`Origin`; no remote access by default; card text sanitized |
| **Reliability** | Daemon survives agent restarts; lockfile for port discovery; corrupted store rebuildable from git |
| **Compatibility** | macOS, Linux, Windows; Node 20+; no native compile step (WASM tree-sitter) |
| **Accessibility** | WCAG 2.2 AA contrast, full keyboard use, screen-reader labels, `prefers-reduced-motion` |
| **Footprint** | Idle daemon < 150 MB RAM; install size < 100 MB |
| **Observability** | Local debug log, `orient doctor` command |
| **Uninstall** | One command reverts everything |

---

## 9. Success metrics

### 9.1 North-star
**Weekly active repos where >= 1 agent change was reviewed or oriented via Orient.**

### 9.2 Product metrics
| Metric | Target (beta) |
|---|---|
| Install -> first card viewed | >= 70% within 5 min |
| Cold start -> descriptions generated | >= 50% of repos within first session |
| Inbox open rate after agent run | >= 40% |
| Weekly retention (W4) | >= 30% |
| Card "wrong" feedback rate | < 5% of views |
| False-outdated rate | < 15% |
| Agent report rate (folder creation, with hooks) | >= 80% |
| Agent benchmark: tokens saved | >= 25% |
| Agent benchmark: correct-file edit rate | +15 pts vs baseline |

### 9.3 Usability test pass criteria
Four users (one per persona), tasks:
- Meera: "An agent just ran. What needs attention?" -> correct in < 90 s.
- Arjun: "Where is login handled?" -> correct in < 2 min.
- Kabir: "Get oriented in this repo." -> states purpose of 4/5 top folders correctly.
- Priya: "Is anything fragile?" -> finds at least 2 true findings, 0 false claims noticed.

---

## 10. Competitive landscape

| Alternative | Strength | Gap Orient fills |
|---|---|---|
| Ask the agent "explain this repo" | Zero setup | Not persistent, not verified, inconsistent, no cross-agent view |
| `CLAUDE.md` / `AGENTS.md` | Simple, agent-native | Hand-maintained, goes stale silently, no human UI |
| Aider repo map, Cursor indexing | Built into the tool | Locked to one tool, not human-readable |
| Repomix / Sourcegraph / DeepWiki | Powerful code context | Not agent-reporting, not staleness-anchored, heavier |
| Swimm / CodeSee | Docs tied to code | Team/enterprise focus, not agent-first |

**Positioning:** cross-agent, persistent, verified, and shared by humans and agents from one source of truth.
**Real competitor risk:** agent vendors building native project maps. Mitigation: neutrality across agents and the staleness/verification layer.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Agents do not report reliably | Cards missing | Tiered pipeline: watcher -> hooks -> report -> small-model fallback; show "unreported" honestly |
| Wrong cards poison trust and later agents | Severe | Validator, evidence, confidence labels, delta display, agent responses point to files |
| False-outdated noise | Users ignore flags | Interface/structure hashes, split derived vs authored fields, track false rate |
| Prompt injection via card text | Security | Structured schema, sanitization, length caps, cards treated as data |
| Token tax resented | Adoption | Report only on events, <= 200 tokens |
| Vendor builds same | Existential | Cross-agent neutrality, open card format |
| Cross-language accuracy | Quality | Tree-sitter base, graceful degradation, 3-stack test fixtures |
| Install friction (editing agent configs) | Drop-off | Diff preview, one-command remove, fall back to file-watcher-only mode |
| "Passive viewing is not learning" | Weak outcome | Predict-then-reveal in Learn mode; measure comprehension tests |
| Local daemon security | Trust | Loopback bind, token, origin checks |

---

## 12. Dependencies and assumptions
- Git installed and project is (or can be) a git repo; non-git folders fall back to a shadow snapshot store.
- Agents support at least one of: MCP, hooks, rules files.
- User has an agent subscription for card generation, or provides an API key / local model.

---

## 13. Validation plan

1. **Week 1-2:** 10 interviews with agent-using developers (students and professionals).
2. **Week 2-3:** Static mockups of Overview, Explorer card, and Inbox; 5-second tests.
3. **Week 3-5:** Prototype: git scan + hash status + card schema + manual cards for 3 repos (Next.js, Spring Boot, FastAPI).
4. **Week 5-6:** Agent benchmark with and without MCP.
5. **Week 6-8:** Reporting-compliance experiment across Claude Code, Cursor, and one more agent.
6. **Gate:** proceed to build only if (a) interview pain confirmed, (b) benchmark shows measurable saving or accuracy gain, (c) report rate >= 60% with hooks.

---

## 14. Open questions
1. Primary launch persona: Meera, Kabir, or Arjun?
2. Should `init` write agent configs automatically (with diff preview) or only print snippets?
3. Single-repo only for v1, or workspace switcher?
4. Should an agent-reported "behavior changed" flag force a card to Outdated even if interfaces match?
5. Where do shareable cards live: repo file, git ref, or local only?
6. Pricing: free local core + paid team sync, or fully open source?
7. Name and visual identity.

---

## 15. Glossary
| Term | Meaning |
|---|---|
| Card | Structured description of a repo/folder/file |
| Derived field | Computed by parsing, never stale |
| Authored field | Written by agent/LLM/human, can go stale |
| Interface hash | Hash of exports, signatures, routes, imports |
| Drifted / Outdated / Affected | Card staleness states |
| Inbox | Ranked list of items needing human review |
| Start Here | Suggested ordered reading path |
| Focus mode | Single-pane, one-card-at-a-time layout |
| Comprehension debt | Gap between code produced and code understood |
