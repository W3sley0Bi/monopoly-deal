# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Local-network Monopoly Deal: an authoritative Go WebSocket server, a React + Vite
client. `README.md` documents the game and its features from a player's side;
this file covers what you need to change the code.

## Commands

```bash
# Run (two terminals)
cd backend  && go run .     # API + WebSocket + static client on :8080
cd frontend && npm run dev  # Vite on :5173, talks to :8080

# Production-ish: the Go server serves frontend/dist
cd frontend && npm run build && cd ../backend && go run .

make run        # build client + server binary, then run
make test       # go test ./... + tsc -b + i18n check
```

`PORT` overrides the server port; `STATIC_DIR` overrides where the built client
is served from.

### Checks

```bash
cd backend  && go test ./...            # rules engine + websocket/room integration
cd backend  && go test ./game -run TestDealBreakerTakesWholeSet   # one test
cd frontend && npx tsc --noEmit         # type check
cd frontend && npm run lint             # oxlint
cd frontend && npm run check:i18n       # catalogue parity (see i18n below)
```

Backend tests are the real safety net — the rules engine is fully covered and
fast. `npx tsc --noEmit` is the frontend equivalent; there is no frontend test
runner. Lint exits 0 with a standing baseline of warnings (mostly
`set-state-in-effect` and `only-export-components` in `Table.tsx`); judge a
change by whether it adds new ones, not by a clean run.

## Architecture

### The server owns the game

`backend/game` is a pure rules engine with no knowledge of sockets.
`backend/server` wraps it in rooms and connections. The client never decides a
rule — it sends an intent (`play_property`, `respond`, …) and re-renders from the
state that comes back.

- `game/card.go` — deck, colours, set sizes, rent tables.
- `game/game.go` — players, sets, turn flow, modes, deadlines, win check.
- `game/actions.go` — action cards, rent, debts, steals, Just Say No.
- `game/bot.go` — robot seats, by difficulty.
- `game/tutorial.go` — the scripted table (see below).
- `server/hub.go` — connections, rooms, routing, the timer loop.
- `server/messages.go` — the wire format **and** per-player views.

**`Game.PostAction()` is the hook every mutator must end with.** It evaluates
the win, advances the tutorial, and re-arms deadlines. Rules code that changes
state without going through it will silently skip those.

**Per-player views are a privacy boundary.** `gameView(g, you)` in
`server/messages.go` sends your hand as cards and everyone else's as
`hand_count`. Anything added to `PlayerView` is visible to every client — keep
private state out of it.

### Nothing the server sends is a sentence

Log lines, chat notices and errors travel as a translation key plus values, and
each client renders them in its own language. `game/fault.go` builds both
(`fault("err.wrong_colour", "english fallback", "card", key, "color", c)`).
Card names travel as `key` beside the English `name`.

So: **never send user-facing English from Go.** Add a key, add it to the three
catalogues, render it on the client.

### i18n

`frontend/src/i18n/{en,de,it}/<area>.ts`, one flat `Catalog` per area. English is
the source of truth: `npm run check:i18n` fails when another language is missing
a key or carries one English does not, because a missing string silently falls
back to English and is invisible in review. Adding a key means adding it to all
three files.

### Client

`App.tsx` owns the socket, identity and routing between home / lobby / table.
`components/Table.tsx` is the table and is large — the mat, drag and drop,
dialogs, the hand, and the mobile layout all compose there.

Things that are not obvious from one file:

- **Optimistic moves** (`game/optimistic.ts`) — only the deterministic slice of a
  turn is predicted locally (place a property, move a wildcard, bank a card).
  Anything depending on the deck, another hand or another player's answer is
  deliberately excluded; do not extend it to those.
- **Dragging** (`game/dragLayer.tsx`) — one pointer pipeline for mouse, pen and
  finger, because HTML5 drag events never fire on touch. The dragged card is a
  clone appended to `document.body`; drop targets are found by hit-testing
  `document.elementFromPoint` against `[data-drop-id]` **every frame**. Two
  consequences worth remembering: anything painted over a zone steals its drops,
  and a target that *moves* while a finger is on it is worse than one that is
  merely small. Targets may grow under a thumb; they may not move.
- **`DropZone`** registers itself with the drag layer rather than listening for
  drag events, and rebuilds its whole `className` from props. Classes added to it
  imperatively from outside React will be wiped on its next render.
- **Stacking contexts** — `.game-room` sets `isolation: isolate`, so every
  z-index inside it is sealed within one layer. Overlays that must sit above
  body-level layers (drag ghost `z-200`, `TableMotion` flight cards `z-60`) have
  to be portalled to `document.body`, not merely given a bigger z-index.

### The tutorial

Split deliberately: **the server owns the curriculum** (`game/tutorial.go` — which
lesson, what is on the table for it, whether the task is done, checked through
the same rules as a real game) and **the client owns the words and the pointing**
(`components/Tutorial.tsx` — copy, which region to spotlight, which gesture to
mime, and how that differs on a phone).

- Each lesson rebuilds the whole table in `setup`, so a lesson can teach Deal
  Breaker without waiting for the deck to deal one.
- `TestEveryLessonCanBeCompleted` requires a matching move in `tutorial_test.go`'s
  `play()` switch for every lesson id, and fails if a lesson cannot be finished
  through the real rules. **Adding a lesson means adding that case.**
- `HINTS` in `Tutorial.tsx` is keyed by lesson id; a lesson with no entry degrades
  to a centred card rather than breaking.
- Live elements are marked with the `data-tour-live` **attribute**, not a class,
  precisely because React rewrites `className` (see `DropZone` above).
- The coach stands down entirely — rather than shrinking — while a card is in the
  air, a colour tray is open, or (on a phone) a dialog owns the screen.

## Conventions

- **Comments explain why, not what.** The existing code documents the reason a
  thing is the way it is — usually a bug it fixes or a trade-off it settles.
  Match that; do not narrate the code.
- Mobile is `max-width: 899px`, and portrait and landscape are genuinely
  different layouts, not one layout scaled. Verify phone changes at a phone
  viewport; desktop behaviour is frequently deliberately different (precise
  per-colour drop zones on desktop vs. one smart panel on a phone).
- `DESIGN.md` and `PRODUCT.md` hold the visual direction and product intent;
  `docs/UI-UX-REVIEW.md` has findings and follow-ups.

## Other agent configs

An OpenAI Codex config (`~/.codex/config.toml`) and a Gemini CLI config
(`~/.gemini/settings.json`) exist on this machine. To bring their user-level
items (MCP servers, slash commands, subagents, skills, instructions) into Claude
Code, reply `/import` to scan and list what is importable, then
`/import --yes=<digest>` with the digest that scan prints. If `/import` is not
available on this surface, run `claude import` from a terminal.
