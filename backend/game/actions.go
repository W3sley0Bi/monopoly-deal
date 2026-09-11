package game

import "fmt"

// ActionOptions carries the choices a player makes when playing an action card.
type ActionOptions struct {
	Color          Color    `json:"color,omitempty"`
	TargetPlayerID string   `json:"target_player_id,omitempty"`
	TargetCardID   string   `json:"target_card_id,omitempty"`
	GiveCardID     string   `json:"give_card_id,omitempty"`
	DoubleCardIDs  []string `json:"double_card_ids,omitempty"`
}

// PlayAction plays an action or rent card for its effect.
func (g *Game) PlayAction(playerID, cardID string, opt ActionOptions) error {
	p, err := g.requirePlay(playerID)
	if err != nil {
		return err
	}
	c, err := peekHand(p, cardID)
	if err != nil {
		return err
	}
	if c.Type != CardTypeAction && c.Type != CardTypeRent {
		return fault("err.no_action", "that card has no action")
	}
	switch c.Action {
	case ActionJustSayNo:
		return fault("err.jsn_response_only", "Just Say No can only be played in response")
	case ActionDoubleRent:
		return fault("err.double_rent_with_rent", "Double The Rent must be played together with a rent card")
	}
	if len(g.opponents(playerID)) == 0 {
		return fault("err.no_opponents", "no opponents")
	}

	switch {
	case c.Type == CardTypeRent:
		return g.playRent(p, c, opt)
	case c.Action == ActionPassGo:
		return g.playPassGo(p, c)
	case c.Action == ActionHouse || c.Action == ActionHotel:
		return g.playBuilding(p, c, opt.Color)
	case c.Action == ActionBirthday:
		return g.startPayment(p, c, nil, 2, "pending.birthday", nil, nil)
	case c.Action == ActionDebtCollector:
		t, err := g.opponent(p, opt.TargetPlayerID)
		if err != nil {
			return err
		}
		return g.startPayment(p, c, []*Player{t}, 5, "pending.debt_collector", nil, nil)
	case c.Action == ActionSlyDeal:
		return g.playSlyDeal(p, c, opt)
	case c.Action == ActionForcedDeal:
		return g.playForcedDeal(p, c, opt)
	case c.Action == ActionDealBreaker:
		return g.playDealBreaker(p, c, opt)
	}
	return fault("err.unsupported_card", "unsupported card")
}

func (g *Game) opponent(p *Player, id string) (*Player, error) {
	if id == "" {
		return nil, fault("err.choose_target", "choose a target player")
	}
	if id == p.ID {
		return nil, fault("err.no_self_target", "you cannot target yourself")
	}
	t := g.Player(id)
	if t == nil {
		return nil, fault("err.target_not_found", "target player not found")
	}
	return t, nil
}

func (g *Game) playPassGo(p *Player, c Card) error {
	c, _ = takeFromHand(p, c.ID)
	g.DiscardPile = append(g.DiscardPile, c)
	g.PlaysLeft--
	n := 0
	for i := 0; i < 2; i++ {
		if g.drawInto(p) {
			n++
		}
	}
	g.log("log.pass_go", "name", p.Name, "count", n)
	return nil
}

func (g *Game) playBuilding(p *Player, c Card, col Color) error {
	if col == "" {
		return fault("err.choose_set", "choose which complete set to build on")
	}
	s := p.setFor(col)
	if s == nil || !s.IsComplete() {
		return fault("err.needs_complete_set", fmt.Sprintf("%s needs a complete set", c.Name), "card", c.Key)
	}
	if !CanBuild(col) {
		return fault("err.cannot_build_here", "cannot build on railroads or utilities")
	}
	if c.Action == ActionHouse && s.has(ActionHouse) {
		return fault("err.has_house", "that set already has a house")
	}
	if c.Action == ActionHotel {
		if !s.has(ActionHouse) {
			return fault("err.house_before_hotel", "build a house before a hotel")
		}
		if s.has(ActionHotel) {
			return fault("err.has_hotel", "that set already has a hotel")
		}
	}
	c, _ = takeFromHand(p, c.ID)
	s.Buildings = append(s.Buildings, c)
	g.PlaysLeft--
	g.log("log.building", "name", p.Name, "card", c.Key, "color", string(col), "rent", s.Rent())
	return nil
}

