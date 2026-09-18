package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand/v2"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"monopoly-deal-backend/game"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // local network play
}

// emptyRoomTTL keeps a table alive briefly after everyone drops, so a page
// refresh does not destroy a game in progress.
const emptyRoomTTL = 90 * time.Second

// botMoveDelay paces robot moves so a human can follow what they did. Tests
// shorten it so a whole robot turn fits inside a read deadline.
var botMoveDelay = 1100 * time.Millisecond

// WebSocket keepalive and per-connection writer configuration.
const (
	pingInterval   = 30 * time.Second
	pongWait       = 45 * time.Second
	writeWait      = 10 * time.Second
	sendChSize     = 16
	maxMessageSize = 4096
)

// Client is one websocket connection.
type Client struct {
	conn *websocket.Conn

	sendCh    chan []byte
	done      chan struct{}
	closeOnce sync.Once

	playerID string
	name     string
	roomID   string
}

func (c *Client) send(msg ServerMessage) error {
	b, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	select {
	case c.sendCh <- b:
		return nil
	case <-c.done:
		return errors.New("client stopped")
	default:
		c.stop()
		return errors.New("client write channel full")
	}
}

func (c *Client) stop() {
	c.closeOnce.Do(func() {
		close(c.done)
		c.conn.Close()
	})
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingInterval)
	defer func() {
		ticker.Stop()
		c.stop()
	}()

	for {
		select {
		case b, ok := <-c.sendCh:
			if !ok {
				return
			}
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage, b); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-c.done:
			return
		}
	}
}

// Hub owns every room and connection. One mutex guards all of it; the game
// logic is cheap and this keeps the state impossible to tear.
type Hub struct {
	mu      sync.Mutex
	rooms   map[string]*Room
	order   []string
	clients map[*Client]struct{}
	stop    chan struct{}
	// pending holds direct messages queued while the lock is held.
	pending []outbound
}

func NewHub() *Hub {
	h := &Hub{
		rooms:   map[string]*Room{},
		clients: map[*Client]struct{}{},
		stop:    make(chan struct{}),
	}
	go h.loop()
	return h
}

// Close stops the background ticker.
func (h *Hub) Close() { close(h.stop) }

// outbound is one pending websocket write.
type outbound struct {
	c   *Client
	msg ServerMessage
}

func (h *Hub) loop() {
	t := time.NewTicker(500 * time.Millisecond)
	defer t.Stop()
	for {
		select {
		case <-h.stop:
			return
		case now := <-t.C:
			h.mu.Lock()
			homeChanged := false
			var batch []outbound

			for _, id := range append([]string{}, h.order...) {
				r := h.rooms[id]
				if r == nil {
					continue
				}

				roomChanged := false
				wasLive := h.roomClientCountLocked(id)
				wasHash := r.summaryHash

				if r.Game.Tick(now) {
					r.absorbRequests()
					roomChanged = true
				}
				if h.stepBotsLocked(r, now) {
					roomChanged = true
				}

				if wasLive == 0 {
					if r.emptySince.IsZero() {
						r.emptySince = now
					} else if now.Sub(r.emptySince) > emptyRoomTTL {
						h.deleteRoomLocked(id)
						homeChanged = true
						continue // room deleted
					}
				} else {
					r.emptySince = time.Time{}
				}

				if roomChanged {
					batch = append(batch, h.broadcastRoomLocked(r)...)
				}
				
				newHash := r.computeSummaryHash(wasLive)
				if newHash != wasHash {
					r.summaryHash = newHash
					homeChanged = true
				}
			}

			if homeChanged {
				batch = append(batch, h.broadcastHomeLocked()...)
			}
			batch = append(batch, h.flushPendingLocked()...)
			h.mu.Unlock()
			deliver(batch)
		}
	}
}

// stepBotsLocked lets the robot the game is waiting on make one move, no
// faster than botMoveDelay so the table reads like a real opponent thinking.
func (h *Hub) stepBotsLocked(r *Room, now time.Time) bool {
	if !r.Game.BotWaiting() {
		r.botAt = time.Time{}
		return false
	}
	if r.botAt.IsZero() {
		r.botAt = now.Add(botMoveDelay)
		return false
	}
	if now.Before(r.botAt) {
		return false
	}
	moved := r.Game.BotAct()
	r.botAt = now.Add(botMoveDelay)
	if moved {
		r.Game.PostAction()
		r.absorbRequests()
	}
	return moved
}

