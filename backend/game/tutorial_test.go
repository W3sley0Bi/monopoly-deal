package game

import "testing"

func newTutorial(t *testing.T) (*Game, *Player, *Player) {
	t.Helper()
	g := NewGame("tut")
	g.AddPlayer("you", "Wes")
	if err := g.AddBot("coach", TutorialCoach); err != nil {
		t.Fatal(err)
	}
	if err := g.Configure(ModeTutorial, 0); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	you, coach := g.tutorialSeats()
	if you == nil || coach == nil {
		t.Fatal("a tutorial needs a learner and a coach")
	}
	return g, you, coach
}

/** The first card in hand of a given type, for driving a lesson. */
func inHand(t *testing.T, p *Player, match func(Card) bool) Card {
	t.Helper()
	for _, c := range p.Hand {
		if match(c) {
			return c
		}
	}
	t.Fatalf("%s holds nothing matching: %v", p.Name, p.Hand)
	return Card{}
}

func isAction(a ActionType) func(Card) bool {
	return func(c Card) bool { return c.Action == a }
}

// play performs the move a lesson asks for. Every lesson has to be finishable
// through the ordinary rules, or it is teaching something the game cannot do.
func play(t *testing.T, g *Game, you, coach *Player, id string) {
	t.Helper()
	switch id {
	case "hand":
		// Nothing to do but read it.
	case "property":
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeProperty })
		if err := g.PlayProperty(you.ID, c.ID, c.Colors[0]); err != nil {
			t.Fatal(err)
		}
	case "wildcard":
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypePropertyWildcard })
		if err := g.PlayProperty(you.ID, c.ID, c.Colors[0]); err != nil {
			t.Fatal(err)
		}
	case "wildcard_any":
		// The joker has no colour of its own, so the colour has to come from
		// the set it is joining rather than from the card.
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypePropertyWildcard })
		if err := g.PlayProperty(you.ID, c.ID, ColorRed); err != nil {
			t.Fatal(err)
		}
	case "tapping":
		// The server cannot tell a tap from a drag, and should not: the lesson
		// is about the route, the rule is the same either way.
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeProperty })
		if err := g.PlayProperty(you.ID, c.ID, c.Colors[0]); err != nil {
			t.Fatal(err)
		}
	case "bank":
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeMoney })
		if err := g.PlayToBank(you.ID, c.ID); err != nil {
			t.Fatal(err)
		}
	case "pass_go":
		c := inHand(t, you, isAction(ActionPassGo))
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{}); err != nil {
			t.Fatal(err)
		}
	case "end_turn":
		if err := g.EndTurn(you.ID); err != nil {
			t.Fatal(err)
		}
	case "rent":
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeRent })
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{Color: ColorBlue, TargetPlayerID: coach.ID}); err != nil {
			t.Fatal(err)
		}
	case "double_rent":
		// Doubling is not a play of its own: the card rides along with the
		// rent it doubles.
		d := inHand(t, you, isAction(ActionDoubleRent))
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeRent })
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{
			Color: ColorBlue, TargetPlayerID: coach.ID, DoubleCardIDs: []string{d.ID},
		}); err != nil {
			t.Fatal(err)
		}
	case "paying":
		if g.Pending == nil {
			t.Fatal("the coach should already be charging you")
		}
		if err := g.Respond(you.ID, false, g.autoPayIDs(you, g.Pending.target(you.ID).Amount)); err != nil {
			t.Fatal(err)
		}
	case "just_say_no":
		if g.Pending == nil {
			t.Fatal("the coach should already be stealing from you")
		}
		if err := g.Respond(you.ID, true, nil); err != nil {
			t.Fatal(err)
		}
	case "sly_deal":
		c := inHand(t, you, isAction(ActionSlyDeal))
		steal := coach.Sets[0].Cards[0]
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{
			TargetPlayerID: coach.ID, TargetCardID: steal.ID,
		}); err != nil {
			t.Fatal(err)
		}
	case "forced_deal":
		c := inHand(t, you, isAction(ActionForcedDeal))
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{
			TargetPlayerID: coach.ID,
			TargetCardID:   coach.Sets[0].Cards[0].ID,
			GiveCardID:     you.Sets[0].Cards[0].ID,
		}); err != nil {
			t.Fatal(err)
		}
	case "deal_breaker":
		// The coach has a board, so the complete set has to be found rather
		// than assumed to be the first one.
		c := inHand(t, you, isAction(ActionDealBreaker))
		var full Color
		for _, s := range coach.Sets {
			if s.IsComplete() {
				full = s.Color
				break
			}
		}
		if full == "" {
			t.Fatal("Deal Breaker needs the coach to hold a complete set")
		}
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{
			TargetPlayerID: coach.ID, Color: full,
		}); err != nil {
			t.Fatal(err)
		}
	case "house":
		c := inHand(t, you, isAction(ActionHouse))
		if err := g.PlayAction(you.ID, c.ID, ActionOptions{Color: ColorBrown}); err != nil {
			t.Fatal(err)
		}
	case "win":
		c := inHand(t, you, func(c Card) bool { return c.Type == CardTypeProperty })
		if err := g.PlayProperty(you.ID, c.ID, c.Colors[0]); err != nil {
			t.Fatal(err)
		}
	default:
		t.Fatalf("no test move written for lesson %q", id)
	}
	g.PostAction()
}

