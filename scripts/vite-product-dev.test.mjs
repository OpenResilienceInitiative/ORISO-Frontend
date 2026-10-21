import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { runInNewContext } from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
	fixture,
	startFixture,
	certificateFiles
} from '../playwright/product-vite/dev-fixture.mjs';
const options = { timeout: 30000 };
const make = async (t, env = {}, settings = {}, prepare) => {
	const value = fixture();
	let server;
	t.after(async () => {
		try {
			await server?.stop();
		} finally {
			value.cleanup();
		}
	});
	prepare?.(value);
	server = await startFixture(value, env, settings);
	return { value, server };
};
const httpBytes = (url, { method = 'GET', headers = {}, body } = {}) =>
	new Promise((resolve, reject) => {
		const request = http.request(
			url,
			{
				method,
				headers: {
					'Accept': '*/*',
					'Accept-Encoding': 'identity',
					...headers
				}
			},
			(response) => {
				const chunks = [];
				response.on('data', (chunk) => chunks.push(chunk));
				response.on('error', reject);
				response.on('end', () => {
					try {
						const wire = Buffer.concat(chunks);
						resolve({
							status: response.statusCode,
							headers: response.headers,
							wire,
							decoded:
								response.headers['content-encoding'] === 'gzip'
									? gunzipSync(wire)
									: wire
						});
					} catch (error) {
						reject(error);
					}
				});
			}
		);
		request.setTimeout(5000, () =>
			request.destroy(new Error('HTTP deadline'))
		);
		request.on('error', reject);
		request.end(body);
	});
const packageProxy = (target) => (value) => {
	const file = path.join(value.root, 'package.json');
	const pkg = JSON.parse(readFileSync(file, 'utf8'));
	writeFileSync(file, JSON.stringify({ ...pkg, proxy: target }));
};
const pingUpgrade = (url, headers) =>
	new Promise((resolve, reject) => {
		const request = http.request(url + '/', {
			headers: {
				'Connection': 'Upgrade',
				'Upgrade': 'websocket',
				'Sec-WebSocket-Version': '13',
				'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
				'Sec-WebSocket-Protocol': 'vite-ping',
				...headers
			}
		});
		request.setTimeout(5000, () =>
			request.destroy(new Error('Upgrade deadline'))
		);
		request.on('upgrade', (response, socket) => {
			socket.destroy();
			resolve(response.statusCode);
		});
		request.on('response', (response) => {
			response.resume();
			resolve(response.statusCode);
		});
		request.on('error', reject);
		request.end();
	});
const upstream = async (t, handler) => {
	const server = http.createServer(handler);
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	return { server, url: `http://127.0.0.1:${server.address().port}` };
};
const tlsGet = (url, ca) =>
	new Promise((resolve, reject) => {
		https
			.get(
				url,
				{
					ca,
					servername: 'localhost',
					...(ca ? {} : { rejectUnauthorized: false })
				},
				(res) => {
					let body = '';
					res.on('data', (chunk) => (body += chunk));
					res.on('end', () =>
						resolve({
							status: res.statusCode,
							body,
							encrypted: res.socket?.encrypted
						})
					);
				}
			)
			.on('error', reject);
	});

