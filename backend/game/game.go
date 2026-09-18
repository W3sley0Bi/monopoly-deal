package game

import (
	"fmt"
	"math/rand/v2"
	"sort"
	"time"
)

type GameState string

const (
	StateWaiting  GameState = "waiting"
	StatePlaying  GameState = "playing"
	StateFinished GameState = "finished"
)

// Mode selects the win condition.
type Mode string

const (
	// ModeClassic wins on three complete colour sets.
	ModeClassic Mode = "classic"
	// ModeDeathmatch also requires an empty hand.
	ModeDeathmatch Mode = "deathmatch"
	// ModeTutorial is a scripted solo table, not a game. See tutorial.go.
	ModeTutorial Mode = "tutorial"
	// ModeGoldenRush is not implemented yet.
	ModeGoldenRush Mode = "golden_rush"
)

// Modes lists every mode in display order.
// Modes are the ones an owner may choose for a table. ModeTutorial is not
// among them: it is a scripted solo table the Learn button opens, not a way to
// play with other people.
var Modes = []Mode{ModeClassic, ModeDeathmatch, ModeGoldenRush}

// Available reports whether a mode can actually be played.
func (m Mode) Available() bool {
	return m == ModeClassic || m == ModeDeathmatch || m == ModeTutorial
}

// Valid reports whether a mode is a known value.
func (m Mode) Valid() bool {
	if m == ModeTutorial {
		return true
	}
	for _, x := range Modes {
		if x == m {
			return true
		}
	}
	return false
}

// Difficulty is how hard the robot seats play.
type Difficulty string

const (
	// DifficultyEasy plays its own cards and little else.
	DifficultyEasy Difficulty = "easy"
	// DifficultyNormal builds sets, charges rent and steals when it helps.
	DifficultyNormal Difficulty = "normal"
	// DifficultyHard also doubles rent, breaks up sets and defends with
	// Just Say No wherever it can.
	DifficultyHard Difficulty = "hard"
)

// Difficulties lists every level in display order.
var Difficulties = []Difficulty{DifficultyEasy, DifficultyNormal, DifficultyHard}

// ValidDifficulty reports whether d is a known level.
func ValidDifficulty(d Difficulty) bool {
	for _, x := range Difficulties {
		if x == d {
			return true
		}
	}
	return false
}

// TurnSecondOptions are the turn lengths an owner may pick. 0 means no limit.
var TurnSecondOptions = []int{0, 30, 60, 120}

// RespondSecondOptions are the response windows an owner may pick. 0 means no
// limit.
var RespondSecondOptions = []int{0, 10, 15, 30}

const (
	// PaymentGraceSeconds is the default answer window: how long a player gets
	// to choose which cards to hand over before the server picks for them. It
	// applies even when the table has no turn timer, since a debt blocks
	// everyone else. Owners may change it with SetRespondSeconds.
	PaymentGraceSeconds = 10

	MaxPlayers    = 5
	PlaysPerTurn  = 3
	HandLimit     = 7
	SetsToWin     = 3
	StartingHand  = 5
	TurnDraw      = 2
	EmptyHandDraw = 5
	// StartRevealDelay gives clients time to present the randomized starting
	// order before the first turn becomes actionable.
	StartRevealDelay = 4500 * time.Millisecond
)

// PropertySet is one colour group in front of a player.
type PropertySet struct {
	Color     Color  `json:"color"`
	Cards     []Card `json:"cards"`
	Buildings []Card `json:"buildings"`
}

func (s *PropertySet) has(action ActionType) bool {
	for _, b := range s.Buildings {
		if b.Action == action {
			return true
		}
	}
	return false
}

// IsComplete reports whether the set holds a full colour group.
func (s *PropertySet) IsComplete() bool { return len(s.Cards) >= SetSize(s.Color) }

// Rent is what an opponent owes for this set.
func (s *PropertySet) Rent() int {
	return RentFor(s.Color, len(s.Cards), s.has(ActionHouse), s.has(ActionHotel))
}

type Player struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Hand      []Card         `json:"hand"`
	Bank      []Card         `json:"bank"`
	Sets      []*PropertySet `json:"sets"`
	Connected bool           `json:"connected"`
	// Bot marks a seat the server plays itself.
	Bot bool `json:"bot"`
}

// BankTotal is the cash value sitting in the bank.
func (p *Player) BankTotal() int {
	t := 0
	for _, c := range p.Bank {
		t += c.Value
	}
	return t
}

// CompleteSets counts finished colour groups.
func (p *Player) CompleteSets() int {
	n := 0
	for _, s := range p.Sets {
		if s.IsComplete() {
			n++
		}
	}
	return n
}

// AssetTotal is everything the player could be forced to hand over.
func (p *Player) AssetTotal() int {
	t := p.BankTotal()
	for _, s := range p.Sets {
		for _, c := range s.Cards {
			t += c.Value
		}
		for _, c := range s.Buildings {
			t += c.Value
		}
	}
	return t
}

