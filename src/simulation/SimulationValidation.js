export function validateSimulationInput(input) {
  const details = [];
  validateCase(input?.case, details);
  validateRun(input?.run, details);

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
    const path = `case.equipment[${index}]`;
    if (!equipment || typeof equipment !== 'object') {
      details.push(invalid(path, 'must be an object'));
      return;
    }
    if (!nonEmptyString(equipment.id)) details.push(required(`${path}.id`));
    if (ids.has(equipment.id)) details.push(invalid(`${path}.id`, 'must be unique'));
    ids.add(equipment.id);
    if (!positiveNumber(equipment.nominalRatePerSecond)) details.push(invalid(`${path}.nominalRatePerSecond`, 'must be a number greater than zero'));
    if (!nonNegativeNumber(equipment.bufferAfterCapacity)) details.push(invalid(`${path}.bufferAfterCapacity`, 'must be a number greater than or equal to zero'));
    if (!['AUTO', 'MANUAL', 'PAUSE', 'STOP'].includes(equipment.initialMode)) details.push(invalid(`${path}.initialMode`, 'must be AUTO, MANUAL, PAUSE, or STOP'));
  });
}

function validateRun(run, details) {
  if (!run || typeof run !== 'object') {
    details.push(required('run'));
    return;
  }
  if (!positiveNumber(run.durationSeconds)) details.push(invalid('run.durationSeconds', 'must be a number greater than zero'));
  if (!positiveNumber(run.tickSeconds)) details.push(invalid('run.tickSeconds', 'must be a number greater than zero'));
  if (!Number.isInteger(run.seed)) details.push(invalid('run.seed', 'must be an integer'));
  if (run.sampleEverySeconds !== undefined && !positiveNumber(run.sampleEverySeconds)) details.push(invalid('run.sampleEverySeconds', 'must be a number greater than zero'));
}

function required(path) { return { path, reason: 'is required' }; }
function invalid(path, reason) { return { path, reason }; }
function positiveNumber(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function nonNegativeNumber(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function nonEmptyString(value) { return typeof value === 'string' && value.length > 0; }
