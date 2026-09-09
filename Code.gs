// MANUAL APPS SCRIPT DEPLOYMENT FILE — copy this file as Code.gs.
// GENERATED from apps-script/; edit the modular sources, not this file.

// -----------------------------------------------------------------------------
// Source: apps-script/ApiResponse.gs
// -----------------------------------------------------------------------------
function success_(data) {
  return { ok: true, data: data };
}

function failure_(error) {
  var safeError = error && error.simulatorError
    ? error.simulatorError
    : {
        code: 'UNEXPECTED_ERROR',
        message: 'The request could not be completed.'
      };

  return { ok: false, error: safeError };
}

function createSimulatorError_(code, message, details) {
  var error = new Error(message);
  error.simulatorError = {
    code: code,
    message: message,
    details: details || []
  };
  return error;
}

// -----------------------------------------------------------------------------
// Source: apps-script/AuthService.gs
// -----------------------------------------------------------------------------
function requireCurrentUser_() {
  var email = Session.getActiveUser().getEmail();
  if (!email) {
    throw createSimulatorError_(
      'IDENTITY_UNAVAILABLE',
      'The deployment must identify the active Google user before the console can be used.'
    );
  }

  var allowedEmails = getAllowedUserEmails_();
  if (allowedEmails.length > 0 && allowedEmails.indexOf(email.toLowerCase()) === -1) {
    throw createSimulatorError_('ACCESS_DENIED', 'This Google user is not allowed to use the console.');
  }

  return { email: email.toLowerCase() };
}

function getAllowedUserEmails_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALLOWED_USER_EMAILS_JSON');
  if (!raw) return [];

  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(function(email) { return typeof email === 'string'; }).map(function(email) { return email.toLowerCase(); })
      : [];
  } catch (error) {
    throw createSimulatorError_('INVALID_GLOBAL_CONFIGURATION', 'ALLOWED_USER_EMAILS_JSON must contain a JSON array of email addresses.');
  }
}

// -----------------------------------------------------------------------------
// Source: apps-script/ConfigService.gs
// -----------------------------------------------------------------------------
function getUserSettings_() {
  var raw = PropertiesService.getUserProperties().getProperty('USER_SETTINGS_JSON');
  if (!raw) return createDefaultUserSettings_();

  try {
    return normalizeUserSettings_(JSON.parse(raw));
  } catch (error) {
    throw createSimulatorError_('INVALID_USER_SETTINGS', 'The saved user settings are not valid JSON.');
  }
}

function saveUserSettings_(request) {
  var settings = normalizeUserSettings_(request);
  verifyWorkspaceRoot_(settings.workspaceRootFolderId);
  PropertiesService.getUserProperties().setProperty('USER_SETTINGS_JSON', JSON.stringify(settings));
  return settings;
}

function getClientSafeGlobalConfig_() {
  return {
    fixedKnowledgeFolderConfigured: Boolean(PropertiesService.getScriptProperties().getProperty('FIXED_KNOWLEDGE_FOLDER_ID'))
  };
}

function createDefaultUserSettings_() {
  return {
    schemaVersion: '1.0',
    workspaceRootFolderId: '',
    preferredPlaybackRate: 1
  };
}

function normalizeUserSettings_(settings) {
  if (!settings || typeof settings !== 'object') {
    throw createSimulatorError_('INVALID_USER_SETTINGS', 'Settings must be an object.');
  }

  var rootId = typeof settings.workspaceRootFolderId === 'string' ? settings.workspaceRootFolderId.trim() : '';
  if (!rootId) {
    throw createSimulatorError_('INVALID_USER_SETTINGS', 'workspaceRootFolderId is required.');
  }

  var playbackRate = Number(settings.preferredPlaybackRate || 1);
  if (!isFinite(playbackRate) || playbackRate <= 0) {
    throw createSimulatorError_('INVALID_USER_SETTINGS', 'preferredPlaybackRate must be greater than zero.');
  }

  return {
    schemaVersion: '1.0',
    workspaceRootFolderId: rootId,
    preferredPlaybackRate: playbackRate
  };
}

// -----------------------------------------------------------------------------
// Source: apps-script/DriveService.gs
// -----------------------------------------------------------------------------
function verifyWorkspaceRoot_(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    folder.getName();
    return folder;
  } catch (error) {
    throw createSimulatorError_('WORKSPACE_FOLDER_UNAVAILABLE', 'The configured workspace folder cannot be opened by the current user.');
  }
}