func (p *Player) hasJustSayNo() bool {
	for _, c := range p.Hand {
		if c.Action == ActionJustSayNo {
			return true
		}
	}
	return false
}

func (p *Player) setFor(col Color) *PropertySet {
	for _, s := range p.Sets {
		if s.Color == col {
			return s
		}
	}
	return nil
}

func (p *Player) ensureSet(col Color) *PropertySet {
	if s := p.setFor(col); s != nil {
		return s
	}
	s := &PropertySet{Color: col, Cards: []Card{}, Buildings: []Card{}}
	p.Sets = append(p.Sets, s)
	return s
}

func (p *Player) pruneSets() {
	kept := p.Sets[:0]
	for _, s := range p.Sets {
		if len(s.Cards) > 0 || len(s.Buildings) > 0 {
			kept = append(kept, s)
		}
	}
	p.Sets = kept
}

// PendingKind is the shape of an unresolved action.
type PendingKind string

const (
	PendingPayment     PendingKind = "payment"
	PendingSlyDeal     PendingKind = "sly_deal"
	PendingForcedDeal  PendingKind = "forced_deal"
	PendingDealBreaker PendingKind = "deal_breaker"
)

// Target is one player's obligation inside a pending action.
type Target struct {
	PlayerID string `json:"player_id"`
	Amount   int    `json:"amount"`
	// Responder is the player who must act next on this target.
	Responder string `json:"responder"`
	// DeadlineMS is when THIS target's answer is due, in unix millis. Each one
	// runs on its own clock from the moment the card hit the table.
	DeadlineMS int64 `json:"deadline_ms,omitempty"`
	// Cancelled flips with every Just Say No played on this target.
	Cancelled bool   `json:"cancelled"`
	Settled   bool   `json:"settled"`
	Note      string `json:"note,omitempty"`
}

// Pending is an action waiting on responses. Only one exists at a time.
type Pending struct {
	Kind   PendingKind `json:"kind"`
	Action ActionType  `json:"action"`
	Card   Card        `json:"card"`
	ByID   string      `json:"by_id"`
	// LabelKey names the action for translation; LabelArgs fills it in.
	LabelKey  string         `json:"label_key"`
	LabelArgs map[string]any `json:"label_args,omitempty"`
	Targets   []*Target      `json:"targets"`

	// Steal / swap details.
	TargetPlayerID string `json:"target_player_id,omitempty"`
	TargetCardID   string `json:"target_card_id,omitempty"`
	TargetColor    Color  `json:"target_color,omitempty"`
	GiveCardID     string `json:"give_card_id,omitempty"`

	// extra holds Double The Rent cards spent on this action.
	extra []Card
}

func (pd *Pending) target(playerID string) *Target {
	for _, t := range pd.Targets {
		if t.PlayerID == playerID {
			return t
		}
	}
	return nil
}

func (pd *Pending) done() bool {
	for _, t := range pd.Targets {
		if !t.Settled {
			return false
		}
	}
	return true
}

type Game struct {
	ID          string     `json:"id"`
	Players     []*Player  `json:"players"`
	Deck        []Card     `json:"deck"`
	DiscardPile []Card     `json:"discard_pile"`
	CurrentTurn int        `json:"current_turn"`
	State       GameState  `json:"state"`
	WinnerID    string     `json:"winner_id,omitempty"`
	PlaysLeft   int        `json:"plays_left"`
	Pending     *Pending   `json:"pending"`
	Log         []LogEntry `json:"log"`

	Mode Mode `json:"mode"`
	// Tutorial is the lesson a scripted table is on, and nil everywhere else.
	Tutorial    *TutorialState `json:"tutorial,omitempty"`
	TurnSeconds int            `json:"turn_seconds"`
	// RespondSeconds is how long each player gets to answer an action aimed at
	// them. Every target's window runs from when the card was played, so one
	// player answering never shortens or extends anybody else's.
	RespondSeconds int `json:"respond_seconds"`
	// BotDifficulty is how hard every robot at this table plays.
	BotDifficulty Difficulty `json:"bot_difficulty"`
	// DeadlineMS is when the current turn or response expires, in unix millis.
	// Zero means no limit.
	DeadlineMS   int64  `json:"deadline_ms"`
	DeadlineKind string `json:"deadline_kind,omitempty"`
	// DeadlineSeconds is the length of the current window, for the countdown ring.
	DeadlineSeconds int `json:"deadline_seconds"`
	// StartSequence is the authoritative seat order chosen for this match.
	// StartID changes every time a new match is started, even if the order
	// happens to repeat.
	StartSequence []string `json:"start_sequence,omitempty"`
	StartID       string   `json:"start_id,omitempty"`
	// StartAtMS is when the first turn becomes actionable. It is non-zero only
	// during the short starting reveal window.
	StartAtMS int64 `json:"start_at_ms,omitempty"`

	// clock is swapped out by tests.
	clock          func() time.Time
	startNo        uint64
	tutorialAt     int
	tutorialDone   bool
	turnDeadlineMS int64
	// paymentPausedAt marks the start of a payment interruption. It remains
	// set across multiple payers and Just Say No rebounds.
	paymentPausedAt time.Time
}

