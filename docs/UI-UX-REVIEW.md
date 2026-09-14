# Table and card experience review

Reviewed after the shared-table restyle, September 2026. Focus: desktop play,
card readability, opponent information and inspection without leaving the table.

## Addressed

| Friction | Change |
| --- | --- |
| Two-color wildcards looked like rent cards and did not reveal their active color. | Distinct two-ended artwork, with one color at each end. The chosen color faces up in your sets, opponent sets and the action-dialog preview. The server still controls the move and its play cost. |
| Opponent properties disappeared behind counters and a board dialog. | Actual public card stacks remain beside each player, with color labels, set counts, completion outlines, buildings and rent. Wide collections scroll inside the seat. |
| Tiny cards required reading truncated text or browser titles. | Delayed, enlarged hover previews show the full card, name, value, rule, active color and set context. Preview panels escape scrolling rails and stay within the viewport. |
| Set vulnerability and rent were hard to compare. | Set labels reveal a larger group preview, current rent and whether ordinary steal/swap actions can affect it. |
| A banked action still looked playable. | Bank inspections explain that the card now represents money and cannot perform its action. |
| Player and bank totals offered little context. | Hover/focus summaries expose public hand counts, complete sets, assets and itemized bank contents. Clicking still opens the complete board. |
| Hover-only interactions would exclude touch and keyboard players. | Focus reveals the same details; static cards open details on tap. Escape, outside taps and scrolling dismiss previews. Card actions and drag/drop remain unchanged. |
| Dense opponent boards crowded the center and personal cards were clipped on short laptops. | Revised seat spacing and a side-by-side top seat for two/four-player tables; extra room in the short-screen property strip. |
| A selected card could leave the hand after a server update while its old action tray remained visible. | Selection is resolved against the current authoritative hand. |
| Railroads and utilities used the same house image as streets. | Separate train and utility artwork, also applied to each matching wildcard end. |

## Validation

Browser checks cover real wildcard placement and moves, the selected-color
preview, charged play counts, ordinary property/bank actions, hover delay,
pointer travel into the preview, Escape dismissal, keyboard inspection and touch
inspection. Crowded public-board fixtures exercise visible property stacks and
set/bank previews at desktop, laptop, portrait-phone and landscape-phone sizes.
The production build and three-language catalog check also pass.

## Worth a subsequent gameplay pass

- Preview the consequences of a payment selection: which sets break and how
  much rent is lost. The present panel reports the money total but gives less
  help judging the strategic cost of handing over a property.
- Allow rent/steal/swap targets to be chosen directly on the shared table while
  retaining the existing accessible dialog as a fallback. This would connect
  target selection to the opponents' newly visible boards.
- Add optional sound cues for turn changes and hostile actions, with an explicit
  mute setting. Current feedback is visual; a player looking away can miss it.
