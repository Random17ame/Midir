package main

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestMinimalistSavedDamageParity(t *testing.T) {
	previousDB := db
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db = testDB
	defer func() { testDB.Close(); db = previousDB }()
	if _, err = db.Exec(`CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT, race_id INTEGER)`); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	const start int64 = 1790000000
	base := func(id eventId, entity string, offset int64) eventBase {
		return eventBase{EventId: id, Id: entity, At: start + offset}
	}
	hit := func(offset int64, amount float32) *eventDamage {
		return &eventDamage{eventBase: base(eventIdDamage, "123456", offset), AtMs: (start+offset)*1000 + 42, TargetId: "99999", SkillId: 100, Damage: amount}
	}
	for _, minimal := range []bool{false, true} {
		name := "normal.ndjson"
		if minimal {
			name = "minimal.ndjson"
		}
		f, e := os.Create(filepath.Join(dir, name))
		if e != nil {
			t.Fatal(e)
		}
		enc := json.NewEncoder(f)
		records := []interface{}{
			&eventSessionSummary{eventBase: base(eventIdSessionSummary, "", 0), Type: "SessionSummary", Summary: SessionSummaryData{HealingIncomplete: minimal}},
			&eventEntityAppear{eventBase: base(eventIdEntityAppear, "123456", 0), Name: "Alice", RaceId: 8001},
			&eventEntityAppear{eventBase: base(eventIdEntityAppear, "99999", 0), Name: "Boss", RaceId: 7603, MaxHP: 1000, CurrentHP: 1000},
		}
		heal := func(offset int64) *eventDamage {
			return &eventDamage{eventBase: base(eventIdDamage, "123456", offset), TargetId: "123456", Damage: -100}
		}
		if !minimal {
			records = append(records, heal(1))
		}
		records = append(records, hit(2, 100), &eventSkillUse{eventBase: base(eventIdSkillUse, "123456", 3), AtMs: (start+3)*1000 + 5, SkillId: 100, TargetId: "99999"}, hit(6, 900), &eventEntityHPUpdate{eventBase: base(eventIdEntityHPUpdate, "99999", 6), CurrentHP: 0, MaxHP: 1000}, &eventEntityDeath{eventBase: base(eventIdEntityDeath, "99999", 6)})
		if !minimal {
			records = append(records, heal(8))
		}
		for _, record := range records {
			if e = enc.Encode(record); e != nil {
				f.Close()
				t.Fatal(e)
			}
		}
		if e = f.Close(); e != nil {
			t.Fatal(e)
		}
	}
	normal, err := GenerateSummaryFromFile(filepath.Join(dir, "normal.ndjson"))
	if err != nil {
		t.Fatal(err)
	}
	minimal, err := GenerateSummaryFromFile(filepath.Join(dir, "minimal.ndjson"))
	if err != nil {
		t.Fatal(err)
	}
	a, b := normal.Players["123456"], minimal.Players["123456"]
	if normal.HealingIncomplete || !minimal.HealingIncomplete || a.OverallHealing.TotalDamage != 200 || b.OverallHealing.TotalDamage != 0 {
		t.Fatal("healing provenance or totals incorrect")
	}
	if normal.StartTime != start+2 || normal.EndTime != start+6 || normal.StartTime != minimal.StartTime || normal.EndTime != minimal.EndTime || normal.TotalDamage != 1000 || normal.TotalDamage != minimal.TotalDamage || !reflect.DeepEqual(a.OverallStats, b.OverallStats) || !reflect.DeepEqual(a.DamageByTarget, b.DamageByTarget) || !reflect.DeepEqual(a.SkillUses, b.SkillUses) || !reflect.DeepEqual(a.DamageEvents, b.DamageEvents) || !reflect.DeepEqual(a.SkillActivations, b.SkillActivations) || !reflect.DeepEqual(normal.Targets, minimal.Targets) || !reflect.DeepEqual(normal.DamageTaken, minimal.DamageTaken) || !reflect.DeepEqual(normal.GraphData, minimal.GraphData) {
		t.Fatal("damage reconstruction differs between recording modes")
	}
	if len(b.DamageEvents) != 2 || len(b.SkillActivations) != 1 {
		t.Fatal("exact-hit or explicit-use evidence missing")
	}
}

func TestMinimalistSummaryIsolationAndStickyFlag(t *testing.T) {
	sm, err := NewSessionManager(t.TempDir(), false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = sm.StartLiveSession(); err != nil {
		t.Fatal(err)
	}
	a := NewAggregator()
	pub := &eventPublisher{sm: sm, aggregator: a}
	p := a.getOrCreatePlayerStats(&PlayerInfo{ID: 123456, Name: "Alice", RaceId: 8001})
	p.DamageEvents = []PreciseDamageEvent{{AtMs: 1, SkillID: 100, Damage: 100}, {AtMs: 2, SkillID: 100, Damage: 100}}
	p.OverallStats.TotalDamage = 200
	a.targetTimestamps[99999] = struct{ StartTime, EndTime int64 }{1, 2}
	a.targetPresenceIntervals[99999] = []PresenceInterval{{Start: 1}}
	a.lastCombatActivity = time.Now()
	normal := a.GetSummary()
	pub.setMinimalistMode(true)
	live := pub.liveSummary(true)
	if !live.LiveCompact || !live.LiveChartPaused || !live.HealingIncomplete || len(live.Players["123456"].DamageEvents) != 1 {
		t.Fatal("live compact projection not active")
	}
	full := a.GetSummary()
	if full.LiveCompact || !reflect.DeepEqual(normal, full) || len(full.Players["123456"].DamageEvents) != 2 {
		t.Fatal("save summary changed")
	}
	a.deadEntities[99999] = true
	if pub.liveSummary(true).LiveChartPaused {
		t.Fatal("chart did not resume after target death")
	}
	pub.setMinimalistMode(false)
	if !sm.healingIncomplete() || pub.liveSummary(true).LiveCompact {
		t.Fatal("incomplete healing marker was lost or compact mode remained")
	}
	previousPub := globalPub
	globalPub = pub
	defer func() { globalPub = previousPub }()
	saved, err := sm.SaveLiveSessionResult("Minimalist test")
	if err != nil {
		t.Fatal(err)
	}
	reconstructed, err := GenerateSummaryFromFile(filepath.Join(sm.logDirectory, saved.ID))
	if err != nil {
		t.Fatal(err)
	}
	if !reconstructed.HealingIncomplete || reconstructed.LiveCompact {
		t.Fatal("saved recording lost healing provenance")
	}
	if _, err = sm.StartLiveSession(); err != nil {
		t.Fatal(err)
	}
	if sm.healingIncomplete() {
		t.Fatal("normal new recording inherited incomplete flag")
	}
	sm.StopCurrentSession()
}