func NewGame(id string) *Game {
	return &Game{
		ID:             id,
		State:          StateWaiting,
		Deck:           GenerateDeck(),
		Players:        []*Player{},
		Log:            []LogEntry{},
		Mode:           ModeClassic,
		BotDifficulty:  DifficultyNormal,
		RespondSeconds: PaymentGraceSeconds,
	}
}

// SetClock replaces the time source. Tests use it to drive the turn timer.
func (g *Game) SetClock(f func() time.Time) { g.clock = f }

func (g *Game) now() time.Time {
	if g.clock != nil {
		return g.clock()
	}
	return time.Now()
}

// Configure sets the mode and turn length. Lobby only.
func (g *Game) Configure(mode Mode, turnSeconds int) error {
	if g.State != StateWaiting {
		return fault("err.options_locked", "options can only change before the game starts")
	}
	if !mode.Valid() {
		return fault("err.unknown_mode", fmt.Sprintf("unknown game mode %q", mode), "mode", string(mode))
	}
	if !mode.Available() {
		return fault("err.mode_unavailable", "that mode is not available yet")
	}
	ok := false
	for _, s := range TurnSecondOptions {
		if s == turnSeconds {
			ok = true
			break
		}
	}
	if !ok {
		return fault("err.bad_turn_length", "unsupported turn length")
	}
	g.Mode = mode
	g.TurnSeconds = turnSeconds
	return nil
}

// SetRespondSeconds changes how long each player gets to answer an action.
// Lobby only, so nobody's clock moves under them mid-game.
func (g *Game) SetRespondSeconds(secs int) error {
	if g.State != StateWaiting {
		return fault("err.respond_lobby_only", "the response time can only change before the game starts")
	}
	for _, s := range RespondSecondOptions {
		if s == secs {
			g.RespondSeconds = secs
			return nil
		}
	}
	return fault("err.bad_respond_length", "unsupported response length")
}

// SetBotDifficulty changes how hard the robots play. Lobby only, so a game
// cannot get easier halfway through.
func (g *Game) SetBotDifficulty(d Difficulty) error {
	if g.State != StateWaiting {
		return fault("err.difficulty_lobby_only", "the robot difficulty can only change before the game starts")
	}
	if !ValidDifficulty(d) {
		return fault("err.unknown_difficulty", fmt.Sprintf("unknown difficulty %q", d), "difficulty", string(d))
	}
	g.BotDifficulty = d
	return nil
}

// difficulty is the level to play at, defaulting to normal for tables made
// before the setting existed.
func (g *Game) difficulty() Difficulty {
	if ValidDifficulty(g.BotDifficulty) {
		return g.BotDifficulty
	}
	return DifficultyNormal
}

// log appends one translatable line to the table log. args are key/value
// pairs, filled into the message by whichever language the reader picked.
func (g *Game) log(key string, args ...any) {
	g.Log = append(g.Log, LogEntry{Key: key, Args: pairs(args...)})
	if len(g.Log) > 60 {
		g.Log = g.Log[len(g.Log)-60:]
	}
}

func (g *Game) name(id string) string {
	if p := g.Player(id); p != nil {
		return p.Name
	}
	return "someone"
}

// Player returns the player with the given id, or nil.
func (g *Game) Player(id string) *Player {
	for _, p := range g.Players {
		if p.ID == id {
			return p
		}
	}
	return nil
}

func (g *Game) playerIndex(id string) int {
	for i, p := range g.Players {
		if p.ID == id {
			return i
		}
	}
	return -1
}

// AddPlayer seats a new player, or re-seats a returning one.
func (g *Game) AddPlayer(id, name string) error {
	if id == "" {
		return fault("err.missing_player_id", "missing player id")
	}
	if name == "" {
		name = "Player"
	}
	if p := g.Player(id); p != nil {
		p.Name = name
		p.Connected = true
		return nil
	}
	if g.State != StateWaiting {
		return fault("err.game_in_progress", "game already in progress")
	}
	if len(g.Players) >= MaxPlayers {
		return fault("err.game_full", "game is full")
	}
	g.Players = append(g.Players, &Player{
		ID: id, Name: name, Connected: true,
		Hand: []Card{}, Bank: []Card{}, Sets: []*PropertySet{},
	})
	g.log("log.joined", "name", name)
	return nil
}

