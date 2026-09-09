# Run Workspace

## Purpose

The Run Workspace executes a saved Case through the deterministic JavaScript engine and plays the resulting samples in the browser. It makes a fast calculation visible as moving equipment data and a cumulative-output chart.

Apps Script is not in the calculation path. It continues to handle identity, Drive-backed Case persistence, and the web-app boundary only.

## Browser bundle

The browser does not use a separate or rewritten engine. Generate the Apps Script HTML fragment from the tested source modules with:

```bash
npm run build:browser-engine
```

This writes `apps-script/SimulationEngine.html`, which exposes `window.SimulatorEngine.simulateLine`. `test/BrowserEngineBundle.test.js` executes the generated fragment and verifies that it runs the reference Case.

Whenever a source file under `src/simulation/` changes, regenerate the bundle before `clasp push`.

## Run configuration

| Control | Behavior |
|---|---|
| Duration mode | Fixed virtual duration, or an indefinite run represented by an explicit virtual safety ceiling |
| Duration / safety ceiling | Required number of virtual seconds the engine may calculate |
| Display sample interval | Frequency of stored display samples; it does not change the deterministic engine tick. The default is 1 virtual second. |
| Random seed | Required integer that makes noise and events reproducible |
| Playback speed | Controls only how quickly already-calculated samples move on screen: at 1×, one virtual second takes one wall-clock second; 0.5× to 10× scale that duration. |
| Control events | Scheduled `RUN`, `PAUSE`, `STOP`, `MANUAL`, `AUTO`, `EMERGENCY_STOP`, and `RESET` commands for a selected equipment unit |

The initial engine tick remains one virtual second in this workspace. It can be made configurable after calibration establishes an appropriate resolution.

## Dynamic playback

1. The browser calculates the full virtual run immediately.
2. The result contains sampled equipment states, buffer levels, cumulative output, and events.
3. The playback layer advances through those samples on a timer, updating metric cards, the chart, and each equipment card. The timer uses the actual virtual-time difference between samples, so a coarse interval creates coarser visual steps but does not make 1× run faster.
4. Play, Pause, and Reset affect playback only; they never alter the deterministic result.

This approach lets a 5× or 10× visual simulation remain responsive without relying on long-running Apps Script requests.

## Noise and control safety

Equipment can include an optional `noiseProfile.microStop` object with:

```json
{
  "probabilityPerMinute": 0.5,
  "minDurationSeconds": 20,
  "maxDurationSeconds": 20
}
```

Noise and scheduled controls are validated as part of the simulation input. An unknown equipment ID, unsupported action, invalid duration, or malformed noise profile produces a structured error rather than being silently ignored.

Each live equipment card also exposes **Run / resume**, **Pause**, **Planned stop**, **Emergency stop**, and **Reset + run**. A card control adds its command at the currently displayed virtual second, then recomputes the deterministic scenario from its beginning with the same Case, seed, duration, and existing commands. This makes the propagation after an intervention inspectable without pretending that the web app is a real-time PLC connection.

## Current boundary

- Results are available in the in-console raw JSON viewer but are not yet saved as State/Run artifacts in Drive.
- “Indefinite” is currently bounded by the safety ceiling; true open-ended operation will use an incremental engine stepper.
- Card interventions recalculate the complete deterministic run; they do not incrementally execute a PLC-like engine or command real machinery.

The next step is persistence: save a completed run as a State/Run artifact, then compare a baseline with a What-If scenario under the same seed and duration.
