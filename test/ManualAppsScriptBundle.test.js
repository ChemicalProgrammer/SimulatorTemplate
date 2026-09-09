import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildManualAppsScriptBundle } from '../scripts/build-manual-apps-script-bundle.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manual Apps Script bundle contains all server modules and resolved HTML includes', () => {
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const code = fs.readFileSync(output.codePath, 'utf8');
  const index = fs.readFileSync(output.indexPath, 'utf8');

  for (const sourceFile of ['ApiResponse.gs', 'AuthService.gs', 'ConfigService.gs', 'DriveService.gs', 'CaseService.gs', 'ReferenceCaseFactory.gs', 'PublicDemoCaseFactory.gs', 'Main.gs']) {
    assert.match(code, new RegExp(`Source: apps-script/${sourceFile.replace('.', '\\.')}`));
  }
  assert.match(code, /function doGet\(\)/);
  assert.doesNotMatch(code, /function include_\(/);
  assert.doesNotMatch(index, /<\?!=\s*include_/);
  assert.doesNotMatch(index, /<\?\s*include_/);

  const scripts = Array.from(index.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1]);
  assert.equal(scripts.length, 2);
  for (const script of scripts) new Function(script);
  new Function(code);
  assert.equal(fs.readFileSync(output.manualCodePath, 'utf8'), code);
  assert.equal(fs.readFileSync(output.manualIndexPath, 'utf8'), index);
});
