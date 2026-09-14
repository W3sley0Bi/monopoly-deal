# Monopoly Deal

Local-network Monopoly Deal. A Go WebSocket server holds the authoritative game
state for any number of tables; a React + Vite client renders the board.

## Run it

```bash
cd frontend && npm install && npm run build   # build the client once
cd ../backend && go run .                     # serves the game on :8080
```

Open <http://localhost:8080> on every device on the network (use the host
machine's LAN IP from other devices).

### Development

```bash
cd backend  && go run .    # API + WebSocket on :8080
cd frontend && npm run dev # Vite dev server on :5173, talks to :8080
```

`PORT` overrides the server port, `STATIC_DIR` overrides where the built client
is served from.

### Tests

```bash
cd backend && go test ./...   # game rules + websocket/room integration
cd frontend && npx tsc -b      # type check
```

## Playing on your own

The home screen has a **Play solo** panel: pick how many robots you want (1–4),
press **Practice vs robots**, and the table opens, seats them and deals in one
go. There is no timer, so nothing is waiting on you.

The robots are played by the server, through the same rules engine as everyone
else — they lay properties towards the closest set, build houses and hotels,
charge the biggest rent they can, steal the property that finishes a set, and
spend a Just Say No on anything that would cost them real property. They pause
about a second between moves so you can follow what they did.

Robots can join any table, not just a practice one: the host has **+ Add
robot** / **− Remove robot** in the table lobby and a robot count on the
new-table form, so a three-player game can be rounded out to five. A practice
table closes as soon as the last person leaves — robots do not keep it alive.

### Difficulty

The host picks how hard the robots play, in the lobby or when opening the
table. It is a lobby setting: a game cannot get easier halfway through.

| Level | How it plays |
|---|---|
| **Easy** | Lays its own properties and banks the rest. No rent, no stealing, never blocks with Just Say No, and often leaves a play unused. |
| **Normal** | Builds sets, charges rent, steals what completes a set, and saves Just Say No for a Deal Breaker or a debt it cannot pay in cash. |
| **Hard** | Attacks before it builds: Deal Breaker and rent first, Double The Rent when the charge is worth it, and Just Say No on anything that costs it something. |

## The tutorial

The first time you play a table with robots, a guided tour opens over the real
board. It spotlights one part of the table at a time — your hand, the property
mat, the bank, the plays counter, the log — and most steps finish when you
actually do the thing rather than when you press Next: play a property, bank a
card, end your turn. When a dialog or a payment panel is open the tour shrinks
to a single hint line at the bottom so it never covers what it just asked you
to use.

It runs once per device. **⚙ → Show me how to play** starts it again at any
table, and **Show the tutorial** on the home screen controls whether a new
practice table opens with it.

## Tables

The home screen lists every open table with its mode, timer, state and players.
From there you can:

- **Open a table** — pick a name, a game mode and a turn timer. You become the
  host; the table gets a 4-character code to share.
- **Take a seat** — join a table that has not dealt yet.
- **Watch** — join a game in progress as a spectator. Spectators never receive
  anyone's hand.
- **Ask for a seat next game** — queue up while watching. When the game ends,
  everyone in the queue is seated automatically, in order.
- **Join by code** — type a table's code instead of picking it from the list.
- **Close a table** — ✕ Close ends a table and sends everyone back to the home
  screen. You can close your own table any time; anyone can close a table that
  nobody is connected to, which clears one left behind by a closed laptop
  without waiting out the empty-table timer. The button asks once before it
  fires, and rows with nobody connected say so.

Everyone gets a generated avatar, produced on the device with DiceBear, so it
works with no internet connection.

## Chat and video

Every table has a **group chat** — a tab beside the table log during a game, and
a panel in the table lobby. Spectators can chat too. Unread messages show a
badge on the collapsed rail.

**Voice and video** is peer-to-peer WebRTC. Press **Join call** to share your
camera and microphone; each player's video appears in the corner of their panel,
with your own preview and mic/camera toggles in the top bar. The server only
relays the connection setup — the media itself goes directly between browsers.
On a LAN no STUN or TURN servers are used at all, so the call works with no
internet; away from the LAN the client adds public STUN servers so peers can
find each other.

