# Midir session bundle — interoperability specification v1

**Producer:** Midir 49.a (supersedes the 49 export choices). **Intended consumer:** Midir Companion 0.3.13 ZIP importing (developed separately). This is an offline exchange contract, not a change to the capture protocol, Companion v1 combat schema, or NDJSON event schema. See [baseline audit](BULK-EXPORT-AUDIT.md), [manifest JSON Schema](SESSION-BUNDLE-MANIFEST.schema.json), and [Skill and Export Reference](SKILL-AND-EXPORT-REFERENCE.md).

## 1. Archive and payload formats

Open **Batch Export Sessions** in the saved-session sidebar, select recordings, and download one universal HTML ZIP. There is no format selector. Each included HTML report is self-contained and can be extracted and opened independently, or imported into Companion directly from the ZIP. The complete HTML bytes (including CSS, JavaScript and embedded evidence) must be retained by Companion for its existing report viewer. Bulk export loads the full saved-session summary independently of the live meter, including Minimalist recordings. Optional exact-character filtering retains existing semantics; all bulk reports include all combat targets for their selected scope. Export is read-only. Individual HTML export and its selected-player / selected-target options remain available.

| Format | ZIP layout | Consumer behavior |
|---|---|---|
| Universal (49.a+) | `manifest.json` and root-level `Title-storageId.html` files | Validate, retain original HTML and invoke existing individual HTML import pipeline. |
| Legacy (pre-49) | HTML files; no manifest | Existing HTML detection and embedded JSON extraction fallback. Retain original HTML. |
| Retired 49 data-only | `manifest.json` and `sessions/session-000001.json`, etc. | Not produced by 49.a. Optional legacy data-only support; no original viewer exists. Report unsupported if not implemented. Never fabricate a full report. |

All ZIP entry paths are relative, use `/`, and are unique (including case-insensitive, NFC-normalized comparisons). HTML filenames retain the historic sanitized descriptive layout, with length limits and `-2`, `-3`, etc. suffixes for collisions. Names and paths are presentation only, never identity. Unicode filenames and data use UTF-8 (ZIP general-purpose flag bit 11); JSON has no BOM. Archive download naming keeps the existing earliest recording date/encounter naming without a format suffix.

ZIP uses standard raw DEFLATE (method 8) via native browser `CompressionStream('deflate-raw')` when available and smaller than the original entry. Otherwise it uses STORE (method 0). A ZIP can contain both methods. Compression is lossless and performed during export, never during capture. The reader must support both methods. CRC-32 and SHA-256 cover uncompressed bytes. The writer uses classic non-ZIP64 headers, no passwords, encryption, nested archives or external resources. Reject oversize archives rather than wrapping offsets or truncating data: current writer allows at most 65,533 sessions plus the manifest, with total ZIP size strictly below `0xffffffff` bytes and each uncompressed entry below that limit. Browser memory limits can fail earlier; no partial ZIP is published on packaging failure. The producer reports unreadable/unexportable sessions as skipped and lists only successfully prepared reports; if none succeed, no archive is produced. A saved NDJSON line exceeding the current 32 MiB scanner limit causes an explicit read failure rather than a partially reconstructed export. Existing malformed-event handling otherwise remains unchanged.

This is **not** an NDJSON/PCAP backup; the report contains its existing exported evidence streams. Nothing is removed from the original portable report. Missing historical hits/activations remain missing. No extra JSON sidecar or shared viewer files are needed.

## 2. Root manifest

Example (illustrative IDs and times; optional hashes omitted here):

```json
{
  "format": "midir-session-bundle",
  "schemaVersion": 1,
  "exporterVersion": "49.a",
  "createdAt": "2026-12-01T00:00:00.000Z",
  "sessionCount": 1,
  "sessions": [
    {
      "id": "recording-00000000000000000000000000000001",
      "path": "Example session-session-123_ndjson.html",
      "type": "combat-session",
      "payloadFormat": "html-report",
      "dataSchemaVersion": 1,
      "dataSchemas": {"companion": 1, "skillObservation": 1, "damageHit": 1, "skillUse": 1, "encounter": 1},
      "startAt": "2026-11-24T00:00:00.000Z",
      "endAt": "2026-11-24T00:01:30.000Z",
      "scope": {"playerId": null, "targetId": null, "targetEntityIds": []},
      "healingIncomplete": false
    }
  ]
}
```

