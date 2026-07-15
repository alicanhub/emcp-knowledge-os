# Content Production Engine v1 architecture

This directory is the modular boundary for Content Production Engine v1. Shared contracts remain implementation-independent. Runtime modules are introduced individually with focused tests; modules that have not reached that phase remain type-only boundaries.

The existing production engine remains operational in `scripts/content/production-engine.mjs`. A later implementation can migrate one module at a time behind these interfaces without changing current content or command behavior.

## Dependency direction

All modules may import shared types from `contracts.ts`. Modules must not import browser UI code, authored content files or concrete filesystem implementations. The orchestration interface in `index.ts` may depend on module ports; individual modules must not depend on the orchestrator.

Adapters implemented later should live outside these contract folders and be injected through the declared interfaces. This keeps filesystem access, clocks, hashing, validation libraries and command-line behavior replaceable in tests.

## Module ownership

| Module             | Owns                                                     | Must not own                               |
| ------------------ | -------------------------------------------------------- | ------------------------------------------ |
| `job-queue`        | Job persistence, queries and valid lifecycle transitions | Draft creation or import                   |
| `topic-planner`    | Identity comparison and plan contracts                   | Knowledge prose generation                 |
| `draft-generator`  | Draft-only generation request/result boundary            | Review approval or reviewed-file movement  |
| `research-queue`   | Claim, citation and source-review state                  | Treating non-official material as verified |
| `human-review`     | Human checks and explicit outcomes                       | Automated approval                         |
| `batch-validation` | Pack-scoped findings and import eligibility              | Runtime mutation                           |
| `safe-import`      | Dry-run and approved import transaction boundary         | Personal workspace data                    |
| `backup-rollback`  | Runtime manifests, hashes and restoration                | Browser storage                            |
| `dashboard`        | Read-only aggregated snapshot                            | Editing, approval or public administration |
| `maintenance`      | Periodic findings requiring action                       | Silent content correction                  |

## Core invariants

1. Generated knowledge records have `reviewStatus: "draft"`; draft generation reports that zero reviewed records were created.
2. Human review is represented by a named reviewer, date, complete check matrix and explicit outcome.
3. A safe import receives a successful dry-run artifact and named approval.
4. Backups use file references and hashes, and rollback reports whether every restored hash was verified.
5. Dashboard contracts are read-only projections.
6. Module types use immutable properties so callers cannot mutate shared production state implicitly.
7. English and Turkish content use the same `LocalizedText` boundary.

## Job Queue Engine v1

`job-queue/json-job-queue.js` is the first runtime module. It provides an operational queue without coupling it to authored content or the existing CLI:

- lifecycle states from pending through completed or failed;
- critical, high, normal and low priority ordering;
- completed-job dependency gates;
- bounded retries;
- pause, resume and irreversible cancellation controls;
- lifecycle and control timestamps;
- queue statistics and filtered queries;
- versioned JSON persistence using an atomic temporary-file rename;
- defensive validation when persisted state is loaded.

Call `load()` once after constructing a queue that may already have a persistence file. Mutating methods persist before they resolve. Returned records are defensive copies and cannot mutate queue state.

## Topic Planner v1

`topic-planner/topic-planner.js` turns a bilingual content-pack definition and its proposed topics into a deterministic production plan. It:

- removes duplicate IDs, English or Turkish titles, abbreviations and aliases;
- reconciles candidates with runtime knowledge IDs, titles, translations and aliases;
- enforces topic prerequisites and rejects missing references or cycles;
- uses difficulty-aware topological ordering for the learning sequence;
- estimates drafts and workload without counting existing runtime concepts;
- allocates new drafts into capacity-bound calendar months;
- writes versioned JSON reports atomically;
- can enqueue the completed plan as a Job Queue Engine job.

The planner creates plans only. It does not generate drafts, approve content or modify the runtime knowledge base.

## Draft Generator v1

`draft-generator/draft-generator.js` consumes Topic Planner v1 plans directly or from their Job Queue Engine jobs. It writes deterministic Knowledge Entry v2 draft JSON into a configured drafts directory.

- Every v2 section is present in English and Turkish.
- Unresearched narrative is explicitly marked as requiring research and professional review; no source, formula, regulation or approved claim is fabricated.
- Runtime-existing topics and IDs found anywhere in the approved-content directory are skipped.
- Regeneration creates a numbered file and draft ID, preserving every earlier draft.
- Draft metadata records the source pack, planner job, generator version and timestamps.
- Queue-backed generation advances a ready planner job through `planned` to `drafting`; failures are recorded through the queue.
- Generated records always remain `draft` and report zero reviewed records created.

