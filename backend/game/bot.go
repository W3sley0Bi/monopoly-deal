package game

import (
	"math/rand/v2"
	"sort"
)

// Bots play a seat the server drives itself. They see only what a real player
// at that seat would see — their own hand and everyone's table — so the same
// rules engine decides every move they make.

// botNames are handed out in order, so a table's robots stay distinguishable.
var botNames = []string{"Otto", "Rosie", "Bender", "Clank", "Wall-D"}

// BotName returns a free robot name for a table.
func (g *Game) BotName() string {
	taken := map[string]bool{}
	for _, p := range g.Players {
		taken[p.Name] = true
	}
	for _, n := range botNames {
		name := "🤖 " + n
		if !taken[name] {
			return name
		}
	}
	return "🤖 Bot"
}

// Bots counts the seats held by robots.
func (g *Game) Bots() int {
	n := 0
	for _, p := range g.Players {
		if p.Bot {
			n++
		}
	}
	return n
}

// HumanPlayers counts the seats held by people.
func (g *Game) HumanPlayers() int { return len(g.Players) - g.Bots() }

// BotWaiting reports whether the game is stuck on a robot's decision, so the
// caller knows to schedule a step.
func (g *Game) BotWaiting() bool {
	if g.State != StatePlaying {
		return false
	}
	if pd := g.Pending; pd != nil {
		for _, t := range pd.Targets {
			if t.Settled {
				continue
			}
			if p := g.Player(t.Responder); p != nil && p.Bot {
				return true
			}
		}
		return false
	}
	return g.current().Bot
}

// BotAct performs at most one move for whichever robot the game is waiting on.
// It reports whether anything changed, so the caller knows to broadcast.
func (g *Game) BotAct() bool {
	if g.State != StatePlaying {
		return false
	}
	if pd := g.Pending; pd != nil {
		for _, t := range pd.Targets {
			if t.Settled {
				continue
			}
			p := g.Player(t.Responder)
			if p == nil || !p.Bot {
				continue
			}
			return g.botRespond(pd, t, p)
		}
		return false
	}
	p := g.current()
	if !p.Bot {
		return false
	}
	return g.botTurn(p)
}

// botRespond answers a pending action aimed at (or bounced back to) a robot.
// How readily it defends itself is the difficulty setting: an easy robot never
// plays Just Say No, a hard one plays it on anything that costs it something.
func (g *Game) botRespond(pd *Pending, t *Target, p *Player) bool {
	level := g.difficulty()
	sayNo := false
	switch {
	case level == DifficultyEasy:
		sayNo = false
	case t.Responder == pd.ByID:
		// The robot's own action was blocked: fight back for the big ones.
		sayNo = p.hasJustSayNo() && (pd.Kind == PendingDealBreaker ||
			(level == DifficultyHard && pd.Action == ActionSlyDeal))
	case pd.Kind == PendingDealBreaker:
		sayNo = p.hasJustSayNo()
	case pd.Kind == PendingSlyDeal, pd.Kind == PendingForcedDeal:
		sayNo = p.hasJustSayNo() && (level == DifficultyHard || g.botValuesCard(p, pd.TargetCardID))
	case pd.Kind == PendingPayment:
		// Only burn a Just Say No on a debt that would cost real property.
		threshold := 3
		if level == DifficultyHard {
			threshold = 2
		}
		sayNo = p.hasJustSayNo() && t.Amount > p.BankTotal() && t.Amount >= threshold
	}

	if sayNo {
		return g.Respond(p.ID, true, nil) == nil
	}
	if t.Responder == pd.ByID || pd.Kind != PendingPayment {
		return g.Respond(p.ID, false, nil) == nil
	}
	return g.Respond(p.ID, false, g.autoPayIDs(p, t.Amount)) == nil
}

