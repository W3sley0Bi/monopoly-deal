# Monopoly Deal: game-night design system

## Scene and direction
Friends gather around one shared miniature property table in a dim game-night
room. A saturated teal surface brings the cards into the light; ivory paper,
red card backs and a lime active-turn accent give the game its identity.
Desktop takes priority. The user references Ubisoft UNO for shared space,
card choreography and expressive interaction rather than copied assets.

## Palette and type
- Room: OKLCH 19% .035 211; secondary surfaces: 24% .035 211.
- Table: teal spotlight from OKLCH 58% .1 185 to 44% .08 190.
- Card paper: OKLCH 96% .025 95; ink: 22% .025 220.
- Primary interaction and active turn: OKLCH 89% .17 113.
- Card backs and brand plate: saturated warm red; property colors retain the
  game's established color mapping and written names.
- Local font stacks: Avenir Next / Trebuchet MS / system for UI;
  Arial Rounded / Trebuchet / system for display. No remote font dependency.

## Space
The table is the dominant desktop surface, with surrounding player seats,
a shared deck and action area, a personal property/bank strip, and a raised
fanned hand. Chat is a closed-by-default drawer, not a permanent sidebar.
Full public boards are inspectable from every opponent seat. Spectators have
five surrounding seats and never render a hand.

Below 900px opponents use a compact scrolling rail. Portrait stacks the board
and hand. Landscape under 600px tall places the board and hand side by side.
Overflow stays inside card/property rails; controls stay within the viewport.

## Cards and motion
Card faces have dimensional paper edges, printed type labels, written names,
visible values, and local isometric property artwork. Fanned hand cards lift
on hover/focus/selection. State-driven Web Animations render inert card copies
above scrolling areas so a card's path remains visible from source to target.
Public opponent plays cross the table; private draws remain face-down.
Motion uses transform/opacity and short ease-out timing, with cleanup on new
state and unmount. System reduced motion and the persisted in-game setting
both suppress the animation layer.

## Interaction and accessibility
Click/tap actions remain alternatives to dragging. Arrow keys, Home and End
navigate the hand; Enter selects; Escape closes the tray. Dialogs have accessible
names and focus trapping/restoration. Color and turn indicators also use text.
The smile control sends explicit reactions through the existing chat transport,
with transient player bubbles and permanent chat history. UI copy is included
in the English, Italian and German catalogs.

## Implementation
Shared theme/components live in frontend/src/index.css. Table.tsx composes the
scene without changing game rules or WebSocket message contracts. GameBrand,
PropertyArtwork, Reactions and TableMotion own their respective presentation
and interaction responsibilities. The server remains authoritative.

## Inspection and wildcard refinement
Two-color property wildcards have opposing color ends. A reversible inner face
keeps the currently assigned color upright; rent cards retain their separate
split-color header so the two card types remain visually distinct. Railroads
and utilities have dedicated local vector symbols.

Desktop opponent seats render public property thumbnails grouped by color,
with count, completion and rent labels. Card, set, bank and player inspections
use delayed hover/focus previews rendered outside overflow rails. The preview
is hoverable, dismisses with Escape/outside tap/scroll and repositions when its
content changes. Non-action cards also open previews on tap. No preview reveals
private opponent hands. See docs/UI-UX-REVIEW.md for findings and follow-up ideas.
