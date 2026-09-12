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
  const appsScriptSourceDirectory = path.join(rootDirectory, 'apps-script', 'source');
  const manualOutputDirectory = path.join(rootDirectory, 'apps-script');
  const readSource = (file) => fs.readFileSync(path.join(appsScriptSourceDirectory, file), 'utf8').trimEnd();
  const readServerSource = (file) => {
    var source = readSource(file);
    if (file !== 'Main.gs') return source;
    return source.replace(
      /\nfunction include_\(filename\) \{\n  return HtmlService\.createHtmlOutputFromFile\(filename\)\.getContent\(\);\n\}\n?/,
      '\n'
    ).replace("createTemplateFromFile('WebApp')", "createTemplateFromFile('Index')");
  };

  const code = [
    '// MANUAL APPS SCRIPT DEPLOYMENT FILE — copy this file as Code.gs.',
    '// GENERATED from apps-script/source/; edit the modular sources, not this file.',
    ''
  ].concat(serverFiles.flatMap((file) => [
    '// -----------------------------------------------------------------------------',
    `// Source: apps-script/source/${file}`,
    '// -----------------------------------------------------------------------------',
    readServerSource(file),
    ''
  ])).join('\n');

  let index = readSource('WebApp.html');
  for (const [includeName, sourceFile] of htmlIncludes) {
    const marker = `<?!= include_('${includeName}'); ?>`;
    if (!index.includes(marker)) {
      throw new Error(`Manual bundle expected ${marker} in apps-script/source/WebApp.html.`);
    }
    index = index.replace(marker, readSource(sourceFile));
  }
  if (index.includes('<?')) {
    throw new Error('Manual bundle still contains an unresolved Apps Script template expression.');
  }
  index = '<!-- MANUAL APPS SCRIPT DEPLOYMENT FILE — copy this file as Index.html. GENERATED from apps-script/source/; do not edit it directly. -->\n' + index + '\n';

  const codePath = path.join(manualOutputDirectory, 'Code.gs');
  const indexPath = path.join(manualOutputDirectory, 'Index.html');
  fs.writeFileSync(codePath, code);
  fs.writeFileSync(indexPath, index);
  return { codePath, indexPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const output = buildManualAppsScriptBundle();
  process.stdout.write(`Generated ${output.codePath} and ${output.indexPath}\n`);
}
