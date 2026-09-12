# Physical conveyor control and FlowPilot design audit

## Model rule

Every conveyor is a physical accumulation zone. There is no abstract buffer,
`bufferAfterCapacity`, or `accumulationZone` override in a new Case.

A valid section of line alternates:

```text
Machine → Conveyor → Machine → Conveyor → Machine
```

The simulator infers the controlled upstream and downstream machines from that
sequence. Geometry is always active: it is not a switch that can be disabled.

## Inputs entered for each conveyor

The editor uses the terms from the FlowPilot / CAT worksheet. All lengths are
in millimetres and all times are in seconds.

| Input | Role in the simulation |
|---|---|
| `L_act` (`geometry.lactMm`) | Installed conveyor length. |
| `L_p` (`geometry.lpPrimeMm`) | Reserved Prime/infeed length. Prime is derived as `L_act − L_p`. |
| Package length + upstream discharge pitch | Establish the product population and the derived pitch on the belt. |
| Conveyor speed factor | Converts upstream discharge velocity into belt speed. |
| Discharge/reject runout, blocked delay, residual bottles, insurance | Calculate the required overflow length `L_bu`. |
| Installed Back-up position | Is checked against `L_bu`; it is not silently replaced. |
| Clear delay and upstream response/start-up | Prevent immediate sensor chatter when the line starts again. |
| Downstream high speed, infeed pitch, ramp-up | Calculate downstream consumption and recovery margin. |

The Case stores the raw inputs. The engine derives belt speed, pitch, capacity,
Prime position, material travel, Back-up requirement, and accumulation time
from them on every run.

## Controls represented by the engine

Positions are measured from upstream discharge toward downstream infeed.

- **Prime photocell:** when the first product reaches `L_act − L_p`, the
  downstream machine may start and follows its configured ramp-up.
- **Back-up photocell:** when accumulated product reaches the installed
  Back-up position for `Blocked_Time_Delay`, the upstream machine receives a
  stop request.
- **Residual discharge:** the upstream machine may still discharge its declared
  residual bottles after the stop request.
- **Clear delay:** after product clears Back-up, the signal must remain clear
  for `Clear_Time_Delay` before the upstream stop request is released. This is
  why restart propagates through the line instead of being instantaneous.

The line begins empty. A downstream machine remains `WAITING_FOR_PRIME` (and
has zero effective speed) until its upstream conveyor has physically carried
product to Prime. A stopped conveyor freezes product travel; it never
teleports material to the next machine.

## Derived engineering quantities

The audit shown after a run includes these values for each conveyor:

| Quantity | Meaning |
|---|---|
| `L_bu` | Required overflow length: runout sections plus product emitted during blocked-delay, stop residual and insurance. |
| `L_ba` | Usable accumulation length: `L_act − L_p − L_bu`. |
| `L_rec` | Recovery margin after a Back-up release. Positive is a smooth-restart margin; zero or negative indicates stuttering risk. |
| Anti-starve / anti-block time | Physical accumulation time available to protect downstream / upstream equipment. |
| Capacity | `floor(L_act / derived product pitch)`, in equivalent packages. |
| Recommended infeed speed | Downstream high speed × infeed pitch with the worksheet's 5% margin. |

Four automatic goals are evaluated: usable inputs, smooth recovery (`L_rec >
0`), installed length (`L_act > L_p + L_bu`), and installed Back-up position
(`Back-up ≥ L_bu`). A warning is a design question, not an automatic plant
recommendation.

## Calibration boundary

The public 13-unit demo contains complete **synthetic** FlowPilot inputs so it
can run immediately. Its results demonstrate the model; they are not plant
measurements, a sensor-placement prescription, or a CAPEX recommendation.

For a real Case, validate the result against observed starts, stops, sensor
timing and measured belt speed before using a What-If result to choose a
physical modification.
