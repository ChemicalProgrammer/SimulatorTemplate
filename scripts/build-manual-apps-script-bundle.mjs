import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), '..');

const serverFiles = [
  'ApiResponse.gs',
  'AuthService.gs',
  'ConfigService.gs',
  'DriveService.gs',
  'CaseService.gs',
  'ReferenceCaseFactory.gs',
  'PublicDemoCaseFactory.gs',
  'Main.gs'
];

const htmlIncludes = [
  ['Styles', 'Styles.html'],
  ['SimulationEngine', 'SimulationEngine.html'],
  ['Client', 'Client.html']
];

export function buildManualAppsScriptBundle(rootDirectory = repositoryRoot) {
  const appsScriptDirectory = path.join(rootDirectory, 'apps-script');
  const manualDirectory = path.join(appsScriptDirectory, 'manual');
  const readSource = (file) => fs.readFileSync(path.join(appsScriptDirectory, file), 'utf8').trimEnd();
  const readServerSource = (file) => {
    var source = readSource(file);
    if (file !== 'Main.gs') return source;
    return source.replace(
      /\nfunction include_\(filename\) \{\n  return HtmlService\.createHtmlOutputFromFile\(filename\)\.getContent\(\);\n\}\n?/,
      '\n'
    );
  };

  const code = [
    '// GENERATED FILE — edit the modular sources in apps-script/, not this file.',
    '// This bundle is for manual copy/paste into a blank Apps Script project.',
    ''
  ].concat(serverFiles.flatMap((file) => [
    '// -----------------------------------------------------------------------------',
    `// Source: apps-script/${file}`,
    '// -----------------------------------------------------------------------------',
    readServerSource(file),
    ''
  ])).join('\n');

  let index = readSource('Index.html');
  for (const [includeName, sourceFile] of htmlIncludes) {
    const marker = `<?!= include_('${includeName}'); ?>`;
    if (!index.includes(marker)) {
      throw new Error(`Manual bundle expected ${marker} in apps-script/Index.html.`);
    }
    index = index.replace(marker, readSource(sourceFile));
  }
  if (index.includes('<?')) {
    throw new Error('Manual bundle still contains an unresolved Apps Script template expression.');
  }
  index = '<!-- GENERATED FILE — edit the modular sources in apps-script/, not this file. -->\n' + index + '\n';

  fs.mkdirSync(manualDirectory, { recursive: true });
  const codePath = path.join(rootDirectory, 'Code.gs');
  const indexPath = path.join(rootDirectory, 'Index.html');
  const manualCodePath = path.join(manualDirectory, 'Code.gs');
  const manualIndexPath = path.join(manualDirectory, 'Index.html');
  fs.writeFileSync(codePath, code);
  fs.writeFileSync(indexPath, index);
  fs.writeFileSync(manualCodePath, code);
  fs.writeFileSync(manualIndexPath, index);
  return { codePath, indexPath, manualCodePath, manualIndexPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const output = buildManualAppsScriptBundle();
  process.stdout.write(`Generated ${output.codePath} and ${output.indexPath}\n`);
}
