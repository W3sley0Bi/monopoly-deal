package game

import (
	"testing"
	"time"
)

// threeSets gives a player three complete colour sets.
func threeSets() []*PropertySet {
	return []*PropertySet{
		{Color: ColorBrown, Cards: []Card{prop("Med", 1, ColorBrown), prop("Baltic", 1, ColorBrown)}},
		{Color: ColorBlue, Cards: []Card{prop("Park", 4, ColorBlue), prop("Board", 4, ColorBlue)}},
		{Color: ColorUtility, Cards: []Card{prop("Water", 2, ColorUtility), prop("Electric", 2, ColorUtility)}},
	}
}

func TestClassicWinsWithCardsInHand(t *testing.T) {
	g := newTwoPlayer(t)
	a := g.Player("a")
	a.Sets = threeSets()
	a.Sets[2].Cards = a.Sets[2].Cards[:1]
	h := give(g, "a", prop("Electric", 2, ColorUtility), Card{Type: CardTypeMoney, Name: "$1M", Value: 1})
	g.PlaysLeft = 3

	if err := g.PlayProperty("a", h[0].ID, ColorUtility); err != nil {
		t.Fatal(err)
	}
	if g.State != StateFinished || g.WinnerID != "a" {
		t.Fatalf("classic should win with a card still in hand, got %s", g.State)
	}
}

func TestDeathmatchNeedsEmptyHand(t *testing.T) {
	g := newTwoPlayer(t)
	if err := g.Terminate("a"); err != nil {
		t.Fatal(err)
	}
	if err := g.Configure(ModeDeathmatch, 0); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}

	a := g.Player("a")
	a.Sets = threeSets()
	a.Sets[2].Cards = a.Sets[2].Cards[:1]
	h := give(g, "a",
		prop("Electric", 2, ColorUtility),
		Card{Type: CardTypeMoney, Name: "$1M", Value: 1},
	)
	g.PlaysLeft = 3

	if err := g.PlayProperty("a", h[0].ID, ColorUtility); err != nil {
		t.Fatal(err)
	}
	if g.State == StateFinished {
		t.Fatal("death match must not end while a card is still in hand")
	}
	if err := g.PlayToBank("a", h[1].ID); err != nil {
		t.Fatal(err)
	}
	if g.State != StateFinished || g.WinnerID != "a" {
		t.Fatalf("death match should end on an empty hand, got %s", g.State)
	}
}

func TestGoldenRushLocked(t *testing.T) {
	g := NewGame("t")
	if err := g.Configure(ModeGoldenRush, 0); err == nil {
		t.Fatal("Golden Rush should not be selectable yet")
	}
	if ModeGoldenRush.Available() {
		t.Fatal("Golden Rush should report as unavailable")
	}
	if !ModeClassic.Available() || !ModeDeathmatch.Available() {
		t.Fatal("playable modes should be available")
	}
}

func TestConfigureRejectsBadValues(t *testing.T) {
	g := NewGame("t")
	if err := g.Configure("chess", 0); err == nil {
		t.Fatal("unknown mode should be rejected")
	}
	if err := g.Configure(ModeClassic, 45); err == nil {
		t.Fatal("unsupported turn length should be rejected")
	}
	if err := g.Configure(ModeClassic, 60); err != nil {
		t.Fatal(err)
	}
	if err := g.AddPlayer("a", "A"); err != nil {
		t.Fatal(err)
	}
	if err := g.AddPlayer("b", "B"); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	if err := g.Configure(ModeDeathmatch, 0); err == nil {
		t.Fatal("options must be locked once the game starts")
	}
}

func TestTurnTimerEndsTurn(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	if err := g.AddPlayer("a", "Alice"); err != nil {
		t.Fatal(err)
	}
	if err := g.AddPlayer("b", "Bob"); err != nil {
		t.Fatal(err)
	}
	if err := g.Configure(ModeClassic, 30); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	if g.DeadlineMS == 0 || g.DeadlineKind != "turn" {
		t.Fatalf("expected a turn deadline, got %d %q", g.DeadlineMS, g.DeadlineKind)
	}

	if g.Tick(now.Add(29 * time.Second)) {
		t.Fatal("should not fire before the deadline")
	}
	if g.current().ID != "a" {
		t.Fatal("turn changed early")
	}

	now = now.Add(31 * time.Second)
	if !g.Tick(now) {
		t.Fatal("should fire after the deadline")
	}
	if g.current().ID != "b" {
		t.Fatalf("turn should have passed to Bob, got %s", g.current().ID)
	}
}