function getWorkspaceFolders_() {
  var settings = getUserSettings_();
  var root = verifyWorkspaceRoot_(settings.workspaceRootFolderId);
  return {
    root: root,
    cases: getOrCreateChildFolder_(root, 'SimulatorTemplate Cases'),
    artifacts: getOrCreateChildFolder_(root, 'SimulatorTemplate Artifacts'),
    exports: getOrCreateChildFolder_(root, 'SimulatorTemplate Exports')
  };
}

function getOrCreateChildFolder_(parent, name) {
  var folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function getFixedKnowledgeFolder_() {
  var folderId = PropertiesService.getScriptProperties().getProperty('FIXED_KNOWLEDGE_FOLDER_ID');
  return folderId ? verifyWorkspaceRoot_(folderId) : null;
}

// -----------------------------------------------------------------------------
// Source: apps-script/CaseService.gs
// -----------------------------------------------------------------------------
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
  var caseData = createNewCaseRecord_(request, user);
  var folders = getWorkspaceFolders_();
  var fileName = caseData.id + '.case.json';
  if (folders.cases.getFilesByName(fileName).hasNext()) {
    throw createSimulatorError_('CASE_ALREADY_EXISTS', 'A case with this identifier already exists.');
  }

  var file = folders.cases.createFile(fileName, JSON.stringify(caseData, null, 2), MimeType.PLAIN_TEXT);
  return toCaseSummary_(caseData, file);
}

function getCase_(caseId, user) {
  return getOwnedCaseFile_(caseId, user).caseData;
}

function saveCase_(request, user) {
  if (!request || typeof request !== 'object') {
    throw createSimulatorError_('INVALID_CASE', 'The case must be an object.');
  }

  var owned = getOwnedCaseFile_(request.id, user);
  var current = owned.caseData;
  if (Number(request.expectedRevision) !== Number(current.revision)) {
    throw createSimulatorError_('CASE_CONFLICT', 'This Case was changed elsewhere. Reload it before saving.');
  }

  var next = buildUpdatedCase_(request, current, user);
  owned.file.setContent(JSON.stringify(next, null, 2));
  return next;
}

function createNewCaseRecord_(request, user) {
  if (!request || typeof request !== 'object') {
    throw createSimulatorError_('INVALID_CASE', 'The case must be an object.');
  }

  var name = requireCaseName_(request.name);
  var id = request.id ? requireCaseId_(request.id) : generateCaseId_(name);
  var equipment = normalizeEquipmentList_(request.equipment || []);
  var now = new Date().toISOString();
  return {
    schemaVersion: '1.0',
    id: id,
    name: name,
    unitOfFlow: normalizeUnitOfFlow_(request.unitOfFlow),
    equipment: equipment,
    engineConfig: normalizeObject_(request.engineConfig),
    metadata: normalizeCaseMetadata_(request.metadata),
    stateIds: normalizeStringList_(request.stateIds),
    ownerEmail: user.email,
    revision: 1,
    createdAt: now,
    updatedAt: now
  };
}

function buildUpdatedCase_(request, current, user) {
  return {
    schemaVersion: current.schemaVersion || '1.0',
    id: current.id,
    name: requireCaseName_(request.name),
    unitOfFlow: normalizeUnitOfFlow_(request.unitOfFlow),
    equipment: normalizeEquipmentList_(request.equipment),
    engineConfig: normalizeObject_(request.engineConfig || current.engineConfig),
    metadata: request.metadata === undefined ? normalizeCaseMetadata_(current.metadata) : normalizeCaseMetadata_(request.metadata),
    stateIds: normalizeStringList_(current.stateIds),
    ownerEmail: user.email,
    revision: Number(current.revision || 0) + 1,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  };
}

function getOwnedCaseFile_(caseId, user) {
  var normalizedId = requireCaseId_(caseId);
  var files = getWorkspaceFolders_().cases.getFilesByName(normalizedId + '.case.json');
  if (!files.hasNext()) {
    throw createSimulatorError_('CASE_NOT_FOUND', 'The requested Case could not be found.');
  }

  var file = files.next();
  var caseData = tryReadCaseFile_(file);
  if (!caseData || caseData.ownerEmail !== user.email) {
    throw createSimulatorError_('CASE_NOT_FOUND', 'The requested Case could not be found.');
  }
  return { file: file, caseData: caseData };
}