func (h *Hub) roomClientCountLocked(roomID string) int {
	n := 0
	for c := range h.clients {
		if c.roomID == roomID {
			n++
		}
	}
	return n
}

// roomClientCountsLocked counts connections per table in one pass.
func (h *Hub) roomClientCountsLocked() map[string]int {
	counts := make(map[string]int, len(h.rooms))
	for c := range h.clients {
		if c.roomID != "" {
			counts[c.roomID]++
		}
	}
	return counts
}

func (h *Hub) deleteRoomLocked(roomID string) {
	delete(h.rooms, roomID)
	kept := h.order[:0]
	for _, id := range h.order {
		if id != roomID {
			kept = append(kept, id)
		}
	}
	h.order = kept
	for c := range h.clients {
		if c.roomID == roomID {
			c.roomID = ""
		}
	}
}

func (h *Hub) newRoomIDLocked() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	for attempt := 0; ; attempt++ {
		code := make([]byte, 4)
		for i := range code {
			code[i] = alphabet[rand.IntN(len(alphabet))]
		}
		id := string(code)
		if _, taken := h.rooms[id]; !taken {
			return id
		}
		if attempt > 200 {
			return fmt.Sprintf("R%d", len(h.rooms)+1)
		}
	}
}

// HandleConnections upgrades a request and serves it until it drops.
func (h *Hub) HandleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("upgrade failed: %v", err)
		return
	}
	c := &Client{
		conn:   conn,
		sendCh: make(chan []byte, sendChSize),
		done:   make(chan struct{}),
	}

	conn.SetReadLimit(maxMessageSize)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	go c.writePump()

	h.mu.Lock()
	h.clients[c] = struct{}{}
	batch := []outbound{h.unicastLocked(c)}
	h.mu.Unlock()
	deliver(batch)

	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		roomID := c.roomID
		h.detachLocked(c)
		
		batch := append(h.flushPendingLocked(), h.broadcastHomeLocked()...)
		if roomID != "" {
			if r := h.rooms[roomID]; r != nil {
				batch = append(batch, h.broadcastRoomLocked(r)...)
			}
		}
		h.mu.Unlock()
		deliver(batch)
		c.stop()
	}()

	for {
		var msg ClientMessage
		if err := conn.ReadJSON(&msg); err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseNormalClosure,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
				websocket.CloseNoStatusReceived,
			) {
				log.Printf("read error: %v", err)
			}
			return
		}
		h.handle(c, msg)
	}
}

// detachLocked removes a client from its room, freeing or parking its seat.
func (h *Hub) detachLocked(c *Client) {
	if c.roomID == "" {
		return
	}
	r := h.rooms[c.roomID]
	roomID := c.roomID
	c.roomID = ""
	if r == nil {
		return
	}
	// Only give up the seat when no other connection holds the same identity.
	stillHere := false
	for other := range h.clients {
		if other != c && other.roomID == roomID && other.playerID == c.playerID {
			stillHere = true
			break
		}
	}
	if !stillHere {
		r.Game.Disconnect(c.playerID)
		delete(r.spectators, c.playerID)
		r.dropRequest(c.playerID)
		r.ensureOwner()
		r.absorbRequests()
		if r.Game.HumanPlayers() == 0 && h.roomClientCountLocked(roomID) == 0 {
			h.deleteRoomLocked(roomID)
		}
	}
}

