import { simulateLine } from './LineSimulationEngine.js';

/**
 * Runs a compact, repeatable group of simulations for one scenario.  The
 * detailed sample trajectory is intentionally discarded after every
 * replication: it is useful for playback, but not for a statistical
 * comparison and would make an experiment result unnecessarily large.
 */
export function runScenarioExperiment(input = {}) {
  const seeds = normalizeSeeds(input.seeds);
  if (!seeds.ok) return seeds;
  if (!input.case || typeof input.case !== 'object') return invalidExperiment('case is required.');
  if (!input.run || typeof input.run !== 'object') return invalidExperiment('run is required.');

  const replications = [];
  for (const seed of seeds.values) {
    const response = simulateLine({
      case: cloneExperimentCase(input.case),
      run: {
        ...input.run,
        seed,
        // The comparison never plays these paths. Keep only initial/final
        // samples while the engine still computes the full deterministic run.
        sampleEverySeconds: input.run.durationSeconds
      }
    });
    if (!response.ok) {
      return {
        ok: false,
        error: {
          ...response.error,
          code: 'EXPERIMENT_RUN_FAILED',
          message: `Seed ${seed}: ${response.error.message}`,
          seed
        }
      };
    }
    replications.push(summarizeReplication(response.result));
  }

  return {
    ok: true,
    scenario: {
      seedSet: seeds.values,
      replicationCount: replications.length,
      replications,
      summary: aggregateScenario(replications)
    }
  };
}

/**
 * Calculates paired candidate-minus-baseline deltas. Pairing by the same
 * seed is deliberate: both scenarios see the same random realization.
 */
export function compareScenarioExperiments(baseline, candidate) {
  if (!baseline || !candidate) return invalidComparison('Both baseline and candidate scenarios are required.');
  const baselineBySeed = new Map((baseline.replications || []).map((item) => [item.seed, item]));
  const candidateBySeed = new Map((candidate.replications || []).map((item) => [item.seed, item]));
  const seeds = (baseline.seedSet || []).filter((seed) => candidateBySeed.has(seed));

  if (!seeds.length || seeds.length !== (baseline.seedSet || []).length || seeds.length !== (candidate.seedSet || []).length) {
    return invalidComparison('Baseline and candidate must use the identical seed set.');
  }

  const paired = seeds.map((seed) => createPairedReplication(baselineBySeed.get(seed), candidateBySeed.get(seed)));
  return {
    ok: true,
    comparison: {
      seedSet: seeds,
      replicationCount: paired.length,
      summary: aggregateComparison(paired)
    }
  };
}

function normalizeSeeds(value) {
  if (!Array.isArray(value) || !value.length) return invalidExperiment('At least one integer seed is required.');
  if (value.length > 20) return invalidExperiment('At most 20 seeds can be compared in one browser experiment.');
  if (!value.every((seed) => Number.isInteger(seed))) return invalidExperiment('Every experiment seed must be an integer.');
  if (new Set(value).size !== value.length) return invalidExperiment('Experiment seeds must be unique.');
  return { ok: true, values: [...value] };
}

function invalidExperiment(message) {
  return { ok: false, error: { code: 'INVALID_EXPERIMENT_INPUT', message } };
}

function invalidComparison(message) {
  return { ok: false, error: { code: 'INVALID_EXPERIMENT_COMPARISON', message } };
}

function cloneExperimentCase(value) {
  return JSON.parse(JSON.stringify(value));
}

