package main

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestRecordingIDs(t *testing.T) {
	ids := map[string]bool{}
	for i := 0; i < 1000; i++ {
		id, err := newRecordingID()
		if err != nil || !validRecordingID(id) || ids[id] {
			t.Fatalf("invalid or duplicate new ID: %q %v", id, err)
		}
		ids[id] = true
	}
	for _, id := range []string{"", "recording-xyz", "legacy-sha256-xyz", "../file"} {
		if validRecordingID(id) {
			t.Fatalf("accepted invalid ID %q", id)
		}
	}
}
func TestLegacyRecordingIdentity(t *testing.T) {
	a := newLegacyRecordingIdentity()
	if a.id() != "" {
		t.Fatal("empty evidence must not manufacture an identity")
	}
	a.addLine([]byte(""))
	if a.id() != "" {
		t.Fatal("blank evidence must not manufacture an identity")
	}
	a = newLegacyRecordingIdentity()
	a.addLine([]byte(`{"EventId":3,"At":123,"Damage":100}`))
	a.addLine([]byte(`{"EventId":8,"At":124}`))
	expected := sha256.Sum256([]byte("{\"EventId\":3,\"At\":123,\"Damage\":100}\n{\"EventId\":8,\"At\":124}\n"))
	if a.id() != "legacy-sha256-"+hex.EncodeToString(expected[:]) || !validRecordingID(a.id()) {
		t.Fatalf("unexpected ID %s", a.id())
	}
	b := newLegacyRecordingIdentity()
	b.addLine([]byte(`{"EventId":3,"At":123,"Damage":100}`))
	b.addLine([]byte(`{"EventId":8,"At":124}`))
	if a.id() != b.id() {
		t.Fatal("identical event lines must deduplicate")
	}
	b.addLine([]byte(`{"EventId":3,"At":125,"Damage":50}`))
	if a.id() == b.id() {
		t.Fatal("different event evidence must differ")
	}
}
