# Orient — Design Document

> **Version:** 0.1 | **Companion docs:** `PRD.md`, `ARCHITECTURE.md`
> Frontend is a local web app served on `127.0.0.1:4477`. It is **not** a chatbot and **not** a cockpit.

---

## 1. Design intent

**One sentence:** a calm engineering workspace where a developer sees what a folder is, why it exists, what it connects to, and whether to trust the description, without having to decide where to look.

**Feel:** a well-made IDE sidebar crossed with a blueprint. Quiet, precise, fast. Real engineering vocabulary, no toy metaphors.

### 1.1 Principles
1. **One primary pane at a time.** Tree + card is the default; never more than two dense regions.
2. **Quiet by default.** Nothing blinks unless a human is needed (collision, failure, unreported change).
3. **Same slots, every time.** Every card has the same fields in the same order. Learn one, know all.
4. **Evidence over assertion.** Every claim reveals its source on hover. Wrong labels lose developers forever.
5. **Progressive depth.** Glance -> Orient -> Understand -> Evidence. Each persona stops where they want.
6. **Code is one click away.** The tool speeds the path to code; it never replaces it.
7. **No decisions forced.** There is always a next card, a suggested path, a default landing.
8. **Adapt, never force.** Density and Focus mode are suggested from behavior, always reversible.
9. **No gamification.** No streaks, confetti, fog, points. Progress is a quiet reviewed/not-reviewed state.
10. **Honest mess.** Show duplicates, unknowns, stale data plainly. Honesty builds the trust that polish cannot.

### 1.2 Depth layers
| Layer | Name | Content | Where |
|---|---|---|---|
| L0 | Glance | Agents active, outdated count, unreported count | Top bar, terminal line, editor status bar |
| L1 | Orient | Repo card, folder map, findings, Start Here | Overview |
| L2 | Understand | Folder/file card with fixed slots | Explorer card |
| L3 | Evidence | Code, diffs, dependency graph, hashes, history | Card tabs, peek drawer |

### 1.3 Persona fit
| Persona | Default experience |
|---|---|
| Arjun (student) | Start Here path, Learn mode on, comfortable density, concept chips |
| Meera (mid) | Lands on Inbox after agent runs, compact density, task search |
| Priya (senior) | Overview findings, Health, Evidence tab, compact, Learn off |
| Kabir (low focus) | Focus mode, short cards, Next/Back, Start Here, minimal motion |

---

## 2. Information architecture

```
Launcher (localhost:4477)
└── Project /p/<repo>
    ├── Overview        /overview
    ├── Inbox           /inbox
    ├── Explorer        /explore/<path>?tab=card|code|changes|links
    ├── Activity        /activity
    ├── Health          /health
    └── Agents & Setup  /setup
Global: Command palette (Cmd/Ctrl+K), Settings, Focus mode, Branch/worktree switcher
```

**Landing rule:** first visit -> Overview; return with Inbox items -> Inbox; otherwise -> last selection. One click always switches.

---

## 3. Layout

### 3.1 Shell (desktop, >= 1100 px)

```
┌───────────────────────────────────────────────────────────────────────┐
│ ◧ api ▾ · main ▾    ⌘K Jump, find, or search a task…   ● 2 agents  ⚠ 3 │  Top bar 48px
├────┬───────────────────────────┬──────────────────────────────────────┤
│ ⌂  │ TREE        [Path] [All]  │ src/auth/                 [Outdated] │
│ ✉3 │ ▸ START HERE              │ Login, sessions, JWT                 │
│ ▤  │   1 app.ts      entry     │ ┌Card┬Code┬Changes┬Links┐            │
│ ◔  │   2 routes/               │ │ Role · Key files · Depends on ·    │
│ ♥  │   3 auth/ ●               │ │ Used by · Surface · Do not · Tests │
│ ⚙  │ ▾ src/                    │ │ Origin · Evidence                  │
│    │   ▾ auth/ ●               │ └────────────────────────────────────┘
│    │     login.ts              │ [Open in editor] [Mark reviewed] [Next →]
├────┴───────────────────────────┴──────────────────────────────────────┤
│ ● Claude editing src/payments/ · plan ▸ edit ▸ test             Details │  Status strip 32px
└───────────────────────────────────────────────────────────────────────┘
```