func (h *Hub) handle(c *Client, msg ClientMessage) {
	h.mu.Lock()

	if c.playerID == "" && msg.PlayerID != "" {
		c.playerID = msg.PlayerID
	}
	if msg.PlayerName != "" {
		c.name = trimName(msg.PlayerName)
	}
	if c.playerID == "" {
		h.mu.Unlock()
		c.send(errorMessage(game.NewFault("err.missing_player_id", "missing player id")))
		return
	}

	var err error
	var notice ServerMessage

	oldRoomID := c.roomID

	switch msg.Type {
	case MsgHello:
		// Name and identity are already applied above.
	case MsgCreateRoom:
		err = h.createRoomLocked(c, msg)
	case MsgJoinRoom:
		err = h.joinRoomLocked(c, msg)
	case MsgLeaveRoom:
		h.detachLocked(c)
	case MsgCloseRoom:
		notice, err = h.closeRoomLocked(c, msg)
	default:
		err = h.handleRoomLocked(c, msg)
	}

	var batch []outbound
	if err == nil {
		activeRoomID := c.roomID
		if msg.Type == MsgLeaveRoom || msg.Type == MsgCloseRoom {
			activeRoomID = oldRoomID
		}

		if r := h.rooms[activeRoomID]; r != nil {
			r.Game.PostAction()
			r.absorbRequests()
			r.ensureOwner()
		}

		homeNeedsUpdate := false
		switch msg.Type {
		case MsgCreateRoom, MsgCloseRoom, MsgJoinRoom, MsgLeaveRoom:
			homeNeedsUpdate = true
		}

		if r := h.rooms[activeRoomID]; r != nil {
			newHash := r.computeSummaryHash(h.roomClientCountLocked(activeRoomID))
			if r.summaryHash != newHash {
				r.summaryHash = newHash
				homeNeedsUpdate = true
			}
		}

		batch = h.flushPendingLocked()
		if homeNeedsUpdate {
			batch = append(batch, h.broadcastHomeLocked()...)
		}
		
		if msg.Type == MsgHello {
			batch = append(batch, h.unicastLocked(c))
		} else if r := h.rooms[activeRoomID]; r != nil {
			batch = append(batch, h.broadcastRoomLocked(r)...)
		}
	} else {
		batch = append(h.flushPendingLocked(), h.unicastLocked(c))
	}
	h.mu.Unlock()

	if err != nil {
		_ = c.send(errorMessage(err))
	} else if notice.Type != "" {
		_ = c.send(notice)
	}
	deliver(batch)
}

func (h *Hub) createRoomLocked(c *Client, msg ClientMessage) error {
	if c.name == "" {
		return errNoName
	}
	h.detachLocked(c)

	name := trimRoomName(msg.RoomName)
	if name == "" {
		name = c.name + "'s table"
	}
	id := h.newRoomIDLocked()
	r := newRoom(id, name)
	r.Private = msg.Private
	if msg.Mode != "" || msg.TurnSeconds != 0 {
		mode := msg.Mode
		if mode == "" {
			mode = game.ModeClassic
		}
		if err := r.Game.Configure(mode, msg.TurnSeconds); err != nil {
			return err
		}
	}
	if msg.RespondSeconds != nil {
		if err := r.Game.SetRespondSeconds(*msg.RespondSeconds); err != nil {
			return err
		}
	}
	// Somebody working through the lessons is not looking for company, and a
	// scripted table is unjoinable anyway: keep it out of the browser.
	if r.Game.Mode == game.ModeTutorial {
		r.Private = true
	}
	if msg.BotDifficulty != "" {
		if err := r.Game.SetBotDifficulty(msg.BotDifficulty); err != nil {
			return err
		}
	}
	if err := r.Game.AddPlayer(c.playerID, c.name); err != nil {
		return err
	}
	r.OwnerID = c.playerID
	h.rooms[id] = r
	h.order = append(h.order, id)
	c.roomID = id

	for i := 0; i < msg.Bots; i++ {
		if err := h.addBotLocked(r); err != nil {
			break
		}
	}
	if msg.AutoStart && len(r.Game.Players) >= 2 {
		if err := r.Game.StartRandomScheduled(); err != nil {
			return err
		}
	}
	return nil
}

// addBotLocked seats one robot at a table.
func (h *Hub) addBotLocked(r *Room) error {
	return r.Game.AddBot(fmt.Sprintf("bot_%s_%d", r.ID, r.nextBot()), "")
}

func (h *Hub) joinRoomLocked(c *Client, msg ClientMessage) error {
	if c.name == "" {
		return errNoName
	}
	r := h.rooms[normalizeCode(msg.RoomID)]
	if r == nil {
		return game.NewFault("err.no_such_table", fmt.Sprintf("no table with code %q", msg.RoomID), "code", msg.RoomID)
	}
	if c.roomID != r.ID {
		h.detachLocked(c)
	}
	c.roomID = r.ID

	// Returning to a seat you already hold always wins.
	if r.isSeated(c.playerID) {
		return r.Game.AddPlayer(c.playerID, c.name)
	}
	seatable := !msg.AsSpectator && r.Game.State == game.StateWaiting && r.seatsFree() > 0
	if seatable {
		delete(r.spectators, c.playerID)
		return r.Game.AddPlayer(c.playerID, c.name)
	}
	r.spectators[c.playerID] = c.name
	return nil
}

