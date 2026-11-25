package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSessionListSummaryOmitsHeavyEvidence(t *testing.T) {
	data := SessionSummaryData{
		Name: "Run", StartTime: 1234, Duration: 12,
		Players: []SessionSummaryPlayer{{
			ID: "42", Name: "Tester", ArcanaName: "Harmonic Saint", ArcanaIcon: "icon",
			SkillUses:       []SkillGroupEvent{{}},
			HealingByTarget: map[string]DamageBreakdown{"target": {}},
		}},
		Enemies: []SessionSummaryEnemy{{Name: "Enemy", RaceID: 1}},
	}
	slim := sessionListSummary(data)
	if slim.Name != data.Name || slim.Duration != data.Duration || len(slim.Players) != 1 || slim.Players[0].ArcanaName != "Harmonic Saint" {
		t.Fatal("session sidebar metadata was not preserved")
	}
	if len(slim.Players[0].SkillUses) != 0 || len(slim.Players[0].HealingByTarget) != 0 {
		t.Fatal("sidebar payload should exclude detailed skill and healing records")
	}
	if len(data.Players[0].SkillUses) != 1 {
		t.Fatal("full session evidence must not be mutated by the projection")
	}
}

func TestSaveLiveSessionReturnsPublishedMetadata(t *testing.T) {
	sm, err := NewSessionManager(t.TempDir(), false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sm.StartLiveSession(); err != nil {
		t.Fatal(err)
	}
	saved, err := sm.SaveLiveSessionResult("Visible Save")
	if err != nil {
		t.Fatal(err)
	}
	if saved.Name != "Visible Save" || !strings.HasSuffix(saved.ID, ".ndjson") || saved.StartTime <= 0 {
		t.Fatalf("unexpected saved metadata: %+v", saved)
	}
	bytes, err := os.ReadFile(filepath.Join(sm.logDirectory, saved.ID))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(bytes), "SessionSummary") {
		t.Fatal("published NDJSON missing summary header")
	}
	if sm.currentSession != nil {
		t.Fatal("save must finish the old live session")
	}
}
