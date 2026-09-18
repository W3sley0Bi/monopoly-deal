package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"monopoly-deal-backend/game"
)

type rawMsg struct {
	Type     string          `json:"type"`
	Error    string          `json:"error"`
	ErrorKey string          `json:"error_key"`
	Payload  json.RawMessage `json:"payload"`
}

type testClient struct {
	t    *testing.T
	conn *websocket.Conn
	id   string
	name string
}

func newTestServer(t *testing.T) (*httptest.Server, *Hub) {
	t.Helper()
	h := NewHub()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", h.HandleConnections)
	srv := httptest.NewServer(mux)
	t.Cleanup(func() {
		srv.Close()
		h.Close()
	})
	return srv, h
}

func dial(t *testing.T, srv *httptest.Server, id, name string) *testClient {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	c := &testClient{t: t, conn: conn, id: id, name: name}
	c.send(ClientMessage{Type: MsgHello})
	return c
}

func (c *testClient) send(m ClientMessage) {
	c.t.Helper()
	m.PlayerID = c.id
	if m.PlayerName == "" {
		m.PlayerName = c.name
	}
	if err := c.conn.WriteJSON(m); err != nil {
		c.t.Fatalf("write: %v", err)
	}
}

// await returns the first message satisfying pred, or fails.
func (c *testClient) await(what string, pred func(rawMsg) bool) rawMsg {
	c.t.Helper()
	// Normal starts include a 4.5s authoritative reveal window.
	deadline := time.Now().Add(15 * time.Second)
	for {
		if err := c.conn.SetReadDeadline(deadline); err != nil {
			c.t.Fatal(err)
		}
		var m rawMsg
		if err := c.conn.ReadJSON(&m); err != nil {
			c.t.Fatalf("waiting for %s: %v", what, err)
		}
		if pred(m) {
			return m
		}
	}
}

func (c *testClient) home(what string, pred func(HomeView) bool) HomeView {
	c.t.Helper()
	var out HomeView
	c.await(what, func(m rawMsg) bool {
		if m.Type != "home" {
			return false
		}
		var v HomeView
		if json.Unmarshal(m.Payload, &v) != nil {
			return false
		}
		if pred(v) {
			out = v
			return true
		}
		return false
	})
	return out
}

func (c *testClient) room(what string, pred func(RoomView) bool) RoomView {
	c.t.Helper()
	var out RoomView
	c.await(what, func(m rawMsg) bool {
		if m.Type != "room" {
			return false
		}
		var v RoomView
		if json.Unmarshal(m.Payload, &v) != nil {
			return false
		}
		if pred(v) {
			out = v
			return true
		}
		return false
	})
	return out
}

func (c *testClient) expectError(what string) string {
	c.t.Helper()
	m := c.await(what, func(m rawMsg) bool { return m.Type == "error" })
	return m.Error
}

func TestCreateRoomRejectsExcessiveBotCount(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "p1", "Ana")
	a.home("initial home", func(HomeView) bool { return true })
	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "bots", Bots: game.MaxPlayers})
	m := a.await("bad bot count", func(m rawMsg) bool { return m.Type == "error" })
	if m.ErrorKey != "err.bad_bot_count" {
		t.Fatalf("error key = %q, want err.bad_bot_count", m.ErrorKey)
	}

	a.send(ClientMessage{Type: MsgHello})
	v := a.home("still at home", func(HomeView) bool { return true })
	if len(v.Rooms) != 0 {
		t.Fatalf("bad create request made %d rooms", len(v.Rooms))
	}
}

func TestCreateRoomMakesCreatorOwner(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Friday Night"})
	v := a.room("room created", func(v RoomView) bool { return v.Name == "Friday Night" })

	if !v.IsOwner || v.OwnerID != "a" {
		t.Fatalf("creator should own the table: %+v", v)
	}
	if !v.YouSeated || len(v.Game.Players) != 1 {
		t.Fatal("creator should be seated")
	}
	if v.SeatsFree != game.MaxPlayers-1 {
		t.Fatalf("seats free = %d", v.SeatsFree)
	}
	if len(v.ID) != 4 {
		t.Fatalf("expected a 4-character table code, got %q", v.ID)
	}
}

func TestRoomAppearsOnHomeForOthers(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Table One"})
	v := b.home("room listed", func(v HomeView) bool { return len(v.Rooms) == 1 })

	r := v.Rooms[0]
	if r.Name != "Table One" || r.OwnerName != "Alice" || r.State != game.StateWaiting {
		t.Fatalf("unexpected summary: %+v", r)
	}
	if r.YouSeated || r.YouSpectating {
		t.Fatal("Bob is not in that room yet")
	}
}

