# Reference engine

## Purpose

This is the first executable slice of SimulatorTemplate. It is intentionally a pure browser-compatible JavaScript module with no Apps Script, Drive, UI, Gemini, logging, or global business state dependency.

It proves the core simulation contract before the web app persists or displays it.

## Files

| Path | Responsibility |
|---|---|
| `schemas/case.schema.json` | Initial JSON Schema for a Case |
| `examples/reference-line.case.json` | Five-unit reference packaging line |
| `src/simulation/SimulationValidation.js` | Structured input validation |
| `src/simulation/SeededRandom.js` | Repeatable pseudo-random generator |
| `src/simulation/LineSimulationEngine.js` | Pure line engine |
| `test/LineSimulationEngine.test.js` | Contract tests |

## Run locally

The reference uses Node's built-in test runner; no package installation is needed.

```bash
node --test
```

## Input contract

```json
{
  "case": { "...": "valid Case JSON" },
  "run": {
    "durationSeconds": 120,
    "tickSeconds": 1,
    "sampleEverySeconds": 5,
    "seed": 20260909,
    "commands": [
      { "atVirtualSecond": 20, "equipmentId": "pacemaker-1", "action": "PAUSE" },
      { "atVirtualSecond": 40, "equipmentId": "pacemaker-1", "action": "RUN" }
    ]
  }
}
```

The engine returns either a structured error (`ok: false`) or a result (`ok: true`) containing run provenance, summary metrics, per-equipment metrics, events, and chart samples.

## Current behavior

- Processes equipment from downstream to upstream each virtual tick, so downstream space can become available during the same tick.
- Uses explicit inter-equipment buffers (`bufferAfterCapacity`) to model accumulation.
- Supports `AUTO`, `MANUAL`, `PAUSE`, and `STOP` modes, plus scheduled `RUN`, `PAUSE`, `STOP`, `MANUAL`, and `AUTO` commands.
- Uses a seeded micro-stop profile; the same input and seed yield identical samples, events, and summaries.
- Reports output, output rate, blocked/starved time, availability, and equipment counters.

## Deliberate limitations

This is not yet a calibrated plant model. It does not model recipe changes, units-of-pack conversion, individual bottle positions, ramp-up curves, pallet patterns, downstream warehouse logic, or continuous physical dynamics. These should be introduced only with measurable requirements and historical calibration data.

## Next implementation boundary

Wrap this engine in an Apps Script project without moving calculation logic into `.gs` files. The client will import the engine for visual playback; Apps Script will validate/persist JSON, authorize Drive access, and save results. Gemini will receive only completed structured results.
