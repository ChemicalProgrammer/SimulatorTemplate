import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('returns safe default settings before a workspace is configured', () => {
  const runtime = createAppsScriptRuntime();

  const settings = runtime.getUserSettings_();

  assert.deepEqual(toPlainObject(settings), {
    schemaVersion: '1.0',
    workspaceRootFolderId: '',
    preferredPlaybackRate: 1
  });
});

test('stores only a workspace folder that the active user can open', () => {
  const runtime = createAppsScriptRuntime({ accessibleFolderIds: ['workspace-1'] });

  const settings = runtime.saveUserSettings_({
    workspaceRootFolderId: 'workspace-1',
    preferredPlaybackRate: 1.5
  });

  assert.equal(settings.workspaceRootFolderId, 'workspace-1');
  assert.equal(settings.preferredPlaybackRate, 1.5);
  assert.ok(runtime.userProperties.USER_SETTINGS_JSON);
});

test('returns a structured error when the workspace folder is unavailable', () => {
  const runtime = createAppsScriptRuntime();

  assert.throws(
    () => runtime.saveUserSettings_({ workspaceRootFolderId: 'missing-folder', preferredPlaybackRate: 1 }),
    (error) => error.simulatorError?.code === 'WORKSPACE_FOLDER_UNAVAILABLE'
  );
});

function createAppsScriptRuntime(options = {}) {
  const userProperties = {};
  const scriptProperties = {};
  const accessibleFolderIds = new Set(options.accessibleFolderIds || []);
  const context = vm.createContext({
    JSON,
    Error,
    Boolean,
    Number,
    Array,
    isFinite,
    PropertiesService: {
      getUserProperties: () => ({
        getProperty: (key) => userProperties[key] || null,
        setProperty: (key, value) => { userProperties[key] = value; }
      }),
      getScriptProperties: () => ({
        getProperty: (key) => scriptProperties[key] || null
      })
    },
    DriveApp: {
      getFolderById: (id) => {
        if (!accessibleFolderIds.has(id)) throw new Error('Folder unavailable');
        return { getName: () => id };
      }
    }
  });

  ['ApiResponse.gs', 'ConfigService.gs', 'DriveService.gs'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(repositoryRoot, 'apps-script', file), 'utf8'), context, { filename: file });
  });
  context.userProperties = userProperties;
  return context;
}

function toPlainObject(value) {
  return JSON.parse(JSON.stringify(value));
}
