# SimulatorTemplate

Base architecture for a secure, single-user **Apps Script + Gemini** web application that models and improves packaging lines.

The first supported line is a configurable sequence such as:

`Blower → Conveyor → Pacemaker → Conveyor → Palletizer`

The product goal is not a generic AI chat. It is a deterministic dynamic simulator that lets an engineer define equipment, run repeatable scenarios, observe line behavior in virtual time, compare states, and use Gemini to explain results and propose improvements.

## MVP principles

- **Deterministic calculations:** the simulation engine owns all calculations; Gemini never invents process results.
- **Virtual time:** simulation can run much faster than wall-clock time while charts animate in the browser.
- **Drive as the storage boundary:** shared knowledge/templates live in a fixed Drive folder; each user selects a private workspace folder.
- **Least privilege:** server-side authorization and ownership checks apply to every Drive resource and every case.
- **Incremental data:** indexes and derived metrics update only for changed objects; no recurring full Drive scans.
- **Artifacts are versioned:** reports and exports create new versions rather than silently overwriting prior work.

## Documentation map

| Document | Purpose |
|---|---|
| [Vision and scope](docs/01_VISION_AND_SCOPE.md) | Product intent, roles, and MVP boundaries |
| [Architecture](docs/02_ARCHITECTURE.md) | Apps Script, client, Drive, Gemini, and optional Python responsibilities |
| [Domain model](docs/03_DOMAIN_MODEL.md) | Console, Case, State, EquipmentUnit, Engine, and artifacts |
| [Simulation design](docs/04_SIMULATION_DESIGN.md) | Dynamic discrete-event model, noise, controls, metrics, and playback |
| [Security and data](docs/05_SECURITY_AND_DATA.md) | Authentication, authorization, data separation, and Gemini safety |
| [Initial roadmap](docs/06_INITIAL_ROADMAP.md) | Staged implementation plan |
| [Open decisions](docs/07_OPEN_DECISIONS.md) | Decisions to validate before code implementation |
| [Reference engine](docs/08_REFERENCE_ENGINE.md) | Runnable deterministic MVP and JSON contracts |

## Initial technical decision

The MVP does **not** require Python. Use a deterministic discrete-event / fixed-timestep engine in browser JavaScript for live playback, with Apps Script for persistence, validation, export, and Gemini orchestration. This avoids Apps Script execution-time and request/response limitations during a live simulation.

Introduce a separate Python service only when validated requirements need high-fidelity physics, optimization at scale, Monte Carlo batches beyond Apps Script limits, or scientifically calibrated models. It must remain an optional, isolated compute adapter—not the source of truth for cases or security.

## Status

The first runnable reference engine is now included. From the repository root, run `node --test` to validate its deterministic behavior without installing dependencies.
