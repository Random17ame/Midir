package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Rewrite only the metadata header, preserving all original event bytes and
// unknown header fields. Publish through a temporary file, never truncate the
// recording in place if reading or writing fails.
func updateSessionHeaderName(filePath string, newName string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	reader := bufio.NewReader(f)
	firstLine, err := reader.ReadBytes('\n')
	if err != nil && err != io.EOF {
		return err
	}
	var event eventBase
	if json.Unmarshal(firstLine, &event) != nil || event.EventId != eventIdSessionSummary {
		return nil
	}
	var header map[string]json.RawMessage
	if err := json.Unmarshal(firstLine, &header); err != nil {
		return err
	}
	var summary map[string]json.RawMessage
	if err := json.Unmarshal(header["summary"], &summary); err != nil {
		return err
	}
	if summary == nil {
		return fmt.Errorf("missing saved session summary")
	}
	summary["name"], err = json.Marshal(newName)
	if err != nil {
		return err
	}
	header["summary"], err = json.Marshal(summary)
	if err != nil {
		return err
	}
	updated, err := json.Marshal(header)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(filePath), ".midir-renaming-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	if _, err := tmp.Write(append(updated, '\n')); err != nil {
		return err
	}
	if _, err := io.Copy(tmp, reader); err != nil {
		return err
	}
	if err := tmp.Sync(); err != nil {
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), filePath)
}
