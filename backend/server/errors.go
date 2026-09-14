package server

import (
	"net/url"
	"strings"
	"time"

	"monopoly-deal-backend/game"
)

var (
	errNoName    = game.NewFault("err.choose_name", "choose a name first")
	errNotOwner  = game.NewFault("err.not_owner", "only the table owner can do that")
	errBadStream = game.NewFault("err.bad_station", "that station is not a usable https stream")
)

// tuneRadio validates what the owner picked and returns the state to store.
// Streams must be https: the page itself may be served over https, where a
// plain http stream is blocked by the browser without any visible error.
func tuneRadio(in *RadioState, byName string) (RadioState, error) {
	if in == nil || strings.TrimSpace(in.URL) == "" {
		return RadioState{}, nil
	}
	raw := strings.TrimSpace(in.URL)
	if len(raw) > 400 {
		return RadioState{}, errBadStream
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return RadioState{}, errBadStream
	}
	home := strings.TrimSpace(in.Home)
	if parsedHome, err := url.Parse(home); home != "" && (err != nil || parsedHome.Scheme != "https" || len(home) > 300) {
		home = ""
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = parsed.Host
	}
	if len(name) > 60 {
		name = name[:60]
	}
	return RadioState{
		Name:    name,
		URL:     raw,
		Home:    home,
		Playing: in.Playing,
		ByName:  byName,
		AtMS:    time.Now().UnixMilli(),
	}, nil
}

func trimName(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 16 {
		s = s[:16]
	}
	return s
}

func trimRoomName(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 28 {
		s = s[:28]
	}
	return s
}

func trimChat(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 400 {
		s = s[:400]
	}
	return s
}

// normalizeCode makes table codes case- and space-insensitive.
func normalizeCode(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}