| Root field | Type / meaning |
|---|---|
| `format` | Exact string `midir-session-bundle`. |
| `schemaVersion` | Integer `1`, manifest format version independent of application version. |
| `exporterVersion` | Midir release string; `49.a` in this release. Do not interpret as a combat schema version. |
| `createdAt` | ISO 8601 UTC archive creation instant, with milliseconds. Not recording time. |
| `sessionCount` | Integer number of successfully included session entries (not necessarily distinct recording IDs). Equals `sessions.length`. |
| `sessions` | Ordered array of entries; paths are exact case-sensitive ZIP names. |

| Entry field | Type / meaning |
|---|---|
| `id` | Durable recording identity, identical to payload `exportMetadata.id`. See section 4. |
| `path` | Relative file path. Required, unique; resolves to exactly one entry in ZIP. |
| `type` | Exact `combat-session`. Burst comparison reports are not session bundle entries. |
| `payloadFormat` | `html-report` for current producer. `report-json` was emitted only by the retired Midir 49 data-only choice; retained in schema v1 for compatibility. |
| `dataSchemaVersion` | Integer `1`: existing `companion.version`, **not** a new unified report schema. |
| `dataSchemas` | Explicit version map for each existing stream (`companion`, `skillObservation`, `damageHit`, `skillUse`, `encounter`). All currently 1. |
| `startAt`, `endAt` | ISO 8601 UTC from saved summary `startTime` / `endTime` (recorded damage bounds, Unix seconds). Null if unavailable. No invented endpoint, no export/save clock substitution. |
| `scope` | Object: `playerId` string or null for whole-party export; `targetId` string or null for all targets; `targetEntityIds` array of strings for a chosen group, otherwise empty. Current batch target scope is always all-targets. |
| `healingIncomplete` | Boolean; true if incomplete healing was flagged in the saved recording. False means no incomplete flag, not independent proof of complete healing for old recordings. |
| `payloadSha256` | Optional lowercase 64-character SHA-256 of exact portable JSON UTF-8 bytes. |
| `fileSha256` | Optional lowercase 64-character SHA-256 of exact uncompressed ZIP entry bytes. |

The manifest is first in the ZIP's entry order. Readers should use the central directory, not rely on ordering. The JSON Schema defines types and known values; validate the count, exact path membership, scope constraints and payload agreement separately. Unknown fields can be ignored for a supported schema version. Reject unsupported versions explicitly; do not silently treat a present but invalid manifest as legacy.

## 3. Shared payload and individual HTML

A saved report produced by Midir 49 or later includes the following top-level field, alongside the original streams:

```json
"exportMetadata": {
  "schemaVersion": 1,
  "id": "recording-00000000000000000000000000000001",
  "exporterVersion": "49.a",
  "startAt": "2026-11-24T00:00:00.000Z",
  "endAt": "2026-11-24T00:01:30.000Z",
  "scope": {"playerId": null, "targetId": null, "targetEntityIds": []},
  "healingIncomplete": false
}
```

This is additive metadata only; existing `companion` remains unchanged. `exportMetadata.schemaVersion` describes that metadata object, not the manifest or combat streams. For a saved recording with no reliable identity (e.g., an empty historical event stream), standalone legacy-compatible export may omit `exportMetadata` if otherwise exportable; batch export skips it explicitly rather than inventing an ID. The legacy standalone Companion-only JSON helper is not the new bundle payload and is not changed; the saved-session UI's individual HTML and universal ZIP use the shared portable-report payload builder.

