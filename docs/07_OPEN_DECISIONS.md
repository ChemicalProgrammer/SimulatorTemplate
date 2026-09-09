# Open decisions

These do not block documentation, but should be resolved before implementation where noted.

| Decision | Recommended initial choice | Why |
|---|---|---|
| Identity | Apps Script active Google user + deployment allowlist | Uses established Google authentication; avoids passwords |
| API key ownership | Organization-managed server configuration; user-level key only when policy permits | Keeps secrets outside browser and Drive |
| User storage | One selected workspace root with app-managed subfolders | Clear separation and recoverable artifacts |
| Shared library | One fixed read-only folder defined in global config | Prevents sources/templates being mixed with user work |
| Engine location | Browser JavaScript, pure deterministic module | Smooth animation and no Apps Script long-run limitation |
| Simulation paradigm | Hybrid discrete-event + small virtual ticks | Models stops/buffers correctly without needless per-second cost |
| Initial metrics | throughput, buffer behavior, blocked/starved time, availability/performance/quality, losses | Directly useful for packaging-line diagnosis |
| Scenario fairness | same initial conditions, duration, demand and seed | Makes comparisons defensible |
| Python | Deferred optional adapter | Not required until scale/fidelity evidence justifies it |
| Gemini role | explain, retrieve approved knowledge, propose structured options | Preserves deterministic calculation and safety |
| UI | modest single-page console with case list/editor/run/viewer | Prioritize usable workflow over visual polish |

## Questions to settle during Phase 0

1. Which Google identity/deployment model is approved by the organization: domain-only, specific allowlist, or owner-only?
2. Where will the fixed shared Drive library reside, and who can update it?
3. What unit of flow is primary for the first line: bottles, cases, pallets, or a configurable product unit?
4. Which historical datasets exist for calibration (rates, downtime, reject rate, buffer levels)?
5. Which initial equipment types and parameters are mandatory beyond blower, pacemaker, conveyors, and palletizer?
6. What report template / PDF visual standard should be used once the core workflow works?
