# Error-handling hardening handoff

Last updated 2026-09-18 (third pass). Nothing is committed.

## State: compiles, tests green

Verified at the end of the third pass:

- `cd mobile-client && npx tsc --noEmit` — clean.
- `cd mobile-client && npm test` — 10 suites, 70 tests pass.
- `cd backend && gofmt -l . && go vet ./...` — clean.
- `cd backend && go test -count=1 ./...` and `go test -race -count=1 ./...` — pass.
- `cd frontend && npx tsc --noEmit` — clean; `npm run check:i18n` — 713 keys x 3 languages OK.
- Mobile catalogues en/de/it/fr: 770 keys each, identical sets (one-off node
  check, kept outside the repo).

## Done

### First pass (previous agent)
- Mobile socket: explicit `reconnect`, bounded backoff, 12 s connect watchdog,
  safe constructor/send failure handling, foreground reconnect, queue kept.
- `ConnectionStatus` banner with retry; pull-to-refresh reconnects.
- Join/create pending spinners + timeout in `app/online.tsx`.
- Root error boundary, splash/font/deep-link promise handling.
- `Btn` shows an `ActivityIndicator` while `pending`.
- Backend: malformed-JSON frames answered with `err.bad_message` instead of
  dropping the socket; rune-safe name/chat truncation; duplicate Double The
  Rent IDs rejected; invalid `CurrentTurn` guarded; idempotent `Hub.Close` /
  `Room.Close`; HTTP header/idle timeouts; room actor panic recovery
  (`runSafely`) and `stateMu` so the hub reads summaries without racing the
  actor; handler gets `playerID/name` captured under `h.mu` instead of reading
  `*Client` from the room goroutine; `create_room` validates bot count and only
  leaves the old room once the new one is valid (and closes the room goroutine
  on failure).

### Second pass (this one)
- Repaired the half-applied edits (duplicate JSX props, duplicate context
  destructure, stray `}) =>` syntax error, hooks after early return) in
  `app/lobby.tsx`, `app/table.tsx`, `src/components/table/PendingPanel.tsx`.
- Lobby: all host/seat controls disabled while disconnected (online only),
  per-request pending spinners (take seat, add/remove bot, start, options),
  clipboard/share failures caught and alerted.
- Online table: `canPlay`, End Turn, respond panel and Play Again disabled
  while disconnected; pending spinner on end_turn / respond / new_game.
  Play Again now goes through `act`.
- Pending state clears on a new room frame, a notice/error, a socket status
  change, or a 12 s backstop timer (lobby + table).
- `isOffline: true` also set for dev-fixture rooms so a dead socket does not
  lock fixture controls.
- `isValidServerMessage` (lib/net/messages.ts) rewritten without `any`; checks
  only what renderers dereference (`room.payload.id`, `room.payload.game.players`,
  `home.payload` object). Deliberately lenient on home/error/notice because Go
  uses `omitempty` and nil slices marshal to `null`.
- i18n: added `common.error` (mobile en/de/it/fr) and the new backend fault
  keys `err.bad_message`, `err.bad_bot_count`, `err.invalid_game_state`,
  `err.duplicate_double_rent` (mobile en/de/it/fr + frontend en/de/it).
- Tests: `__tests__/server-message-validation-unit-test.ts` (4 tests),
  `__tests__/json-socket-integration-test.tsx` (5 tests: offline queue + stale
  drop, backoff retry, watchdog, manual reconnect, non-JSON frames).
- Backend reviewed: no deadlock found — room actions never take `h.mu`,
  `Client.send` is non-blocking, `hub.wake` is non-blocking. No code changes.

### Third pass
- Lobby invite sheet: clipboard/share failures now show `invite.copy_failed` /
  `invite.share_failed` (mobile en/de/it/fr) instead of `String(err)`; a Share
  rejection that reads as cancel/dismiss is ignored.
- `lib/net/messages.ts` — three real bugs found by the new tests and fixed:
  1. the persisted room code only seeded `rejoin` after `getInitialURL()`
     resolved, so a socket that opened first sent hello without the rejoin;
  2. a launch invite resolving after the open transition was never joined;
  3. a runtime `url` event while connected only stored the code (join waited
     for a reconnect). Now `rejoin` is seeded synchronously from the persisted
     id, and any link (initial or runtime) that differs from the held code
     sends `join_room` immediately if hello already went out on this open.
     `getInitialURL()` rejection is caught.
- Tests: `__tests__/rejoin-integration-test.tsx` (10 tests: link vs persisted
  precedence, late initial link, legacy `?join=`, runtime link online/offline,
  once-per-open hello+rejoin, eviction clears, `err.no_such_table` clears,
  home frame while homeless keeps the rejoin).
- Hub: room actions decided under `h.mu` are queued (`h.doLocked`) and
  submitted with `runOps` after the unlock (disconnect detach, leave, create,
  join); `close_room` releases the lock before `r.Do`. Only the submitting
  connection's reader waits on a full room queue now. Client fields the ops
  need are captured under the lock. Test:
  `TestFullRoomQueueDoesNotHoldTheHub` (fails on the old code, passes now,
  race-clean).
- Scratch files `backend_changes.diff` (byte-identical to the working-tree
  backend diff) and `patch_messages.js` (all edits present/superseded)
  deleted.
- Table notices (`styles.noticesOverlay`, `app/table.tsx`): was in flow, so a
  reconnect blip or error notice pushed the rail/felt/board/hand down (moving
  drop targets). Now absolutely positioned at `insets.top + 4`, left/right
  honour `insets.left/right` (landscape notch), centred with `maxWidth: 420`
  (clears the roomy top-left leave button), opaque backing for legibility,
  error text `pointerEvents="none"`.
- Mobile i18n parity: added missing `home.no_network` to fr; removed seven dead
  `chat.*` keys from de/it `log.ts` that en never had (no server emitter or
  mobile consumer).

## Remaining

- On-device check of the floated table banner at phone portrait and
  landscape (and a notched landscape phone): it now covers the top of the
  opponent rail while offline / for a notice's 3.6 s. Code-reviewed only.
- A room actor stuck inside an action (not merely a full queue) still stalls
  the hub for public tables: `broadcastHomeLocked` reads `r.summary`, which
  takes the room's `stateMu` under `h.mu`. Only reachable via a game bug that
  never returns; not changed.
- Pre-existing user edits not part of this work: `mobile-client/app/index.tsx`
  and `mobile-client/src/i18n/*/home.ts` (fr `home.ts` got one added key).