func (g *Game) playRent(p *Player, c Card, opt ActionOptions) error {
	if opt.Color == "" {
		return fault("err.choose_rent_colour", "choose a colour to charge rent on")
	}
	if !c.Accepts(opt.Color) {
		return fault("err.rent_wrong_colour", fmt.Sprintf("%s cannot charge %s rent", c.Name, opt.Color), "card", c.Key, "color", string(opt.Color))
	}
	s := p.setFor(opt.Color)
	if s == nil || len(s.Cards) == 0 {
		return fault("err.no_properties_of_colour", fmt.Sprintf("you own no %s properties", opt.Color), "color", string(opt.Color))
	}
	amount := s.Rent()
	if amount <= 0 {
		return fault("err.no_rent", "that set charges no rent")
	}

	// Double The Rent cards cost one extra play each.
	var extra []Card
	for _, id := range opt.DoubleCardIDs {
		d, err := peekHand(p, id)
		if err != nil {
			return err
		}
		if d.Action != ActionDoubleRent {
			return fault("err.not_double_rent", "that is not a Double The Rent card")
		}
		extra = append(extra, d)
	}
	if g.PlaysLeft < 1+len(extra) {
		return fault("err.need_plays", fmt.Sprintf("need %d plays, you have %d", 1+len(extra), g.PlaysLeft), "need", 1+len(extra), "have", g.PlaysLeft)
	}
	for range extra {
		amount *= 2
	}

	targets := g.opponents(p.ID)
	labelKey := "pending.rent"
	labelArgs := map[string]any{"color": string(opt.Color)}
	if c.IsWildAny() {
		t, err := g.opponent(p, opt.TargetPlayerID)
		if err != nil {
			return err
		}
		targets = []*Player{t}
	}
	if len(extra) > 0 {
		labelKey = "pending.rent_multiplied"
		labelArgs["multiplier"] = 1 << len(extra)
	}
	for _, d := range extra {
		takeFromHand(p, d.ID)
		g.PlaysLeft--
	}
	return g.startPayment(p, c, targets, amount, labelKey, labelArgs, extra)
}

// startPayment creates a pending debt for each target. targets == nil means all opponents.
func (g *Game) startPayment(p *Player, c Card, targets []*Player, amount int, labelKey string, labelArgs map[string]any, extra []Card) error {
	if targets == nil {
		targets = g.opponents(p.ID)
	}
	c, _ = takeFromHand(p, c.ID)
	g.PlaysLeft--

	if labelArgs == nil {
		labelArgs = map[string]any{}
	}
	labelArgs["amount"] = amount
	pd := &Pending{
		Kind:      PendingPayment,
		Action:    c.Action,
		Card:      c,
		ByID:      p.ID,
		LabelKey:  labelKey,
		LabelArgs: labelArgs,
	}
	pd.extra = extra
	for _, t := range targets {
		pd.Targets = append(pd.Targets, &Target{
			PlayerID: t.ID, Amount: amount, Responder: t.ID,
		})
	}
	g.Pending = pd
	if len(pd.Targets) == len(g.Players)-1 && len(pd.Targets) > 1 {
		g.log("log.charge_everyone", "name", p.Name, "card", c.Key, "amount", amount)
	} else {
		g.log("log.charge", "name", p.Name, "card", c.Key, "targets", targetNames(g, pd), "amount", amount)
	}
	g.settleAuto()
	return nil
}

func targetNames(g *Game, pd *Pending) string {
	if len(pd.Targets) == len(g.Players)-1 && len(pd.Targets) > 1 {
		return "everyone"
	}
	out := ""
	for i, t := range pd.Targets {
		if i > 0 {
			out += ", "
		}
		out += g.name(t.PlayerID)
	}
	return out
}

