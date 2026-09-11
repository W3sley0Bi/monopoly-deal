package game

import (
	"fmt"
	"math/rand/v2"
	"strings"
	"sync/atomic"
)

// cardKey turns a card name into a stable translation key, e.g.
// "St. James Place" -> "prefix.st_james_place".
func cardKey(prefix, name string) string {
	var b strings.Builder
	b.WriteString(prefix)
	b.WriteByte('.')
	last := byte('_')
	for i := 0; i < len(name); i++ {
		c := name[i]
		switch {
		case c >= 'A' && c <= 'Z':
			c += 'a' - 'A'
			b.WriteByte(c)
			last = c
		case (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'):
			b.WriteByte(c)
			last = c
		default:
			if last != '_' {
				b.WriteByte('_')
				last = '_'
			}
		}
	}
	return strings.TrimRight(b.String(), "_")
}

type CardType string

const (
	CardTypeProperty         CardType = "property"
	CardTypePropertyWildcard CardType = "property_wildcard"
	CardTypeMoney            CardType = "money"
	CardTypeAction           CardType = "action"
	CardTypeRent             CardType = "rent"
)

type ActionType string

const (
	ActionPassGo        ActionType = "pass_go"
	ActionDealBreaker   ActionType = "deal_breaker"
	ActionSlyDeal       ActionType = "sly_deal"
	ActionForcedDeal    ActionType = "forced_deal"
	ActionDebtCollector ActionType = "debt_collector"
	ActionBirthday      ActionType = "birthday"
	ActionHouse         ActionType = "house"
	ActionHotel         ActionType = "hotel"
	ActionJustSayNo     ActionType = "just_say_no"
	ActionDoubleRent    ActionType = "double_rent"
)

// Color is a property group.
type Color string

const (
	ColorBrown     Color = "brown"
	ColorLightBlue Color = "lightblue"
	ColorPink      Color = "pink"
	ColorOrange    Color = "orange"
	ColorRed       Color = "red"
	ColorYellow    Color = "yellow"
	ColorGreen     Color = "green"
	ColorBlue      Color = "blue"
	ColorRailroad  Color = "railroad"
	ColorUtility   Color = "utility"
	// ColorAny only ever appears on wildcards / wild rent, never on a set.
	ColorAny Color = "all"
)

// AllColors is the play order used by the UI.
var AllColors = []Color{
	ColorBrown, ColorLightBlue, ColorPink, ColorOrange, ColorRed,
	ColorYellow, ColorGreen, ColorBlue, ColorRailroad, ColorUtility,
}

// rentTable[color][n-1] is the rent charged for holding n cards of that color.
var rentTable = map[Color][]int{
	ColorBrown:     {1, 2},
	ColorLightBlue: {1, 2, 3},
	ColorPink:      {1, 2, 4},
	ColorOrange:    {1, 3, 5},
	ColorRed:       {2, 3, 6},
	ColorYellow:    {2, 4, 6},
	ColorGreen:     {2, 4, 7},
	ColorBlue:      {3, 8},
	ColorRailroad:  {1, 2, 3, 4},
	ColorUtility:   {1, 2},
}

// SetSize is how many properties complete a colour group.
func SetSize(c Color) int { return len(rentTable[c]) }

// RentFor returns the rent for n cards of a colour, plus house/hotel bonuses.
func RentFor(c Color, n int, house, hotel bool) int {
	t := rentTable[c]
	if len(t) == 0 || n <= 0 {
		return 0
	}
	if n > len(t) {
		n = len(t)
	}
	r := t[n-1]
	if n >= len(t) {
		if house {
			r += 3
		}
		if hotel {
			r += 4
		}
	}
	return r
}

// CanBuild reports whether house/hotel cards may sit on this colour.
func CanBuild(c Color) bool { return c != ColorRailroad && c != ColorUtility }

type Card struct {
	ID string `json:"id"`
	// Key names the card for translation. Name is the English fallback.
	Key    string     `json:"key"`
	Type   CardType   `json:"type"`
	Name   string     `json:"name"`
	Value  int        `json:"value"`
	Colors []Color    `json:"colors,omitempty"`
	Action ActionType `json:"action,omitempty"`
}

// IsProperty reports whether the card lives in a property set.
func (c Card) IsProperty() bool {
	return c.Type == CardTypeProperty || c.Type == CardTypePropertyWildcard
}

// IsWildAny reports whether the card is a "any colour" wildcard.
func (c Card) IsWildAny() bool {
	return len(c.Colors) == 1 && c.Colors[0] == ColorAny
}

// PlayableColors lists the colours this card may be assigned to.
func (c Card) PlayableColors() []Color {
	if c.IsWildAny() {
		return AllColors
	}
	return c.Colors
}

// Accepts reports whether the card may be placed in a set of the given colour.
func (c Card) Accepts(col Color) bool {
	for _, x := range c.PlayableColors() {
		if x == col {
			return true
		}
	}
	return false
}

var idCounter uint64

func generateID() string {
	return fmt.Sprintf("c%d", atomic.AddUint64(&idCounter, 1))
}

// GenerateDeck returns a freshly shuffled deck.
func GenerateDeck() []Card {
	var deck []Card

	add := func(c Card, count int) {
		for i := 0; i < count; i++ {
			c.ID = generateID()
			deck = append(deck, c)
		}
	}
	prop := func(name string, value int, col Color) {
		add(Card{
			Type: CardTypeProperty, Key: cardKey("prop", name),
			Name: name, Value: value, Colors: []Color{col},
		}, 1)
	}
	wild := func(name string, value int, cols []Color, count int) {
		add(Card{
			Type: CardTypePropertyWildcard, Key: cardKey("wild", strings.TrimPrefix(name, "Wild: ")),
			Name: name, Value: value, Colors: cols,
		}, count)
	}

	// Money (20)
	add(Card{Type: CardTypeMoney, Key: "money.10", Name: "$10M", Value: 10}, 1)
	add(Card{Type: CardTypeMoney, Key: "money.5", Name: "$5M", Value: 5}, 2)
	add(Card{Type: CardTypeMoney, Key: "money.4", Name: "$4M", Value: 4}, 3)
	add(Card{Type: CardTypeMoney, Key: "money.3", Name: "$3M", Value: 3}, 3)
	add(Card{Type: CardTypeMoney, Key: "money.2", Name: "$2M", Value: 2}, 5)
	add(Card{Type: CardTypeMoney, Key: "money.1", Name: "$1M", Value: 1}, 6)

	// Actions (34)
	add(Card{Type: CardTypeAction, Action: ActionPassGo, Key: "action." + string(ActionPassGo), Name: "Pass Go", Value: 1}, 10)
	add(Card{Type: CardTypeAction, Action: ActionDealBreaker, Key: "action." + string(ActionDealBreaker), Name: "Deal Breaker", Value: 5}, 2)
	add(Card{Type: CardTypeAction, Action: ActionSlyDeal, Key: "action." + string(ActionSlyDeal), Name: "Sly Deal", Value: 3}, 3)
	add(Card{Type: CardTypeAction, Action: ActionForcedDeal, Key: "action." + string(ActionForcedDeal), Name: "Forced Deal", Value: 3}, 3)
	add(Card{Type: CardTypeAction, Action: ActionDebtCollector, Key: "action." + string(ActionDebtCollector), Name: "Debt Collector", Value: 3}, 3)
	add(Card{Type: CardTypeAction, Action: ActionBirthday, Key: "action." + string(ActionBirthday), Name: "It's My Birthday", Value: 2}, 3)
	add(Card{Type: CardTypeAction, Action: ActionJustSayNo, Key: "action." + string(ActionJustSayNo), Name: "Just Say No", Value: 4}, 3)
	add(Card{Type: CardTypeAction, Action: ActionDoubleRent, Key: "action." + string(ActionDoubleRent), Name: "Double The Rent", Value: 1}, 2)
	add(Card{Type: CardTypeAction, Action: ActionHouse, Key: "action." + string(ActionHouse), Name: "House", Value: 3}, 3)
	add(Card{Type: CardTypeAction, Action: ActionHotel, Key: "action." + string(ActionHotel), Name: "Hotel", Value: 4}, 2)

	// Rent (13)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Green/Blue"), Name: "Rent: Green/Blue", Value: 1, Colors: []Color{ColorGreen, ColorBlue}}, 2)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Brown/Light Blue"), Name: "Rent: Brown/Light Blue", Value: 1, Colors: []Color{ColorBrown, ColorLightBlue}}, 2)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Pink/Orange"), Name: "Rent: Pink/Orange", Value: 1, Colors: []Color{ColorPink, ColorOrange}}, 2)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Red/Yellow"), Name: "Rent: Red/Yellow", Value: 1, Colors: []Color{ColorRed, ColorYellow}}, 2)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Railroad/Utility"), Name: "Rent: Railroad/Utility", Value: 1, Colors: []Color{ColorRailroad, ColorUtility}}, 2)
	add(Card{Type: CardTypeRent, Key: cardKey("rent", "Any Colour"), Name: "Rent: Any Colour", Value: 3, Colors: []Color{ColorAny}}, 3)

	// Properties (28)
	prop("Mediterranean Avenue", 1, ColorBrown)
	prop("Baltic Avenue", 1, ColorBrown)
	prop("Oriental Avenue", 1, ColorLightBlue)
	prop("Vermont Avenue", 1, ColorLightBlue)
	prop("Connecticut Avenue", 1, ColorLightBlue)
	prop("St. Charles Place", 2, ColorPink)
	prop("Virginia Avenue", 2, ColorPink)
	prop("States Avenue", 2, ColorPink)
	prop("St. James Place", 2, ColorOrange)
	prop("Tennessee Avenue", 2, ColorOrange)
	prop("New York Avenue", 2, ColorOrange)
	prop("Kentucky Avenue", 3, ColorRed)
	prop("Indiana Avenue", 3, ColorRed)
	prop("Illinois Avenue", 3, ColorRed)
	prop("Atlantic Avenue", 3, ColorYellow)
	prop("Ventnor Avenue", 3, ColorYellow)
	prop("Marvin Gardens", 3, ColorYellow)
	prop("Pacific Avenue", 4, ColorGreen)
	prop("North Carolina Avenue", 4, ColorGreen)
	prop("Pennsylvania Avenue", 4, ColorGreen)
	prop("Park Place", 4, ColorBlue)
	prop("Boardwalk", 4, ColorBlue)
	prop("Reading Railroad", 2, ColorRailroad)
	prop("Pennsylvania Railroad", 2, ColorRailroad)
	prop("B. & O. Railroad", 2, ColorRailroad)
	prop("Short Line", 2, ColorRailroad)
	prop("Water Works", 2, ColorUtility)
	prop("Electric Company", 2, ColorUtility)

	// Property wildcards (11)
	wild("Wild: Brown/Light Blue", 1, []Color{ColorBrown, ColorLightBlue}, 1)
	wild("Wild: Green/Blue", 4, []Color{ColorGreen, ColorBlue}, 1)
	wild("Wild: Green/Railroad", 4, []Color{ColorGreen, ColorRailroad}, 1)
	wild("Wild: Pink/Orange", 2, []Color{ColorPink, ColorOrange}, 2)
	wild("Wild: Red/Yellow", 3, []Color{ColorRed, ColorYellow}, 2)
	wild("Wild: Railroad/Utility", 2, []Color{ColorRailroad, ColorUtility}, 1)
	wild("Wild: Light Blue/Railroad", 4, []Color{ColorLightBlue, ColorRailroad}, 1)
	wild("Wild: Any Colour", 0, []Color{ColorAny}, 2)

	Shuffle(deck)
	return deck
}

// Shuffle randomises a slice of cards in place.
func Shuffle(cards []Card) {
	rand.Shuffle(len(cards), func(i, j int) { cards[i], cards[j] = cards[j], cards[i] })
}
