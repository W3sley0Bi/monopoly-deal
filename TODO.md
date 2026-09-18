# TODO

Priority levels:

- **P0 — Critical:** reliability, data integrity, or scaling bottlenecks to address immediately.
- **P1 — High:** core gameplay bugs, rules integrity, and foundational table/network architecture.
- **P2 — Medium:** valuable UX enhancements, cross-platform responsiveness, and client rendering frameworks.
- **P3 — Low:** localization, content realignment, cosmetic communication, and account/social systems.
- **P4 — Long-Term Roadmap:** sound design, progression arenas, and cosmetic shop economy (post-launch).

---

## P0 — Critical: Reliability & Room Isolation

- [x] **P0:** Broadcast room snapshots only to clients in the affected room.
- [x] **P0:** Update home/lobby clients only when visible room-summary data changes.
- [x] **P0:** Replace application-level `hello` heartbeats with WebSocket ping/pong so health checks do not rebuild game snapshots.

---

## P1 — High: Core Gameplay Bugs, Rules Integrity & Board Architecture

### Backend & Network Stability
- [ ] **P1:** Give every WebSocket connection its own bounded outgoing queue and writer goroutine so one slow client cannot delay everyone else.
- [ ] **P1:** Add WebSocket write deadlines, payload limits, and clean handling for stalled or disconnected clients.
- [ ] **P1:** Replace the global game-state lock with per-room locking or a sequential room worker, allowing unrelated rooms to process actions independently.
- [ ] **P1:** Limit the mobile client's offline send queue and avoid automatically replaying stale, time-sensitive game actions after reconnecting.
- [ ] **P1:** Add backend integration tests for room-isolated broadcasts, ping/pong, slow clients, reconnects, and concurrent rooms.
- [ ] **P1:** Verify mobile-client compatibility with the table and release version.

### Core Gameplay Bugs & Mechanics
- [ ] **P1:** **Fix card drag unresponsiveness at match initialization**
  - Investigate root cause in `Table.tsx` / `dragLayer.tsx` (and mobile touch responders) where cards on the left side of the hand become non-draggable at match start (reproducible on offline boards).
  - Resolve race conditions between asset loading, layout bounding-box measurement, and gesture responder mounting.
  - Implement a match initialization loading state / spinner per player until game state, card assets, and gesture listeners are fully hydrated and ready for input.
- [ ] **P1:** **Fix Just Say No bluffing mechanics and information leakage**
  - Fix defense window triggering: Display the response dialog and standard countdown timer for any targeted player when a hostile action is played (e.g. Deal Breaker, Sly Deal, Forced Deal, Rent), regardless of whether they hold a Just Say No card.
  - Prevent hand state exposure: If the target does not possess a Just Say No, keep the timer running to maintain bluffing secrecy, but disable the action button.
  - Standardize button placement: Render the "Just Say No" button on the left (enabled if held, disabled if not) and the "Accept / Concede" button on the right.
- [ ] **P1:** **Fix wild card drag rotation glitch**
  - Fix visual regression where a flipped/assigned two-color property wild card snaps back to its default rotation during a drag gesture.
  - Preserve the active assigned color/orientation state in the drag layer throughout the entire drag lifecycle so preview matches final dropped placement.

### Table & Board Geometry Architecture
- [x] **P1:** **Standardize player property mat with fixed 5-seat spatial layout and dynamic color slots**
  - Establish a fixed 5-seat spatial table topology regardless of player count (2 to 5 players) to eliminate variable layout recalculation errors.
  - Render reference alignment lines on the table mat for each player seat demarcating property set slots (up to X distinct property colors) and a dedicated bank slot.
  - Implement dynamic first-come slot allocation: Slots do not have pre-assigned colors. The first property color placed claims Slot 1, the next claims Slot 2, etc.
  - Enforce persistent slot anchoring (no auto-shifting): If a property set is stolen, paid away, or emptied, its assigned slot remains vacant without shifting adjacent sets until re-occupied by a newly played or acquired property.

---

## P2 — Medium: Layout, Cross-Platform Responsiveness & UX Polish

### Cross-Platform Adaptation (iPad & PC Desktop)
- [ ] **P2:** **Implement iPad / tablet responsive layout**
  - Compact the player action panel to maximize table estate while maintaining identical rule execution logic.
  - Scale up card dimensions with enhanced visual detail.
  - Ensure seamless orientation support for both Portrait and Landscape.
  - Relocate opponent property stacks to sit beside each player's table seat rather than stacking over top.
- [ ] **P2:** **Implement PC / desktop mouse interaction parity**
  - Implement desktop hover preview: Hovering over a card in hand elevates/lifts the card, mirroring the tap-to-preview behavior on mobile and tablet touch viewports.
  - Maintain keyboard accessibility (arrow keys, Enter, Escape) and full-fidelity desktop table controls.

