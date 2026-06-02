#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const projectRoot = process.cwd();
const skillDir = process.argv[2];
if (!skillDir) {
  throw new Error('Usage: node ua-local-batch-analyzer.mjs <skillDir>');
}

const uaDir = join(projectRoot, '.understand-anything');
const intermediateDir = join(uaDir, 'intermediate');
const tmpDir = join(uaDir, 'tmp');
mkdirSync(intermediateDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

const scan = JSON.parse(readFileSync(join(intermediateDir, 'scan-result.json'), 'utf8'));
const batchesDoc = JSON.parse(readFileSync(join(intermediateDir, 'batches.json'), 'utf8'));
const fileByPath = new Map(scan.files.map((file) => [file.path, file]));
const importMap = scan.importMap ?? {};
const useExtraction = process.env.UA_USE_EXTRACT === '1';

function toKebab(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function cleanChildName(value, fallback = 'anonymous') {
  const clean = String(value || fallback)
    .replace(/\s+/g, '_')
    .replace(/[:#()[\]{}<>]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || fallback;
}

function uniquePush(array, value) {
  if (value && !array.includes(value)) array.push(value);
}

function complexity(lines) {
  if (lines < 50) return 'simple';
  if (lines <= 200) return 'moderate';
  return 'complex';
}

function fileNodeType(file) {
  const path = file.path;
  const name = basename(path);
  if (file.fileCategory === 'config') return 'config';
  if (file.fileCategory === 'docs') return 'document';
  if (file.fileCategory === 'infra') {
    if (path.includes('.github/workflows/') || name === '.gitlab-ci.yml' || name === 'Jenkinsfile') return 'pipeline';
    if (extname(path) === '.tf' || extname(path) === '.tfvars') return 'resource';
    return 'service';
  }
  if (file.fileCategory === 'data') {
    return 'schema';
  }
  return 'file';
}

function fileNodeId(path) {
  const file = fileByPath.get(path);
  if (!file) return `file:${path}`;
  return `${fileNodeType(file)}:${path}`;
}

function domainFromPath(path) {
  const parts = path.split('/');
  if (parts[0] === 'src') {
    if (parts[1] === 'api') return 'api';
    if (parts[1] === 'components') return parts[2] ? `component-${toKebab(parts[2])}` : 'components';
    if (parts[1] === 'hooks') return 'hooks';
    if (parts[1] === 'globalState') return 'global-state';
    if (parts[1] === 'resources') return 'resources';
    if (parts[1] === 'utils') return 'utilities';
    if (parts[1] === 'styles' || path.endsWith('.scss') || path.endsWith('.css')) return 'styles';
    return toKebab(parts[1] || 'src');
  }
  if (path.startsWith('docs/')) return 'docs';
  if (path.startsWith('config/') || path.startsWith('scripts/') || path === 'package.json' || path === 'tsconfig.json') return 'build-config';
  if (path.startsWith('.storybook') || path.includes('.stories.')) return 'storybook';
  if (path.startsWith('cypress/') || path.includes('.cy.') || path.includes('.spec.')) return 'tests';
  if (path.includes('Dockerfile') || path.endsWith('.yaml') || path.endsWith('.yml')) return 'deployment';
  return toKebab(parts[0] || 'root');
}

function tagsFor(file, result) {
  const tags = [];
  const path = file.path;
  const lower = path.toLowerCase();
  const type = fileNodeType(file);

  if (type === 'config') uniquePush(tags, 'configuration');
  if (type === 'document') uniquePush(tags, 'documentation');
  if (type === 'service' || type === 'resource' || type === 'pipeline') uniquePush(tags, 'infrastructure');
  if (type === 'pipeline') uniquePush(tags, 'ci-cd');
  if (type === 'schema') uniquePush(tags, 'schema-definition');
  if (lower.includes('test') || lower.includes('.spec.') || lower.includes('.cy.')) uniquePush(tags, 'test');
  if (lower.includes('.stories.') || lower.includes('storybook')) uniquePush(tags, 'storybook');
  if (path === 'index.ts' || path === 'src/index.ts' || path === 'src/App.tsx' || path === 'src/initApp.tsx') uniquePush(tags, 'entry-point');
  if (path.startsWith('src/api/')) uniquePush(tags, 'api-client');
  if (path.startsWith('src/hooks/') || basename(path).startsWith('use')) uniquePush(tags, 'hook');
  if (path.includes('/components/') || path.endsWith('.tsx')) uniquePush(tags, 'component');
  if (path.includes('globalState')) uniquePush(tags, 'state-management');
  if (lower.includes('matrix')) uniquePush(tags, 'matrix');
  if (lower.includes('livekit')) uniquePush(tags, 'livekit');
  if (lower.includes('session')) uniquePush(tags, 'session');
  if (lower.includes('invite')) uniquePush(tags, 'invite');
  if (lower.includes('auth') || lower.includes('login') || lower.includes('keycloak')) uniquePush(tags, 'authentication');
  if (lower.includes('i18n') || lower.includes('translation') || lower.includes('locale')) uniquePush(tags, 'i18n');
  if (lower.includes('theme') || lower.includes('scss') || lower.includes('.css')) uniquePush(tags, 'styling');
  if ((result?.metrics?.exportCount ?? 0) > 3 && (result?.metrics?.functionCount ?? 0) <= 1) uniquePush(tags, 'barrel');
  if (result?.metrics?.functionCount > 0) uniquePush(tags, 'utility');

  uniquePush(tags, domainFromPath(path));
  for (const fallback of [file.fileCategory || 'source', 'frontend', 'module', 'source-file']) {
    if (tags.length >= 3) break;
    uniquePush(tags, fallback);
  }
  return tags.slice(0, 5);
}

function summaryFor(file, result) {
  const path = file.path;
  const name = basename(path);
  const stem = name.replace(/\.[^.]+$/, '');
  const type = fileNodeType(file);
  const domain = domainFromPath(path).replace(/-/g, ' ');
  const metrics = result?.metrics ?? {};

  if (path === 'README.md') {
    return 'Project overview documentation for the ORISO frontend, including stack, local development commands, and links to architecture and engineering docs.';
  }
  if (type === 'document') {
    return `Documentation covering ${domain} concerns in the ORISO frontend.`;
  }
  if (type === 'config') {
    return `Configuration file that controls ${domain} behavior for the frontend project.`;
  }
  if (type === 'pipeline') {
    return `CI/CD pipeline configuration for frontend build, test, or deployment workflow.`;
  }
  if (type === 'service') {
    return `Infrastructure or service definition used to build, serve, or deploy the frontend application.`;
  }
  if (path.startsWith('src/api/')) {
    return `API client module for ${stem}, connecting frontend flows to backend Online-Beratung services.`;
  }
  if (path.startsWith('src/hooks/') || stem.startsWith('use')) {
    return `React hook module for ${stem}, encapsulating reusable frontend state or side-effect logic.`;
  }
  if (path.includes('/components/') || path.endsWith('.tsx')) {
    return `React UI module for ${domain}, contributing component behavior and presentation to the ORISO frontend.`;
  }
  if (path.includes('globalState')) {
    return `Global state module for ${domain}, sharing application state across frontend flows.`;
  }
  if (path.endsWith('.scss') || path.endsWith('.css')) {
    return `Stylesheet for ${domain}, defining frontend presentation rules and visual tokens.`;
  }
  if (metrics.functionCount || metrics.classCount) {
    return `TypeScript module for ${domain} with ${metrics.functionCount ?? 0} extracted functions and ${metrics.classCount ?? 0} extracted classes.`;
  }
  return `Frontend source file for ${domain} in the ORISO React application.`;
}

function childSummary(kind, file, item) {
  if (kind === 'function') return `Function ${item.name} in ${file.path}, used by the surrounding ${domainFromPath(file.path).replace(/-/g, ' ')} module.`;
  if (kind === 'class') return `Class ${item.name} in ${file.path}, grouping related ${domainFromPath(file.path).replace(/-/g, ' ')} behavior.`;
  if (kind === 'service') return `Service definition ${item.name} declared in ${file.path}.`;
  if (kind === 'resource') return `Infrastructure resource ${item.name} declared in ${file.path}.`;
  if (kind === 'endpoint') return `API endpoint ${item.method ?? ''} ${item.path ?? item.name} declared in ${file.path}.`.replace(/\s+/g, ' ');
  return `${kind} ${item.name} declared in ${file.path}.`;
}

function addEdge(edges, seenEdges, source, target, type, weight) {
  if (!source || !target || source === target) return;
  const key = `${source}\0${target}\0${type}`;
  if (seenEdges.has(key)) return;
  seenEdges.add(key);
  edges.push({ source, target, type, direction: 'forward', weight });
}

function addNode(nodes, seenNodes, node) {
  if (!node.id || seenNodes.has(node.id)) return false;
  seenNodes.add(node.id);
  nodes.push(node);
  return true;
}

function exportedNameSet(result) {
  const set = new Set();
  for (const exp of result?.exports ?? []) {
    if (exp.name) set.add(exp.name);
    if (exp.isDefault) set.add('default');
  }
  return set;
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

function fastAnalyzeFile(file) {
  let content = '';
  try {
    content = readFileSync(join(projectRoot, file.path), 'utf8');
  } catch {
    return {
      path: file.path,
      language: file.language,
      fileCategory: file.fileCategory,
      totalLines: file.sizeLines ?? 0,
      nonEmptyLines: file.sizeLines ?? 0,
      metrics: {},
    };
  }

  const lines = content.split('\n');
  const totalLines = content.endsWith('\n') ? Math.max(0, lines.length - 1) : lines.length;
  const nonEmptyLines = lines.filter((line) => line.trim()).length;
  const functions = [];
  const classes = [];
  const exports = [];

  if (['typescript', 'javascript'].includes(file.language)) {
    const functionPatterns = [
      /\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
      /\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?/g,
      /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
    ];
    for (const pattern of functionPatterns) {
      for (const match of content.matchAll(pattern)) {
        const startLine = lineNumberAt(content, match.index ?? 0);
        const name = match[1];
        if (!functions.some((fn) => fn.name === name && fn.startLine === startLine)) {
          functions.push({ name, startLine, endLine: Math.min(totalLines, startLine + 12), params: [] });
        }
        if (match[0].startsWith('export')) exports.push({ name, line: startLine, isDefault: false });
      }
    }

    for (const match of content.matchAll(/\bexport\s+default\s+(?:function|class)?\s*([A-Za-z_$][\w$]*)?/g)) {
      exports.push({ name: match[1] || 'default', line: lineNumberAt(content, match.index ?? 0), isDefault: true });
    }

    for (const match of content.matchAll(/\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)|\bclass\s+([A-Za-z_$][\w$]*)/g)) {
      const startLine = lineNumberAt(content, match.index ?? 0);
      const name = match[1] || match[2];
      if (!classes.some((cls) => cls.name === name && cls.startLine === startLine)) {
        classes.push({ name, startLine, endLine: Math.min(totalLines, startLine + 40), methods: [], properties: [] });
      }
      if (match[1]) exports.push({ name, line: startLine, isDefault: false });
    }
  }

  const result = {
    path: file.path,
    language: file.language,
    fileCategory: file.fileCategory,
    totalLines,
    nonEmptyLines,
    metrics: {
      importCount: (importMap[file.path] ?? []).length,
      exportCount: exports.length,
      functionCount: functions.length,
      classCount: classes.length,
    },
  };
  if (functions.length) result.functions = functions;
  if (classes.length) result.classes = classes;
  if (exports.length) result.exports = exports;
  return result;
}

function analyzeBatch(batch) {
  const inputPath = join(tmpDir, `ua-file-analyzer-input-${batch.batchIndex}.json`);
  const extractPath = join(tmpDir, `ua-file-extract-results-${batch.batchIndex}.json`);
  writeFileSync(inputPath, JSON.stringify({
    projectRoot,
    batchFiles: batch.files,
    batchImportData: batch.batchImportData ?? {},
  }, null, 2));

  let extraction;
  let extractionFallback = !useExtraction;
  if (!useExtraction) {
    extraction = {
      scriptCompleted: false,
      filesAnalyzed: batch.files.length,
      filesSkipped: [],
      results: batch.files.map(fastAnalyzeFile),
      fallbackReason: 'fast deterministic scan path',
    };
  } else {
    const run = spawnSync('node', [
      join(skillDir, 'extract-structure.mjs'),
      inputPath,
      extractPath,
    ], { encoding: 'utf8', timeout: 30000 });

    if (run.status !== 0 || !existsSync(extractPath)) {
      extractionFallback = true;
      extraction = {
        scriptCompleted: false,
        filesAnalyzed: batch.files.length,
        filesSkipped: [],
        results: batch.files.map(fastAnalyzeFile),
        fallbackReason: run.error?.message || run.stderr || run.stdout || 'unknown extraction failure',
      };
    } else {
      extraction = JSON.parse(readFileSync(extractPath, 'utf8'));
    }
  }

  const resultByPath = new Map(extraction.results.map((result) => [result.path, result]));
  const nodes = [];
  const edges = [];
  const seenNodes = new Set();
  const seenEdges = new Set();

  for (const file of batch.files) {
    const result = resultByPath.get(file.path);
    const type = fileNodeType(file);
    const id = fileNodeId(file.path);
    const fileNode = {
      id,
      type,
      name: basename(file.path),
      filePath: file.path,
      summary: summaryFor(file, result),
      tags: tagsFor(file, result),
      complexity: complexity(result?.nonEmptyLines ?? file.sizeLines ?? 0),
    };
    addNode(nodes, seenNodes, fileNode);

    const exports = exportedNameSet(result);
    const childIdsByName = new Map();
    const childNameCounts = new Map();

    for (const fn of result?.functions ?? []) {
      const fnLines = Math.max(0, (fn.endLine ?? fn.startLine ?? 0) - (fn.startLine ?? 0) + 1);
      const exported = exports.has(fn.name) || exports.has('default');
      if (!exported && fnLines < 10) continue;
      const baseName = cleanChildName(fn.name, 'function');
      const count = (childNameCounts.get(`function:${baseName}`) ?? 0) + 1;
      childNameCounts.set(`function:${baseName}`, count);
      const childName = count === 1 ? baseName : `${baseName}_${fn.startLine ?? count}`;
      const childId = `function:${file.path}:${childName}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'function',
        name: fn.name || childName,
        filePath: file.path,
        lineRange: [fn.startLine ?? 1, fn.endLine ?? fn.startLine ?? 1],
        summary: childSummary('function', file, fn),
        tags: ['function', domainFromPath(file.path), exported ? 'exported' : 'internal'].slice(0, 5),
        complexity: complexity(fnLines),
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
        if (exported) addEdge(edges, seenEdges, id, childId, 'exports', 0.8);
        childIdsByName.set(fn.name, childId);
      }
    }

    for (const cls of result?.classes ?? []) {
      const clsLines = Math.max(0, (cls.endLine ?? cls.startLine ?? 0) - (cls.startLine ?? 0) + 1);
      const methodCount = Array.isArray(cls.methods) ? cls.methods.length : 0;
      const exported = exports.has(cls.name) || exports.has('default');
      if (!exported && methodCount < 2 && clsLines < 20) continue;
      const className = cleanChildName(cls.name, 'class');
      const childId = `class:${file.path}:${className}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'class',
        name: cls.name || className,
        filePath: file.path,
        lineRange: [cls.startLine ?? 1, cls.endLine ?? cls.startLine ?? 1],
        summary: childSummary('class', file, cls),
        tags: ['class', domainFromPath(file.path), exported ? 'exported' : 'internal'].slice(0, 5),
        complexity: complexity(clsLines),
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
        if (exported) addEdge(edges, seenEdges, id, childId, 'exports', 0.8);
        childIdsByName.set(cls.name, childId);
      }
    }

    for (const service of result?.services ?? []) {
      const name = cleanChildName(service.name, 'service');
      const childId = `service:${file.path}:${name}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'service',
        name: service.name || name,
        filePath: file.path,
        lineRange: service.startLine ? [service.startLine, service.endLine ?? service.startLine] : undefined,
        summary: childSummary('service', file, service),
        tags: ['service', 'infrastructure', 'deployment'],
        complexity: 'simple',
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
      }
    }

    for (const resource of result?.resources ?? []) {
      const name = cleanChildName(resource.name, 'resource');
      const childId = `resource:${file.path}:${name}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'resource',
        name: resource.name || name,
        filePath: file.path,
        lineRange: resource.startLine ? [resource.startLine, resource.endLine ?? resource.startLine] : undefined,
        summary: childSummary('resource', file, resource),
        tags: ['resource', 'infrastructure', 'deployment'],
        complexity: 'simple',
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
      }
    }

    for (const endpoint of result?.endpoints ?? []) {
      const endpointName = `${endpoint.method ?? 'GET'}-${endpoint.path ?? 'endpoint'}`;
      const childId = `endpoint:${file.path}:${cleanChildName(endpointName, 'endpoint')}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'endpoint',
        name: `${endpoint.method ?? 'GET'} ${endpoint.path ?? endpointName}`,
        filePath: file.path,
        lineRange: [endpoint.startLine ?? 1, endpoint.endLine ?? endpoint.startLine ?? 1],
        summary: childSummary('endpoint', file, endpoint),
        tags: ['endpoint', 'api-schema', 'schema-definition'],
        complexity: 'simple',
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
      }
    }

    for (const def of result?.definitions ?? []) {
      if (!['message', 'service', 'type', 'interface', 'enum', 'input'].includes(def.kind)) continue;
      const name = cleanChildName(def.name, 'schema');
      const childId = `schema:${file.path}:${name}`;
      if (addNode(nodes, seenNodes, {
        id: childId,
        type: 'schema',
        name: def.name || name,
        filePath: file.path,
        lineRange: [def.startLine ?? 1, def.endLine ?? def.startLine ?? 1],
        summary: childSummary('schema', file, def),
        tags: ['schema-definition', 'data-model', def.kind || 'definition'],
        complexity: 'simple',
      })) {
        addEdge(edges, seenEdges, id, childId, 'contains', 1.0);
      }
    }

    for (const targetPath of importMap[file.path] ?? []) {
      addEdge(edges, seenEdges, id, fileNodeId(targetPath), 'imports', 0.7);
    }

    for (const call of result?.callGraph ?? []) {
      const source = childIdsByName.get(call.caller);
      const target = childIdsByName.get(call.callee);
      if (source && target) addEdge(edges, seenEdges, source, target, 'calls', 0.8);
    }

    if (type === 'config') {
      for (const candidate of ['src/initApp.tsx', 'src/App.tsx', 'index.ts']) {
        if (fileByPath.has(candidate)) {
          addEdge(edges, seenEdges, id, fileNodeId(candidate), 'configures', 0.6);
          break;
        }
      }
    }
    if (type === 'document') {
      for (const candidate of ['README.md', 'src/initApp.tsx', 'src/App.tsx', 'index.ts']) {
        if (candidate !== file.path && fileByPath.has(candidate)) {
          addEdge(edges, seenEdges, id, fileNodeId(candidate), candidate === 'README.md' ? 'related' : 'documents', 0.5);
          break;
        }
      }
    }
    if (type === 'service' || type === 'pipeline' || type === 'resource') {
      for (const candidate of ['src/initApp.tsx', 'src/App.tsx', 'index.ts']) {
        if (fileByPath.has(candidate)) {
          addEdge(edges, seenEdges, id, fileNodeId(candidate), type === 'pipeline' ? 'triggers' : 'deploys', type === 'pipeline' ? 0.6 : 0.7);
          break;
        }
      }
    }
  }

  const outPath = join(intermediateDir, `batch-${batch.batchIndex}.json`);
  writeFileSync(outPath, JSON.stringify({ nodes, edges }, null, 2));
  return {
    batchIndex: batch.batchIndex,
    files: batch.files.length,
    nodes: nodes.length,
    edges: edges.length,
    skipped: extraction.filesSkipped ?? [],
    extractionFallback,
    fallbackReason: extraction.fallbackReason,
  };
}

const summaries = [];
const onlyBatch = process.env.UA_BATCH ? Number(process.env.UA_BATCH) : null;
for (const batch of batchesDoc.batches) {
  if (onlyBatch && batch.batchIndex !== onlyBatch) continue;
  console.error(`start batch ${batch.batchIndex}/${batchesDoc.totalBatches}`);
  const summary = analyzeBatch(batch);
  summaries.push(summary);
  console.log(`batch ${summary.batchIndex}/${batchesDoc.totalBatches}: files=${summary.files} nodes=${summary.nodes} edges=${summary.edges}`);
}

writeFileSync(join(intermediateDir, 'local-analysis-summary.json'), JSON.stringify({
  batches: summaries,
  totals: summaries.reduce((acc, row) => {
    acc.files += row.files;
    acc.nodes += row.nodes;
    acc.edges += row.edges;
    acc.skipped += row.skipped.length;
    return acc;
  }, { files: 0, nodes: 0, edges: 0, skipped: 0 }),
}, null, 2));
