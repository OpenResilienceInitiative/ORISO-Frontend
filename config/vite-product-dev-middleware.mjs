import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse, format } from 'node:url';
import { createRequire } from 'node:module';
import compression from 'compression';
import historyApiFallback from 'connect-history-api-fallback';
import ipaddr from 'ipaddr.js';
import address from 'address';
import { createProxyMiddleware } from 'http-proxy-middleware';

const require = createRequire(import.meta.url);
// These public, standalone helpers do not load the CRA compiler or Webpack.
const redirectServedPath = require('react-dev-utils/redirectServedPathMiddleware');
const noopServiceWorker = require('react-dev-utils/noopServiceWorkerMiddleware');

export function createDevelopmentMiddleware(
	environment,
	{ host, allowedHost }
) {
	const { paths } = environment;
	const pkg = JSON.parse(readFileSync(paths.appPackageJson, 'utf8'));
	let target = pkg.proxy;
	if (target && (typeof target !== 'string' || !/^https?:\/\//.test(target)))
		throw new Error(
			'package.proxy must be a string starting with http:// or https://'
		);
	// Retain the canonical Windows/offline localhost fallback without importing
	// WebpackDevServerUtils and its compiler dependencies.
	if (target && process.platform === 'win32') {
		const parsed = parse(target);
		if (parsed.hostname === 'localhost') {
			parsed.host = undefined;
			try {
				if (!address.ip()) parsed.hostname = '127.0.0.1';
			} catch {
				parsed.hostname = '127.0.0.1';
			}
			target = format(parsed);
		}
	}
	if (
		allowedHost !== undefined &&
		(typeof allowedHost !== 'string' || !allowedHost)
	)
		throw new Error('allowedHost must be a nonempty hostname');
	const disableFirewall =
		!target || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true';
	const socketHost = process.env.WDS_SOCKET_HOST;
	const allowedHosts = [host, allowedHost, socketHost].filter(Boolean);
	const upgrades = new Set();
	const deniedUpgrades = new WeakSet();
	const acceptsHost = (header) => {
		if (disableFirewall) return true;
		if (!header) return false;
		if (/^(file|.+-extension):/i.test(header)) return true;
		let hostname;
		try {
			hostname = parse(
				/^(.+:)?\/\//.test(header) ? header : `//${header}`,
				false,
				true
			).hostname;
		} catch {
			return false;
		}
		if (!hostname) return false;
		if (
			ipaddr.IPv4.isValid(hostname) ||
			ipaddr.IPv6.isValid(hostname) ||
			hostname === 'localhost' ||
			hostname.endsWith('.localhost')
		)
			return true;
		return allowedHosts.some(
			(entry) =>
				entry === hostname ||
				(entry.startsWith('.') &&
					(hostname === entry.slice(1) || hostname.endsWith(entry)))
		);
	};
	const checkHost = (req, res, next) => {
		if (acceptsHost(req.headers.host)) return next();
		return res.send('Invalid Host header');
	};
	const checkUpgrade = (req, socket) => {
		if (acceptsHost(req.headers.host) && acceptsHost(req.headers.origin)) {
			upgrades.add(socket);
			socket.once('close', () => upgrades.delete(socket));
			return;
		}
		// Socket destruction does not stop later upgrade listeners. Keep the
		// request denied in the package-proxy context before it can forward.
		deniedUpgrades.add(req);
		socket.write(
			'HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'
		);
		socket.destroy();
	};
	const headers = (_req, res, next) => {
		res.set({
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': '*',
			'Access-Control-Allow-Headers': '*'
		});
		next();
	};
	const socketPath = process.env.WDS_SOCKET_PATH || '/ws';
	const mayProxy = (pathname) => {
		const publicFile = path.resolve(
			paths.appPublic,
			pathname.replace(new RegExp('^' + paths.publicUrlOrPath), '')
		);
		const socketRequest = !socketHost && pathname.startsWith(socketPath);
		return !existsSync(publicFile) && !socketRequest;
	};
	const packageProxy = target
		? createProxyMiddleware(
				(pathname, req) =>
					!deniedUpgrades.has(req) &&
					(req.method !== 'GET' ||
						(mayProxy(pathname) &&
							req.headers.accept &&
							req.headers.accept.indexOf('text/html') === -1)),
				{
					target,
					changeOrigin: true,
					secure: false,
					ws: true,
					xfwd: true,
					logLevel: 'silent',
					onProxyReq(proxyReq) {
						if (proxyReq.getHeader('origin'))
							proxyReq.setHeader('origin', target);
					},
					onError(error, req, res) {
						console.error(error);
						if (res.writeHead && !res.headersSent)
							res.writeHead(500);
						res.end(
							`Proxy error: Could not proxy request ${req.url} from ${req.headers.host} to ${target} (${error.code}).`
						);
					}
				}
			)
		: undefined;
	return {
		checkHost,
		checkUpgrade,
		closeUpgrades() {
			for (const socket of upgrades) socket.destroy();
		},
		// Keep the native Vite token/upgrade checks; align its second HTTP gate
		// with the earlier legacy decision instead of leaving a contradictory gate.
		viteAllowedHosts: disableFirewall ? true : allowedHosts,
		compression: compression(),
		headers,
		packageProxy,
		history: historyApiFallback({
			disableDotRule: true,
			index: paths.publicUrlOrPath,
			rewrites: [
				{ from: /^\/$/, to: '/beratung-hilfe.html' },
				{ from: /^\/.+/, to: '/beratung-hilfe.html' }
			]
		}),
		redirect: redirectServedPath(paths.publicUrlOrPath),
		worker: noopServiceWorker(paths.publicUrlOrPath)
	};
}
