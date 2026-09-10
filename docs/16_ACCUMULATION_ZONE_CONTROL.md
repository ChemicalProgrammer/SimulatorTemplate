# Mandatory physical conveyor geometry

## Model rule

Every conveyor is a physical accumulation zone. There is no abstract buffer, no `bufferAfterCapacity`, and no `accumulationZone` override.

A valid line alternates:

```text
Machine → Conveyor → Machine → Conveyor → Machine
```

The simulator derives the controlled upstream and downstream machines from this sequence.

## Required data on each conveyor

| Field | Simulation use |
|---|---|
| `usableLengthMm` | Physical accumulation length. |
| `productPitchMm`, or `productLengthMm` + `gapMm` | Capacity: `floor(length / pitch)`. |
| `conveyorSpeedMmPerSecond` | Product travel time and sensor timing. |
| `primeSensorPositionMm` | Starts the next machine after product reaches Prime. |
| `backupSensorPositionMm` | Requests the preceding machine to stop when accumulation reaches Back-up. |
| `backupRestartPositionMm` | Releases that stop after inventory clears. |
| `upstreamStopResponseSeconds` | Delay from Back-up request to upstream stop. |
| `bottlesDischargedAtStop` | Residual product discharged after the stop request. |
| `downstreamRampUpSeconds` | Ramp requested for the downstream machine after Prime. |

Positions are measured from upstream discharge toward downstream infeed. Back-up must be upstream of Prime; reset must be downstream of Back-up.

## What geometry changes

- Capacity changes with usable length and pitch.
- Product reaches Prime after `primeSensorPositionMm / conveyorSpeedMmPerSecond`.
- It reaches the downstream end after `usableLengthMm / conveyorSpeedMmPerSecond`.
- A stopped conveyor freezes product travel; it does not teleport material to the next machine when it restarts.
- Back-up uses real occupancy of the conveyor, not an arbitrary buffer number.

The line begins empty. A downstream machine remains `WAITING_FOR_PRIME` until its upstream conveyor sees product at Prime.

## Deliberately not inferred

`LACT`, `LP Prime`, `actualDischargeMm`, and `actualCodingMm` are preserved as format data but are not translated automatically to length or sensor positions. Their plant definition must be confirmed first.

## Calibration boundary

The public 13-unit demo contains complete synthetic geometry and controls so it can run immediately. Its values are not plant measurements or sensor-placement recommendations.

For a real Case, the engine refuses to run until every conveyor has complete physical geometry. This is intentional: an incomplete geometry must not silently become an abstract buffer.