// closeRoomLocked destroys a table from the home screen. The host can always
// close their own table; anyone can close one that nobody is connected to, so
// a table left behind by a closed laptop can be cleared without waiting out
// the empty-table timer.
func (h *Hub) closeRoomLocked(c *Client, msg ClientMessage) (ServerMessage, error) {
	id := normalizeCode(msg.RoomID)
	if id == "" {
		id = c.roomID
	}
	r := h.rooms[id]
	if r == nil {
		return ServerMessage{}, game.NewFault("err.no_such_table",
			fmt.Sprintf("no table with code %q", msg.RoomID), "code", msg.RoomID)
	}
	if c.playerID != r.OwnerID && h.roomClientCountLocked(id) > 0 {
		return ServerMessage{}, game.NewFault("err.close_host_only",
			fmt.Sprintf("only %s can close that table while people are at it", r.ownerName()),
			"host", r.ownerName())
	}

	// Tell whoever is still there why they landed back on the home screen.
	for other := range h.clients {
		if other.roomID == id && other != c {
			h.pending = append(h.pending, outbound{other, ServerMessage{
				Type:       "notice",
				Notice:     fmt.Sprintf("%q was closed.", r.Name),
				NoticeKey:  "notice.table_closed",
				NoticeArgs: map[string]any{"table": r.Name},
			}})
		}
	}
	name := r.Name
	h.deleteRoomLocked(id)
	log.Printf("table %s (%q) closed by %s", id, name, c.playerID)
	return ServerMessage{
		Type:       "notice",
		Notice:     fmt.Sprintf("Closed %q.", name),
		NoticeKey:  "notice.you_closed_table",
		NoticeArgs: map[string]any{"table": name},
	}, nil
}

// handleRoomLocked routes every message that needs a room.
func (h *Hub) handleRoomLocked(c *Client, msg ClientMessage) error {
	r := h.rooms[c.roomID]
	if r == nil {
		return game.NewFault("err.not_at_table", "you are not at a table")
	}
	g := r.Game
	owner := c.playerID == r.OwnerID

	switch msg.Type {
	case MsgSetOptions:
		if !owner {
			return errNotOwner
		}
		mode := msg.Mode
		if mode == "" {
			mode = g.Mode
		}
		if msg.BotDifficulty != "" {
			if err := g.SetBotDifficulty(msg.BotDifficulty); err != nil {
				return err
			}
		}
		if msg.RespondSeconds != nil {
			if err := g.SetRespondSeconds(*msg.RespondSeconds); err != nil {
				return err
			}
		}
		return g.Configure(mode, msg.TurnSeconds)

	case MsgStartGame:
		if !owner {
			return errNotOwner
		}
		return g.StartRandomScheduled()

	case MsgNewGame:
		if !owner {
			return errNotOwner
		}
		return g.Reset()

	case MsgTutorialNext:
		return g.TutorialNext(c.playerID)

	case MsgTerminate:
		if !r.isSeated(c.playerID) && !owner {
			return game.NewFault("err.end_seated_only", "only players at the table can end the game")
		}
		return g.Terminate(c.playerID)

	case MsgKick:
		if !owner {
			return errNotOwner
		}
		return h.kickLocked(r, msg.TargetPlayerID)

	case MsgTakeSeat:
		if g.State != game.StateWaiting {
			return game.NewFault("err.game_started_ask_seat", "the game has already started — ask for a seat instead")
		}
		if r.seatsFree() == 0 {
			return game.NewFault("err.table_full", "the table is full")
		}
		delete(r.spectators, c.playerID)
		r.dropRequest(c.playerID)
		return g.AddPlayer(c.playerID, c.name)

	case MsgRequestSeat:
		if r.isSeated(c.playerID) {
			return game.NewFault("err.already_seated", "you already have a seat")
		}
		r.addRequest(c.playerID, c.name)
		g.Announce("log.asked_for_seat", "name", c.name)
		return nil

	case MsgAddBot:
		if !owner {
			return errNotOwner
		}
		if r.seatsFree() == 0 {
			return game.NewFault("err.table_full", "the table is full")
		}
		return h.addBotLocked(r)

	case MsgRemoveBot:
		if !owner {
			return errNotOwner
		}
		return g.RemoveBot()

	case MsgCancelSeat:
		r.dropRequest(c.playerID)
		return nil

	case MsgChat:
		text := trimChat(msg.Text)
		if text == "" {
			return nil
		}
		r.say(c.playerID, c.name, text)
		return nil
	}

	// Everything below is a move, so it needs a seat.
	if !r.isSeated(c.playerID) {
		return game.NewFault("err.spectator", "spectators cannot play")
	}
	id := c.playerID

	switch msg.Type {
	case MsgPlayBank:
		return g.PlayToBank(id, msg.CardID)
	case MsgPlayProperty:
		return g.PlayProperty(id, msg.CardID, msg.Color)
	case MsgPlayAction:
		return g.PlayAction(id, msg.CardID, game.ActionOptions{
			Color:          msg.Color,
			TargetPlayerID: msg.TargetPlayerID,
			TargetCardID:   msg.TargetCardID,
			GiveCardID:     msg.GiveCardID,
			DoubleCardIDs:  msg.DoubleCardIDs,
		})
	case MsgMoveWildcard:
		return g.ReassignWildcard(id, msg.CardID, msg.Color)
	case MsgEndTurn:
		return g.EndTurn(id)
	case MsgRespond:
		return g.Respond(id, msg.SayNo, msg.CardIDs)
	}
	return game.NewFault("err.unknown_message", fmt.Sprintf("unknown message type %q", msg.Type), "type", msg.Type)
}