function requireCaseId_(id) {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/i.test(id)) {
    throw createSimulatorError_('INVALID_CASE', 'Case id must contain only letters, numbers, and hyphens.');
  }
  return id;
}

function requireCaseName_(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw createSimulatorError_('INVALID_CASE', 'Case name is required.');
  }
  return name.trim();
}

function normalizeUnitOfFlow_(unitOfFlow) {
  return typeof unitOfFlow === 'string' && unitOfFlow.trim() ? unitOfFlow.trim() : 'units';
}

function normalizeEquipmentList_(equipment) {
  if (!Array.isArray(equipment)) {
    throw createSimulatorError_('INVALID_CASE', 'equipment must be an array.');
  }

  var seenIds = {};
  return equipment.map(function(unit, index) {
    var path = 'equipment[' + index + ']';
    if (!unit || typeof unit !== 'object') {
      throw createSimulatorError_('INVALID_CASE', path + ' must be an object.');
    }
    var id = requireEquipmentId_(unit.id, path);
    if (seenIds[id]) throw createSimulatorError_('INVALID_CASE', path + '.id must be unique.');
    seenIds[id] = true;
    if (supportedEquipmentTypes_().indexOf(unit.type) === -1) {
      throw createSimulatorError_('INVALID_CASE', path + '.type is not supported.');
    }
    if (typeof unit.name !== 'string' || !unit.name.trim()) {
      throw createSimulatorError_('INVALID_CASE', path + '.name is required.');
    }
    if (!isPositiveFiniteNumber_(unit.nominalRatePerSecond)) {
      throw createSimulatorError_('INVALID_CASE', path + '.nominalRatePerSecond must be greater than zero.');
    }
    if (!isNonNegativeFiniteNumber_(unit.bufferAfterCapacity)) {
      throw createSimulatorError_('INVALID_CASE', path + '.bufferAfterCapacity must be zero or greater.');
    }
    if (['AUTO', 'MANUAL', 'PAUSE', 'STOP'].indexOf(unit.initialMode) === -1) {
      throw createSimulatorError_('INVALID_CASE', path + '.initialMode is not supported.');
    }
    return {
      id: id,
      type: unit.type,
      name: unit.name.trim(),
      nominalRatePerSecond: Number(unit.nominalRatePerSecond),
      bufferAfterCapacity: Number(unit.bufferAfterCapacity),
      initialMode: unit.initialMode,
      characteristics: normalizeObject_(unit.characteristics),
      noiseProfile: normalizeObject_(unit.noiseProfile),
      processData: normalizeProcessData_(unit.processData)
    };
  });
}

function supportedEquipmentTypes_() {
  return ['BLOWER', 'BLOWMOLDER', 'CONVEYOR', 'PACEMAKER', 'PUCKER', 'FILLER', 'DEPUCKER', 'SLEEVER', 'CASE_PACKER', 'PALLETIZER', 'CUSTOM'];
}

function normalizeProcessData_(processData) {
  if (processData === undefined) return {};
  if (!processData || typeof processData !== 'object' || Array.isArray(processData)) {
    throw createSimulatorError_('INVALID_CASE', 'processData must be an object when provided.');
  }
  return processData;
}

function normalizeCaseMetadata_(metadata) {
  if (metadata === undefined) return {};
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw createSimulatorError_('INVALID_CASE', 'metadata must be an object when provided.');
  }
  return metadata;
}

function requireEquipmentId_(id, path) {
  if (typeof id !== 'string' || !/^[a-z0-9-]+$/i.test(id)) {
    throw createSimulatorError_('INVALID_CASE', path + '.id must contain only letters, numbers, and hyphens.');
  }
  return id;
}

function normalizeObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeStringList_(value) {
  return Array.isArray(value) ? value.filter(function(item) { return typeof item === 'string'; }) : [];
}

