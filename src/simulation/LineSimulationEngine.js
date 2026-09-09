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
  const zones = equipment.slice(0, -1).map((equipment, index) => createAccumulationZoneRuntime(
    equipment,
    input.case.equipment[index + 1],
    input.case.equipment
  ));

  equipment.forEach((equipment, index) => {
    const incomingZone = zones.find((zone) => zone.downstreamControlEquipmentId === equipment.id && zone.hasPrimeSensor);
    equipment.primeStartAuthorized = index === 0 || !incomingZone;
    equipment.autoStartRampDurationSeconds = incomingZone ? incomingZone.downstreamRampUpSeconds : 0;
    equipment.autoStartRampElapsedSeconds = incomingZone ? 0 : equipment.autoStartRampDurationSeconds;
    equipment.backupControl = null;
  });

  return {
    caseId: input.case.id,
    unitOfFlow: input.case.unitOfFlow,
    run: input.run,
    random,
    virtualSecond: 0,
    equipment,
    zones,
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
    blockedSeconds: 0,
    waitingForPrimeSeconds: 0,
    backupStopSeconds: 0
  };
}

function createAccumulationZoneRuntime(owner, downstreamModel) {
  const definition = owner.accumulationZone;
  const physical = definition ? normalizePhysicalZone(definition) : null;
  const capacityUnits = physical ? physical.capacityUnits : owner.bufferAfterCapacity;
  const upstreamControlEquipmentId = definition?.upstreamControlEquipmentId || owner.id;
  const downstreamControlEquipmentId = definition?.downstreamControlEquipmentId || downstreamModel.id;

  return {
    id: definition?.id || owner.id + '--to--' + downstreamModel.id,
    name: definition?.name || owner.name + ' to ' + downstreamModel.name,
    ownerEquipmentId: owner.id,
    upstreamControlEquipmentId,
    downstreamControlEquipmentId,
    physicalModelEnabled: Boolean(physical),
    capacityUnits,
    usableLengthMm: physical?.usableLengthMm || null,
    productPitchMm: physical?.productPitchMm || null,
    productLengthMm: physical?.productLengthMm || null,
    gapMm: physical?.gapMm || null,
    conveyorSpeedMmPerSecond: physical?.conveyorSpeedMmPerSecond || null,
    travelSeconds: physical?.travelSeconds || 0,
    primeSensorPositionMm: physical?.primeSensorPositionMm ?? null,
    primeTravelSeconds: physical?.primeTravelSeconds ?? null,
    hasPrimeSensor: physical?.hasPrimeSensor || false,
    primeDetected: false,
    primeDetectedAtVirtualSecond: null,
    downstreamRampUpSeconds: physical?.downstreamRampUpSeconds || 0,
    backupSensorPositionMm: physical?.backupSensorPositionMm ?? null,
    backupRestartPositionMm: physical?.backupRestartPositionMm ?? null,
    backupTriggerWaitingUnits: physical?.backupTriggerWaitingUnits ?? null,
    backupRestartWaitingUnits: physical?.backupRestartWaitingUnits ?? null,
    hasBackupSensor: physical?.hasBackupSensor || false,
    backupActive: false,
    backupTriggeredAtVirtualSecond: null,
    backupTriggerCount: 0,
    upstreamStopResponseSeconds: physical?.upstreamStopResponseSeconds || 0,
    bottlesDischargedAtStop: physical?.bottlesDischargedAtStop || 0,
    transit: [],
    waitingUnits: 0,
    overflowUnits: 0,
    overflowEvents: 0
  };
}

