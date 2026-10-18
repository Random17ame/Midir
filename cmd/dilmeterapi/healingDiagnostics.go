package main

// Experimental, opt-in healing diagnostic recorder. No healing or overshield
// statistics are changed by this recorder. Never log full packet payloads.
import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
	"sync"
	"time"
)

type healingDiagnosticRecorder struct {
	mu      sync.Mutex
	file    *os.File
	enabled bool
	hp      map[uint64]diagnosticHP
	casts   []diagnosticSkillCast
}
type diagnosticHP struct{ current, base, additional float32 }

// Skill matches are suggestions, not confirmed healing attribution. Keep them
// outside of the player healing totals until real packet captures validate them.
type diagnosticSkillCast struct {
	caster, target uint64
	skill          uint16
	at             time.Time
}

func diagnosticSkillWindow(skill uint16) time.Duration {
	switch skill {
	case 59002:
		return 300 * time.Second // Voice of Vitality: 75 HP each second, non-stacking
	case 59004:
		return 35 * time.Second // Pulse of Purification: provisional maximum, needs validation
	case 59003:
		return 4 * time.Second // Resonant Litany: multiple overlapping projectile groups
	default:
		return 3 * time.Second // One-shot and area healing: diagnostic-only window
	}
}
func (d *healingDiagnosticRecorder) noteSkill(at time.Time, caster, target uint64, skill uint16) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.enabled {
		return
	}
	d.casts = append(d.casts, diagnosticSkillCast{caster, target, skill, at})
	d.pruneCasts(at)
}
func (d *healingDiagnosticRecorder) pruneCasts(at time.Time) {
	kept := d.casts[:0]
	for _, c := range d.casts {
		if !at.Before(c.at) && at.Sub(c.at) <= diagnosticSkillWindow(c.skill) {
			kept = append(kept, c)
		}
	}
	d.casts = kept
}

// candidatesForHeal is intentionally conservative: it never writes to player
// totals. Several matching casts means ambiguous skill attribution.
func (d *healingDiagnosticRecorder) candidatesForHeal(at time.Time, target uint64, amount uint32) map[string]interface{} {
	d.mu.Lock()
	defer d.mu.Unlock()
	result := map[string]interface{}{"classification": "unattributed", "candidate_skills": []uint16{}}
	if !d.enabled {
		return result
	}
	d.pruneCasts(at)
	type candidate struct {
		Caster uint64 `json:"caster_id"`
		Skill  uint16 `json:"skill_id"`
		AgeMs  int64  `json:"age_ms"`
	}
	found := make([]candidate, 0)
	seen := make(map[[2]uint64]bool)
	for _, c := range d.casts {
		// Explicit target mismatch rules out a single-target cast. AOE casts may
		// legitimately heal recipients other than their selected location.
		if (c.skill == 30006 || c.skill == 59000 || c.skill == 27200) && c.target != 0 && c.target != target {
			continue
		}
		if c.skill == 59002 && amount != 75 {
			continue
		} // Expected periodic Voice tick
		key := [2]uint64{c.caster, uint64(c.skill)}
		if seen[key] {
			continue
		}
		seen[key] = true
		found = append(found, candidate{c.caster, c.skill, at.Sub(c.at).Milliseconds()})
	}
	sort.Slice(found, func(i, j int) bool { return found[i].AgeMs < found[j].AgeMs })
	result["candidates"] = found
	if len(found) == 1 {
		result["classification"] = "single_candidate_unverified"
	} else if len(found) > 1 {
		result["classification"] = "ambiguous_multiple_candidates"
	}
	return result
}

var healingDiagnostics = &healingDiagnosticRecorder{hp: make(map[uint64]diagnosticHP)}

func (d *healingDiagnosticRecorder) setEnabled(enabled bool) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if enabled == d.enabled {
		return nil
	}
	if enabled {
		name := fmt.Sprintf("healing-diagnostics-%s.ndjson", time.Now().Format("20060102-150405"))
		f, err := os.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			return err
		}
		d.file = f
		d.hp = make(map[uint64]diagnosticHP)
		d.casts = nil
		d.enabled = true
		return nil
	}
	d.enabled = false
	if d.file != nil {
		err := d.file.Close()
		d.file = nil
		return err
	}
	return nil
}
func (d *healingDiagnosticRecorder) isEnabled() bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.enabled
}
func (d *healingDiagnosticRecorder) write(at time.Time, kind string, details map[string]interface{}) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.enabled || d.file == nil {
		return
	}
	details["kind"] = kind
	details["timestamp"] = at.Format(time.RFC3339Nano)
	raw, err := json.Marshal(details)
	if err != nil {
		return
	}
	_, _ = d.file.Write(append(raw, '\n'))
}

// observeHP uses missing HP, not raw CurrentHP changes. It intentionally
// excludes AdditionalHP (stat 31), which belongs exclusively to overshields.
// A reduced missing-HP deficit is evidence, NOT proof, of effective healing.
func (d *healingDiagnosticRecorder) observeHP(at time.Time, id uint64, current, base, additional float32, entityType string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if !d.enabled || d.file == nil {
		return
	}
	prev, exists := d.hp[id]
	d.hp[id] = diagnosticHP{current: current, base: base, additional: additional}
	if !exists || (prev.current == current && prev.base == base && prev.additional == additional) {
		return
	}
	// Preliminary ordinary-HP estimate. CurrentHP in captured packets can include
	// AdditionalHP; keep this labeled a candidate, never a confirmed heal.
	ordinary := func(c, b, a float32) float32 { return float32(math.Max(0, math.Min(float64(b), float64(c-a)))) }
	beforeOrd := ordinary(prev.current, prev.base, prev.additional)
	afterOrd := ordinary(current, base, additional)
	beforeMissing := float32(math.Max(0, float64(prev.base-beforeOrd)))
	afterMissing := float32(math.Max(0, float64(base-afterOrd)))
	recovered := beforeMissing - afterMissing
	// A capacity change alone can change the deficit. Do not call it healing.
	plausible := recovered > 0 && (base == prev.base || afterOrd > beforeOrd)
	kind := "hp_state_change"
	if plausible {
		kind = "missing_hp_reduction_candidate"
	}
	if entityType == "enemy" && plausible {
		kind = "enemy_recovery_candidate"
	}
	details := map[string]interface{}{"kind": kind, "timestamp": at.Format(time.RFC3339Nano), "entity_id": id, "entity_type": entityType,
		"current_before": prev.current, "current_after": current, "base_before": prev.base, "base_after": base,
		"additional_before": prev.additional, "additional_after": additional,
		"ordinary_hp_candidate_before": beforeOrd, "ordinary_hp_candidate_after": afterOrd,
		"current_delta": current - prev.current, "base_delta": base - prev.base, "additional_delta": additional - prev.additional,
		"missing_before": beforeMissing, "missing_after": afterMissing, "missing_reduction": recovered,
		"note": "Unverified ordinary-HP estimate; never includes AdditionalHP as healing. Enemy recovery includes mechanics/regen; does not change party healing totals."}
	raw, err := json.Marshal(details)
	if err == nil {
		_, _ = d.file.Write(append(raw, '\n'))
	}
}
