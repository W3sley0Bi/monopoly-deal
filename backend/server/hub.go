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

const emptyRoomTTL = 90 * time.Second

var botMoveDelay = 1100 * time.Millisecond

const (
	pingInterval   = 30 * time.Second
	pongWait       = 45 * time.Second
	writeWait      = 10 * time.Second
	sendChSize     = 16
	maxMessageSize = 4096
)

type Client struct {
	conn      *websocket.Conn
	sendCh    chan []byte
	done      chan struct{}
	closeOnce sync.Once
	playerID  string
	name      string
	roomID    string
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

type Hub struct {
	mu        sync.Mutex
	rooms     map[string]*Room
	order     []string
	clients   map[*Client]struct{}
	stop      chan struct{}
	wakeCh    chan struct{}
	pending   []outbound
	ops       []roomOp
	closeOnce sync.Once
}

func NewHub() *Hub {
	h := &Hub{
		rooms:   map[string]*Room{},
		clients: map[*Client]struct{}{},
		stop:    make(chan struct{}),
		wakeCh:  make(chan struct{}, 1),
	}
	go h.loop()
	return h
}

func (h *Hub) Close() { h.closeOnce.Do(func() { close(h.stop) }) }

func (h *Hub) wake() {
	select {
	case h.wakeCh <- struct{}{}:
	default:
	}
}

type outbound struct {
	c   *Client
	msg ServerMessage
}

// roomOp is a room action decided under h.mu but submitted only after it is
// released. Room.Do blocks while that room's action queue is full, and holding
// the hub lock through that wait would stall every connection on the server,
// not just the ones at the busy table.
type roomOp struct {
	r *Room
	f func()
}

func (h *Hub) doLocked(r *Room, f func()) {
	h.ops = append(h.ops, roomOp{r, f})
}

// takeOpsLocked must be called in the same critical section that queued the
// ops, so a caller only ever submits its own actions, in the order it decided
// them.
func (h *Hub) takeOpsLocked() []roomOp {
	ops := h.ops
	h.ops = nil
	return ops
}

func runOps(ops []roomOp) {
	for _, op := range ops {
		op.r.Do(op.f)
	}
}

func (h *Hub) loop() {
	for {
		select {
		case <-h.stop:
			return
		case <-h.wakeCh:
			h.mu.Lock()
			batch := append(h.flushPendingLocked(), h.broadcastHomeLocked()...)
			h.mu.Unlock()
			deliver(batch)
		}
	}
}

func (h *Hub) deleteRoom(roomID string) {
	h.mu.Lock()
	r := h.rooms[roomID]
	if r != nil {
		r.Close()
		h.deleteRoomLocked(roomID)
		h.pending = append(h.pending, h.broadcastHomeLocked()...)
	}
	batch := h.flushPendingLocked()
	h.mu.Unlock()
	deliver(batch)
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
		if c.roomID != "" {
			if r := h.rooms[c.roomID]; r != nil {
				roomID := c.roomID
				c.roomID = ""

				stillHere := false
				for other := range h.clients {
					if other != c && other.roomID == roomID && other.playerID == c.playerID {
						stillHere = true
						break
					}
				}

				h.doLocked(r, func() {
					r.detach(c, stillHere)
					r.broadcast()
				})
			}
		}
		c.roomID = ""
		batch := h.flushPendingLocked()
		ops := h.takeOpsLocked()
		h.mu.Unlock()
		runOps(ops)
		deliver(batch)
		c.stop()
	}()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
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
		var msg ClientMessage
		if err := json.Unmarshal(payload, &msg); err != nil {
			if sendErr := c.send(errorMessage(game.NewFault("err.bad_message", "message must be valid JSON"))); sendErr != nil {
				return
			}
			continue
		}
		h.handle(c, msg)
	}
}

func (h *Hub) evict(roomID string, targetID string) {
	h.mu.Lock()
	for c := range h.clients {
		if c.roomID == roomID && c.playerID == targetID {
			c.roomID = ""
			h.pending = append(h.pending, h.unicastLocked(c))
		}
	}
	batch := h.flushPendingLocked()
	h.mu.Unlock()
	deliver(batch)
}