| Region | Width | Notes |
|---|---|---|
| Left rail | 56 px | Icons: Overview, Inbox (badge), Explorer, Activity, Health, Setup |
| Tree | 280-360 px (resizable) | Virtualized, filter, path/all toggle |
| Card panel | flex | Max readable width 760 px; rest is whitespace |
| Status strip | full | Single line; expands to a drawer on click |

### 3.2 Focus mode
One button (or `F`) collapses to a single centered pane (max 640 px): card only, larger type, **Back / Next**, progress "3 of 6". Tree hidden. Suggested after repeated abandonment of dense views; never forced.

### 3.3 Responsive
| Width | Behavior |
|---|---|
| >= 1400 | Three regions comfortable |
| 1100-1399 | Tree narrower; Links tab replaces side panel |
| 760-1099 | Tree becomes a slide-over; card full width |
| < 760 | Focus-mode layout only; rail becomes bottom tabs (read-only viewing; editing actions hidden) |

---

## 4. Design tokens

Define as CSS variables on `:root`; dark values under `:root[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` when theme is `system`. **Default theme: dark.**

### 4.1 Color

**Neutrals**
| Token | Light | Dark |
|---|---|---|
| `--bg` | `#FAFAF9` | `#0E1116` |
| `--surface` | `#FFFFFF` | `#151A21` |
| `--surface-2` | `#F3F4F2` | `#1B222B` |
| `--border` | `#E4E6E3` | `#262E38` |
| `--text` | `#1B1F24` | `#E6EAF0` |
| `--text-muted` | `#5B636D` | `#9AA4B2` |
| `--text-faint` | `#8A929C` | `#6B7684` |

**Accent (selection, focus, links)**
| Token | Light | Dark |
|---|---|---|
| `--accent` | `#3B6FD4` | `#6B9BF2` |
| `--accent-soft` | `#E8EFFC` | `#1A2A47` |

**Status (muted, never saturated; only ever for status)**
| State | Light fg / bg | Dark fg / bg |
|---|---|---|
| Fresh | `#2F7D57` / `#E6F3EC` | `#5CC28F` / `#16301F` |
| Drifted | `#8A7A2B` / `#F6F1D9` | `#D3C46A` / `#2E2A12` |
| Outdated | `#B5651D` / `#FBEBD9` | `#E39A55` / `#33210E` |
| Affected | `#6A5BB0` / `#ECE8F7` | `#A596E0` / `#221D38` |
| Unknown | `#6E7681` / `#EEF0F2` | `#8B95A3` / `#1F252D` |
| Error/Failing | `#B3402F` / `#FAE5E1` | `#E8776A` / `#361714` |

**Agent identity (small dot or edge marker only, never a fill)**
`#E07A5F` coral, `#3D9970` green, `#7B6CF6` violet, `#E9A23B` amber, `#2BA6C9` cyan, `#C45B9E` magenta. Assigned by hash of agent name; unknown agent = neutral gray ring.

**Source badge colors:** `verified` = status-fresh outline; `agent-said` = neutral outline; `generated` = dashed neutral outline; `human` = accent outline.

**Rule:** a color never carries two meanings. Status color is not used for decoration; agent color is not used for status.

### 4.2 Typography
| Token | Value |
|---|---|
| `--font-ui` | `Inter, system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--font-code` | `"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace` |
| Scale | 12 / 13 / 14 (base) / 16 / 20 / 24 px |
| Line height | 1.5 body, 1.3 headings |
| Weights | 400 body, 500 labels, 600 titles |
| Card title | 20 px/600; section label 12 px/500 uppercase tracking +0.04em muted |
| Focus mode | scale +2 px |

### 4.3 Spacing, radius, elevation
- Spacing scale (px): 4, 8, 12, 16, 24, 32, 48. Base unit 4.
- Radius: 6 (controls), 10 (cards, nodes), 999 (pills/dots).
- Borders 1 px `--border`. Elevation by border and `--surface-2`, not shadows. Only popovers and palette use a soft shadow `0 8px 24px rgba(0,0,0,.18)`.
- Density: **Comfortable** row height 32, card padding 24; **Compact** row height 26, card padding 16.

