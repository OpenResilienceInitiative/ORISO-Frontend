import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
	cpSync,
	mkdtempSync,
	mkdirSync,
	writeFileSync,
	readFileSync,
	rmSync
} from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directories = [];
const originalEnv = { ...process.env };
afterEach(() => {
	directories
		.splice(0)
		.forEach((directory) =>
			rmSync(directory, { recursive: true, force: true })
		);
	Object.keys(process.env).forEach((key) => delete process.env[key]);
	Object.assign(process.env, originalEnv);
});
const fixture = () => {
	const cache = path.join(root, 'node_modules/.cache');
	mkdirSync(cache, { recursive: true });
	const directory = mkdtempSync(path.join(cache, 'product-html-'));
	directories.push(directory);
	for (const folder of ['src/pages', 'src/extensions/pages', 'public'])
		mkdirSync(path.join(directory, folder), { recursive: true });
	writeFileSync(
		path.join(directory, 'package.json'),
		JSON.stringify({ name: 'tiny-controlled-product' })
	);
	for (const name of ['app', 'under-construction'])
		writeFileSync(
			path.join(directory, `src/pages/${name}.html`),
			readFileSync(path.join(root, `src/pages/${name}.html`))
		);
	writeFileSync(
		path.join(directory, 'src/initApp.js'),
		'globalThis.__TINY_PRODUCT_ENTRY__="app";\n'
	);
	writeFileSync(
		path.join(directory, 'src/initError.js'),
		'globalThis.__TINY_PRODUCT_ENTRY__="error";\n'
	);
	writeFileSync(
		path.join(directory, 'public/config.js'),
		'globalThis.REACT_APP_API_URL="https://controlled.example";\n'
	);
	return {
		root: directory,
		paths: {
			appPath: directory,
			appSrc: path.join(directory, 'src'),
			appExtensions: path.join(directory, 'src/extensions'),
			appEntryPoints: {
				app: path.join(directory, 'src/initApp.js'),
				error: path.join(directory, 'src/initError.js')
			}
		},
		raw: { PUBLIC_URL: '/brand' }
	};
};
const html = () => import('../config/vite-product-html.mjs');
const pageNames = [
	'beratung-hilfe.html',
	'error.400.html',
	'error.401.html',
	'error.404.html',
	'error.500.html',
	'under-construction.html'
];
const assertConfigFirst = (value) => {
	const config = value.indexOf('src="/brand/config.js"');
	const module = value.search(/<script\b[^>]*type="module"/);
	assert.ok(
		config >= 0 && module >= 0 && config < module,
		'runtime config.js must precede every module entry'
	);
};

test('renders six canonical outputs with original roots and error status attributes', async () => {
	const { renderProductPage } = await html();
	const environment = fixture();
	for (const name of pageNames) {
		const result = renderProductPage(environment, name);
		assert.doesNotMatch(
			result,
			/<%|%PUBLIC_URL%|__REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL__/
		);
		if (name === 'under-construction.html') continue;
		assert.match(result, /id="banner"/);
		assert.match(result, /id="overlay"/);
		assert.match(result, /name="google" content="notranslate"/);
		assertConfigFirst(result);
		if (name === 'beratung-hilfe.html')
			assert.match(result, /id="appRoot"/);
		else {
			assert.match(result, /id="errorRoot"/);
			assert.ok(
				result.includes(`data-errortype="${name.split('.')[1]}"`)
			);
		}
	}
});

test('prefers a regular extension template and falls back for a directory', async () => {
	const { renderProductPage } = await html();
	const environment = fixture();
	const target = path.join(environment.paths.appExtensions, 'pages/app.html');
	writeFileSync(
		target,
		readFileSync(
			path.join(environment.paths.appSrc, 'pages/app.html'),
			'utf8'
		).replace('<body ', '<body data-extension="selected" ')
	);
	assert.match(
		renderProductPage(environment, 'beratung-hilfe.html'),
		/data-extension="selected"/
	);
	rmSync(target);
	mkdirSync(target);
	assert.doesNotMatch(
		renderProductPage(environment, 'beratung-hilfe.html'),
		/data-extension="selected"/
	);
});