func (g *Game) playSlyDeal(p *Player, c Card, opt ActionOptions) error {
	t, err := g.opponent(p, opt.TargetPlayerID)
	if err != nil {
		return err
	}
	s, _, err := findPropertyForSteal(t, opt.TargetCardID)
	if err != nil {
		return err
	}
	c, _ = takeFromHand(p, c.ID)
	g.PlaysLeft--
	g.Pending = &Pending{
		Kind: PendingSlyDeal, Action: c.Action, Card: c, ByID: p.ID,
		LabelKey:       "pending.sly_deal",
		TargetPlayerID: t.ID, TargetCardID: opt.TargetCardID, TargetColor: s.Color,
		Targets: []*Target{{PlayerID: t.ID, Responder: t.ID}},
	}
	g.log("log.sly_deal", "name", p.Name, "color", string(s.Color), "target", t.Name)
	g.settleAuto()
	return nil
}

func (g *Game) playForcedDeal(p *Player, c Card, opt ActionOptions) error {
	t, err := g.opponent(p, opt.TargetPlayerID)
	if err != nil {
		return err
	}
	theirs, _, err := findPropertyForSteal(t, opt.TargetCardID)
	if err != nil {
		return err
	}
	mine, _, err := findPropertyForSteal(p, opt.GiveCardID)
	if err != nil {
		return fmt.Errorf("card you offer: %w", err)
	}
	c, _ = takeFromHand(p, c.ID)
	g.PlaysLeft--
	g.Pending = &Pending{
		Kind: PendingForcedDeal, Action: c.Action, Card: c, ByID: p.ID,
		LabelKey:       "pending.forced_deal",
		TargetPlayerID: t.ID, TargetCardID: opt.TargetCardID, TargetColor: theirs.Color,
		GiveCardID: opt.GiveCardID,
		Targets:    []*Target{{PlayerID: t.ID, Responder: t.ID}},
	}
	g.log("log.forced_deal", "name", p.Name, "target", t.Name, "color", string(mine.Color))
	g.settleAuto()
	return nil
}

func (g *Game) playDealBreaker(p *Player, c Card, opt ActionOptions) error {
	t, err := g.opponent(p, opt.TargetPlayerID)
	if err != nil {
		return err
	}
	s := t.setFor(opt.Color)
	if s == nil || !s.IsComplete() {
		return fault("err.deal_breaker_needs_set", "Deal Breaker needs a complete set")
	}
	c, _ = takeFromHand(p, c.ID)
	g.PlaysLeft--
	g.Pending = &Pending{
		Kind: PendingDealBreaker, Action: c.Action, Card: c, ByID: p.ID,
		LabelKey:       "pending.deal_breaker",
		TargetPlayerID: t.ID, TargetColor: opt.Color,
		Targets: []*Target{{PlayerID: t.ID, Responder: t.ID}},
	}
	g.log("log.deal_breaker", "name", p.Name, "target", t.Name, "color", string(opt.Color))
	g.settleAuto()
	return nil
}

// findPropertyForSteal locates a property that may legally be taken or swapped.
func findPropertyForSteal(p *Player, cardID string) (*PropertySet, Card, error) {
	if cardID == "" {
		return nil, Card{}, fault("err.choose_property", "choose a property card")
	}
	for _, s := range p.Sets {
		for _, c := range s.Cards {
			if c.ID == cardID {
				if s.IsComplete() {
					return nil, Card{}, fault("err.complete_set_protected", "cannot take a card from a complete set")
				}
				return s, c, nil
			}
		}
	}
	return nil, Card{}, fault("err.property_not_found", "property not found")
}

// settleAuto settles targets that have nothing to decide, and resolves if done.
func (g *Game) settleAuto() {
	pd := g.Pending
	if pd == nil {
		return
	}
	for _, t := range pd.Targets {
		if t.Settled {
			continue
		}
		p := g.Player(t.PlayerID)
		if p == nil {
			t.Settled = true
			continue
		}
		// A player with no Just Say No and no assets can do nothing about a debt.
		if t.Responder == t.PlayerID && !t.Cancelled && !p.hasJustSayNo() {
			if pd.Kind == PendingPayment {
				if p.AssetTotal() == 0 {
					t.Settled = true
					t.Note = "had nothing to pay"
					g.log("log.nothing_to_pay", "name", p.Name)
				}
			} else {
				// No Just Say No means no way to stop a steal or swap.
				t.Settled = true
			}
		}
		if t.Responder == pd.ByID {
			by := g.Player(pd.ByID)
			if by == nil || !by.hasJustSayNo() {
				t.Settled = true
			}
		}
	}
	g.resolveIfDone()
}

