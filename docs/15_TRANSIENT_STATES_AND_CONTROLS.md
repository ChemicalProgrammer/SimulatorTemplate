# Transient states and controls

The engine now distinguishes a configured command mode from the effective material-flow state shown during playback.

| Effective state | Meaning | Actual rate |
|---|---|---:|
| `READY` | The source is enabled at the time-zero snapshot, before its first calculation tick. | Zero |
| `RUNNING` | The unit moved material during the tick. | Greater than zero |
| `STARVED` | No upstream material was available. | Zero |
| `BLOCKED` | The downstream buffer had no free capacity. | Zero |
| `MICRO_STOP` | A seeded short stop is active. | Zero |
| `FAILURE` | An MTBF/MTTR reliability failure is under repair. | Zero |
| `PAUSED` / `STOPPED` | A programmed control command has stopped the unit. | Zero |
| `EMERGENCY_STOP` | An emergency stop is latched. | Zero |

## Empty-line start

Buffers start empty by default. The result includes an explicit `t = 0` snapshot: the first enabled unit is `READY` with zero actual rate, while downstream enabled units are `STARVED`. After the first virtual tick, the source can become `RUNNING`; downstream units stay `STARVED` until material reaches their input buffer. The current fixed-timestep MVP transfers material one discrete handoff per tick.

This is deliberately not yet a physical conveyor-travel model. Conveyor geometry, container length/gap/pitch, and belt velocity do not yet define in-flight material, capacity, or transport delay. The displayed start-up delay is therefore a queue-propagation delay, not a calibrated travel time.

## Metrics on each live equipment card

During playback, each card shows:

- Produced or processed units.
- Actual rate in units per minute.
- Cumulative starved, blocked, failure, and emergency-stop time in minutes.

`STARVED` and `BLOCKED` are material-flow constraints, not equipment failures. A unit may keep a configured command mode of `AUTO` while its effective state is `STARVED` or `BLOCKED`.

The quantities on the cards are accumulations through the displayed virtual second, not arithmetic averages of the display samples. The Run Workspace separately shows an instantaneous line output rate for the last sample interval and a cumulative average rate (`total output ÷ elapsed virtual time`).

## Programmed and emergency stops

Run Workspace can schedule an event for one equipment unit at a selected virtual second. The same controls are available directly on each live equipment card; they apply at the currently displayed virtual second and recompute the deterministic scenario.

- Planned stop and pause can be released with `Run`.
- `Emergency stop` latches the unit in `EMERGENCY_STOP`.
- `Reset emergency stop` releases the safety latch into `STOPPED`; a separate `Run` command is required before it can operate again.

This is a scenario model only. It is not a safety PLC implementation and currently applies to one unit, not yet to a safety zone or the full line.