// botValuesCard reports whether losing this card would hurt: it sits in a set
// that is one card short of complete, or it is simply expensive.
func (g *Game) botValuesCard(p *Player, cardID string) bool {
	for _, s := range p.Sets {
		for _, c := range s.Cards {
			if c.ID != cardID {
				continue
			}
			return len(s.Cards) >= SetSize(s.Color)-1 || c.Value >= 3
		}
	}
	return false
}

// botTurn takes one step of a robot's turn: a play, a discard, or the end of
// the turn. One step per call keeps the moves visible at human speed.
func (g *Game) botTurn(p *Player) bool {
	// An easy robot often leaves a play on the table, the way a new player
	// does; every other level uses its whole turn.
	dawdles := g.difficulty() == DifficultyEasy && g.PlaysLeft < PlaysPerTurn &&
		len(p.Hand) <= HandLimit && rand.IntN(3) == 0
	if g.PlaysLeft > 0 && !dawdles && g.botPlay(p) {
		return true
	}
	if len(p.Hand) > HandLimit {
		return g.Discard(p.ID, g.botDiscardID(p)) == nil
	}
	return g.EndTurn(p.ID) == nil
}

// botDiscardID picks the least useful card in hand.
func (g *Game) botDiscardID(p *Player) string {
	best := p.Hand[0]
	score := botKeepScore(best)
	for _, c := range p.Hand[1:] {
		if s := botKeepScore(c); s < score {
			best, score = c, s
		}
	}
	return best.ID
}

// botKeepScore ranks how much a robot wants to keep a card in hand.
func botKeepScore(c Card) int {
	switch {
	case c.Action == ActionJustSayNo:
		return 100
	case c.IsProperty():
		return 50 + c.Value
	case c.Type == CardTypeAction, c.Type == CardTypeRent:
		return 20 + c.Value
	default:
		return c.Value
	}
}

// botPlay tries the robot's move list in priority order and stops at the first
// one the rules accept. The list itself is the difficulty: an easy robot only
// plays its own cards, a normal one attacks, a hard one attacks first.
func (g *Game) botPlay(p *Player) bool {
	var moves []func(*Player) bool
	switch g.difficulty() {
	case DifficultyEasy:
		// Builds its own board and banks the rest. Harmless, but it still
		// wins if you leave it alone long enough.
		moves = []func(*Player) bool{
			g.botProperty,
			g.botPassGo,
			g.botBank,
		}
		// Now and then it does reach for an action card. Without that a table
		// of easy robots can freeze: once every property is sitting in an
		// incomplete set, nothing but a steal can move the game on.
		if rand.IntN(4) == 0 {
			moves = append([]func(*Player) bool{
				g.botSlyDeal,
				g.botForcedDeal,
				g.botRent,
			}, moves...)
		}
	case DifficultyHard:
		moves = []func(*Player) bool{
			g.botDealBreaker,
			g.botRent,
			g.botSlyDeal,
			g.botForcedDeal,
			g.botProperty,
			g.botBuilding,
			g.botDebtCollector,
			g.botBirthday,
			g.botPassGo,
			g.botBank,
		}
	default:
		moves = []func(*Player) bool{
			g.botDealBreaker,
			g.botProperty,
			g.botBuilding,
			g.botRent,
			g.botSlyDeal,
			g.botForcedDeal,
			g.botDebtCollector,
			g.botBirthday,
			g.botPassGo,
			g.botBank,
		}
	}
	for _, try := range moves {
		if try(p) {
			return true
		}
	}
	return false
}

func (g *Game) hand(p *Player, action ActionType) (Card, bool) {
	for _, c := range p.Hand {
		if c.Action == action && c.Type == CardTypeAction {
			return c, true
		}
	}
	return Card{}, false
}