function normalizePhysicalZone(definition) {
  const productPitchMm = definition.productPitchMm || ((definition.productLengthMm || 0) + (definition.gapMm || 0));
  const usableLengthMm = definition.usableLengthMm;
  const capacityUnits = Math.floor(usableLengthMm / productPitchMm);
  const conveyorSpeedMmPerSecond = definition.conveyorSpeedMmPerSecond;
  const hasPrimeSensor = definition.primeSensorPositionMm !== undefined && definition.primeSensorPositionMm !== null;
  const hasBackupSensor = definition.backupSensorPositionMm !== undefined && definition.backupSensorPositionMm !== null;
  const backupRestartPositionMm = hasBackupSensor
    ? definition.backupRestartPositionMm
    : null;
  return {
    usableLengthMm,
    productPitchMm,
    productLengthMm: definition.productLengthMm ?? null,
    gapMm: definition.gapMm ?? null,
    conveyorSpeedMmPerSecond,
    capacityUnits,
    travelSeconds: usableLengthMm / conveyorSpeedMmPerSecond,
    hasPrimeSensor,
    primeSensorPositionMm: hasPrimeSensor ? definition.primeSensorPositionMm : null,
    primeTravelSeconds: hasPrimeSensor ? definition.primeSensorPositionMm / conveyorSpeedMmPerSecond : null,
    hasBackupSensor,
    backupSensorPositionMm: hasBackupSensor ? definition.backupSensorPositionMm : null,
    backupRestartPositionMm,
    backupTriggerWaitingUnits: hasBackupSensor
      ? Math.max(1, Math.ceil((usableLengthMm - definition.backupSensorPositionMm) / productPitchMm))
      : null,
    backupRestartWaitingUnits: hasBackupSensor
      ? Math.max(0, Math.floor((usableLengthMm - backupRestartPositionMm) / productPitchMm))
      : null,
    upstreamStopResponseSeconds: definition.upstreamStopResponseSeconds || 0,
    bottlesDischargedAtStop: definition.bottlesDischargedAtStop || 0,
    downstreamRampUpSeconds: definition.downstreamRampUpSeconds || 0
  };
}

function executeTicks(runtime) {
  while (runtime.virtualSecond < runtime.run.durationSeconds) {
    applyDueCommands(runtime);
    updateReliabilityFailures(runtime);
    updateMicroStops(runtime);
    advanceAccumulationZones(runtime);
    processLineFromDownstream(runtime);
    advanceEquipmentControlTimers(runtime);
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
    } else if (requiresPrime(equipment)) {
      equipment.availabilityState = 'WAITING_FOR_PRIME';
    } else if (index === 0) {
      equipment.availabilityState = 'READY';
    } else {
      equipment.availabilityState = 'STARVED';
    }
  });
}

function advanceAccumulationZones(runtime) {
  runtime.zones.forEach((zone) => {
    const remainingTransit = [];
    zone.transit.forEach((packet) => {
      if (!packet.primeDetected && zone.hasPrimeSensor && packet.primeAtVirtualSecond <= runtime.virtualSecond) {
        packet.primeDetected = true;
        triggerPrimeSensor(runtime, zone);
      }
      if (packet.arrivesAtVirtualSecond <= runtime.virtualSecond) {
        zone.waitingUnits += packet.units;
      } else {
        remainingTransit.push(packet);
      }
    });
    zone.transit = remainingTransit;
    updateBackupSensor(runtime, zone);
  });
}

function triggerPrimeSensor(runtime, zone) {
  if (zone.primeDetected) return;
  zone.primeDetected = true;
  zone.primeDetectedAtVirtualSecond = runtime.virtualSecond;
  const downstream = getEquipment(runtime, zone.downstreamControlEquipmentId);
  if (downstream) {
    downstream.primeStartAuthorized = true;
    downstream.autoStartRampDurationSeconds = zone.downstreamRampUpSeconds;
    downstream.autoStartRampElapsedSeconds = 0;
  }
  runtime.events.push({
    type: 'PRIME_SENSOR_TRIGGERED',
    atVirtualSecond: runtime.virtualSecond,
    zoneId: zone.id,
    downstreamEquipmentId: zone.downstreamControlEquipmentId,
    sensorPositionMm: zone.primeSensorPositionMm
  });
}

function updateBackupSensor(runtime, zone) {
  if (!zone.hasBackupSensor) return;
  if (!zone.backupActive && zone.waitingUnits >= zone.backupTriggerWaitingUnits) {
    zone.backupActive = true;
    zone.backupTriggeredAtVirtualSecond = runtime.virtualSecond;
    zone.backupTriggerCount += 1;
    const upstream = getEquipment(runtime, zone.upstreamControlEquipmentId);
    if (upstream) {
      upstream.backupControl = {
        zoneId: zone.id,
        active: true,
        responseRemainingSeconds: zone.upstreamStopResponseSeconds,
        residualRemainingUnits: zone.bottlesDischargedAtStop
      };
    }
    runtime.events.push({
      type: 'BACKUP_SENSOR_BLOCKED',
      atVirtualSecond: runtime.virtualSecond,
      zoneId: zone.id,
      upstreamEquipmentId: zone.upstreamControlEquipmentId,
      waitingUnits: round(zone.waitingUnits),
      thresholdUnits: round(zone.backupTriggerWaitingUnits)
    });
    return;
  }

  if (zone.backupActive && zone.waitingUnits <= zone.backupRestartWaitingUnits) {
    zone.backupActive = false;
    const upstream = getEquipment(runtime, zone.upstreamControlEquipmentId);
    if (upstream && upstream.backupControl?.zoneId === zone.id) {
      upstream.backupControl.active = false;
      upstream.backupControl = null;
    }
    runtime.events.push({
      type: 'BACKUP_SENSOR_CLEARED',
      atVirtualSecond: runtime.virtualSecond,
      zoneId: zone.id,
      upstreamEquipmentId: zone.upstreamControlEquipmentId,
      waitingUnits: round(zone.waitingUnits),
      restartThresholdUnits: round(zone.backupRestartWaitingUnits)
    });
  }
}

