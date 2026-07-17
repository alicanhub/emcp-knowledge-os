# EMCP Knowledge OS v3

## The Operating System for Property, Construction & Investment Professionals.

### Active modules

- Knowledge Library
- Ask EMCP local knowledge assistant
- Decision-grade calculator workspace with saved deal scenarios
- Construction Tools
- Personal workspace for favourites, recent entries, collections, notes and deal scenarios
- Bilingual Property Investor's Handbook with structured chapters, progress, saved chapters, notes, checklists and calculator links

### Personal workspace

- Named knowledge collections and usable favourites/recent views
- Private notes attached to knowledge entries and saved calculation scenarios
- Local JSON export/import for workspace backup and transfer
- Personal data remains on-device unless the user explicitly exports it

### Progressive Web App

- Install prompt where supported, with platform instructions as a fallback
- Versioned offline cache covering the complete bilingual app and knowledge base
- Offline navigation fallback without returning HTML for missing JSON or assets
- In-app connection state and new-version notifications
- Relative manifest, service-worker scope and asset paths for root or subpath deployment

To test PWA behavior locally, serve the repository over localhost rather than opening `index.html` directly. Service workers require a secure context (HTTPS or localhost).

### Languages

- Complete Turkish and English interface with a remembered language preference
- English and Turkish knowledge definitions and usage guidance for all 378 entries
- Bilingual search, Ask EMCP answers, calculator guidance, validation and scenario workflows

### Accessibility and responsive design

- Keyboard-operable modules, knowledge cards, filters and workspace tabs
- Dialog focus trapping, Escape/backdrop close and focus restoration
- Semantic navigation, tab, status, form and dialog relationships for assistive technology
- Visible high-contrast focus treatment, forced-colour support and reduced-motion behavior
- Phone, tablet and desktop layouts with mobile-sized form controls and bottom-sheet dialogs

### Reliability, security and maintenance

- Shared defensive JSON/storage layer with in-memory fallback when browser storage is unavailable
- Runtime schemas for knowledge indexes, category files, translations, collections, notes, scenarios and workspace backups
- Dedicated knowledge loading/search module separated from interface rendering and navigation
- Malformed or oversized persisted/imported data is rejected, bounded or safely ignored
- Content Security Policy with no inline scripts or event handlers, including the offline fallback
- Ask EMCP provider output is reduced to a small safe formatting allowlist before rendering
- Versioned service-worker cache includes every runtime module and offline dependency
- Compact precomputed search/relationship indexes, worker-backed retrieval, lazy category hydration and virtualized result batches
- Lazy assistant/calculator feature loading with offline-compatible cached modules
- Privacy-respecting on-device funnel counters, bounded diagnostics and opt-in monitoring adapters
- Stable/beta/canary release configuration, defensive feature flags, AI abuse limits and automatic pre-import workspace backups
- Production security headers, dependency scanning and release/backup operations are documented in `docs/security.md` and `docs/operations.md`

Run the complete automated regression suite with `node tests/regression.mjs`.

### Development and quality gates

- Install tooling with `npm ci`.
- Run the complete local/CI gate with `npm run test:all`.
- Build the deployable static application into `dist/` with `npm run build`.
- Runtime contracts are documented in `docs/architecture.md` and validated against the schemas in `schemas/`.
- Playwright covers desktop/mobile critical journeys, service-worker offline reloads and automated WCAG checks.
- Design tokens, reusable component states and bilingual accessibility rules are documented in `docs/design-system.md`.

### Content authoring and review

Knowledge Entry v2 adds expandable bilingual learning sections for beginner and professional explanations, project/site/office examples, interview preparation, formulas and calculators, mistakes, tips, risks, jurisdiction practice, references, revision history, difficulty, reading time, FAQs and future media. The generated `data/knowledge/details.json` layer automatically migrates every legacy runtime entry without removing or rewriting its original fields; `content/reports/migration-v2.md` records each migration run.

The application preserves its original 103 runtime records and uses the same runtime format for backward compatibility. Content Pack 001 adds 100 everyday fundamentals, Content Pack 002 adds 100 residential-property fundamentals, and Content Pack 003 covers 100 property-investor fundamentals by adding 75 new runtime concepts and enriching 25 existing concepts. The current runtime total is 378. New and updated material is authored in the richer format defined by `schemas/content-entry.schema.json`; only approved files from `content/reviewed/` can enter the application.

For a non-technical author:

1. Copy `content/templates/knowledge-entry.template.json` into `content/drafts/` and give it a descriptive file name, such as `finance.cap-rate.json`.
2. Fill in every English and Turkish field. Keep the `id` stable forever, use a semantic `content_version` such as `1.0.0`, and cite authoritative HTTPS sources with an access date.
3. Use `content/topic-plans/topic-plan.template.json` to plan a larger subject area, assign owners and track which records still need writing or review.
4. Ask a professional reviewer to check accuracy, jurisdiction, formulas, sources and language parity. The reviewer records their name and date, changes `review_status` to `reviewed`, and moves the file to `content/reviewed/`. Rejected work goes to `content/rejected/` with review notes retained outside the production import.
5. Run `npm run content:check`. Fix every error before importing. Warnings should also be reviewed and resolved where practical.
6. Run `npm run content:import`, then `npm run content:index`. Draft and rejected records are ignored; reviewed updates that declare `legacy_term` preserve the current runtime record, while genuinely new reviewed records are added.
7. Run `npm run content:report` to create `content/reports/latest-validation-report.md`, then run `npm run test:all` before release.

