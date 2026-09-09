# Real-format line model

## Purpose

This contract captures the actual initial format structure: thirteen ordered objects, alternating critical machines and conveyors.

Blowmolder → Conveyor → Pucker → Conveyor → Filler → Conveyor → De-pucker → Conveyor → Sleever → Conveyor → Case Packer → Conveyor → Palletizer

The template is stored in examples/format-line-13.template.json and its contract in schemas/format-line.schema.json.

## Two compatible layers

| Layer | Purpose |
|---|---|
| Existing simulation fields | nominalRatePerSecond, bufferAfterCapacity, initialMode, and noiseProfile drive the currently runnable deterministic engine. |
| processData | Preserves the real format, equipment, geometry, and transfer data needed to calibrate the next engine generation. |

This is deliberate. BPM is not silently treated as bottles per second, and a physical conveyor length is not silently treated as an abstract buffer. An explicit adapter will convert calibrated process data into a simulation-ready State.

## Critical-machine fields

For blowmolder, pucker, filler, de-pucker, sleever, case packer, and palletizer:

- mtbfMinutes
- mttrMinutes
- maximumSpeedBpm
- bufferMinutes

The prior reference model used the same four inputs. The current engine can use MTBF/MTTR through an explicit seeded reliability profile: failures follow an exponential time-to-failure model and MTTR is a fixed repair duration. This is reproducible but is not yet calibrated to a plant. Maximum speed and buffer minutes will be compared with, then eventually derived from, conveyor geometry.

## Geometry and transfers

Every object carries the known field names, all expressed in the stated units:

- Geometry in millimetres: lactMm, lpPrimeMm, actualDischargeMm, actualCodingMm.
- Upstream: packageLengthMm, dischargePitchMm, startupTimeSeconds, bottlesDischargedAtStop.
- Downstream: infeedPitchMm, rampUpTimeSeconds.
- Speed and sensors: conveyorSpeedFactorVsDischargeVelocityPercent, codingConveyorSpeedFactorVsPreviousConveyorPercent, and an empty additionalParameters array.

No physical interpretation is assigned to LACT or LP Prime yet. Their labels are preserved literally and their values remain null until their meaning and measurement basis are confirmed.

`packageLengthMm` and `dischargePitchMm` are preserved, but they are not yet used by the engine. There is no independent `gapMm` input in the current contract. A derived gap of `pitch − length` is only valid when both values use the same longitudinal datum and pitch is centre-to-centre; it must not be silently assumed for every machine interface. A geometry-aware model will additionally need the usable conveyor/accumulation length and the belt or discharge velocity to calculate physical capacity and transit time.

## Unknown information

The four remaining Speed & sensors fields are not represented as guessed names. They remain a documented known gap and additionalParameters is intentionally empty. Add them only after their exact names, units, and effect on the process are known.

Likewise, every unprovided numeric value in the template is null; it is not filled with a default.

## Migration sequence

1. Populate the thirteen-object format template from the source data.
2. Confirm the meaning and units of LACT, LP Prime, and the four remaining sensor fields.
3. Build a deterministic adapter from populated processData to a simulation State:
   - BPM → rate in units/second;
   - reliability inputs → seeded failure/recovery events;
   - geometry/pitch → physical conveyor capacity;
   - startup/ramp data → transient speed curves;
   - stop discharge → in-flight material on the transfer.
4. Calibrate the adapter against historical line behaviour before making optimization or CAPEX claims.

The current UI already preserves processData as editable JSON inside each equipment card. A dedicated form for these fields follows once the remaining terms are confirmed.
