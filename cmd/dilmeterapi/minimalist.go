package main

import (
	"encoding/json"
	"os"
	"sort"
	"time"
)

// This timeout is exclusively a rendering heuristic; never a clear, death,
// encounter boundary, or recording gate. A new hit immediately pauses again.
const minimalistIdleTimeout = 15 * time.Second
const minimalistPreferenceFile = "minimalist-mode.json"

type minimalistPreference struct {
	Enabled bool `json:"enabled"`
}

func loadMinimalistPreference() bool {
	b, err := os.ReadFile(minimalistPreferenceFile)
	if err != nil {
		return false
	}
	var p minimalistPreference
	return json.Unmarshal(b, &p) == nil && p.Enabled
}

func saveMinimalistPreference(enabled bool) error {
	b, err := json.Marshal(minimalistPreference{Enabled: enabled})
	if err != nil {
		return err
	}
	return os.WriteFile(minimalistPreferenceFile, b, 0600)
}

func shouldPauseLiveChart(lastActivity, now time.Time, activeTarget bool) bool {
	return activeTarget && !lastActivity.IsZero() && now.Sub(lastActivity) < minimalistIdleTimeout
}

// The live meter's full-session Arcana ordering uses the earliest observed
// occurrence of each skill. Target-specific identity uses damageByTarget and
// explicit activations, which are untouched. This is NOT an exact-hit list.
// Keep the earliest real hit per skill, in original relative order for ties.
// Only the marked live projection calls this; no source slice is modified.
func compactLiveHitEvidence(hits []PreciseDamageEvent) []PreciseDamageEvent {
	first := make(map[uint16]int)
	for i, hit := range hits {
		if hit.AtMs <= 0 {
			continue
		}
		previous, found := first[hit.SkillID]
		if !found || hit.AtMs < hits[previous].AtMs {
			first[hit.SkillID] = i
		}
	}
	indices := make([]int, 0, len(first))
	for _, i := range first {
		indices = append(indices, i)
	}
	sort.Ints(indices)
	result := make([]PreciseDamageEvent, 0, len(indices))
	for _, i := range indices {
		result = append(result, hits[i])
	}
	return result
}

// Negative damage is the existing saved-log representation of healing.
// Keep every nonnegative observation, including mana-only and delayed hits.
func keepMinimalistDamageEvent(damage, manaDamage float32, enabled bool) bool {
	return !enabled || damage >= 0 || manaDamage > 0
}

// Use the same damage timeline in both modes, including legacy recordings.
// Do not change event order, timestamp precision, mana-only records or hits.
func damageOnlyTimeline(events []eventDamage) []eventDamage {
	result := make([]eventDamage, 0, len(events))
	for _, event := range events {
		if event.Damage >= 0 {
			result = append(result, event)
		}
	}
	return result
}

func damageTimelineBounds(events []eventDamage) (start, end int64) {
	found := false
	for _, event := range events {
		if event.Damage < 0 {
			continue
		}
		if !found {
			start = event.At
			found = true
		}
		end = event.At
	}
	return
}
