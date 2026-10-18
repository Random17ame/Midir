# Pinned upstream source comparison

**Original repository:** https://github.com/Marcentus/Midir  
**Pinned commit:** `6f264b407dbd842fbafeef8d14cc1cff5f505af4`  
**Original archive:** `Midir-6f264b407dbd842fbafeef8d14cc1cff5f505af4.zip` (uploaded by the project owner)  
**Modified archive:** `Midir-07.zip` (user reports compiling Midir-06 successfully; Midir-07 changed documentation only)  
**Comparison method:** content hashes / byte equality for each relative file path, ignoring ZIP root-folder name and directory entries. Both archives passed ZIP integrity tests. This is not a commit-history-aware Git diff.

## Counts

| Classification | Files |
| --- | ---: |
| Same path and identical bytes | 1,326 |
| Same path with different bytes | 14 |
| Only in modified Midir | 9 |
| Only in pinned original | 0 |

## Modified original files

- `cmd/dilmeterapi/aggregator.go`
- `cmd/dilmeterapi/aggregator_test.go`
- `cmd/dilmeterapi/eventPublisher.go`
- `cmd/dilmeterapi/httpHandlerSession.go`
- `cmd/dilmeterapi/sessionManager.go`
- `cmd/dilmeterapi/summary.go`
- `front/src/apicall.ts`
- `front/src/components/DamageGraph.vue`
- `front/src/components/DamageMeterView.vue`
- `front/src/components/SettingsView.vue`
- `front/src/components/applyDamageBySkill.vue`
- `front/src/protocols.ts`
- `front/src/store.ts`
- `front/src/types.ts`

## New files in modified Midir

- `CONTRIBUTING-CHANGES.md`
- `FEATURE-CHANGELOG.md`
- `HEALING-REWORK-NOTES.md`
- `REVIEW-NOTES.md`
- `cmd/dilmeterapi/skill_group_rebuild_test.go`
- `front/src/components/DamageScatterChart.vue`
- `front/src/components/applyHealingBySkill.vue`
- `packet/healingPacket.go`
- `packet/healingPacket_test.go`

## Interpretation and limitations

- No original files were removed. The build scripts, root README files, dependencies (`go.mod`, `go.sum`) and LICENSE are unchanged.
- The modified files encompass session reconstruction, skill-hit/event data, scatter chart, graph controls, Ghost Runner, Death Flags, Damage Dealt UI, Personal Best comparisons, settings, and experimental healing/overshield work. See `FEATURE-CHANGELOG.md` for feature descriptions and cautions.
- Experimental healing and shield attribution have not been validated as exact effective healing or shield generation; do not advertise them as fully accurate.
- Comparing source ZIPs does not show parentage of other forks, identify authors, or guarantee no dead code. A formal PR should include a Git branch based on the pinned upstream commit and pass relevant builds and tests.
- This pinned original archive is an uploaded source ZIP identified by its commit SHA. Its identity is grounded in that supplied archive and URL; no independent Git-object verification was performed.
