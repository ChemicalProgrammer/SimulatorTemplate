import { createSeededRandom } from './SeededRandom.js';
import { validateSimulationInput } from './SimulationValidation.js';

export function simulateLine(input) {
  const validation = validateSimulationInput(input);
  if (!validation.ok) return validation;

  const runtime = createRuntime(input);
  applyDueCommands(runtime);
  initializeInitialMaterialStates(runtime);
  addSample(runtime);
  executeTicks(runtime);
  return { ok: true, result: createResult(runtime) };
}

function createRuntime(input) {
  const random = createSeededRandom(input.run.seed);
  const equipment = input.case.equipment.map((model) => createEquipmentRuntime(model, random));
  return {
    caseId: input.case.id,
    unitOfFlow: input.case.unitOfFlow,
    run: input.run,
    random,
    virtualSecond: 0,
    equipment,
    buffers: equipment.slice(0, -1).map(() => 0),
    events: [],
    samples: [],
    outputCount: 0,
    commandIndex: 0,
    commands: sortCommands(input.run.commands || [])
  };
}

function createEquipmentRuntime(model, random) {
  const reliability = model.noiseProfile?.reliability;
  return {
    ...model,
    mode: model.initialMode,
    availabilityState: model.initialMode,
    actualRatePerSecond: 0,
    microStopRemainingSeconds: 0,
    microStopSeconds: 0,
    failureRemainingSeconds: 0,
    failureSeconds: 0,
    failureCount: 0,
    emergencyStopLatched: false,
    emergencyStopSeconds: 0,
    timeToFailureRemainingSeconds: reliability
      ? randomExponentialSeconds(random, reliability.mtbfMinutes * 60)
      : null,
    outputCount: 0,
    runningSeconds: 0,
    pausedSeconds: 0,
    stoppedSeconds: 0,
    starvedSeconds: 0,
    blockedSeconds: 0
  };
}

function executeTicks(runtime) {
  while (runtime.virtualSecond < runtime.run.durationSeconds) {
    applyDueCommands(runtime);
    updateReliabilityFailures(runtime);
    updateMicroStops(runtime);
    processLineFromDownstream(runtime);
    runtime.virtualSecond += runtime.run.tickSeconds;
    addSampleIfDue(runtime);
  }
}

function initializeInitialMaterialStates(runtime) {
  runtime.equipment.forEach((equipment, index) => {
    equipment.actualRatePerSecond = 0;

    if (equipment.emergencyStopLatched) {
      equipment.availabilityState = 'EMERGENCY_STOP';
    } else if (equipment.mode === 'PAUSE') {
      equipment.availabilityState = 'PAUSED';
    } else if (!isOperationalMode(equipment)) {
      equipment.availabilityState = 'STOPPED';
    } else if (index === 0) {
      // The source is enabled but has not completed its first calculation tick.
      equipment.availabilityState = 'READY';
    } else {
      // All inter-equipment buffers begin empty unless a future Case explicitly
      // declares an initial fill level.
      equipment.availabilityState = 'STARVED';
    }
  });
}