function advanceEquipmentControlTimers(runtime) {
  runtime.equipment.forEach((equipment) => {
    const control = equipment.backupControl;
    if (control?.active && control.responseRemainingSeconds > 0) {
      control.responseRemainingSeconds = Math.max(0, control.responseRemainingSeconds - runtime.run.tickSeconds);
      if (control.responseRemainingSeconds === 0) {
        runtime.events.push({
          type: 'BACKUP_STOP_RESPONSE_COMPLETED',
          atVirtualSecond: runtime.virtualSecond,
          equipmentId: equipment.id,
          zoneId: control.zoneId
        });
      }
    }

    if (equipment.mode === 'AUTO' && equipment.primeStartAuthorized &&
      equipment.autoStartRampElapsedSeconds < equipment.autoStartRampDurationSeconds) {
      equipment.autoStartRampElapsedSeconds = Math.min(
        equipment.autoStartRampDurationSeconds,
        equipment.autoStartRampElapsedSeconds + runtime.run.tickSeconds
      );
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
  const tickSeconds = runtime.run.tickSeconds;
  if (!isAvailable(equipment)) {
    recordUnavailable(equipment, tickSeconds);
    return;
  }

  if (requiresPrime(equipment)) {
    equipment.actualRatePerSecond = 0;
    equipment.waitingForPrimeSeconds += tickSeconds;
    equipment.availabilityState = 'WAITING_FOR_PRIME';
    return;
  }

  const control = activeBackupControl(equipment);
  if (control && control.responseRemainingSeconds <= 0 && control.residualRemainingUnits <= 0) {
    equipment.actualRatePerSecond = 0;
    equipment.backupStopSeconds += tickSeconds;
    equipment.availabilityState = 'BACKUP_STOP';
    return;
  }

  const residualDischarge = Boolean(control && control.responseRemainingSeconds <= 0 && control.residualRemainingUnits > 0);
  const requestedFlow = residualDischarge
    ? Math.min(equipment.nominalRatePerSecond * tickSeconds, control.residualRemainingUnits)
    : getRequestedFlow(equipment, tickSeconds);

  if (requestedFlow <= 0) {
    equipment.actualRatePerSecond = 0;
    equipment.availabilityState = 'RAMPING_UP';
    return;
  }

  const inputAvailable = index === 0 ? requestedFlow : runtime.zones[index - 1].waitingUnits;
  const downstreamSpace = getDownstreamSpace(runtime, index);
  const flow = Math.max(0, Math.min(requestedFlow, inputAvailable, residualDischarge ? requestedFlow : downstreamSpace));
  recordMaterialState(equipment, requestedFlow, inputAvailable, downstreamSpace, flow, tickSeconds, control, residualDischarge);
  moveFlow(runtime, index, flow, residualDischarge);
  equipment.outputCount += flow;
  equipment.actualRatePerSecond = flow / tickSeconds;

  if (residualDischarge) {
    control.residualRemainingUnits = Math.max(0, control.residualRemainingUnits - flow);
  }
}

function getRequestedFlow(equipment, tickSeconds) {
  if (equipment.mode === 'AUTO' && equipment.autoStartRampElapsedSeconds < equipment.autoStartRampDurationSeconds) {
    const rampFactor = equipment.autoStartRampDurationSeconds <= 0
      ? 1
      : equipment.autoStartRampElapsedSeconds / equipment.autoStartRampDurationSeconds;
    return equipment.nominalRatePerSecond * tickSeconds * rampFactor;
  }
  return equipment.nominalRatePerSecond * tickSeconds;
}

function getDownstreamSpace(runtime, index) {
  if (index === runtime.equipment.length - 1) return Number.POSITIVE_INFINITY;
  const zone = runtime.zones[index];
  return Math.max(0, zone.capacityUnits - getZoneInventory(zone));
}

function moveFlow(runtime, index, flow, allowOverflow) {
  if (index > 0) {
    runtime.zones[index - 1].waitingUnits = Math.max(0, runtime.zones[index - 1].waitingUnits - flow);
  }
  if (index === runtime.equipment.length - 1) {
    runtime.outputCount += flow;
    return;
  }
  addFlowToZone(runtime, runtime.zones[index], flow, allowOverflow);
}

function addFlowToZone(runtime, zone, flow, allowOverflow) {
  const availableSpace = Math.max(0, zone.capacityUnits - getZoneInventory(zone));
  const accepted = Math.min(flow, availableSpace);
  const overflow = allowOverflow ? Math.max(0, flow - accepted) : 0;

  if (accepted > 0) {
    if (zone.travelSeconds <= 0) {
      zone.waitingUnits += accepted;
      if (zone.hasPrimeSensor && !zone.primeDetected && zone.primeTravelSeconds <= 0) {
        triggerPrimeSensor(runtime, zone);
      }
    } else {
      zone.transit.push({
        units: accepted,
        primeDetected: false,
        primeAtVirtualSecond: runtime.virtualSecond + zone.primeTravelSeconds,
        arrivesAtVirtualSecond: runtime.virtualSecond + zone.travelSeconds
      });
    }
  }

  if (overflow > 0) {
    zone.overflowUnits += overflow;
    zone.overflowEvents += 1;
    runtime.events.push({
      type: 'OVERFLOW',
      atVirtualSecond: runtime.virtualSecond,
      zoneId: zone.id,
      upstreamEquipmentId: zone.upstreamControlEquipmentId,
      lostUnits: round(overflow),
      totalOverflowUnits: round(zone.overflowUnits)
    });
  }
}

function recordMaterialState(equipment, requestedFlow, inputAvailable, downstreamSpace, flow, tickSeconds, control, residualDischarge) {
  if (control) equipment.backupStopSeconds += tickSeconds;

  if (flow > 0) {
    equipment.runningSeconds += tickSeconds;
    if (control) {
      equipment.availabilityState = control.responseRemainingSeconds > 0 || residualDischarge
        ? 'BACKUP_STOPPING'
        : 'BACKUP_STOP';
    } else if (equipment.mode === 'AUTO' && equipment.autoStartRampElapsedSeconds < equipment.autoStartRampDurationSeconds) {
      equipment.availabilityState = 'RAMPING_UP';
    } else {
      equipment.availabilityState = 'RUNNING';
    }
    if (!control) recordPartialConstraintLoss(equipment, requestedFlow, inputAvailable, downstreamSpace, tickSeconds);
    return;
  }

  equipment.actualRatePerSecond = 0;
  if (control) {
    equipment.availabilityState = control.responseRemainingSeconds > 0 || residualDischarge
      ? 'BACKUP_STOPPING'
      : 'BACKUP_STOP';
    return;
  }
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
  return !equipment.emergencyStopLatched && isOperationalMode(equipment) &&
    equipment.microStopRemainingSeconds <= 0 && equipment.failureRemainingSeconds <= 0;
}

function requiresPrime(equipment) {
  return equipment.mode === 'AUTO' && equipment.primeStartAuthorized === false;
}

function activeBackupControl(equipment) {
  return equipment.backupControl?.active ? equipment.backupControl : null;
}

function getEquipment(runtime, equipmentId) {
  return runtime.equipment.find((equipment) => equipment.id === equipmentId);
}

function getZoneInventory(zone) {
  return zone.waitingUnits + sum(zone.transit.map((packet) => packet.units));
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
    buffers: runtime.zones.map((zone) => round(getZoneInventory(zone))),
    accumulationZones: runtime.zones.map(createZoneSample),
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
      emergencyStopSeconds: round(item.emergencyStopSeconds),
      waitingForPrimeSeconds: round(item.waitingForPrimeSeconds),
      backupStopSeconds: round(item.backupStopSeconds)
    }))
  });
}