func (h *Hub) handle(c *Client, msg ClientMessage) {
	// Refused before any state is touched: an app speaking another protocol
	// could otherwise half-apply a move the server reads differently.
	if err := checkProtocol(msg.ProtocolVersion); err != nil {
		_ = c.send(errorMessage(err))
		return
	}

	h.mu.Lock()

	if c.playerID == "" && msg.PlayerID != "" {
		c.playerID = msg.PlayerID
	}
	if msg.PlayerName != "" {
		c.name = trimName(msg.PlayerName)
	}
	if c.playerID == "" {
		h.mu.Unlock()
		_ = c.send(errorMessage(game.NewFault("err.missing_player_id", "missing player id")))
		return
	}

	switch msg.Type {
	case MsgHello:
		if c.roomID != "" {
			if r := h.rooms[c.roomID]; r != nil {
				h.mu.Unlock()
				r.Do(func() {
					_ = c.send(ServerMessage{Type: "room", Payload: r.view(c.playerID)})
				})
				return
			}
		}
		h.pending = append(h.pending, h.unicastLocked(c))
		batch := h.flushPendingLocked()
		h.mu.Unlock()
		deliver(batch)
	case MsgCreateRoom:
		if err := h.createRoomLocked(c, msg); err != nil {
			ops := h.takeOpsLocked()
			h.mu.Unlock()
			runOps(ops)
			_ = c.send(errorMessage(err))
		} else {
			h.pending = append(h.pending, h.broadcastHomeLocked()...)
			batch := h.flushPendingLocked()
			ops := h.takeOpsLocked()
			h.mu.Unlock()
			runOps(ops)
			deliver(batch)
		}
	case MsgJoinRoom:
		if err := h.joinRoomLocked(c, msg); err != nil {
			ops := h.takeOpsLocked()
			h.mu.Unlock()
			runOps(ops)
			_ = c.send(errorMessage(err))
		} else {
			h.pending = append(h.pending, h.broadcastHomeLocked()...)
			batch := h.flushPendingLocked()
			ops := h.takeOpsLocked()
			h.mu.Unlock()
			runOps(ops)
			deliver(batch)
		}
	case MsgLeaveRoom:
		if c.roomID != "" {
			r := h.rooms[c.roomID]
			roomID := c.roomID
			c.roomID = ""

			stillHere := false
			for other := range h.clients {
				if other != c && other.roomID == roomID && other.playerID == c.playerID {
					stillHere = true
					break
				}
			}
			if r != nil {
				h.doLocked(r, func() {
					r.detach(c, stillHere)
					r.broadcast()
				})
			}
		}
		h.pending = append(h.pending, h.unicastLocked(c))
		h.pending = append(h.pending, h.broadcastHomeLocked()...)
		batch := h.flushPendingLocked()
		ops := h.takeOpsLocked()
		h.mu.Unlock()
		runOps(ops)
		deliver(batch)
	case MsgCloseRoom:
		id := normalizeCode(msg.RoomID)
		if id == "" {
			id = c.roomID
		}
		r := h.rooms[id]
		if r == nil {
			h.mu.Unlock()
			_ = c.send(errorMessage(game.NewFault("err.no_such_table", fmt.Sprintf("no table with code %q", msg.RoomID), "code", msg.RoomID)))
			return
		}

		playerID := c.playerID
		h.mu.Unlock()
		r.Do(func() {
			if playerID != r.OwnerID && len(r.clients) > 0 {
				_ = c.send(errorMessage(game.NewFault("err.close_host_only", fmt.Sprintf("only %s can close that table while people are at it", r.ownerName()), "host", r.ownerName())))
				return
			}

			for other := range r.clients {
				if other != c {
					_ = other.send(ServerMessage{
						Type:       "notice",
						Notice:     fmt.Sprintf("%q was closed.", r.Name),
						NoticeKey:  "notice.table_closed",
						NoticeArgs: map[string]any{"table": r.Name},
					})
				}
			}
			_ = c.send(ServerMessage{
				Type:       "notice",
				Notice:     fmt.Sprintf("Closed %q.", r.Name),
				NoticeKey:  "notice.you_closed_table",
				NoticeArgs: map[string]any{"table": r.Name},
			})
			go r.hub.deleteRoom(r.ID)
		})
	default:
		r := h.rooms[c.roomID]
		playerID, playerName := c.playerID, c.name
		h.mu.Unlock()
		if r == nil {
			_ = c.send(errorMessage(game.NewFault("err.not_at_table", "you are not at a table")))
			return
		}
		r.Do(func() {
			err := r.handleMessage(playerID, playerName, msg)
			if err != nil {
				_ = c.send(errorMessage(err))
			} else {
				r.Game.PostAction()
				r.absorbRequests()
				r.ensureOwner()
			}
			r.broadcast()
		})
	}
}

