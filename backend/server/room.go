package server

import (
	"fmt"
	"time"

	"monopoly-deal-backend/game"
)

// Room is one table: a game plus the people watching and waiting for a seat.
type Room struct {
	ID      string
	Name    string
	Private bool
	OwnerID string
	Game    *game.Game

	// spectators maps player id to display name for everyone in the room
	// without a seat.
	spectators map[string]string
	// requests are spectators who asked to play the next game, in order.
	requests []Seat
	// emptySince marks when the last client left, for cleanup.
	emptySince time.Time
	// botAt is when the robot the game is waiting on should move. Zero means
	// nothing is pending, so the pause starts fresh on the next decision.
	botAt time.Time

	// chat is the table's group chat, newest last.
	chat []ChatMessage
	seq  int
	// bots counts every robot ever seated here, so ids never collide with a
	// seat that was removed and re-added.
	bots int

	// summaryHash is the last broadcast state of this room for the lobby.
	summaryHash string
}

// nextBot hands out the next robot sequence number for this table.
func (r *Room) nextBot() int {
	r.bots++
	return r.bots
}

const chatHistory = 120

// say appends a player chat line, trimming the history.
func (r *Room) say(playerID, name, text string) {
	r.append(ChatMessage{PlayerID: playerID, Name: name, Text: text})
}

// announce appends a translatable system line to the chat.
func (r *Room) announce(playerID, name, key string, args map[string]any) {
	r.append(ChatMessage{PlayerID: playerID, Name: name, Key: key, Args: args, System: true})
}

func (r *Room) append(m ChatMessage) {
	r.seq++
	m.ID = fmt.Sprintf("%s-%d", r.ID, r.seq)
	m.AtMS = time.Now().UnixMilli()
	r.chat = append(r.chat, m)
	if len(r.chat) > chatHistory {
		r.chat = r.chat[len(r.chat)-chatHistory:]
	}
}

func newRoom(id, name string) *Room {
	return &Room{
		ID:         id,
		Name:       name,
		Game:       game.NewGame(id),
		spectators: map[string]string{},
		chat:       []ChatMessage{},
	}
}

func (r *Room) seatsFree() int {
	free := game.MaxPlayers - len(r.Game.Players)
	if free < 0 {
		return 0
	}
	return free
}

func (r *Room) isSeated(playerID string) bool {
	return r.Game.Player(playerID) != nil
}

func (r *Room) hasRequested(playerID string) bool {
	for _, q := range r.requests {
		if q.ID == playerID {
			return true
		}
	}
	return false
}

func (r *Room) addRequest(playerID, name string) {
	if r.hasRequested(playerID) || r.isSeated(playerID) {
		return
	}
	r.requests = append(r.requests, Seat{ID: playerID, Name: name})
}

func (r *Room) dropRequest(playerID string) {
	kept := r.requests[:0]
	for _, q := range r.requests {
		if q.ID != playerID {
			kept = append(kept, q)
		}
	}
	r.requests = kept
}

// absorbRequests seats everyone who asked for the next game, once the table is
// back in the lobby.
func (r *Room) absorbRequests() {
	if r.Game.State != game.StateWaiting {
		return
	}
	for len(r.requests) > 0 && r.seatsFree() > 0 {
		q := r.requests[0]
		r.requests = r.requests[1:]
		if err := r.Game.AddPlayer(q.ID, q.Name); err == nil {
			delete(r.spectators, q.ID)
		}
	}
}

// ensureOwner keeps ownership with a real participant: a seated player if
// possible, otherwise a spectator.
func (r *Room) ensureOwner() {
	if r.OwnerID != "" {
		if r.isSeated(r.OwnerID) {
			return
		}
		if _, watching := r.spectators[r.OwnerID]; watching {
			// A spectator only keeps ownership while nobody is seated.
			if len(r.Game.Players) == 0 {
				return
			}
		}
	}
	for _, p := range r.Game.Players {
		if !p.Bot {
			r.OwnerID = p.ID
			return
		}
	}
	for id := range r.spectators {
		r.OwnerID = id
		return
	}
	r.OwnerID = ""
}

func (r *Room) ownerName() string {
	if p := r.Game.Player(r.OwnerID); p != nil {
		return p.Name
	}
	if n, ok := r.spectators[r.OwnerID]; ok {
		return n
	}
	return "—"
}

func (r *Room) spectatorSeats() []Seat {
	out := make([]Seat, 0, len(r.spectators))
	for id, name := range r.spectators {
		out = append(out, Seat{ID: id, Name: name})
	}
	// Stable order so the client list does not jump around.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].ID < out[j-1].ID; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func (r *Room) playerSeats() []Seat {
	out := make([]Seat, 0, len(r.Game.Players))
	for _, p := range r.Game.Players {
		out = append(out, Seat{ID: p.ID, Name: p.Name})
	}
	return out
}

func (r *Room) view(playerID string) RoomView {
	reqs := r.requests
	if reqs == nil {
		reqs = []Seat{}
	}
	return RoomView{
		ID:             r.ID,
		Name:           r.Name,
		Private:        r.Private,
		InviteCode:     r.ID,
		OwnerID:        r.OwnerID,
		OwnerName:      r.ownerName(),
		IsOwner:        playerID != "" && playerID == r.OwnerID,
		You:            playerID,
		YouSeated:      r.isSeated(playerID),
		YouRequested:   r.hasRequested(playerID),
		Spectators:     r.spectatorSeats(),
		Requests:       reqs,
		SeatsFree:      r.seatsFree(),
		Modes:          modeInfos(),
		TurnOptions:    game.TurnSecondOptions,
		RespondOptions: game.RespondSecondOptions,
		Difficulties:   game.Difficulties,
		Game:           gameView(r.Game, playerID),
		Chat:           r.chat,
	}
}

// summary renders one home-screen row. live is how many connections the table
// currently holds, which decides whether it counts as abandoned.
func (r *Room) summary(playerID string, live int) RoomSummary {
	_, spectating := r.spectators[playerID]
	abandoned := live == 0
	return RoomSummary{
		ID:             r.ID,
		Name:           r.Name,
		OwnerName:      r.ownerName(),
		Mode:           r.Game.Mode,
		ModeLabel:      r.Game.Mode.Label(),
		TurnSeconds:    r.Game.TurnSeconds,
		BotDifficulty:  r.Game.BotDifficulty,
		State:          r.Game.State,
		Players:        r.playerSeats(),
		SpectatorCount: len(r.spectators),
		BotCount:       r.Game.Bots(),
		SeatsFree:      r.seatsFree(),
		YouSeated:      r.isSeated(playerID),
		YouSpectating:  spectating,
		YouRequested:   r.hasRequested(playerID),
		Abandoned:      abandoned,
		YouMayClose:    playerID == r.OwnerID || abandoned,
	}
}

// computeSummaryHash returns a string representing the globally visible summary state.
// It is used by the hub to know when a change requires broadcasting an updated lobby view.
func (r *Room) computeSummaryHash(live int) string {
	return fmt.Sprintf("%v|%v|%v|%v|%v|%v|%v|%v|%v|%v",
		r.Name,
		r.OwnerID,
		r.Game.Mode,
		r.Game.TurnSeconds,
		r.Game.BotDifficulty,
		r.Game.State,
		live == 0, // abandoned
		len(r.spectators),
		r.Game.Bots(),
		r.playerSeats(),
	)
}