// Announce adds a line to the table log.
// Announce adds a line to the table log on the server's behalf.
func (g *Game) Announce(key string, args ...any) { g.log(key, args...) }

// AddBot seats a robot the server plays. Lobby only, like any other seat.
func (g *Game) AddBot(id, name string) error {
	if g.State != StateWaiting {
		return fault("err.bots_lobby_only", "bots can only be added before the game starts")
	}
	if len(g.Players) >= MaxPlayers {
		return fault("err.game_full", "game is full")
	}
	if name == "" {
		name = g.BotName()
	}
	g.Players = append(g.Players, &Player{
		ID: id, Name: name, Connected: true, Bot: true,
		Hand: []Card{}, Bank: []Card{}, Sets: []*PropertySet{},
	})
	g.log("log.joined", "name", name)
	return nil
}

// RemoveBot takes the last robot off the table. Lobby only.
func (g *Game) RemoveBot() error {
	if g.State != StateWaiting {
		return fault("err.bots_lobby_only", "bots can only be removed before the game starts")
	}
	for i := len(g.Players) - 1; i >= 0; i-- {
		if g.Players[i].Bot {
			name := g.Players[i].Name
			g.Players = append(g.Players[:i], g.Players[i+1:]...)
			g.log("log.left", "name", name)
			return nil
		}
	}
	return fault("err.no_bots", "no bots at this table")
}

// Remove takes a player off the table entirely. Lobby only for seated players.
func (g *Game) Remove(id string) {
	i := g.playerIndex(id)
	if i == -1 {
		return
	}
	g.Players = append(g.Players[:i], g.Players[i+1:]...)
	if g.CurrentTurn >= len(g.Players) {
		g.CurrentTurn = 0
	}
}

// Disconnect marks a player as away without removing their cards. In the lobby
// the seat is freed outright, so a stale player cannot block a new one.
func (g *Game) Disconnect(id string) {
	p := g.Player(id)
	if p == nil {
		return
	}
	p.Connected = false
	if g.State == StateWaiting {
		if i := g.playerIndex(id); i >= 0 {
			g.Players = append(g.Players[:i], g.Players[i+1:]...)
			g.log("log.left", "name", p.Name)
		}
		return
	}
	g.log("log.disconnected", "name", p.Name)
}

// Start deals the opening hands and begins the first turn.
func (g *Game) Start() error {
	return g.start(false, false)
}

// StartRandom starts a match from a random seat, then keeps the existing
// clockwise seat order. It is kept separate from Start so the deterministic
// game-unit helper remains useful, while every real player has an equal chance
// to lead without the table changing where everybody sits.
func (g *Game) StartRandom() error {
	return g.start(true, false)
}

// StartRandomScheduled starts a real match and leaves a short reveal window
// before the first turn. The server uses this so a wheel animation cannot
// race an already-live turn.
func (g *Game) StartRandomScheduled() error {
	return g.start(true, true)
}

func (g *Game) start(randomize, scheduled bool) error {
	if g.State == StatePlaying {
		return fault("err.already_started", "game already started")
	}
	if len(g.Players) < 2 {
		return fault("err.need_two_players", "need at least 2 players")
	}
	if !g.Mode.Available() {
		return fault("err.mode_unavailable", "that mode is not available yet")
	}
	if randomize && len(g.Players) > 1 {
		first := rand.IntN(len(g.Players))
		if first > 0 {
			clockwise := append([]*Player{}, g.Players[first:]...)
			clockwise = append(clockwise, g.Players[:first]...)
			g.Players = clockwise
		}
	}
	g.State = StatePlaying
	g.CurrentTurn = 0
	g.Pending = nil
	g.startNo++
	g.StartID = fmt.Sprintf("%s-start-%d", g.ID, g.startNo)
	// A scripted table deals nothing: every lesson builds its own situation,
	// and there is no wheel to decide who goes first on a table of one.
	if g.Mode == ModeTutorial {
		g.log("log.game_started", "mode", string(g.Mode), "players", len(g.Players))
		g.tutorialStart()
		return nil
	}
	g.StartSequence = make([]string, 0, len(g.Players))
	for _, p := range g.Players {
		g.StartSequence = append(g.StartSequence, p.ID)
	}
	for _, p := range g.Players {
		for i := 0; i < StartingHand; i++ {
			g.drawInto(p)
		}
	}
	g.log("log.game_started", "mode", string(g.Mode), "players", len(g.Players))
	if scheduled {
		// Deal the first player's opening draw now so the table is fully
		// populated while the reveal plays, but leave plays and the timer off.
		for i := 0; i < TurnDraw; i++ {
			g.drawInto(g.current())
		}
		g.PlaysLeft = 0
		g.StartAtMS = g.now().Add(StartRevealDelay).UnixMilli()
		// The visible deadline covers the reveal itself. Tick still treats
		// StartAtMS as authoritative and does not expire the turn here.
		g.DeadlineMS = g.StartAtMS
		g.DeadlineKind = "starting"
		g.DeadlineSeconds = int(StartRevealDelay / time.Second)
		return nil
	}
	g.StartAtMS = 0
	g.startTurn()
	return nil
}