### 4.4 Motion
| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120 ms | Hover, focus ring |
| `--dur` | 180 ms | Panels, tab switch, expand group |
| `--ease` | `cubic-bezier(.2,.0,.0,1)` | Everything |
| Live update highlight | 600 ms soft fade of `--accent-soft` | Card updated by SSE |
| Trace dot | click-to-play only | Diagram request trace (v2) |

`prefers-reduced-motion`: disable all transitions except opacity fades at 0 ms. No auto-playing animation anywhere.

### 4.5 Iconography
Line icons, 1.5 px stroke, 16/20 px (Lucide). Role icons are small monochrome glyphs next to a text label, never the only signal. Status uses a dot **plus** text/aria label (color is never the only carrier).

---

## 5. Core components

### 5.1 Badges (three fixed families)
| Family | Values | Shape |
|---|---|---|
| **Status** | Fresh, Drifted, Outdated, Affected, Unknown | Dot + label pill |
| **Source** | verified, agent-said, generated, human | Outline chip with tiny icon |
| **Agent** | name + color | Colored dot + name; "unknown agent" gray ring |

Hover on any badge shows evidence: "role inferred from: exports Express router, mounted in `app.ts:14`".

### 5.2 Tree row
```
[chevron] [role glyph] name             [file count] [agent dot] [status dot]
```
- Noise group row: gray, collapsed, "node_modules, dist, .next (machine-made)".
- Agent dot pulses once (not continuously) on new activity.
- Keyboard: Up/Down move, Right/Left expand/collapse, `/` focus filter, `o` open in editor, `r` mark reviewed, `Enter` select, `Esc` clear.

### 5.3 Card (the signature component)

**Header:** path (code font), purpose (one line), badges row: status | source | agent | confidence.
**Body slots, fixed order:**

| # | Slot | Content | Default visibility |
|---|---|---|---|
| 1 | One thing to remember | <= 12 words, emphasized | Always |
| 2 | Role | Role label + "why inferred" evidence tooltip | Always |
| 3 | Key files | Up to 3 with one-line reason; "+N more" | Always |
| 4 | Depends on / Used by | Chips, max 4 each | Always |
| 5 | Surface | Routes, env vars, tables, ports (collapsible) | Collapsed unless present |
| 6 | Conventions | "New endpoints follow `routes/users.ts`" | Expanded in compact density |
| 7 | Do not | Hard constraints, warning style | Shown if any |
| 8 | Why / Origin | Task prompt summary, agent, commit | Collapsed |
| 9 | Health | Tests present, last changed, TODO count | Collapsed |
| 10 | Evidence | File:line citations, hashes, described-at commit | Tab / L3 |

**Outdated banner (top of card):**
```
Outdated · described 14 commits ago
Since then: +2 exports (refreshToken, revokeSession), −1 (legacyLogin)
[View diff]  [Refresh with my agent]  [Refresh with small model]
```
Text remains visible and dimmed slightly below the banner; never hidden.

**Tabs:** Card | Code | Changes | Links. Links tab hosts the neighborhood diagram.
**Footer actions:** Open in editor (primary), Mark reviewed, Copy context, Next → (when a path is active). Wrong/Unclear feedback as a small overflow action.

**Short mode (Focus / Kabir):** slots 1-4 only, larger type, "More" expands the rest.

### 5.4 Command palette (⌘/Ctrl+K)
One input, three result groups:
1. **Go to** files/folders (fuzzy)
2. **Commands** (switch view, toggle density, export AGENTS.md, refresh outdated)
3. **Find for task**: typing a sentence returns ranked files + convention + "touches" (retrieval results list, **not a chat**; no free-text answer)

Results show role badge and status dot. `Enter` opens; `⌘Enter` opens in editor.

