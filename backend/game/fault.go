package game

import "errors"

// Fault is an error the client can translate: a key naming the message and the
// values that fill it in. Error() keeps the English sentence as a fallback for
// logs and for any client that does not know the key.
type Fault struct {
	Key  string
	Args map[string]any
	msg  string
}

func (f *Fault) Error() string { return f.msg }

// fault builds a translatable error. args are key/value pairs.
func fault(key, msg string, args ...any) *Fault {
	return &Fault{Key: key, Args: pairs(args...), msg: msg}
}

// NewFault builds a translatable error from outside the game package.
func NewFault(key, msg string, args ...any) *Fault { return fault(key, msg, args...) }

// FaultOf pulls the translation key out of an error, if it carries one.
func FaultOf(err error) (*Fault, bool) {
	var f *Fault
	if errors.As(err, &f) {
		return f, true
	}
	return nil, false
}

// pairs turns k, v, k, v… into a map. Odd trailing values are dropped.
func pairs(args ...any) map[string]any {
	if len(args) < 2 {
		return nil
	}
	out := make(map[string]any, len(args)/2)
	for i := 0; i+1 < len(args); i += 2 {
		k, ok := args[i].(string)
		if !ok {
			continue
		}
		out[k] = args[i+1]
	}
	return out
}

// LogEntry is one line of the table log, as a key the client translates plus
// the values it needs. The log is shared by everyone at the table, so it can
// never be a finished sentence in one language.
type LogEntry struct {
	Key  string         `json:"key"`
	Args map[string]any `json:"args,omitempty"`
}
