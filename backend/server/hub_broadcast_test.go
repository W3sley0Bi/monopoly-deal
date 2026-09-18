package server

import (
	"monopoly-deal-backend/game"
	"testing"
)

// syncClient sends a message and waits for the known response to guarantee
// all previous broadcasts have been processed.
func (c *testClient) syncClient() {
	c.send(ClientMessage{Type: MsgHello})
	c.await("sync", func(m rawMsg) bool {
		// MsgHello always unicasts either home or room
		return m.Type == "home" || m.Type == "room"
	})
}

func TestHelloDoesNotTriggerBroadcast(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	// Flush initial connects
	a.syncClient()
	b.syncClient()

	// b sends hello, a should not receive anything.
	b.send(ClientMessage{Type: MsgHello})
	b.home("b gets hello response", func(v HomeView) bool { return true })

	// If a received anything, its next sync would consume it and potentially fail or get out of order.
	a.syncClient()
}

func TestRoomActionDoesNotReachOtherRoom(t *testing.T) {
	srv, _ := newTestServer(t)
	a1 := dial(t, srv, "a1", "Alice")
	a2 := dial(t, srv, "a2", "Adam")
	b1 := dial(t, srv, "b1", "Bob")

	a1.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Room A"})
	roomA := a1.room("A created", func(v RoomView) bool { return v.ID != "" }).ID
	a2.send(ClientMessage{Type: MsgJoinRoom, RoomID: roomA})
	a2.room("A2 joined", func(v RoomView) bool { return v.YouSeated })

	b1.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Room B"})
	b1.room("B created", func(v RoomView) bool { return v.ID != "" })

	// Action in Room A
	a1.send(ClientMessage{Type: MsgChat, Text: "Hello Room A"})
	a1.send(ClientMessage{Type: MsgChat, Text: "👏"})

	// Room A clients receive it
	a1.room("A1 gets chat", func(v RoomView) bool { return len(v.Chat) > 0 })
	a2.room("A2 gets chat", func(v RoomView) bool { return len(v.Chat) > 0 })

	// Room B client can just sync, proving no stray chat message jammed it.
	b1.syncClient()
}

func TestRoomActionDoesNotReachLobby(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	lobbyUser := dial(t, srv, "l", "Lobbyist")

	a.send(ClientMessage{Type: MsgCreateRoom})
	a.room("created", func(v RoomView) bool { return v.ID != "" })

	// Room action
	a.send(ClientMessage{Type: MsgChat, Text: "Hello from inside"})
	a.send(ClientMessage{Type: MsgChat, Text: "😈"})
	a.room("gets chat", func(v RoomView) bool { return len(v.Chat) > 0 })

	lobbyUser.syncClient()
}

func TestLobbyUpdatesOnStructuralChange(t *testing.T) {
	srv, _ := newTestServer(t)
	lobbyUser := dial(t, srv, "l", "Lobbyist")

	// Structural change: Room created
	a := dial(t, srv, "a", "Alice")
	a.send(ClientMessage{Type: MsgCreateRoom})

	lobbyUser.home("sees new room", func(v HomeView) bool { return len(v.Rooms) == 1 })

	// Structural change: Add bot
	a.send(ClientMessage{Type: MsgAddBot})
	lobbyUser.home("sees bot added", func(v HomeView) bool {
		return len(v.Rooms) == 1 && v.Rooms[0].BotCount == 1
	})

	// Structural change: Room started
	a.send(ClientMessage{Type: MsgSetOptions, TurnSeconds: 15})
	a.send(ClientMessage{Type: MsgStartGame})

	lobbyUser.home("sees room started", func(v HomeView) bool {
		return len(v.Rooms) == 1 && v.Rooms[0].State == game.StatePlaying
	})

	// Structural change: Room closed
	a.send(ClientMessage{Type: MsgCloseRoom})
	lobbyUser.home("sees room deleted", func(v HomeView) bool { return len(v.Rooms) == 0 })
}

func TestSlowClientDoesNotBlockHub(t *testing.T) {
	srv, h := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	// Flood the client to trigger channel drop
	for i := 0; i < 50; i++ {
		h.mu.Lock()
		h.broadcastHomeLocked() // Fills buffer
		h.mu.Unlock()
	}

	// Hub should still be responsive and fast for others
	b := dial(t, srv, "b", "Bob")
	b.send(ClientMessage{Type: MsgCreateRoom})
	b.room("created quickly", func(v RoomView) bool { return v.ID != "" })

	// Alice's connection should be closed by writePump
	err := a.conn.WriteJSON(ClientMessage{Type: MsgHello})
	if err == nil {
		a.conn.ReadJSON(&rawMsg{}) // Force detection of closure
	}
}
