import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const referenceCase = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'examples/reference-line.case.json'), 'utf8'));

test('the Apps Script browser bundle exposes the tested deterministic engine', () => {
  const bundle = fs.readFileSync(path.join(repositoryRoot, 'apps-script', 'source', 'SimulationEngine.html'), 'utf8');
  const script = bundle.match(/<script>([\s\S]*)<\/script>/)[1];
  const browser = { SimulatorEngine: null };
  const context = vm.createContext({ window: browser, Math, Number, Array, Object, JSON, isFinite });

  vm.runInContext(script, context, { filename: 'SimulationEngine.html' });
  const response = browser.SimulatorEngine.simulateLine({
    case: referenceCase,
    run: { durationSeconds: 180, tickSeconds: 1, sampleEverySeconds: 5, seed: 7 }
  });

  assert.equal(response.ok, true);
  assert.ok(response.result.summary.outputCount > 0);
  assert.equal(response.result.seed, 7);

  const experiment = browser.SimulatorEngine.runScenarioExperiment({
    case: referenceCase,
    run: { durationSeconds: 60, tickSeconds: 1, sampleEverySeconds: 5, seed: 7 },
    seeds: [7, 8]
  });
  assert.equal(experiment.ok, true);
  assert.equal(experiment.scenario.replicationCount, 2);
  assert.equal(typeof browser.SimulatorEngine.compareScenarioExperiments, 'function');
});
