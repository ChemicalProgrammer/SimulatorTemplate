export function resolveAccumulationZoneDefinition(allEquipment, ownerIndex) {
  const equipment = Array.isArray(allEquipment) ? allEquipment : [];
  const owner = equipment[ownerIndex];
  if (!owner) {
    return { definition: undefined, origin: 'NONE', sources: {}, assumptions: [] };
  }

  if (owner.accumulationZone !== undefined) {
    return {
      definition: owner.accumulationZone,
      origin: 'EXPLICIT_ZONE',
      sources: {},
      assumptions: ['Explicit accumulationZone JSON takes precedence over format-derived values.']
    };
  }

  const format = owner.processData?.accumulation;
  if (!hasDefinedFormatValue(format)) {
    return { definition: undefined, origin: 'NONE', sources: {}, assumptions: [] };
  }

  const nearestUpstream = findNearestCriticalEquipment(equipment, ownerIndex - 1, -1);
  const nearestDownstream = findNearestCriticalEquipment(equipment, ownerIndex + 1, 1) || equipment[ownerIndex + 1];
  const upstreamControl = findEquipmentById(equipment, format.upstreamControlEquipmentId) || nearestUpstream || owner;
  const downstreamControl = findEquipmentById(equipment, format.downstreamControlEquipmentId) || nearestDownstream;
  const sources = {};

  const usableLength = selectValue([
    sourceValue(format.usableLengthMm, 'processData.accumulation.usableLengthMm')
  ]);
  const productLength = selectValue([
    sourceValue(format.productLengthMm, 'processData.accumulation.productLengthMm'),
    sourceValue(owner.processData?.upstream?.packageLengthMm, 'processData.upstream.packageLengthMm')
  ]);
  const gap = selectValue([
    sourceValue(format.gapMm, 'processData.accumulation.gapMm')
  ]);
  const explicitPitch = selectValue([
    sourceValue(format.productPitchMm, 'processData.accumulation.productPitchMm')
  ]);
  const derivedLengthAndGapPitch = sumNumericValues(productLength.value, gap.value);
  const pitch = selectValue([
    explicitPitch,
    sourceValue(
      derivedLengthAndGapPitch,
      productLength.source && gap.source
        ? productLength.source + ' + ' + gap.source
        : undefined
    ),
    sourceValue(owner.processData?.upstream?.dischargePitchMm, 'processData.upstream.dischargePitchMm')
  ]);
  const speedFactor = selectValue([
    sourceValue(format.conveyorSpeedFactorPercent, 'processData.accumulation.conveyorSpeedFactorPercent'),
    sourceValue(
      owner.processData?.speedAndSensors?.conveyorSpeedFactorVsDischargeVelocityPercent,
      'processData.speedAndSensors.conveyorSpeedFactorVsDischargeVelocityPercent'
    )
  ]);
  const derivedConveyorSpeed = multiplyNumericValues(
    upstreamControl?.nominalRatePerSecond,
    pitch.value,
    speedFactor.value,
    0.01
  );
  const conveyorSpeed = selectValue([
    sourceValue(format.conveyorSpeedMmPerSecond, 'processData.accumulation.conveyorSpeedMmPerSecond'),
    sourceValue(
      derivedConveyorSpeed,
      derivedConveyorSpeed === undefined
        ? undefined
        : 'upstream nominal rate × product pitch × conveyor speed factor'
    )
  ]);
  const primeSensor = selectValue([
    sourceValue(format.primeSensorPositionMm, 'processData.accumulation.primeSensorPositionMm')
  ]);
  const backupSensor = selectValue([
    sourceValue(format.backupSensorPositionMm, 'processData.accumulation.backupSensorPositionMm')
  ]);
  const backupRestart = selectValue([
    sourceValue(format.backupRestartPositionMm, 'processData.accumulation.backupRestartPositionMm')
  ]);
  const upstreamStopResponse = selectValue([
    sourceValue(format.upstreamStopResponseSeconds, 'processData.accumulation.upstreamStopResponseSeconds')
  ]);
  const bottlesDischargedAtStop = selectValue([
    sourceValue(format.bottlesDischargedAtStop, 'processData.accumulation.bottlesDischargedAtStop'),
    sourceValue(
      upstreamControl?.processData?.upstream?.bottlesDischargedAtStop,
      'upstream processData.upstream.bottlesDischargedAtStop'
    )
  ]);
  const downstreamRampUp = selectValue([
    sourceValue(format.downstreamRampUpSeconds, 'processData.accumulation.downstreamRampUpSeconds'),
    sourceValue(
      downstreamControl?.processData?.downstream?.rampUpTimeSeconds,
      'downstream processData.downstream.rampUpTimeSeconds'
    )
  ]);
  const upstreamRestartDelay = selectValue([
    sourceValue(format.upstreamRestartDelaySeconds, 'processData.accumulation.upstreamRestartDelaySeconds')
  ]);
  const upstreamRestartRamp = selectValue([
    sourceValue(format.upstreamRestartRampUpSeconds, 'processData.accumulation.upstreamRestartRampUpSeconds')
  ]);

  const definition = {};
  assignIfDefined(definition, 'id', format.id || owner.id + '--format-zone');
  assignIfDefined(definition, 'name', format.name || (owner.name || owner.id) + ' accumulation');
  assignIfDefined(definition, 'usableLengthMm', usableLength.value, sources, usableLength.source);
  assignIfDefined(definition, 'productLengthMm', productLength.value, sources, productLength.source);
  assignIfDefined(definition, 'gapMm', gap.value, sources, gap.source);
  assignIfDefined(definition, 'productPitchMm', pitch.value, sources, pitch.source);
  assignIfDefined(definition, 'conveyorSpeedMmPerSecond', conveyorSpeed.value, sources, conveyorSpeed.source);
  assignIfDefined(definition, 'primeSensorPositionMm', primeSensor.value, sources, primeSensor.source);
  assignIfDefined(definition, 'backupSensorPositionMm', backupSensor.value, sources, backupSensor.source);
  assignIfDefined(definition, 'backupRestartPositionMm', backupRestart.value, sources, backupRestart.source);
  assignIfDefined(definition, 'upstreamStopResponseSeconds', upstreamStopResponse.value, sources, upstreamStopResponse.source);
  assignIfDefined(definition, 'bottlesDischargedAtStop', bottlesDischargedAtStop.value, sources, bottlesDischargedAtStop.source);
  assignIfDefined(definition, 'downstreamRampUpSeconds', downstreamRampUp.value, sources, downstreamRampUp.source);
  assignIfDefined(definition, 'upstreamRestartDelaySeconds', upstreamRestartDelay.value, sources, upstreamRestartDelay.source);
  assignIfDefined(definition, 'upstreamRestartRampUpSeconds', upstreamRestartRamp.value, sources, upstreamRestartRamp.source);
  assignIfDefined(definition, 'upstreamControlEquipmentId', format.upstreamControlEquipmentId || upstreamControl?.id);
  assignIfDefined(definition, 'downstreamControlEquipmentId', format.downstreamControlEquipmentId || downstreamControl?.id);

  return {
    definition,
    origin: 'FORMAT_DERIVED',
    sources,
    assumptions: [
      'LACT and LP Prime are not inferred.',
      'Prime and Back-up positions must be configured explicitly in processData.accumulation.',
      conveyorSpeed.source === 'upstream nominal rate × product pitch × conveyor speed factor'
        ? 'Conveyor speed was derived from nominal upstream rate, pitch, and speed factor.'
        : 'Conveyor speed was provided explicitly.'
    ]
  };
}