func TestPrivateRoomIsHiddenButJoinableByCode(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Secret", Private: true})
	created := a.room("private room created", func(v RoomView) bool { return v.Name == "Secret" })
	if !created.Private || created.InviteCode != created.ID {
		t.Fatalf("private room should expose its invite code only to room members: %+v", created)
	}
	v := b.home("private room hidden", func(v HomeView) bool {
		for _, r := range v.Rooms {
			if r.ID == created.ID {
				return false
			}
		}
		return true
	})
	for _, r := range v.Rooms {
		if r.ID == created.ID {
			t.Fatal("private room leaked into the public browser")
		}
	}
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: strings.ToLower(created.ID)})
	joined := b.room("private room joined by code", func(v RoomView) bool { return v.ID == created.ID && v.YouSeated })
	if joined.Private != true || len(joined.Game.Players) != 2 {
		t.Fatalf("exact-code join should enter the private room: %+v", joined)
	}
}

func TestOnlyOwnerStartsAndConfigures(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID

	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("joined", func(v RoomView) bool { return v.YouSeated })

	b.send(ClientMessage{Type: MsgSetOptions, Mode: game.ModeDeathmatch})
	if err := b.expectError("options rejected"); !strings.Contains(err, "owner") {
		t.Fatalf("unexpected error: %q", err)
	}
	b.send(ClientMessage{Type: MsgStartGame})
	if err := b.expectError("start rejected"); !strings.Contains(err, "owner") {
		t.Fatalf("unexpected error: %q", err)
	}

	a.send(ClientMessage{Type: MsgSetOptions, Mode: game.ModeDeathmatch, TurnSeconds: 60})
	a.room("options applied", func(v RoomView) bool {
		return v.Game.Mode == game.ModeDeathmatch && v.Game.TurnSeconds == 60
	})

	a.send(ClientMessage{Type: MsgStartGame})
	v := a.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })
	if v.Game.DeadlineMS == 0 {
		t.Fatal("a 60s turn timer should produce a deadline")
	}
	if v.Game.Players[v.Game.CurrentTurn].HandCount != game.StartingHand+game.TurnDraw {
		t.Fatalf("starting player should hold 5 dealt + 2 drawn cards, got %d", v.Game.Players[v.Game.CurrentTurn].HandCount)
	}
}

func TestGoldenRushRejectedOverTheWire(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	a.send(ClientMessage{Type: MsgCreateRoom})
	a.room("created", func(v RoomView) bool { return v.ID != "" })

	a.send(ClientMessage{Type: MsgSetOptions, Mode: game.ModeGoldenRush})
	if err := a.expectError("golden rush locked"); !strings.Contains(err, "not available") {
		t.Fatalf("unexpected error: %q", err)
	}
}

func TestLateJoinerSpectatesThenGetsSeatNextGame(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")
	c := dial(t, srv, "c", "Cara")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })
	a.send(ClientMessage{Type: MsgStartGame})
	a.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })

	// Joining a running table lands you in the audience.
	c.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	v := c.room("spectating", func(v RoomView) bool { return len(v.Spectators) == 1 })
	if v.YouSeated {
		t.Fatal("late joiner should not be seated")
	}
	if v.Game.Players[0].Hand != nil {
		t.Fatal("spectators must not receive anyone's hand")
	}

	// Asking for a seat queues you up.
	c.send(ClientMessage{Type: MsgRequestSeat})
	c.room("queued", func(v RoomView) bool { return v.YouRequested })

	// Playing is refused while spectating.
	c.send(ClientMessage{Type: MsgEndTurn})
	if err := c.expectError("spectator blocked"); !strings.Contains(err, "spectators cannot play") {
		t.Fatalf("unexpected error: %q", err)
	}

	// Once the game ends, the queue is seated automatically.
	a.send(ClientMessage{Type: MsgTerminate})
	seated := c.room("auto seated", func(v RoomView) bool { return v.YouSeated })
	if len(seated.Game.Players) != 3 || seated.YouRequested {
		t.Fatalf("expected Cara seated and dequeued: %+v", seated)
	}
}

func TestAnyPlayerCanTerminate(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })
	a.send(ClientMessage{Type: MsgStartGame})
	b.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })

	// Not the owner, but still a player.
	b.send(ClientMessage{Type: MsgTerminate})
	v := b.room("terminated", func(v RoomView) bool { return v.Game.State == game.StateWaiting })
	if len(v.Game.Players) != 2 {
		t.Fatal("terminating keeps everyone seated")
	}
}

func TestLeaveRoomFreesSeatAndMovesOwner(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return len(v.Game.Players) == 2 })

	a.send(ClientMessage{Type: MsgLeaveRoom})
	v := b.room("owner moved", func(v RoomView) bool { return v.OwnerID == "b" })
	if len(v.Game.Players) != 1 || !v.IsOwner {
		t.Fatalf("Bob should be the sole owner-player: %+v", v)
	}
	a.home("back home", func(v HomeView) bool { return len(v.Rooms) == 1 })
}

