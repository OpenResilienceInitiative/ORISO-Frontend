const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { generateKeyPair, exportJWK, SignJWT } = require('jose');
const http = require('http');

const {
	createAuthenticateRequest,
	resetJwksCache
} = require('./lib/authenticateRequest');
const { registerLivekitTokenRoutes } = require('./lib/livekitTokenRoutes');
const { collectRoomIdentifiers } = require('./lib/roomMembership');

const REALM_URL = 'http://127.0.0.1:59998/realms/online-beratung';
const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ALLOWED_ROOM = '!allowed-room:matrix.example.org';
const FOREIGN_ROOM = '!foreign-room:matrix.example.org';

let privateKey;
let publicJwk;
let jwksServer;
const originalFetch = global.fetch;

const signToken = async (payload = {}) =>
	new SignJWT({
		sub: USER_ID,
		preferred_username: 'consultant-1',
		realm_access: { roles: ['AUTHORIZATION_CONSULTANT_DEFAULT'] },
		...payload
	})
		.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
		.setIssuer(REALM_URL)
		.setExpirationTime('2h')
		.sign(privateKey);

const createTestApp = (authMiddleware) => {
	const app = express();
	app.use(express.json());
	registerLivekitTokenRoutes(app, authMiddleware);
	return app;
};

test.before(async () => {
	const keyPair = await generateKeyPair('RS256');
	privateKey = keyPair.privateKey;
	publicJwk = await exportJWK(keyPair.publicKey);
	publicJwk.kid = 'test-key';
	publicJwk.alg = 'RS256';
	publicJwk.use = 'sig';

	jwksServer = http.createServer((req, res) => {
		if (
			req.url === '/realms/online-beratung/protocol/openid-connect/certs'
		) {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ keys: [publicJwk] }));
			return;
		}

		res.writeHead(404);
		res.end();
	});

	await new Promise((resolve) => jwksServer.listen(59998, resolve));

	process.env.KEYCLOAK_REALM_URL = REALM_URL;
	process.env.USER_SERVICE_URL = 'http://userservice.test';
	process.env.LIVEKIT_TOKEN_SERVICE_URL = 'http://livekit-token.test';
	resetJwksCache();
});

test.after(async () => {
	global.fetch = originalFetch;
	await new Promise((resolve) => jwksServer.close(resolve));
});

test('GET /api/livekit/token without auth returns 401', async () => {
	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app).get(
		`/api/livekit/token?roomName=${encodeURIComponent(ALLOWED_ROOM)}`
	);

	assert.equal(response.status, 401);
});

test('POST /api/livekit/token without auth returns 401', async () => {
	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app)
		.post('/api/livekit/token')
		.send({ roomName: ALLOWED_ROOM });

	assert.equal(response.status, 401);
});

test('GET /api/livekit/token with invalid token returns 401', async () => {
	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app)
		.get(`/api/livekit/token?roomName=${encodeURIComponent(ALLOWED_ROOM)}`)
		.set('Authorization', 'Bearer invalid.token.value');

	assert.equal(response.status, 401);
});

test('GET with foreign roomName returns 403', async () => {
	const token = await signToken();
	global.fetch = async (url) => {
		if (String(url).includes('/service/users/sessions/consultants')) {
			return {
				ok: true,
				status: 200,
				json: async () => ({
					sessions: [
						{
							session: {
								matrixRoomId: ALLOWED_ROOM
							}
						}
					]
				})
			};
		}

		throw new Error(`Unexpected fetch URL: ${url}`);
	};

	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app)
		.get(`/api/livekit/token?roomName=${encodeURIComponent(FOREIGN_ROOM)}`)
		.set('Authorization', `Bearer ${token}`)
		.set('X-CSRF-Token', 'csrf-token')
		.set('Cookie', 'CSRF-TOKEN=csrf-token');

	assert.equal(response.status, 403);
});

test('GET ignores client-controlled identity and uses authenticated user id', async () => {
	const token = await signToken();
	let requestedIdentity;

	global.fetch = async (url, options = {}) => {
		if (String(url).includes('/service/users/sessions/consultants')) {
			return {
				ok: true,
				status: 200,
				json: async () => ({
					sessions: [
						{
							session: {
								matrixRoomId: ALLOWED_ROOM
							}
						}
					]
				})
			};
		}

		if (String(url).includes('livekit-token.test/api/livekit/token')) {
			const parsed = new URL(String(url));
			requestedIdentity = parsed.searchParams.get('identity');
			return {
				ok: true,
				status: 200,
				json: async () => ({ token: 'livekit-jwt' })
			};
		}

		if (options.method === 'POST') {
			const body = JSON.parse(options.body);
			requestedIdentity = body.identity;
			return {
				ok: true,
				status: 200,
				json: async () => ({ token: 'livekit-jwt' })
			};
		}

		throw new Error(`Unexpected fetch URL: ${url}`);
	};

	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app)
		.get(
			`/api/livekit/token?roomName=${encodeURIComponent(ALLOWED_ROOM)}&identity=AnyoneElse`
		)
		.set('Authorization', `Bearer ${token}`)
		.set('X-CSRF-Token', 'csrf-token')
		.set('Cookie', 'CSRF-TOKEN=csrf-token');

	assert.equal(response.status, 200);
	assert.equal(response.body.token, 'livekit-jwt');
	assert.equal(requestedIdentity, USER_ID);
});

test('POST with invalid body returns 400', async () => {
	const token = await signToken();
	const app = createTestApp(createAuthenticateRequest());
	const response = await request(app)
		.post('/api/livekit/token')
		.set('Authorization', `Bearer ${token}`)
		.send({});

	assert.equal(response.status, 400);
});

test('collectRoomIdentifiers includes matrix and legacy group ids', () => {
	const identifiers = collectRoomIdentifiers([
		{ session: { matrixRoomId: '!room:example.org', groupId: 'group-1' } },
		{ chat: { matrixRoomId: '!chat:example.org', groupId: 'group-2' } }
	]);

	assert.equal(identifiers.has('!room:example.org'), true);
	assert.equal(identifiers.has('group-1'), true);
	assert.equal(identifiers.has('!chat:example.org'), true);
	assert.equal(identifiers.has('group-2'), true);
});