test(
	'serves real Express settings with method ownership and maps the development CSRF value',
	options,
	async (t) => {
		const { value, server } = await make(t, {
			CSRF_WHITELIST_HEADER_FOR_LOCAL_DEVELOPMENT: 'X-Controlled-CSRF'
		});
		const response = await fetch(server.url + '/p/api/settings');
		assert.equal(response.status, 200);
		assert.equal(response.headers.get('x-powered-by'), null);
		assert.equal(
			(await response.json()).registration.useConsultingTypeSlug,
			true
		);
		const post = await fetch(server.url + '/p/api/settings', {
			method: 'POST'
		});
		assert.equal(post.status, 404);
		const code = await (
			await fetch(server.url + '/src/initError.ts')
		).text();
		assert.ok(code.includes('__ERROR_ENTRY__'));
		assert.ok(code.includes('__CSRF_HEADER__'));
		const environmentResponse = await fetch(server.url + '/@vite/env');
		assert.equal(environmentResponse.status, 200);
		const environmentCode = await environmentResponse.text();
		writeFileSync(
			path.join(value.root, 'served-public-env.mjs'),
			environmentCode
		);
		const context = {};
		runInNewContext(environmentCode, context, { timeout: 1000 });
		assert.equal(
			context.process.env.REACT_APP_CSRF_WHITELIST_HEADER_PROPERTY,
			'X-Controlled-CSRF'
		);
		assert.equal(context.process.env.PRIVATE_DEV_TRAP, undefined);
	}
);
test(
	'proxies exact API paths query body origin and upstream 404 without SPA substitution',
	options,
	async (t) => {
		const requests = [];
		const backend = await upstream(t, (req, res) => {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', () => {
				requests.push({
					url: req.url,
					body,
					origin: req.headers.origin,
					referer: req.headers.referer
				});
				res.writeHead(req.url.includes('missing') ? 404 : 200, {
					'Content-Type': 'application/json'
				});
				res.end(JSON.stringify({ url: req.url, body }));
			});
		});
		const { server } = await make(t, {
			REACT_APP_DEV_REMOTE_API_URL: backend.url,
			REACT_APP_DEV_REMOTE_FRONTEND_ORIGIN: 'https://controlled.example'
		});
		for (const route of ['/service', '/api/v1', '/auth']) {
			const response = await fetch(server.url + route + '/probe?x=1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: '{"probe":true}'
			});
			assert.equal(response.status, 200);
			assert.equal((await response.json()).url, route + '/probe?x=1');
		}
		assert.equal(requests.length, 3);
		for (const request of requests) {
			assert.equal(request.body, '{"probe":true}');
			assert.equal(request.origin, 'https://controlled.example');
			assert.equal(request.referer, 'https://controlled.example/');
		}
		const absent = await fetch(server.url + '/service/missing');
		assert.equal(absent.status, 404);
		assert.match(await absent.text(), /missing/);
	}
);
test(
	'preserves WeBlate parameters and local cache through the actual route factory',
	options,
	async (t) => {
		let calls = 0;
		const backend = await upstream(t, (req, res) => {
			calls++;
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ hello: 'controlled translation' }));
		});
		const value = fixture();
		let server;
		t.after(async () => {
			try {
				await server?.stop();
			} finally {
				value.cleanup();
			}
		});
		const storage = path.join(value.root, 'storage');
		server = await startFixture(value, {
			LOCALIZATION_WEBLATE_HOST: backend.url,
			STORAGE_PATH: storage
		});
		const url = server.url + '/p/api/translations/project/ui/en/';
		const first = await fetch(url);
		assert.equal(first.status, 200);
		assert.equal((await first.json()).data.hello, 'controlled translation');
		const target = path.join(storage, 'weblate/ui.en.json');
		for (let i = 0; !existsSync(target) && i < 100; i++)
			await new Promise((r) => setTimeout(r, 10));
		assert.equal(
			JSON.parse(readFileSync(target, 'utf8')).data.hello,
			'controlled translation'
		);
		const second = await fetch(url);
		assert.equal(second.status, 200);
		assert.equal(
			(await second.json()).data.hello,
			'controlled translation'
		);
		assert.equal(calls, 1);
	}
);
test(
	'serves six virtual pages and dotted navigation with config before Vite modules',
	options,
	async (t) => {
		const { server } = await make(t);
		for (const name of [
			'beratung-hilfe.html',
			'error.400.html',
			'error.401.html',
			'error.404.html',
			'error.500.html',
			'under-construction.html',
			'sessions/room.name'
		]) {
			const response = await fetch(server.url + '/' + name);
			assert.equal(response.status, 200, name);
			const html = await response.text();
			assert.match(html, /<html/);
			if (name !== 'under-construction.html') {
				const config = html.indexOf('src="/config.js"');
				const module = html.search(/<script\b[^>]*type="module"/);
				assert.ok(config >= 0 && module > config, name);
				assert.match(html, /\/@vite\/client/);
			}
		}
		const config = await fetch(server.url + '/config.js');
		assert.match(config.headers.get('cache-control'), /no-store/);
		assert.match(await config.text(), /__CONFIG_SEEN__/);
		const missing = await fetch(server.url + '/static/missing.js');
		assert.equal(missing.status, 404);
		assert.doesNotMatch(await missing.text(), /<html/);
	}
);
test(
	'fails malformed runtime config and denies env files without exposing their bytes',
	options,
	async (t) => {
		const { value, server } = await make(t);
		const secret = await fetch(server.url + '/.env');
		assert.equal(secret.status, 403);
		assert.doesNotMatch(await secret.text(), /DO_NOT_SERVE_PRIVATE_BYTES/);
		const template = path.join(value.root, 'src/pages/app.html');
		writeFileSync(
			template,
			readFileSync(template, 'utf8').replace(
				'<script src="%PUBLIC_URL%/config.js">',
				'<script nomodule src="%PUBLIC_URL%/config.js">'
			)
		);
		const response = await fetch(server.url + '/beratung-hilfe.html');
		assert.equal(response.status, 500);
		assert.match(await response.text(), /classic blocking script/);
	}
);
test(
	'serves real TLS with automatic certificates and validates explicit certificates',
	options,
	async (t) => {
		const { value, server } = await make(t, { HTTPS: 'true' });
		assert.match(server.url, /^https:/);
		assert.equal(
			(await tlsGet(server.url + '/p/api/settings')).status,
			200
		);
		await server.stop();
		const files = await certificateFiles(value);
		const explicit = await startFixture(value, {
			HTTPS: 'true',
			SSL_CRT_FILE: files.cert,
			SSL_KEY_FILE: files.key
		});
		try {
			assert.equal(
				(await tlsGet(explicit.url + '/p/api/settings', files.ca))
					.status,
				200
			);
		} finally {
			await explicit.stop();
		}
		await assert.rejects(
			startFixture(value, {
				HTTPS: 'true',
				SSL_CRT_FILE: path.join(value.root, 'missing.crt'),
				SSL_KEY_FILE: files.key
			}),
			/can't be found/
		);
		writeFileSync(files.cert, 'invalid certificate');
		await assert.rejects(
			startFixture(value, {
				HTTPS: 'true',
				SSL_CRT_FILE: files.cert,
				SSL_KEY_FILE: files.key
			}),
			/invalid/
		);
	}
);
test(
	'closes idempotently releases the owned port and rejects a busy requested port',
	options,
	async (t) => {
		const { value, server } = await make(t);
		const port = Number(new URL(server.url).port);
		await assert.rejects(
			startFixture(value, {}, { port }),
			/EADDRINUSE|address already in use/
		);
		await server.stop();
		await server.stop();
		const replacement = await startFixture(value, {}, { port });
		try {
			assert.equal(
				(await fetch(replacement.url + '/p/api/settings')).status,
				200
			);
		} finally {
			await replacement.stop();
		}
	}
);