// botDealBreaker takes the richest complete set on the table.
func (g *Game) botDealBreaker(p *Player) bool {
	c, ok := g.hand(p, ActionDealBreaker)
	if !ok {
		return false
	}
	var bestOpp *Player
	var bestSet *PropertySet
	for _, o := range g.opponents(p.ID) {
		for _, s := range o.Sets {
			if !s.IsComplete() {
				continue
			}
			if bestSet == nil || s.Rent() > bestSet.Rent() {
				bestOpp, bestSet = o, s
			}
		}
	}
	if bestSet == nil {
		return false
	}
	return g.PlayAction(p.ID, c.ID, ActionOptions{
		TargetPlayerID: bestOpp.ID, Color: bestSet.Color,
	}) == nil
}

// botProperty lays the property that makes the most progress towards a set.
func (g *Game) botProperty(p *Player) bool {
	type move struct {
		cardID string
		color  Color
		score  int
	}
	var best *move
	for _, c := range p.Hand {
		if !c.IsProperty() {
			continue
		}
		for _, col := range c.PlayableColors() {
			held := 0
			if s := p.setFor(col); s != nil {
				held = len(s.Cards)
			}
			size := SetSize(col)
			if held >= size {
				continue // already complete
			}
			// Finishing a set beats everything; otherwise prefer the colour
			// closest to done, and break ties towards cheap colours to fill.
			score := held * 10
			if held+1 >= size {
				score += 200
			}
			score += RentFor(col, held+1, false, false)
			if g.difficulty() == DifficultyEasy {
				// Still heads towards a set — otherwise it would scatter
				// properties and never finish — but without the sharp
				// preference for the colour that wins soonest.
				score = held * 8
				if held+1 >= size {
					score += 60
				}
				score += rand.IntN(10)
			}
			if best == nil || score > best.score {
				best = &move{c.ID, col, score}
			}
		}
	}
	if best == nil {
		return false
	}
	return g.PlayProperty(p.ID, best.cardID, best.color) == nil
}

// botBuilding drops a house, then a hotel, on the best finished set.
func (g *Game) botBuilding(p *Player) bool {
	for _, action := range []ActionType{ActionHouse, ActionHotel} {
		c, ok := g.hand(p, action)
		if !ok {
			continue
		}
		for _, s := range p.Sets {
			if !s.IsComplete() || !CanBuild(s.Color) {
				continue
			}
			if g.PlayAction(p.ID, c.ID, ActionOptions{Color: s.Color}) == nil {
				return true
			}
		}
	}
	return false
}

// botRent charges the largest rent it can, doubling it when that is affordable.
func (g *Game) botRent(p *Player) bool {
	var bestCard Card
	var bestColor Color
	best := 0
	for _, c := range p.Hand {
		if c.Type != CardTypeRent {
			continue
		}
		for _, col := range c.PlayableColors() {
			s := p.setFor(col)
			if s == nil || s.Rent() <= 0 {
				continue
			}
			if s.Rent() > best {
				bestCard, bestColor, best = c, col, s.Rent()
			}
		}
	}
	if best == 0 {
		return false
	}
	opt := ActionOptions{Color: bestColor}
	if bestCard.IsWildAny() {
		if o := g.botRichestOpponent(p); o != nil {
			opt.TargetPlayerID = o.ID
		} else {
			return false
		}
	}
	// Double The Rent is worth a play only on a rent that already bites, and
	// only a hard robot bothers to look for it.
	if best >= 3 && g.difficulty() == DifficultyHard {
		for _, c := range p.Hand {
			if c.Action == ActionDoubleRent && g.PlaysLeft >= 2+len(opt.DoubleCardIDs) {
				opt.DoubleCardIDs = append(opt.DoubleCardIDs, c.ID)
				break
			}
		}
	}
	if g.PlayAction(p.ID, bestCard.ID, opt) == nil {
		return true
	}
	// Fall back to the plain charge if the doubled one was refused.
	opt.DoubleCardIDs = nil
	return g.PlayAction(p.ID, bestCard.ID, opt) == nil
}

