export function validateSimulationInput(input) {
  const details = [];
  validateCase(input?.case, details);
  validateRun(input?.run, details);
  validateCommands(input?.run?.commands, input?.case?.equipment, details);

  return details.length === 0
    ? { ok: true }
    : {
        ok: false,
        error: {
          code: 'INVALID_SIMULATION_INPUT',
          message: 'The simulation input does not satisfy the required contract.',
          details
        }
      };
}

function validateCase(caseModel, details) {
  if (!caseModel || typeof caseModel !== 'object') {
    details.push(required('case'));
    return;
  }

  if (!Array.isArray(caseModel.equipment) || caseModel.equipment.length < 2) {
    details.push(invalid('case.equipment', 'must contain at least two equipment units'));
    return;
  }

  const ids = new Set();
  caseModel.equipment.forEach((equipment, index) => {
    const path = 'case.equipment[' + index + ']';
    if (!equipment || typeof equipment !== 'object') {
      details.push(invalid(path, 'must be an object'));
      return;
    }
    if (!nonEmptyString(equipment.id)) details.push(required(path + '.id'));
    if (ids.has(equipment.id)) details.push(invalid(path + '.id', 'must be unique'));
    ids.add(equipment.id);
    if (!positiveNumber(equipment.nominalRatePerSecond)) {
      details.push(invalid(path + '.nominalRatePerSecond', 'must be a number greater than zero'));
    }
    if (equipment.bufferAfterCapacity !== undefined && !nonNegativeNumber(equipment.bufferAfterCapacity)) {
      details.push(invalid(path + '.bufferAfterCapacity', 'must be a number greater than or equal to zero'));
    }
    if (equipment.accumulationZone === undefined && !nonNegativeNumber(equipment.bufferAfterCapacity)) {
      details.push(required(path + '.bufferAfterCapacity'));
    }
    if (!['AUTO', 'MANUAL', 'PAUSE', 'STOP'].includes(equipment.initialMode)) {
      details.push(invalid(path + '.initialMode', 'must be AUTO, MANUAL, PAUSE, or STOP'));
    }
    validateNoiseProfile(equipment.noiseProfile, path, details);
  });

  caseModel.equipment.forEach((equipment, index) => {
    if (equipment && typeof equipment === 'object') {
      validateAccumulationZone(equipment.accumulationZone, 'case.equipment[' + index + '].accumulationZone', ids, details);
    }
  });
}

function validateAccumulationZone(zone, path, equipmentIds, details) {
  if (zone === undefined) return;
  if (!zone || typeof zone !== 'object' || Array.isArray(zone)) {
    details.push(invalid(path, 'must be an object'));
    return;
  }

  if (!positiveNumber(zone.usableLengthMm)) {
    details.push(invalid(path + '.usableLengthMm', 'must be a number greater than zero'));
  }

  const hasExplicitPitch = positiveNumber(zone.productPitchMm);
  const hasLengthAndGap = positiveNumber(zone.productLengthMm) && nonNegativeNumber(zone.gapMm);
  if (!hasExplicitPitch && !hasLengthAndGap) {
    details.push(invalid(path, 'requires productPitchMm or productLengthMm plus gapMm'));
  }

  const productPitchMm = hasExplicitPitch
    ? zone.productPitchMm
    : hasLengthAndGap
      ? zone.productLengthMm + zone.gapMm
      : null;
  if (positiveNumber(zone.usableLengthMm) && positiveNumber(productPitchMm) &&
      Math.floor(zone.usableLengthMm / productPitchMm) < 1) {
    details.push(invalid(path, 'usableLengthMm must hold at least one product pitch'));
  }

  if (!positiveNumber(zone.conveyorSpeedMmPerSecond)) {
    details.push(invalid(path + '.conveyorSpeedMmPerSecond', 'must be a number greater than zero'));
  }

  validateSensorPosition(zone.primeSensorPositionMm, path + '.primeSensorPositionMm', zone.usableLengthMm, details);
  const backupDeclared = zone.backupSensorPositionMm !== undefined || zone.backupRestartPositionMm !== undefined;
  if (backupDeclared) {
    validateSensorPosition(zone.backupSensorPositionMm, path + '.backupSensorPositionMm', zone.usableLengthMm, details);
    validateSensorPosition(zone.backupRestartPositionMm, path + '.backupRestartPositionMm', zone.usableLengthMm, details);
    if (nonNegativeNumber(zone.backupSensorPositionMm) && nonNegativeNumber(zone.backupRestartPositionMm) &&
        zone.backupRestartPositionMm < zone.backupSensorPositionMm) {
      details.push(invalid(path + '.backupRestartPositionMm', 'must be at or downstream of backupSensorPositionMm'));
    }
  }

  if (zone.upstreamStopResponseSeconds !== undefined && !nonNegativeNumber(zone.upstreamStopResponseSeconds)) {
    details.push(invalid(path + '.upstreamStopResponseSeconds', 'must be a number greater than or equal to zero'));
  }
  if (zone.bottlesDischargedAtStop !== undefined && !nonNegativeNumber(zone.bottlesDischargedAtStop)) {
    details.push(invalid(path + '.bottlesDischargedAtStop', 'must be a number greater than or equal to zero'));
  }
  if (zone.downstreamRampUpSeconds !== undefined && !nonNegativeNumber(zone.downstreamRampUpSeconds)) {
    details.push(invalid(path + '.downstreamRampUpSeconds', 'must be a number greater than or equal to zero'));
  }

  validateEquipmentReference(zone.upstreamControlEquipmentId, path + '.upstreamControlEquipmentId', equipmentIds, details);
  validateEquipmentReference(zone.downstreamControlEquipmentId, path + '.downstreamControlEquipmentId', equipmentIds, details);
}

