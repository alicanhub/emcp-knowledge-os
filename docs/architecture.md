# Application architecture

EMCP Knowledge OS keeps browser compatibility while exposing explicit module boundaries through stable `window.EMCP*` APIs.

- `core.js`: bounded parsing, runtime schemas, sanitisation and resilient storage.
- `dom.js`: explicit UI element lookup; feature modules do not depend on browser-created ID globals.
- `knowledge.js`: validated data loading and ranked bilingual search.
- `calculator-model.js`: DOM-independent finance and construction mathematics.
- `calculators.js`: calculator UI, validation and scenario controller.
- `workspace.js`: personal collections, notes and import/export workflows.
- `assistant.js`: provider-neutral AI/retrieval boundary with sanitised output.
- `app.js`: navigation and composition only.
- `accessibility.js`, `i18n.js`, `pwa.js`: cross-cutting accessibility, language and lifecycle services.

The legacy global calculator and navigation functions remain available after initialisation for backward compatibility. New code should call the named `EMCP*` APIs.

## Quality gates

`npm run test:all` runs formatting, linting, type checks, JSON Schema validation, unit tests, complete regression tests, the production build, browser journeys, offline PWA verification and automated WCAG checks. The same command gates pull requests and `main` pushes in GitHub Actions.
