import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fixture, startFixture, counterSource } from './dev-fixture.mjs';
test('updates an editable React module over real HMR without losing state or reloading', async ({
	page
}) => {
	const value = fixture();
	let server;
	const errors: string[] = [];
	const sockets: string[] = [];
	let navigations = 0;
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('websocket', (socket) => sockets.push(socket.url()));
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations++;
	});
	try {
		server = await startFixture(value, {
			WDS_SOCKET_PATH: '/controlled-hmr'
		});
		await page.goto(server.url + '/beratung-hilfe.html');
		await expect(
			page.getByRole('button', { name: 'Before 0' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Before 0' }).click();
		await expect(
			page.getByRole('button', { name: 'Before 1' })
		).toBeVisible();
		const original = await page.evaluate(() => {
			document.documentElement.dataset.productDevDocumentWitness =
				crypto.randomUUID();
			return document.documentElement.dataset.productDevDocumentWitness;
		});
		const previousNavigations = navigations;
		writeFileSync(value.counter, counterSource('After'));
		await expect(
			page.getByRole('button', { name: 'After 1' })
		).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.dataset.productDevDocumentWitness
			)
		).toBe(original);
		expect(navigations).toBe(previousNavigations);
		expect(
			sockets.some((url) => new URL(url).pathname === '/controlled-hmr')
		).toBe(true);
		expect(errors).toEqual([]);
	} finally {
		if (server) await server.stop();
		value.cleanup();
	}
});

test('disables React state-preserving refresh while keeping CSS HMR on the same page', async ({
	page
}) => {
	const value = fixture();
	let server;
	const errors: string[] = [];
	const sockets: string[] = [];
	let navigations = 0;
	page.on('pageerror', (error) => errors.push(error.message));
	page.on('websocket', (socket) => sockets.push(socket.url()));
	page.on('framenavigated', (frame) => {
		if (frame === page.mainFrame()) navigations++;
	});
	try {
		const css = path.join(value.root, 'src/refresh-contract.css');
		writeFileSync(css, 'button { color: rgb(11, 22, 33); }');
		const entry = path.join(value.root, 'src/initApp.tsx');
		writeFileSync(
			entry,
			readFileSync(entry, 'utf8') + "\nimport './refresh-contract.css';\n"
		);
		server = await startFixture(value, {
			FAST_REFRESH: 'false',
			WDS_SOCKET_PATH: '/controlled-hmr'
		});
		await page.goto(server.url + '/beratung-hilfe.html');
		await expect(page.getByRole('button', { name: 'Before 0' })).toHaveCSS(
			'color',
			'rgb(11, 22, 33)'
		);
		await page.getByRole('button', { name: 'Before 0' }).click();
		await expect(
			page.getByRole('button', { name: 'Before 1' })
		).toBeVisible();
		await page.evaluate(() => {
			document.documentElement.dataset.productDevDocumentWitness =
				crypto.randomUUID();
		});
		const beforeJavaScript = navigations;
		writeFileSync(value.counter, counterSource('After'));
		await expect(
			page.getByRole('button', { name: 'After 0' })
		).toBeVisible();
		expect(navigations).toBe(beforeJavaScript + 1);
		expect(
			await page.evaluate(
				() => document.documentElement.dataset.productDevDocumentWitness
			)
		).toBeUndefined();
		await page.getByRole('button', { name: 'After 0' }).click();
		await expect(
			page.getByRole('button', { name: 'After 1' })
		).toBeVisible();
		const afterReload = await page.evaluate(() => {
			document.documentElement.dataset.productDevDocumentWitness =
				crypto.randomUUID();
			return document.documentElement.dataset.productDevDocumentWitness;
		});
		const beforeCss = navigations;
		writeFileSync(css, 'button { color: rgb(44, 55, 66); }');
		await expect(page.getByRole('button', { name: 'After 1' })).toHaveCSS(
			'color',
			'rgb(44, 55, 66)'
		);
		expect(
			await page.evaluate(
				() => document.documentElement.dataset.productDevDocumentWitness
			)
		).toBe(afterReload);
		expect(navigations).toBe(beforeCss);
		expect(
			sockets.some((url) => new URL(url).pathname === '/controlled-hmr')
		).toBe(true);
		expect(errors).toEqual([]);
	} finally {
		try {
			if (server) await server.stop();
		} finally {
			value.cleanup();
		}
	}
});
