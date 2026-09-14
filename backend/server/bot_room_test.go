package server

import (
	"testing"
	"time"

	"monopoly-deal-backend/game"
)

// Opening a practice table seats the robots and deals in one go.
func TestSoloTableDealsWithBots(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Practice", Bots: 2, AutoStart: true})
	v := a.room("practice dealt", func(v RoomView) bool {
		return v.Name == "Practice" && v.Game.State == game.StatePlaying
	})

	if len(v.Game.Players) != 3 {
		t.Fatalf("expected 3 seats, got %d", len(v.Game.Players))
	}
	bots := 0
	for _, p := range v.Game.Players {
		if p.Bot {
			bots++
		}
	}
	if bots != 2 {
		t.Fatalf("expected 2 robots, got %d", bots)
	}
	if v.OwnerID != "a" {
		t.Fatalf("the human should host the table, got %q", v.OwnerID)
	}
	if v.Game.Players[v.Game.CurrentTurn].HandCount != game.StartingHand+game.TurnDraw {
		t.Fatalf("the starting player was not dealt a full opening hand: %d cards", v.Game.Players[v.Game.CurrentTurn].HandCount)
	}
}

// The robots keep the game moving on their own once the human ends a turn.
func TestBotsPlayTheirTurns(t *testing.T) {
	restore := botMoveDelay
	botMoveDelay = 10 * time.Millisecond
	t.Cleanup(func() { botMoveDelay = restore })

	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Practice", Bots: 1, AutoStart: true})
	a.room("dealt", func(v RoomView) bool { return v.Game.State == game.StatePlaying && v.Game.StartsAtMS != 0 })
	// Wait for the authoritative reveal to finish, then end the human's turn
	// regardless of which seat the random order selected.
	a.room("reveal finished", func(v RoomView) bool {
		if v.Game.StartsAtMS != 0 {
			return false
		}
		return v.Game.Players[v.Game.CurrentTurn].ID == "a"
	})

	a.send(ClientMessage{Type: MsgEndTurn})
	// The robot should take its turn and hand play straight back.
	v := a.room("robot played and passed back", func(v RoomView) bool {
		return v.Game.Players[v.Game.CurrentTurn].ID == "a" && len(v.Game.Log) > 3
	})
	if v.Game.Players[1].HandCount == 0 && v.Game.Players[1].AssetTotal == 0 {
		t.Fatal("the robot ended its turn having done nothing at all")
	}
}

// Robots can be added and removed from a normal table, host only.
func TestBotSeatsAreHostOnly(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Table"})
	v := a.room("created", func(v RoomView) bool { return v.Name == "Table" })
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: v.ID})
	b.room("joined", func(v RoomView) bool { return v.YouSeated })

	b.send(ClientMessage{Type: MsgAddBot})
	if msg := b.expectError("non-host adds a bot"); msg == "" {
		t.Fatal("expected an error for a non-host")
	}

	a.send(ClientMessage{Type: MsgAddBot})
	a.room("bot seated", func(v RoomView) bool { return len(v.Game.Players) == 3 })

	a.send(ClientMessage{Type: MsgRemoveBot})
	a.room("bot gone", func(v RoomView) bool { return len(v.Game.Players) == 2 })
}

// The host sets the robot difficulty, in the lobby, and everyone sees it.
func TestBotDifficultyIsATableSetting(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Table", Bots: 1, BotDifficulty: game.DifficultyHard})
	v := a.room("created hard", func(v RoomView) bool { return v.Name == "Table" })
	if v.Game.BotDifficulty != game.DifficultyHard {
		t.Fatalf("expected hard, got %q", v.Game.BotDifficulty)
	}

	a.send(ClientMessage{Type: MsgSetOptions, Mode: v.Game.Mode, BotDifficulty: game.DifficultyEasy})
	a.room("now easy", func(v RoomView) bool { return v.Game.BotDifficulty == game.DifficultyEasy })

	a.send(ClientMessage{Type: MsgSetOptions, BotDifficulty: "brutal"})
	if msg := a.expectError("unknown difficulty"); msg == "" {
		t.Fatal("expected an error for an unknown difficulty")
	}
}

// Errors reach the client with a translation key, not just English prose.
func TestErrorsCarryTranslationKeys(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgJoinRoom, RoomID: "ZZZZ"})
	m := a.await("join error", func(m rawMsg) bool { return m.Type == "error" })
	if m.ErrorKey != "err.no_such_table" {
		t.Fatalf("expected err.no_such_table, got %q (%q)", m.ErrorKey, m.Error)
	}
}
