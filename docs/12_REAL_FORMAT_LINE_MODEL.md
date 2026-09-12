# Real-format line model

## Purpose

This contract captures the actual initial format structure: thirteen ordered objects, alternating critical machines and conveyors.

Blowmolder → Conveyor → Pucker → Conveyor → Filler → Conveyor → De-pucker → Conveyor → Sleever → Conveyor → Case Packer → Conveyor → Palletizer

The template is stored in examples/format-line-13.template.json and its contract in schemas/format-line.schema.json.

## Two model layers

| Layer | Purpose |
|---|---|
| Simulation fields | nominalRatePerSecond, initialMode, and noiseProfile drive the deterministic equipment model. |
| `processData` | Holds the format, machine, FlowPilot geometry and transfer inputs used to derive each physical conveyor zone. |

This keeps BPM separate from equivalent-bottle flow while making conveyor
geometry active by default. The adapter converts the declared FlowPilot inputs
to a simulation-ready physical zone; it does not turn length into an abstract
buffer.

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

The current adapter applies the worksheet interpretation confirmed for this
project: `L_act` is installed conveyor length and `L_p` is the Prime/infeed
reserve. With upstream discharge pitch, package length and conveyor speed
factor, it derives pitch, population, belt speed, Prime position, physical
capacity and travel time. It also uses runout, sensor delays, residual bottles,
insurance and Back-up position to audit overflow and recovery.

There is no independent manual `gapMm` input. The model derives gap only from
the worksheet's population calculation; it is exposed as a result, not assumed
as an unrelated plant measurement.

## Unknown information

The four remaining Speed & sensors fields are not represented as guessed names. They remain a documented known gap and additionalParameters is intentionally empty. Add them only after their exact names, units, and effect on the process are known.

Likewise, every unprovided numeric value in the template is null; it is not filled with a default.

## Migration sequence

1. Populate the thirteen-object format template from the source data.
2. Verify `L_act`, `L_p`, pitch, sensor position and timing against the actual line.
3. Calibrate the deterministic adapter against observed starts, stops and recovery:
   - BPM → equivalent-bottle rate;
   - reliability inputs → seeded failure/recovery events;
   - geometry/pitch → physical conveyor capacity and transit;
   - startup/ramp data → transient speed curves;
   - stop discharge → in-flight material on the transfer.
4. Compare same-seed What-If cases before making optimization or CAPEX claims.

The Case Editor exposes the FlowPilot conveyor inputs directly and preserves
the remaining process data as editable JSON for fields whose engineering effect
has not yet been defined.