### 5.5 Inbox item
```
[icon] Unreported change · src/payments/webhook.ts           2 min ago
       No agent explained this edit.                     [Review →] [Dismiss]
```
Types: Unreported change, Outdated on touched path, Collision, Failing test, New dependency, New port/env var, Changed since reviewed. Max 5 visible; "Show N more". Empty: "All clear" with a quiet check icon.

### 5.6 Agent status line
`● Claude editing src/payments/ · plan ▸ edit ▸ test` — current step highlighted, others muted. States: reading, planning, editing, testing, waiting for you, stuck. "Waiting for you" is the only state that uses an attention color (accent outline, not red).

### 5.7 Toasts and banners
Rare. Used for: scan complete, report rejected (with reason), agent connected. Auto-dismiss 5 s; never stack more than one.

---

## 6. Diagram grammar

All diagrams render from one component fed `{nodes, edges, clusters, focusId}`. Layout via ELK layered, direction **left to right**.

| Rule | Spec |
|---|---|
| Node budget | <= 7 visible nodes by default; more -> clusters ("12 UI pieces") expandable |
| Direction | Always left→right: Client → API → Services → Data / External |
| Crossings | Minimize via ELK; if crossings remain, group more |
| Shapes | Rounded rect (radius 10); cylinder for datastores only |
| Color | Nodes neutral `--surface`; selected = `--accent` border; status as a small dot; agent as small colored edge marker |
| Edges | 1 px, `--border`/muted, gently curved; arrowheads only where direction matters; label on hover except 1-2 key edges |
| Text | Two sizes only (title 14/600, label 12/400) |
| Spacing | Gap between nodes >= node height |
| Focus | Selecting a node dims unrelated to 30% opacity; neighbors stay full |
| Motion | 180 ms fades for expand/switch; no continuous animation |
| Inferred | Any LLM-inferred edge is dashed with "inferred" label |
| Export | Mermaid and SVG |

### 6.1 v1 diagrams
1. **Folder tree/treemap** (Explorer, Overview) with toggle.
2. **Container diagram** (Overview): e.g. `Browser → API → Services → Database`, Stripe as satellite off Services. Five boxes, one caption.
3. **Neighborhood view** (Links tab): selected item + direct imports/importers only.

### 6.2 Deferred (v2)
Request sequence diagram (lifelines: client, route, service, repository, DB), ER diagram (shown only if models/migrations detected), animated request trace (click-to-play).

### 6.3 Runtime strip (no diagram engine)
A row of chips on Overview: `web :3000 ● up` · `api :8080 ● up` · `postgres :5432 ● down`. Source tooltip: "from docker-compose.yml:12".

---

## 7. Screens

### 7.1 Launcher
- Recent projects list: name, path, branch, status summary dots ("2 agents active", "5 outdated").
- Projects with currently running agents surfaced first.
- Folder drop zone; "Open path" input. No sign-in, no marketing.
- Empty state: "Run `npx orient` inside a repo, or drop a folder here."

### 7.2 First-open / scan state
Progressive reveal; never a blank spinner:
1. Tree (instant), noise collapsed.
2. Stack, entry points, scripts, ports (derived).
3. Imports and status dots.
4. Descriptions fill in; Unknown cards display one banner:
   `Cards are empty. [Generate with your agent]  [Use a small model]  [Skip]`

Scan progress: a thin line in the status strip: "Scanning · 842 / 1,204 files". Consent line (once): "Reads tracked files. Skips .gitignore, .env, keys. Change in Settings."

**Bootstrap modal ("Generate with your agent"):** shows the prompt in a code block, [Copy], and live "Receiving cards… 6 / 14" as the agent writes; rejected cards listed with reasons.

### 7.3 Overview
Top to bottom:
1. **Repo card:** name, one-line purpose, stack logos with versions, entry points, "how to run" commands (copyable).
2. **Runtime strip:** ports/services.
3. **Folder map:** treemap/list toggle with role chips; noise one line.
4. **Container diagram.**
5. **Findings (top 5):** duplicate configs, unused folders, untested areas, risky files; each links to the card.
6. **Freshness summary:** "84% fresh · 9 outdated · 3 unreported".
7. **Start Here:** the suggested path with [Start].

