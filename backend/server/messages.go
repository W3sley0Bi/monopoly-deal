package server

import (
	"encoding/json"
	"time"

	"monopoly-deal-backend/game"
)

// Client -> server message types.
const (
	// Home scope.
	MsgHello      = "hello"
	MsgCreateRoom = "create_room"
	MsgJoinRoom   = "join_room"
	MsgLeaveRoom  = "leave_room"
	MsgCloseRoom  = "close_room"

	// Room scope.
	MsgSetOptions  = "set_options"
	MsgStartGame   = "start_game"
	MsgNewGame     = "new_game"
	MsgTerminate   = "terminate_game"
	MsgKick        = "kick"
	MsgTakeSeat    = "take_seat"
	MsgRequestSeat = "request_seat"
	MsgCancelSeat  = "cancel_seat"
	MsgAddBot      = "add_bot"
	MsgRemoveBot   = "remove_bot"
	MsgChat        = "chat"

	// Voice and video: the server only relays, it never inspects the payloads.
	MsgRTCJoin   = "rtc_join"
	MsgRTCLeave  = "rtc_leave"
	MsgRTCSignal = "rtc_signal"

	// Game scope.
	MsgPlayBank     = "play_bank"
	MsgPlayProperty = "play_property"
	MsgPlayAction   = "play_action"
	MsgMoveWildcard = "move_wildcard"
	MsgDiscard      = "discard"
	MsgEndTurn      = "end_turn"
	MsgRespond      = "respond"
)

// ClientMessage is the single inbound envelope.
type ClientMessage struct {
	Type       string `json:"type"`
	PlayerID   string `json:"player_id"`
	PlayerName string `json:"player_name,omitempty"`

	// Room scope.
	RoomID      string    `json:"room_id,omitempty"`
	RoomName    string    `json:"room_name,omitempty"`
	Mode        game.Mode `json:"mode,omitempty"`
	TurnSeconds int       `json:"turn_seconds,omitempty"`
	AsSpectator bool      `json:"as_spectator,omitempty"`
	// Bots is how many robot seats to fill when opening a table.
	Bots int `json:"bots,omitempty"`
	// AutoStart deals the cards as soon as the table is open, for solo play.
	AutoStart bool `json:"auto_start,omitempty"`
	// BotDifficulty is how hard the robot seats should play.
	BotDifficulty game.Difficulty `json:"bot_difficulty,omitempty"`

	// Game scope.
	CardID         string     `json:"card_id,omitempty"`
	Color          game.Color `json:"color,omitempty"`
	TargetPlayerID string     `json:"target_player_id,omitempty"`
	TargetCardID   string     `json:"target_card_id,omitempty"`
	GiveCardID     string     `json:"give_card_id,omitempty"`
	DoubleCardIDs  []string   `json:"double_card_ids,omitempty"`
	SayNo          bool       `json:"say_no,omitempty"`
	CardIDs        []string   `json:"card_ids,omitempty"`

	// Chat.
	Text string `json:"text,omitempty"`
	// WebRTC offer/answer/candidate, passed through untouched.
	Signal json.RawMessage `json:"signal,omitempty"`
}

// ChatMessage is one line in a table's group chat. Player messages carry Text;
// server-generated lines carry a translation Key instead, so every reader sees
// them in their own language.
type ChatMessage struct {
	ID       string         `json:"id"`
	PlayerID string         `json:"player_id"`
	Name     string         `json:"name"`
	Text     string         `json:"text,omitempty"`
	Key      string         `json:"key,omitempty"`
	Args     map[string]any `json:"args,omitempty"`
	AtMS     int64          `json:"at_ms"`
	// System marks server-generated lines rather than player messages.
	System bool `json:"system,omitempty"`
}

// RTCEnvelope is one relayed signalling payload.
type RTCEnvelope struct {
	From   string          `json:"from"`
	Signal json.RawMessage `json:"signal"`
}

// ServerMessage is the single outbound envelope. Errors and notices carry a
// translation key beside the English text, so the client can show them in the
// reader's language and fall back to the text when the key is unknown.
type ServerMessage struct {
	Type       string         `json:"type"`
	Payload    interface{}    `json:"payload,omitempty"`
	Error      string         `json:"error,omitempty"`
	ErrorKey   string         `json:"error_key,omitempty"`
	ErrorArgs  map[string]any `json:"error_args,omitempty"`
	Notice     string         `json:"notice,omitempty"`
	NoticeKey  string         `json:"notice_key,omitempty"`
	NoticeArgs map[string]any `json:"notice_args,omitempty"`
}

