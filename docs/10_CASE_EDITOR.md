# Case Editor

## Purpose

The Case Editor turns a user-defined packaging line into a versioned JSON Case. It captures configuration only; it does not calculate process behavior, call Gemini, or control a production line.

## Editor workflow

1. Create a draft by providing only a Case title.
2. Open the draft from the Case list.
3. Add equipment units in actual material-flow order.
4. Set each unit's ID, type, name, nominal rate, downstream buffer capacity, initial control mode, and optional characteristics JSON.
5. Move units up or down to change the line order.
6. Save the Case. The server validates the JSON and increments its revision.

The reference Case remains available only as an explicit sample. It is not silently inserted into a user's workspace.

## Draft versus simulation-ready Case

A draft needs only a title. This lets an engineer establish a study before all line data are known.

The simulation engine has a stricter contract: it requires at least two valid equipment units, each with a unique ID, supported type, non-empty name, positive nominal rate, non-negative buffer capacity, and a valid initial mode. The Run workspace will enforce that stricter boundary.

## Equipment contract

| Field | Rule |
|---|---|
| `id` | Unique letters, numbers, and hyphens |
| `type` | `BLOWER`, `CONVEYOR`, `PACEMAKER`, `PALLETIZER`, or `CUSTOM` |
| `name` | Required display name |
| `nominalRatePerSecond` | Positive finite number |
| `bufferAfterCapacity` | Zero or positive finite number |
| `initialMode` | `AUTO`, `MANUAL`, `PAUSE`, or `STOP` |
| `characteristics` | Optional JSON object; intended for custom or detailed equipment data |
| `noiseProfile` | Optional JSON object reserved for the simulator's generated disturbance model |

`CUSTOM` is the editor's **Other / custom** option. It does not bypass validation; it allows an explicit, editable set of characteristics while retaining the standard control and flow fields.

## Revision safety

Every Case stores a numeric `revision`. Saving sends `expectedRevision`; the server rejects a stale write with `CASE_CONFLICT` rather than overwriting a more recent change. Reload the Case to resolve the conflict.

## Persistence

Cases are text JSON files inside the current user's managed `SimulatorTemplate Cases` folder. The server checks the active user's ownership before reading or saving the file. The UI never receives Drive permissions or direct file handles.

## Automated coverage

`test/CaseEditorContract.test.js` checks three key contracts:

- title-only draft creation;
- equipment sequence save and revision increment;
- stale revision rejection.
