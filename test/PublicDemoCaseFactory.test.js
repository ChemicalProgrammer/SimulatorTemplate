import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { simulateLine } from '../src/simulation/LineSimulationEngine.js';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('public demo factory creates a runnable 13-step Case with explicit provenance', () => {
  const factory = vm.createContext({ Date, Array, Object });
  vm.runInContext(
    fs.readFileSync(path.join(repositoryRoot, 'apps-script', 'source', 'PublicDemoCaseFactory.gs'), 'utf8'),
    factory,
    { filename: 'PublicDemoCaseFactory.gs' }
  );
  const caseModel = factory.createPublicDemoCaseRequest_();

  assert.equal(caseModel.metadata.dataClassification, 'PUBLIC_DEMONSTRATION_ONLY');
  assert.match(caseModel.metadata.dataNote, /synthetic assumptions/i);
  assert.equal(caseModel.metadata.publicReferences.length, 4);
  assert.deepEqual(Array.from(caseModel.equipment, (item) => item.type), [
    'BLOWMOLDER', 'CONVEYOR', 'PUCKER', 'CONVEYOR', 'FILLER', 'CONVEYOR',
    'DEPUCKER', 'CONVEYOR', 'SLEEVER', 'CONVEYOR', 'CASE_PACKER', 'CONVEYOR', 'PALLETIZER'
  ]);

  const conveyors = caseModel.equipment.filter((unit) => unit.type === 'CONVEYOR');
  assert.equal(conveyors.length, 6);
  assert.equal(conveyors.every((unit) => {
    const zone = unit.processData.accumulation;
    return zone && unit.processData.geometry.lactMm > 0 && unit.processData.geometry.lpPrimeMm > 0 &&
      zone.backupSensorPositionMm > 0 && zone.dischargeRunoutLengthMm >= 0 &&
      zone.rejectRunoutLengthMm >= 0 && zone.blockedTimeDelaySeconds >= 0 &&
      zone.clearTimeDelaySeconds >= 0 && zone.insuranceFactorUnits >= 0;
  }), true);

  for (const unit of caseModel.equipment) {
    assert.ok(unit.nominalRatePerSecond > 0);
    assert.ok(unit.noiseProfile.reliability.mtbfMinutes > 0);
    assert.ok(unit.noiseProfile.reliability.mttrMinutes > 0);
    assert.ok(unit.processData.equipment.mtbfMinutes > 0);
    assert.ok(unit.processData.equipment.mttrMinutes > 0);
    assert.ok(unit.processData.equipment.maximumSpeedBpm > 0);
    if (unit.type === 'CONVEYOR') {
      assert.ok(unit.processData.geometry.lactMm > 0);
      assert.ok(unit.processData.geometry.lpPrimeMm > 0);
    } else {
      assert.equal(unit.processData.geometry.lactMm, null);
      assert.equal(unit.processData.geometry.lpPrimeMm, null);
    }
    assert.ok(unit.processData.geometry.actualDischargeMm > 0);
    assert.ok(unit.processData.geometry.actualCodingMm > 0);
    assert.ok(unit.processData.upstream.packageLengthMm > 0);
    assert.ok(unit.processData.upstream.dischargePitchMm > 0);
    assert.ok(unit.processData.upstream.startupTimeSeconds > 0);
    assert.ok(unit.processData.upstream.bottlesDischargedAtStop >= 0);
    assert.ok(unit.processData.downstream.infeedPitchMm > 0);
    assert.ok(unit.processData.downstream.rampUpTimeSeconds > 0);
    assert.ok(unit.processData.speedAndSensors.conveyorSpeedFactorVsDischargeVelocityPercent > 0);
    assert.ok(unit.processData.speedAndSensors.codingConveyorSpeedFactorVsPreviousConveyorPercent > 0);
    assert.deepEqual(Array.from(unit.processData.speedAndSensors.additionalParameters), []);
  }

  const response = simulateLine({
    case: JSON.parse(JSON.stringify(caseModel)),
    run: { durationSeconds: 300, tickSeconds: 1, sampleEverySeconds: 5, seed: 20260909 }
  });
  assert.equal(response.ok, true);
  assert.ok(response.result.summary.outputCount > 0);
  const zoneMetrics = Object.values(response.result.accumulationZoneMetrics);
  assert.equal(zoneMetrics.every((zone) => zone.modelOrigin === 'FLOWPILOT_ENGINEERING'), true);
  assert.equal(zoneMetrics.every((zone) => zone.engineering.audit.status !== 'FAIL'), true);
});
