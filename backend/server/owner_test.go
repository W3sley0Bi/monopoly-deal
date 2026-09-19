package server

import (
	"testing"
	"time"

	"monopoly-deal-backend/game"
)

// Mid-game a leaver keeps their seat so they can come back, which used to keep
// them the host too: the table was stuck with an owner who was not there.
func TestHostLeavingMidGameHandsTableToAConnectedPlayer(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	a.send(ClientMessage{Type: MsgAddBot})
	a.room("bot seated", func(v RoomView) bool { return len(v.Game.Players) == 2 })
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })
	a.send(ClientMessage{Type: MsgStartGame})
	b.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })

	a.send(ClientMessage{Type: MsgLeaveRoom})
	v := b.room("host moved", func(v RoomView) bool { return v.OwnerID == "b" })
	if !v.IsOwner {
		t.Fatalf("Bob should host now: %+v", v)
	}
}

// A robot never hosts: with no other person connected, the table keeps its
// absent host rather than handing itself to a bot.
func TestHostNeverPassesToABot(t *testing.T) {
	srv, h := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgCreateRoom, Bots: 2, AutoStart: true})
	code := a.room("dealt", func(v RoomView) bool { return v.Game.State == game.StatePlaying }).ID
	a.send(ClientMessage{Type: MsgLeaveRoom})
	a.home("home", func(HomeView) bool { return true })

	h.mu.Lock()
	r := h.rooms[code]
	h.mu.Unlock()
	if r == nil {
		t.Fatal("the table should linger until its empty timeout")
	}
	done := make(chan string, 1)
	r.Do(func() {
		if p := r.Game.Player(r.OwnerID); p != nil && p.Bot {
			done <- r.OwnerID
			return
		}
		done <- ""
	})
	if bot := <-done; bot != "" {
		t.Fatalf("a robot became host: %q", bot)
	}
}

// Robots are not company: a table with nobody connected closes on its own,
// however many robots are still playing at it.
func TestBotOnlyTableClosesOnceEveryoneLeaves(t *testing.T) {
	restore := emptyRoomTTL
	emptyRoomTTL = 200 * time.Millisecond
	t.Cleanup(func() { emptyRoomTTL = restore })

	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	watcher := dial(t, srv, "w", "Wren")

	a.send(ClientMessage{Type: MsgCreateRoom, Bots: 2, AutoStart: true})
	a.room("dealt", func(v RoomView) bool { return v.Game.State == game.StatePlaying })
	watcher.home("listed", func(v HomeView) bool { return len(v.Rooms) == 1 })

	a.send(ClientMessage{Type: MsgLeaveRoom})
	watcher.home("closed", func(v HomeView) bool { return len(v.Rooms) == 0 })
}
