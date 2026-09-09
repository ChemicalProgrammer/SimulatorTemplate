function createPublicDemoCaseRequest_() {
  var suffix = new Date().getTime().toString();
  var equipment = [
      createPublicLineUnit_({ id: 'blowmolder-1', type: 'BLOWMOLDER', name: 'Blowmolder', role: 'CRITICAL_MACHINE', nominalRateBpm: 420, maximumSpeedBpm: 450, bufferAfterCapacity: 840, bufferMinutes: 2, mtbfMinutes: 720, mttrMinutes: 15, actualDischargeMm: 85, actualCodingMm: 85, packageLengthMm: 66, dischargePitchMm: 85, startupTimeSeconds: 8, bottlesDischargedAtStop: 4, infeedPitchMm: 88, rampUpTimeSeconds: 10, dischargeFactorPercent: 100, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.08, microStopMinSeconds: 3, microStopMaxSeconds: 8 }),
      createPublicLineUnit_({ id: 'conveyor-1', type: 'CONVEYOR', name: 'Blowmolder discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 480, maximumSpeedBpm: 500, bufferAfterCapacity: 720, bufferMinutes: 1.5, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 88, actualCodingMm: 88, packageLengthMm: 66, dischargePitchMm: 88, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 88, rampUpTimeSeconds: 5, dischargeFactorPercent: 108, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'pucker-1', type: 'PUCKER', name: 'Pucker', role: 'CRITICAL_MACHINE', nominalRateBpm: 415, maximumSpeedBpm: 430, bufferAfterCapacity: 600, bufferMinutes: 1.45, mtbfMinutes: 960, mttrMinutes: 10, actualDischargeMm: 90, actualCodingMm: 90, packageLengthMm: 66, dischargePitchMm: 90, startupTimeSeconds: 7, bottlesDischargedAtStop: 3, infeedPitchMm: 90, rampUpTimeSeconds: 8, dischargeFactorPercent: 102, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.1, microStopMinSeconds: 3, microStopMaxSeconds: 9 }),
      createPublicLineUnit_({ id: 'conveyor-2', type: 'CONVEYOR', name: 'Pucker discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 480, maximumSpeedBpm: 500, bufferAfterCapacity: 720, bufferMinutes: 1.5, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 90, actualCodingMm: 90, packageLengthMm: 66, dischargePitchMm: 90, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 90, rampUpTimeSeconds: 5, dischargeFactorPercent: 106, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'filler-1', type: 'FILLER', name: 'Filler', role: 'CRITICAL_MACHINE', nominalRateBpm: 400, maximumSpeedBpm: 420, bufferAfterCapacity: 1200, bufferMinutes: 3, mtbfMinutes: 600, mttrMinutes: 20, actualDischargeMm: 92, actualCodingMm: 92, packageLengthMm: 66, dischargePitchMm: 92, startupTimeSeconds: 12, bottlesDischargedAtStop: 6, infeedPitchMm: 92, rampUpTimeSeconds: 15, dischargeFactorPercent: 100, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.12, microStopMinSeconds: 4, microStopMaxSeconds: 12 }),
      createPublicLineUnit_({ id: 'conveyor-3', type: 'CONVEYOR', name: 'Filler discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 480, maximumSpeedBpm: 500, bufferAfterCapacity: 800, bufferMinutes: 1.67, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 92, actualCodingMm: 92, packageLengthMm: 66, dischargePitchMm: 92, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 92, rampUpTimeSeconds: 5, dischargeFactorPercent: 108, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'depucker-1', type: 'DEPUCKER', name: 'De-pucker', role: 'CRITICAL_MACHINE', nominalRateBpm: 410, maximumSpeedBpm: 430, bufferAfterCapacity: 650, bufferMinutes: 1.59, mtbfMinutes: 1000, mttrMinutes: 8, actualDischargeMm: 92, actualCodingMm: 92, packageLengthMm: 66, dischargePitchMm: 92, startupTimeSeconds: 7, bottlesDischargedAtStop: 3, infeedPitchMm: 92, rampUpTimeSeconds: 8, dischargeFactorPercent: 102, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.1, microStopMinSeconds: 3, microStopMaxSeconds: 9 }),
      createPublicLineUnit_({ id: 'conveyor-4', type: 'CONVEYOR', name: 'De-pucker discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 480, maximumSpeedBpm: 500, bufferAfterCapacity: 900, bufferMinutes: 1.88, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 92, actualCodingMm: 92, packageLengthMm: 66, dischargePitchMm: 92, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 92, rampUpTimeSeconds: 5, dischargeFactorPercent: 108, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'sleever-1', type: 'SLEEVER', name: 'Sleever', role: 'CRITICAL_MACHINE', nominalRateBpm: 390, maximumSpeedBpm: 400, bufferAfterCapacity: 700, bufferMinutes: 1.79, mtbfMinutes: 480, mttrMinutes: 15, actualDischargeMm: 94, actualCodingMm: 94, packageLengthMm: 66, dischargePitchMm: 94, startupTimeSeconds: 10, bottlesDischargedAtStop: 4, infeedPitchMm: 94, rampUpTimeSeconds: 12, dischargeFactorPercent: 101, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.14, microStopMinSeconds: 4, microStopMaxSeconds: 12 }),
      createPublicLineUnit_({ id: 'conveyor-5', type: 'CONVEYOR', name: 'Sleever discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 450, maximumSpeedBpm: 470, bufferAfterCapacity: 800, bufferMinutes: 1.78, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 94, actualCodingMm: 94, packageLengthMm: 66, dischargePitchMm: 94, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 94, rampUpTimeSeconds: 5, dischargeFactorPercent: 106, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'case-packer-1', type: 'CASE_PACKER', name: 'Case packer', role: 'CRITICAL_MACHINE', nominalRateBpm: 385, maximumSpeedBpm: 400, bufferAfterCapacity: 720, bufferMinutes: 1.87, mtbfMinutes: 720, mttrMinutes: 12, actualDischargeMm: 96, actualCodingMm: 96, packageLengthMm: 66, dischargePitchMm: 96, startupTimeSeconds: 10, bottlesDischargedAtStop: 4, infeedPitchMm: 96, rampUpTimeSeconds: 12, dischargeFactorPercent: 100, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.14, microStopMinSeconds: 4, microStopMaxSeconds: 12 }),
      createPublicLineUnit_({ id: 'conveyor-6', type: 'CONVEYOR', name: 'Case packer discharge conveyor', role: 'CONVEYOR', nominalRateBpm: 430, maximumSpeedBpm: 450, bufferAfterCapacity: 600, bufferMinutes: 1.4, mtbfMinutes: 1440, mttrMinutes: 5, actualDischargeMm: 96, actualCodingMm: 96, packageLengthMm: 66, dischargePitchMm: 96, startupTimeSeconds: 4, bottlesDischargedAtStop: 2, infeedPitchMm: 96, rampUpTimeSeconds: 5, dischargeFactorPercent: 106, codingFactorPercent: 102, microStopProbabilityPerMinute: 0.04, microStopMinSeconds: 2, microStopMaxSeconds: 5 }),
      createPublicLineUnit_({ id: 'palletizer-1', type: 'PALLETIZER', name: 'Palletizer', role: 'CRITICAL_MACHINE', nominalRateBpm: 380, maximumSpeedBpm: 400, bufferAfterCapacity: 0, bufferMinutes: 0, mtbfMinutes: 960, mttrMinutes: 20, actualDischargeMm: 96, actualCodingMm: 96, packageLengthMm: 66, dischargePitchMm: 96, startupTimeSeconds: 12, bottlesDischargedAtStop: 3, infeedPitchMm: 96, rampUpTimeSeconds: 15, dischargeFactorPercent: 100, codingFactorPercent: 100, microStopProbabilityPerMinute: 0.1, microStopMinSeconds: 4, microStopMaxSeconds: 10 })
  ];

  configurePublicAccumulationZones_(equipment);

  return {
    id: 'public-demo-packaging-line-' + suffix,
    name: 'Public demo — 13-step packaging line',
    unitOfFlow: 'equivalent bottles',
    metadata: createPublicDemoMetadata_(),
    engineConfig: {
      modelMode: 'PUBLIC_DEMONSTRATION_EQUIVALENT_BOTTLES',
      designThroughputBottlesPerHour: 24000,
      packConfiguration: { bottlesPerCase: 12, casesPerLayer: 10, layersPerPallet: 6 },
      reliabilityModel: 'Seeded exponential time-to-failure with fixed MTTR repair duration',
      accumulationControlModel: 'Synthetic physical conveyor zones with Prime and Back-up photocell logic'
    },
    equipment: equipment
  };
}

function configurePublicAccumulationZones_(equipment) {
  equipment.forEach(function(unit) {
    if (unit.processData.role !== 'CONVEYOR' && unit.type !== 'PALLETIZER') {
      unit.bufferAfterCapacity = Math.max(12, Math.ceil(unit.nominalRatePerSecond * 3));
      unit.characteristics.transferBufferNote = 'Synthetic three-second transfer handoff; public demo accumulation is modeled on the conveyor zones.';
    }
  });

  setPublicAccumulationZone_(equipment, 'conveyor-1', {
    id: 'zone-blowmolder-to-pucker',
    name: 'Blowmolder discharge accumulation',
    upstreamControlEquipmentId: 'blowmolder-1',
    downstreamControlEquipmentId: 'pucker-1',
    usableLengthMm: 20000,
    productLengthMm: 66,
    gapMm: 22,
    productPitchMm: 88,
    conveyorSpeedMmPerSecond: 760,
    primeSensorPositionMm: 18000,
    backupSensorPositionMm: 7000,
    backupRestartPositionMm: 9500,
    upstreamStopResponseSeconds: 1,
    bottlesDischargedAtStop: 4,
    downstreamRampUpSeconds: 8
  });
  setPublicAccumulationZone_(equipment, 'conveyor-2', {
    id: 'zone-pucker-to-filler',
    name: 'Pucker discharge accumulation',
    upstreamControlEquipmentId: 'pucker-1',
    downstreamControlEquipmentId: 'filler-1',
    usableLengthMm: 20000,
    productLengthMm: 66,
    gapMm: 24,
    productPitchMm: 90,
    conveyorSpeedMmPerSecond: 763,
    primeSensorPositionMm: 18000,
    backupSensorPositionMm: 7000,
    backupRestartPositionMm: 9500,
    upstreamStopResponseSeconds: 1,
    bottlesDischargedAtStop: 3,
    downstreamRampUpSeconds: 15
  });
  setPublicAccumulationZone_(equipment, 'conveyor-3', {
    id: 'zone-filler-to-depucker',
    name: 'Filler discharge accumulation',
    upstreamControlEquipmentId: 'filler-1',
    downstreamControlEquipmentId: 'depucker-1',
    usableLengthMm: 24000,
    productLengthMm: 66,
    gapMm: 26,
    productPitchMm: 92,
    conveyorSpeedMmPerSecond: 795,
    primeSensorPositionMm: 21500,
    backupSensorPositionMm: 8000,
    backupRestartPositionMm: 11000,
    upstreamStopResponseSeconds: 2,
    bottlesDischargedAtStop: 6,
    downstreamRampUpSeconds: 8
  });
  setPublicAccumulationZone_(equipment, 'conveyor-4', {
    id: 'zone-depucker-to-sleever',
    name: 'De-pucker discharge accumulation',
    upstreamControlEquipmentId: 'depucker-1',
    downstreamControlEquipmentId: 'sleever-1',
    usableLengthMm: 24000,
    productLengthMm: 66,
    gapMm: 26,
    productPitchMm: 92,
    conveyorSpeedMmPerSecond: 795,
    primeSensorPositionMm: 21500,
    backupSensorPositionMm: 8000,
    backupRestartPositionMm: 11000,
    upstreamStopResponseSeconds: 1,
    bottlesDischargedAtStop: 3,
    downstreamRampUpSeconds: 12
  });
  setPublicAccumulationZone_(equipment, 'conveyor-5', {
    id: 'zone-sleever-to-case-packer',
    name: 'Sleever discharge accumulation',
    upstreamControlEquipmentId: 'sleever-1',
    downstreamControlEquipmentId: 'case-packer-1',
    usableLengthMm: 22000,
    productLengthMm: 66,
    gapMm: 28,
    productPitchMm: 94,
    conveyorSpeedMmPerSecond: 747,
    primeSensorPositionMm: 19500,
    backupSensorPositionMm: 7500,
    backupRestartPositionMm: 10500,
    upstreamStopResponseSeconds: 1,
    bottlesDischargedAtStop: 4,
    downstreamRampUpSeconds: 12
  });
  setPublicAccumulationZone_(equipment, 'conveyor-6', {
    id: 'zone-case-packer-to-palletizer',
    name: 'Case packer discharge accumulation',
    upstreamControlEquipmentId: 'case-packer-1',
    downstreamControlEquipmentId: 'palletizer-1',
    usableLengthMm: 18000,
    productLengthMm: 66,
    gapMm: 30,
    productPitchMm: 96,
    conveyorSpeedMmPerSecond: 729,
    primeSensorPositionMm: 16000,
    backupSensorPositionMm: 6000,
    backupRestartPositionMm: 8500,
    upstreamStopResponseSeconds: 1,
    bottlesDischargedAtStop: 4,
    downstreamRampUpSeconds: 15
  });
}

function setPublicAccumulationZone_(equipment, equipmentId, zone) {
  var owner = equipment.filter(function(unit) { return unit.id === equipmentId; })[0];
  if (!owner) throw new Error('Unknown public demo conveyor: ' + equipmentId);
  owner.accumulationZone = zone;
  owner.characteristics.accumulationModel = 'Synthetic physical conveyor zone; positions are measured from the upstream discharge toward downstream infeed.';
}
function createPublicDemoMetadata_() {
  return {
    dataClassification: 'PUBLIC_DEMONSTRATION_ONLY',
    dataNote: 'This is a non-confidential demonstration Case. Public manufacturer capacity pages provide only broad bounds. MTBF, MTTR, geometry, buffers, speed factors, and line configuration are transparent synthetic assumptions for software testing; they are not plant measurements, equipment guarantees, or operating recommendations.',
    publicReferences: [
      { publisher: 'Krones', title: 'Contiform Speed stretch blow moulder', url: 'https://www.krones.com/en/products/machines/contiform-speed-stretch-blow-moulder.php', usedFor: 'Public upper-bound reference for PET blow moulding capacity.' },
      { publisher: 'Krones', title: 'Modulfill Dual', url: 'https://www.krones.com/en/products/machines/modulfill-dual.php', usedFor: 'Public upper-bound reference for PET filling capacity.' },
      { publisher: 'Krones', title: 'Coca-Cola HBC Egypt fastest canning line', url: 'https://www.krones.com/en/company/press/magazine/reference/coca-cola-hbc-egypts-fastest-canning-line.php', usedFor: 'Public packer cycle-rate context.' },
      { publisher: 'Krones', title: 'Modulpal Pro palletiser', url: 'https://www.krones.com/en/products/machines/modulpal-pro-palletiser.php', usedFor: 'Public palletising layer-rate context.' }
    ],
    modelLimitations: [
      'All generic-engine rates are equivalent bottles per minute; the current MVP does not transform bottles into cases or pallets.',
      'MTBF produces seeded exponential time-to-failure intervals. MTTR is represented as a fixed repair duration.',
      'LACT, LP Prime, and the four unnamed Speed & sensors fields remain unknown rather than being invented.',
      'Conveyor lengths, product pitch, sensor positions, stop-response delay, and restart thresholds are transparent synthetic demonstration values. Positions are measured from the upstream discharge toward downstream infeed.',
      'Prime is modeled as leading-product travel to the downstream photocell. Back-up is modeled from downstream waiting inventory; it requests a controlled stop upstream and records residual-discharge overflow separately.'
    ]
  };
}

function createPublicLineUnit_(definition) {
  return {
    id: definition.id,
    type: definition.type,
    name: definition.name,
    nominalRatePerSecond: definition.nominalRateBpm / 60,
    bufferAfterCapacity: definition.bufferAfterCapacity,
    initialMode: 'AUTO',
    characteristics: {
      dataClassification: 'PUBLIC_DEMONSTRATION_ONLY',
      rateBasis: 'equivalent bottles per minute',
      nominalRateBpm: definition.nominalRateBpm
    },
    noiseProfile: {
      reliability: { mtbfMinutes: definition.mtbfMinutes, mttrMinutes: definition.mttrMinutes },
      microStop: {
        probabilityPerMinute: definition.microStopProbabilityPerMinute,
        minDurationSeconds: definition.microStopMinSeconds,
        maxDurationSeconds: definition.microStopMaxSeconds
      }
    },
    processData: {
      role: definition.role,
      machineType: definition.type,
      equipment: {
        mtbfMinutes: definition.mtbfMinutes,
        mttrMinutes: definition.mttrMinutes,
        maximumSpeedBpm: definition.maximumSpeedBpm,
        bufferMinutes: definition.bufferMinutes
      },
      geometry: {
        lactMm: null,
        lpPrimeMm: null,
        actualDischargeMm: definition.actualDischargeMm,
        actualCodingMm: definition.actualCodingMm
      },
      upstream: {
        packageLengthMm: definition.packageLengthMm,
        dischargePitchMm: definition.dischargePitchMm,
        startupTimeSeconds: definition.startupTimeSeconds,
        bottlesDischargedAtStop: definition.bottlesDischargedAtStop
      },
      downstream: {
        infeedPitchMm: definition.infeedPitchMm,
        rampUpTimeSeconds: definition.rampUpTimeSeconds
      },
      speedAndSensors: {
        conveyorSpeedFactorVsDischargeVelocityPercent: definition.dischargeFactorPercent,
        codingConveyorSpeedFactorVsPreviousConveyorPercent: definition.codingFactorPercent,
        additionalParameters: []
      }
    }
  };
}
