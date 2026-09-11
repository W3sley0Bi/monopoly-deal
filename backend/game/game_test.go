package game

import "testing"

func newTwoPlayer(t *testing.T) *Game {
	t.Helper()
	g := NewGame("t")
	if err := g.AddPlayer("a", "Alice"); err != nil {
		t.Fatal(err)
	}
	if err := g.AddPlayer("b", "Bob"); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	return g
}

// give replaces a player's hand with specific cards and returns a stable copy,
// since playing a card shifts the player's own hand slice in place.
func give(g *Game, id string, cards ...Card) []Card {
	p := g.Player(id)
	for i := range cards {
		cards[i].ID = generateID()
	}
	p.Hand = append([]Card{}, cards...)
	return append([]Card{}, cards...)
}

func prop(name string, value int, col Color) Card {
	return Card{Type: CardTypeProperty, Name: name, Value: value, Colors: []Color{col}}
}

func TestDeckShape(t *testing.T) {
	d := GenerateDeck()
	if len(d) != 106 {
		t.Fatalf("deck has %d cards, want 106", len(d))
	}
	seen := map[string]bool{}
	for _, c := range d {
		if seen[c.ID] {
			t.Fatalf("duplicate card id %s", c.ID)
		}
		seen[c.ID] = true
	}
}

func TestSetSizesAndRent(t *testing.T) {
	if SetSize(ColorBrown) != 2 || SetSize(ColorRailroad) != 4 || SetSize(ColorGreen) != 3 {
		t.Fatal("wrong set sizes")
	}
	if RentFor(ColorGreen, 3, false, false) != 7 {
		t.Fatal("green full set rent should be 7")
	}
	if RentFor(ColorGreen, 3, true, true) != 14 {
		t.Fatal("green full set with house+hotel should be 14")
	}
	if RentFor(ColorGreen, 2, true, true) != 4 {
		t.Fatal("buildings should not boost an incomplete set")
	}
}

func TestTurnFlowAndPlayLimit(t *testing.T) {
	g := newTwoPlayer(t)
	h := give(g, "a",
		Card{Type: CardTypeMoney, Name: "$3M", Value: 3},
		Card{Type: CardTypeMoney, Name: "$2M", Value: 2},
		Card{Type: CardTypeMoney, Name: "$1M", Value: 1},
		Card{Type: CardTypeMoney, Name: "$5M", Value: 5},
	)
	g.PlaysLeft = 3
	for i := 0; i < 3; i++ {
		if err := g.PlayToBank("a", h[i].ID); err != nil {
			t.Fatalf("bank %d: %v", i, err)
		}
	}
	if err := g.PlayToBank("a", h[3].ID); err == nil {
		t.Fatal("expected no plays left")
	}
	if got := g.Player("a").BankTotal(); got != 6 {
		t.Fatalf("bank total %d, want 6", got)
	}
	if err := g.EndTurn("a"); err != nil {
		t.Fatal(err)
	}
	if g.current().ID != "b" {
		t.Fatal("turn did not advance")
	}
	if err := g.PlayToBank("a", h[3].ID); err == nil {
		t.Fatal("expected not-your-turn error")
	}
}

func TestPropertyColorValidation(t *testing.T) {
	g := newTwoPlayer(t)
	h := give(g, "a", prop("Boardwalk", 4, ColorBlue))
	g.PlaysLeft = 3
	if err := g.PlayProperty("a", h[0].ID, ColorGreen); err == nil {
		t.Fatal("blue property should not be playable as green")
	}
	if err := g.PlayProperty("a", h[0].ID, ColorBlue); err != nil {
		t.Fatal(err)
	}
	if len(g.Player("a").Sets) != 1 {
		t.Fatal("set not created")
	}
}

