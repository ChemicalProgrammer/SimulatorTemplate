import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('the real-format template preserves the 13-object packaging sequence', () => {
  const template = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'examples/format-line-13.template.json'), 'utf8'));

  assert.equal(template.objects.length, 13);
  assert.deepEqual(template.objects.map((item) => item.type), [
    'BLOWMOLDER', 'CONVEYOR', 'PUCKER', 'CONVEYOR', 'FILLER', 'CONVEYOR',
    'DEPUCKER', 'CONVEYOR', 'SLEEVER', 'CONVEYOR', 'CASE_PACKER', 'CONVEYOR', 'PALLETIZER'
  ]);
});

test('the real-format template leaves unspecified physical data explicitly unknown', () => {
  const template = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'examples/format-line-13.template.json'), 'utf8'));
  const blowmolder = template.objects[0].processData;

  assert.equal(blowmolder.equipment.mtbfMinutes, null);
  assert.equal(blowmolder.geometry.lactMm, null);
  assert.equal(blowmolder.speedAndSensors.conveyorSpeedFactorVsDischargeVelocityPercent, null);
  assert.deepEqual(blowmolder.speedAndSensors.additionalParameters, []);
});

test('every format object keeps the agreed process-data sections and neutral geometry labels', () => {
  const template = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'examples/format-line-13.template.json'), 'utf8'));

  for (const item of template.objects) {
    assert.deepEqual(Object.keys(item.processData).sort(), [
      'downstream', 'equipment', 'geometry', 'machineType', 'role', 'speedAndSensors', 'upstream'
    ]);
    assert.deepEqual(Object.keys(item.processData.geometry).sort(), [
      'actualCodingMm', 'actualDischargeMm', 'lactMm', 'lpPrimeMm'
    ]);
    assert.equal(item.processData.geometry.actualDischargeMm, null);
    assert.equal(item.processData.geometry.actualCodingMm, null);
  }
});