// botTargets ranks the properties a robot would most like to own.
func (g *Game) botStealTarget(p *Player) (*Player, Card, Color) {
	var bestOpp *Player
	var bestCard Card
	var bestColor Color
	best := -1
	for _, o := range g.opponents(p.ID) {
		for _, s := range o.Sets {
			if s.IsComplete() {
				continue
			}
			for _, c := range s.Cards {
				held := 0
				if mine := p.setFor(s.Color); mine != nil {
					held = len(mine.Cards)
				}
				score := c.Value
				if held+1 >= SetSize(s.Color) {
					score += 100 // completes one of ours
				}
				score += held * 5
				if score > best {
					bestOpp, bestCard, bestColor, best = o, c, s.Color, score
				}
			}
		}
	}
	return bestOpp, bestCard, bestColor
}

func (g *Game) botSlyDeal(p *Player) bool {
	c, ok := g.hand(p, ActionSlyDeal)
	if !ok {
		return false
	}
	o, card, _ := g.botStealTarget(p)
	if o == nil {
		return false
	}
	return g.PlayAction(p.ID, c.ID, ActionOptions{
		TargetPlayerID: o.ID, TargetCardID: card.ID,
	}) == nil
}

func (g *Game) botForcedDeal(p *Player) bool {
	c, ok := g.hand(p, ActionForcedDeal)
	if !ok {
		return false
	}
	o, card, _ := g.botStealTarget(p)
	if o == nil {
		return false
	}
	// Offer the loneliest card we own, so we break up nothing important.
	var give *Card
	giveScore := 1 << 30
	for _, s := range p.Sets {
		if s.IsComplete() {
			continue
		}
		for _, own := range s.Cards {
			score := own.Value + len(s.Cards)*3
			if score < giveScore {
				copy := own
				give, giveScore = &copy, score
			}
		}
	}
	if give == nil {
		return false
	}
	return g.PlayAction(p.ID, c.ID, ActionOptions{
		TargetPlayerID: o.ID, TargetCardID: card.ID, GiveCardID: give.ID,
	}) == nil
}

func (g *Game) botRichestOpponent(p *Player) *Player {
	opps := g.opponents(p.ID)
	sort.SliceStable(opps, func(i, j int) bool {
		return opps[i].AssetTotal() > opps[j].AssetTotal()
	})
	if len(opps) == 0 {
		return nil
	}
	return opps[0]
}

func (g *Game) botDebtCollector(p *Player) bool {
	c, ok := g.hand(p, ActionDebtCollector)
	if !ok {
		return false
	}
	o := g.botRichestOpponent(p)
	if o == nil || o.AssetTotal() == 0 {
		return false
	}
	return g.PlayAction(p.ID, c.ID, ActionOptions{TargetPlayerID: o.ID}) == nil
}

func (g *Game) botBirthday(p *Player) bool {
	c, ok := g.hand(p, ActionBirthday)
	if !ok {
		return false
	}
	for _, o := range g.opponents(p.ID) {
		if o.AssetTotal() > 0 {
			return g.PlayAction(p.ID, c.ID, ActionOptions{}) == nil
		}
	}
	return false
}

func (g *Game) botPassGo(p *Player) bool {
	c, ok := g.hand(p, ActionPassGo)
	if !ok || len(p.Hand) > HandLimit {
		return false
	}
	return g.PlayAction(p.ID, c.ID, ActionOptions{}) == nil
}

// botBank turns whatever is left into cash, keeping the cards worth holding.
func (g *Game) botBank(p *Player) bool {
	var pick *Card
	for i, c := range p.Hand {
		if c.IsProperty() || c.Action == ActionJustSayNo {
			continue
		}
		// Keep one Double The Rent while a rent card is still in hand.
		if c.Action == ActionDoubleRent && botHasRent(p) {
			continue
		}
		if pick == nil || c.Value > pick.Value {
			card := p.Hand[i]
			pick = &card
		}
	}
	if pick == nil {
		return false
	}
	return g.PlayToBank(p.ID, pick.ID) == nil
}

func botHasRent(p *Player) bool {
	for _, c := range p.Hand {
		if c.Type == CardTypeRent {
			return true
		}
	}
	return false
}
