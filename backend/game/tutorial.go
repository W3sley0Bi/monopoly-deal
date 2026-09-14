package game

import "strings"

// The tutorial is a scripted table, not a game against robots.
//
// A real game cannot teach Deal Breaker, because it will not deal you one when
// you need it, and it will not hand your opponent a complete set to take. So
// each lesson rebuilds the table into exactly the situation it is about: the
// cards in your hand, what is in front of both players, and whose turn it is.
// Everything after that is the ordinary rules — the same PlayAction, the same
// Respond, the same validation — so nothing here can teach a rule the real
// game does not have.
//
// The server owns which lesson you are on and whether you have done it. The
// client owns the words and the pointing.

// TutorialState is the lesson the table is currently teaching.
type TutorialState struct {
	// Step is 1-based, for "4 of 15".
	Step  int `json:"step"`
	Total int `json:"total"`
	// ID names the lesson. The client keys its copy and its hints off this.
	ID string `json:"id"`
	// Task is true when the lesson asks for a move rather than a read.
	Task bool `json:"task"`
	// Done is true once the move has been made and the table is waiting to go
	// on. Lessons with no task are done the moment they start.
	Done bool `json:"done"`
}

// prototypes indexes one of every distinct card by its translation key, so a
// lesson can ask for "prop.boardwalk" and get the real card rather than a
// hand-written copy that might drift from the deck.
var prototypes = func() map[string]Card {
	out := map[string]Card{}
	for _, c := range GenerateDeck() {
		if _, seen := out[c.Key]; !seen {
			out[c.Key] = c
		}
	}
	return out
}()

// card mints a fresh copy of a known card.
func card(key string) Card {
	c, ok := prototypes[key]
	if !ok {
		// A typo in a lesson should be visible on the table, not silent.
		return Card{ID: generateID(), Key: key, Name: key, Type: CardTypeMoney, Value: 1}
	}
	c.ID = generateID()
	return c
}

func cards(keys ...string) []Card {
	out := make([]Card, 0, len(keys))
	for _, k := range keys {
		out = append(out, card(k))
	}
	return out
}

// TutorialCoach is the name of the one scripted opponent.
const TutorialCoach = "Ada"

// coachBoard is what the opponent has in front of them before any lesson adds
// to it: two part-sets and some cash, the shape of somebody four turns into a
// real game.
//
// Without it the coach sat behind an empty table for eleven of the fifteen
// lessons, which made every targeting dialog open onto nothing to target and
// made the table look like a demo rather than a game.
func coachBoard(coach *Player) {
	propertySet(coach, ColorLightBlue, "prop.oriental_avenue", "prop.vermont_avenue")
	propertySet(coach, ColorOrange, "prop.st_james_place")
	coach.Bank = cards("money.2", "money.1")
	coach.Hand = cards("money.1", "prop.states_avenue", "action.pass_go")
}

// lesson is one situation, built from nothing and finished by a real move.
type lesson struct {
	id string
	// setup puts the table into the situation the lesson is about.
	setup func(g *Game, you, coach *Player)
	// done reports that the player has made the move. A lesson with no `done`
	// is something to read, and ends when the player says so.
	done func(g *Game, you, coach *Player) bool
}

// propertySet drops a ready-made colour group in front of a player.
func propertySet(p *Player, color Color, keys ...string) {
	p.Sets = append(p.Sets, &PropertySet{Color: color, Cards: cards(keys...)})
}

func ownsColor(p *Player, color Color) int {
	for _, s := range p.Sets {
		if s.Color == color {
			return len(s.Cards)
		}
	}
	return 0
}

func handHas(p *Player, action ActionType) bool {
	for _, c := range p.Hand {
		if c.Action == action {
			return true
		}
	}
	return false
}

func discardHas(g *Game, action ActionType) bool {
	for _, c := range g.DiscardPile {
		if c.Action == action {
			return true
		}
	}
	return false
}

func properties(p *Player) int {
	n := 0
	for _, s := range p.Sets {
		n += len(s.Cards)
	}
	return n
}

