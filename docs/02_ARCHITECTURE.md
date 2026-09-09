# Architecture

## Runtime split

| Layer | Responsibility | Technology |
|---|---|---|
| Browser client | UI, editor, viewer, playback, charts, deterministic live simulation | HTML, CSS, browser JavaScript |
| Apps Script web app | authenticated entry point, APIs, validation, persistence, export orchestration | Apps Script HTML Service / server `.gs` modules |
| Drive | fixed shared sources/templates and user-selected workspace folders | Drive API / Advanced Drive Service |
| Sheets index | case catalog, metadata indexes, audit-safe lookup tables | Google Sheets |
| Gemini adapter | retrieval, explanation, proposal drafting, structured responses | `AIManager` + `GeminiService` |
| Optional compute adapter | later only: large batches, calibration, advanced optimization | Python service behind a narrow API |

## Why the engine starts in browser JavaScript

Apps Script is excellent at authentication, Drive access, persistence, and reports. It is not suitable for a long-lived responsive loop: it has execution quotas, request latency, and no streaming/WebSocket model. The client runs virtual time locally and sends compact checkpoints/results to Apps Script.

The engine must be a pure module: given the same model, initial state, seed, duration, and step policy, it returns the same output. That makes comparisons credible and testable.

## Server modules

- `Main.gs`: web app entry points and route handlers.
- `AuthService.gs`: identity, deployment allowlist, authorization helpers.
- `ConfigService.gs`: validated user settings and global fixed-folder settings.
- `DriveService.gs`: folder/resource ownership checks and artifact persistence.
- `CaseService.gs`: case/state CRUD and revisioning.
- `SimulationService.gs`: schema validation, launch/checkpoint/result APIs.
- `MetricsService.gs`: deterministic KPI computation and comparison.
- `PDFService.gs`: safe HTML/Markdown-to-PDF export workflow.
- `AIManager.gs`: provider-neutral AI boundary and allowed capability policy.
- `GeminiService.gs`: Gemini implementation, retrieval, and response validation.
- `AuditService.gs`: minimal event trail without storing secrets.
- `Utils.gs`: IDs, schema/version helpers, serialization.

## Client modules

- `AppShell.js`, `CaseList.js`, `CaseEditor.js`, `StateWorkspace.js`
- `SimulationEngine.js`, `SimulationPlayback.js`, `Charts.js`
- `Viewer.js`, `ExportPanel.js`, `ApiClient.js`

No client module receives a Gemini credential or bypasses a server-side authorization check.