function createZoneSample(zone) {
  const inventoryUnits = getZoneInventory(zone);
  return {
    id: zone.id,
    name: zone.name,
    ownerEquipmentId: zone.ownerEquipmentId,
    upstreamControlEquipmentId: zone.upstreamControlEquipmentId,
    downstreamControlEquipmentId: zone.downstreamControlEquipmentId,
    physicalModelEnabled: zone.physicalModelEnabled,
    inventoryUnits: round(inventoryUnits),
    waitingUnits: round(zone.waitingUnits),
    inTransitUnits: round(sum(zone.transit.map((packet) => packet.units))),
    capacityUnits: round(zone.capacityUnits),
    fillPercent: zone.capacityUnits > 0 ? round(inventoryUnits / zone.capacityUnits * 100) : 0,
    prime: {
      configured: zone.hasPrimeSensor,
      state: zone.primeDetected ? 'DETECTED' : 'CLEAR',
      positionMm: zone.primeSensorPositionMm,
      detectedAtVirtualSecond: zone.primeDetectedAtVirtualSecond
    },
    backup: {
      configured: zone.hasBackupSensor,
      state: zone.backupActive ? 'BLOCKED' : 'CLEAR',
      positionMm: zone.backupSensorPositionMm,
      restartPositionMm: zone.backupRestartPositionMm,
      thresholdUnits: zone.backupTriggerWaitingUnits,
      restartThresholdUnits: zone.backupRestartWaitingUnits,
      triggerCount: zone.backupTriggerCount
    },
    overflowUnits: round(zone.overflowUnits),
    overflowEvents: zone.overflowEvents,
    state: zone.overflowUnits > 0
      ? 'OVERFLOW'
      : zone.backupActive
        ? 'BACKUP_ACTIVE'
        : inventoryUnits > 0
          ? 'FLOWING'
          : 'EMPTY'
  };
}