func TestWinRequiresThreeCompleteSets(t *testing.T) {
	g := newTwoPlayer(t)
	a := g.Player("a")
	a.Sets = []*PropertySet{
		{Color: ColorBrown, Cards: []Card{prop("Med", 1, ColorBrown), prop("Baltic", 1, ColorBrown)}},
		{Color: ColorBlue, Cards: []Card{prop("Park", 4, ColorBlue), prop("Board", 4, ColorBlue)}},
		{Color: ColorGreen, Cards: []Card{prop("Pacific", 4, ColorGreen), prop("NC", 4, ColorGreen)}},
	}
	h := give(g, "a", prop("Penn", 4, ColorGreen))
	g.PlaysLeft = 3
	if g.State != StatePlaying {
		t.Fatal("should still be playing with 2 complete sets")
	}
	if err := g.PlayProperty("a", h[0].ID, ColorGreen); err != nil {
		t.Fatal(err)
	}
	if g.State != StateFinished || g.WinnerID != "a" {
		t.Fatalf("expected win, got state=%s winner=%s", g.State, g.WinnerID)
	}
}

func TestRentPaymentFlow(t *testing.T) {
	g := newTwoPlayer(t)
	a, b := g.Player("a"), g.Player("b")
	a.Sets = []*PropertySet{{Color: ColorGreen, Cards: []Card{
		prop("Pacific", 4, ColorGreen), prop("NC", 4, ColorGreen), prop("Penn", 4, ColorGreen),
	}}}
	b.Hand = []Card{}
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5},
		{ID: generateID(), Type: CardTypeMoney, Name: "$3M", Value: 3}}

	h := give(g, "a", Card{Type: CardTypeRent, Name: "Rent: Green/Blue", Value: 1,
		Colors: []Color{ColorGreen, ColorBlue}})
	g.PlaysLeft = 3

	if err := g.PlayAction("a", h[0].ID, ActionOptions{Color: ColorGreen}); err != nil {
		t.Fatal(err)
	}
	if g.Pending == nil || g.Pending.Targets[0].Amount != 7 {
		t.Fatalf("expected pending rent of 7, got %+v", g.Pending)
	}
	// Underpaying is rejected.
	if err := g.Respond("b", false, []string{b.Bank[1].ID}); err == nil {
		t.Fatal("underpayment should be rejected")
	}
	if err := g.Respond("b", false, []string{b.Bank[0].ID, b.Bank[1].ID}); err != nil {
		t.Fatal(err)
	}
	if g.Pending != nil {
		t.Fatal("pending should be resolved")
	}
	if a.BankTotal() != 8 || b.BankTotal() != 0 {
		t.Fatalf("bank totals a=%d b=%d, want 8 and 0", a.BankTotal(), b.BankTotal())
	}
}

func TestJustSayNoAndCounter(t *testing.T) {
	g := newTwoPlayer(t)
	a, b := g.Player("a"), g.Player("b")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	b.Hand = []Card{{ID: generateID(), Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4}}

	h := give(g, "a",
		Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3},
		Card{Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4},
	)
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	if err := g.Respond("b", true, nil); err != nil {
		t.Fatal(err)
	}
	if g.Pending == nil || !g.Pending.Targets[0].Cancelled {
		t.Fatal("debt should be cancelled after Just Say No")
	}
	if g.Pending.Targets[0].Responder != "a" {
		t.Fatal("responder should bounce to the instigator")
	}
	if err := g.Respond("a", true, nil); err != nil {
		t.Fatal(err)
	}
	if g.Pending == nil || g.Pending.Targets[0].Cancelled {
		t.Fatal("counter Just Say No should put the debt back on")
	}
	if err := g.Respond("b", false, []string{b.Bank[0].ID}); err != nil {
		t.Fatal(err)
	}
	if g.Pending != nil || a.BankTotal() != 5 {
		t.Fatalf("expected debt paid, bank=%d pending=%v", a.BankTotal(), g.Pending)
	}
}