test('interpolates only public markers and rejects unresolved markers', async () => {
	const { renderProductPage } = await html();
	const environment = fixture();
	environment.raw.REACT_APP_VISIBLE = 'visible-public';
	const template = readFileSync(
		path.join(environment.paths.appSrc, 'pages/app.html'),
		'utf8'
	);
	const target = path.join(environment.paths.appExtensions, 'pages/app.html');
	writeFileSync(
		target,
		template.replace(
			'</head>',
			'<meta content="%REACT_APP_VISIBLE%"></head>'
		)
	);
	assert.match(
		renderProductPage(environment, 'beratung-hilfe.html'),
		/visible-public/
	);
	writeFileSync(
		target,
		template.replace('</head>', '<meta content="%PRIVATE_TRAP%"></head>')
	);
	assert.throws(
		() => renderProductPage(environment, 'beratung-hilfe.html'),
		/unresolved|unknown.*marker/i
	);
});

test('preserves maintenance online URL, home URL and slash fallback', async () => {
	const { renderProductPage } = await html();
	const environment = fixture();
	environment.raw.REACT_APP_ORGANIZATION_HOME_URL = 'https://home.example';
	environment.raw.REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL =
		'https://online.example';
	assert.match(
		renderProductPage(environment, 'under-construction.html'),
		/href="https:\/\/online.example"/
	);
	delete environment.raw.REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL;
	assert.match(
		renderProductPage(environment, 'under-construction.html'),
		/href="https:\/\/home.example"/
	);
	delete environment.raw.REACT_APP_ORGANIZATION_HOME_URL;
	assert.match(
		renderProductPage(environment, 'under-construction.html'),
		/href="\/"/
	);
});

test('rejects unknown pages and malformed or duplicate runtime config scripts', async () => {
	const { renderProductPage, runtimeConfigBeforeModules } = await html();
	const environment = fixture();
	assert.throws(
		() => renderProductPage(environment, '../private.html'),
		/unknown.*page/i
	);
	assert.throws(
		() =>
			runtimeConfigBeforeModules(
				'<script type="module" src="/entry.js"></script>',
				'/brand'
			),
		/config\.js/
	);
	const config = '<script src="/brand/config.js"></script>';
	assert.throws(
		() =>
			runtimeConfigBeforeModules(
				config +
					config +
					'<script type="module" src="/entry.js"></script>',
				'/brand'
			),
		/config\.js/
	);
	assert.throws(
		() =>
			runtimeConfigBeforeModules(
				'<script type="module" src="/brand/config.js"></script>',
				'/brand'
			),
		/classic|blocking|config\.js/i
	);
	assert.throws(
		() =>
			runtimeConfigBeforeModules(
				'<script nomodule src="/brand/config.js"></script>\n<script type="module" src="/entry.js"></script>',
				'/brand'
			),
		/classic|blocking|config\.js/i
	);
});

test('post transform preserves other scripts and puts config before the first module', async () => {
	const { runtimeConfigBeforeModules } = await html();
	const input =
		'<head><script type="module" src="/first.js"></script><script type="module" src="/second.js"></script></head><body><script src="/brand/config.js"></script><script src="/unrelated.js"></script></body>';
	const result = runtimeConfigBeforeModules(input, '/brand');
	assertConfigFirst(result);
	assert.match(result, /src="\/second.js"/);
	assert.match(result, /src="\/unrelated.js"/);
	assert.equal(runtimeConfigBeforeModules(result, '/brand'), result);
});

const retainArtifact = (directory, label) => {
	if (!process.env.PRODUCT_NATIVE_ARTIFACT_ROOT) return;
	const target = path.join(process.env.PRODUCT_NATIVE_ARTIFACT_ROOT, label);
	mkdirSync(path.dirname(target), { recursive: true });
	cpSync(directory, target, {
		recursive: true,
		errorOnExist: true,
		force: false
	});
	const inputs = [
		'config/vite-product-config.mjs',
		'config/vite-product-html.mjs',
		'src/resources/scripts/runtimeConfig.ts',
		'src/pages/app.html',
		'src/pages/under-construction.html',
		'package-lock.json'
	];
	writeFileSync(
		path.join(target, 'fixture-inputs.json'),
		JSON.stringify(
			Object.fromEntries(
				inputs.map((file) => [
					file,
					createHash('sha256')
						.update(readFileSync(path.join(root, file)))
						.digest('hex')
				])
			),
			null,
			2
		)
	);
};