func TestTurnTimerDiscardsDownToLimit(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()

	p := g.Player("a")
	p.Hand = nil
	for i := 0; i < 10; i++ {
		p.Hand = append(p.Hand, Card{ID: generateID(), Type: CardTypeMoney, Name: "$1M", Value: 1})
	}

	now = now.Add(31 * time.Second)
	if !g.Tick(now) {
		t.Fatal("timer should fire")
	}
	if len(p.Hand) != HandLimit {
		t.Fatalf("hand should be trimmed to %d, got %d", HandLimit, len(p.Hand))
	}
	if g.current().ID != "b" {
		t.Fatal("turn should have advanced")
	}
}

func TestResponseTimerAutoPaysCashFirst(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()

	a, b := g.Player("a"), g.Player("b")
	b.Hand = []Card{{ID: generateID(), Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4}}
	b.Bank = []Card{
		{ID: generateID(), Type: CardTypeMoney, Name: "$2M", Value: 2},
		{ID: generateID(), Type: CardTypeMoney, Name: "$4M", Value: 4},
	}
	b.Sets = []*PropertySet{{Color: ColorGreen, Cards: []Card{prop("Pacific", 4, ColorGreen)}}}

	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.DeadlineKind != "respond" {
		t.Fatalf("expected a response deadline, got %q", g.DeadlineKind)
	}

	now = now.Add(31 * time.Second)
	if !g.Tick(now) {
		t.Fatal("response timer should fire")
	}
	if g.Pending != nil {
		t.Fatal("pending action should be resolved")
	}
	if a.BankTotal() != 6 {
		t.Fatalf("auto-payment should have handed over $6M of cash, got $%dM", a.BankTotal())
	}
	if len(b.Sets) != 1 || len(b.Sets[0].Cards) != 1 {
		t.Fatal("auto-payment should spend cash before property")
	}
}

func TestTerminateReturnsToLobby(t *testing.T) {
	g := newTwoPlayer(t)
	if err := g.Terminate("b"); err != nil {
		t.Fatal(err)
	}
	if g.State != StateWaiting {
		t.Fatalf("state should be waiting, got %s", g.State)
	}
	if len(g.Players) != 2 {
		t.Fatal("players should keep their seats")
	}
	for _, p := range g.Players {
		if len(p.Hand) != 0 || len(p.Bank) != 0 || len(p.Sets) != 0 {
			t.Fatal("cards should be cleared")
		}
	}
	if err := g.Terminate("b"); err == nil {
		t.Fatal("terminating twice should error")
	}
}

func TestOptionsSurviveReset(t *testing.T) {
	g := newTwoPlayer(t)
	g.Terminate("a")
	if err := g.Configure(ModeDeathmatch, 60); err != nil {
		t.Fatal(err)
	}
	g.Start()
	g.Terminate("a")
	if g.Mode != ModeDeathmatch || g.TurnSeconds != 60 {
		t.Fatalf("options lost: %s %d", g.Mode, g.TurnSeconds)
	}
}

func TestPaymentGetsTenSecondsEvenWithNoTurnTimer(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	// No turn timer at all.
	if err := g.Configure(ModeClassic, 0); err != nil {
		t.Fatal(err)
	}
	g.Start()

	a, b := g.Player("a"), g.Player("b")
	b.Hand = []Card{}
	b.Bank = []Card{
		{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5},
		{ID: generateID(), Type: CardTypeMoney, Name: "$1M", Value: 1},
	}
	if g.DeadlineMS != 0 {
		t.Fatal("a turn should have no deadline when the timer is off")
	}

	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()

	if g.DeadlineKind != "respond" || g.DeadlineSeconds != PaymentGraceSeconds {
		t.Fatalf("expected a %ds payment window, got %q/%d", PaymentGraceSeconds, g.DeadlineKind, g.DeadlineSeconds)
	}
	if g.Tick(now.Add(9 * time.Second)) {
		t.Fatal("must not auto-pay before the grace period is up")
	}
	if g.Pending == nil {
		t.Fatal("debt should still be waiting on Bob")
	}

	now = now.Add(11 * time.Second)
	if !g.Tick(now) {
		t.Fatal("should auto-pay once the grace period expires")
	}
	if g.Pending != nil {
		t.Fatal("debt should be settled")
	}
	if a.BankTotal() != 6 {
		t.Fatalf("auto-payment handed over $%dM, want $6M", a.BankTotal())
	}
	// Back to a turn with no timer at all.
	if g.DeadlineMS != 0 {
		t.Fatal("turn deadline should be clear again")
	}
}

