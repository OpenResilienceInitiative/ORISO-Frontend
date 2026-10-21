/* global AggregateError */
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import express from 'express';
import { createServer } from 'vite';
import { getCertificate } from '@vitejs/plugin-basic-ssl';
import {
	loadProductEnvironment,
	createProductConfig
} from './vite-product-config.mjs';
import { productPages, renderProductPage } from './vite-product-html.mjs';
import { createDevelopmentMiddleware } from './vite-product-dev-middleware.mjs';

const require = createRequire(import.meta.url);
export async function createProductDevServer(options = {}) {
	process.env.BABEL_ENV = 'development';
	const environment = loadProductEnvironment({
		root: options.root,
		mode: 'development'
	});
	process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY =
		process.env.CSRF_WHITELIST_HEADER_FOR_LOCAL_DEVELOPMENT;
	const config = await createProductConfig({
		root: environment.root,
		mode: 'development'
	});
	const host = options.host ?? process.env.HOST ?? '0.0.0.0';
	const port =
		options.port ?? (Number.parseInt(process.env.PORT, 10) || 3000);
	if (!Number.isInteger(port) || port < 0 || port > 65535)
		throw new Error('Invalid development server port');
	if (environment.paths.storagePath)
		mkdirSync(environment.paths.storagePath, { recursive: true });
	let tls = require('./getHttpsConfig.js')();
	if (tls === true) {
		// Public, typed export of the pinned official basic-ssl package; same
		// certificate generation/cache as its Vite plugin, without private hooks.
		const pem = await getCertificate(
			path.join(environment.paths.appNodeModules, '.vite/basic-ssl')
		);
		tls = { key: pem, cert: pem };
	}
	const app = express();
	app.disable('x-powered-by');
	const middleware = createDevelopmentMiddleware(environment, {
		host,
		allowedHost: options.allowedHost
	});
	app.use(middleware.checkHost);
	const server = tls ? https.createServer(tls, app) : http.createServer(app);
	server.on('upgrade', middleware.checkUpgrade);
	let vite;
	let closing;
	const close = () => {
		if (!closing)
			closing = (async () => {
				middleware.closeUpgrades();
				const results = await Promise.allSettled([
					vite?.close(),
					new Promise((resolve, reject) => {
						if (!server.listening) {
							resolve();
							return;
						}
						server.close((error) =>
							error ? reject(error) : resolve()
						);
					})
				]);
				const errors = results
					.filter((result) => result.status === 'rejected')
					.map((result) => result.reason);
				if (errors.length)
					throw new AggregateError(
						errors,
						'Development server cleanup failed'
					);
			})();
		return closing;
	};
	try {
		const ws = { server };
		if (process.env.WDS_SOCKET_HOST) ws.host = process.env.WDS_SOCKET_HOST;
		if (process.env.WDS_SOCKET_PATH) ws.path = process.env.WDS_SOCKET_PATH;
		if (process.env.WDS_SOCKET_PORT)
			ws.clientPort = Number(process.env.WDS_SOCKET_PORT);
		vite = await createServer({
			...config,
			appType: 'custom',
			server: {
				host,
				port,
				https: tls || undefined,
				middlewareMode: { server },
				ws,
				allowedHosts: middleware.viteAllowedHosts,
				cors: false,
				open: false,
				strictPort: true
			}
		});
		const router = express.Router();
		const routes = require(environment.paths.proxySetup)(
			environment.paths.storagePath
		);
		for (const { method, middleware, path: route } of routes) {
			if (method)
				router.use(route, (req, res, next) => {
					if (req.method !== method) return next();
					return middleware(req, res, next);
				});
			else if (route) router.use(route, middleware);
			else router.use(middleware);
		}
		app.use(router);
		// Custom routes retain their original header/compression/method ownership.
		app.use(middleware.compression);
		app.use(middleware.headers);
		const base = new URL(
			environment.paths.publicUrlOrPath,
			'http://local.invalid'
		).pathname.replace(/\/$/, '');
		app.get(base + '/config.js', (req, res) =>
			res.sendFile(path.join(environment.paths.appPublic, 'config.js'), {
				headers: {
					'Cache-Control': 'no-store, no-cache, must-revalidate'
				}
			})
		);
		const html = async (req, res, name) => {
			try {
				// Re-read the filtered public values after mapping the legacy CSRF setting.
				const current = {
					...environment,
					// Native Vite prefixes HTML URLs; keep client env unchanged.
					raw: {
						...JSON.parse(config.define['process.env']),
						PUBLIC_URL: ''
					}
				};
				const result = await vite.transformIndexHtml(
					req.originalUrl,
					renderProductPage(current, name),
					path.join(environment.paths.appPath, name)
				);
				res.status(200)
					.set('Content-Type', 'text/html')
					.set('Cache-Control', 'no-cache')
					.send(result);
			} catch (error) {
				vite.ssrFixStacktrace(error);
				console.error(error);
				res.status(500).type('text').send(error.message);
			}
		};
		const servePage = (req, res, next) => {
			if (req.method !== 'GET' && req.method !== 'HEAD') return next();
			const page = productPages.find(
				(name) => req.path === base + '/' + name
			);
			return page ? html(req, res, page) : next();
		};
		const publicFiles = express.static(environment.paths.appPublic);
		app.use(servePage);
		app.use((req, res, next) => {
			// Vite's static server also serves OPTIONS as files. Retain the
			// downstream package-proxy and fallback preflight ownership.
			if (req.method === 'OPTIONS') return next();
			const url = req.url;
			const originalUrl = req.originalUrl;
			vite.middlewares(req, res, (error) => {
				// Vite strips its base while looking for modules. The remaining legacy
				// chain must receive the incoming URL, then apply its own history rewrite.
				req.url = url;
				req.originalUrl = originalUrl;
				next(error);
			});
		});
		if (middleware.packageProxy) app.use(middleware.packageProxy);
		app.use(base || '/', publicFiles);
		app.use((req, res, next) => {
			if (req.method !== 'GET' && req.method !== 'HEAD') return next();
			// Retain the Product hard-404 asset contract. Only the service-worker
			// filename follows the observed history -> redirect -> no-op lifecycle.
			if (req.path.endsWith('/service-worker.js')) return next();
			if (
				req.path.startsWith(base + '/static/') ||
				/\.(?:js|mjs|css|map|wasm|png|jpe?g|svg|ico|woff2?|ttf|txt)$/i.test(
					req.path
				)
			)
				return res
					.status(404)
					.set('Cache-Control', 'no-store')
					.type('text')
					.send('Not found');
			return next();
		});
		app.use(middleware.history);
		app.use(servePage);
		app.use(base || '/', publicFiles);
		app.use((req, res, next) => {
			if (req.method !== 'OPTIONS') return next();
			return res.status(204).set('Content-Length', '0').end();
		});
		app.use((req, res, next) => {
			// Unhandled methods retain the Product 404 contract after custom
			// routes/package.proxy, rather than becoming navigation redirects.
			if (req.method !== 'GET' && req.method !== 'HEAD') return next();
			return middleware.redirect(req, res, next);
		});
		app.use(middleware.worker);
		app.use((_req, res) =>
			res
				.status(404)
				.set('Cache-Control', 'no-store')
				.type('text')
				.send('Not found')
		);
		await new Promise((resolve, reject) => {
			server.once('error', reject);
			server.listen(port, host, () => {
				server.off('error', reject);
				resolve();
			});
		});
		const address = server.address();
		return {
			server,
			vite,
			url: `${tls ? 'https' : 'http'}://${host === '0.0.0.0' ? 'localhost' : host}:${address.port}${base}`,
			close
		};
	} catch (error) {
		try {
			await close();
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'Development startup and cleanup failed'
			);
		}
		throw error;
	}
}
