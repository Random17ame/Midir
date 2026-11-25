package main

import (
	"testing"

	"github.com/Marcentus/Midir/packet"
)

func TestPetAttributionLabelEvidence(t *testing.T) {
	const raceID uint32 = 830001
	old, existed := raceNameCache[raceID]
	raceNameCache[raceID] = "Bun Bun"
	defer func() {
		if existed {
			raceNameCache[raceID] = old
		} else {
			delete(raceNameCache, raceID)
		}
	}()

	tests := []struct {
		name         string
		entity       *packet.EntityInfo
		expectedID   uint32
		expectedName string
	}{
		{"known pet", &packet.EntityInfo{Id: 1, Name: "Companion", OwnerId: 2, RaceId: raceID, EntityType: 2}, raceID, "Bun Bun"},
		{"unknown race", &packet.EntityInfo{Id: 3, Name: "Companion", OwnerId: 2, RaceId: 830002, EntityType: 2}, 0, ""},
		{"not owned", &packet.EntityInfo{Id: 4, Name: "Companion", RaceId: raceID, EntityType: 2}, 0, ""},
		{"puppet", &packet.EntityInfo{Id: 5, Name: "Marionette", OwnerId: 2, RaceId: raceID, EntityType: 11}, 0, ""},
		{"numeric puppet", &packet.EntityInfo{Id: 6, Name: "12345", OwnerId: 2, RaceId: raceID, EntityType: 2}, 0, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			id, name := petAttribution(tc.entity)
			if id != tc.expectedID || name != tc.expectedName {
				t.Fatalf("got race %d (%q), want %d (%q)", id, name, tc.expectedID, tc.expectedName)
			}
		})
	}
}