function createResult(runtime) {
  return {
    caseId: runtime.caseId,
    unitOfFlow: runtime.unitOfFlow,
    engineVersion: '0.5.0',
    seed: runtime.run.seed,
    durationSeconds: runtime.run.durationSeconds,
    summary: createSummary(runtime),
    equipmentMetrics: Object.fromEntries(runtime.equipment.map((item) => [item.id, createEquipmentMetrics(item, runtime.run.durationSeconds)])),
    accumulationZoneMetrics: Object.fromEntries(runtime.zones.map((zone) => [zone.id, createZoneMetrics(zone)])),
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
    totalEmergencyStopSeconds: round(sum(runtime.equipment.map((item) => item.emergencyStopSeconds))),
    totalBackupStopSeconds: round(sum(runtime.equipment.map((item) => item.backupStopSeconds))),
    totalOverflowUnits: round(sum(runtime.zones.map((zone) => zone.overflowUnits)))
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
    waitingForPrimeSeconds: round(equipment.waitingForPrimeSeconds),
    backupStopSeconds: round(equipment.backupStopSeconds),
    availability: round(Math.max(0, 1 - equipment.stoppedSeconds / durationSeconds))
  };
}

function createZoneMetrics(zone) {
  return {
    capacityUnits: round(zone.capacityUnits),
    finalInventoryUnits: round(getZoneInventory(zone)),
    finalWaitingUnits: round(zone.waitingUnits),
    finalInTransitUnits: round(sum(zone.transit.map((packet) => packet.units))),
    overflowUnits: round(zone.overflowUnits),
    overflowEvents: zone.overflowEvents,
    backupTriggerCount: zone.backupTriggerCount,
    primeDetected: zone.primeDetected
  };
}

function sortCommands(commands) {
  return [...commands].sort((a, b) => a.atVirtualSecond - b.atVirtualSecond);
}
function isSupportedAction(action) {
  return ['RUN', 'PAUSE', 'STOP', 'MANUAL', 'AUTO', 'EMERGENCY_STOP', 'RESET'].includes(action);
}
function isOperationalMode(equipment) {
  return equipment.mode === 'AUTO' || equipment.mode === 'MANUAL';
}
function randomDuration(random, profile) {
  const min = profile.minDurationSeconds || 0;
  const max = profile.maxDurationSeconds ?? min;
  return min + (max - min) * random.next();
}
function randomExponentialSeconds(random, meanSeconds) {
  return -Math.log(1 - Math.max(random.next(), 1e-12)) * meanSeconds;
}
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
function round(value) {
  return Number(value.toFixed(6));
}
