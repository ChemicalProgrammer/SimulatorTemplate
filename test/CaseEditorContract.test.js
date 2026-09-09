import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const owner = { email: 'engineer@example.com' };

test('creates a draft case when only a title is provided', () => {
  const runtime = createCaseRuntime();

  const summary = runtime.createCase_({ name: 'New packaging study' }, owner);
  const caseData = runtime.getCase_(summary.id, owner);

  assert.equal(caseData.name, 'New packaging study');
  assert.deepEqual(toPlainObject(caseData.equipment), []);
  assert.equal(caseData.revision, 1);
  assert.equal(caseData.ownerEmail, owner.email);
});

test('updates a case with ordered equipment and increments its revision', () => {
  const runtime = createCaseRuntime();
  const created = runtime.createCase_({ name: 'Editable line' }, owner);
  const original = runtime.getCase_(created.id, owner);

  const saved = runtime.saveCase_({
    id: original.id,
    expectedRevision: original.revision,
    name: 'Editable line v2',
    unitOfFlow: 'bottles',
    equipment: [
      equipment('blower-1', 'BLOWER', 20, 100),
      equipment('pacemaker-1', 'PACEMAKER', 25, 80)
    ]
  }, owner);

  assert.equal(saved.revision, 2);
  assert.equal(saved.name, 'Editable line v2');
  assert.deepEqual(saved.equipment.map((item) => item.id), ['blower-1', 'pacemaker-1']);
});

test('rejects a stale Case Editor save instead of overwriting a newer revision', () => {
  const runtime = createCaseRuntime();
  const created = runtime.createCase_({ name: 'Concurrent edit' }, owner);
  const original = runtime.getCase_(created.id, owner);
  runtime.saveCase_({
    id: original.id,
    expectedRevision: original.revision,
    name: 'First save',
    unitOfFlow: 'units',
    equipment: []
  }, owner);

  assert.throws(
    () => runtime.saveCase_({
      id: original.id,
      expectedRevision: original.revision,
      name: 'Stale save',
      unitOfFlow: 'units',
      equipment: []
    }, owner),
    (error) => error.simulatorError?.code === 'CASE_CONFLICT'
  );
});

test('preserves explicit real-format process data without inventing missing values', () => {
  const runtime = createCaseRuntime();
  const processData = {
    role: 'CRITICAL_MACHINE',
    machineType: 'BLOWMOLDER',
    equipment: { mtbfMinutes: null, mttrMinutes: null, maximumSpeedBpm: null, bufferMinutes: null },
    geometry: { lactMm: null, lpPrimeMm: null, actualDischargeMm: null, actualCodingMm: null },
    upstream: { packageLengthMm: null, dischargePitchMm: null, startupTimeSeconds: null, bottlesDischargedAtStop: null },
    downstream: { infeedPitchMm: null, rampUpTimeSeconds: null },
    speedAndSensors: {
      conveyorSpeedFactorVsDischargeVelocityPercent: null,
      codingConveyorSpeedFactorVsPreviousConveyorPercent: null,
      additionalParameters: []
    }
  };
  const created = runtime.createCase_({
    name: 'Format line',
    equipment: [{ ...equipment('blowmolder-1', 'BLOWMOLDER', 20, 100), processData }]
  }, owner);

  const stored = runtime.getCase_(created.id, owner);

  assert.deepEqual(toPlainObject(stored.equipment[0].processData), processData);
});

function equipment(id, type, rate, capacity) {
  return { id, type, name: id, nominalRatePerSecond: rate, bufferAfterCapacity: capacity, initialMode: 'AUTO' };
}

function createCaseRuntime() {
  const files = new Map();
  const folder = {
    getFiles: () => iterator([...files.values()]),
    getFilesByName: (name) => iterator(files.has(name) ? [files.get(name)] : []),
    createFile: (name, content) => {
      const file = createFile(name, content);
      files.set(name, file);
      return file;
    }
  };
  const context = vm.createContext({
    JSON,
    Error,
    Date,
    Array,
    MimeType: { PLAIN_TEXT: 'text/plain' }
  });

  ['ApiResponse.gs', 'CaseService.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(repositoryRoot, 'apps-script', file), 'utf8'), context, { filename: file });
  });
  context.getWorkspaceFolders_ = () => ({ cases: folder });
  return context;
}

function createFile(name, content) {
  let fileContent = content;
  return {
    getId: () => 'file-' + name,
    getName: () => name,
    getBlob: () => ({ getDataAsString: () => fileContent }),
    setContent: (nextContent) => { fileContent = nextContent; }
  };
}

function iterator(values) {
  let index = 0;
  return {
    hasNext: () => index < values.length,
    next: () => values[index++]
  };
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}
