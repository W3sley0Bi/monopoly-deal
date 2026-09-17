# TODO

Priority levels:

- **P0 — Critical:** reliability or scaling problem to address next.
- **P1 — High:** important work that should follow the critical items.
- **P2 — Medium:** valuable improvement, but not currently blocking.
- **P3 — Low:** future polish or optional work.

## Backend networking and room isolation

This phase keeps WebSockets and the in-memory game state. Database and Redis
persistence are intentionally out of scope.

- [ ] **P0:** Broadcast room snapshots only to clients in the affected room.
- [ ] **P0:** Update home/lobby clients only when visible room-summary data changes.
- [ ] **P0:** Replace application-level `hello` heartbeats with WebSocket ping/pong so health checks do not rebuild game snapshots.
- [ ] **P1:** Give every WebSocket connection its own bounded outgoing queue and writer goroutine so one slow client cannot delay everyone else.
- [ ] **P1:** Add WebSocket write deadlines, payload limits, and clean handling for stalled or disconnected clients.
- [ ] **P1:** Replace the global game-state lock with per-room locking or a sequential room worker, allowing unrelated rooms to process actions independently.
- [ ] **P1:** Limit the mobile client's offline send queue and avoid automatically replaying stale, time-sensitive game actions after reconnecting.
- [ ] **P2:** Add a monotonically increasing room/game version to snapshots and commands so stale actions can be identified explicitly.
- [ ] **P2:** Add unique command IDs so retries cannot apply the same action twice.
- [ ] **P1:** Add backend integration tests for room-isolated broadcasts, ping/pong, slow clients, reconnects, and concurrent rooms.

## Mobile client

- [ ] **P1:** Verify mobile-client compatibility with the table and release version.

## Home experience

- [ ] **P2:** Make the main menu feel alive, inspired by Clash Royale.
  - [ ] **P2:** Add a prominent Play button.
  - [ ] **P2:** Define and implement the page or flow opened by the Play button.

## Done

No completed items recorded yet.
