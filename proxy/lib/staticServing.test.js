const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
	registerBuildAssetRoutes,
	registerSpaFallback
} = require('./staticServing');

const INDEX_HTML = '<!doctype html><html><body>spa shell</body></html>';
const CHUNK_JS = '"use strict";console.log("chunk");';

let buildPath;

const createApp = async () => {
	const app = express();
	await registerBuildAssetRoutes(app, buildPath);
	// The real server registers API proxy middlewares here; they never
	// handle /static URLs, so the tests go straight to the SPA fallback.
	registerSpaFallback(app, buildPath);
	return app;
};

test.before(() => {
	buildPath = fs.mkdtempSync(path.join(os.tmpdir(), 'oriso-proxy-build-'));
	fs.mkdirSync(path.join(buildPath, 'static', 'js'), { recursive: true });
	fs.writeFileSync(path.join(buildPath, 'beratung-hilfe.html'), INDEX_HTML);
	fs.writeFileSync(path.join(buildPath, 'config.js'), 'window.config = {};');
	fs.writeFileSync(
		path.join(buildPath, 'static', 'js', '354.1d2e3d50.chunk.js'),
		CHUNK_JS
	);
});

test.after(() => {
	fs.rmSync(buildPath, { recursive: true, force: true });
});

test('serves an existing hashed chunk with long-lived caching', async () => {
	const app = await createApp();
	const response = await request(app).get('/static/js/354.1d2e3d50.chunk.js');

	assert.equal(response.status, 200);
	assert.equal(response.text, CHUNK_JS);
	assert.match(response.headers['content-type'], /javascript/);
	assert.match(response.headers['cache-control'], /max-age=86400/);
});

/**
 * The regression this pins down: build assets are content-hashed and exist
 * only under /static. When a chunk URL misses (deploy replaced the build,
 * rolling update raced, stale shell), answering with the SPA shell poisons
 * the browser cache — HTML sits under the .js URL, revalidates 304 against
 * the shell's own ETag, and every import() of that chunk fails until the
 * NEXT deploy changes the shell. The user sees a dead login route ("Ups!…")
 * or a silently missing stage composition. A missing /static asset must be
 * a hard 404: browsers do not cache it, and a reload heals the session.
 */
test('a missing hashed chunk is a hard 404, never the SPA shell', async () => {
	const app = await createApp();
	const response = await request(app).get('/static/js/354.0000dead.chunk.js');

	assert.equal(response.status, 404);
	assert.ok(
		!response.text.includes('<!doctype'),
		'must not serve the SPA shell as JavaScript'
	);
});

test('a missing static css/media asset is a hard 404 too', async () => {
	const app = await createApp();
	for (const url of [
		'/static/css/265.deadbeef.chunk.css',
		'/static/media/gone.woff2'
	]) {
		const response = await request(app).get(url);
		assert.equal(response.status, 404, url);
		assert.ok(!response.text.includes('<!doctype'), url);
	}
});

test('SPA routes outside /static still get the shell', async () => {
	const app = await createApp();
	for (const url of ['/', '/login', '/sessions/some/deep/route']) {
		const response = await request(app).get(url);
		assert.equal(response.status, 200, url);
		assert.equal(response.text, INDEX_HTML, url);
	}
});

test('config.js is served with no-store so a redeploy always wins', async () => {
	const app = await createApp();
	const response = await request(app).get('/config.js');

	assert.equal(response.status, 200);
	assert.match(response.headers['cache-control'], /no-store/);
});
