package server

import (
	"testing"

	"monopoly-deal-backend/game"
)

func TestHomeAdvertisesProtocolVersion(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "p1", "Ana")
	a.home("home with version", func(v HomeView) bool { return v.ProtocolVersion == ProtocolVersion })
}

func TestCheckProtocol(t *testing.T) {
	cases := []struct {
		version int
		key     string
	}{
		{0, ""}, // web client and apps from before the check
		{ProtocolVersion, ""},
		{ProtocolVersion - 1, "err.client_outdated"},
		{ProtocolVersion + 1, "err.server_outdated"},
	}
	for _, tc := range cases {
		// ProtocolVersion-1 is 0 while the protocol is still at 1, and 0 is
		// deliberately let through; that row only means something after a bump.
		if tc.version == 0 && tc.key != "" {
			continue
		}
		got := ""
		if f, ok := game.FaultOf(checkProtocol(tc.version)); ok {
			got = f.Key
		}
		if got != tc.key {
			t.Errorf("checkProtocol(%d) = %q, want %q", tc.version, got, tc.key)
		}
	}
}

func TestMismatchedProtocolIsRefusedOnTheWire(t *testing.T) {
	srv, _ := newTestServer(t)
	a := dial(t, srv, "p1", "Ana")
	a.send(ClientMessage{Type: MsgCreateRoom, RoomName: "x", ProtocolVersion: ProtocolVersion + 1})
	m := a.await("refusal", func(m rawMsg) bool { return m.Type == "error" || m.Type == "room" })
	if m.ErrorKey != "err.server_outdated" {
		t.Fatalf("got %s %q, want err.server_outdated", m.Type, m.ErrorKey)
	}
}