### In-Game UX & Visual State
- [x] **P2:** **Redesign live 3-turn action indicator**
  - Evaluate and prototype improved proposals for the 3-action turn counter:
    - *Proposal A:* Energy/pip meters (3 glowing action tokens that deplete dynamically).
    - *Proposal B:* Embedded tactile mat counters with audio-visual state transitions.
    - *Proposal C:* Central floating action badge tracking remaining actions (3 / 2 / 1 / 0) with explicit end-of-turn warning.
- [ ] **P2:** **Architect decoupled client-side card skinning framework**
  - Decouple card data structures from visual presentation layers to allow interchangeable card designs without modifying game mechanics or server wire contracts.
  - Implement client-POV scoping: Each player renders and experiences their own selected card designs and visual effects locally without altering opponent perspectives.

### Navigation & Home Experience
- [ ] **P2:** **Overhaul main menu and play hub (Clash Royale inspiration)**
  - Redesign main menu to be interactive and animated, featuring a prominent "Play" button and live table scene.
  - Implement Play Hub navigation routing to 4 distinct match modes:
    - Ranked Play (competitive matchmaking).
    - Public Match (casual open table matchmaking).
    - Private Match (custom room via online code or Local LAN broadcast).
    - Bot Practice Match (solo play against configurable AI bots).

### State Synchronization Protocols
- [ ] **P2:** Add a monotonically increasing room/game version to snapshots and commands so stale actions can be identified explicitly.
- [ ] **P2:** Add unique command IDs so retries cannot apply the same action twice.

---

## P3 — Low: Social Systems, Localization & Content Refinement

### Localization
- [ ] **P3:** **Add French (`fr`) language support**
  - Create French localization catalogs across `frontend/src/i18n/fr/` and `mobile-client`.
  - Maintain complete catalog parity with existing English, German, and Italian translations (verified via `npm run check:i18n`).

### In-Game Communication & Emotes
- [ ] **P3:** **Replace text chat with Clash Royale-style animated emotes and stickers**
  - Deprecate and remove text chat drawer.
  - Implement an animated emote and sticker reaction drawer.
  - Render animated reaction bubbles anchored directly to player seats with anti-spam cooldown throttling.
  - Modularize asset pipeline to support collectible/purchasable sticker packs.

### Identity & Social Infrastructure
- [ ] **P3:** **Implement dual-tier account architecture (Guest vs. Registered)**
  - **Guest Tier:**
    - Auto-assigned fixed identifier (e.g. `Guest #1042`).
    - Capabilities: Join public casual tables; join private tables via direct invite.
    - Limitations: No ELO calculation; restricted from ranked play; no spectating mode; social tab prompts login to add friends.
  - **Registered Tier:**
    - Persistent user credentials and authentication profile.
    - ELO rating calculated and updated via ranked matches.
    - Social Hub: Friend list with live status and ELO ratings; quick invite dispatch.
    - Profile / Career Stats: Publicly inspectable career record (win/loss ratio, completed sets, peak ELO).

### Content & Thematic Realignment
- [ ] **P3:** **Rename action cards for legal and thematic distinction**
  - Review and rename all action and property cards to distinct, thematic phrasing while maintaining 100% mechanical fidelity to Monopoly Deal rules.
  - Execute sequentially: Finalize English naming matrix first, then propagate across all localization catalogs (`de`, `it`, `fr`).

---

## P4 — Long-Term Roadmap: Progression, Shop Economy & Audio Polish

### Sound Design & Audio System
- [ ] **P4:** **Implement sound system and audio design**
  - Add master volume and SFX sliders in client settings with persistent local storage.
  - Source and integrate royalty-free / open-license audio assets:
    - Dynamic card swoosh on draw and fanning.
    - Card placement / table drop thuds.
    - Hostile action warning cues.
    - Victory and defeat sound bites.

### Progression & Ranked Arenas
- [ ] **P4:** **Implement ranked trophy progression and themed arenas**
  - Introduce Clash Royale-style tiered arenas tied to player ELO/trophies, each featuring distinct visual table themes.
  - Unlockable rewards: Milestone progression (e.g. Level 500) unlocks custom table designs, 3D building models, and card skins usable in private matches with friends.
  - Rollout strategy: Advertise ranked mode in v1.0 interface; activate live competitive matchmaking queue once player base reaches sustainable density.

### Cosmetic Shop & Monetization
- [ ] **P4:** **Implement in-game cosmetic shop**
  - Build storefront UI for previewing, purchasing, and equipping cosmetics:
    - Custom table designs, felt colors, and environments.
    - Custom card back and face theme collections.
    - Animated emote and sticker packs.
  - Ensure cosmetic inventory is fully decoupled from rules engine and client authority.

---

## Done

No completed items recorded yet.