function isPositiveFiniteNumber_(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber_(value) {
  return typeof value === 'number' && isFinite(value) && value >= 0;
}

function generateCaseId_(name) {
  var base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'case';
  return base + '-' + new Date().getTime();
}

function tryReadCaseFile_(file) {
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (error) {
    return null;
  }
}

function toCaseSummary_(caseData, file) {
  var metadata = caseData.metadata && typeof caseData.metadata === 'object' && !Array.isArray(caseData.metadata) ? caseData.metadata : {};
  return {
    id: caseData.id,
    name: caseData.name,
    equipmentCount: Array.isArray(caseData.equipment) ? caseData.equipment.length : 0,
    isSimulationReady: Array.isArray(caseData.equipment) && caseData.equipment.length >= 2,
    revision: Number(caseData.revision || 1),
    updatedAt: caseData.updatedAt,
    fileId: file.getId(),
    dataClassification: typeof metadata.dataClassification === 'string' ? metadata.dataClassification : null
  };
}

// -----------------------------------------------------------------------------
// Source: apps-script/ReferenceCaseFactory.gs
// -----------------------------------------------------------------------------
function createReferenceCaseRequest_() {
  var suffix = new Date().getTime().toString();
  return {
    id: 'reference-packaging-line-' + suffix,
    name: 'Reference packaging line',
    unitOfFlow: 'bottles',
    equipment: [
      { id: 'blower-1', type: 'BLOWER', name: 'Blower', nominalRatePerSecond: 20, bufferAfterCapacity: 100, initialMode: 'AUTO' },
      { id: 'conveyor-1', type: 'CONVEYOR', name: 'Infeed conveyor', nominalRatePerSecond: 100, bufferAfterCapacity: 300, initialMode: 'AUTO' },
      { id: 'pacemaker-1', type: 'PACEMAKER', name: 'Pacemaker', nominalRatePerSecond: 25, bufferAfterCapacity: 80, initialMode: 'AUTO', noiseProfile: { microStop: { probabilityPerMinute: 0.5, minDurationSeconds: 20, maxDurationSeconds: 20 } } },
      { id: 'conveyor-2', type: 'CONVEYOR', name: 'Discharge conveyor', nominalRatePerSecond: 100, bufferAfterCapacity: 120, initialMode: 'AUTO' },
      { id: 'palletizer-1', type: 'PALLETIZER', name: 'Palletizer', nominalRatePerSecond: 25, bufferAfterCapacity: 0, initialMode: 'AUTO' }
    ]
  };
}

// -----------------------------------------------------------------------------
// Source: apps-script/PublicDemoCaseFactory.gs
// -----------------------------------------------------------------------------
function createPublicDemoCaseRequest_() {
  var suffix = new Date().getTime().toString();
  return {
    id: 'public-demo-packaging-line-' + suffix,
    name: 'Public demo — 13-step packaging line',
    unitOfFlow: 'equivalent bottles',
    metadata: createPublicDemoMetadata_(),
    engineConfig: {
      modelMode: 'PUBLIC_DEMONSTRATION_EQUIVALENT_BOTTLES',
      designThroughputBottlesPerHour: 24000,
      packConfiguration: { bottlesPerCase: 12, casesPerLayer: 10, layersPerPallet: 6 },
      reliabilityModel: 'Seeded exponential time-to-failure with fixed MTTR repair duration'
    },
    equipment: [
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
    ]
  };
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
      'LACT, LP Prime, and the four unnamed Speed & sensors fields remain unknown rather than being invented.'
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

// -----------------------------------------------------------------------------
// Source: apps-script/Main.gs
// -----------------------------------------------------------------------------
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('SimulatorTemplate');
}


function getBootstrap() {
  return executeServerAction_(function(user) {
    return {
      user: user,
      globalConfig: getClientSafeGlobalConfig_(),
      settings: getUserSettings_(),
      cases: listCases_(user)
    };
  });
}

function saveUserSettings(request) {
  return executeServerAction_(function() {
    return saveUserSettings_(request);
  });
}

function createCase(request) {
  return executeServerAction_(function(user) {
    return createCase_(request, user);
  });
}

function getCase(caseId) {
  return executeServerAction_(function(user) {
    return getCase_(caseId, user);
  });
}

function saveCase(request) {
  return executeServerAction_(function(user) {
    return saveCase_(request, user);
  });
}

function createReferenceCase() {
  return executeServerAction_(function(user) {
    return createCase_(createReferenceCaseRequest_(), user);
  });
}

function createPublicDemoCase() {
  return executeServerAction_(function(user) {
    return createCase_(createPublicDemoCaseRequest_(), user);
  });
}

function executeServerAction_(action) {
  try {
    var user = requireCurrentUser_();
    return success_(action(user));
  } catch (error) {
    return failure_(error);
  }
}
