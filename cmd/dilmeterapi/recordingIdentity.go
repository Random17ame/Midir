package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"strings"
)

// Generated once at save; stored in the NDJSON summary, not in the filename.
func newRecordingID() (string, error) {
	var id [16]byte
	if _, err := rand.Read(id[:]); err != nil {
		return "", err
	}
	return "recording-" + hex.EncodeToString(id[:]), nil
}

func validRecordingID(id string) bool {
	var raw string
	switch {
	case strings.HasPrefix(id, "recording-") && len(id) == len("recording-")+32:
		raw = strings.TrimPrefix(id, "recording-")
	case strings.HasPrefix(id, "legacy-sha256-") && len(id) == len("legacy-sha256-")+64:
		raw = strings.TrimPrefix(id, "legacy-sha256-")
	default:
		return false
	}
	_, err := hex.DecodeString(raw)
	return err == nil && raw == strings.ToLower(raw)
}

// Historical recordings have no durable ID. Hash the original ordered event
// lines, excluding mutable summary events. Scanner normalizes LF/CRLF and a
// missing final newline. Identical legacy event streams represent the same
// evidence; never guess separate identities from titles or export filenames.
type legacyRecordingIdentity struct {
	digest   hash.Hash
	nonblank bool
}

func newLegacyRecordingIdentity() *legacyRecordingIdentity {
	return &legacyRecordingIdentity{digest: sha256.New()}
}
func (l *legacyRecordingIdentity) addLine(line []byte) {
	if len(bytes.TrimSpace(line)) > 0 {
		l.nonblank = true
	}
	l.digest.Write(line)
	l.digest.Write([]byte{'\n'})
}
func (l *legacyRecordingIdentity) id() string {
	if !l.nonblank {
		return ""
	}
	return "legacy-sha256-" + hex.EncodeToString(l.digest.Sum(nil))
}
