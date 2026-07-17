# Product and release operations

## Release channels and flags

`config/runtime.json` declares `stable`, `beta`, or `canary` and independently
controls worker search, result virtualization, idle feature preloading, local
analytics and performance monitoring. Promote the same immutable build through
canary → beta → stable after its quality gate passes; change one flag at a time
and retain a known-good runtime configuration for rollback.

## Privacy-respecting measurement

`EMCPOperations` stores only daily aggregate counters on the device for 30 days.
It records no search text, knowledge content, financial inputs, names, URLs,
identifiers or fingerprints. The measurable funnel is:

1. `app_open`
2. `page_knowledge` / `knowledge_search` / `knowledge_open`
3. `page_calculators` / `calculator_complete`
4. `workspace_open` / `workspace_export`
5. `page_assistant` / `assistant_question`

`snapshot()` supports local inspection and `clear()` erases counters and
diagnostics. `setAdapter()` is an explicit integration hook for an approved
privacy service. Error records are sanitized and bounded; performance hooks send
only entry name, duration and release channel to an explicitly installed adapter.

## Backup and recovery

Users should export the workspace before device migration and keep encrypted,
versioned copies under their own control. The application keeps the five most
recent pre-import snapshots locally and exposes recovery through
`EMCPWorkspace.getAutomaticBackups()` and `restoreAutomaticBackup(index)`.
Test restore procedures quarterly and before any workspace schema migration.