### Continuous content production

The Content Production Engine keeps planning, drafting, research, human review and importing separate. Generated records are always drafts; only a human-approved record moved into `content/reviewed/` can enter the runtime application.

For a beginner-friendly production cycle:

1. Run `npm run content:queue` and open `content/reports/production/master-content-queue.md`. Its “next recommended pack” is the next suggested job.
2. Run `npm run content:job:list` to see planned and active jobs. Use `npm run content:job:status -- job.example` for one job. A new job starts as a schema-valid JSON file in `content/jobs/planned/`; `npm run content:job:create` prints the safe starting instruction.
3. Add proposed bilingual concepts to the job planning input, then run `npm run content:plan -- job.example`. The planner checks runtime and authored titles, aliases and abbreviations and creates a plan only—it does not write knowledge content.
4. After a person approves the plan, run `npm run content:generate-drafts -- content/topic-plans/job.example.json`. Every generated record remains in `content/drafts/` with evidence warnings.
5. Run `npm run content:research-report` and `npm run content:review-report`. Verify official sources, natural Turkish, calculations, jurisdiction wording and references. Record a review outcome; only approved work should be moved manually into `content/reviewed/` with reviewer metadata.
6. Run `npm run content:validate-pack -- pack.003`. Read both the JSON and Markdown batch reports and resolve every finding.
7. Run `npm run content:dry-run`. Continue only when the report says `can_import: true`.
8. Run `npm run content:import-safe`. It creates a hash-verified runtime backup, imports atomically validated reviewed content, regenerates indexes and runs regression tests. If any step fails, the engine restores the backup automatically.
9. To restore the latest successful pre-import state manually, run `npm run content:rollback`. An explicit backup id may be supplied after `--`. Rollback changes runtime knowledge files only and never touches browser workspace data.
10. Run `npm run content:dashboard`, then serve the repository locally and open `admin/content-dashboard.html`. This is a read-only local administration page and is deliberately excluded from the production build.
11. Run `npm run content:monthly-report` each month. Review due dates, source URLs, regulation-monitoring items, missing translations, orphaned concepts and publishing coverage in `content/reports/production/monthly-maintenance.md`.

The first planned job is `job.pack-003-investor-expansion`. Its 50-concept topic plan and source-research plan exist, but no draft records have been generated.

Individual checks are available as `content:validate`, `content:duplicates`, `content:references`, `content:bilingual` and `content:sources`. Generated category, search and relationship indexes are written under `content/reports/indexes/`. The five files in `content/reviewed/` demonstrate reviewed, bilingual records that map safely to existing entries without duplicating them.

### Publishing architecture and Investor Handbook

Professional learning content is organised by reference, from knowledge entries through topics, learning modules, content packs, learning paths and handbooks. Higher levels contain stable IDs for lower-level objects instead of copying their text. Shared publishing fields and object-specific contracts live in `schemas/publishing-object.schema.json` and the topic, module, pack, path, handbook, chapter, case-study, checklist and document-guide schemas.

The first handbook is **Property Investor's Handbook / Gayrimenkul Yatırımcısının El Kitabı**. Its 40-chapter first-edition plan is stored in `content/handbooks/investor/handbook.json`; the first 20 structured, source-aware draft chapters are in `content/handbooks/investor/chapters.json`. Draft status is intentional until a qualified reviewer verifies the jurisdiction-sensitive material and replaces source placeholders with authoritative citations.

Run `npm run handbook:check` to execute schema, reference, duplicate, bilingual, calculator, knowledge-link and 100-pack-roadmap checks. The component checks are also available as `handbook:validate`, `handbook:references`, `handbook:duplicates`, `handbook:bilingual`, `handbook:calculators`, `handbook:knowledge` and `handbook:roadmap`. Publishing data is copied into the production build and the active handbook, checklist, case-study and document-guide files are pre-cached for offline use.

### Calculator workspace

- Finance, development and property filters
- Field validation, formulas, assumptions and worked examples
- Combined deal snapshot for leverage, cost, value, profit and return metrics
- Locally saved scenarios with reopen, duplicate and delete actions
- Copy and share summaries for calculations and deal snapshots

### Calculators included

- LTV
- LTC
- LTGDV
- ROI
- Rental Yield
- Development Profit
- Monthly Loan Payment
- Arrangement Fee
- Interest Roll-up
- Concrete Volume
- Paint Area
- Flooring Area
- Plasterboard Sheets
- Insulation Area
- Tiles Quantity

### Installation

Upload the repository contents to the existing GitHub repository and commit to main.
Vercel will redeploy automatically.