// errorMessage renders an error for the wire, with its key when it has one.
func errorMessage(err error) ServerMessage {
	msg := ServerMessage{Type: "error", Error: err.Error()}
	if f, ok := game.FaultOf(err); ok {
		msg.ErrorKey = f.Key
		msg.ErrorArgs = f.Args
	}
	return msg
}

// Seat is a named participant, seated or not.
type Seat struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ModeInfo describes a game mode for the client's picker.
type ModeInfo struct {
	ID        game.Mode `json:"id"`
	Label     string    `json:"label"`
	Blurb     string    `json:"blurb"`
	Available bool      `json:"available"`
}

func modeInfos() []ModeInfo {
	blurbs := map[game.Mode]string{
		game.ModeClassic:    "First to 3 complete colour sets wins.",
		game.ModeDeathmatch: "Win with 3 complete sets and an empty hand.",
		game.ModeGoldenRush: "Coming soon.",
	}
	out := make([]ModeInfo, 0, len(game.Modes))
	for _, m := range game.Modes {
		out = append(out, ModeInfo{ID: m, Label: m.Label(), Blurb: blurbs[m], Available: m.Available()})
	}
	return out
}

// SetView is a property set plus fields the client would otherwise recompute.
type SetView struct {
	Color     game.Color  `json:"color"`
	Cards     []game.Card `json:"cards"`
	Buildings []game.Card `json:"buildings"`
	Size      int         `json:"size"`
	Complete  bool        `json:"complete"`
	Rent      int         `json:"rent"`
}

// PlayerView hides other players' hands.
type PlayerView struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Connected    bool        `json:"connected"`
	Bot          bool        `json:"bot"`
	HandCount    int         `json:"hand_count"`
	Hand         []game.Card `json:"hand,omitempty"`
	Bank         []game.Card `json:"bank"`
	BankTotal    int         `json:"bank_total"`
	Sets         []SetView   `json:"sets"`
	CompleteSets int         `json:"complete_sets"`
	AssetTotal   int         `json:"asset_total"`
	HasJustSayNo bool        `json:"has_just_say_no"`
}

// GameView is the table as one player sees it.
type GameView struct {
	ID            string          `json:"id"`
	You           string          `json:"you"`
	Players       []PlayerView    `json:"players"`
	DeckCount     int             `json:"deck_count"`
	DiscardCount  int             `json:"discard_count"`
	DiscardTop    *game.Card      `json:"discard_top"`
	CurrentTurn   int             `json:"current_turn"`
	State         game.GameState  `json:"state"`
	WinnerID      string          `json:"winner_id,omitempty"`
	PlaysLeft     int             `json:"plays_left"`
	Pending       *game.Pending   `json:"pending"`
	Log           []game.LogEntry `json:"log"`
	SetSizes      map[string]int  `json:"set_sizes"`
	Colors        []game.Color    `json:"colors"`
	Mode          game.Mode       `json:"mode"`
	ModeLabel     string          `json:"mode_label"`
	TurnSeconds   int             `json:"turn_seconds"`
	BotDifficulty game.Difficulty `json:"bot_difficulty"`
	DeadlineMS    int64           `json:"deadline_ms"`
	DeadlineKind  string          `json:"deadline_kind,omitempty"`
	// DeadlineSeconds is the length of the current countdown window.
	DeadlineSeconds int `json:"deadline_seconds"`
	// NowMS lets the client correct for clock skew when drawing the countdown.
	NowMS int64 `json:"now_ms"`
}

// RoomView is everything a client in a room needs.
type RoomView struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	OwnerID      string            `json:"owner_id"`
	OwnerName    string            `json:"owner_name"`
	IsOwner      bool              `json:"is_owner"`
	You          string            `json:"you"`
	YouSeated    bool              `json:"you_seated"`
	YouRequested bool              `json:"you_requested"`
	Spectators   []Seat            `json:"spectators"`
	Requests     []Seat            `json:"requests"`
	SeatsFree    int               `json:"seats_free"`
	Modes        []ModeInfo        `json:"modes"`
	TurnOptions  []int             `json:"turn_options"`
	Difficulties []game.Difficulty `json:"difficulties"`
	Game         GameView          `json:"game"`

	Chat []ChatMessage `json:"chat"`
	// CallMembers are the player ids currently in the voice/video call.
	CallMembers []string `json:"call_members"`
}