## Research Queue v1

`research-queue/research-queue.js` creates an independent nine-category research pipeline for every generated draft. Regulations, standards, formulas, calculators, references, UK guidance, Turkey guidance, examples and glossary links each receive their own task.

Tasks progress from `pending` to `researching`, then to `verified` or `rejected`. Verification requires at least one evidence item and a positive confidence score; rejection requires a reason. Each task supports multiple field-specific evidence items with publisher, HTTPS URL, jurisdiction, official-source flag, dates and reviewer notes.

The queue uses atomic versioned JSON persistence and exports read-only JSON reports with status/category statistics. Draft Generator queue execution can create the research tasks and advances its production job to `research`. Research storage never writes to draft files, reviewed content or runtime knowledge.

## AI Research Connector v1

`ai-research-connector/provider-neutral-connector.js` is a vendor-neutral boundary between future research providers and Research Queue v1. Providers implement only the typed adapter contract and declare supported source types, jurisdictions and languages. The connector contains no network client, API key, provider SDK or vendor-specific response type.

Normalized research covers web sources, government publications, standards, regulations, technical documents and official guidance. Every candidate receives a structured citation, source-validation result and explainable confidence score based on provider confidence, official/primary-source status, validation and corroboration. Invalid citations are retained in the connector report but never added as evidence.

Accepted evidence is written through the existing Research Queue API and its aggregate confidence is recorded. The task remains `researching`: the connector never treats model output as verified and cannot bypass human evidence review.

## AI Draft Writer v1

`ai-draft-writer/evidence-gated-draft-writer.js` enriches Topic Planner draft output through a provider-neutral writing adapter. It consumes only verified Research Queue evidence produced through the AI Research Connector boundary. Provider sections must identify their exact evidence IDs; formulas, standards, regulations, jurisdiction guidance and examples also require evidence from an appropriate research category.

Deterministic mode makes no provider call and never invents factual prose. Every Knowledge Entry v2 section is retained, while unsupported fields receive bilingual research-required content or safe empty/null values. Verified citations are normalized into schema-compatible sources. The writer records structured version metadata and returns per-draft bilingual completeness, evidence coverage, source and unsupported-section metrics without adding non-schema fields to content.

The Production Orchestrator invokes the writer after all research tasks are verified and before Human Review when an `aiDraftWriter` service is configured. Drafts remain in draft status and reviewed content cannot be modified.

## Knowledge Quality Scoring Engine v1

`knowledge-quality/weighted-quality-scorer.js` calculates a transparent 0–100 score for each Knowledge Entry v2. The default weights total 100: completeness 18, evidence coverage 16, citation quality 14, bilingual consistency 14, readability 10, review freshness 10, relationship quality 8, calculator integration 5 and media readiness 5. Custom weights are accepted only when every value is non-negative and the total remains 100.

Each result contains the raw category score, weight, weighted contribution, overall quality band and prioritized improvement recommendations. Batch reports include average, minimum, maximum and band distribution and can be exported atomically as JSON.

AI Draft Writer results include the full knowledge-quality score alongside their generation metrics. Human Review can persist a score at case creation and refresh it on approval when configured with the scorer. Production Dashboard exposes averages, band counts and records below target. Production Orchestrator publishes scores through its `knowledge-quality` cycle output and forwards them to the Dashboard.

## Human Review Workflow v1

`human-review/human-review-workflow.js` manages audited editorial review cases without editing draft or approved content. A case can open only after all nine Research Queue categories are verified.

- Cases support assigned reviewers and multiple numbered review rounds.
- Reviewers attach suggestion, required or blocking comments to individual Knowledge Entry fields.
- Comment resolution records the responsible person, timestamp and resolution note.
- Decisions support approval, rejection and revision requests with mandatory notes.
- Approval is blocked while required or blocking comments remain unresolved.
- `canPublish()` and `assertPublishable()` provide an explicit approval gate for downstream publishing.
- Every action is appended to the case audit trail and retained across rounds.
- Job Queue integration advances approved work to `validation`, returns revisions to `drafting`, and records rejection as `failed`.
- Versioned JSON reports contain case, round, comment, decision and audit history.

## Batch Validation Engine v1

`batch-validation/batch-validator.js` is the critical pre-publishing gate for Draft Generator v1 batches. It loads only files declared by the draft manifest and validates them against the real Knowledge Entry v2 JSON Schema.