func TestStealsStillAutoResolveWithoutWaiting(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 0)
	g.Start()

	b := g.Player("b")
	b.Hand = []Card{} // no Just Say No, so nothing to decide
	b.Sets = []*PropertySet{{Color: ColorGreen, Cards: []Card{
		{ID: generateID(), Type: CardTypeProperty, Name: "Pacific", Value: 4, Colors: []Color{ColorGreen}},
	}}}

	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionSlyDeal, Name: "Sly Deal", Value: 3})
	g.PlaysLeft = 3
	if err := g.PlayAction("a", h[0].ID, ActionOptions{
		TargetPlayerID: "b", TargetCardID: b.Sets[0].Cards[0].ID,
	}); err != nil {
		t.Fatal(err)
	}
	if g.Pending != nil {
		t.Fatal("a steal nobody can block should resolve immediately, with no countdown")
	}
	if g.Player("a").CompleteSets() != 0 || len(g.Player("a").Sets) != 1 {
		t.Fatal("stolen card should already be filed")
	}
}

func TestEachResponderGetsAFreshWindow(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 0)
	g.Start()

	b := g.Player("b")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	b.Hand = []Card{{ID: generateID(), Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4}}

	h := give(g, "a",
		Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3},
		Card{Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4},
	)
	g.PlaysLeft = 3
	g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"})
	g.PostAction()
	first := g.DeadlineMS

	// Bob burns 8 seconds, then blocks. Alice should get her own 10 seconds.
	now = now.Add(8 * time.Second)
	if err := g.Respond("b", true, nil); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.DeadlineMS <= first {
		t.Fatal("the clock should restart for the next responder")
	}
	if g.Tick(now.Add(9 * time.Second)) {
		t.Fatal("Alice's window should not have expired yet")
	}
}

func TestPlayingAnActionDoesNotExtendTurnDeadline(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionPassGo, Name: "Pass Go", Value: 1})
	deadline := g.DeadlineMS
	// A play several seconds into the turn must leave the original deadline
	// intact, rather than granting a fresh thirty seconds.
	now = now.Add(8 * time.Second)
	if err := g.PlayAction("a", h[0].ID, ActionOptions{}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.DeadlineMS != deadline {
		t.Fatalf("action reset the turn deadline from %d to %d", deadline, g.DeadlineMS)
	}
}

func TestPaymentPausesTurnAndResumesRemainingTime(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()
	b := g.Player("b")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3})
	turnDeadline := g.DeadlineMS
	now = now.Add(8 * time.Second)
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.DeadlineKind != "respond" || g.DeadlineMS != now.Add(PaymentGraceSeconds*time.Second).UnixMilli() {
		t.Fatalf("expected a payment deadline, got %d/%q", g.DeadlineMS, g.DeadlineKind)
	}
	now = now.Add(4 * time.Second)
	if err := g.Respond("b", false, []string{b.Bank[0].ID}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.Pending != nil {
		t.Fatal("payment should be settled")
	}
	wantDeadline := turnDeadline + 4*1000
	if g.DeadlineMS != wantDeadline {
		t.Fatalf("payment should resume the remaining turn window: got %d, want %d", g.DeadlineMS, wantDeadline)
	}
	if remaining := g.DeadlineMS - now.UnixMilli(); remaining != 22*1000 {
		t.Fatalf("payment should leave 22 seconds on the turn, got %dms", remaining)
	}
}