| Existing payload field | Version / interpretation |
|---|---|
| `companion` | `format: midir-companion`, `version: 1`; targets, HP, conditions, players, skills, logical/canonical encounters, per-encounter Arcana and provenance. |
| `damageHitEvents`, `damageHitSchemaVersion` | v1 precise positive hits; `atMs` absolute Unix ms, `relativeMs` relative to summary start, string IDs, damage, critical/delayed and available pet context. |
| `skillUseEvents`, `skillUseSchemaVersion`, `skillUseEvidence` | v1 independent observed `0x6988` use events; not verified cast counts. Pre-pull relative times may be negative. |
| `skillObservations`, `skillObservationSchemaVersion` | v1 raw typed skill observations; preserve candidate IDs, actor verification, fields and field types. |
| `encounters`, `encounterSchemaVersion` | v1 canonical recognized attempts, entity IDs, bounds and completion evidence. Not additional fights on top of legacy logical encounters. |
| `reviveEvents`, `views`, `players`, `enemies`, `boss`, `targets`, `duration`, scope fields | Existing report representations, not alternative raw evidence streams. Do not double-count identical hits repeated in view aggregates. |

Maintain all prior interpretation rules. Missing streams in old recordings remain missing/empty; do not infer observed use events from hit groups. Player entity IDs remain strings even above JS safe-integer limits. Only known observed evidence supports clear/attempt status and Arcana assignment. Minimalist provenance is retained; missing healing is not zero healing.

The HTML viewer continues to parse `document.getElementById('data').textContent`; Companion should parse the script text **as data**, without executing embedded JavaScript, loading resources, or opening a browser. Retain the original complete HTML for later viewing in the existing isolated report viewer. Import-time parsing and display-time script execution are separate operations. For retired data-only entries, parse JSON directly only if supported; the original HTML is unavailable. Existing `<` escapes are intentionally retained in the raw JSON bytes (`\\u003c` in JS source, `\u003c` in the file); JSON parsing restores original characters.

## 4. Stable identity and deduplication

The storage filename (`Session.id`) is not the export identity. New saved NDJSON headers contain `summary.recordingId`:

- `recording-` + 32 lowercase hex characters: 128 cryptographically random bits allocated once at successful save creation. Persisted in the saved summary event and reconstructed on subsequent reads. Different newly saved recordings get distinct IDs even if the underlying timestamps, participants, or hits coincide. Copying the file copies its identity.
- `legacy-sha256-` + 64 lowercase hex characters: deterministic fallback when no valid stored ID exists. SHA-256 over original NDJSON lines in order, **excluding any successfully decoded `EventId: 9999` summary line**. Each line is its original bytes as returned by Go `bufio.Scanner`/`ScanLines`, followed by exactly one LF (`0a`): normalizes LF/CRLF and the missing final newline. All other lines, including unrecognized/malformed lines and blank lines, participate; empty or whitespace-only evidence produces no fallback ID. No JSON reserialization, display title, filename, absolute path, summary-header data or export date is included. A nonblank legacy raw-event stream copied or renamed retains the same identity. Explicit migration persists the derived ID without changing event bytes; ordinary exports do not rewrite historical files.

Legacy limitations are fundamental: two independently recorded historical files with byte-identical normalized event streams cannot be distinguished from copies and intentionally deduplicate. Editing, reordering or reserializing legacy raw events *before* a durable ID has been persisted may change identity. Once a stored ID exists, preserve it when revising the same recording. An old Midir version that rewrites headers and discards unknown fields may lose a stored ID; retain backups and avoid downgrading/migrating new recordings with an older exporter.

Recommended consumer model:

1. Group imports by **recording `id`**. Compare the scope separately: same ID can appear as whole party, a player-only report, or selected-target report. Null scope values mean all, never an unnamed player or target. Include `playerId`, `targetId`, and (when relevant) the sorted unique target entity IDs in the variant key.
2. Within that recording/scope, matching `payloadSha256` is an exact duplicate. Across individual HTML and ZIP HTML, the same payload hashes identically. The retired 49 JSON form also hashed the same payload bytes. Path, archive creation time, outer filename and viewer file hash are not identity. If the optional hash is absent, compute it from extracted payload bytes.
3. Same ID and scope with a different payload hash is a different **payload revision**, not a new run. It can arise from revised evidence, updated interpretation, a renamed title, appearance colors, ordering, or a new exporter version. Do not silently merge incompatible revisions or count either as another achievement. Keep revision information, apply a deliberate replacement/merge policy, and re-index once per recording. A whole-party/all-target report and narrower scopes are not independent sessions; do not add their totals together or let a partial variant overwrite complete evidence merely because it arrived later.
4. Existing pre-49 HTML exports lack this ID; keep Companion's existing legacy import recognition. An exact-byte fingerprint can detect unchanged copies but cannot guarantee a match against a newly identified/revised export of the same recording. Do not manufacture permanent legacy IDs from names and dates.

