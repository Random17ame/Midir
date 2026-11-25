package main

import (
	"encoding/json"
	"net/http"

	"github.com/Marcentus/Midir/packet"
	"github.com/go-chi/chi/v5"
)

// CORRECTED: Add the SessionManager as the second argument.
func stateRouter(pub *eventPublisher, sm *SessionManager) http.Handler {
	r := chi.NewRouter()
	// CORRECTED: Pass the SessionManager to the handler.
	r.Post("/clear", handleClearState(pub, sm))
	r.Get("/summary", handleGetLiveSummary(pub))
	// This preference is independent of capture setup: toggling never changes NIC,
	// promiscuous mode, capture filters, or the current recording's evidence.
	r.Get("/minimalist", func(w http.ResponseWriter, r *http.Request) {
		respondWithJSON(w, http.StatusOK, minimalistPreference{Enabled: pub.aggregator.minimalistMode.Load()})
	})
	r.Put("/minimalist", func(w http.ResponseWriter, r *http.Request) {
		var payload struct {
			Enabled *bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Enabled == nil {
			respondWithError(w, http.StatusBadRequest, "Expected enabled boolean")
			return
		}
		if err := pub.updateMinimalistMode(*payload.Enabled); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Unable to save Minimalist Mode setting: "+err.Error())
			return
		}
		respondWithJSON(w, http.StatusOK, minimalistPreference{Enabled: *payload.Enabled})
	})

	return r
}

func handleGetLiveSummary(pub *eventPublisher) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		summary := pub.liveSummary(false)
		respondWithJSON(w, http.StatusOK, summary)
	}
}

// This function is now correct as it receives both required arguments.
func handleClearState(pub *eventPublisher, sm *SessionManager) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Stop and discard the current live session.
		sm.StopCurrentSession()
		sm.DeleteSession(liveSessionFilename) // Delete the temporary file

		// Clear the in-memory aggregator
		pub.ClearCache()

		// Start a fresh new live session
		if _, err := sm.StartLiveSession(); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to start new session after clearing: "+err.Error())
			return
		}

		// Re-write appear events for all currently cached entities so the new log has them
		pub.aggregator.mu.RLock()
		var activeEntities []*packet.EntityInfo
		for _, entity := range pub.aggregator.entityCache {
			activeEntities = append(activeEntities, entity)
		}
		pub.aggregator.mu.RUnlock()
		sm.WriteEntityAppearEvents(activeEntities)

		w.WriteHeader(http.StatusNoContent)
	}
}