function summarizeReplication(result) {
  const summary = result.summary || {};
  return {
    seed: result.seed,
    line: {
      outputCount: numberOrZero(summary.outputCount),
      averageOutputRatePerMinute: numberOrZero(summary.averageOutputRatePerSecond) * 60,
      starvedMinutes: secondsToMinutes(summary.totalStarvedSeconds),
      blockedMinutes: secondsToMinutes(summary.totalBlockedSeconds),
      failureMinutes: secondsToMinutes(summary.totalFailureSeconds),
      emergencyStopMinutes: secondsToMinutes(summary.totalEmergencyStopSeconds),
      backupStopMinutes: secondsToMinutes(summary.totalBackupStopSeconds),
      overflowUnits: numberOrZero(summary.totalOverflowUnits)
    },
    equipment: Object.fromEntries(Object.entries(result.equipmentMetrics || {}).map(([id, metrics]) => [id, {
      outputCount: numberOrZero(metrics.outputCount),
      starvedMinutes: secondsToMinutes(metrics.starvedSeconds),
      blockedMinutes: secondsToMinutes(metrics.blockedSeconds),
      failureMinutes: secondsToMinutes(metrics.failureSeconds),
      backupStopMinutes: secondsToMinutes(metrics.backupStopSeconds),
      availability: numberOrZero(metrics.availability)
    }])),
    zones: Object.fromEntries(Object.entries(result.accumulationZoneMetrics || {}).map(([id, metrics]) => [id, {
      id,
      name: metrics.name || id,
      ownerEquipmentId: metrics.ownerEquipmentId || null,
      design: summarizeZoneDesign(metrics.engineering),
      averageInventoryUnits: numberOrZero(metrics.averageInventoryUnits),
      maximumInventoryUnits: numberOrZero(metrics.maximumInventoryUnits),
      emptyMinutes: secondsToMinutes(metrics.emptyInventorySeconds),
      overflowUnits: numberOrZero(metrics.overflowUnits),
      backupTriggerCount: numberOrZero(metrics.backupTriggerCount),
      backupBlockedMinutes: secondsToMinutes(metrics.backupSignalBlockedSeconds),
      backupPulsingMinutes: secondsToMinutes(metrics.backupSignalPulsingSeconds)
    }]))
  };
}

function summarizeZoneDesign(engineering) {
  if (!engineering) return null;
  const calculated = engineering.calculated || {};
  return {
    auditStatus: engineering.audit?.status || 'NOT_EVALUATED',
    auditGoals: engineering.audit?.goals || [],
    requiredOverflowLengthMm: numberOrNull(calculated.overflowLengthMm),
    usefulAccumulationLengthMm: numberOrNull(calculated.usefulAccumulationLengthMm),
    recoveryLengthMm: numberOrNull(calculated.recoveryLengthMm),
    antiStarveSeconds: numberOrNull(calculated.antiStarveSeconds),
    antiBlockSeconds: numberOrNull(calculated.antiBlockSeconds),
    recommendedSpeedMmPerSecond: numberOrNull(calculated.recommendedInfeedConveyorSpeedMmPerSecond)
  };
}

function aggregateScenario(replications) {
  const zoneIds = collectIds(replications, 'zones');
  const equipmentIds = collectIds(replications, 'equipment');
  return {
    line: aggregateMetricGroup(replications.map((item) => item.line), lineMetricNames()),
    equipment: Object.fromEntries(equipmentIds.map((id) => [id, aggregateMetricGroup(
      replications.map((item) => item.equipment[id]).filter(Boolean),
      equipmentMetricNames()
    )])),
    zones: Object.fromEntries(zoneIds.map((id) => {
      const instances = replications.map((item) => item.zones[id]).filter(Boolean);
      const first = instances[0];
      return [id, {
        id,
        name: first.name,
        ownerEquipmentId: first.ownerEquipmentId,
        design: first.design,
        metrics: aggregateMetricGroup(instances, zoneMetricNames())
      }];
    }))
  };
}