func TestMultiPaymentPausePreservesTurnAfterEveryPayer(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	for _, p := range []struct{ id, name string }{{"a", "Alice"}, {"b", "Bob"}, {"c", "Cara"}} {
		g.AddPlayer(p.id, p.name)
	}
	g.Configure(ModeClassic, 30)
	g.Start()
	b, c := g.Player("b"), g.Player("c")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$2M", Value: 2}}
	c.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$2M", Value: 2}}
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionBirthday, Name: "It's My Birthday", Value: 2})
	turnDeadline := g.DeadlineMS
	now = now.Add(8 * time.Second)
	if err := g.PlayAction("a", h[0].ID, ActionOptions{}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	now = now.Add(3 * time.Second)
	if err := g.Respond("b", false, []string{b.Bank[0].ID}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.Pending == nil {
		t.Fatal("the second payer should still be pending")
	}
	// The second payer responds after the first payment window has already
	// consumed time, but that response time must never eat into the turn.
	now = now.Add(4 * time.Second)
	if err := g.Respond("c", false, []string{c.Bank[0].ID}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	wantDeadline := turnDeadline + 7*1000
	if g.Pending != nil || g.DeadlineMS != wantDeadline {
		t.Fatalf("multi-payment should restore the original turn deadline: pending=%v deadline=%d want=%d", g.Pending != nil, g.DeadlineMS, wantDeadline)
	}
}

func TestPaymentPauseSurvivesJustSayNoRebound(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()
	b := g.Player("b")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	b.Hand = []Card{{ID: generateID(), Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4}}
	h := give(g, "a",
		Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 5},
		Card{Type: CardTypeAction, Action: ActionJustSayNo, Name: "Just Say No", Value: 4},
	)
	turnDeadline := g.DeadlineMS
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	now = now.Add(3 * time.Second)
	if err := g.Respond("b", true, nil); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	now = now.Add(4 * time.Second)
	if err := g.Respond("a", true, nil); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	now = now.Add(5 * time.Second)
	if err := g.Respond("b", false, []string{b.Bank[0].ID}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	if g.Pending != nil || g.DeadlineMS != turnDeadline+12*1000 {
		t.Fatalf("Just Say No rebound should pause as one payment: pending=%v deadline=%d want=%d", g.Pending != nil, g.DeadlineMS, turnDeadline+12*1000)
	}
}

func TestPaymentTimeoutResumesTurnAfterGraceWindow(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	g.AddPlayer("a", "Alice")
	g.AddPlayer("b", "Bob")
	g.Configure(ModeClassic, 30)
	g.Start()
	b := g.Player("b")
	b.Bank = []Card{{ID: generateID(), Type: CardTypeMoney, Name: "$5M", Value: 5}}
	h := give(g, "a", Card{Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 5})
	turnDeadline := g.DeadlineMS
	if err := g.PlayAction("a", h[0].ID, ActionOptions{TargetPlayerID: "b"}); err != nil {
		t.Fatal(err)
	}
	g.PostAction()
	now = now.Add(PaymentGraceSeconds * time.Second)
	if !g.Tick(now) {
		t.Fatal("payment grace timeout should resolve the debt")
	}
	if g.Pending != nil || g.DeadlineMS != turnDeadline+PaymentGraceSeconds*1000 {
		t.Fatalf("timeout should resume after the grace window: pending=%v deadline=%d want=%d", g.Pending != nil, g.DeadlineMS, turnDeadline+PaymentGraceSeconds*1000)
	}
}

func TestScheduledRandomStartRevealsBeforeFirstTurn(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	g := NewGame("t")
	g.SetClock(func() time.Time { return now })
	for _, p := range []struct{ id, name string }{{"a", "Alice"}, {"b", "Bob"}, {"c", "Cara"}} {
		g.AddPlayer(p.id, p.name)
	}
	if err := g.StartRandomScheduled(); err != nil {
		t.Fatal(err)
	}
	if len(g.StartSequence) != 3 || g.StartID == "" || g.StartAtMS != now.Add(StartRevealDelay).UnixMilli() {
		t.Fatalf("missing start reveal metadata: %+v", g)
	}
	if g.PlaysLeft != 0 || g.DeadlineKind != "starting" {
		t.Fatalf("the turn should be held during the reveal: plays=%d deadline=%q", g.PlaysLeft, g.DeadlineKind)
	}
	if g.Tick(now.Add(StartRevealDelay - time.Millisecond)) {
		t.Fatal("first turn started before the reveal ended")
	}
	if !g.Tick(now.Add(StartRevealDelay)) || g.StartAtMS != 0 || g.PlaysLeft != PlaysPerTurn {
		t.Fatalf("first turn did not start after reveal: at=%d plays=%d", g.StartAtMS, g.PlaysLeft)
	}
	if g.Players[g.CurrentTurn].ID != g.StartSequence[0] {
		t.Fatal("current turn does not match the wheel's first seat")
	}
}