// lessons is the curriculum, in order.
var lessons = []lesson{
	{
		// Nothing to do but look: the hand, the mat, the bank.
		id: "hand",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("prop.boardwalk", "prop.park_place", "money.4", "action.pass_go")
		},
	},
	{
		id: "property",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("prop.boardwalk", "prop.park_place", "money.2")
		},
		done: func(g *Game, you, coach *Player) bool { return properties(you) > 0 },
	},
	{
		// A wildcard is the first card that asks you to make a decision.
		id: "wildcard",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("wild.green_blue", "prop.pacific_avenue")
			propertySet(you, ColorBlue, "prop.boardwalk")
		},
		done: func(g *Game, you, coach *Player) bool {
			for _, s := range you.Sets {
				for _, c := range s.Cards {
					if c.Type == CardTypePropertyWildcard {
						return true
					}
				}
			}
			return false
		},
	},
	{
		// Dragging is not the only way to play a card. Tapping it opens a
		// menu of everything that card can do, which is how you play on a
		// phone and how you resolve a card whose destination is ambiguous.
		id: "tapping",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("prop.pacific_avenue", "money.3")
		},
		done: func(g *Game, you, coach *Player) bool { return properties(you) > 0 },
	},
	{
		// Money is not points. It is what you pay other people with.
		id: "bank",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("money.5", "action.sly_deal", "prop.baltic_avenue")
		},
		done: func(g *Game, you, coach *Player) bool { return len(you.Bank) > 0 },
	},
	{
		id: "pass_go",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("action.pass_go", "money.1")
		},
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionPassGo) },
	},
	{
		// Three plays, then the turn passes whether you used them or not.
		id: "end_turn",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("money.2", "prop.oriental_avenue")
			g.PlaysLeft = 1
		},
		done: func(g *Game, you, coach *Player) bool { return g.Players[g.CurrentTurn].ID != you.ID },
	},
	{
		// A complete set is worth rent, and rent is how you take other
		// people's money without touching their property.
		id: "rent",
		setup: func(g *Game, you, coach *Player) {
			propertySet(you, ColorBlue, "prop.boardwalk", "prop.park_place")
			you.Hand = cards("rent.green_blue")
			coach.Bank = cards("money.5", "money.2")
		},
		done: func(g *Game, you, coach *Player) bool { return you.BankTotal() > 0 },
	},
	{
		id: "double_rent",
		setup: func(g *Game, you, coach *Player) {
			propertySet(you, ColorBlue, "prop.boardwalk", "prop.park_place")
			you.Hand = cards("rent.green_blue", "action.double_rent")
			coach.Bank = cards("money.10", "money.5", "money.4")
		},
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionDoubleRent) },
	},
	{
		// Now the other way round: somebody charges you, and you choose what
		// leaves your table to cover it.
		id: "paying",
		setup: func(g *Game, you, coach *Player) {
			you.Bank = cards("money.3", "money.1")
			propertySet(you, ColorOrange, "prop.st_james_place")
			coach.Hand = cards("action.debt_collector")
			g.coachPlays(coach, ActionDebtCollector, ActionOptions{TargetPlayerID: you.ID})
		},
		done: func(g *Game, you, coach *Player) bool { return g.Pending == nil },
	},
	{
		// The one card that undoes somebody else's.
		id: "just_say_no",
		setup: func(g *Game, you, coach *Player) {
			propertySet(you, ColorRed, "prop.kentucky_avenue")
			you.Hand = cards("action.just_say_no")
			coach.Hand = cards("action.sly_deal")
			g.coachPlays(coach, ActionSlyDeal, ActionOptions{
				TargetPlayerID: you.ID,
				TargetCardID:   you.Sets[len(you.Sets)-1].Cards[0].ID,
			})
		},
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionJustSayNo) },
	},
	{
		id: "sly_deal",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("action.sly_deal")
			propertySet(coach, ColorYellow, "prop.marvin_gardens")
		},
		// Any property will do: the coach has a boardful and the lesson is
		// about the card, not about which avenue you fancied.
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionSlyDeal) },
	},
	{
		id: "forced_deal",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("action.forced_deal")
			propertySet(you, ColorBrown, "prop.baltic_avenue")
			propertySet(coach, ColorGreen, "prop.pacific_avenue")
		},
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionForcedDeal) },
	},
	{
		// The biggest card in the deck: a whole finished set, taken.
		id: "deal_breaker",
		setup: func(g *Game, you, coach *Player) {
			you.Hand = cards("action.deal_breaker")
			propertySet(coach, ColorBrown, "prop.mediterranean_avenue", "prop.baltic_avenue")
		},
		done: func(g *Game, you, coach *Player) bool { return discardHas(g, ActionDealBreaker) },
	},
	{
		// A finished set can be made to earn more.
		id: "house",
		setup: func(g *Game, you, coach *Player) {
			propertySet(you, ColorBrown, "prop.mediterranean_avenue", "prop.baltic_avenue")
			you.Hand = cards("action.house")
		},
		done: func(g *Game, you, coach *Player) bool {
			for _, s := range you.Sets {
				if len(s.Buildings) > 0 {
					return true
				}
			}
			return false
		},
	},
	{
		// Three sets ends it. The last card is in your hand.
		id: "win",
		setup: func(g *Game, you, coach *Player) {
			propertySet(you, ColorBrown, "prop.mediterranean_avenue", "prop.baltic_avenue")
			propertySet(you, ColorBlue, "prop.boardwalk", "prop.park_place")
			propertySet(you, ColorUtility, "prop.water_works")
			you.Hand = cards("prop.electric_company")
		},
		done: func(g *Game, you, coach *Player) bool { return g.State == StateFinished },
	},
}

// TutorialLessons is how many situations the curriculum covers.
func TutorialLessons() int { return len(lessons) }

