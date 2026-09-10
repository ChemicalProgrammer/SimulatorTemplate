export function resolveAccumulationZoneDefinition(allEquipment, ownerIndex) {
  const equipment = Array.isArray(allEquipment) ? allEquipment : [];
  const owner = equipment[ownerIndex];
  if (!owner) {
    return { definition: undefined, origin: 'NONE', sources: {}, assumptions: [] };
  }

  if (isConveyorEquipment(owner)) {
    return resolveConveyorZone(equipment, owner, ownerIndex);
  }

  const next = equipment[ownerIndex + 1];
  if (isConveyorEquipment(next)) {
    return {
      definition: {
        kind: 'INTERNAL_HANDOFF',
        id: owner.id + '--handoff--' + next.id,
        name: owner.name + ' handoff to ' + next.name,
        upstreamControlEquipmentId: owner.id,
        downstreamControlEquipmentId: next.id
      },
      origin: 'INTERNAL_HANDOFF',
      sources: {},
      assumptions: ['Internal handoff: no abstract buffer is modeled between a machine and its following conveyor.']
    };
  }

  return { definition: undefined, origin: 'NONE', sources: {}, assumptions: [] };
}

export function isConveyorEquipment(equipment) {
  return Boolean(equipment && (equipment.type === 'CONVEYOR' || equipment.processData?.role === 'CONVEYOR'));
}

export function hasFormatAccumulationData(equipment) {
  return Boolean(equipment?.processData?.accumulation &&
    typeof equipment.processData.accumulation === 'object' &&
    !Array.isArray(equipment.processData.accumulation));
}

function resolveConveyorZone(equipment, owner, ownerIndex) {
  const format = owner.processData?.accumulation || {};
  const upstreamControl = findNearestNonConveyor(equipment, ownerIndex - 1, -1);
  const downstreamControl = findNearestNonConveyor(equipment, ownerIndex + 1, 1);
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
  const pitch = selectValue([
    explicitPitch,
    sourceValue(
      sumNumericValues(productLength.value, gap.value),
      productLength.source && gap.source ? productLength.source + ' + ' + gap.source : undefined
    )
  ]);
  const conveyorSpeed = selectValue([
    sourceValue(format.conveyorSpeedMmPerSecond, 'processData.accumulation.conveyorSpeedMmPerSecond')
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

  const definition = {
    kind: 'FORMAT_GEOMETRY',
    id: format.id || owner.id + '--physical-zone',
    name: format.name || (owner.name || owner.id) + ' accumulation',
    upstreamControlEquipmentId: upstreamControl?.id,
    downstreamControlEquipmentId: downstreamControl?.id
  };
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

  return {
    definition,
    origin: 'FORMAT_GEOMETRY',
    sources,
    assumptions: [
      'This conveyor always uses its named physical geometry.',
      'Prime and Back-up positions are explicit; LACT and LP Prime are not inferred.',
      'The upstream and downstream controlled equipment are inferred from the line sequence.'
    ]
  };
}

function findNearestNonConveyor(equipment, startIndex, direction) {
  for (let index = startIndex; index >= 0 && index < equipment.length; index += direction) {
    const candidate = equipment[index];
    if (candidate && !isConveyorEquipment(candidate)) return candidate;
  }
  return undefined;
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