// RoomSummary is one row in the home screen's table browser.
type RoomSummary struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	OwnerName      string          `json:"owner_name"`
	Mode           game.Mode       `json:"mode"`
	ModeLabel      string          `json:"mode_label"`
	TurnSeconds    int             `json:"turn_seconds"`
	BotDifficulty  game.Difficulty `json:"bot_difficulty"`
	State          game.GameState  `json:"state"`
	Players        []Seat          `json:"players"`
	SpectatorCount int             `json:"spectator_count"`
	BotCount       int             `json:"bot_count"`
	CallCount      int             `json:"call_count"`
	SeatsFree      int             `json:"seats_free"`
	YouSeated      bool            `json:"you_seated"`
	YouSpectating  bool            `json:"you_spectating"`
	YouRequested   bool            `json:"you_requested"`
	// Abandoned marks a table nobody is connected to, which anyone may close;
	// otherwise only the host can. YouMayClose is the two rules combined, so
	// the client can just show or hide the button.
	Abandoned   bool `json:"abandoned"`
	YouMayClose bool `json:"you_may_close"`
}

// HomeView is the lobby outside any room.
type HomeView struct {
	You          string            `json:"you"`
	Name         string            `json:"name"`
	Rooms        []RoomSummary     `json:"rooms"`
	Modes        []ModeInfo        `json:"modes"`
	TurnOptions  []int             `json:"turn_options"`
	Difficulties []game.Difficulty `json:"difficulties"`
	MaxPlayers   int               `json:"max_players"`
}

// gameView renders the game from one seat. Pass an empty id for spectators.
func gameView(g *game.Game, you string) GameView {
	v := GameView{
		ID:              g.ID,
		You:             you,
		DeckCount:       len(g.Deck),
		DiscardCount:    len(g.DiscardPile),
		CurrentTurn:     g.CurrentTurn,
		State:           g.State,
		WinnerID:        g.WinnerID,
		PlaysLeft:       g.PlaysLeft,
		Pending:         g.Pending,
		SetSizes:        map[string]int{},
		Colors:          game.AllColors,
		Players:         []PlayerView{},
		Log:             []game.LogEntry{},
		Mode:            g.Mode,
		ModeLabel:       g.Mode.Label(),
		TurnSeconds:     g.TurnSeconds,
		BotDifficulty:   g.BotDifficulty,
		DeadlineMS:      g.DeadlineMS,
		DeadlineKind:    g.DeadlineKind,
		DeadlineSeconds: g.DeadlineSeconds,
		NowMS:           time.Now().UnixMilli(),
	}
	if g.Log != nil {
		v.Log = g.Log
	}
	for _, c := range game.AllColors {
		v.SetSizes[string(c)] = game.SetSize(c)
	}
	if n := len(g.DiscardPile); n > 0 {
		top := g.DiscardPile[n-1]
		v.DiscardTop = &top
	}
	for _, p := range g.Players {
		pv := PlayerView{
			ID: p.ID, Name: p.Name, Connected: p.Connected, Bot: p.Bot,
			HandCount: len(p.Hand), Bank: p.Bank, BankTotal: p.BankTotal(),
			CompleteSets: p.CompleteSets(), AssetTotal: p.AssetTotal(),
			Sets: []SetView{},
		}
		if pv.Bank == nil {
			pv.Bank = []game.Card{}
		}
		for _, s := range p.Sets {
			cards := s.Cards
			if cards == nil {
				cards = []game.Card{}
			}
			builds := s.Buildings
			if builds == nil {
				builds = []game.Card{}
			}
			pv.Sets = append(pv.Sets, SetView{
				Color: s.Color, Cards: cards, Buildings: builds,
				Size: game.SetSize(s.Color), Complete: s.IsComplete(), Rent: s.Rent(),
			})
		}
		if p.ID != "" && p.ID == you {
			hand := p.Hand
			if hand == nil {
				hand = []game.Card{}
			}
			pv.Hand = hand
			pv.HasJustSayNo = hasJSN(hand)
		}
		v.Players = append(v.Players, pv)
	}
	return v
}

func hasJSN(hand []game.Card) bool {
	for _, c := range hand {
		if c.Action == game.ActionJustSayNo {
			return true
		}
	}
	return false
}