test(
	'serves canonical prefixed runtime config as no-store JavaScript before modules',
	options,
	async (t) => {
		const { value, server } = await make(t, { PUBLIC_URL: '/brand' });
		assert.equal(new URL(server.url).pathname, '/brand');
		const response = await fetch(server.url + '/config.js', {
			redirect: 'manual'
		});
		assert.equal(response.status, 200);
		assert.match(
			response.headers.get('content-type'),
			/^(?:application|text)\/(?:java|ecma)script\b/i
		);
		assert.match(response.headers.get('cache-control'), /\bno-store\b/);
		const code = await response.text();
		assert.equal(
			code,
			readFileSync(path.join(value.root, 'public/config.js'), 'utf8')
		);
		const context = {};
		runInNewContext(code, context, { timeout: 1000 });
		assert.equal(context.__CONFIG_SEEN__, true);
		const page = await fetch(server.url + '/beratung-hilfe.html');
		assert.equal(page.status, 200);
		const html = await page.text();
		const config = html.indexOf('src="/brand/config.js"');
		const module = html.search(/<script\b[^>]*type="module"/);
		assert.ok(config >= 0 && module > config);
		for (const asset of [
			'href="/brand/favicon.ico"',
			'href="/brand/logo192.png"',
			'src="/brand/config.js"',
			'src="/brand/src/initApp.tsx"'
		])
			assert.equal(html.split(asset).length - 1, 1, asset);
		assert.doesNotMatch(html, /\/brand\/brand\//);
	}
);

test(
	'keeps custom method ownership ahead of builtin CORS at root and prefix',
	options,
	async (t) => {
		for (const base of ['', '/brand']) {
			const { server } = await make(t, { PUBLIC_URL: base });
			const serverOrigin = new URL(server.url).origin;
			const origin = { Origin: 'https://origin.parity.invalid' };
			for (const route of ['/src/initApp.tsx', '/probe.txt']) {
				for (const method of ['GET', 'OPTIONS']) {
					const response = await httpBytes(server.url + route, {
						method,
						headers: {
							...origin,
							'Access-Control-Request-Headers': 'X-Parity-Probe'
						}
					});
					assert.equal(response.status, method === 'GET' ? 200 : 204);
					for (const header of ['origin', 'methods', 'headers'])
						assert.equal(
							response.headers['access-control-allow-' + header],
							'*'
						);
				}
			}
			const settings = await httpBytes(serverOrigin + '/p/api/settings', {
				headers: origin
			});
			assert.equal(JSON.parse(settings.decoded).proxyPath, '/p');
			assert.equal(
				settings.headers['access-control-allow-origin'],
				undefined
			);
			const preflight = await httpBytes(
				serverOrigin + '/p/api/settings',
				{ method: 'OPTIONS', headers: origin }
			);
			assert.equal(preflight.status, 204);
			assert.equal(preflight.decoded.length, 0);
			assert.equal(preflight.headers['access-control-allow-origin'], '*');
			assert.equal(
				(
					await httpBytes(serverOrigin + '/p/api/settings', {
						method: 'POST'
					})
				).status,
				404
			);
			await server.stop();
		}
	}
);

test(
	'gzip preserves exact large public bytes and each rendered HTML body',
	options,
	async (t) => {
		const expected = Buffer.from(
			'controlled-large-public-asset\n'.repeat(4096)
		);
		const { server } = await make(t, {}, {}, (value) => {
			writeFileSync(path.join(value.root, 'public/large.txt'), expected);
		});
		for (const route of ['/large.txt', '/beratung-hilfe.html']) {
			const identity = await httpBytes(server.url + route);
			const compressed = await httpBytes(server.url + route, {
				headers: { 'Accept-Encoding': 'gzip' }
			});
			assert.equal(identity.status, 200);
			assert.equal(compressed.status, 200);
			assert.equal(compressed.headers['content-encoding'], 'gzip');
			assert.match(identity.headers.vary, /Accept-Encoding/);
			assert.match(compressed.headers.vary, /Accept-Encoding/);
			assert.deepEqual(compressed.decoded, identity.decoded);
			assert.ok(compressed.wire.length < compressed.decoded.length);
			if (route === '/large.txt')
				assert.deepEqual(identity.decoded, expected);
		}
	}
);

test(
	'checks proxy-dependent Host before settings and preserves explicit hosts and IPs',
	options,
	async (t) => {
		const backend = await upstream(t, (_req, res) => res.end('upstream'));
		const { server } = await make(
			t,
			{},
			{ allowedHost: '.parity.allowed.test' },
			packageProxy(backend.url)
		);
		for (const route of ['/p/api/settings', '/src/initApp.tsx']) {
			const denied = await httpBytes(server.url + route, {
				headers: { Host: 'foreign.parity.invalid' }
			});
			assert.equal(denied.status, 200);
			assert.equal(denied.decoded.toString(), 'Invalid Host header');
		}
		for (const host of [
			'parity.allowed.test',
			'sub.parity.allowed.test',
			'localhost',
			'sub.localhost',
			'127.0.0.1',
			'[::1]'
		]) {
			const response = await httpBytes(server.url + '/p/api/settings', {
				headers: { Host: host }
			});
			assert.equal(response.status, 200, host);
			assert.equal(JSON.parse(response.decoded).proxyPath, '/p', host);
		}
		const noProxy = await make(t);
		const open = await httpBytes(noProxy.server.url + '/p/api/settings', {
			headers: { Host: 'foreign.parity.invalid' }
		});
		assert.equal(JSON.parse(open.decoded).proxyPath, '/p');
	}
);

test(
	'checks Host and Origin on websocket upgrades while preserving the native Vite handshake',
	options,
	async (t) => {
		const seen = { http: [], upgrade: [] };
		const backendSockets = new Set();
		const backendClosed = [];
		const clientSockets = new Set();
		const backend = await upstream(t, (req, res) => {
			seen.http.push(req.url);
			res.end('upstream');
		});
		backend.server.on('connection', (socket) => {
			backendSockets.add(socket);
			backendClosed.push(
				new Promise((resolve) => socket.once('close', resolve))
			);
			socket.once('close', () => backendSockets.delete(socket));
		});
		backend.server.on('upgrade', (req, socket) => {
			seen.upgrade.push(req.url);
			const accept = createHash('sha1')
				.update(
					req.headers['sec-websocket-key'] +
						'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
				)
				.digest('base64');
			socket.end(
				'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
					accept +
					'\r\n\r\n'
			);
		});
		const { server } = await make(
			t,
			{},
			{ allowedHost: 'parity.allowed.test' },
			packageProxy(backend.url)
		);
		const proxyUpgrade = (route, headers) =>
			new Promise((resolve, reject) => {
				const request = http.request(server.url + route, {
					agent: false,
					headers: {
						'Connection': 'Upgrade',
						'Upgrade': 'websocket',
						'Sec-WebSocket-Version': '13',
						'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
						'Accept': 'application/json',
						...headers
					}
				});
				const deadline = setTimeout(() => {
					const error = new Error('Guarded proxy upgrade deadline');
					reject(error);
					request.destroy(error);
					request.socket?.destroy();
				}, 5000);
				request.on('socket', (socket) => {
					clientSockets.add(socket);
					socket.once('close', () => clientSockets.delete(socket));
				});
				request.on('upgrade', (response, socket) => {
					socket.once('close', () => {
						clearTimeout(deadline);
						resolve(response.statusCode);
					});
					socket.destroy();
				});
				request.on('response', (response) => {
					const closed = new Promise((done) =>
						response.socket.once('close', done)
					);
					response.resume();
					response.once('end', async () => {
						await closed;
						clearTimeout(deadline);
						resolve(response.statusCode);
					});
				});
				request.on('error', (error) => {
					clearTimeout(deadline);
					reject(error);
				});
				request.end();
			});
		const denied = [
			{
				route: '/proxy-socket/denied-host',
				headers: {
					Host: 'foreign.parity.invalid',
					Origin: 'http://localhost'
				}
			},
			{
				route: '/proxy-socket/denied-origin',
				headers: {
					Host: 'localhost',
					Origin: 'https://foreign.parity.invalid'
				}
			}
		];
		let closeDeadline;
		try {
			const activated = await httpBytes(server.url + '/activate-proxy', {
				headers: { Accept: 'application/json' }
			});
			assert.equal(activated.decoded.toString(), 'upstream');
			assert.deepEqual(seen.http, ['/activate-proxy']);
			assert.equal(
				await pingUpgrade(server.url, {
					Host: 'parity.allowed.test',
					Origin: 'http://parity.allowed.test'
				}),
				101
			);
			assert.equal(
				await proxyUpgrade('/proxy-socket/allowed', {
					Host: 'parity.allowed.test',
					Origin: 'http://parity.allowed.test'
				}),
				101
			);
			assert.deepEqual(seen.upgrade, ['/proxy-socket/allowed']);
			for (const { route, headers } of denied)
				assert.equal(await proxyUpgrade(route, headers), 403, route);
			const drained = async () => {
				const stopped = await server.stop();
				assert.equal(stopped.code, 0);
				assert.equal(stopped.signal, null);
				await new Promise((resolve, reject) =>
					backend.server.close((error) =>
						error ? reject(error) : resolve()
					)
				);
				await Promise.all(backendClosed);
			};
			await Promise.race([
				drained(),
				new Promise((_resolve, reject) => {
					closeDeadline = setTimeout(
						() => reject(new Error('Guarded proxy close deadline')),
						5000
					);
				})
			]);
			assert.equal(clientSockets.size, 0);
			assert.equal(backendSockets.size, 0);
			for (const { route } of denied) {
				assert.equal(
					seen.http.filter((url) => url === route).length,
					0,
					route + ' upstream HTTP'
				);
				assert.equal(
					seen.upgrade.filter((url) => url === route).length,
					0,
					route + ' upstream websocket'
				);
			}
		} finally {
			clearTimeout(closeDeadline);
			for (const socket of clientSockets) socket.destroy();
			for (const socket of backendSockets) socket.destroy();
		}
	}
);

test(
	'closes an actual package-proxy websocket tunnel with the owned server',
	options,
	async (t) => {
		let remoteSocket;
		let clientSocket;
		let phase = 'setup';
		let outcome = 'pending';
		const started = process.hrtime.bigint();
		const socketState = (socket) =>
			socket
				? {
						readableFlowing: socket.readableFlowing,
						readableLength: socket.readableLength,
						readableEnded: socket.readableEnded,
						writableEnded: socket.writableEnded,
						writableFinished: socket.writableFinished,
						destroyed: socket.destroyed,
						closed: socket.closed
					}
				: null;
		const observe = (point, extra = {}) => {
			const record = {
				event: 'case13-observation',
				atUTC: new Date().toISOString(),
				elapsedNanoseconds: (
					process.hrtime.bigint() - started
				).toString(),
				pid: process.pid,
				point,
				phase,
				client: socketState(clientSocket),
				upstream: socketState(remoteSocket),
				...extra
			};
			const serialized = JSON.stringify(record);
			if (process.env.PRODUCT_DEV_EVENTS_FILE)
				writeFileSync(
					process.env.PRODUCT_DEV_EVENTS_FILE,
					serialized + '\n',
					{ flag: 'a' }
				);
			else t.diagnostic(serialized);
		};
		const observeSocket = (socket, role) => {
			socket.once('end', () => observe(role + '-end'));
			socket.once('close', () => observe(role + '-close'));
		};
		observe('case-start');
		const backend = await upstream(t, (_req, res) => res.end('ready'));
		backend.server.on('upgrade', (req, socket) => {
			remoteSocket = socket;
			observeSocket(socket, 'upstream');
			socket.once('end', () => {
				assert.equal(socket.readableEnded, true);
				socket.end();
				observe('upstream-end-reply');
			});
			observe('upstream-upgrade');
			const accept = createHash('sha1')
				.update(
					req.headers['sec-websocket-key'] +
						'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
				)
				.digest('base64');
			socket.write(
				'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' +
					accept +
					'\r\n\r\n'
			);
		});
		const { server } = await make(t, {}, {}, packageProxy(backend.url));
		await httpBytes(server.url + '/activate-proxy', {
			headers: { Accept: 'application/json' }
		});
		const client = await new Promise((resolve, reject) => {
			const request = http.request(server.url + '/proxy-socket', {
				headers: {
					'Connection': 'Upgrade',
					'Upgrade': 'websocket',
					'Sec-WebSocket-Version': '13',
					'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
					'Origin': 'http://localhost',
					'Accept': 'application/json'
				}
			});
			request.setTimeout(5000, () =>
				request.destroy(new Error('Proxy upgrade deadline'))
			);
			request.on('upgrade', (response, socket) => {
				clientSocket = socket;
				observeSocket(socket, 'client');
				observe('client-upgrade', { statusCode: response.statusCode });
				try {
					assert.equal(response.statusCode, 101);
					assert.equal(
						response.headers['sec-websocket-accept'],
						's3pPLMBiTxaQ9kYGzzhZRbK+xOo='
					);
					resolve(socket);
				} catch (error) {
					socket.destroy();
					reject(error);
				}
			});
			request.on('response', (response) => {
				response.resume();
				reject(
					new Error(
						'Proxy websocket did not upgrade: ' +
							response.statusCode
					)
				);
			});
			request.on('error', reject);
			request.end();
		});
		let deadline;
		try {
			assert.ok(remoteSocket);
			const closed = [client, remoteSocket].map(
				(socket) =>
					new Promise((resolve) => socket.once('close', resolve))
			);
			phase = 'waiting-for-close';
			observe('stop-requested');
			const stopReceipt = server.stop().then((receipt) => {
				observe('stop-resolved', { receipt });
				return receipt;
			});
			const [stopped] = await Promise.race([
				Promise.all([stopReceipt, ...closed]),
				new Promise((_resolve, reject) => {
					deadline = setTimeout(() => {
						phase = 'deadline';
						observe('deadline');
						reject(new Error('Owned websocket close deadline'));
					}, 5000);
				})
			]);
			assert.equal(stopped.code, 0);
			assert.equal(stopped.signal, null);
			phase = 'closed';
			outcome = 'passed';
			observe('close-assertions-passed');
		} catch (error) {
			phase = 'failed';
			outcome = 'failed';
			observe('case-failure', {
				errorName: error.name,
				errorMessage: error.message
			});
			throw error;
		} finally {
			phase = 'finally';
			observe('before-cleanup', { outcome });
			clearTimeout(deadline);
			client.destroy();
			remoteSocket?.destroy();
			observe('cleanup-destroy-issued', { outcome });
		}
	}
);

test(
	'package.proxy forwards API-shaped requests and preserves custom routes and public files',
	options,
	async (t) => {
		const seen = [];
		const backend = await upstream(t, (req, res) => {
			let body = '';
			req.on('data', (chunk) => (body += chunk));
			req.on('end', () => {
				seen.push({
					url: req.url,
					body,
					method: req.method,
					origin: req.headers.origin
				});
				res.writeHead(200, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify(seen.at(-1)));
			});
		});
		const custom = await upstream(t, (_req, res) =>
			res.end('custom-route')
		);
		for (const base of ['', '/brand']) {
			const { server } = await make(
				t,
				{ PUBLIC_URL: base, REACT_APP_DEV_REMOTE_API_URL: custom.url },
				{},
				packageProxy(backend.url)
			);
			for (const method of ['GET', 'POST']) {
				const response = await httpBytes(
					server.url + '/unclaimed/proxy-probe?x=1',
					{
						method,
						headers: {
							Accept: 'application/json',
							Origin: 'https://origin.parity.invalid'
						},
						...(method === 'POST'
							? { body: 'actual-request-body' }
							: {})
					}
				);
				const data = JSON.parse(response.decoded);
				assert.equal(data.url, base + '/unclaimed/proxy-probe?x=1');
				assert.equal(data.method, method);
				assert.equal(
					data.body,
					method === 'POST' ? 'actual-request-body' : ''
				);
				assert.equal(data.origin, backend.url);
			}
			const count = seen.length;
			assert.equal(
				(
					await httpBytes(
						new URL(server.url).origin + '/service/probe'
					)
				).decoded.toString(),
				'custom-route'
			);
			assert.equal(
				(
					await httpBytes(server.url + '/probe.txt', {
						headers: { Accept: 'application/json' }
					})
				).decoded.toString(),
				'controlled public asset'
			);
			const navigation = await httpBytes(
				server.url + '/unclaimed/proxy-probe?x=1',
				{ headers: { Accept: 'text/html' } }
			);
			assert.equal(navigation.status, base ? 302 : 200);
			assert.equal(seen.length, count);
			await server.stop();
		}
	}
);

test(
	'preserves observed prefix redirects and exact Accept/query-sensitive no-op worker reachability',
	options,
	async (t) => {
		const expectedWorker =
			/self\.addEventListener\('install'[\s\S]*self\.skipWaiting\(\)/;
		for (const base of ['', '/brand']) {
			const { server } = await make(t, { PUBLIC_URL: base });
			const origin = new URL(server.url).origin;
			for (const route of [
				'/',
				'/outside?q=1',
				'/outside/?q=1',
				'/brand/',
				'/brand/dotted.path?q=1'
			]) {
				const response = await httpBytes(origin + route, {
					headers: { Accept: 'text/html' }
				});
				assert.equal(response.status, base ? 302 : 200, route);
				assert.equal(
					response.headers.location,
					base ? '/brand/beratung-hilfe.html' : undefined,
					route
				);
			}
			if (base) {
				const slash = await httpBytes(origin + '/brand', {
					headers: { Accept: 'text/html' }
				});
				assert.equal(slash.status, 301);
				assert.equal(slash.headers.location, '/brand/');
			}
			const worker = await httpBytes(server.url + '/service-worker.js', {
				headers: { Accept: 'application/javascript' }
			});
			assert.equal(worker.status, 200);
			assert.match(worker.headers['content-type'], /^text\/javascript\b/);
			assert.match(worker.decoded.toString(), expectedWorker);
			const query = await httpBytes(
				server.url + '/service-worker.js?v=1',
				{ headers: { Accept: 'application/javascript' } }
			);
			assert.equal(query.status, 404);
			assert.doesNotMatch(query.decoded.toString(), expectedWorker);
			const wildcard = await httpBytes(
				server.url + '/service-worker.js?v=1'
			);
			assert.equal(wildcard.status, base ? 302 : 200);
			assert.doesNotMatch(wildcard.decoded.toString(), expectedWorker);
			await server.stop();
		}
	}
);

test(
	'missing asset classes stay hard 404 while dotted navigation and worker lifecycle remain distinct',
	options,
	async (t) => {
		for (const base of ['', '/brand']) {
			const { server } = await make(t, { PUBLIC_URL: base });
			for (const file of [
				'static/no-extension',
				'missing.js',
				'missing.mjs',
				'missing.css',
				'missing.map',
				'missing.wasm',
				'missing.png',
				'missing.jpg',
				'missing.jpeg',
				'missing.svg',
				'missing.ico',
				'missing.woff',
				'missing.woff2',
				'missing.ttf',
				'missing.txt'
			]) {
				for (const accept of ['*/*', 'text/html']) {
					const response = await httpBytes(server.url + '/' + file, {
						headers: { Accept: accept }
					});
					assert.equal(response.status, 404, file);
					assert.match(response.headers['cache-control'], /no-store/);
					assert.doesNotMatch(response.decoded.toString(), /<html/);
				}
			}
			const navigation = await httpBytes(
				server.url + '/sessions/room.name',
				{ headers: { Accept: 'text/html' } }
			);
			assert.equal(navigation.status, base ? 302 : 200);
			await server.stop();
		}
	}
);

test(
	'HTML navigation preserves the semantic shell contract independently of bundler byte hashes',
	options,
	async (t) => {
		const backend = await upstream(t, (_req, res) =>
			res.end('must-not-replace-HTML')
		);
		const { server } = await make(t, {}, {}, packageProxy(backend.url));
		const response = await httpBytes(
			server.url + '/unclaimed/proxy-probe?x=1',
			{ headers: { Accept: 'text/html' } }
		);
		assert.equal(response.status, 200);
		assert.match(response.headers['content-type'], /^text\/html\b/);
		const html = response.decoded.toString();
		assert.match(
			html,
			/<title>Beratung &amp; Hilfe<\/title>|<title>Beratung & Hilfe<\/title>/
		);
		assert.match(html, /id="appRoot"/);
		const config = html.indexOf('src="/config.js"');
		assert.ok(
			config >= 0 && config < html.search(/<script\b[^>]*type="module"/)
		);
		assert.match(html, /src="\/src\/initApp\.tsx"/);
		assert.doesNotMatch(html, /must-not-replace-HTML/);
	}
);