// Label is the human-readable mode name.
func (m Mode) Label() string {
	switch m {
	case ModeDeathmatch:
		return "Death Match"
	case ModeGoldenRush:
		return "Golden Rush"
	case ModeTutorial:
		return "Tutorial"
	default:
		return "Classic"
	}
}

// Reset returns to the lobby with the same players seated and options kept.
func (g *Game) Reset() error {
	g.clearTable()
	g.log("log.table_cleared")
	return nil
}

// Terminate ends a game in progress and returns everyone to the lobby.
func (g *Game) Terminate(byID string) error {
	if g.State == StateWaiting {
		return fault("err.no_game", "no game in progress")
	}
	name := g.name(byID)
	g.clearTable()
	g.log("log.game_ended", "name", name)
	return nil
}

func (g *Game) clearTable() {
	g.Deck = GenerateDeck()
	g.DiscardPile = nil
	g.CurrentTurn = 0
	g.StartSequence = nil
	g.StartID = ""
	g.StartAtMS = 0
	g.State = StateWaiting
	g.WinnerID = ""
	g.PlaysLeft = 0
	g.Pending = nil
	g.clearDeadline()
	for _, p := range g.Players {
		p.Hand = []Card{}
		p.Bank = []Card{}
		p.Sets = []*PropertySet{}
	}
}

func (g *Game) drawCard() (Card, bool) {
	if len(g.Deck) == 0 {
		if len(g.DiscardPile) == 0 {
			return Card{}, false
		}
		g.Deck = g.DiscardPile
		g.DiscardPile = nil
		Shuffle(g.Deck)
		g.log("log.reshuffled")
	}
	c := g.Deck[0]
	g.Deck = g.Deck[1:]
	return c, true
}

func (g *Game) drawInto(p *Player) bool {
	c, ok := g.drawCard()
	if !ok {
		return false
	}
	p.Hand = append(p.Hand, c)
	return true
}

func (g *Game) current() *Player { return g.Players[g.CurrentTurn] }

func (g *Game) startTurn() {
	g.startTurnWithDraw(true)
}

func (g *Game) startTurnWithDraw(draw bool) {
	p := g.current()
	g.PlaysLeft = PlaysPerTurn
	if draw {
		n := TurnDraw
		if len(p.Hand) == 0 {
			n = EmptyHandDraw
		}
		for i := 0; i < n; i++ {
			g.drawInto(p)
		}
	}
	g.setDeadline("turn")
	g.log("log.turn", "name", p.Name)
}

// tutorialStart takes over from the normal deal on a scripted table.
func (g *Game) tutorialStart() {
	g.State = StatePlaying
	g.StartAtMS = 0
	g.StartSequence = nil
	g.startTutorial()
}

// deadlineSeconds is the window length for the thing we are waiting on.
func (g *Game) deadlineSeconds(kind string) int {
	if kind == "respond" && g.Pending != nil && g.Pending.Kind == PendingPayment {
		return g.respondSeconds()
	}
	return g.TurnSeconds
}

// respondSeconds is the per-player answer window this table was set up with.
func (g *Game) respondSeconds() int {
	if g.RespondSeconds < 0 {
		return 0
	}
	return g.RespondSeconds
}

// stampTargets starts every target's own clock. Called once, when the action
// is played: that is the moment all of them are answering from.
func (g *Game) stampTargets(pd *Pending) {
	secs := g.respondSeconds()
	if secs <= 0 {
		return
	}
	due := g.now().Add(time.Duration(secs) * time.Second).UnixMilli()
	for _, t := range pd.Targets {
		t.DeadlineMS = due
	}
}

// restampTarget gives one target a fresh window, for when a Just Say No hands
// the decision to somebody who has not had a chance to think about it yet.
func (g *Game) restampTarget(t *Target) {
	secs := g.respondSeconds()
	if secs <= 0 {
		t.DeadlineMS = 0
		return
	}
	t.DeadlineMS = g.now().Add(time.Duration(secs) * time.Second).UnixMilli()
}

// nextTargetDeadline is the soonest answer still outstanding, which is when
// the table next has to do something about a target that ran out of time.
func (g *Game) nextTargetDeadline() int64 {
	var soonest int64
	if g.Pending == nil {
		return 0
	}
	for _, t := range g.Pending.Targets {
		if t.Settled || t.DeadlineMS == 0 {
			continue
		}
		if soonest == 0 || t.DeadlineMS < soonest {
			soonest = t.DeadlineMS
		}
	}
	return soonest
}