// Respond answers a pending action. sayNo plays a Just Say No card.
func (g *Game) Respond(playerID string, sayNo bool, cardIDs []string) error {
	pd := g.Pending
	if pd == nil {
		return fault("err.nothing_to_respond", "nothing to respond to")
	}
	var t *Target
	if playerID == pd.ByID {
		// The instigator answers whichever target bounced back to them.
		for _, x := range pd.Targets {
			if !x.Settled && x.Responder == pd.ByID {
				t = x
				break
			}
		}
	} else {
		t = pd.target(playerID)
		if t != nil && (t.Settled || t.Responder != playerID) {
			t = nil
		}
	}
	if t == nil {
		return fault("err.not_your_response", "it is not your turn to respond")
	}
	p := g.Player(playerID)

	if sayNo {
		jsnID := ""
		for _, c := range p.Hand {
			if c.Action == ActionJustSayNo {
				jsnID = c.ID
				break
			}
		}
		if jsnID == "" {
			return fault("err.no_jsn", "you have no Just Say No card")
		}
		c, _ := takeFromHand(p, jsnID)
		g.DiscardPile = append(g.DiscardPile, c)
		t.Cancelled = !t.Cancelled
		if playerID == pd.ByID {
			t.Responder = t.PlayerID
		} else {
			t.Responder = pd.ByID
		}
		key := "log.just_say_no_back_on"
		if t.Cancelled {
			key = "log.just_say_no_cancelled"
		}
		g.log(key, "name", p.Name, "label", pd.LabelKey, "label_args", pd.LabelArgs)
		g.restartResponseClock()
		g.settleAuto()
		return nil
	}

	// Accepting.
	if playerID == pd.ByID {
		t.Settled = true
		t.Note = "blocked"
		g.log("log.accepts_block", "name", p.Name)
		g.restartResponseClock()
		g.settleAuto()
		return nil
	}
	if t.Cancelled {
		return fault("err.waiting_other_player", "waiting on the other player")
	}
	if pd.Kind == PendingPayment {
		if err := g.pay(pd, t, cardIDs); err != nil {
			return err
		}
		t.Settled = true
		g.restartResponseClock()
		g.settleAuto()
		return nil
	}
	// Steals and swaps: accepting lets the effect through.
	t.Settled = true
	g.restartResponseClock()
	g.settleAuto()
	return nil
}

// restartResponseClock clears the deadline so the next responder gets a full
// window instead of the remains of the previous one.
func (g *Game) restartResponseClock() {
	if g.Pending != nil {
		g.DeadlineMS = 0
	}
}

// pay transfers the chosen assets from the debtor to the instigator.
func (g *Game) pay(pd *Pending, t *Target, cardIDs []string) error {
	from := g.Player(t.PlayerID)
	to := g.Player(pd.ByID)
	if from == nil || to == nil {
		return fault("err.player_not_found", "player missing")
	}
	seen := map[string]bool{}
	total := 0
	for _, id := range cardIDs {
		if seen[id] {
			return fault("err.duplicate_payment_card", "duplicate card in payment")
		}
		seen[id] = true
		c, _, err := findAsset(from, id)
		if err != nil {
			return err
		}
		total += c.Value
	}
	assets := from.AssetTotal()
	if total < t.Amount && total < assets {
		return fault("err.pay_more", fmt.Sprintf("pay $%dM (selected $%dM of $%dM available)", t.Amount, total, assets), "amount", t.Amount, "selected", total, "available", assets)
	}

	paid := 0
	for _, id := range cardIDs {
		c, col, err := takeAsset(from, id)
		if err != nil {
			return err
		}
		paid += c.Value
		if c.IsProperty() {
			g.giveProperty(to, c, col)
		} else {
			to.Bank = append(to.Bank, c)
		}
	}
	from.pruneSets()
	g.log("log.paid", "from", from.Name, "to", to.Name, "amount", paid, "cards", len(cardIDs))
	g.checkWin(to)
	return nil
}