func TestSlyDealCannotTakeFromCompleteSet(t *testing.T) {
	g := newTwoPlayer(t)
	b := g.Player("b")
	b.Hand = []Card{}
	full := &PropertySet{Color: ColorBrown, Cards: []Card{
		{ID: generateID(), Type: CardTypeProperty, Name: "Med", Value: 1, Colors: []Color{ColorBrown}},
		{ID: generateID(), Type: CardTypeProperty, Name: "Baltic", Value: 1, Colors: []Color{ColorBrown}},
	}}
	part := &PropertySet{Color: ColorGreen, Cards: []Card{
		{ID: generateID(), Type: CardTypeProperty, Name: "Pacific", Value: 4, Colors: []Color{ColorGreen}},
	}}
	b.Sets = []*PropertySet{full, part}

	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionSlyDeal, Name: "Sly Deal", Value: 3})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b", TargetCardID: full.Cards[0].ID}); err == nil {
		t.Fatal("should not steal from a complete set")
	}
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b", TargetCardID: part.Cards[0].ID}); err != nil {
		t.Fatal(err)
	}
	if g.Pending != nil {
		t.Fatal("victim has no Just Say No, steal should resolve immediately")
	}
	if len(g.Player("a").Sets) != 1 || g.Player("a").Sets[0].Color != ColorGreen {
		t.Fatalf("stolen card not filed: %+v", g.Player("a").Sets)
	}
}

func TestDealBreakerTakesWholeSet(t *testing.T) {
	g := newTwoPlayer(t)
	b := g.Player("b")
	b.Hand = []Card{}
	b.Sets = []*PropertySet{{Color: ColorBlue, Cards: []Card{
		{ID: generateID(), Type: CardTypeProperty, Name: "Park", Value: 4, Colors: []Color{ColorBlue}},
		{ID: generateID(), Type: CardTypeProperty, Name: "Board", Value: 4, Colors: []Color{ColorBlue}},
	}}}
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDealBreaker, Name: "Deal Breaker", Value: 5})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b", Color: ColorBlue}); err != nil {
		t.Fatal(err)
	}
	if len(b.Sets) != 0 {
		t.Fatal("victim should have lost the set")
	}
	if g.Player("a").CompleteSets() != 1 {
		t.Fatal("thief should hold a complete set")
	}
}

func TestHouseNeedsCompleteSetAndBoostsRent(t *testing.T) {
	g := newTwoPlayer(t)
	a := g.Player("a")
	a.Sets = []*PropertySet{{Color: ColorBrown, Cards: []Card{prop("Med", 1, ColorBrown)}}}
	h := give(g, "a",
		Card{Type: CardTypeAction, Action: ActionHouse, Name: "House", Value: 3},
		Card{Type: CardTypeAction, Action: ActionHotel, Name: "Hotel", Value: 4},
	)
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{Color: ColorBrown}); err == nil {
		t.Fatal("house needs a complete set")
	}
	a.Sets[0].Cards = append(a.Sets[0].Cards, prop("Baltic", 1, ColorBrown))
	if err := g.PlayAction("a", h[0].ID, ActionOptions{Color: ColorBrown}); err != nil {
		t.Fatal(err)
	}
	if a.Sets[0].Rent() != 5 {
		t.Fatalf("rent with house = %d, want 5", a.Sets[0].Rent())
	}
	if err := g.PlayAction("a", h[1].ID, ActionOptions{Color: ColorBrown}); err != nil {
		t.Fatal(err)
	}
	if a.Sets[0].Rent() != 9 {
		t.Fatalf("rent with house+hotel = %d, want 9", a.Sets[0].Rent())
	}
}

