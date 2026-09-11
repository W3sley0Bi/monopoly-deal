package game

import "testing"

// wildGame deals a two-player game and hands the first player a fresh hand.
func wildGame(t *testing.T) (*Game, *Player) {
	t.Helper()
	g := NewGame("wild")
	if err := g.AddPlayer("a", "Alice"); err != nil {
		t.Fatal(err)
	}
	if err := g.AddPlayer("b", "Bob"); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	return g, g.Player("a")
}

// Moving a wildcard between its colours costs one of the turn's three plays.
func TestMovingAWildcardCostsAPlay(t *testing.T) {
	g, a := wildGame(t)
	wild := Card{ID: "w1", Key: "wild.red_yellow", Type: CardTypePropertyWildcard,
		Name: "Wild: Red/Yellow", Value: 3, Colors: []Color{ColorRed, ColorYellow}}
	a.Sets = []*PropertySet{{Color: ColorRed, Cards: []Card{wild}}}

	before := g.PlaysLeft
	if err := g.ReassignWildcard("a", "w1", ColorYellow); err != nil {
		t.Fatalf("move wildcard: %v", err)
	}
	if g.PlaysLeft != before-1 {
		t.Fatalf("expected the move to cost a play: %d -> %d", before, g.PlaysLeft)
	}
	if s := a.setFor(ColorYellow); s == nil || len(s.Cards) != 1 {
		t.Fatal("the wildcard did not land in the yellow set")
	}
}

// With no plays left the wildcard stays where it is.
func TestMovingAWildcardNeedsAPlay(t *testing.T) {
	g, a := wildGame(t)
	wild := Card{ID: "w1", Key: "wild.red_yellow", Type: CardTypePropertyWildcard,
		Name: "Wild: Red/Yellow", Value: 3, Colors: []Color{ColorRed, ColorYellow}}
	a.Sets = []*PropertySet{{Color: ColorRed, Cards: []Card{wild}}}
	g.PlaysLeft = 0

	if err := g.ReassignWildcard("a", "w1", ColorYellow); err == nil {
		t.Fatal("expected the move to be refused with no plays left")
	}
}

// The any-colour wildcard may only join a colour already on the board.
func TestAnyColourWildcardNeedsAnExistingSet(t *testing.T) {
	g, a := wildGame(t)
	joker := Card{ID: "j1", Key: "wild.any_colour", Type: CardTypePropertyWildcard,
		Name: "Wild: Any Colour", Value: 0, Colors: []Color{ColorAny}}
	green := Card{ID: "g1", Key: "prop.pacific_avenue", Type: CardTypeProperty,
		Name: "Pacific Avenue", Value: 4, Colors: []Color{ColorGreen}}
	a.Sets = []*PropertySet{
		{Color: ColorBlue, Cards: []Card{joker}},
		{Color: ColorGreen, Cards: []Card{green}},
	}

	if err := g.ReassignWildcard("a", "j1", ColorPink); err == nil {
		t.Fatal("expected the joker to be refused on an empty colour")
	}
	if err := g.ReassignWildcard("a", "j1", ColorGreen); err != nil {
		t.Fatalf("the joker should join a colour already in play: %v", err)
	}
	if s := a.setFor(ColorGreen); s == nil || len(s.Cards) != 2 {
		t.Fatal("the joker did not join the green set")
	}
}

// A two-colour wildcard may still switch freely between its own colours, but
// the play cost is what stops it from being a free shuffle every turn.
func TestWildcardMoveUsesTheWholeTurn(t *testing.T) {
	g, a := wildGame(t)
	wild := Card{ID: "w1", Key: "wild.red_yellow", Type: CardTypePropertyWildcard,
		Name: "Wild: Red/Yellow", Value: 3, Colors: []Color{ColorRed, ColorYellow}}
	a.Sets = []*PropertySet{{Color: ColorRed, Cards: []Card{wild}}}

	for i := 0; i < PlaysPerTurn; i++ {
		color := ColorYellow
		if i%2 == 1 {
			color = ColorRed
		}
		if err := g.ReassignWildcard("a", "w1", color); err != nil {
			t.Fatalf("move %d: %v", i, err)
		}
	}
	if g.PlaysLeft != 0 {
		t.Fatalf("three moves should use three plays, %d left", g.PlaysLeft)
	}
	if err := g.ReassignWildcard("a", "w1", ColorYellow); err == nil {
		t.Fatal("a fourth move should be refused")
	}
}
