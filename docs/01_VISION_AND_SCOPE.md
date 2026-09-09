# Vision and scope

## Product statement

SimulatorTemplate is an engineering console for studying a packaging line as a connected system. A user builds a line, establishes a baseline state from measured or entered inputs, runs controlled virtual experiments, compares outcomes, and creates versioned reports.

## Primary user

One authenticated engineer per deployment. The design preserves per-user settings and workspace separation so it can later evolve to approved multi-user access without mixing data.

## Core workflows

1. Configure a **Case**: line sequence, equipment capabilities, transport constraints, product profile, and simulation settings.
2. Create a **State** from a form, imported data, or the terminal state of a preceding simulation.
3. Run a baseline simulation and inspect motion, queues, stops, capacities, and efficiency.
4. Create a **What-If scenario** that changes only explicit parameters.
5. Compare baseline and scenario under the same random seed and duration.
6. Request Gemini to explain deterministic findings, identify likely constraints, and draft an improvement proposal.
7. Save or export versioned artifacts in the appropriate Drive workspace.

## In scope for the first vertical slice

- A linear packaging line with buffer-aware equipment.
- Equipment units: source/blower, conveyor/buffer, pacemaker, palletizer, and a generic custom unit.
- Seeded noise, failures/stops, manual/automatic modes, pause/resume, and deterministic replay.
- A modest console UI with case list, editor, run panel, charts, and a raw/JSON/MD/HTML viewer.
- JSON and Markdown artifacts; PDF export through PDFService.
- Gemini explanations bounded by structured simulation evidence.

## Explicitly out of scope for MVP

- PLC/SCADA control, direct production-line actuation, and live plant connectivity.
- Gemini-generated calculations, unreviewed automation, or executable generated code.
- Collaborative editing, enterprise sharing, or a polished design system.
- High-fidelity mechanical/fluid dynamics; use calibrated discrete-event behavior first.
