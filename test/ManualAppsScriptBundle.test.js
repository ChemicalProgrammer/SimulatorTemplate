import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildManualAppsScriptBundle } from '../scripts/build-manual-apps-script-bundle.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('manual Apps Script bundle contains all server modules and resolved HTML includes', () => {
  const committedCode = fs.readFileSync(path.join(repositoryRoot, 'Code.gs'), 'utf8');
  const committedIndex = fs.readFileSync(path.join(repositoryRoot, 'Index.html'), 'utf8');
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const code = fs.readFileSync(output.codePath, 'utf8');
  const index = fs.readFileSync(output.indexPath, 'utf8');

  assert.equal(committedCode, code, 'root Code.gs must match the manual bundle generated from apps-script/.');
  assert.equal(committedIndex, index, 'root Index.html must match the manual bundle generated from apps-script/.');

  for (const sourceFile of ['ApiResponse.gs', 'AuthService.gs', 'ConfigService.gs', 'DriveService.gs', 'CaseService.gs', 'ReferenceCaseFactory.gs', 'PublicDemoCaseFactory.gs', 'Main.gs']) {
    assert.match(code, new RegExp(`Source: apps-script/${sourceFile.replace('.', '\\.')}`));
  }
  assert.match(code, /function doGet\(\)/);
  assert.match(code, /createTemplateFromFile\('Index'\)/);
  assert.doesNotMatch(code, /createTemplateFromFile\('WebApp'\)/);
  assert.doesNotMatch(code, /function include_\(/);
  assert.doesNotMatch(index, /<\?!=\s*include_/);
  assert.doesNotMatch(index, /<\?\s*include_/);

  const scripts = Array.from(index.matchAll(/<script>([\s\S]*?)<\/script>/g), (match) => match[1]);
  assert.equal(scripts.length, 2);
  for (const script of scripts) new Function(script);
  new Function(code);
  assert.match(code, /MANUAL APPS SCRIPT DEPLOYMENT FILE/);
  assert.match(index, /MANUAL APPS SCRIPT DEPLOYMENT FILE/);
});

test('manual bundle keeps time-faithful playback and direct equipment scenario controls', () => {
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const index = fs.readFileSync(output.indexPath, 'utf8');

  assert.match(index, /At 1×, one virtual second takes one real second\./);
  assert.match(index, /virtualSeconds \* 1000 \/ playbackRate/);
  assert.match(index, /Run \/ resume/);
  assert.match(index, /Planned stop/);
  assert.match(index, /Emergency stop/);
  assert.match(index, /Reset \+ run/);
  assert.match(index, /function applyLiveScenarioControl\(/);
});

test('manual bundle uses a wide, compact live-equipment list on large screens', () => {
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const index = fs.readFileSync(output.indexPath, 'utf8');

  assert.match(index, /\.app-shell \{ max-width: 1760px;/);
  assert.match(index, /live-equipment-columns/);
  assert.match(index, /State &amp; rate/);
  assert.match(index, /Time losses/);
  assert.match(index, /createAccumulationZoneDetails\(/);
  assert.match(index, /physical accumulation/);
});

test('manual bundle updates live equipment rows in place to preserve scroll position', () => {
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const index = fs.readFileSync(output.indexPath, 'utf8');

  assert.match(index, /function ensureLiveEquipmentColumns\(/);
  assert.match(index, /function createLiveEquipmentCard\(/);
  assert.match(index, /function updateLiveEquipmentCard\(/);
  assert.match(index, /function updateAccumulationZoneDetails\(/);
  assert.match(index, /function updateLiveEquipmentControl\(/);
  assert.doesNotMatch(index, /function renderLiveEquipment\(sample\) \{\s+var target = document\.getElementById\('live-equipment'\);\s+target\.textContent = '';/);
});


test('manual bundle makes physical conveyor geometry mandatory and exposes Case deletion', () => {
  const output = buildManualAppsScriptBundle(repositoryRoot);
  const code = fs.readFileSync(output.codePath, 'utf8');
  const index = fs.readFileSync(output.indexPath, 'utf8');

  assert.match(index, /Physical accumulation zone/);
  assert.match(index, /Geometry is active by default/);
  assert.doesNotMatch(index, /Use format fields/);
  assert.doesNotMatch(index, /Explicit accumulation-zone override JSON/);
  assert.match(index, /Delete Case/);
  assert.match(code, /function deleteCase\(/);
});
