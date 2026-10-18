package main

import (
	"testing"
	"time"
)

func TestHealingCorrelationDoesNotInventSkill(t *testing.T) {
	d := &healingDiagnosticRecorder{enabled: true}
	now := time.Now()
	got := d.candidatesForHeal(now, 42, 500)
	if got["classification"] != "unattributed" {
		t.Fatalf("unexpected attribution: %v", got)
	}
}
func TestVoiceOfVitalityAmountAndWindow(t *testing.T) {
	d := &healingDiagnosticRecorder{enabled: true}
	now := time.Now()
	d.noteSkill(now, 1, 0, 59002)
	if got := d.candidatesForHeal(now.Add(2*time.Second), 42, 75); got["classification"] != "single_candidate_unverified" {
		t.Fatalf("expected Voice candidate: %v", got)
	}
	if got := d.candidatesForHeal(now.Add(2*time.Second), 42, 100); got["classification"] != "unattributed" {
		t.Fatalf("non-75 incorrectly linked to Voice: %v", got)
	}
	if got := d.candidatesForHeal(now.Add(301*time.Second), 42, 75); got["classification"] != "unattributed" {
		t.Fatalf("expired Voice linked: %v", got)
	}
}
func TestSimultaneousHealingCandidatesStayAmbiguous(t *testing.T) {
	d := &healingDiagnosticRecorder{enabled: true}
	now := time.Now()
	d.noteSkill(now, 1, 0, 59001)
	d.noteSkill(now, 2, 0, 59001)
	if got := d.candidatesForHeal(now.Add(100*time.Millisecond), 42, 1200); got["classification"] != "ambiguous_multiple_candidates" {
		t.Fatalf("misidentified caster: %v", got)
	}
}