const tinyBuild = async (removeOrdering = false) => {
	const { createProductConfig } = await import(
		'../config/vite-product-config.mjs'
	);
	const { build } = await import('vite');
	const environment = fixture();
	process.env.PUBLIC_URL = '/brand/';
	const config = await createProductConfig({
		root: environment.root,
		mode: 'production'
	});
	config.logLevel = 'silent';
	if (removeOrdering) {
		const plugin = config.plugins.find(
			(item) => item.name === 'oriso-product-html'
		);
		assert.ok(plugin, 'actual canonical HTML plugin selected');
		delete plugin.transformIndexHtml;
	}
	await build(config);
	retainArtifact(
		config.build.outDir,
		removeOrdering ? 'html-missing-post-hook' : 'html-six-pages'
	);
	return { directory: config.build.outDir, environment };
};

test('emits all six virtual HTML entries with native Vite and runtime config first', async () => {
	const { directory } = await tinyBuild();
	for (const name of pageNames) {
		const result = readFileSync(path.join(directory, name), 'utf8');
		assert.doesNotMatch(
			result,
			/<%|%PUBLIC_URL%|__REACT_APP_ORGANIZATION_ONLINEBERATUNG_URL__|\/src\/init(App|Error)/
		);
		if (name !== 'under-construction.html') assertConfigFirst(result);
	}
	assert.match(
		readFileSync(path.join(directory, 'config.js'), 'utf8'),
		/controlled\.example/
	);
});

test('detects native module hoisting when the post ordering hook is removed', async () => {
	const { directory } = await tinyBuild(true);
	const result = readFileSync(
		path.join(directory, 'beratung-hilfe.html'),
		'utf8'
	);
	assert.throws(() => assertConfigFirst(result), /config\.js must precede/);
});