function validateSensorPosition(value, path, usableLengthMm, details) {
  if (value === undefined) return;
  if (!nonNegativeNumber(value)) {
    details.push(invalid(path, 'must be a number greater than or equal to zero'));
  } else if (positiveNumber(usableLengthMm) && value > usableLengthMm) {
    details.push(invalid(path, 'must be within usableLengthMm'));
  }
}

function validateEquipmentReference(value, path, equipmentIds, details) {
  if (value === undefined) return;
  if (!nonEmptyString(value) || !equipmentIds.has(value)) {
    details.push(invalid(path, 'must reference an equipment unit in case.equipment'));
  }
}

function validateRun(run, details) {
  if (!run || typeof run !== 'object') {
    details.push(required('run'));
    return;
  }
  if (!positiveNumber(run.durationSeconds)) details.push(invalid('run.durationSeconds', 'must be a number greater than zero'));
  if (!positiveNumber(run.tickSeconds)) details.push(invalid('run.tickSeconds', 'must be a number greater than zero'));
  if (!Number.isInteger(run.seed)) details.push(invalid('run.seed', 'must be an integer'));
  if (run.sampleEverySeconds !== undefined && !positiveNumber(run.sampleEverySeconds)) {
    details.push(invalid('run.sampleEverySeconds', 'must be a number greater than zero'));
  }
}

function validateCommands(commands, equipment, details) {
  if (commands === undefined) return;
  if (!Array.isArray(commands)) {
    details.push(invalid('run.commands', 'must be an array'));
    return;
  }

  const equipmentIds = new Set(Array.isArray(equipment) ? equipment.map((item) => item?.id) : []);
  commands.forEach((command, index) => {
    const path = 'run.commands[' + index + ']';
    if (!command || typeof command !== 'object') {
      details.push(invalid(path, 'must be an object'));
      return;
    }
    if (!nonNegativeNumber(command.atVirtualSecond)) {
      details.push(invalid(path + '.atVirtualSecond', 'must be a number greater than or equal to zero'));
    }
    if (!equipmentIds.has(command.equipmentId)) {
      details.push(invalid(path + '.equipmentId', 'must reference an equipment unit in case.equipment'));
    }
    if (!['RUN', 'PAUSE', 'STOP', 'MANUAL', 'AUTO', 'EMERGENCY_STOP', 'RESET'].includes(command.action)) {
      details.push(invalid(path + '.action', 'is not supported'));
    }
  });
}

function validateNoiseProfile(noiseProfile, equipmentPath, details) {
  if (noiseProfile === undefined) return;
  if (!noiseProfile || typeof noiseProfile !== 'object' || Array.isArray(noiseProfile)) {
    details.push(invalid(equipmentPath + '.noiseProfile', 'must be an object'));
    return;
  }
  if (noiseProfile.microStop !== undefined) validateMicroStop(noiseProfile.microStop, equipmentPath, details);
  if (noiseProfile.reliability !== undefined) validateReliability(noiseProfile.reliability, equipmentPath, details);
}

function validateMicroStop(microStop, equipmentPath, details) {
  const path = equipmentPath + '.noiseProfile.microStop';
  if (!microStop || typeof microStop !== 'object' || Array.isArray(microStop)) {
    details.push(invalid(path, 'must be an object'));
    return;
  }
  if (microStop.probabilityPerMinute !== undefined && !nonNegativeNumber(microStop.probabilityPerMinute)) {
    details.push(invalid(path + '.probabilityPerMinute', 'must be a number greater than or equal to zero'));
  }
  if (microStop.minDurationSeconds !== undefined && !nonNegativeNumber(microStop.minDurationSeconds)) {
    details.push(invalid(path + '.minDurationSeconds', 'must be a number greater than or equal to zero'));
  }
  if (microStop.maxDurationSeconds !== undefined && !nonNegativeNumber(microStop.maxDurationSeconds)) {
    details.push(invalid(path + '.maxDurationSeconds', 'must be a number greater than or equal to zero'));
  }
  if (nonNegativeNumber(microStop.minDurationSeconds) && nonNegativeNumber(microStop.maxDurationSeconds) &&
      microStop.minDurationSeconds > microStop.maxDurationSeconds) {
    details.push(invalid(path + '.maxDurationSeconds', 'must be greater than or equal to minDurationSeconds'));
  }
}

function validateReliability(reliability, equipmentPath, details) {
  const path = equipmentPath + '.noiseProfile.reliability';
  if (!reliability || typeof reliability !== 'object' || Array.isArray(reliability)) {
    details.push(invalid(path, 'must be an object'));
    return;
  }
  if (!positiveNumber(reliability.mtbfMinutes)) {
    details.push(invalid(path + '.mtbfMinutes', 'must be a number greater than zero'));
  }
  if (!positiveNumber(reliability.mttrMinutes)) {
    details.push(invalid(path + '.mttrMinutes', 'must be a number greater than zero'));
  }
}

function required(path) { return { path, reason: 'is required' }; }
function invalid(path, reason) { return { path, reason }; }
function positiveNumber(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function nonNegativeNumber(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function nonEmptyString(value) { return typeof value === 'string' && value.length > 0; }