### Video needs HTTPS

Browsers only allow camera and microphone access on a *secure* origin. That
means `http://localhost` works, but `http://192.168.x.x` does not — on a plain
LAN address the call button shows "Call unavailable" and explains why. To use
video from phones and other machines, serve over HTTPS:

```bash
make run-tls      # generates a self-signed cert, then serves https on :8080
```

The certificate covers `localhost` and this machine's LAN addresses. Browsers
will warn once about the self-signed certificate — accept it and the camera
works. Under the hood: `make certs` writes `cert.pem`/`key.pem`, and the server
uses HTTPS whenever `CERT_FILE` and `KEY_FILE` are set.

The game itself works fine over plain HTTP; only the call needs the secure
origin.

### Playing with people off the LAN

An ngrok tunnel puts the game on the public internet, TLS included, so no local
certificate is needed:

```bash
make serve-public   # builds, then serves on :8080
make tunnel         # in a second terminal
```

Then share <https://polite-vulture-immune.ngrok-free.app>. `make tunnel` runs
`ngrok http 8080 --url $NGROK_URL`; override the address with
`make tunnel NGROK_URL=https://your-domain.ngrok-free.app`, and the port with
`PORT=...` on both targets. Port 80 would need `sudo`, so 8080 is the default —
the public URL is the same either way.

The client derives its WebSocket address from the page it was served from, so
the tunnelled origin gives `wss://.../ws` with no configuration. On ngrok's free
plan each visitor sees a one-time browser warning page — clicking **Visit Site**
gets them through.

Because the tunnel is HTTPS, camera and microphone work for everyone, not just
localhost. Over the internet the call uses public STUN servers to find a route
between browsers; there is still no TURN relay, so a player behind a strict
(symmetric) NAT may fail to connect for video while chat and the game itself
keep working.

### Host controls

The host is whoever opened the table; if they leave, it passes to the next
seated player. Only the host can change the mode or timer, deal the cards, and
remove someone from the table (before the cards are dealt).

Any seated player can **end the game**, which returns everyone to the table
lobby with their seats intact. **Leave table** puts you back on the home screen.

Refreshing the page keeps your seat, even mid-game. A table closes about 90
seconds after the last person leaves.

## Game modes

| Mode | Win condition |
|---|---|
| **Classic** | Three complete colour sets. |
| **Death Match** | Three complete colour sets *and* an empty hand. |
| **Golden Rush** | Not implemented yet — shown locked in the picker. |

## Timers

**Turn timer** — off by default; the host can pick 30s, 1 min or 2 min. When it
expires the hand is trimmed to 7 cards and the turn ends.

**Payment countdown** — whenever you owe money, you always get **10 seconds** to
choose which cards to hand over, even at a table with no turn timer, because a
debt blocks everyone else. The countdown ring appears in the payment dialog. If
you do not choose in time the server pays for you, spending the cheapest cash
first and only touching property when the bank cannot cover the debt. Each
responder gets their own full 10 seconds, so a Just Say No does not eat into the
next player's time.

Everything else resolves without waiting: a steal or swap that the target has no
Just Say No for is applied immediately, and a debtor with nothing to give is
settled at once.

All deadlines come from the server, so every client agrees on them, and the
countdown corrects for clock skew.

## The shared table

The desktop client places players around a dimensional teal table, with a
central draw deck, discard pile and action space. Your properties and bank sit
between the shared table and a fanned hand. Hover, focus or select a card to
lift it and read it. Arrow keys move through the hand; Enter opens the card's
actions, and Escape closes the tray. Drag and drop remains available.

Draws, plays and public asset transfers animate from authoritative server
updates. Opponent draws stay face-down. Click a player's avatar or property
progress to inspect their complete public board. Log and chat open in a drawer;
the latest game event stays visible at the center of the table.

The smile button sends one of four reactions through the table chat. Reactions
appear briefly by the player and remain in chat history. **Settings → Card
animation** turns motion off on this device. The client also respects the
system's reduced-motion preference. All artwork is local CSS/SVG, with no new
runtime dependencies or external asset requests.

