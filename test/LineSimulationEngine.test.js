import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateLine } from '../src/simulation/LineSimulationEngine.js';
import referenceCase from '../examples/reference-line.case.json' with { type: 'json' };

function createInput(overrides = {}) {
  return {
    case: structuredClone(referenceCase),
    run: {
      durationSeconds: 120,
      tickSeconds: 1,
      sampleEverySeconds: 5,
      seed: 20260909,
      ...overrides
    }
  };
}

test('returns a structured error when required input is absent', () => {
  const response = simulateLine({});

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INVALID_SIMULATION_INPUT');
  assert.ok(response.error.details.some((detail) => detail.path === 'case'));
});

test('repeats exactly with the same case, run configuration, and seed', () => {
  const first = simulateLine(createInput());
  const second = simulateLine(createInput());

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.result.summary, second.result.summary);
  assert.deepEqual(first.result.events, second.result.events);
  assert.deepEqual(first.result.samples, second.result.samples);
});

test('a larger upstream buffer preserves output through a pacemaker pause', () => {
  const constrained = createInput();
  constrained.case.equipment[1].bufferAfterCapacity = 20;
  constrained.run.commands = [
    { atVirtualSecond: 20, equipmentId: 'pacemaker-1', action: 'PAUSE' },
    { atVirtualSecond: 40, equipmentId: 'pacemaker-1', action: 'RUN' }
  ];

  const buffered = createInput();
  buffered.case.equipment[1].bufferAfterCapacity = 300;
  buffered.run.commands = structuredClone(constrained.run.commands);

  const constrainedResult = simulateLine(constrained);
  const bufferedResult = simulateLine(buffered);

  assert.equal(constrainedResult.ok, true);
  assert.equal(bufferedResult.ok, true);
  assert.ok(
    bufferedResult.result.summary.outputCount > constrainedResult.result.summary.outputCount,
    'the buffer should preserve production during the pacemaker pause'
  );
});

test('applies explicit pause and run commands to one equipment unit', () => {
  const input = createInput({
    commands: [
      { atVirtualSecond: 20, equipmentId: 'pacemaker-1', action: 'PAUSE' },
      { atVirtualSecond: 40, equipmentId: 'pacemaker-1', action: 'RUN' }
    ]
  });

  const response = simulateLine(input);

  assert.equal(response.ok, true);
  assert.equal(response.result.events.filter((event) => event.type === 'COMMAND_APPLIED').length, 2);
  assert.ok(response.result.equipmentMetrics['pacemaker-1'].pausedSeconds >= 20);
});

test('returns a structured error for a control command that targets no equipment', () => {
  const response = simulateLine(createInput({
    commands: [{ atVirtualSecond: 10, equipmentId: 'missing-unit', action: 'PAUSE' }]
  }));

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INVALID_SIMULATION_INPUT');
  assert.ok(response.error.details.some((detail) => detail.path === 'run.commands[0].equipmentId'));
});

test('returns a structured error for an invalid micro-stop profile', () => {
  const input = createInput();
  input.case.equipment[2].noiseProfile.microStop.probabilityPerMinute = -1;

  const response = simulateLine(input);

  assert.equal(response.ok, false);
  assert.equal(response.error.code, 'INVALID_SIMULATION_INPUT');
  assert.ok(response.error.details.some((detail) => detail.path === 'case.equipment[2].noiseProfile.microStop.probabilityPerMinute'));
});
