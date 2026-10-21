import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { runInNewContext } from 'node:vm';
import path from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
	fixture,
	startFixture,
	certificateFiles
} from '../playwright/product-vite/dev-fixture.mjs';
const options = { timeout: 30000 };
const make = async (t, env = {}, settings = {}) => {
	const value = fixture();
	let server;
	t.after(async () => {
		try {
			await server?.stop();
		} finally {
			value.cleanup();
		}
	});
	server = await startFixture(value, env, settings);
	return { value, server };
};
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