## On a phone

Below 900px the table adapts to touch:

- Opponents become a horizontal strip with bank, hand and set progress. Tap a
  player to inspect their full board.
- The hand scrolls horizontally and opens the same card actions on tap.
- Portrait keeps the property board above the hand and collapses the bank.
- Landscape phones use a board on the left and hand on the right, with turn
  status and End turn along the bottom. Rotate the device normally; there is no
  forced orientation lock.
- Log, chat and public board details open in sheets. Dialogs support keyboard
  focus trapping and Escape, including when using a hardware keyboard.

## Getting back

**‹ Tables** in the top left leaves the table and returns to the table browser,
from a game or from the spectator view. The watching banner repeats it as
**‹ Back to tables**, and the ⚙ menu has **Leave table**.

## Playing a card

Drag a card from your hand onto the mat: coloured slots appear for every set the
card can join (including new sets), the bank lights up for money and action
cards, and the discard pile lights up when you are over the hand limit. Action
and rent cards go onto the action space. Wildcards already in play can be
dragged between their colours for free on your turn.

Tapping a card instead opens a tray with the same options — that is the path to
use on a phone, since HTML5 drag events do not fire for touch.

## Languages

The game speaks **English, Italian and German**, and each player picks their
own — a German and an Italian can sit at the same table and both read the same
game. The flags are in the home screen header and in the ⚙ menu at the table.

Nothing the server sends is a finished sentence: the table log, chat notices
and error messages travel as a key plus its values (`log.paid` with `from`,
`to`, `amount`, `cards`), and each client renders them in its own language.
Card names travel the same way, as a `key` beside the English name.

## Rules implemented

- 106-card deck: 28 properties, 11 property wildcards, 20 money, 13 rent, 34 action cards.
- Turn: draw 2 (or 5 with an empty hand), up to 3 plays, discard down to 7, end turn.
- Colour sets use real set sizes and rent tables; House (+$3M) and Hotel (+$4M)
  only count on a completed, buildable set.
- Rent charges every opponent; the multicolour rent card charges one. Double The
  Rent doubles the amount and costs an extra play.
- Debt Collector ($5M), It's My Birthday ($2M from everyone), Pass Go (draw 2).
- Sly Deal, Forced Deal and Deal Breaker; nothing can be taken out of a
  completed set except by Deal Breaker, which takes the whole set.
- Wildcards already on the table can be moved to another of their colours, at
  the cost of one play. The any-colour joker may only move onto a colour the
  player already has property in — it cannot open a set on its own.
- Payment: the debtor picks cards from their bank and property sets. No change is
  given, and a player short on assets hands over everything.
- Just Say No cancels an action against you, and can be countered by another
  Just Say No.

## Layout

```
backend/
  main.go              HTTP server, static hosting, SPA fallback
  server/hub.go        connections, rooms, routing, timer loop
  server/room.go       one table: owner, spectators, seat queue
  server/messages.go   wire format and per-player views
  cmd/gencert/         self-signed certificate for HTTPS play
  game/card.go         cards, colours, set sizes, rent tables, deck
  game/game.go         players, sets, turn flow, modes, timer, win check
  game/bot.go          robot seats: move priorities, responses, difficulty
  game/fault.go        translatable errors and log entries (key + values)
  game/actions.go      action cards, rent, debts, Just Say No, steals
frontend/src/
  App.tsx              socket, identity, home/lobby/table routing
  game/                socket hook, card metadata, avatar generation
  i18n/                translator, and one catalog per language and area
  components/Home      table browser and table creation
  components/RoomLobby seats, host controls, mode and timer pickers
  components/Table     the mat, drag and drop, dialogs, log and chat
  components/Tutorial  the guided tour: spotlight, steps, task detection
  components/SidePanel log and group chat, with unread badge
  game/useWebRTC.ts    peer-to-peer mesh for voice and video
```

Each client only ever receives its own hand: other players' hands are sent as a
count and the deck as a count, so the browser cannot see what it should not.