func TestDoubleRentCostsTwoPlays(t *testing.T) {
	g := newTwoPlayer(t)
	a, b := g.Player("a"), g.Player("b")
	a.Sets = []*PropertySet{{Color: ColorBrown, Cards: []Card{
		prop("Med", 1, ColorBrown), prop("Baltic", 1, ColorBrown),
	}}}
	b.Hand = []Card{}
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$4M", Value: 4}}
	h := give(g, "a",
		Card{Type: CardTypeRent, Name: "Rent: Brown/Light Blue", Value: 1, Colors: []Color{ColorBrown, ColorLightBlue}},
		Card{Type: CardTypeAction, Action: ActionDoubleRent, Name: "Double The Rent", Value: 1},
	)
	g.PlaysLeft = 1
	if err := g.PlayAction("a", h[0].ID, ActionOptions{Color: ColorBrown, DoubleCardIDs: []string{h[1].ID}}); err == nil {
		t.Fatal("should need 2 plays")
	}
	g.PlaysLeft = 2
	if err := g.PlayAction("a", h[0].ID, ActionOptions{Color: ColorBrown, DoubleCardIDs: []string{h[1].ID}}); err != nil {
		t.Fatal(err)
	}
	if g.Pending.Targets[0].Amount != 4 {
		t.Fatalf("doubled rent = %d, want 4", g.Pending.Targets[0].Amount)
	}
	if g.PlaysLeft != 0 {
		t.Fatalf("plays left = %d, want 0", g.PlaysLeft)
	}
}

func TestPayWithEverythingWhenShort(t *testing.T) {
	g := newTwoPlayer(t)
	a, b := g.Player("a"), g.Player("b")
	b.Hand = []Card{}
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$1M", Value: 1}}
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	if err := g.Respond("b", false, []string{b.Bank[0].ID}); err != nil {
		t.Fatalf("paying all assets should be accepted: %v", err)
	}
	if a.BankTotal() != 1 || len(b.Bank) != 0 {
		t.Fatal("assets did not transfer")
	}
}

func TestHandLimitBlocksEndTurn(t *testing.T) {
	g := newTwoPlayer(t)
	p := g.Player("a")
	p.Hand = nil
	for i := 0; i < 9; i++ {
		p.Hand = append(p.Hand, Card{ID: generateID(), Type: CardTypeMoney, Name: "$1M", Value: 1})
	}
	if err := g.EndTurn("a"); err == nil {
		t.Fatal("should require discarding to 7")
	}
	g.PlaysLeft = 3
	if err := g.Discard("a", p.Hand[0].ID); err != nil {
		t.Fatalf("discard above the limit should be allowed: %v", err)
	}
	if err := g.Discard("a", p.Hand[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := g.EndTurn("a"); err != nil {
		t.Fatalf("end turn at 7 cards: %v", err)
	}
}

func TestPendingBlocksOtherPlays(t *testing.T) {
	g := newTwoPlayer(t)
	b := g.Player("b")
	b.Hand = []Card{{ID: generateID(), Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4}}
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	h := give(g, "a",
		Card{Type: CardTypeAction, Action: ActionBirthday, Name: "It's My Birthday", Value: 2},
		Card{Type: CardTypeMoney, Name: "$2M", Value: 2},
	)
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{}); err != nil {
		t.Fatal(err)
	}
	if err := g.PlayToBank("a", h[1].ID); err == nil {
		t.Fatal("should not play while an action is pending")
	}
	if err := g.EndTurn("a"); err == nil {
		t.Fatal("should not end turn while an action is pending")
	}
}

func TestWildcardMoveAndAnyColor(t *testing.T) {
	g := newTwoPlayer(t)
	h := give(g, "a", Card{Type: CardTypePropertyWildcard, Name: "Wild: Red/Yellow", Value: 3,
		Colors: []Color{ColorRed, ColorYellow}})
	g.PlaysLeft = 3
	if err := g.PlayProperty("a", h[0].ID, ColorBlue); err == nil {
		t.Fatal("red/yellow wildcard cannot be blue")
	}
	if err := g.PlayProperty("a", h[0].ID, ColorRed); err != nil {
		t.Fatal(err)
	}
	if err := g.ReassignWildcard("a", h[0].ID, ColorYellow); err != nil {
		t.Fatal(err)
	}
	if g.Player("a").setFor(ColorRed) != nil {
		t.Fatal("empty set should be pruned")
	}
	if s := g.Player("a").setFor(ColorYellow); s == nil || len(s.Cards) != 1 {
		t.Fatal("wildcard did not move")
	}
}
