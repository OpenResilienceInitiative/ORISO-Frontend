import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	rmSync,
	readFileSync
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = new URL('../config/vite-product-config.mjs', import.meta.url)
	.href;
const directories = [];
afterEach(() =>
	directories
		.splice(0)
		.forEach((directory) =>
			rmSync(directory, { recursive: true, force: true })
		)
);
const fixture = (files = {}, outside = false) => {
	const cache = outside ? tmpdir() : path.join(root, 'node_modules/.cache');
	mkdirSync(cache, { recursive: true });
	const directory = mkdtempSync(path.join(cache, 'product-env-'));
	directories.push(directory);
	writeFileSync(
		path.join(directory, 'package.json'),
		JSON.stringify({ name: 'controlled-product-fixture' })
	);
	Object.entries(files).forEach(([name, value]) =>
		writeFileSync(path.join(directory, name), value)
	);
	return directory;
};
const inspect = (directory, shell = {}, mode = 'production') => {
	const code = `const {loadProductEnvironment}=await import(${JSON.stringify(helper)});
const {createRequire}=await import('node:module');
const result=loadProductEnvironment({root:${JSON.stringify(directory)},mode:${JSON.stringify(mode)}});
const require=createRequire(${JSON.stringify(path.join(root, 'package.json'))});
const canonical=require(${JSON.stringify(path.join(root, 'config/env.js'))})(result.raw.PUBLIC_URL).raw;
process.stdout.write(JSON.stringify({raw:result.raw,define:result.define,paths:result.paths,build:result.build,canonical}));`;
	const env = { PATH: process.env.PATH, HOME: process.env.HOME, ...shell };
	const child = spawnSync(
		process.execPath,
		['--input-type=module', '-e', code],
		{ cwd: root, env, encoding: 'utf8' }
	);
	assert.equal(child.status, 0, child.stderr);
	return JSON.parse(child.stdout);
};

test('permits only canonical public keys and paired process definitions', () => {
	const value = inspect(fixture(), {
		REACT_APP_VISIBLE: 'public-value',
		react_app_lowercase: 'lowercase-public',
		PRIVATE_SECRET_TRAP: 'PRIVATE_VALUE_MUST_NEVER_COMPILE',
		VITE_SECRET_TRAP: 'VITE_VALUE_MUST_NEVER_COMPILE',
		WDS_SOCKET_HOST: 'socket.example',
		WDS_SOCKET_PATH: '/sock',
		WDS_SOCKET_PORT: '7777',
		FAST_REFRESH: 'false'
	});
	assert.equal(value.raw.REACT_APP_VISIBLE, 'public-value');
	assert.equal(value.raw.react_app_lowercase, 'lowercase-public');
	assert.equal(value.raw.FAST_REFRESH, false);
	assert.equal(value.raw.WDS_SOCKET_PORT, '7777');
	assert.deepEqual(JSON.parse(value.define.process).env, value.raw);
	assert.deepEqual(JSON.parse(value.define['process.env']), value.raw);
	assert.doesNotMatch(
		JSON.stringify(value),
		/PRIVATE_SECRET_TRAP|PRIVATE_VALUE_MUST_NEVER_COMPILE|VITE_SECRET_TRAP|VITE_VALUE_MUST_NEVER_COMPILE/
	);
});

test('preserves dotenv priority, expansion and shell precedence', () => {
	const directory = fixture({
		'.env.production.local': `REACT_APP_PRIORITY=production-local\nREACT_APP_SHELL=dotenv-value\nREACT_APP_EXPANDED=\${REACT_APP_SHELL}/expanded\n`,
		'.env.local': 'REACT_APP_PRIORITY=local\nREACT_APP_LOCAL=local-only\n',
		'.env.production':
			'REACT_APP_PRIORITY=production\nREACT_APP_MODE=production-only\n',
		'.env': 'REACT_APP_PRIORITY=base\nREACT_APP_BASE=base-only\nPRIVATE_ENV_TRAP=must-not-compile\n'
	});
	const value = inspect(directory, { REACT_APP_SHELL: 'from-shell' });
	assert.equal(value.raw.REACT_APP_PRIORITY, 'production-local');
	assert.equal(value.raw.REACT_APP_SHELL, 'from-shell');
	assert.equal(value.raw.REACT_APP_EXPANDED, 'from-shell/expanded');
	assert.equal(value.raw.REACT_APP_LOCAL, 'local-only');
	assert.equal(value.raw.REACT_APP_MODE, 'production-only');
	assert.equal(value.raw.REACT_APP_BASE, 'base-only');
	assert.equal('PRIVATE_ENV_TRAP' in value.raw, false);
});

