# Baseline and What-If experiments

The Run Workspace has two different kinds of evidence. They should not be
interpreted as the same result.

| Evidence | Source | Varies by seed/run duration? |
| --- | --- | --- |
| Conveyor design audit | Geometry, rates, sensor positions, delays, runout and insurance margin | No |
| Dynamic run metrics | Time-stepped material flow, controls, failures and micro-stops | Yes |

The audit is a deterministic design check. It is recalculated when conveyor
inputs are resolved; it is not an average of the simulation samples. A `PASS`
means the known worksheet rules did not find a violation. It does not prove
that the conveyor is globally optimal or that a PLC design has been validated.

## Workflow

1. Save the Case and select a virtual duration, command schedule and starting
   random seed.
2. Set **Replications / seeds**. The browser accepts 1–20 sequential integer
   seeds; five is a useful initial screening count.
3. Select **Set baseline**. The browser takes a snapshot of the Case and runs
   a compact simulation for every selected seed.
4. Change one or more conveyor parameters in the Case. Saving is optional for
   the comparison: unsaved edits are an in-browser What-If and do not overwrite
   the baseline Case.
5. Select **Compare current**. The candidate uses the *same seed set* as the
   baseline, even if the seed input has since changed.

Both cases must use the same virtual duration and integration step. The
candidate may intentionally use a different scheduled control event; that is
part of the scenario change.

The baseline is held in the current browser session only. Reloading the web
app, opening another Case, or choosing **Clear** removes it. An unsaved
candidate is also session-only; use **Reload Case** to discard it. Persistent
State artifacts can be added after the comparison workflow has been validated.

## Why the same seed set matters

MTBF/MTTR failures and micro-stops are seeded. Comparing seed 17 in the
baseline with seed 17 in the candidate produces a paired delta:

```
delta = candidate metric − baseline metric
```

This prevents a different random realization from being mistaken for a design
improvement. The cards show a mean and P10–P90 range, plus the worst observed
overflow. The conveyor table shows the mean paired delta across the common
seed set.

For `Output` and `Rate`, positive delta is normally favorable. For `Starved`,
`Blocked` and `Overflow`, negative delta is normally favorable. Target
overflow is zero; a favorable average cannot justify a non-zero worst case.

## Compact results

The interactive single run retains time samples for playback and charts. A
batch experiment does not retain those trajectories. It keeps only compact
per-seed summaries:

- line output/rate and total time losses;
- equipment output, availability and losses;
- conveyor average/max inventory, empty time, overflow, Back-up cycles and
  Back-up occupied time;
- static design audit and derived values for each conveyor.

This avoids multiplying a raw animation JSON by the number of seeds. Use the
single-run replay to investigate a particular seed that looks unusual.

## Interpreting a conveyor that already passes

Use `PASS` as a feasibility gate, then optimize explicit objectives and
constraints. Examples:

| Candidate change | Dynamic evidence to inspect | Static guardrail |
| --- | --- | --- |
| Belt speed factor | Output, average/max inventory, starvation/blocking | Recommended speed, population and sensor timing |
| Back-up position | Back-up cycle count, overflow, upstream blocking | Required overflow `L_bu` and `BACKUP_POSITION` |
| Prime reserve/position | Waiting Prime and recovery behavior | Positive `L_rec` |
| Installed length | Max inventory, overflow and recovery | `INSTALLED_LENGTH`, anti-starve and anti-block |
| Blocked/clear delays | Back-up cycles and restart stability | `SENSOR_DEBOUNCE` |

Do not optimize all objectives into one number yet. First agree on constraints
such as `Overflow = 0`, an acceptable recovery margin, a maximum conveyor
speed, and a target output. Then compare controlled What-If changes. An
automatic search is appropriate only after those engineering limits are known.
