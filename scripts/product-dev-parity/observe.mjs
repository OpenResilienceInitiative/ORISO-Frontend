// Run through run.py: fresh owned fixtures, raw results and bounded cleanup.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [repository, root, engine, scenarioFile, output] = process.argv.slice(2);
const scenario = JSON.parse(fs.readFileSync(scenarioFile, 'utf8'));
const write = (name, value) =>
	fs.writeFileSync(
		path.join(output, name),
		JSON.stringify(
			value,
			(_key, item) =>
				item instanceof RegExp
					? { source: item.source, flags: item.flags }
					: typeof item === 'function'
						? { functionName: item.name, arity: item.length }
						: item,
			2
		) + '\n'
	);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const announce = (value) =>
	console.log(JSON.stringify({ atUTC: new Date().toISOString(), ...value }));
const bounded = (promise, ms, stage) => {
	let timer;
	return Promise.race([
		promise,
		new Promise((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(stage + ' deadline exceeded')),
				ms
			);
		})
	]).finally(() => clearTimeout(timer));
};
let owner, compiler, stub;
let failed = false;
const stubRequests = [],
	finishedRequests = [],
	middlewareOrder = [];
try {
	if (process.version !== 'v22.23.3')
		throw new Error('Unexpected measured Node version');
	// Fresh process per leg: canonical CommonJS caches and env cannot leak across bases.
	process.chdir(root);
	const require = createRequire(path.join(repository, 'package.json'));
	const entrySpecifiers = {
		'webpack': 'webpack',
		'webpack-dev-server': 'webpack-dev-server',
		'react-dev-utils': 'react-dev-utils/WebpackDevServerUtils',
		'http-proxy-middleware': 'http-proxy-middleware',
		'vite': 'vite'
	};
	write('runtime-identity.json', {
		nodeVersion: process.version,
		execPath: process.execPath,
		cwd: process.cwd(),
		modules: Object.fromEntries(
			Object.entries(entrySpecifiers).map(([name, specifier]) => [
				name,
				{
					specifier,
					resolvedEntry: require.resolve(specifier),
					resolvedPackage: require.resolve(name + '/package.json'),
					version: require(name + '/package.json').version
				}
			])
		)
	});
	process.env.NODE_ENV = 'development';
	process.env.BABEL_ENV = 'development';
	process.env.PUBLIC_URL = scenario.base;
	process.env.HOST = '127.0.0.1';
	process.env.PORT = '0';
	process.env.CI = 'true';
	process.env.BROWSER = 'none';
	stub = http.createServer((req, res) => {
		const parts = [];
		req.on('data', (chunk) => parts.push(chunk));
		req.on('end', () => {
			const body = Buffer.concat(parts).toString();
			stubRequests.push({
				method: req.method,
				url: req.url,
				host: req.headers.host,
				origin: req.headers.origin ?? null,
				body
			});
			res.writeHead(200, {
				'Content-Type': 'application/json',
				'X-Parity-Upstream': 'owned-loopback'
			});
			res.end(JSON.stringify({ method: req.method, url: req.url, body }));
		});
	});
	await new Promise((resolve, reject) => {
		stub.once('error', reject);
		stub.listen(0, '127.0.0.1', resolve);
	});
	const target = `http://127.0.0.1:${stub.address().port}`;
	process.env.REACT_APP_DEV_REMOTE_API_URL = target;
	const packagePath = path.join(root, 'package.json');
	const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
	if (scenario.packageProxy) pkg.proxy = target;
	else delete pkg.proxy;
	fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
	write('fixture-runtime-inputs.json', {
		target,
		packageProxy: scenario.packageProxy,
		packageSHA256: hash(fs.readFileSync(packagePath)),
		publicUrl: scenario.base,
		allowedHostArgument: 'parity.allowed.test',
		noDotenvFiles: true,
		noTLSOverride: true
	});
	announce({
		event: 'starting',
		pid: process.pid,
		engine,
		scenario: scenario.id,
		fixtureRoot: root,
		stubPort: stub.address().port
	});
	let server;
	if (engine === 'legacy') {
		// Canonical env -> canonical config factories -> actual pinned Webpack/WDS.
		require(path.join(repository, 'config/env.js'));
		const paths = require(path.join(repository, 'config/paths.js'));
		const factory = require(
			path.join(repository, 'config/webpack.config.js')
		);
		const config = factory('development');
		const {
			prepareProxy,
			prepareUrls,
			createCompiler
		} = require('react-dev-utils/WebpackDevServerUtils');
		const proxy = prepareProxy(
			pkg.proxy,
			paths.appPublic,
			paths.publicUrlOrPath
		);
		const canonical = require(
			path.join(repository, 'config/webpackDevServer.config.js')
		)(proxy, 'parity.allowed.test').devServer;
		const originalSetup = canonical.setupMiddlewares;
		// Observe the returned real list; no handler wrapping/insertion/reordering.
		const settings = {
			...canonical,
			host: '127.0.0.1',
			port: 0,
			setupMiddlewares(list, devServer) {
				const result = originalSetup(list, devServer);
				middlewareOrder.push(
					...result.map((row) => ({
						name: row.name ?? null,
						path: row.path ?? null,
						functionName:
							typeof row === 'function'
								? row.name
								: (row.middleware?.name ?? null)
					}))
				);
				return result;
			}
		};
		const webpack = require('webpack');
		compiler = createCompiler({
			appName: pkg.name,
			config,
			urls: prepareUrls(
				'http',
				'127.0.0.1',
				0,
				paths.publicUrlOrPath.slice(0, -1)
			),
			useYarn: false,
			useTypeScript: fs.existsSync(paths.appTsConfig),
			webpack
		});
		const WDS = require('webpack-dev-server');
		owner = new WDS(settings, compiler);
		await bounded(owner.start(), 30000, 'legacy start');
		await bounded(
			new Promise((resolve, reject) =>
				owner.middleware.waitUntilValid((stats) => {
					write(
						'webpack-stats.json',
						stats.toJson({
							all: false,
							errors: true,
							warnings: true,
							assets: true,
							entrypoints: true
						})
					);
					if (stats.hasErrors())
						reject(
							new Error(
								'Actual minimal legacy compilation failed'
							)
						);
					else resolve();
				})
			),
			30000,
			'legacy compilation'
		);
		server = owner.server;
		write('effective-server-settings.json', {
			kind: 'actual canonical factory result passed to WDS',
			allowedHosts: canonical.allowedHosts,
			compress: canonical.compress,
			headers: canonical.headers,
			static: canonical.static,
			historyApiFallback: canonical.historyApiFallback,
			middlewareOrder,
			actualWdsProxy: owner.options.proxy,
			outputPublicPath: config.output.publicPath,
			outputFilename: config.output.filename,
			entry: config.entry,
			plugins: config.plugins
				.filter(Boolean)
				.map((plugin) => plugin.constructor.name),
			fixtureHasTsconfig: fs.existsSync(paths.appTsConfig)
		});
	} else if (engine === 'candidate') {
		const { createProductDevServer } = await import(
			pathToFileURL(path.join(repository, 'config/vite-product-dev.mjs'))
		);
		owner = await bounded(
			createProductDevServer({
				root,
				host: '127.0.0.1',
				port: 0,
				allowedHost: 'parity.allowed.test'
			}),
			30000,
			'candidate start'
		);
		server = owner.server;
		write('effective-server-settings.json', {
			kind: 'actual candidate resolved Vite config',
			root: owner.vite.config.root,
			base: owner.vite.config.base,
			allowedHosts: owner.vite.config.server.allowedHosts,
			cors: owner.vite.config.server.cors,
			middlewareMode: true,
			appType: owner.vite.config.appType,
			cacheDir: owner.vite.config.cacheDir,
			publicDir: owner.vite.config.publicDir
		});
	} else throw new Error('Unknown engine');
	// Passive listener records req.url after the real chain finishes, including history rewrites.
	server.prependListener('request', (req, res) => {
		const startUrl = req.url;
		res.once('finish', () =>
			finishedRequests.push({
				id: req.headers['x-parity-case'] ?? null,
				method: req.method,
				startUrl,
				finishedUrl: req.url,
				matchedExpressRoute: req.route?.path ?? null,
				status: res.statusCode
			})
		);
	});
	const port = server.address().port;
	announce({
		event: 'ready',
		pid: process.pid,
		port,
		stubPort: stub.address().port,
		engine,
		scenario: scenario.id
	});
	write('ready.json', {
		pid: process.pid,
		port,
		stubPort: stub.address().port,
		engine,
		scenario: scenario.id
	});
	const receipts = [];
	for (const row of scenario.requests) {
		const url = row[engine + 'Path'];
		const headers = {
			'Connection': 'close',
			'Accept': row.accept ?? '*/*',
			'Accept-Encoding': row.encoding ?? 'identity',
			'X-Parity-Case': row.id
		};
		if (row.origin) headers.Origin = row.origin;
		if (row.host) headers.Host = row.host;
		if (row.method === 'OPTIONS')
			Object.assign(headers, {
				'Access-Control-Request-Method': 'GET',
				'Access-Control-Request-Headers': 'X-Parity-Probe'
			});
		const response = await new Promise((resolve, reject) => {
			const request = http.request(
				{
					hostname: '127.0.0.1',
					port,
					path: url,
					method: row.method,
					headers,
					agent: false
				},
				(res) => {
					const chunks = [];
					res.on('data', (chunk) => chunks.push(chunk));
					res.on('error', reject);
					res.on('end', () =>
						resolve({
							status: res.statusCode,
							headers: res.headers,
							rawHeaders: res.rawHeaders,
							raw: Buffer.concat(chunks)
						})
					);
				}
			);
			request.setTimeout(5000, () =>
				request.destroy(
					new Error('HTTP request deadline exceeded: ' + row.id)
				)
			);
			request.on('error', reject);
			request.end();
		});
		const encoding = response.headers['content-encoding'] ?? 'identity';
		const decoded =
			encoding === 'gzip'
				? zlib.gunzipSync(response.raw)
				: encoding === 'identity'
					? response.raw
					: (() => {
							throw new Error(
								'Unexpected response encoding: ' + encoding
							);
						})();
		fs.writeFileSync(path.join(output, row.id + '.wire'), response.raw);
		fs.writeFileSync(path.join(output, row.id + '.decoded'), decoded);
		receipts.push({
			...row,
			engine,
			requestPath: url,
			requestHeaders: headers,
			status: response.status,
			headers: response.headers,
			rawHeaders: response.rawHeaders,
			wireSHA256: hash(response.raw),
			wireBytes: response.raw.length,
			decodedSHA256: hash(decoded),
			decodedBytes: decoded.length,
			containsAppEntryMarker: decoded.includes('__PARITY_APP_ENTRY__'),
			looksLikeNoopWorker:
				decoded.includes("self.addEventListener('install'") &&
				decoded.includes('self.skipWaiting()'),
			bodyArtifacts: [row.id + '.wire', row.id + '.decoded']
		});
		write('responses.json', receipts);
	}
	write('request-events.json', finishedRequests);
	write('stub-requests.json', stubRequests);
	write('observation-complete.json', {
		executed: receipts.length,
		expected: scenario.requests.length,
		noRetries: true,
		engine,
		scenario: scenario.id
	});
} catch (error) {
	failed = true;
	write('native-error.json', { message: error.message, stack: error.stack });
	console.error(error);
} finally {
	const cleanupErrors = [];
	for (const [name, action] of [
		[
			'server',
			async () => {
				if (owner) {
					if (engine === 'legacy') await owner.stop();
					else {
						await owner.close();
						await owner.close();
					}
				}
			}
		],
		[
			'compiler',
			async () => {
				if (compiler)
					await new Promise((resolve, reject) =>
						compiler.close((error) =>
							error ? reject(error) : resolve()
						)
					);
			}
		],
		[
			'stub',
			async () => {
				if (stub?.listening)
					await new Promise((resolve, reject) =>
						stub.close((error) =>
							error ? reject(error) : resolve()
						)
					);
			}
		]
	]) {
		try {
			await bounded(action(), 10000, name + ' cleanup');
		} catch (error) {
			cleanupErrors.push({ name, message: error.message });
			failed = true;
		}
	}
	write('native-terminal.json', {
		atUTC: new Date().toISOString(),
		pid: process.pid,
		exitCode: failed ? 1 : 0,
		cleanupErrors,
		noProcessExitShortcut: true
	});
	announce({ event: 'terminal', pid: process.pid, exitCode: failed ? 1 : 0 });
	process.exitCode = failed ? 1 : 0;
}
