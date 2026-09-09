# Domain model

## Entity relationship

```text
Console
 ├─ UserSettings
 ├─ FixedKnowledgeLibrary
 └─ Case*
      ├─ EquipmentUnit*
      ├─ EngineConfiguration
      ├─ State*
      │   ├─ InitialDataset
      │   ├─ SimulationRun*
      │   ├─ MetricsSnapshot*
      │   ├─ WhatIfScenario*
      │   ├─ OptimizationSuggestion*
      │   └─ Artifact*
      └─ CaseAuditEvent*
```

## Case

A versioned study container. It holds an ordered list of equipment, a product/line context, engine defaults, and states. It is the authorization boundary for all user-owned artifacts.

Minimum fields: `id`, `schemaVersion`, `name`, `ownerUserId`, `workspaceFolderId`, `equipmentOrder`, `equipmentById`, `engineConfig`, `stateIds`, `createdAt`, `updatedAt`.

## EquipmentUnit

A typed unit with shared lifecycle and extensible characteristics.

Shared fields: `id`, `type`, `name`, `sequence`, `enabled`, `mode`, `inputRate`, `nominalRate`, `availability`, `qualityRate`, `bufferCapacity`, `controlPolicy`, `noiseProfile`, `stopProfile`.

Types initially include `BLOWER`, `CONVEYOR`, `PACEMAKER`, `PALLETIZER`, and `CUSTOM`. Type-specific parameters live in a validated `characteristics` object; custom fields are namespaced and explicitly declared.

## State

An immutable, named snapshot of a Case configuration plus starting data. A new revision is created instead of mutating a completed state.

A State may start from: (a) form/manual entry, (b) imported validated dataset, or (c) a prior run checkpoint/final snapshot.

## WhatIfScenario

A small, auditable patch over exactly one base State. It records every changed parameter, rationale, planned investment class, and comparison rules. It never silently changes the baseline.

## Artifact

A Drive-backed, versioned result: raw JSON, Markdown report, HTML view, PDF, or approved template output. Artifacts retain their parent State/Run IDs and provenance.