func (h *Hub) kickLocked(r *Room, targetID string) error {
	if targetID == "" || targetID == r.OwnerID {
		return game.NewFault("err.pick_someone_else", "pick someone else to remove")
	}
	seated := r.isSeated(targetID)
	_, watching := r.spectators[targetID]
	if !seated && !watching {
		return game.NewFault("err.not_at_this_table", "that person is not at this table")
	}
	if seated && r.Game.State != game.StateWaiting {
		return game.NewFault("err.remove_lobby_only", "players can only be removed before the game starts")
	}
	name := targetID
	if p := r.Game.Player(targetID); p != nil {
		name = p.Name
	} else if n, ok := r.spectators[targetID]; ok {
		name = n
	}

	r.Game.Remove(targetID)
	delete(r.spectators, targetID)
	r.dropRequest(targetID)
	r.Game.Announce("log.removed", "name", name)

	for c := range h.clients {
		if c.roomID == r.ID && c.playerID == targetID {
			c.roomID = ""
		}
	}
	r.ensureOwner()
	return nil
}

func (h *Hub) broadcastRoomLocked(r *Room) []outbound {
	var batch []outbound
	for c := range h.clients {
		if c.roomID == r.ID {
			batch = append(batch, outbound{c, ServerMessage{Type: "room", Payload: r.view(c.playerID)}})
		}
	}
	return batch
}

func (h *Hub) broadcastHomeLocked() []outbound {
	home := h.homeRoomsLocked()
	live := h.roomClientCountsLocked()
	var batch []outbound
	for c := range h.clients {
		if c.roomID == "" {
			rooms := make([]RoomSummary, 0, len(home))
			for _, r := range home {
				rooms = append(rooms, r.summary(c.playerID, live[r.ID]))
			}
			batch = append(batch, outbound{c, ServerMessage{Type: "home", Payload: HomeView{
				You:            c.playerID,
				Name:           c.name,
				Rooms:          rooms,
				Modes:          modeInfos(),
				TurnOptions:    game.TurnSecondOptions,
				RespondOptions: game.RespondSecondOptions,
				Difficulties:   game.Difficulties,
				MaxPlayers:     game.MaxPlayers,
			}}})
		}
	}
	return batch
}

func (h *Hub) unicastLocked(c *Client) outbound {
	if r := h.rooms[c.roomID]; r != nil {
		return outbound{c, ServerMessage{Type: "room", Payload: r.view(c.playerID)}}
	}
	home := h.homeRoomsLocked()
	live := h.roomClientCountsLocked()
	rooms := make([]RoomSummary, 0, len(home))
	for _, r := range home {
		rooms = append(rooms, r.summary(c.playerID, live[r.ID]))
	}
	return outbound{c, ServerMessage{Type: "home", Payload: HomeView{
		You:            c.playerID,
		Name:           c.name,
		Rooms:          rooms,
		Modes:          modeInfos(),
		TurnOptions:    game.TurnSecondOptions,
		RespondOptions: game.RespondSecondOptions,
		Difficulties:   game.Difficulties,
		MaxPlayers:     game.MaxPlayers,
	}}}
}

func (h *Hub) flushPendingLocked() []outbound {
	batch := h.pending
	h.pending = nil
	return batch
}

func (h *Hub) homeRoomsLocked() []*Room {
	out := make([]*Room, 0, len(h.order))
	for _, id := range h.order {
		if r := h.rooms[id]; r != nil {
			if r.Private {
				continue
			}
			out = append(out, r)
		}
	}
	return out
}

func deliver(batch []outbound) {
	for _, b := range batch {
		_ = b.c.send(b.msg)
	}
}
