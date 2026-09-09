# Initial roadmap

## Phase 0 — Foundation

- Create Apps Script/clasp project skeleton and deployment configuration.
- Add schema versions, ID conventions, Drive folder bootstrap, user settings, and server authorization guards.
- Commit a small reference Case JSON and validation tests.

**Exit criterion:** authenticated user can create/read one empty Case only inside their workspace.

## Phase 1 — Deterministic line MVP

- Implement the pure browser simulation engine for a five-unit linear reference line.
- Support buffers, nominal rates, seeded noise, micro-stops, and basic blocked/starved propagation.
- Render live unit status, queue levels, throughput trend, and completion summary.

**Exit criterion:** equal inputs and seed reproduce equal results; a longer conveyor/buffer What-If causes an explainable metric change.

## Phase 2 — States and comparison

- Create State snapshots, run history, Scenario patches, and baseline/comparison views.
- Calculate capacity, losses, utilization, and OEE-style metrics in deterministic code.
- Persist compact results and versioned JSON/Markdown artifacts.

**Exit criterion:** user can compare baseline and one scenario without overwriting either.

## Phase 3 — Viewer and export

- Add raw, JSON, Markdown, and sanitized HTML tabs in a resizable viewer.
- Export the active applicable representation; generate PDF through PDFService.
- Save exports as versioned Drive artifacts with provenance.

## Phase 4 — Gemini assistant

- Implement AIManager/GeminiService with structured tool contracts.
- Give Gemini evidence packages, approved source retrieval, and no direct mutation capability.
- Produce explanations, optimization suggestions, and CAPEX classifications for review.

## Phase 5 — Calibration and advanced simulation

- Import historical data, fit/validate parameters, add multiple-seed sensitivity analysis.
- Evaluate the need for an optional Python compute adapter only after measured workload or fidelity limits appear.