## 5. Hashes and integrity

SHA-256, lowercase hex, no prefix. `payloadSha256` hashes UTF-8 JSON bytes exactly as embedded between the script tags or stored in the `.json` file. Do not trim, pretty-print, JSON.parse/stringify, HTML-unescape, add a newline, normalize Unicode or include the script tags. `fileSha256` hashes all uncompressed entry bytes; for JSON it equals `payloadSha256`, for HTML it covers viewer and payload. The manifest itself is not hashed by these fields. Both are emitted together when Web Crypto is available (normal loopback Midir UI or HTTPS); both are omitted in a non-secure LAN HTTP context without `crypto.subtle`. ZIP CRC-32 is always present. A digest error aborts packaging, rather than silently returning an invalid hash.

These hashes are integrity/revision aids, not signatures, authentication, canonical semantic fingerprints or evidence of provenance. Validate ZIP CRC and optional hashes before committing a new entry. Different hashes do not by themselves prove that damage changed. In particular 49.a changes exporterVersion from 49 to 49.a, so the same recording exported across those releases can have a different payload hash. Compression alone never changes either hash. No hashing of display filenames or export dates is required for deduplication.

## 6. Offline consumer validation sequence

- Read the central directory and root `manifest.json` without extracting into arbitrary filesystem paths. Reject duplicate/unsafe/absolute/traversing paths, NUL, encrypted entries, unsupported compression/ZIP features (support methods 0 and 8) and invalid manifests; impose reasonable entry/count/uncompressed-byte limits before allocation. Do not trust a claimed size or manifest count alone. Do not follow symlinks, URLs or HTML scripts.
- If the manifest is absent, use legacy HTML detection; if present, validate format/version, counts, unique paths, actual entry existence, type/payload/schema values, timestamp syntax, scope, ID syntax and optional hashes. Unknown versions should fail clearly. For v1 producer archives, expect exactly the manifest plus the listed entries. Only read/parse selected session payloads after manifest preflight; verify before committing even if a manifest claims a known duplicate, or treat preflight skip as an unverified optimization without altering trusted data.
- Check CRC and `fileSha256` if present. Extract JSON without executing HTML; check `payloadSha256`, then parse JSON. Confirm `exportMetadata.id`, metadata version, exporter version, scope, timestamps and healing flag agree with the manifest. Confirm existing schema fields and `companion.format/version`. Keep historical missing observations explicit. Reject/quarantine invalid entries rather than silently importing partial or altered data. Report import counts, duplicates and rejected entries separately.
- Use recording identity and scope/revision rules above. Persist import state locally; no online services, shared database or Midir installation required. Store the original uncompressed HTML bytes alongside the parsed data; pass them to the same isolated viewer as individual imports, not a recreated report. Never execute arbitrary HTML in the privileged app origin or expose native bridges to report scripts. Treat unknown file types as unsupported; don't feed `manifest.json` to the combat parser. The outer QA fixture pack is a distribution of individual sample ZIPs, not a supported nested import format.

## 7. Evolution and implementation notes

Midir and Companion can ship independently. Companion 0.3.13 is not bundled or modified here. Future compatible metadata fields may be additive; incompatible manifest changes increment manifest `schemaVersion`. Any combat evidence schema evolution remains independently versioned. Update `SESSION_EXPORTER_VERSION` in `front/src/utils/portableReport.ts` on future releases that publish exports. Do not change identity algorithms under schema v1; add explicit new identity formats if needed.

Source: `sessionBundle.ts`, `batchZip.ts`, `portableReport.ts`, `SessionPanel.vue`, `recordingIdentity.go`, `sessionHeader.go`, `sessionManager.go`, `httpHandlerSession.go`. Regression suite: `front/tests/session-bundle.test.cjs`; Go tests: `recordingIdentity_test.go`, `sessionHeader_test.go`, `recording_identity_integration_test.go`. See [verification report](SESSION-BUNDLE-VERIFICATION.md) for measured results and remaining integrated checks.