### 7.4 Inbox
List of up to 5 ranked items (see 5.5). Selecting one opens Explorer at the path with the delta pre-opened. Header: "3 things need your eyes". Footer link: "See all activity".

### 7.5 Explorer
Tree + Card as in section 3. URL: `/explore/<path>?tab=`. Start Here pinned at top of tree, collapsible; Next → walks it.

### 7.6 Activity
- Agent list (top): name, color, one-sentence task, step.
- Unreported changes pinned.
- Timeline grouped by agent task: click to expand files changed; "Show on tree" highlights touched nodes.
- Collision banner when two agents touch the same folder.
- Live log: closed drawer, opened deliberately.

### 7.7 Health
- Segmented bar: Fresh / Drifted / Outdated / Affected / Unknown counts.
- Source breakdown: verified / agent-said / generated / human.
- Lists with filters: outdated cards (sorted by last edit), unknown cards.
- Per-agent report rate.
- Bulk action: [Refresh outdated via my agent] / [via small model].

### 7.8 Agents & Setup
- Connected agents: status, last report, report rate, [Install] / [Remove] per agent with diff preview.
- Export: `AGENTS.md`, `context.json`.
- Model: None / API key / Ollama.
- Privacy: what is read, skipped, sent; audit of any model requests.
- Settings: theme, density, Focus mode suggestions on/off, concept hints on/off.

---

## 8. Interaction details

### 8.1 Live updates
SSE events patch state. A updated card flashes `--accent-soft` for 600 ms, and a status dot changes in place. The tree never reflows during a user's active interaction (new nodes append to a "new" group until the user hovers away).

### 8.2 Mark reviewed
- Explicit `r`/button. Passive "seen" after 3 s open is recorded separately and displayed lighter.
- Reviewed state stores `(path, hash)`. Later change shows "Changed since you reviewed" with delta.
- No counts-as-score, no streaks.

### 8.3 Start Here and Next
Path of up to 6 items ordered by dependency direction (models → services → routes, entry first), labeled "Suggested". Next/Back move through it; progress "2 of 6". Collapsible for seniors.

### 8.4 Learn mode (v1.x, off by default)
- **Concept chips** appear inline in Role/Key files: "Repository pattern". Click opens a side popover: 2-sentence definition, then "In this project: `services/userRepo.ts`" with a 5-10 line snippet, and an optional "like <familiar thing>" anchor based on user's known languages.
- **Predict-then-reveal:** "Before opening: which layer does a request reach after the route?" Options are clickable (no typing). Reveal shows the actual call chain from the graph. Answer always verifiable.
- Concepts marked "Got it" never reappear. No scores.

### 8.5 Adaptivity
Local-only signals: slots expanded/skipped, card abandon rate, raw-code opens, Focus usage. Responses:
- Frequent code opens → default Code tab, compact density.
- Frequent abandon on long cards → suggest Focus mode (toast with [Try it] [Not now]).
- Never changes layout without user confirmation. Settings shows what was learned and a [Reset] button.

### 8.6 Errors and edge states
| Situation | UI |
|---|---|
| Daemon unreachable | Full-width banner: "Orient daemon stopped. Run `npx orient`." with auto-retry |
| Not a git repo | "No git history. Using snapshots. Features limited" + [Initialize git] |
| Unsupported language | Tree and hashes only; card shows "Limited analysis" |
| Huge repo | Priority scan note: "Scanning entry points first" |
| Report rejected | Toast + Activity entry with reason ("path src/foo not found") |
| Card unknown | Muted state with [Generate] actions, never a guess |
| Offline model | Falls back silently to no-LLM mode; banner only if user requested generation |
| Merge/branch change | Cards re-evaluated by content hash; brief "Branch switched, 12 cards re-matched" strip |

### 8.7 Empty states
- No agents connected: "Orient works without agents, but they make descriptions richer. [Connect an agent]".
- No findings: "No findings. Nothing looks off."
- Inbox empty: "All clear."

---

## 9. Content and voice
- Direct, technical, short. Use real terms: controller, migration, middleware, Dockerfile.
- Never explain obvious things to everyone; explanations live behind concept chips (Learn mode).
- Labels are verbs or nouns, not slogans. Sentence case.
- Uncertainty is stated: "inferred", "agent-said", "unknown", "described 14 commits ago".
- No emoji in UI text. No exclamation marks.

