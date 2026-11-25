package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestHeaderRenamePreservesIdentityAndEvidence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "example.ndjson")
	id, err := newRecordingID()
	if err != nil {
		t.Fatal(err)
	}
	header := `{"EventId":9999,"summary":{"name":"Old","recordingId":"` + id + `","unknownLargeInteger":90071992547409931}}` + "\r\n"
	events := []byte("{\"EventId\":3,\"At\":123,\"Id\":\"90071992547409931\"}\r\n{\"EventId\":8,\"At\":124}")
	if err := os.WriteFile(path, append([]byte(header), events...), 0600); err != nil {
		t.Fatal(err)
	}
	if err := updateSessionHeaderName(path, "Unicode 例示"); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	first, tail, ok := bytes.Cut(content, []byte("\n"))
	if !ok || !bytes.Equal(tail, events) {
		t.Fatal("event bytes changed")
	}
	var wrapper struct {
		Summary map[string]json.RawMessage `json:"summary"`
	}
	if err := json.Unmarshal(first, &wrapper); err != nil {
		t.Fatal(err)
	}
	if string(wrapper.Summary["recordingId"]) != `"`+id+`"` || string(wrapper.Summary["unknownLargeInteger"]) != "90071992547409931" || string(wrapper.Summary["name"]) != `"Unicode 例示"` {
		t.Fatal("header metadata changed unexpectedly")
	}
	if err := os.WriteFile(path, events, 0600); err != nil {
		t.Fatal(err)
	}
	if err := updateSessionHeaderName(path, "Legacy rename"); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(after, events) {
		t.Fatal("headerless legacy event bytes changed")
	}
}