// TargetDeadline is the answer due from one player, for their own countdown.
// Zero means this player is not being waited on, or the table has no limit.
func (g *Game) TargetDeadline(playerID string) int64 {
	if g.Pending == nil {
		return 0
	}
	for _, t := range g.Pending.Targets {
		if t.Settled || t.Responder != playerID {
			continue
		}
		return t.DeadlineMS
	}
	return 0
}

func (g *Game) clearDeadline() {
	g.DeadlineMS = 0
	g.DeadlineKind = ""
	g.DeadlineSeconds = 0
	g.turnDeadlineMS = 0
	g.paymentPausedAt = time.Time{}
}

func (g *Game) setDeadline(kind string) {
	if kind == "turn" {
		secs := g.TurnSeconds
		if g.State != StatePlaying || secs <= 0 {
			g.clearDeadline()
			return
		}
		g.turnDeadlineMS = g.now().Add(time.Duration(secs) * time.Second).UnixMilli()
		g.DeadlineMS = g.turnDeadlineMS
		g.DeadlineKind = "turn"
		g.DeadlineSeconds = secs
		return
	}
	secs := g.deadlineSeconds(kind)
	if g.State != StatePlaying || secs <= 0 {
		g.DeadlineMS = 0
		g.DeadlineKind = ""
		g.DeadlineSeconds = 0
		return
	}
	// A response to a non-payment action uses the remaining turn window. Only
	// payment gets a fresh, separate grace timer.
	if g.Pending == nil || g.Pending.Kind != PendingPayment {
		if g.turnDeadlineMS == 0 {
			g.clearDeadline()
			return
		}
		g.DeadlineMS = g.turnDeadlineMS
		g.DeadlineKind = "respond"
		g.DeadlineSeconds = g.TurnSeconds
		return
	}
	// The table's clock is only ever the soonest outstanding answer. Each
	// target owns its own; this is the tick that acts on whichever runs out
	// first.
	g.DeadlineMS = g.nextTargetDeadline()
	g.DeadlineKind = kind
	g.DeadlineSeconds = secs
	if g.DeadlineMS == 0 {
		g.DeadlineKind = ""
		g.DeadlineSeconds = 0
	}
}

// PostAction re-checks the win condition and the countdown. The server calls it
// after every accepted message so no mutator can forget.
func (g *Game) PostAction() {
	g.evaluateWin()
	if g.Mode == ModeTutorial {
		g.tutorialPostAction()
		g.clearDeadline()
		return
	}
	if g.State != StatePlaying {
		g.clearDeadline()
		return
	}
	if g.StartAtMS != 0 {
		return
	}
	if g.Pending != nil {
		if g.Pending.Kind == PendingPayment {
			if g.paymentPausedAt.IsZero() {
				g.paymentPausedAt = g.now()
			}
			// Payment pauses the turn clock; each target answers on the
			// window it was given when the card was played.
			g.DeadlineMS = g.nextTargetDeadline()
			g.DeadlineKind = "respond"
			g.DeadlineSeconds = g.respondSeconds()
			if g.DeadlineMS == 0 {
				g.DeadlineKind = ""
				g.DeadlineSeconds = 0
			}
			return
		}
		// Other responses share the original turn deadline. Playing or
		// answering an action must never extend it.
		if g.turnDeadlineMS == 0 {
			g.clearDeadline()
			return
		}
		g.DeadlineMS = g.turnDeadlineMS
		g.DeadlineKind = "respond"
		g.DeadlineSeconds = g.TurnSeconds
		return
	}
	if !g.paymentPausedAt.IsZero() {
		// Resume the turn with exactly the time that remained before payment
		// began, plus the duration spent resolving the payment.
		if g.turnDeadlineMS != 0 {
			pausedMS := g.now().Sub(g.paymentPausedAt).Milliseconds()
			if pausedMS > 0 {
				g.turnDeadlineMS += pausedMS
			}
		}
		g.paymentPausedAt = time.Time{}
	}
	if g.turnDeadlineMS == 0 {
		g.clearDeadline()
		return
	}
	g.DeadlineMS = g.turnDeadlineMS
	g.DeadlineKind = "turn"
	g.DeadlineSeconds = g.TurnSeconds
}