// Every lesson has to be completable by playing it, through the same rules the
// real game uses. A lesson that cannot be finished is a tutorial that traps
// whoever is taking it.
func TestEveryLessonCanBeCompleted(t *testing.T) {
	g, you, coach := newTutorial(t)

	for i := range lessons {
		state := g.Tutorial
		if state == nil {
			t.Fatalf("lesson %d: the table stopped teaching", i+1)
		}
		if state.Step != i+1 || state.Total != len(lessons) {
			t.Fatalf("lesson %d: reported as %d of %d", i+1, state.Step, state.Total)
		}
		if state.ID != lessons[i].id {
			t.Fatalf("lesson %d: on %q, want %q", i+1, state.ID, lessons[i].id)
		}

		if state.Task && state.Done {
			t.Fatalf("lesson %q starts already finished, so it teaches nothing", state.ID)
		}

		play(t, g, you, coach, state.ID)

		if g.Tutorial != nil && !g.Tutorial.Done {
			t.Fatalf("lesson %q: the move was made but the lesson did not register it", state.ID)
		}
		if i < len(lessons)-1 {
			if err := g.TutorialNext(you.ID); err != nil {
				t.Fatal(err)
			}
			you, coach = g.tutorialSeats()
		}
	}

	if g.State != StateFinished {
		t.Fatalf("the last lesson is winning, but the game is %q", g.State)
	}
}

// The opponent has to look like an opponent. A coach sitting behind an empty
// table makes every targeting dialog open onto nothing to target.
func TestCoachAlwaysHasABoard(t *testing.T) {
	g, you, _ := newTutorial(t)
	for {
		state := g.Tutorial
		if state == nil {
			break
		}
		_, coach := g.tutorialSeats()
		if len(coach.Sets) == 0 {
			t.Fatalf("lesson %q leaves the coach with no property at all", state.ID)
		}
		if coach.BankTotal() == 0 {
			t.Fatalf("lesson %q leaves the coach with nothing to pay with", state.ID)
		}
		if state.ID == "deal_breaker" {
			full := 0
			for _, s := range coach.Sets {
				if s.IsComplete() {
					full++
				}
			}
			if full == 0 {
				t.Fatal("the Deal Breaker lesson has nothing complete to break")
			}
		}
		if state.Step >= state.Total {
			break
		}
		if err := g.TutorialNext(you.ID); err != nil {
			t.Fatal(err)
		}
		you, _ = g.tutorialSeats()
	}
}

// Ending a turn hands it to a robot, which hands it straight back. A lesson
// that reads its goal live would un-finish itself a second later.
func TestLessonStaysDoneOnceDone(t *testing.T) {
	g, you, coach := newTutorial(t)
	for g.Tutorial != nil && g.Tutorial.ID != "end_turn" {
		if err := g.TutorialNext(you.ID); err != nil {
			t.Fatal(err)
		}
		you, coach = g.tutorialSeats()
	}
	play(t, g, you, coach, "end_turn")
	if !g.Tutorial.Done {
		t.Fatal("ending the turn did not finish the lesson")
	}
	// The robot takes its turn and passes it back.
	for i := 0; i < 40 && g.BotWaiting(); i++ {
		if !g.BotAct() {
			break
		}
		g.PostAction()
	}
	if g.Players[g.CurrentTurn].ID != you.ID {
		t.Skip("the robot never handed the turn back; nothing to check")
	}
	if !g.Tutorial.Done {
		t.Fatal("the lesson un-finished itself once the turn came back round")
	}
}

// A lesson that hands out two finished sets must not end the game on the spot.
func TestMidCurriculumSetsDoNotWin(t *testing.T) {
	g, you, _ := newTutorial(t)
	for g.Tutorial != nil && g.Tutorial.ID != "win" {
		at := g.Tutorial.ID
		if err := g.TutorialNext(you.ID); err != nil {
			t.Fatal(err)
		}
		you, _ = g.tutorialSeats()
		if g.State == StateFinished {
			t.Fatalf("the table ended during lesson %q, which is not about winning", at)
		}
	}
}

// Skipping ahead is always allowed: a tutorial you cannot leave is a cage.
func TestTutorialCanBeSkippedThrough(t *testing.T) {
	g, you, _ := newTutorial(t)
	for i := 0; i < len(lessons); i++ {
		if err := g.TutorialNext(you.ID); err != nil {
			t.Fatalf("lesson %d refused to be skipped: %v", i+1, err)
		}
		you, _ = g.tutorialSeats()
	}
	if g.State != StateFinished {
		t.Fatalf("skipping to the end left the table %q", g.State)
	}
}
