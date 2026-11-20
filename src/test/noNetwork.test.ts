// @vitest-environment oriso-jsdom
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vite-plus/test';
import { fetchData } from '../api/fetchData';

// A reachable server: without the noNetwork setup the request would go out.
let server: Server;
let received = 0;
let origin = '';
beforeAll(async () => {
	server = createServer((_, response) => {
		received++;
		response.end('{}');
	});
	await new Promise<void>((resolve) =>
		server.listen(0, '127.0.0.1', resolve)
	);
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

it('settles an unmocked request inside the test, without the network', async () => {
	await expect(
		fetchData({ url: `${origin}/service/x`, method: 'GET', skipAuth: true })
	).rejects.toThrow(/Unit tests have no network; mock this request: GET /);
	expect(received).toBe(0);
});
