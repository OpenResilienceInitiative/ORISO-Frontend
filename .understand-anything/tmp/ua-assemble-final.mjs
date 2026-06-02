#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const projectRoot = process.cwd();
const uaDir = join(projectRoot, '.understand-anything');
const intermediateDir = join(uaDir, 'intermediate');
mkdirSync(intermediateDir, { recursive: true });

const scan = JSON.parse(readFileSync(join(intermediateDir, 'scan-result.json'), 'utf8'));
const assembled = JSON.parse(readFileSync(join(intermediateDir, 'assembled-graph.json'), 'utf8'));
const fileLevelTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
const nodes = assembled.nodes;
const edges = assembled.edges;
const nodeIds = new Set(nodes.map((node) => node.id));
const fileNodes = nodes.filter((node) => fileLevelTypes.has(node.type) && node.filePath);

function gitCommitHash() {
  const run = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' });
  return run.status === 0 ? run.stdout.trim() : 'unknown';
}

function fileNodeId(path) {
  const node = fileNodes.find((candidate) => candidate.filePath === path);
  return node?.id;
}

function pick(...paths) {
  return paths.map(fileNodeId).filter(Boolean);
}

function addLayer(layers, id, name, description, predicate) {
  const nodeIdsForLayer = fileNodes
    .filter((node) => predicate(node.filePath, node))
    .map((node) => node.id);
  if (nodeIdsForLayer.length) {
    layers.push({ id, name, description, nodeIds: nodeIdsForLayer });
  }
}

const assigned = new Set();
function unassigned(predicate) {
  return (path, node) => !assigned.has(node.id) && predicate(path, node);
}
function pushLayer(layers, id, name, description, predicate) {
  const before = layers.length;
  addLayer(layers, id, name, description, unassigned(predicate));
  if (layers.length > before) {
    for (const id of layers[layers.length - 1].nodeIds) assigned.add(id);
  }
}

const layers = [];
pushLayer(layers, 'layer:application-shell', 'Application Shell', 'Entrypoints, bootstrap code, top-level app composition, and routing shell files.', (path) =>
  ['index.ts', 'src/index.ts', 'src/App.tsx', 'src/initApp.tsx', 'src/initError.tsx', 'src/polyfill.ts'].includes(path) ||
  path.includes('/app/') || path.endsWith('.routes.ts'));
pushLayer(layers, 'layer:auth-registration-session', 'Auth Registration Session', 'Authentication, registration, invite links, session handling, and access-token flows.', (path) =>
  /auth|login|logout|keycloak|registration|invite|session|anonymous/i.test(path));
pushLayer(layers, 'layer:api-integrations', 'API Integrations', 'API client modules and backend integration helpers used by frontend features.', (path) =>
  path.startsWith('src/api/') || path.includes('fetchData') || path.includes('endpoints'));
pushLayer(layers, 'layer:messaging-realtime', 'Messaging Realtime', 'Matrix, LiveKit, chat, message, upload, attachment, and realtime communication modules.', (path) =>
  /matrix|livekit|chat|message|attachment|video|call/i.test(path));
pushLayer(layers, 'layer:features', 'Feature Areas', 'Business feature screens and containers for bookings, profile, appointments, tools, and related user flows.', (path) =>
  path.startsWith('src/containers/') || /booking|profile|calendar|appointment|tool/i.test(path));
pushLayer(layers, 'layer:ui-components', 'UI Components', 'Reusable React components, visual primitives, modals, forms, and presentation modules.', (path) =>
  path.startsWith('src/components/') || path.endsWith('.tsx'));
pushLayer(layers, 'layer:state-hooks-utils', 'State Hooks Utilities', 'Shared hooks, global state, utility functions, and cross-cutting frontend helpers.', (path) =>
  path.startsWith('src/hooks/') || path.startsWith('src/globalState/') || path.startsWith('src/utils/') || /helper|util|context|atom/i.test(path));
pushLayer(layers, 'layer:localization-styling-resources', 'Localization Styling Resources', 'Translations, resources, stylesheets, static public files, and theming assets.', (path) =>
  path.startsWith('src/resources/') || path.startsWith('public/') || /\.(css|scss|sass)$/.test(path) || /i18n|theme|locale|style/i.test(path));
pushLayer(layers, 'layer:tests-stories', 'Tests Stories', 'Cypress tests, Storybook setup, component stories, test fixtures, and visual development files.', (path) =>
  path.startsWith('cypress/') || path.includes('.stories.') || path.includes('.spec.') || path.startsWith('.storybook'));
pushLayer(layers, 'layer:build-tooling-config', 'Build Tooling Config', 'Webpack, scripts, package manifests, TypeScript settings, proxy setup, linting, and local tooling configuration.', (path, node) =>
  node.type === 'config' || path.startsWith('config/') || path.startsWith('scripts/') || path.startsWith('proxy/') || ['package.json', 'tsconfig.json', 'cli.js'].includes(path));
pushLayer(layers, 'layer:deployment-infrastructure', 'Deployment Infrastructure', 'Docker, Kubernetes, ingress, service, and deployment descriptors for frontend delivery.', (path, node) =>
  ['service', 'pipeline', 'resource'].includes(node.type) || /docker|deployment|service|ingress|k8s|kubernetes|yaml|yml/i.test(path));
