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

test('captures an empty-line time-zero snapshot before the first processing tick', () => {
  const response = simulateLine(createInput({ durationSeconds: 7, sampleEverySeconds: 5 }));
  const initial = response.result.samples[0];
  const source = initial.equipment.find((item) => item.id === 'blower-1');
  const downstream = initial.equipment.find((item) => item.id === 'pacemaker-1');

  assert.equal(response.ok, true);
  assert.equal(initial.virtualSecond, 0);
  assert.equal(initial.outputCount, 0);
  assert.equal(source.availabilityState, 'READY');
  assert.equal(source.actualRatePerSecond, 0);
  assert.equal(downstream.availabilityState, 'STARVED');
  assert.equal(downstream.actualRatePerSecond, 0);
  assert.deepEqual(response.result.samples.map((sample) => sample.virtualSecond), [0, 5, 7]);
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


test('uses geometry and the Prime photocell to hold a downstream machine until product arrives', () => {
  const input = {
    case: {
      id: 'prime-zone',
      unitOfFlow: 'bottles',
      equipment: [
        {
          id: 'source',
          nominalRatePerSecond: 10,
          bufferAfterCapacity: 1,
          initialMode: 'AUTO',
          accumulationZone: {
            usableLengthMm: 100,
            productPitchMm: 10,
            conveyorSpeedMmPerSecond: 100,
            primeSensorPositionMm: 50,
            upstreamControlEquipmentId: 'source',
            downstreamControlEquipmentId: 'downstream',
            upstreamStopResponseSeconds: 0,
            bottlesDischargedAtStop: 0,
            downstreamRampUpSeconds: 0
          }
        },
        { id: 'downstream', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: { durationSeconds: 2, tickSeconds: 1, sampleEverySeconds: 1, seed: 7 }
  };

  const response = simulateLine(input);
  const initialDownstream = response.result.samples[0].equipment.find((item) => item.id === 'downstream');
  const finished = response.result.samples.at(-1);
  const finishedDownstream = finished.equipment.find((item) => item.id === 'downstream');

  assert.equal(response.ok, true);
  assert.equal(initialDownstream.availabilityState, 'WAITING_FOR_PRIME');
  assert.ok(response.result.events.some((event) => event.type === 'PRIME_SENSOR_TRIGGERED'));
  assert.equal(finished.accumulationZones[0].capacityUnits, 10);
  assert.equal(finished.accumulationZones[0].prime.state, 'DETECTED');
  assert.ok(finishedDownstream.outputCount > 0);
});

test('Back-up sensor applies an upstream controlled stop and records residual overflow separately', () => {
  const input = {
    case: {
      id: 'backup-zone',
      unitOfFlow: 'bottles',
      equipment: [
        {
          id: 'source',
          nominalRatePerSecond: 10,
          bufferAfterCapacity: 1,
          initialMode: 'AUTO',
          accumulationZone: {
            usableLengthMm: 100,
            productPitchMm: 10,
            conveyorSpeedMmPerSecond: 100,
            backupSensorPositionMm: 50,
            backupRestartPositionMm: 60,
            upstreamControlEquipmentId: 'source',
            downstreamControlEquipmentId: 'downstream',
            upstreamStopResponseSeconds: 0,
            bottlesDischargedAtStop: 3
          }
        },
        { id: 'downstream', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'STOP' }
      ]
    },
    run: {
      durationSeconds: 5,
      tickSeconds: 1,
      sampleEverySeconds: 1,
      seed: 7,
      commands: [{ atVirtualSecond: 2, equipmentId: 'downstream', action: 'RUN' }]
    }
  };

  const response = simulateLine(input);
  const sourceMetrics = response.result.equipmentMetrics.source;

  assert.equal(response.ok, true);
  assert.ok(response.result.events.some((event) => event.type === 'BACKUP_SENSOR_BLOCKED'));
  assert.ok(response.result.events.some((event) => event.type === 'BACKUP_SENSOR_CLEARED'));
  assert.equal(response.result.summary.totalOverflowUnits, 3);
  assert.ok(sourceMetrics.backupStopSeconds > 0);
});

test('rejects a physical zone that refers to an unknown controlled equipment unit', () => {
  const input = createInput();
  input.case.equipment[0].accumulationZone = {
    usableLengthMm: 100,
    productPitchMm: 10,
    conveyorSpeedMmPerSecond: 100,
    upstreamControlEquipmentId: 'missing',
    downstreamControlEquipmentId: 'pacemaker-1'
  };

  const response = simulateLine(input);

  assert.equal(response.ok, false);
  assert.ok(response.error.details.some((detail) => detail.path === 'case.equipment[0].accumulationZone.upstreamControlEquipmentId'));
});


test('applies the configured start delay and ramp instead of resuming at nominal speed', () => {
  const input = {
    case: {
      id: 'start-profile',
      unitOfFlow: 'bottles',
      equipment: [
        {
          id: 'source',
          nominalRatePerSecond: 10,
          bufferAfterCapacity: 100,
          initialMode: 'STOP',
          processData: {
            upstream: { startupTimeSeconds: 2 },
            downstream: { rampUpTimeSeconds: 4 }
          }
        },
        { id: 'downstream', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: {
      durationSeconds: 8,
      tickSeconds: 1,
      sampleEverySeconds: 1,
      seed: 11,
      commands: [{ atVirtualSecond: 0, equipmentId: 'source', action: 'RUN' }]
    }
  };

  const response = simulateLine(input);
  const samples = response.result.samples;
  const sourceAtOneSecond = samples.find((sample) => sample.virtualSecond === 1).equipment[0];
  const sourceDuringRamp = samples.find((sample) => sample.virtualSecond === 5).equipment[0];
  const sourceAfterRamp = samples.find((sample) => sample.virtualSecond === 8).equipment[0];

  assert.equal(response.ok, true);
  assert.equal(sourceAtOneSecond.availabilityState, 'STARTING');
  assert.equal(sourceAtOneSecond.actualRatePerSecond, 0);
  assert.equal(sourceDuringRamp.availabilityState, 'RAMPING_UP');
  assert.ok(sourceDuringRamp.actualRatePerSecond > 0);
  assert.ok(sourceDuringRamp.actualRatePerSecond < 10);
  assert.equal(sourceAfterRamp.availabilityState, 'RUNNING');
  assert.equal(sourceAfterRamp.actualRatePerSecond, 10);
});

test('Back-up recovery waits for the sensor clear and then uses the upstream start profile', () => {
  const input = {
    case: {
      id: 'backup-controlled-restart',
      unitOfFlow: 'bottles',
      equipment: [
        {
          id: 'source',
          nominalRatePerSecond: 5,
          bufferAfterCapacity: 1,
          initialMode: 'AUTO',
          processData: {
            upstream: { startupTimeSeconds: 2 },
            downstream: { rampUpTimeSeconds: 3 }
          },
          accumulationZone: {
            usableLengthMm: 100,
            productPitchMm: 10,
            conveyorSpeedMmPerSecond: 100,
            backupSensorPositionMm: 50,
            backupRestartPositionMm: 60,
            upstreamControlEquipmentId: 'source',
            downstreamControlEquipmentId: 'downstream',
            upstreamStopResponseSeconds: 0,
            bottlesDischargedAtStop: 0
          }
        },
        {
          id: 'downstream',
          nominalRatePerSecond: 5,
          bufferAfterCapacity: 0,
          initialMode: 'STOP',
          processData: {
            upstream: { startupTimeSeconds: 1 },
            downstream: { rampUpTimeSeconds: 2 }
          }
        }
      ]
    },
    run: {
      durationSeconds: 12,
      tickSeconds: 1,
      sampleEverySeconds: 1,
      seed: 7,
      commands: [{ atVirtualSecond: 5, equipmentId: 'downstream', action: 'RUN' }]
    }
  };

  const response = simulateLine(input);
  const clearEvent = response.result.events.find((event) => event.type === 'BACKUP_SENSOR_CLEARED');
  const recoveryRequest = response.result.events.find((event) =>
    event.type === 'EQUIPMENT_START_SEQUENCE_REQUESTED' &&
    event.equipmentId === 'source' &&
    event.reason === 'BACKUP_SENSOR_CLEAR'
  );
  const sourceAfterClear = response.result.samples.find(
    (sample) => sample.virtualSecond === clearEvent.atVirtualSecond + 1
  ).equipment[0];

  assert.equal(response.ok, true);
  assert.ok(clearEvent);
  assert.ok(recoveryRequest);
  assert.equal(recoveryRequest.atVirtualSecond, clearEvent.atVirtualSecond);
  assert.equal(sourceAfterClear.availabilityState, 'STARTING');
  assert.equal(sourceAfterClear.actualRatePerSecond, 0);
});


test('derives a conveyor accumulation zone from named format geometry and uses length plus gap for capacity', () => {
  const input = {
    case: {
      id: 'format-derived-zone',
      unitOfFlow: 'bottles',
      equipment: [
        { id: 'source', type: 'BLOWMOLDER', nominalRatePerSecond: 10, bufferAfterCapacity: 100, initialMode: 'AUTO' },
        {
          id: 'conveyor',
          type: 'CONVEYOR',
          nominalRatePerSecond: 10,
          bufferAfterCapacity: 0,
          initialMode: 'AUTO',
          processData: {
            role: 'CONVEYOR',
            upstream: { packageLengthMm: 66, dischargePitchMm: null },
            accumulation: {
              usableLengthMm: 20000,
              gapMm: 22,
              conveyorSpeedMmPerSecond: 760,
              primeSensorPositionMm: 18000,
              backupSensorPositionMm: 7000,
              backupRestartPositionMm: 9500
            }
          }
        },
        { id: 'downstream', type: 'PUCKER', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: { durationSeconds: 1, tickSeconds: 1, sampleEverySeconds: 1, seed: 7 }
  };

  const response = simulateLine(input);
  const zone = response.result.samples[0].accumulationZones[1];

  assert.equal(response.ok, true);
  assert.equal(zone.physicalModelEnabled, true);
  assert.equal(zone.modelOrigin, 'FORMAT_DERIVED');
  assert.equal(zone.capacityUnits, 227);
  assert.equal(zone.geometry.productPitchMm, 88);
  assert.equal(zone.geometry.travelSeconds, 26.315789);
  assert.equal(zone.geometrySources.productPitchMm, 'processData.upstream.packageLengthMm + processData.accumulation.gapMm');
  assert.equal(zone.upstreamControlEquipmentId, 'source');
  assert.equal(zone.downstreamControlEquipmentId, 'downstream');
});

test('uses an explicit accumulationZone as an override over format-derived geometry', () => {
  const input = {
    case: {
      id: 'explicit-zone-override',
      unitOfFlow: 'bottles',
      equipment: [
        { id: 'source', nominalRatePerSecond: 10, bufferAfterCapacity: 100, initialMode: 'AUTO' },
        {
          id: 'conveyor',
          type: 'CONVEYOR',
          nominalRatePerSecond: 10,
          bufferAfterCapacity: 0,
          initialMode: 'AUTO',
          processData: {
            accumulation: {
              usableLengthMm: 20000,
              productPitchMm: 88,
              conveyorSpeedMmPerSecond: 760
            }
          },
          accumulationZone: {
            usableLengthMm: 100,
            productPitchMm: 10,
            conveyorSpeedMmPerSecond: 100,
            upstreamControlEquipmentId: 'source',
            downstreamControlEquipmentId: 'downstream'
          }
        },
        { id: 'downstream', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: { durationSeconds: 1, tickSeconds: 1, sampleEverySeconds: 1, seed: 7 }
  };

  const response = simulateLine(input);
  const zone = response.result.samples[0].accumulationZones[1];

  assert.equal(response.ok, true);
  assert.equal(zone.modelOrigin, 'EXPLICIT_ZONE');
  assert.equal(zone.capacityUnits, 10);
});

test('rejects an incomplete format-driven zone rather than silently using an abstract buffer', () => {
  const input = {
    case: {
      id: 'incomplete-format-zone',
      unitOfFlow: 'bottles',
      equipment: [
        { id: 'source', nominalRatePerSecond: 10, bufferAfterCapacity: 100, initialMode: 'AUTO' },
        {
          id: 'conveyor',
          type: 'CONVEYOR',
          nominalRatePerSecond: 10,
          initialMode: 'AUTO',
          processData: {
            accumulation: { usableLengthMm: 100 }
          }
        },
        { id: 'downstream', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: { durationSeconds: 1, tickSeconds: 1, sampleEverySeconds: 1, seed: 7 }
  };

  const response = simulateLine(input);

  assert.equal(response.ok, false);
  assert.ok(response.error.details.some((detail) =>
    detail.path === 'case.equipment[1].processData.accumulation.conveyorSpeedMmPerSecond'
  ));
  assert.ok(response.error.details.some((detail) =>
    detail.path === 'case.equipment[1].processData.accumulation'
  ));
});


test('derives conveyor speed from upstream nominal rate, pitch, and the named speed factor when direct speed is absent', () => {
  const input = {
    case: {
      id: 'format-derived-speed',
      unitOfFlow: 'bottles',
      equipment: [
        { id: 'source', type: 'FILLER', nominalRatePerSecond: 10, bufferAfterCapacity: 100, initialMode: 'AUTO' },
        {
          id: 'conveyor',
          type: 'CONVEYOR',
          nominalRatePerSecond: 12,
          bufferAfterCapacity: 0,
          initialMode: 'AUTO',
          processData: {
            upstream: { dischargePitchMm: 88 },
            speedAndSensors: { conveyorSpeedFactorVsDischargeVelocityPercent: 105 },
            accumulation: { usableLengthMm: 20000, productPitchMm: 88 }
          }
        },
        { id: 'downstream', type: 'SLEEVER', nominalRatePerSecond: 10, bufferAfterCapacity: 0, initialMode: 'AUTO' }
      ]
    },
    run: { durationSeconds: 1, tickSeconds: 1, sampleEverySeconds: 1, seed: 3 }
  };

  const response = simulateLine(input);
  const zone = response.result.samples[0].accumulationZones[1];

  assert.equal(response.ok, true);
  assert.equal(zone.geometry.conveyorSpeedMmPerSecond, 924);
  assert.equal(
    zone.geometrySources.conveyorSpeedMmPerSecond,
    'upstream nominal rate × product pitch × conveyor speed factor'
  );
});
