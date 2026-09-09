# Accumulation-zone control

## Purpose

This module makes a conveyor interface visible as a bounded accumulation zone rather than an abstract buffer. It models the control behaviour shown in the **Prime / Back-up photocell** reference:

- **Prime sensor:** requests the controlled downstream machine to start when the leading product reaches the configured sensor position.
- **Back-up sensor:** requests a controlled stop of the selected upstream machine when accumulated product reaches the high-level threshold.
- **Back-up reset position:** releases the upstream stop only after enough inventory has cleared, preventing rapid start/stop chatter.
- **Residual discharge:** product still discharged during the configured upstream stop response is tracked. If the physical zone cannot hold it, the result records an `OVERFLOW` loss event.

This is a deterministic scenario model. It does not command PLCs, safety systems, or real equipment.

## Coordinate convention

For every `accumulationZone`, positions are measured in millimetres from the **upstream discharge** toward the **downstream infeed**.

```json
{
  "usableLengthMm": 24000,
  "productPitchMm": 92,
  "conveyorSpeedMmPerSecond": 795,
  "primeSensorPositionMm": 21500,
  "backupSensorPositionMm": 8000,
  "backupRestartPositionMm": 11000
}
```

The Back-up sensor is upstream of Prime. Its upstream free distance reserves room for response delay and bottles discharged after the stop request.

## Calculations

For a physical zone:

- Physical capacity: `floor(usableLengthMm / productPitchMm)`
- Leading-product travel to Prime: `primeSensorPositionMm / conveyorSpeedMmPerSecond`
- Full conveyor travel: `usableLengthMm / conveyorSpeedMmPerSecond`
- Back-up trigger: downstream waiting inventory reaches the portion from the Back-up sensor to the downstream end.
- Back-up clear: waiting inventory falls below the shorter portion from the reset position to the downstream end.

The engine separates:

- **In transit:** product moving toward the downstream infeed.
- **Waiting:** product already at the downstream end because the next machine cannot consume it.
- **Overflow:** residual product that exceeds physical capacity after a Back-up stop request.

The model uses one-second calculation ticks. Therefore it is a control-oriented approximation, not an individual-bottle PLC or collision model.

## Controlled recovery after a Back-up clear

A Back-up clear does **not** make all upstream equipment instantly run at nominal rate.

1. The downstream machine must first consume enough material for the Back-up reset position to clear.
2. The affected upstream machine then receives a start request.
3. It applies its configured start delay and speed ramp.
4. As each accumulation zone drains and its own sensor clears, the preceding machine receives its own start request.

By default, the controlled machine uses:

- `processData.upstream.startupTimeSeconds` as its start/restart delay.
- `processData.downstream.rampUpTimeSeconds` as its speed-ramp duration.

A Case may override these with equipment-level `startupDelaySeconds` / `restartRampUpSeconds`, or with zone-level `upstreamRestartDelaySeconds` / `upstreamRestartRampUpSeconds` for a particular Back-up interface.

The new live state `STARTING` means the delay is running at zero effective speed; `RAMPING_UP` means the machine is accelerating. This models a controlled recovery cascade, but it is still a deterministic approximation—not a PLC logic replica.

## Equipment and zone states

A live equipment card can now show:

- `WAITING_FOR_PRIME`
- `STARTING`
- `RAMPING_UP`
- `RUNNING`
- `STARVED`
- `BLOCKED`
- `BACKUP_STOPPING`
- `BACKUP_STOP`
- `FAILURE`, `MICRO_STOP`, `PAUSED`, and `EMERGENCY_STOP`

Every physical zone on the card that owns it shows inventory/capacity, in-transit units, Prime, Back-up, and overflow loss. The machine selected by `upstreamControlEquipmentId` shows its accumulated Back-up control time.

## Rolling speed traces

Every live equipment card includes a small rolling chart of its **actual** rate over the last 60 virtual seconds. The consolidated chart above the cards overlays the actual rates of every equipment unit, with a colour legend.

The X-axis moves with the current virtual time; 1× affects playback only, not the calculated rate. A zero in either chart can mean a commanded stop, failure, starvation, Back-up control, start delay, or ramp phase; use the state chip and the accumulated time metrics on the same card to identify the cause.

## Public demonstration Case

The 13-unit public Case configures its six conveyor objects as physical zones. Their length, pitch, speed, sensor positions, response time, and restart threshold are **synthetic demonstration values**. They are deliberately visible in the Case JSON and must not be treated as plant measurements or sensor-placement recommendations.

The Case starts empty. At 1×, downstream equipment waits for product to reach successive Prime sensors; the demo first produces final output only after the virtual product path has propagated through the conveyor zones.

## Calibration boundary

Before using the model for an engineering decision, confirm at least:

1. Coordinate reference for each sensor position.
2. Usable accumulation length, excluding reject/inspection/non-accumulating sections.
3. Product pitch or verified product length plus gap.
4. Conveyor velocity during normal operation and at speed changes.
5. Sensor debounce/filter and restart logic.
6. Actual upstream stop response and bottles discharged after a stop.
7. Whether a sensor controls a single machine, a conveyor, or a linked zone.

`LACT`, `LP Prime`, and unnamed Speed & sensors fields remain unassigned until their plant definitions are confirmed.