pushLayer(layers, 'layer:documentation', 'Documentation', 'Architecture, project, roadmap, Matrix integration, and engineering documentation.', (path, node) =>
  node.type === 'document' || path.startsWith('docs/') || path.endsWith('.md'));
pushLayer(layers, 'layer:other-project-files', 'Other Project Files', 'Remaining tracked files that do not fit the primary architectural groups.', () => true);

const tour = [
  {
    order: 1,
    title: 'Project Overview',
    description: 'Start with the project README and package manifest to understand the ORISO frontend purpose, stack, and available development commands.',
    nodeIds: pick('README.md', 'package.json'),
  },
  {
    order: 2,
    title: 'Application Bootstrap',
    description: 'Follow the frontend entrypoint through initialization and app-shell composition.',
    nodeIds: pick('index.ts', 'src/initApp.tsx', 'src/App.tsx', 'src/components/app/AuthenticatedApp.tsx'),
  },
  {
    order: 3,
    title: 'Backend API Boundary',
    description: 'Inspect the generated and handwritten API client boundary that connects React flows to backend Online-Beratung services.',
    nodeIds: pick('src/api/index.ts', 'src/api/fetchData.ts', 'src/resources/scripts/endpoints.ts'),
  },
  {
    order: 4,
    title: 'Authentication And Invites',
    description: 'Review auth, auto-login, invite-link, anonymous-session, and session guard modules that control access-sensitive user flows.',
    nodeIds: pick('src/components/registration/autoLogin.ts', 'src/components/invite/InviteLink.tsx', 'src/utils/anonymousSessionFetchGuard.ts', 'src/hooks/useJoinGroupChat.ts'),
  },
  {
    order: 5,
    title: 'Messaging And Realtime',
    description: 'Trace the Matrix and realtime messaging area through message UI, upload helpers, chat room APIs, and group-call integration.',
    nodeIds: pick('src/api/apiGetChatRoomById.ts', 'src/components/message/MessageAttachment.tsx', 'src/components/messageSubmitInterface/useDraftMessage.tsx'),
  },
  {
    order: 6,
    title: 'State Hooks And Configuration',
    description: 'Look at shared state, app config hooks, and utility modules that many feature components depend on.',
    nodeIds: pick('src/globalState/index.ts', 'src/hooks/useAppConfig.tsx', 'src/components/app/TenantThemingLoader.tsx'),
  },
  {
    order: 7,
    title: 'Features And Screens',
    description: 'Explore profile, bookings, sessions list, and other feature-oriented modules that compose the user-facing product workflows.',
    nodeIds: pick('src/components/profile/profile.routes.ts', 'src/containers/bookings/booking.routes.ts', 'src/components/sessionsList/SessionsList.tsx'),
  },
  {
    order: 8,
    title: 'Quality And Delivery',
    description: 'Finish with test, Storybook, build, Docker, and Kubernetes files that support verification and deployment.',
    nodeIds: pick('cypress.config.js', '.storybook/main.ts', 'config/webpack.config.js', 'Dockerfile', 'deployment-v2.yaml', 'ingress.yaml'),
  },
].filter((step) => step.nodeIds.length > 0);

const graph = {
  version: '1.0.0',
  project: {
    name: scan.name || 'ORISO Frontend',
    languages: scan.languages || [],
    frameworks: scan.frameworks || [],
    description: scan.description || 'Frontend application for the ORISO Online-Beratung platform.',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: gitCommitHash(),
  },
  nodes,
  edges: edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  layers,
  tour,
};

const issues = [];
const assignedLayerNodes = new Set();
for (const layer of graph.layers) {
  for (const id of layer.nodeIds) {
    if (!nodeIds.has(id)) issues.push(`Layer ${layer.id} references missing node ${id}`);
    if (assignedLayerNodes.has(id)) issues.push(`Node ${id} appears in multiple layers`);
    assignedLayerNodes.add(id);
  }
}
for (const node of fileNodes) {
  if (!assignedLayerNodes.has(node.id)) issues.push(`File node ${node.id} is not assigned to a layer`);
}
for (const step of graph.tour) {
  for (const id of step.nodeIds) {
    if (!nodeIds.has(id)) issues.push(`Tour step ${step.order} references missing node ${id}`);
  }
}

const stats = {
  totalNodes: graph.nodes.length,
  totalEdges: graph.edges.length,
  totalLayers: graph.layers.length,
  tourSteps: graph.tour.length,
  nodeTypes: graph.nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {}),
  edgeTypes: graph.edges.reduce((acc, edge) => {
    acc[edge.type] = (acc[edge.type] || 0) + 1;
    return acc;
  }, {}),
};

writeFileSync(join(intermediateDir, 'assembled-graph.json'), JSON.stringify(graph, null, 2));
writeFileSync(join(intermediateDir, 'review.json'), JSON.stringify({ issues, warnings: [], stats }, null, 2));
writeFileSync(join(uaDir, 'knowledge-graph.json'), JSON.stringify(graph, null, 2));
writeFileSync(join(uaDir, 'meta.json'), JSON.stringify({
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash: graph.project.gitCommitHash,
  version: graph.version,
  analyzedFiles: scan.totalFiles,
}, null, 2));

console.log(JSON.stringify({ issues: issues.length, stats }, null, 2));
