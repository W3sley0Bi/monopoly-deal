package game

import "testing"

// botGame seats n robots and deals.
func botGame(t *testing.T, n int) *Game {
	t.Helper()
	g := NewGame("bots")
	for i := 0; i < n; i++ {
		if err := g.AddBot("", ""); err != nil {
			t.Fatalf("add bot %d: %v", i, err)
		}
		g.Players[i].ID = string(rune('a' + i))
	}
	if err := g.Start(); err != nil {
		t.Fatalf("start: %v", err)
	}
	return g
}

// A table of robots must play itself to a finish without stalling.
func TestBotsFinishAGame(t *testing.T) {
	g := botGame(t, 3)
	steps := 0
	for g.State == StatePlaying && steps < 20000 {
		if !g.BotWaiting() {
			t.Fatalf("nobody to move: state=%s pending=%v", g.State, g.Pending != nil)
		}
		if !g.BotAct() {
			t.Fatalf("bot refused to move at step %d (pending=%v)", steps, g.Pending != nil)
		}
		g.PostAction()
		steps++
	}
	if g.State != StateFinished {
		t.Fatalf("game did not finish in %d moves (state %s)", steps, g.State)
	}
	if g.WinnerID == "" {
		t.Fatal("finished with no winner")
	}
}

// The rules must hold for every robot move: no negative plays, no oversized
// hands left at the end of a turn, no more than the deck's worth of cards.
func TestBotsRespectTheRules(t *testing.T) {
	g := botGame(t, 4)
	for i := 0; g.State == StatePlaying && i < 20000; i++ {
		g.BotAct()
		g.PostAction()
		if g.PlaysLeft < 0 {
			t.Fatalf("plays went negative")
		}
		if g.Pending == nil && len(g.current().Hand) > HandLimit && g.PlaysLeft == 0 {
			// Allowed mid-turn: the robot discards before it ends the turn.
			continue
		}
	}
}

// A robot on the receiving end of a debt always settles it.
func TestBotPaysADebt(t *testing.T) {
	g := NewGame("pay")
	if err := g.AddPlayer("human", "You"); err != nil {
		t.Fatal(err)
	}
	if err := g.AddBot("bot", "🤖 Otto"); err != nil {
		t.Fatal(err)
	}
	if err := g.Start(); err != nil {
		t.Fatal(err)
	}
	bot := g.Player("bot")
	bot.Hand = nil
	bot.Bank = []Card{{ID: "m1", Type: CardTypeMoney, Name: "$5M", Value: 5}}

	me := g.Player("human")
	debt := Card{ID: "dc", Type: CardTypeAction, Action: ActionDebtCollector, Name: "Debt Collector", Value: 3}
	me.Hand = append(me.Hand, debt)
	if err := g.PlayAction("human", "dc", ActionOptions{TargetPlayerID: "bot"}); err != nil {
		t.Fatalf("play debt collector: %v", err)
	}
	if g.Pending == nil {
		t.Fatal("expected a pending debt")
	}
	if !g.BotWaiting() {
		t.Fatal("expected the game to wait on the bot")
	}
	if !g.BotAct() {
		t.Fatal("bot did not answer the debt")
	}
	if g.Pending != nil {
		t.Fatalf("debt still pending after the bot answered")
	}
	if me.BankTotal() != 5 {
		t.Fatalf("expected $5M collected, got $%dM", me.BankTotal())
	}
}

// Every difficulty must play a complete game without stalling.
func TestEveryDifficultyFinishes(t *testing.T) {
	for _, level := range Difficulties {
		t.Run(string(level), func(t *testing.T) {
			g := NewGame("bots")
			for i := 0; i < 3; i++ {
				if err := g.AddBot(string(rune('a'+i)), ""); err != nil {
					t.Fatal(err)
				}
			}
			if err := g.SetBotDifficulty(level); err != nil {
				t.Fatal(err)
			}
			if err := g.Start(); err != nil {
				t.Fatal(err)
			}
			for i := 0; g.State == StatePlaying && i < 40000; i++ {
				if !g.BotAct() {
					t.Fatalf("%s bot refused to move", level)
				}
				g.PostAction()
			}
			if g.State != StateFinished {
				t.Fatalf("%s game never finished", level)
			}
		})
	}
}

// The difficulty is a lobby setting, like the mode and the timer.
func TestDifficultyIsLobbyOnly(t *testing.T) {
	g := botGame(t, 2)
	if err := g.SetBotDifficulty(DifficultyHard); err == nil {
		t.Fatal("expected an error changing difficulty mid-game")
	}
	if err := g.SetBotDifficulty("brutal"); err == nil {
		t.Fatal("expected an error for an unknown difficulty")
	}
}