func TestKickRemovesPlayerBeforeStart(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	a.room("bob seated", func(v RoomView) bool { return len(v.Game.Players) == 2 })

	a.send(ClientMessage{Type: MsgKick, TargetPlayerID: "b"})
	a.room("bob gone", func(v RoomView) bool { return len(v.Game.Players) == 1 })
	b.home("kicked home", func(v HomeView) bool { return len(v.Rooms) == 1 })

	a.send(ClientMessage{Type: MsgKick, TargetPlayerID: "a"})
	if err := a.expectError("self kick"); !strings.Contains(err, "someone else") {
		t.Fatalf("unexpected error: %q", err)
	}
}

func TestReconnectKeepsSeatMidGame(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })
	a.send(ClientMessage{Type: MsgStartGame})
	a.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })

	b.conn.Close()
	b2 := dial(t, srv, "b", "Bob")
	b2.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	v := b2.room("reseated", func(v RoomView) bool { return v.YouSeated })
	if v.Game.State != game.StatePlaying {
		t.Fatal("the game should still be running after a refresh")
	}
	if len(v.Game.Players) != 2 {
		t.Fatal("seat should have been held")
	}
}

func TestNameRequiredBeforeCreating(t *testing.T) {
	srv, _ := newTestServer(t)
	url := "ws" + strings.TrimPrefix(srv.URL, "http") + "/ws"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	if err := conn.WriteJSON(ClientMessage{Type: MsgCreateRoom, PlayerID: "x"}); err != nil {
		t.Fatal(err)
	}
	c := &testClient{t: t, conn: conn, id: "x"}
	if err := c.expectError("name required"); !strings.Contains(err, "name") {
		t.Fatalf("unexpected error: %q", err)
	}
}

func TestUnknownTableCode(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	a.send(ClientMessage{Type: MsgJoinRoom, RoomID: "zzzz"})
	if err := a.expectError("bad code"); !strings.Contains(err, "no table") {
		t.Fatalf("unexpected error: %q", err)
	}
}

func TestChatReachesEveryoneInTheRoom(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })

	a.send(ClientMessage{Type: MsgChat, Text: "👏"})
	v := b.room("chat seen", func(v RoomView) bool { return len(v.Chat) > 0 })

	m := v.Chat[len(v.Chat)-1]
	if m.Text != "👏" {
		t.Fatalf("text should be emoji, got %q", m.Text)
	}
	if m.Name != "Alice" || m.PlayerID != "a" || m.System {
		t.Fatalf("unexpected author: %+v", m)
	}
	if m.AtMS == 0 {
		t.Fatal("chat should be timestamped")
	}

	// Empty messages are dropped rather than echoed.
	a.send(ClientMessage{Type: MsgChat, Text: "   "})
	a.send(ClientMessage{Type: MsgChat, Text: "😈"})
	v2 := a.room("second message", func(v RoomView) bool {
		return len(v.Chat) > 0 && v.Chat[len(v.Chat)-1].Text == "😈"
	})
	if len(v2.Chat) != 2 {
		t.Fatalf("expected 2 chat lines, got %d", len(v2.Chat))
	}
}

func TestSpectatorsCanChat(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")
	c := dial(t, srv, "c", "Cara")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	b.room("seated", func(v RoomView) bool { return v.YouSeated })
	a.send(ClientMessage{Type: MsgStartGame})
	a.room("started", func(v RoomView) bool { return v.Game.State == game.StatePlaying })

	c.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	c.room("watching", func(v RoomView) bool { return !v.YouSeated })
	c.send(ClientMessage{Type: MsgChat, Text: "😂"})
	a.room("spectator chat", func(v RoomView) bool {
		return len(v.Chat) > 0 && v.Chat[len(v.Chat)-1].Text == "😂"
	})
}

func TestOwnerClosesTableAndEvictsEveryone(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Alice's table"})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	a.room("bob seated", func(v RoomView) bool { return len(v.Game.Players) == 2 })

	a.send(ClientMessage{Type: MsgCloseRoom, RoomID: code})
	a.home("table gone", func(v HomeView) bool { return len(v.Rooms) == 0 })
	b.home("bob evicted", func(v HomeView) bool { return len(v.Rooms) == 0 })
}

func TestNonOwnerCannotCloseOccupiedTable(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	h := b.home("sees table", func(v HomeView) bool { return len(v.Rooms) == 1 })
	if h.Rooms[0].YouMayClose {
		t.Fatalf("Bob should not be offered a close button: %+v", h.Rooms[0])
	}

	b.send(ClientMessage{Type: MsgCloseRoom, RoomID: code})
	if err := b.expectError("close refused"); !strings.Contains(err, "close that table") {
		t.Fatalf("unexpected error: %q", err)
	}
	a.send(ClientMessage{Type: MsgHello})
	a.room("still open", func(v RoomView) bool { return v.ID == code })
}