export function hasFormatAccumulationData(equipment) {
  return hasDefinedFormatValue(equipment?.processData?.accumulation);
}

function findNearestCriticalEquipment(equipment, startIndex, direction) {
  for (let index = startIndex; index >= 0 && index < equipment.length; index += direction) {
    const candidate = equipment[index];
    if (candidate && candidate.type !== 'CONVEYOR' && candidate.processData?.role !== 'CONVEYOR') {
      return candidate;
    }
  }
  return undefined;
}

function findEquipmentById(equipment, equipmentId) {
  if (!isFormatNonEmptyString(equipmentId)) return undefined;
  return equipment.find((candidate) => candidate?.id === equipmentId);
}

function hasDefinedFormatValue(format) {
  return Boolean(format && typeof format === 'object' && !Array.isArray(format) &&
    Object.keys(format).some((key) => isDefined(format[key])));
}

function selectValue(candidates) {
  for (const candidate of candidates) {
    if (candidate && isDefined(candidate.value)) return candidate;
  }
  return { value: undefined, source: undefined };
}

function sourceValue(value, source) {
  return { value, source };
}

function sumNumericValues(left, right) {
  return isFiniteNumber(left) && isFiniteNumber(right) ? left + right : undefined;
}

function multiplyNumericValues(...values) {
  return values.every(isFiniteNumber)
    ? values.reduce((total, value) => total * value, 1)
    : undefined;
}

function assignIfDefined(target, key, value, sources, source) {
  if (!isDefined(value)) return;
  target[key] = value;
  if (sources && source) sources[key] = source;
}

function isDefined(value) {
  return value !== undefined && value !== null;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFormatNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}