// Tick applies timeouts. It reports whether anything changed.
func (g *Game) Tick(now time.Time) bool {
	if g.State != StatePlaying {
		return false
	}
	if g.StartAtMS != 0 {
		if now.UnixMilli() < g.StartAtMS {
			return false
		}
		g.StartAtMS = 0
		g.startTurnWithDraw(false)
		return true
	}
	if g.DeadlineMS == 0 {
		return false
	}
	if now.UnixMilli() < g.DeadlineMS {
		return false
	}

	if pd := g.Pending; pd != nil {
		// Answer only for the players whose own window has run out. Everybody
		// else is still inside the time they were given when the card landed.
		for _, t := range append([]*Target{}, pd.Targets...) {
			if g.Pending == nil {
				break
			}
			if t.Settled {
				continue
			}
			if t.DeadlineMS != 0 && now.UnixMilli() < t.DeadlineMS {
				continue
			}
			if t.Responder == pd.ByID {
				g.log("log.timeout_respond", "name", g.name(pd.ByID))
				g.Respond(pd.ByID, false, nil)
				continue
			}
			payer := g.Player(t.PlayerID)
			g.log("log.timeout_respond", "name", g.name(t.PlayerID))
			if pd.Kind == PendingPayment && payer != nil {
				g.Respond(t.PlayerID, false, g.autoPayIDs(payer, t.Amount))
			} else {
				g.Respond(t.PlayerID, false, nil)
			}
		}
		g.PostAction()
		return true
	}

	p := g.current()
	g.log("log.timeout_turn", "name", p.Name)
	g.EndTurn(p.ID)
	g.PostAction()
	return true
}

// autoPayIDs picks assets to cover a debt, spending cash before property.
func (g *Game) autoPayIDs(p *Player, amount int) []string {
	type asset struct {
		id     string
		value  int
		isProp bool
	}
	var list []asset
	for _, c := range p.Bank {
		list = append(list, asset{c.ID, c.Value, false})
	}
	for _, s := range p.Sets {
		for _, c := range s.Cards {
			list = append(list, asset{c.ID, c.Value, true})
		}
		for _, c := range s.Buildings {
			list = append(list, asset{c.ID, c.Value, true})
		}
	}
	sort.SliceStable(list, func(i, j int) bool {
		if list[i].isProp != list[j].isProp {
			return !list[i].isProp
		}
		return list[i].value < list[j].value
	})

	var ids []string
	total := 0
	for _, a := range list {
		if total >= amount {
			break
		}
		ids = append(ids, a.id)
		total += a.value
	}
	return ids
}

// requireTurn validates that it is playerID's turn and nothing is pending.
func (g *Game) requireTurn(playerID string) (*Player, error) {
	if g.State != StatePlaying {
		return nil, fault("err.no_game", "game is not in progress")
	}
	if g.StartAtMS != 0 {
		return nil, fault("err.game_starting", "the starting order is being revealed")
	}
	if g.Pending != nil {
		return nil, fault("err.resolve_first", "resolve the current action first")
	}
	if g.CurrentTurn < 0 || g.CurrentTurn >= len(g.Players) {
		return nil, fault("err.invalid_game_state", "the current turn is invalid")
	}
	idx := g.playerIndex(playerID)
	if idx == -1 {
		return nil, fault("err.player_not_found", "player not found")
	}
	if idx != g.CurrentTurn {
		return nil, fault("err.not_your_turn", "not your turn")
	}
	return g.Players[idx], nil
}

func (g *Game) requirePlay(playerID string) (*Player, error) {
	p, err := g.requireTurn(playerID)
	if err != nil {
		return nil, err
	}
	if g.PlaysLeft <= 0 {
		return nil, fault("err.no_plays_left", "no plays left this turn")
	}
	return p, nil
}

func takeFromHand(p *Player, cardID string) (Card, error) {
	for i, c := range p.Hand {
		if c.ID == cardID {
			p.Hand = append(p.Hand[:i], p.Hand[i+1:]...)
			return c, nil
		}
	}
	return Card{}, fault("err.card_not_in_hand", "card not in your hand")
}

func peekHand(p *Player, cardID string) (Card, error) {
	for _, c := range p.Hand {
		if c.ID == cardID {
			return c, nil
		}
	}
	return Card{}, fault("err.card_not_in_hand", "card not in your hand")
}

// EndTurn passes play to the next player. A hand still over the limit is not
// the player's to fix any more — the choice of what to keep already happened
// in the plays they made, so what is left over is dropped for them.
func (g *Game) EndTurn(playerID string) error {
	p, err := g.requireTurn(playerID)
	if err != nil {
		return err
	}
	g.discardExcess(p)
	g.CurrentTurn = (g.CurrentTurn + 1) % len(g.Players)
	g.startTurn()
	return nil
}

// discardExcess drops random cards from p's hand until it is back at
// HandLimit, logging one line naming the player and how many went. Random
// rather than chosen: nothing is left for the player to decide once their
// turn is over.
func (g *Game) discardExcess(p *Player) {
	over := len(p.Hand) - HandLimit
	if over <= 0 {
		return
	}
	for i := 0; i < over; i++ {
		idx := rand.IntN(len(p.Hand))
		c := p.Hand[idx]
		p.Hand = append(p.Hand[:idx], p.Hand[idx+1:]...)
		g.DiscardPile = append(g.DiscardPile, c)
	}
	g.log("log.discarded_excess", "name", p.Name, "count", over)
}