test('omits .env.local only in test mode', () => {
	const directory = fixture({
		'.env.local': 'REACT_APP_LOCAL=local-only\n',
		'.env.test': 'REACT_APP_TEST=test-only\n',
		'.env.test.local': 'REACT_APP_FIRST=test-local\n'
	});
	const testing = inspect(directory, {}, 'test');
	assert.equal(testing.raw.REACT_APP_LOCAL, undefined);
	assert.equal(testing.raw.REACT_APP_TEST, 'test-only');
	assert.equal(testing.raw.REACT_APP_FIRST, 'test-local');
	assert.equal(
		inspect(directory, {}, 'development').raw.REACT_APP_LOCAL,
		'local-only'
	);
});

test('uses actual checkout SHA despite shell and dotenv commit spoofing', () => {
	const directory = fixture({
		'.env.production.local': 'REACT_APP_BUILD_COMMIT=dotenv-spoof\n'
	});
	const value = inspect(directory, {
		REACT_APP_BUILD_COMMIT: '1111111111111111111111111111111111111111'
	});
	const actual = execFileSync(
		'git',
		['rev-parse', '--verify', 'HEAD^{commit}'],
		{ cwd: root, encoding: 'utf8' }
	).trim();
	assert.match(actual, /^[a-f0-9]{40}$/);
	assert.equal(value.raw.REACT_APP_BUILD_COMMIT, actual);
	assert.equal(
		JSON.parse(value.define.process).env.REACT_APP_BUILD_COMMIT,
		actual
	);
});

test('rejects a source root outside a Git checkout', () => {
	assert.throws(
		() => inspect(fixture({}, true)),
		/Git checkout|not a git repository/i
	);
});

test('maps PUBLIC_URL, BUILD_PATH and extension path through existing path policy', () => {
	const directory = fixture();
	const value = inspect(directory, {
		PUBLIC_URL: '/tenant-base/',
		BUILD_PATH: 'candidate-output',
		EXTENSION_DIR: 'custom-extension'
	});
	assert.equal(value.raw.PUBLIC_URL, '/tenant-base');
	assert.equal(value.paths.publicUrlOrPath, '/tenant-base/');
	assert.equal(
		value.paths.appBuild,
		path.join(directory, 'candidate-output')
	);
	assert.equal(
		value.paths.appExtensions,
		path.join(directory, 'custom-extension')
	);
});

test('preserves default sourcemap and asset inline controls and explicit overrides', () => {
	const directory = fixture();
	assert.deepEqual(inspect(directory).build, {
		sourcemap: true,
		assetsInlineLimit: 10000
	});
	assert.deepEqual(
		inspect(directory, {
			GENERATE_SOURCEMAP: 'false',
			IMAGE_INLINE_SIZE_LIMIT: '0'
		}).build,
		{ sourcemap: false, assetsInlineLimit: 0 }
	);
});

test('uses normal Vite build/dev while retaining Express production start', () => {
	const { scripts } = JSON.parse(
		readFileSync(path.join(root, 'package.json'), 'utf8')
	);
	assert.equal(scripts.build, 'node scripts/build-vite.mjs');
	assert.equal(scripts.dev, 'node scripts/start-vite.mjs');
	assert.equal(scripts.start, 'node proxy/server.js');
	assert.equal(Object.hasOwn(scripts, 'postbuild'), false);
});

test('matches canonical client environment policy for every non-commit key', () => {
	const value = inspect(fixture(), {
		REACT_APP_VISIBLE: 'visible',
		WDS_SOCKET_HOST: 'hmr.example',
		NON_PUBLIC: 'private'
	});
	const { REACT_APP_BUILD_COMMIT: compiled, ...raw } = value.raw;
	const { REACT_APP_BUILD_COMMIT: original, ...canonical } = value.canonical;
	assert.deepEqual(raw, canonical);
	assert.match(compiled, /^[a-f0-9]{40}$/);
	assert.equal(original, '');
});
