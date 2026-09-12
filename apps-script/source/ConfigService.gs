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
