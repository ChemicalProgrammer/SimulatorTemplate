function listCases_(user) {
  var settings = getUserSettings_();
  if (!settings.workspaceRootFolderId) return [];

  var files = getWorkspaceFolders_().cases.getFiles();
  var cases = [];
  while (files.hasNext()) {
    var file = files.next();
    if (!/\.case\.json$/i.test(file.getName())) continue;
    var caseData = tryReadCaseFile_(file);
    if (caseData && caseData.ownerEmail === user.email) cases.push(toCaseSummary_(caseData, file));
  }
  return cases.sort(function(left, right) { return right.updatedAt.localeCompare(left.updatedAt); });
}

function createCase_(request, user) {
  var caseData = validateNewCase_(request, user);
  var folders = getWorkspaceFolders_();
  var fileName = caseData.id + '.case.json';
  if (folders.cases.getFilesByName(fileName).hasNext()) {
    throw createSimulatorError_('CASE_ALREADY_EXISTS', 'A case with this identifier already exists.');
  }

  var file = folders.cases.createFile(fileName, JSON.stringify(caseData, null, 2), MimeType.PLAIN_TEXT);
  return toCaseSummary_(caseData, file);
}

function validateNewCase_(request, user) {
  if (!request || typeof request !== 'object') {
    throw createSimulatorError_('INVALID_CASE', 'The case must be an object.');
  }
  if (!/^[a-z0-9-]+$/i.test(request.id || '')) {
    throw createSimulatorError_('INVALID_CASE', 'Case id must contain only letters, numbers, and hyphens.');
  }
  if (typeof request.name !== 'string' || !request.name.trim()) {
    throw createSimulatorError_('INVALID_CASE', 'Case name is required.');
  }
  if (!Array.isArray(request.equipment) || request.equipment.length < 2) {
    throw createSimulatorError_('INVALID_CASE', 'A case must contain at least two equipment units.');
  }

  var now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    id: request.id,
    name: request.name.trim(),
    unitOfFlow: request.unitOfFlow || 'units',
    equipment: request.equipment,
    ownerEmail: user.email,
    createdAt: now,
    updatedAt: now
  };
}

function tryReadCaseFile_(file) {
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (error) {
    return null;
  }
}

function toCaseSummary_(caseData, file) {
  return {
    id: caseData.id,
    name: caseData.name,
    equipmentCount: Array.isArray(caseData.equipment) ? caseData.equipment.length : 0,
    updatedAt: caseData.updatedAt,
    fileId: file.getId()
  };
}
