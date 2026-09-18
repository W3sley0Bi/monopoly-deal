package server

import (
	"strings"
	"unicode/utf8"

	"monopoly-deal-backend/game"
)

var (
	errNoName   = game.NewFault("err.choose_name", "choose a name first")
	errNotOwner = game.NewFault("err.not_owner", "only the table owner can do that")
)

func trimName(s string) string {
	return truncate(strings.TrimSpace(s), 16)
}

func trimRoomName(s string) string {
	return truncate(strings.TrimSpace(s), 28)
}

func trimChat(s string) string {
	return truncate(strings.TrimSpace(s), 400)
}

// truncate limits user-visible strings by characters rather than bytes. Byte
// slicing can split a multi-byte rune and leave invalid UTF-8 in room state.
func truncate(s string, maxRunes int) string {
	if utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	runes := []rune(s)
	return string(runes[:maxRunes])
}

// normalizeCode makes table codes case- and space-insensitive.
func normalizeCode(s string) string {
	return strings.ToUpper(strings.TrimSpace(s))
}

// checkProtocol refuses a native app built for a different wire format, and
// says which side is out of date so the app can tell the player what to update.
func checkProtocol(v int) error {
	switch {
	case v == 0 || v == ProtocolVersion:
		return nil
	case v < ProtocolVersion:
		return game.NewFault("err.client_outdated", "this app is out of date — update it to keep playing",
			"client", v, "server", ProtocolVersion)
	default:
		return game.NewFault("err.server_outdated", "the server is older than this app — ask the host to update it",
			"client", v, "server", ProtocolVersion)
	}
}