**Copy examples**
| Place | Text |
|---|---|
| Unknown card | "No description yet." |
| Outdated | "Outdated · described 14 commits ago" |
| Unreported | "Changed without a report" |
| Agent status | "Claude editing `src/payments/`" |
| Inbox empty | "All clear" |
| Rejected report | "Rejected: `src/foo` does not exist" |

---

## 10. Accessibility
- WCAG 2.2 AA contrast for text and UI components in both themes.
- Full keyboard operation; visible 2 px `--accent` focus ring; logical tab order; palette reachable by shortcut.
- Status and agent identity never color-only: always paired with text or aria-label.
- Tree implements ARIA tree pattern (`role=tree`, `aria-expanded`, `aria-level`).
- Diagrams provide a text/list alternative ("Show as list") and keyboard-navigable nodes.
- `prefers-reduced-motion` honored; no auto-play; no flashing.
- Text resizable to 200% without loss; Focus mode scales type.
- Low-focus support: Focus mode, short cards, no time-limited UI, no auto-dismissing critical info.

---

## 11. Frontend engineering guidelines
- **Stack:** Vite + React + TypeScript + Tailwind with tokens mapped to CSS variables; Radix/shadcn for primitives (tabs, popover, dialog, command).
- **Contracts:** types from `@orient/schema`; render directly from typed JSON, no per-language logic in UI.
- **State:** URL (selection, tab, view) + a small store (Zustand) for server cache and UI prefs; SSE patches into the store.
- **Components built custom:** Card, TreeRow, GraphCanvas, InboxItem, StatusBadge/SourceBadge/AgentBadge, CommandPalette results.
- **Perf:** virtualized tree; memoized rows; diagrams capped and clustered; code preview lazy-loaded (Shiki on demand).
- **Security:** token from launch URL fragment held in memory only; strict CSP; no inline eval; sanitize all card text before render (no `dangerouslySetInnerHTML`).
- **Fixtures:** Storybook or equivalent with three real-repo fixtures for every state (fresh/outdated/unknown, empty, error, large).
- **Testing:** visual regression for tokens and cards; Playwright flows for open → explore → review → task search → Focus mode.
- **Theming:** all colors via variables; tokens file is the only place hex values appear.

---

## 12. Design QA checklist
- [ ] A new user can say what the repo is from the first screen in under 10 s.
- [ ] Every card has the same slots in the same order.
- [ ] No view shows more than 7 diagram nodes by default.
- [ ] Every claim has an evidence tooltip.
- [ ] Outdated cards always show a delta and never hide old text.
- [ ] No color carries two meanings; no color-only signals.
- [ ] Nothing animates continuously.
- [ ] Inbox never shows more than 5 items by default.
- [ ] Focus mode shows exactly one card with Back/Next.
- [ ] Works fully by keyboard.
- [ ] Both themes meet AA contrast.
- [ ] Empty, loading, error, and partial states exist for every view.
- [ ] Tested on a 10k-file repo without jank.

---

## 13. Usability test plan
| Persona | Task | Pass |
|---|---|---|
| Meera | "An agent just ran. What needs attention?" | Correct in < 90 s via Inbox |
| Arjun | "Where is login handled and what does it touch?" | Correct in < 2 min |
| Kabir | "Get oriented in this repo." | States purpose of 4 of 5 top folders |
| Priya | "Is anything fragile or wrong?" | Finds >= 2 true findings, notices 0 false claims |

Measure time to first correct answer, hesitation points, card slots ignored, and feedback marked "wrong".

---

## 14. Open design questions
1. Is Focus mode enough for low-focus users, or does it need a guided default?
2. Does Start Here ordering (import centrality) match what humans expect? Test against hand-picked paths.
3. Where should "Copy context" live to feel natural without becoming a chat substitute?
4. Treemap vs list as default for Folder map (test with students vs seniors).
5. Product name, logo, and accent color adjustment to brand.
6. Should Learn mode be a toggle, or a separate lightweight route?