Checks include required v2 fields, schema compliance, manifest metadata, bilingual completeness, duplicate IDs/titles/aliases/abbreviations, internal concept references, formula structure and worked examples, calculator registry IDs, completed Research Queue evidence and explicit Human Review approval.

Reports are deterministic versioned JSON with field-level findings and critical/error/warning counts. `assertPublishable()` blocks downstream publishing unless the report passes. Job Queue validation moves a passing job to `import`; any critical or error finding moves it to `failed`.

## Safe Import Engine v1

`safe-import/safe-import-engine.js` accepts only a passing Batch Validation v1 report whose pack and planner-job metadata match the Draft Generator manifest. It stages all v2-to-runtime mappings, search data and relationships in an isolated copy and verifies counts, metadata and relationship targets before a directory-level atomic swap.

- Duplicate import IDs, record IDs and runtime titles are rejected.
- The complete pre-import runtime is backed up with SHA-256 file hashes.
- Prepared and completed import manifests record counts, records and before/after hashes.
- An append-only JSON audit log records successful imports and automatic rollbacks.
- Any staging, swap, manifest, audit or Job Queue failure restores the prior runtime directory.
- Search and relationship indexes become visible in the same transaction as category, translation and v2 detail data.
- Successful Job Queue imports advance from `import` to `completed`; failed transactions advance to `failed`.

## Backup & Rollback Engine v1

`backup-rollback/backup-rollback-engine.js` creates versioned snapshots of the complete production runtime directory. Full backups store every file. Incremental backups store only additions and changes, while their manifest retains a complete logical file map referencing the snapshot that owns each verified blob; deletions are recorded explicitly.

Every manifest records SHA-256, byte size, runtime count, parent version and changed/deleted files. Restore verifies every referenced checksum before reconstructing into staging, verifies staging again, then performs an atomic directory swap. Backup and restore reports are JSON, and backup creation, manual restore and automatic rollback are retained in append-only audit history.

Safe Import can use this engine as a second recovery layer: it snapshots before each transaction and invokes a verified automatic restore if importing fails.

## Production Dashboard v1

`dashboard/production-dashboard.js` is a read-only aggregation service with no UI dependency. It combines Job Queue statistics, Topic Planner completion, Draft Generator runs, Research Queue verification, Human Review outcomes, Batch Validation findings, Safe Import manifests and Backup/Rollback manifests plus audit history.

Snapshots include per-layer percentages, compact histories and an overall production funnel. Inputs are defensively copied, returned data is recursively frozen, and JSON exports use atomic replacement. Empty repositories produce zero-valued metrics; malformed collection inputs are rejected rather than hidden.

## Monthly Maintenance Engine v1

`maintenance/monthly-maintenance-engine.js` schedules idempotent monthly jobs through the Job Queue and performs read-only production health audits. Each run validates runtime category and translation integrity, detects orphaned detail records and invalid relationship references, checks search/relationship index alignment, and recommends entries whose latest revision date exceeds the configured review interval.

Backup checks verify the newest snapshot checksum and age. Dashboard checks require a valid v1 snapshot with core production metrics. Findings carry severity, stable codes, paths and human-review flags; reports include health summaries and re-review recommendations and can be written atomically as JSON. Maintenance never edits knowledge, indexes, backups or dashboard state.

## Production Orchestrator v1

`orchestrator/production-orchestrator.js` coordinates the twelve-stage production cycle from Content Pack loading through planning, queued draft production, research, human review, validation, safe import, backup, dashboard refresh, monthly maintenance and a final report.

Every completed stage is atomically checkpointed. Re-running the same cycle resumes at the first incomplete stage, while explicit stage ranges support partial execution. Research or approval gaps pause with `awaiting-input` instead of bypassing professional review. Every transition emits a structured, sequenced event with progress, and the final JSON report retains stage outputs and the complete event history.

Dry runs plan the whole cycle without creating jobs, drafts, research tasks, reviews, imports or backups. If a post-import stage fails, the orchestrator restores the Safe Import pre-transaction backup and records the rollback outcome in both its event stream and final report.

## Implementation order

1. Concrete read-only catalogs and schema adapters.
2. Job queue and topic planner (implemented).
3. Research and human-review repositories.
4. Draft generator with enforced draft status.
5. Batch validator.
6. Backup/rollback and safe-import transaction.
7. Dashboard projections and maintenance scanners (implemented).
8. Orchestration and CLI adapters after every module has contract tests.

Interface files remain free of business logic. Concrete implementations live in separate module files and are added only as explicitly requested phases.