// findAsset looks up a card in play without removing it.
func findAsset(p *Player, id string) (Card, Color, error) {
	for _, c := range p.Bank {
		if c.ID == id {
			return c, "", nil
		}
	}
	for _, s := range p.Sets {
		for _, c := range s.Cards {
			if c.ID == id {
				return c, s.Color, nil
			}
		}
		for _, c := range s.Buildings {
			if c.ID == id {
				return c, s.Color, nil
			}
		}
	}
	return Card{}, "", fault("err.card_not_in_play", "card not in play")
}

func takeAsset(p *Player, id string) (Card, Color, error) {
	for i, c := range p.Bank {
		if c.ID == id {
			p.Bank = append(p.Bank[:i], p.Bank[i+1:]...)
			return c, "", nil
		}
	}
	for _, s := range p.Sets {
		for i, c := range s.Cards {
			if c.ID == id {
				s.Cards = append(s.Cards[:i], s.Cards[i+1:]...)
				return c, s.Color, nil
			}
		}
		for i, c := range s.Buildings {
			if c.ID == id {
				s.Buildings = append(s.Buildings[:i], s.Buildings[i+1:]...)
				return c, s.Color, nil
			}
		}
	}
	return Card{}, "", fault("err.card_not_in_play", "card not in play")
}

// giveProperty files a received property into a sensible set.
func (g *Game) giveProperty(to *Player, c Card, preferred Color) {
	col := preferred
	if col == "" || !c.Accepts(col) {
		cols := c.PlayableColors()
		col = cols[0]
		for _, x := range cols {
			if s := to.setFor(x); s != nil && !s.IsComplete() {
				col = x
				break
			}
		}
	}
	s := to.ensureSet(col)
	s.Cards = append(s.Cards, c)
}

// resolveIfDone applies steal effects and clears the pending action.
func (g *Game) resolveIfDone() {
	pd := g.Pending
	if pd == nil || !pd.done() {
		return
	}
	by := g.Player(pd.ByID)

	if by != nil {
		switch pd.Kind {
		case PendingSlyDeal:
			t := g.Player(pd.TargetPlayerID)
			if t != nil && !pd.Targets[0].Cancelled {
				if c, col, err := takeAsset(t, pd.TargetCardID); err == nil {
					t.pruneSets()
					g.giveProperty(by, c, col)
					g.log("log.stole", "name", by.Name, "card", c.Key, "target", t.Name)
					g.checkWin(by)
				}
			}
		case PendingForcedDeal:
			t := g.Player(pd.TargetPlayerID)
			if t != nil && !pd.Targets[0].Cancelled {
				theirs, theirCol, err1 := takeAsset(t, pd.TargetCardID)
				mine, myCol, err2 := takeAsset(by, pd.GiveCardID)
				if err1 == nil && err2 == nil {
					g.giveProperty(by, theirs, theirCol)
					g.giveProperty(t, mine, myCol)
					t.pruneSets()
					by.pruneSets()
					g.log("log.swapped", "name", by.Name, "gave", mine.Key, "got", theirs.Key, "target", t.Name)
					g.checkWin(by)
				}
			}
		case PendingDealBreaker:
			t := g.Player(pd.TargetPlayerID)
			if t != nil && !pd.Targets[0].Cancelled {
				if s := t.setFor(pd.TargetColor); s != nil {
					dst := by.ensureSet(pd.TargetColor)
					dst.Cards = append(dst.Cards, s.Cards...)
					dst.Buildings = append(dst.Buildings, s.Buildings...)
					s.Cards = nil
					s.Buildings = nil
					t.pruneSets()
					g.log("log.took_set", "name", by.Name, "target", t.Name, "color", string(pd.TargetColor))
					g.checkWin(by)
				}
			}
		}
	}

	g.DiscardPile = append(g.DiscardPile, pd.Card)
	g.DiscardPile = append(g.DiscardPile, pd.extra...)
	g.Pending = nil
}