// coachPlays makes the scripted opponent take a turn, through the same rules
// the player is bound by, so what they see happen to them is a real move.
func (g *Game) coachPlays(coach *Player, action ActionType, opt ActionOptions) {
	var id string
	for _, c := range coach.Hand {
		if c.Action == action {
			id = c.ID
			break
		}
	}
	if id == "" {
		return
	}
	was := g.CurrentTurn
	g.CurrentTurn = g.playerIndex(coach.ID)
	g.PlaysLeft = PlaysPerTurn
	_ = g.PlayAction(coach.ID, id, opt)
	g.CurrentTurn = was
	g.PlaysLeft = PlaysPerTurn
}

// startTutorial opens the first lesson.
func (g *Game) startTutorial() {
	g.tutorialAt = 0
	g.applyLesson()
}

// applyLesson wipes the table and rebuilds it for the current lesson.
func (g *Game) applyLesson() {
	you, coach := g.tutorialSeats()
	if you == nil || coach == nil || g.tutorialAt >= len(lessons) {
		return
	}
	current := lessons[g.tutorialAt]
	g.tutorialDone = false

	for _, p := range g.Players {
		p.Hand = nil
		p.Bank = nil
		p.Sets = nil
	}
	g.Pending = nil
	g.DiscardPile = nil
	g.CurrentTurn = g.playerIndex(you.ID)
	g.PlaysLeft = PlaysPerTurn
	// A lesson never runs out of deck: drawing is not what is being taught.
	g.Deck = GenerateDeck()
	g.clearDeadline()

	coachBoard(coach)
	current.setup(g, you, coach)
	g.log("log.tutorial_lesson", "lesson", current.id)
	g.syncTutorial()
}

// TutorialNext moves on, whether the player did the task or skipped it.
func (g *Game) TutorialNext(playerID string) error {
	if g.Mode != ModeTutorial {
		return fault("err.not_tutorial", "this table is not a tutorial")
	}
	you, _ := g.tutorialSeats()
	if you == nil || you.ID != playerID {
		return fault("err.not_your_tutorial", "this is not your tutorial")
	}
	if g.tutorialAt >= len(lessons)-1 {
		g.State = StateFinished
		g.WinnerID = you.ID
		g.Tutorial = nil
		g.clearDeadline()
		return nil
	}
	g.tutorialAt++
	g.applyLesson()
	return nil
}

// tutorialSeats returns the learner and the scripted opponent.
func (g *Game) tutorialSeats() (you, coach *Player) {
	for _, p := range g.Players {
		if p.Bot {
			coach = p
		} else if you == nil {
			you = p
		}
	}
	return you, coach
}

// syncTutorial refreshes what the client is told about the lesson.
func (g *Game) syncTutorial() {
	if g.Mode != ModeTutorial || g.State != StatePlaying || g.tutorialAt >= len(lessons) {
		g.Tutorial = nil
		return
	}
	you, coach := g.tutorialSeats()
	if you == nil || coach == nil {
		g.Tutorial = nil
		return
	}
	current := lessons[g.tutorialAt]
	done := true
	if current.done != nil {
		// Latched. A goal read live can go false again — end a turn and the
		// robot hands it straight back, so "it is not your turn" stops being
		// true a second later and the lesson would un-finish itself.
		if !g.tutorialDone && current.done(g, you, coach) {
			g.tutorialDone = true
		}
		done = g.tutorialDone
	}
	g.Tutorial = &TutorialState{
		Step:  g.tutorialAt + 1,
		Total: len(lessons),
		ID:    current.id,
		Task:  current.done != nil,
		Done:  done,
	}
}

// tutorialPostAction answers for the scripted opponent and re-checks the
// lesson. Called from PostAction so no mutator can forget it.
func (g *Game) tutorialPostAction() {
	// The coach never deliberates: whatever is aimed at them, they take.
	for g.Pending != nil {
		_, coach := g.tutorialSeats()
		if coach == nil {
			break
		}
		target := g.Pending.target(coach.ID)
		if target == nil || target.Settled || target.Responder != coach.ID {
			break
		}
		var pay []string
		if g.Pending.Kind == PendingPayment {
			pay = g.autoPayIDs(coach, target.Amount)
		}
		if err := g.Respond(coach.ID, false, pay); err != nil {
			break
		}
	}
	g.syncTutorial()
}

// tutorialHoldsWin reports that a lesson has handed the player complete sets
// for its own purposes and the game must not end on them. Only the last
// lesson is actually about winning.
func (g *Game) tutorialHoldsWin() bool {
	if g.Mode != ModeTutorial || g.tutorialAt >= len(lessons) {
		return false
	}
	return lessons[g.tutorialAt].id != "win"
}

// TutorialSummary names the lesson for a log line or a room row.
func (g *Game) TutorialSummary() string {
	if g.Tutorial == nil {
		return ""
	}
	return strings.ReplaceAll(g.Tutorial.ID, "_", " ")
}
