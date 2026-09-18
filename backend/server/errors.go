package server

import (
	"strings"

	"monopoly-deal-backend/game"
)

var (
	errNoName   = game.NewFault("err.choose_name", "choose a name first")
	errNotOwner = game.NewFault("err.not_owner", "only the table owner can do that")
)

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
