# Simulation design

## Recommended model

Start with a **hybrid discrete-event and fixed-timestep model**:

- Events model state changes: product arrival, unit start/stop, fault, repair, buffer full/empty, mode change.
- A small virtual tick updates in-flight quantities, counters, and charts.
- The playback layer renders samples at a stable wall-clock cadence (for example 4–10 frames/second), independent of virtual speed.

This is more appropriate than recording every real second. It can represent asynchronous equipment behavior while staying understandable and fast.

## Virtual time and controls

A run declares `durationMode` (`FIXED` or `INDEFINITE`), `targetVirtualSeconds` when fixed, and a playback multiplier (0.5×, 1×, 1.5×, 2×, 5×, 10×...). The engine may calculate much faster than display, but must retain enough samples for useful animated graphs.

For an indefinite run, continue until the user stops it or a safety ceiling is reached. The client stores periodic checkpoints; the server persists explicit snapshots only, not every animation frame.

Each unit exposes requested control state: `RUN`, `PAUSE`, `STOP`, `MANUAL`, `AUTO`. The engine validates allowed transitions and propagates blocking/starving effects through conveyors/buffers.

## Noise and realism

Noise must be parameterized and seeded, never arbitrary:

- Throughput variation: bounded normal or triangular variation.
- Micro-stops: probability, duration distribution, recovery time.
- Major stops: MTBF/MTTR or event-rate model.
- Quality loss/rejects: independent or rate-correlated model.
- Conveyor behavior: capacity, accumulation, release rate, transfer delay.
- Sensor/control latency: optional delay and hysteresis.

Use one run seed for repeatability. Compare a What-If scenario against the baseline with the same seed, duration, demand profile, and initial conditions; use multiple seeds only for sensitivity analysis.

## Outputs

At each sampled virtual time: unit state, throughput, buffer fill %, starved/blocked time, cumulative counts, rejects, and active fault cause.

Derived results: line capacity, OEE-like availability/performance/quality components, utilization, bottleneck ranking, losses, queue statistics, and confidence range when multiple seeds are used.

## Guardrails

The simulator should label results as model-based estimates. Calibration against historical line data is required before results are used to justify production changes or CAPEX.