// PlayToBank banks a money or action card as cash.
func (g *Game) PlayToBank(playerID, cardID string) error {
	p, err := g.requirePlay(playerID)
	if err != nil {
		return err
	}
	c, err := peekHand(p, cardID)
	if err != nil {
		return err
	}
	if c.IsProperty() {
		return fault("err.no_banking_property", "property cards cannot be banked")
	}
	c, _ = takeFromHand(p, cardID)
	p.Bank = append(p.Bank, c)
	g.PlaysLeft--
	// Money cards say their own value, so naming the card as well would read
	// "banked $5M ($5M)".
	if c.Type == CardTypeMoney {
		g.log("log.banked_money", "name", p.Name, "amount", c.Value)
	} else {
		g.log("log.banked", "name", p.Name, "card", c.Key, "amount", c.Value)
	}
	g.evaluateWin()
	return nil
}

// PlayProperty lays a property card into a colour set.
func (g *Game) PlayProperty(playerID, cardID string, color Color) error {
	p, err := g.requirePlay(playerID)
	if err != nil {
		return err
	}
	c, err := peekHand(p, cardID)
	if err != nil {
		return err
	}
	if !c.IsProperty() {
		return fault("err.not_a_property", "that is not a property card")
	}
	if color == "" || color == ColorAny {
		return fault("err.choose_colour", "choose a colour for this property")
	}
	if !c.Accepts(color) {
		return fault("err.wrong_colour", fmt.Sprintf("%s cannot be played as %s", c.Name, color), "card", c.Key, "color", string(color))
	}
	c, _ = takeFromHand(p, cardID)
	s := p.ensureSet(color)
	s.Cards = append(s.Cards, c)
	g.PlaysLeft--
	g.log("log.played_property", "name", p.Name, "card", c.Key, "color", string(color))
	g.checkWin(p)
	return nil
}

// ReassignWildcard moves a wildcard already in play to another colour. It
// costs one play, like any other card you put down. An any-colour wildcard may
// only move onto a colour the player already has property in — it cannot open
// a set on its own.
func (g *Game) ReassignWildcard(playerID, cardID string, color Color) error {
	p, err := g.requirePlay(playerID)
	if err != nil {
		return err
	}
	for _, s := range p.Sets {
		for i, c := range s.Cards {
			if c.ID != cardID {
				continue
			}
			if c.Type != CardTypePropertyWildcard {
				return fault("err.only_wildcards_move", "only wildcards can be moved")
			}
			if !c.Accepts(color) {
				return fault("err.wrong_colour", fmt.Sprintf("%s cannot be played as %s", c.Name, color), "card", c.Key, "color", string(color))
			}
			if s.Color == color {
				return fault("err.already_that_colour", "already that colour")
			}
			if c.IsWildAny() {
				dst := p.setFor(color)
				if dst == nil || len(dst.Cards) == 0 {
					return fault("err.wild_any_needs_set",
						fmt.Sprintf("you have no %s property to join", color), "color", string(color))
				}
			}
			s.Cards = append(s.Cards[:i], s.Cards[i+1:]...)
			dst := p.ensureSet(color)
			dst.Cards = append(dst.Cards, c)
			p.pruneSets()
			g.PlaysLeft--
			g.log("log.moved_wildcard", "name", p.Name, "card", c.Key, "color", string(color))
			g.checkWin(p)
			return nil
		}
	}
	return fault("err.wildcard_not_in_play", "wildcard not found in your sets")
}

// hasWon applies the current mode's win condition.
func (g *Game) hasWon(p *Player) bool {
	if p.CompleteSets() < SetsToWin {
		return false
	}
	if g.Mode == ModeDeathmatch {
		return len(p.Hand) == 0
	}
	return true
}

func (g *Game) checkWin(p *Player) {
	if g.State != StatePlaying || !g.hasWon(p) {
		return
	}
	g.State = StateFinished
	g.WinnerID = p.ID
	g.Pending = nil
	g.clearDeadline()
	if g.Mode == ModeDeathmatch {
		g.log("log.win_deathmatch", "name", p.Name, "sets", p.CompleteSets())
	} else {
		g.log("log.win_classic", "name", p.Name, "sets", p.CompleteSets())
	}
}

// evaluateWin checks every player, since a Just Say No can empty a hand on
// someone else's turn.
func (g *Game) evaluateWin() {
	if g.State != StatePlaying {
		return
	}
	// Half the lessons put finished sets in front of the learner so there is
	// something to charge rent on or build a house upon. Only the last lesson
	// is about winning, so until then the table cannot end.
	if g.tutorialHoldsWin() {
		return
	}
	for _, p := range g.Players {
		if g.hasWon(p) {
			g.checkWin(p)
			return
		}
	}
}

func (g *Game) opponents(playerID string) []*Player {
	var out []*Player
	for _, p := range g.Players {
		if p.ID != playerID {
			out = append(out, p)
		}
	}
	return out
}