function createPairedReplication(baseline, candidate) {
  const zoneIds = new Set([...Object.keys(baseline.zones || {}), ...Object.keys(candidate.zones || {})]);
  const equipmentIds = new Set([...Object.keys(baseline.equipment || {}), ...Object.keys(candidate.equipment || {})]);
  return {
    seed: baseline.seed,
    line: subtractMetricGroup(candidate.line, baseline.line, lineMetricNames()),
    equipment: Object.fromEntries([...equipmentIds].map((id) => [id, subtractMetricGroup(
      candidate.equipment[id], baseline.equipment[id], equipmentMetricNames()
    )])),
    zones: Object.fromEntries([...zoneIds].map((id) => {
      const candidateZone = candidate.zones[id];
      const baselineZone = baseline.zones[id];
      return [id, {
        id,
        name: candidateZone?.name || baselineZone?.name || id,
        baselineDesign: baselineZone?.design || null,
        candidateDesign: candidateZone?.design || null,
        comparable: Boolean(candidateZone && baselineZone),
        metrics: subtractMetricGroup(candidateZone, baselineZone, zoneMetricNames())
      }];
    }))
  };
}

function aggregateComparison(replications) {
  const zoneIds = collectIds(replications, 'zones');
  const equipmentIds = collectIds(replications, 'equipment');
  return {
    line: aggregateMetricGroup(replications.map((item) => item.line), lineMetricNames()),
    equipment: Object.fromEntries(equipmentIds.map((id) => [id, aggregateMetricGroup(
      replications.map((item) => item.equipment[id]).filter(Boolean),
      equipmentMetricNames()
    )])),
    zones: Object.fromEntries(zoneIds.map((id) => {
      const instances = replications.map((item) => item.zones[id]).filter(Boolean);
      const first = instances[0];
      return [id, {
        id,
        name: first.name,
        comparable: instances.every((item) => item.comparable),
        baselineDesign: first.baselineDesign,
        candidateDesign: first.candidateDesign,
        metrics: aggregateMetricGroup(instances.map((item) => item.metrics), zoneMetricNames())
      }];
    }))
  };
}

function collectIds(replications, property) {
  return [...new Set(replications.flatMap((item) => Object.keys(item[property] || {})))];
}

function aggregateMetricGroup(items, metricNames) {
  return Object.fromEntries(metricNames.map((name) => [name, distribution(items.map((item) => item?.[name]))]));
}

function subtractMetricGroup(candidate, baseline, metricNames) {
  return Object.fromEntries(metricNames.map((name) => [name,
    numberOrZero(candidate?.[name]) - numberOrZero(baseline?.[name])
  ]));
}

function distribution(values) {
  const usable = values.filter(experimentIsFiniteNumber).sort((left, right) => left - right);
  if (!usable.length) return { count: 0, mean: null, median: null, p10: null, p90: null, minimum: null, maximum: null };
  const sum = usable.reduce((total, value) => total + value, 0);
  return {
    count: usable.length,
    mean: experimentRound(sum / usable.length),
    median: experimentRound(percentile(usable, 0.5)),
    p10: experimentRound(percentile(usable, 0.1)),
    p90: experimentRound(percentile(usable, 0.9)),
    minimum: experimentRound(usable[0]),
    maximum: experimentRound(usable[usable.length - 1])
  };
}

function percentile(sortedValues, probability) {
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sortedValues[low];
  return sortedValues[low] + (sortedValues[high] - sortedValues[low]) * (index - low);
}

function lineMetricNames() {
  return [
    'outputCount', 'averageOutputRatePerMinute', 'starvedMinutes', 'blockedMinutes',
    'failureMinutes', 'emergencyStopMinutes', 'backupStopMinutes', 'overflowUnits'
  ];
}

function equipmentMetricNames() {
  return ['outputCount', 'starvedMinutes', 'blockedMinutes', 'failureMinutes', 'backupStopMinutes', 'availability'];
}

function zoneMetricNames() {
  return [
    'averageInventoryUnits', 'maximumInventoryUnits', 'emptyMinutes', 'overflowUnits',
    'backupTriggerCount', 'backupBlockedMinutes', 'backupPulsingMinutes'
  ];
}

function secondsToMinutes(value) {
  return numberOrZero(value) / 60;
}

function numberOrZero(value) {
  return experimentIsFiniteNumber(value) ? value : 0;
}

function numberOrNull(value) {
  return experimentIsFiniteNumber(value) ? value : null;
}

function experimentIsFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function experimentRound(value) {
  return Math.round(value * 1000000) / 1000000;
}