func TestAnyoneClosesAbandonedTable(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")
	c := dial(t, srv, "c", "Cara")

	a.send(ClientMessage{Type: MsgCreateRoom})
	code := a.room("created", func(v RoomView) bool { return v.ID != "" }).ID
	b.send(ClientMessage{Type: MsgJoinRoom, RoomID: code})
	a.room("bob seated", func(v RoomView) bool { return len(v.Game.Players) == 2 })
	a.send(ClientMessage{Type: MsgStartGame})
	a.room("dealt", func(v RoomView) bool { return v.Game.State == "playing" })

	// Both players close their laptops mid-game: the seats stay parked, so the
	// table survives with nobody connected to it until the TTL runs out.
	a.conn.Close()
	b.conn.Close()
	h := c.home("abandoned", func(v HomeView) bool {
		return len(v.Rooms) == 1 && v.Rooms[0].Abandoned
	})
	if !h.Rooms[0].YouMayClose {
		t.Fatalf("an abandoned table should be closable by anyone: %+v", h.Rooms[0])
	}

	c.send(ClientMessage{Type: MsgCloseRoom, RoomID: code})
	c.home("table gone", func(v HomeView) bool { return len(v.Rooms) == 0 })
}

func TestConcurrentRooms(t *testing.T) {
	srv, _ := newTestServer(t)

	// Create 3 players and 3 rooms
	a := dial(t, srv, "a", "Alice")
	b := dial(t, srv, "b", "Bob")
	c := dial(t, srv, "c", "Cara")

	a.send(ClientMessage{Type: MsgCreateRoom, Bots: 2})
	a.room("roomA", func(v RoomView) bool { return v.ID != "" })

	b.send(ClientMessage{Type: MsgCreateRoom, Bots: 2})
	b.room("roomB", func(v RoomView) bool { return v.ID != "" })

	c.send(ClientMessage{Type: MsgCreateRoom, Bots: 2})
	c.room("roomC", func(v RoomView) bool { return v.ID != "" })

	// Flood chat messages concurrently to all rooms
	done := make(chan bool)
	flood := func(client *testClient) {
		for i := 0; i < 50; i++ {
			client.send(ClientMessage{Type: MsgChat, Text: "spam"})
			client.send(ClientMessage{Type: MsgChat, Text: "👏"})
		}
		done <- true
	}

	go flood(a)
	go flood(b)
	go flood(c)

	for i := 0; i < 3; i++ {
		<-done
	}
	// The race detector implicitly verifies safety. We just wait to ensure it didn't panic.
}

// A table whose action queue is full must only hold up the connection that
// submits to it. Room.Do used to run under h.mu, so one busy table froze the
// hub for every player, including ones who were never at it.
func TestFullRoomQueueDoesNotHoldTheHub(t *testing.T) {
	srv, h := newTestServer(t)
	a := dial(t, srv, "a", "Alice")
	a.home("initial home", func(HomeView) bool { return true })
	// Private keeps the table out of home summaries, which take the room's
	// state lock that the parked action below holds.
	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "Busy", Private: true})
	v := a.room("room created", func(RoomView) bool { return true })

	h.mu.Lock()
	r := h.rooms[v.ID]
	h.mu.Unlock()

	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	unpark := func() { once.Do(func() { close(release) }) }
	t.Cleanup(unpark)
	r.Do(func() {
		close(started)
		<-release
	})
	<-started
	for i := 0; i < cap(r.actions); i++ {
		r.Do(func() {})
	}

	// Leaving submits a detach to the full queue, so a's reader blocks.
	a.send(ClientMessage{Type: MsgLeaveRoom})
	time.Sleep(50 * time.Millisecond)

	got := make(chan bool, 1)
	go func() {
		deadline := time.Now().Add(2 * time.Second)
		for time.Now().Before(deadline) {
			if h.mu.TryLock() {
				h.mu.Unlock()
				got <- true
				return
			}
			time.Sleep(5 * time.Millisecond)
		}
		got <- false
	}()
	if !<-got {
		t.Fatal("hub lock held while a room's action queue is full")
	}

	// And a real connection gets through end to end.
	b := dial(t, srv, "b", "Bea")
	if err := b.conn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		t.Fatal(err)
	}
	var m rawMsg
	if err := b.conn.ReadJSON(&m); err != nil || m.Type != "home" {
		t.Fatalf("second player blocked by a busy table: %v %+v", err, m)
	}

	unpark()
	a.home("a back home once the table drains", func(HomeView) bool { return true })
}
