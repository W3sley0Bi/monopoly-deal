package game

import "testing"

// Every card must carry a translation key, or its name can only ever be shown
// in English.
func TestEveryCardHasATranslationKey(t *testing.T) {
	for _, c := range GenerateDeck() {
		if c.Key == "" {
			t.Fatalf("%s (%s) has no translation key", c.Name, c.Type)
		}
	}
}

// The slug rules the client's catalog was written against.
func TestCardKeySlugs(t *testing.T) {
	cases := map[string]string{
		"B. & O. Railroad": "prop.b_o_railroad",
		"Green/Blue":       "rent.green_blue",
		"Any Colour":       "rent.any_colour",
		"St. James Place":  "prop.st_james_place",
	}
	for name, want := range cases {
		prefix := "prop"
		if want[:4] == "rent" {
			prefix = "rent"
		}
		if got := cardKey(prefix, name); got != want {
			t.Fatalf("cardKey(%q) = %q, want %q", name, got, want)
		}
	}
}
