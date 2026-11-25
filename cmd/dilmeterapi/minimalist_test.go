package main

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func TestMinimalistLiveProjection(t *testing.T) {
	hits := []PreciseDamageEvent{{AtMs: 30, SkillID: 2, Damage: 200}, {AtMs: 20, SkillID: 1, Damage: 100}, {AtMs: 10, SkillID: 2, Damage: 300}, {AtMs: 10, SkillID: 3, Damage: 400}, {AtMs: 0, SkillID: 4}}
	original := append([]PreciseDamageEvent(nil), hits...)
	got := compactLiveHitEvidence(hits)
	if !reflect.DeepEqual(got, []PreciseDamageEvent{hits[1], hits[2], hits[3]}) || !reflect.DeepEqual(hits, original) {
		t.Fatalf("projection changed evidence or earliest-hit order: %+v", got)
	}
	many := make([]PreciseDamageEvent, 10000)
	for i := range many {
		many[i] = PreciseDamageEvent{AtMs: int64(i + 1), SkillID: uint16(i % 10), Damage: 100, TargetID: "boss"}
	}
	full, _ := json.Marshal(many)
	compact, _ := json.Marshal(compactLiveHitEvidence(many))
	if len(compactLiveHitEvidence(many)) != 10 || len(compact) >= len(full)/100 {
		t.Fatal("live projection failed to reduce repeated hit payload")
	}
	t.Logf("synthetic exact-hit JSON: %d -> %d bytes (not a whole-session performance benchmark)", len(full), len(compact))
}
func TestMinimalistChartSuspension(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		last         time.Time
		active, want bool
	}{{time.Time{}, true, false}, {now, true, true}, {now, false, false}, {now.Add(-14 * time.Second), true, true}, {now.Add(-15 * time.Second), true, false}} {
		if shouldPauseLiveChart(tc.last, now, tc.active) != tc.want {
			t.Fatalf("unexpected chart state: %+v", tc)
		}
	}
}
func TestMinimalistDamageEvidence(t *testing.T) {
	damage := []eventDamage{{eventBase: eventBase{At: 2}, Damage: 100}, {eventBase: eventBase{At: 3}, ManaDamage: 50}, {eventBase: eventBase{At: 4}, Damage: 200, IsDelayed: true}}
	normal := append([]eventDamage{{eventBase: eventBase{At: 1}, Damage: -50}}, damage...)
	normal = append(normal, eventDamage{eventBase: eventBase{At: 5}, Damage: -100})
	if !reflect.DeepEqual(damageOnlyTimeline(normal), damage) {
		t.Fatal("healing altered damage timeline")
	}
	a, b := damageTimelineBounds(normal)
	c, d := damageTimelineBounds(damage)
	if a != 2 || b != 4 || a != c || b != d {
		t.Fatal("healing altered damage time bounds")
	}
	if !keepMinimalistDamageEvent(-50, 0, false) || keepMinimalistDamageEvent(-50, 0, true) || !keepMinimalistDamageEvent(0, 50, true) || !keepMinimalistDamageEvent(-50, 50, true) || !keepMinimalistDamageEvent(100, 0, true) {
		t.Fatal("incorrect healing-only filter")
	}
}