func (h *Hub) createRoomLocked(c *Client, msg ClientMessage) error {
	if c.name == "" {
		return errNoName
	}
	if msg.Bots < 0 || msg.Bots >= game.MaxPlayers {
		return game.NewFault("err.bad_bot_count", fmt.Sprintf("choose between 0 and %d bots", game.MaxPlayers-1), "max", game.MaxPlayers-1)
	}

	name := trimRoomName(msg.RoomName)
	if name == "" {
		name = c.name + "'s table"
	}
	id := h.newRoomIDLocked()
	r := newRoom(h, id, name)
	created := false
	defer func() {
		if !created {
			r.Close()
		}
	}()
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
	// Only leave the current room after the new room has passed every option
	// check. A bad create request must not unexpectedly eject the player.
	if c.roomID != "" {
		oldRoomID := c.roomID
		oldRoom := h.rooms[oldRoomID]
		stillHere := false
		for other := range h.clients {
			if other != c && other.roomID == oldRoomID && other.playerID == c.playerID {
				stillHere = true
				break
			}
		}
		if oldRoom != nil {
			h.doLocked(oldRoom, func() {
				oldRoom.detach(c, stillHere)
				oldRoom.broadcast()
			})
		}
	}
	r.OwnerID = c.playerID
	h.rooms[id] = r
	h.order = append(h.order, id)
	c.roomID = id
	created = true

	h.doLocked(r, func() {
		r.clients[c] = struct{}{}
		for i := 0; i < msg.Bots; i++ {
			r.Game.AddBot(fmt.Sprintf("bot_%s_%d", r.ID, r.nextBot()), "")
		}
		if msg.AutoStart && len(r.Game.Players) >= 2 {
			r.Game.StartRandomScheduled()
		}
		r.broadcast()
	})
	return nil
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
		if c.roomID != "" {
			oldR := h.rooms[c.roomID]
			oldRoomID := c.roomID

			stillHere := false
			for other := range h.clients {
				if other != c && other.roomID == oldRoomID && other.playerID == c.playerID {
					stillHere = true
					break
				}
			}
			if oldR != nil {
				h.doLocked(oldR, func() {
					oldR.detach(c, stillHere)
					oldR.broadcast()
				})
			}
		}
	}

	c.roomID = r.ID
	// Captured now: the op runs after h.mu is released, and c.name is hub
	// state a later frame may rewrite.
	playerID, name := c.playerID, c.name

	h.doLocked(r, func() {
		r.clients[c] = struct{}{}
		err := func() error {
			if r.isSeated(playerID) {
				return r.Game.AddPlayer(playerID, name)
			}
			seatable := !msg.AsSpectator && r.Game.State == game.StateWaiting && r.seatsFree() > 0
			if seatable {
				delete(r.spectators, playerID)
				return r.Game.AddPlayer(playerID, name)
			}
			r.spectators[playerID] = name
			return nil
		}()
		if err != nil {
			_ = c.send(errorMessage(err))
		}
		r.broadcast()
	})
	return nil
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
				You:             c.playerID,
				Name:            c.name,
				Rooms:           rooms,
				Modes:           modeInfos(),
				TurnOptions:     game.TurnSecondOptions,
				RespondOptions:  game.RespondSecondOptions,
				Difficulties:    game.Difficulties,
				MaxPlayers:      game.MaxPlayers,
				ProtocolVersion: ProtocolVersion,
			}}})
		}
	}
	return batch
}

func (h *Hub) unicastLocked(c *Client) outbound {
	home := h.homeRoomsLocked()
	live := h.roomClientCountsLocked()
	rooms := make([]RoomSummary, 0, len(home))
	for _, r := range home {
		rooms = append(rooms, r.summary(c.playerID, live[r.ID]))
	}
	return outbound{c, ServerMessage{Type: "home", Payload: HomeView{
		You:             c.playerID,
		Name:            c.name,
		Rooms:           rooms,
		Modes:           modeInfos(),
		TurnOptions:     game.TurnSecondOptions,
		RespondOptions:  game.RespondSecondOptions,
		Difficulties:    game.Difficulties,
		MaxPlayers:      game.MaxPlayers,
		ProtocolVersion: ProtocolVersion,
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