function updateReliabilityFailures(runtime) {
  runtime.equipment.forEach((equipment) => {
    if (equipment.emergencyStopLatched) return;
    const profile = equipment.noiseProfile?.reliability;
    if (!profile) return;

    if (equipment.failureRemainingSeconds > 0) {
      equipment.failureRemainingSeconds = Math.max(0, equipment.failureRemainingSeconds - runtime.run.tickSeconds);
      if (equipment.failureRemainingSeconds === 0) {
        runtime.events.push({ type: 'REPAIR_COMPLETED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id });
        equipment.timeToFailureRemainingSeconds = randomExponentialSeconds(runtime.random, profile.mtbfMinutes * 60);
      }
      return;
    }

    if (!isOperationalMode(equipment) || equipment.microStopRemainingSeconds > 0) return;
    if (equipment.timeToFailureRemainingSeconds === null) {
      equipment.timeToFailureRemainingSeconds = randomExponentialSeconds(runtime.random, profile.mtbfMinutes * 60);
    }
    equipment.timeToFailureRemainingSeconds -= runtime.run.tickSeconds;
    if (equipment.timeToFailureRemainingSeconds > 0) return;

    equipment.failureRemainingSeconds = profile.mttrMinutes * 60;
    equipment.failureCount += 1;
    runtime.events.push({
      type: 'FAILURE_STARTED',
      atVirtualSecond: runtime.virtualSecond,
      equipmentId: equipment.id,
      durationSeconds: equipment.failureRemainingSeconds,
      mtbfMinutes: profile.mtbfMinutes,
      mttrMinutes: profile.mttrMinutes
    });
  });
}

function applyDueCommands(runtime) {
  while (runtime.commandIndex < runtime.commands.length) {
    const command = runtime.commands[runtime.commandIndex];
    if (command.atVirtualSecond > runtime.virtualSecond) return;
    const equipment = runtime.equipment.find((item) => item.id === command.equipmentId);
    if (equipment && isSupportedAction(command.action)) {
      applyCommand(runtime, equipment, command.action);
    }
    runtime.commandIndex += 1;
  }
}

function applyCommand(runtime, equipment, action) {
  if (action === 'EMERGENCY_STOP') {
    equipment.emergencyStopLatched = true;
    equipment.mode = 'STOP';
    runtime.events.push({ type: 'EMERGENCY_STOP_APPLIED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id });
    return;
  }

  if (action === 'RESET') {
    if (!equipment.emergencyStopLatched) {
      runtime.events.push({ type: 'COMMAND_REJECTED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id, action, reason: 'NO_EMERGENCY_STOP_TO_RESET' });
      return;
    }
    equipment.emergencyStopLatched = false;
    equipment.mode = 'STOP';
    runtime.events.push({ type: 'EMERGENCY_STOP_RESET', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id });
    return;
  }

  if (equipment.emergencyStopLatched) {
    runtime.events.push({ type: 'COMMAND_REJECTED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id, action, reason: 'EMERGENCY_STOP_LATCHED' });
    return;
  }

  equipment.mode = action === 'RUN' ? 'AUTO' : action;
  runtime.events.push({ type: 'COMMAND_APPLIED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id, action });
}

function updateMicroStops(runtime) {
  runtime.equipment.forEach((equipment) => {
    if (equipment.emergencyStopLatched) return;
    if (equipment.failureRemainingSeconds > 0) return;
    if (equipment.microStopRemainingSeconds > 0) {
      equipment.microStopRemainingSeconds = Math.max(0, equipment.microStopRemainingSeconds - runtime.run.tickSeconds);
      return;
    }
    if (equipment.mode !== 'AUTO') return;
    const profile = equipment.noiseProfile?.microStop;
    if (!profile) return;
    const probability = (profile.probabilityPerMinute || 0) * runtime.run.tickSeconds / 60;
    if (runtime.random.next() < probability) {
      equipment.microStopRemainingSeconds = randomDuration(runtime.random, profile);
      runtime.events.push({ type: 'MICRO_STOP_STARTED', atVirtualSecond: runtime.virtualSecond, equipmentId: equipment.id, durationSeconds: equipment.microStopRemainingSeconds });
    }
  });
}

function processLineFromDownstream(runtime) {
  for (let index = runtime.equipment.length - 1; index >= 0; index -= 1) {
    processEquipment(runtime, index);
  }
}

function processEquipment(runtime, index) {
  const equipment = runtime.equipment[index];
  const requestedFlow = equipment.nominalRatePerSecond * runtime.run.tickSeconds;
  if (!isAvailable(equipment)) {
    recordUnavailable(equipment, runtime.run.tickSeconds);
    return;
  }

  const inputAvailable = index === 0 ? requestedFlow : runtime.buffers[index - 1];
  const downstreamSpace = getDownstreamSpace(runtime, index);
  const flow = Math.max(0, Math.min(requestedFlow, inputAvailable, downstreamSpace));
  recordMaterialState(equipment, requestedFlow, inputAvailable, downstreamSpace, flow, runtime.run.tickSeconds);
  moveFlow(runtime, index, flow);
  equipment.outputCount += flow;
  equipment.actualRatePerSecond = flow / runtime.run.tickSeconds;
}

function getDownstreamSpace(runtime, index) {
  if (index === runtime.equipment.length - 1) return Number.POSITIVE_INFINITY;
  const capacity = runtime.equipment[index].bufferAfterCapacity;
  return Math.max(0, capacity - runtime.buffers[index]);
}

function moveFlow(runtime, index, flow) {
  if (index > 0) runtime.buffers[index - 1] -= flow;
  if (index === runtime.equipment.length - 1) runtime.outputCount += flow;
  else runtime.buffers[index] += flow;
}

function recordMaterialState(equipment, requestedFlow, inputAvailable, downstreamSpace, flow, tickSeconds) {
  if (flow > 0) {
    equipment.runningSeconds += tickSeconds;
    equipment.availabilityState = 'RUNNING';
    recordPartialConstraintLoss(equipment, requestedFlow, inputAvailable, downstreamSpace, tickSeconds);
    return;
  }

  equipment.actualRatePerSecond = 0;
  if (downstreamSpace <= 0) {
    equipment.blockedSeconds += tickSeconds;
    equipment.availabilityState = 'BLOCKED';
    return;
  }
  if (inputAvailable <= 0) {
    equipment.starvedSeconds += tickSeconds;
    equipment.availabilityState = 'STARVED';
    return;
  }
  equipment.availabilityState = 'IDLE';
}

function recordPartialConstraintLoss(equipment, requestedFlow, inputAvailable, downstreamSpace, tickSeconds) {
  if (requestedFlow <= 0) return;
  if (inputAvailable < requestedFlow && inputAvailable <= downstreamSpace) {
    equipment.starvedSeconds += (1 - inputAvailable / requestedFlow) * tickSeconds;
  } else if (downstreamSpace < requestedFlow) {
    equipment.blockedSeconds += (1 - downstreamSpace / requestedFlow) * tickSeconds;
  }
}

function recordUnavailable(equipment, tickSeconds) {
  equipment.actualRatePerSecond = 0;
  if (equipment.emergencyStopLatched) {
    equipment.stoppedSeconds += tickSeconds;
    equipment.emergencyStopSeconds += tickSeconds;
    equipment.availabilityState = 'EMERGENCY_STOP';
  } else if (equipment.failureRemainingSeconds > 0) {
    equipment.stoppedSeconds += tickSeconds;
    equipment.failureSeconds += tickSeconds;
    equipment.availabilityState = 'FAILURE';
  } else if (equipment.microStopRemainingSeconds > 0) {
    equipment.stoppedSeconds += tickSeconds;
    equipment.microStopSeconds += tickSeconds;
    equipment.availabilityState = 'MICRO_STOP';
  } else if (equipment.mode === 'PAUSE') {
    equipment.pausedSeconds += tickSeconds;
    equipment.availabilityState = 'PAUSED';
  } else {
    equipment.stoppedSeconds += tickSeconds;
    equipment.availabilityState = 'STOPPED';
  }
}

function isAvailable(equipment) {
  return !equipment.emergencyStopLatched && isOperationalMode(equipment) && equipment.microStopRemainingSeconds <= 0 && equipment.failureRemainingSeconds <= 0;
}

function addSampleIfDue(runtime) {
  const interval = runtime.run.sampleEverySeconds || runtime.run.tickSeconds;
  if (runtime.virtualSecond !== runtime.run.durationSeconds && runtime.virtualSecond % interval !== 0) return;
  addSample(runtime);
}

function addSample(runtime) {
  runtime.samples.push({
    virtualSecond: runtime.virtualSecond,
    outputCount: round(runtime.outputCount),
    buffers: runtime.buffers.map(round),
    equipment: runtime.equipment.map((item) => ({
      id: item.id,
      mode: item.mode,
      availabilityState: item.availabilityState,
      outputCount: round(item.outputCount),
      processedUnits: round(item.outputCount),
      actualRatePerSecond: round(item.actualRatePerSecond),
      starvedSeconds: round(item.starvedSeconds),
      blockedSeconds: round(item.blockedSeconds),
      failureSeconds: round(item.failureSeconds),
      emergencyStopSeconds: round(item.emergencyStopSeconds)
    }))
  });
}

function createResult(runtime) {
  return {
    caseId: runtime.caseId,
    unitOfFlow: runtime.unitOfFlow,
    engineVersion: '0.4.0',
    seed: runtime.run.seed,
    durationSeconds: runtime.run.durationSeconds,
    summary: createSummary(runtime),
    equipmentMetrics: Object.fromEntries(runtime.equipment.map((item) => [item.id, createEquipmentMetrics(item, runtime.run.durationSeconds)])),
    events: runtime.events,
    samples: runtime.samples
  };
}

function createSummary(runtime) {
  return {
    outputCount: round(runtime.outputCount),
    averageOutputRatePerSecond: round(runtime.outputCount / runtime.run.durationSeconds),
    totalBlockedSeconds: round(sum(runtime.equipment.map((item) => item.blockedSeconds))),
    totalStarvedSeconds: round(sum(runtime.equipment.map((item) => item.starvedSeconds))),
    totalFailureSeconds: round(sum(runtime.equipment.map((item) => item.failureSeconds))),
    totalEmergencyStopSeconds: round(sum(runtime.equipment.map((item) => item.emergencyStopSeconds)))
  };
}

function createEquipmentMetrics(equipment, durationSeconds) {
  return {
    outputCount: round(equipment.outputCount),
    runningSeconds: round(equipment.runningSeconds),
    pausedSeconds: round(equipment.pausedSeconds),
    stoppedSeconds: round(equipment.stoppedSeconds),
    failureSeconds: round(equipment.failureSeconds),
    failureCount: equipment.failureCount,
    microStopSeconds: round(equipment.microStopSeconds),
    emergencyStopSeconds: round(equipment.emergencyStopSeconds),
    starvedSeconds: round(equipment.starvedSeconds),
    blockedSeconds: round(equipment.blockedSeconds),
    availability: round(Math.max(0, 1 - equipment.stoppedSeconds / durationSeconds))
  };
}

function sortCommands(commands) { return [...commands].sort((a, b) => a.atVirtualSecond - b.atVirtualSecond); }
function isSupportedAction(action) { return ['RUN', 'PAUSE', 'STOP', 'MANUAL', 'AUTO', 'EMERGENCY_STOP', 'RESET'].includes(action); }
function isOperationalMode(equipment) { return equipment.mode === 'AUTO' || equipment.mode === 'MANUAL'; }
function randomDuration(random, profile) { const min = profile.minDurationSeconds || 0; const max = profile.maxDurationSeconds ?? min; return min + (max - min) * random.next(); }
function randomExponentialSeconds(random, meanSeconds) { return -Math.log(1 - Math.max(random.next(), 1e-12)) * meanSeconds; }
function sum(values) { return values.reduce((total, value) => total + value, 0); }
function round(value) { return Number(value.toFixed(6)); }
