import assert from 'node:assert/strict';
import test from 'node:test';

import { compareScenarioExperiments, runScenarioExperiment } from '../src/simulation/ExperimentAnalysis.js';

function createExperimentLine() {
  return {
    id: 'experiment-line',
    unitOfFlow: 'bottles',
    equipment: [
      {
        id: 'source', type: 'FILLER', name: 'Source', nominalRatePerSecond: 4, initialMode: 'AUTO',
        processData: { upstream: { startupTimeSeconds: 0, bottlesDischargedAtStop: 0 }, downstream: { rampUpTimeSeconds: 0 } }
      },
      {
        id: 'conveyor', type: 'CONVEYOR', name: 'Experiment conveyor', nominalRatePerSecond: 5, initialMode: 'AUTO',
        processData: {
          role: 'CONVEYOR',
          accumulation: {
            usableLengthMm: 400, productLengthMm: 20, gapMm: 10, conveyorSpeedMmPerSecond: 100,
            primeSensorPositionMm: 320, backupSensorPositionMm: 160, backupRestartPositionMm: 160,
            blockedTimeDelaySeconds: 0.5, clearTimeDelaySeconds: 0.5,
            upstreamStopResponseSeconds: 0, bottlesDischargedAtStop: 0, downstreamRampUpSeconds: 0
          }
        }
      },
      {
        id: 'downstream', type: 'SLEEVER', name: 'Downstream', nominalRatePerSecond: 4, initialMode: 'AUTO',
        processData: { upstream: { startupTimeSeconds: 0, bottlesDischargedAtStop: 0 }, downstream: { rampUpTimeSeconds: 0 } }
      }
    ]
  };
}

function createExperimentInput(overrides = {}) {
  return {
    case: createExperimentLine(),
    run: { durationSeconds: 40, tickSeconds: 0.25, sampleEverySeconds: 2, seed: 1 },
    seeds: [17, 18, 19],
    ...overrides
  };
}

test('runs a compact repeatable scenario experiment without retaining trajectories', () => {
  const first = runScenarioExperiment(createExperimentInput());
  const second = runScenarioExperiment(createExperimentInput());

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(first.scenario.replicationCount, 3);
  assert.equal(first.scenario.summary.line.outputCount.count, 3);
  assert.equal(first.scenario.replications[0].samples, undefined);
  assert.equal(first.scenario.replications[0].zones['conveyor--physical-zone'].name, 'Experiment conveyor accumulation');
});

test('pairs the same seed set and returns zero deltas for identical scenarios', () => {
  const baseline = runScenarioExperiment(createExperimentInput()).scenario;
  const candidate = runScenarioExperiment(createExperimentInput()).scenario;
  const comparison = compareScenarioExperiments(baseline, candidate);

  assert.equal(comparison.ok, true);
  assert.equal(comparison.comparison.replicationCount, 3);
  assert.equal(comparison.comparison.summary.line.outputCount.mean, 0);
  assert.equal(comparison.comparison.summary.line.starvedMinutes.mean, 0);
  assert.equal(comparison.comparison.summary.zones['conveyor--physical-zone'].metrics.averageInventoryUnits.mean, 0);
});

test('reports a paired delta when a candidate changes downstream capacity', () => {
  const baseline = runScenarioExperiment(createExperimentInput()).scenario;
  const candidateInput = createExperimentInput();
  candidateInput.case.equipment[2].nominalRatePerSecond = 2;
  const candidate = runScenarioExperiment(candidateInput).scenario;
  const comparison = compareScenarioExperiments(baseline, candidate);

  assert.equal(comparison.ok, true);
  assert.ok(comparison.comparison.summary.line.outputCount.mean < 0);
  assert.equal(comparison.comparison.summary.zones['conveyor--physical-zone'].metrics.maximumInventoryUnits.count, 3);
});

test('rejects an experiment that repeats the same seed', () => {
  const response = runScenarioExperiment(createExperimentInput({ seeds: [17, 17] }));
  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INVALID_EXPERIMENT_INPUT');
});
