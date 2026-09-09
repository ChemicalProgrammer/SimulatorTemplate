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

test('uses MTBF and MTTR as seeded failure and repair events', () => {
  const input = createInput({ durationSeconds: 120, seed: 19 });
  input.case.equipment[2].noiseProfile = {
    reliability: { mtbfMinutes: 0.1, mttrMinutes: 0.05 }
  };

  const first = simulateLine(input);
  const second = simulateLine(structuredClone(input));
  const firstFailures = first.result.events.filter((event) => event.type === 'FAILURE_STARTED' && event.equipmentId === 'pacemaker-1');
  const firstRepairs = first.result.events.filter((event) => event.type === 'REPAIR_COMPLETED' && event.equipmentId === 'pacemaker-1');

  assert.equal(first.ok, true);
  assert.deepEqual(first.result.events, second.result.events);
  assert.ok(firstFailures.length > 0);
  assert.ok(firstRepairs.length > 0);
  assert.equal(first.result.equipmentMetrics['pacemaker-1'].failureCount, firstFailures.length);
  assert.ok(first.result.equipmentMetrics['pacemaker-1'].failureSeconds > 0);
});

test('rejects an invalid MTBF or MTTR reliability profile', () => {
  const input = createInput();
  input.case.equipment[2].noiseProfile = {
    reliability: { mtbfMinutes: 10, mttrMinutes: 0 }
  };

  const response = simulateLine(input);

  assert.equal(response.ok, false);
  assert.ok(response.error.details.some((detail) => detail.path === 'case.equipment[2].noiseProfile.reliability.mttrMinutes'));
});

test('shows downstream equipment as starved with zero actual rate when an empty line starts', () => {
  const response = simulateLine(createInput({ durationSeconds: 1, sampleEverySeconds: 1 }));
  const sample = response.result.samples.at(-1);
  const blower = sample.equipment.find((item) => item.id === 'blower-1');
  const pacemaker = sample.equipment.find((item) => item.id === 'pacemaker-1');

  assert.equal(response.ok, true);
  assert.equal(blower.availabilityState, 'RUNNING');
  assert.ok(blower.actualRatePerSecond > 0);
  assert.equal(pacemaker.availabilityState, 'STARVED');
  assert.equal(pacemaker.actualRatePerSecond, 0);
  assert.equal(pacemaker.starvedSeconds, 1);
});

test('shows an equipment unit as blocked when its downstream buffer has no space', () => {
  const input = createInput({ durationSeconds: 1, sampleEverySeconds: 1 });
  input.case.equipment[0].bufferAfterCapacity = 0;

  const response = simulateLine(input);
  const blower = response.result.samples.at(-1).equipment.find((item) => item.id === 'blower-1');

  assert.equal(response.ok, true);
  assert.equal(blower.availabilityState, 'BLOCKED');
  assert.equal(blower.actualRatePerSecond, 0);
  assert.equal(blower.blockedSeconds, 1);
});

test('keeps an emergency stop latched until reset and a new run command', () => {
  const input = createInput({
    durationSeconds: 25,
    sampleEverySeconds: 5,
    commands: [
      { atVirtualSecond: 0, equipmentId: 'pacemaker-1', action: 'EMERGENCY_STOP' },
      { atVirtualSecond: 10, equipmentId: 'pacemaker-1', action: 'RUN' },
      { atVirtualSecond: 15, equipmentId: 'pacemaker-1', action: 'RESET' },
      { atVirtualSecond: 20, equipmentId: 'pacemaker-1', action: 'RUN' }
    ]
  });

  const response = simulateLine(input);
  const states = response.result.samples.map((sample) => sample.equipment.find((item) => item.id === 'pacemaker-1').availabilityState);
  const metrics = response.result.equipmentMetrics['pacemaker-1'];

  assert.equal(response.ok, true);
  assert.ok(states.includes('EMERGENCY_STOP'));
  assert.ok(response.result.events.some((event) => event.type === 'EMERGENCY_STOP_APPLIED'));
  assert.ok(response.result.events.some((event) => event.type === 'EMERGENCY_STOP_RESET'));
  assert.ok(response.result.events.some((event) => event.type === 'COMMAND_REJECTED' && event.action === 'RUN'));
  assert.ok(metrics.emergencyStopSeconds >= 15);
});
