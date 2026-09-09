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
| Sample interval | Frequency of stored display samples; it does not change the deterministic engine tick |
| Random seed | Required integer that makes noise and events reproducible |
| Playback speed | Controls only how quickly already-calculated samples move on screen: 0.5× to 10× |
| Control events | Scheduled `RUN`, `PAUSE`, `STOP`, `MANUAL`, and `AUTO` commands for a selected equipment unit |

The initial engine tick remains one virtual second in this workspace. It can be made configurable after calibration establishes an appropriate resolution.

## Dynamic playback

1. The browser calculates the full virtual run immediately.
2. The result contains sampled equipment states, buffer levels, cumulative output, and events.
3. The playback layer advances through those samples on a timer, updating metric cards, the chart, and each equipment card.
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

## Current boundary

- Results are available in the in-console raw JSON viewer but are not yet saved as State/Run artifacts in Drive.
- “Indefinite” is currently bounded by the safety ceiling; true open-ended operation will use an incremental engine stepper.
- Control events are scheduled before the calculation. Live intervention during playback is intentionally deferred until the engine supports stepwise recomputation.

The next step is persistence: save a completed run as a State/Run artifact, then compare a baseline with a What-If scenario under the same seed and duration.