const requiredKeys = [
	'REACT_APP_API_URL',
	'REACT_APP_MATRIX_HOMESERVER_URL',
	'REACT_APP_ELEMENT_CALL_BASE_URL',
	'REACT_APP_LIVEKIT_WS_URL',
	'REACT_APP_KEYCLOAK_REALM'
];
const emittedRuntime = async (
	label,
	{ complete = true, dottedOnly = false } = {}
) => {
	const { createProductConfig } = await import(
		'../config/vite-product-config.mjs'
	);
	const { build } = await import('vite');
	const environment = fixture();
	for (const key of Object.keys(process.env))
		if (/^(REACT_APP_|VITE_)/i.test(key)) delete process.env[key];
	if (complete)
		Object.assign(process.env, {
			REACT_APP_API_URL: 'https://build.example',
			REACT_APP_MATRIX_HOMESERVER_URL: 'https://matrix.example',
			REACT_APP_ELEMENT_CALL_BASE_URL: 'https://call.example',
			REACT_APP_LIVEKIT_WS_URL: 'wss://livekit.example',
			REACT_APP_KEYCLOAK_REALM: 'controlled-realm'
		});
	Object.assign(process.env, {
		PUBLIC_URL: '/brand/',
		REACT_APP_BUILD_COMMIT: 'shell-spoof',
		PRIVATE_SECRET_TRAP: 'PRIVATE_VALUE_MUST_NEVER_COMPILE',
		VITE_SECRET_TRAP: 'VITE_VALUE_MUST_NEVER_COMPILE'
	});
	writeFileSync(
		path.join(environment.root, '.env.production'),
		'VITE_DOTENV_TRAP=DOTENV_VALUE_MUST_NEVER_COMPILE\n'
	);
	writeFileSync(
		environment.paths.appEntryPoints.app,
		`import {getRuntimeApiBaseUrl,getBuildCommit,getRuntimeConfigProblems} from ${JSON.stringify(path.join(root, 'src/resources/scripts/runtimeConfig.ts'))};
	globalThis.__PRODUCT_RUNTIME__={api:getRuntimeApiBaseUrl(),commit:getBuildCommit(),problems:getRuntimeConfigProblems(),secret:import.meta.env.VITE_SECRET_TRAP,dotenvSecret:import.meta.env.VITE_DOTENV_TRAP};`
	);
	const config = await createProductConfig({
		root: environment.root,
		mode: 'production'
	});
	config.logLevel = 'silent';
	// Isolate the pure runtime module from Vite's browser-only preload polyfill.
	config.build.modulePreload = { polyfill: false };
	if (dottedOnly) delete config.define.process;
	await build(config);
	const html = readFileSync(
		path.join(config.build.outDir, 'beratung-hilfe.html'),
		'utf8'
	);
	const src = /<script\b[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
	assert.ok(src, 'actual emitted app module selected');
	const code = readFileSync(
		path.join(config.build.outDir, src.replace(/^\/brand\//, '')),
		'utf8'
	);
	assert.doesNotMatch(
		code,
		/PRIVATE_VALUE_MUST_NEVER_COMPILE|VITE_VALUE_MUST_NEVER_COMPILE|DOTENV_VALUE_MUST_NEVER_COMPILE/
	);
	retainArtifact(config.build.outDir, label);
	const observations = [];
	const execute = (runtime = {}, cypress = {}) => {
		const context = {
			URL,
			window: {
				__ORISO_RUNTIME_CONFIG__: runtime,
				Cypress: { env: () => cypress }
			}
		};
		runInNewContext(code, context, { timeout: 1000 });
		const result = JSON.parse(JSON.stringify(context.__PRODUCT_RUNTIME__));
		observations.push({ runtime, cypress, result });
		if (process.env.PRODUCT_NATIVE_ARTIFACT_ROOT)
			writeFileSync(
				path.join(
					process.env.PRODUCT_NATIVE_ARTIFACT_ROOT,
					label,
					'runtime-observations.json'
				),
				JSON.stringify(observations, null, 2)
			);
		return result;
	};
	return {
		execute,
		commit: JSON.parse(config.define['process.env']).REACT_APP_BUILD_COMMIT
	};
};

test('executes emitted canonical runtime config with public fallback and immutable commit', async () => {
	const { execute, commit } = await emittedRuntime('runtime-public-fallback');
	const compiled = execute(
		{},
		{ REACT_APP_API_URL: 'https://cypress.example' }
	);
	assert.equal(compiled.api, 'https://build.example');
	assert.equal(compiled.commit, commit);
	assert.match(commit, /^[a-f0-9]{40}$/);
	assert.deepEqual(compiled.problems, []);
	assert.equal(compiled.secret, undefined);
	assert.equal(compiled.dotenvSecret, undefined);
	const runtime = execute({
		REACT_APP_API_URL: 'https://runtime.example',
		REACT_APP_BUILD_COMMIT: 'runtime-spoof'
	});
	assert.equal(runtime.api, 'https://runtime.example');
	assert.equal(runtime.commit, commit);
});

test('detects dotted-only process definitions in emitted guarded build fallback', async () => {
	const { execute, commit } = await emittedRuntime(
		'runtime-dotted-only-negative',
		{ dottedOnly: true }
	);
	const result = execute();
	assert.equal(result.api, '');
	assert.equal(result.commit, commit);
	assert.deepEqual(
		result.problems.map(({ key }) => key),
		requiredKeys
	);
});

test('retains five missing required settings in emitted canonical runtime configuration', async () => {
	const { execute } = await emittedRuntime('runtime-missing-required', {
		complete: false
	});
	const result = execute();
	assert.equal(result.api, '');
	assert.deepEqual(
		result.problems,
		requiredKeys.map((key) => ({ key, problem: 'missing' }))
	);
	assert.equal(
		execute({ REACT_APP_API_URL: 'https://[' }).problems[0].problem,
		'invalid'
	);
	assert.equal(
		execute({}, { REACT_APP_API_URL: 'https://cypress.example' }).api,
		'https://cypress.example'
	);
});
