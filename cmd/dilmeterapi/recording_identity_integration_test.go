package main

import (
	"bytes"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// Exercise persistence and the real summary reconstruction, rather than only
// hashing fixture strings. Requires the project's Go toolchain and SQLite.
func TestSavedRecordingIdentityLifecycle(t *testing.T) {
	previousDB, previousPub := db, globalPub
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db, globalPub = testDB, nil
	defer func() { testDB.Close(); db, globalPub = previousDB, previousPub }()
	if _, err = db.Exec(`CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT, race_id INTEGER)`); err != nil {
		t.Fatal(err)
	}
	sm, err := NewSessionManager(t.TempDir(), false)
	if err != nil {
		t.Fatal(err)
	}
	const start int64 = 1790000000
	records := []iEvent{
		&eventEntityAppear{eventBase: eventBase{EventId: eventIdEntityAppear, At: start, Id: "123456"}, Name: "Fixture Player", RaceId: 8001},
		&eventEntityAppear{eventBase: eventBase{EventId: eventIdEntityAppear, At: start, Id: "99999"}, Name: "Bronntanas", RaceId: 7602, CurrentHP: 1000, MaxHP: 1000},
		&eventDamage{eventBase: eventBase{EventId: eventIdDamage, At: start + 1, Id: "123456"}, TargetId: "99999", SkillId: 100, Damage: 500, AtMs: (start+1)*1000 + 42},
		&eventSkillUse{eventBase: eventBase{EventId: eventIdSkillUse, At: start + 2, Id: "123456"}, TargetId: "99999", SkillId: 100, AtMs: (start+2)*1000 + 5},
		&eventDamage{eventBase: eventBase{EventId: eventIdDamage, At: start + 3, Id: "123456"}, TargetId: "99999", SkillId: 100, Damage: 500, AtMs: (start+3)*1000 + 42},
	}
	var events bytes.Buffer
	for _, event := range records {
		if err := json.NewEncoder(&events).Encode(event); err != nil {
			t.Fatal(err)
		}
	}
	read := func(name string) *FightSummary {
		t.Helper()
		s, e := GenerateSummaryFromFile(filepath.Join(sm.logDirectory, name))
		if e != nil {
			t.Fatal(e)
		}
		return s
	}
	checkEventBytes := func(name string, want []byte) {
		t.Helper()
		content, e := os.ReadFile(filepath.Join(sm.logDirectory, name))
		if e != nil {
			t.Fatal(e)
		}
		_, tail, ok := bytes.Cut(content, []byte("\n"))
		if !ok || !bytes.Equal(tail, want) {
			t.Fatal("event bytes changed")
		}
	}
	// Historical files with identical event bytes deduplicate, independently of
	// title, filename, header changes, and line-ending convention.
	legacy := "2026-01-01_20-00-00_Example.ndjson"
	if err := os.WriteFile(filepath.Join(sm.logDirectory, legacy), events.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	hash := sha256.Sum256(events.Bytes())
	wantLegacy := "legacy-sha256-" + hex.EncodeToString(hash[:])
	if read(legacy).RecordingID != wantLegacy {
		t.Fatal("historical identity incorrect")
	}
	copyName := "copy.ndjson"
	if err := os.WriteFile(filepath.Join(sm.logDirectory, copyName), bytes.ReplaceAll(events.Bytes(), []byte("\n"), []byte("\r\n")), 0600); err != nil {
		t.Fatal(err)
	}
	if read(copyName).RecordingID != wantLegacy {
		t.Fatal("copy or line endings changed identity")
	}
	renamed, err := sm.RenameSession(legacy, "Renamed fixture")
	if err != nil {
		t.Fatal(err)
	}
	if read(renamed.ID).RecordingID != wantLegacy {
		t.Fatal("historical filename changed identity")
	}
	if err := sm.MigrateSession(renamed.ID); err != nil {
		t.Fatal(err)
	}
	if read(renamed.ID).RecordingID != wantLegacy {
		t.Fatal("migration changed identity")
	}
	checkEventBytes(renamed.ID, events.Bytes())
	// Save a genuinely separate recording with identical combat timestamps and
	// events. It must receive a permanent random ID, not collide with the legacy ID.
	if _, err := sm.StartLiveSession(); err != nil {
		t.Fatal(err)
	}
	for _, event := range records {
		if err := sm.WriteEventToLog(event); err != nil {
			t.Fatal(err)
		}
	}
	saved, err := sm.SaveLiveSessionResult("New fixture")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Summary == nil || !validRecordingID(saved.Summary.RecordingID) || saved.Summary.RecordingID == wantLegacy {
		t.Fatal("new identity absent or reused")
	}
	durable := saved.Summary.RecordingID
	if read(saved.ID).RecordingID != durable {
		t.Fatal("saved ID not reconstructed")
	}
	if _, err := sm.RenameSession(saved.ID, "Updated title"); err != nil {
		t.Fatal(err)
	}
	if read(saved.ID).RecordingID != durable {
		t.Fatal("title changed new identity")
	}
	checkEventBytes(saved.ID, events.Bytes())
	if err := sm.MigrateSession(saved.ID); err != nil {
		t.Fatal(err)
	}
	if read(saved.ID).RecordingID != durable {
		t.Fatal("migration changed durable identity")
	}
	checkEventBytes(saved.ID, events.Bytes())
}
