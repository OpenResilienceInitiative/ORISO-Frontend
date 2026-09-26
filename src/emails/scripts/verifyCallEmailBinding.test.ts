import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ids = ['anruf-erinnerung', 'anruf-einladung', 'anruf-verpasst'];
const tones = ['de-sie', 'de-du', 'en'];
let root: string;
let originalArguments: string[];

const writeFixture = (repository: string, entry: unknown) => {
	const emails = path.join(
		root,
		repository,
		repository === 'frontend'
			? 'src/emails/dist'
			: 'src/main/resources/emails'
	);
	mkdirSync(emails, { recursive: true });
	writeFileSync(
		path.join(emails, 'catalogue.json'),
		JSON.stringify({
			mails: Object.fromEntries(ids.map((id) => [id, entry]))
		})
	);
	for (const tone of tones) {
		const folder = path.join(
			emails,
			repository === 'frontend' ? 'plain' : '',
			tone
		);
		mkdirSync(folder, { recursive: true });
		for (const id of ids)
			for (const part of ['html', 'txt'])
				writeFileSync(
					path.join(folder, `${id}.${part}`),
					`${id}:${tone}:${part}`
				);
	}
};

beforeEach(() => {
	vi.resetModules();
	root = mkdtempSync(path.join(os.tmpdir(), 'call-binding-'));
	originalArguments = process.argv;
	process.argv = [
		process.execPath,
		'verifyCallEmailBinding.mts',
		path.join(root, 'frontend'),
		path.join(root, 'userservice')
	];
});

afterEach(() => {
	process.argv = originalArguments;
	rmSync(root, { recursive: true, force: true });
});

describe('call email catalogue binding', () => {
	it('accepts equivalent entries with reordered object keys, including nested keys', async () => {
		writeFixture('frontend', {
			subject: 'Call',
			placeholders: ['name', 'link'],
			locales: { de: 'Anruf', en: 'Call' }
		});
		writeFixture('userservice', {
			locales: { en: 'Call', de: 'Anruf' },
			placeholders: ['name', 'link'],
			subject: 'Call'
		});
		await expect(
			import('./verifyCallEmailBinding.mts')
		).resolves.toBeDefined();
	});

	it('rejects a genuine nested catalogue content difference', async () => {
		writeFixture('frontend', { locales: { en: 'Call' } });
		writeFixture('userservice', { locales: { en: 'Different' } });
		await expect(import('./verifyCallEmailBinding.mts')).rejects.toThrow(
			'call catalogue entry differs between repositories: anruf-erinnerung'
		);
	});

	it('still rejects different array ordering', async () => {
		writeFixture('frontend', { placeholders: ['name', 'link'] });
		writeFixture('userservice', { placeholders: ['link', 'name'] });
		await expect(import('./verifyCallEmailBinding.mts')).rejects.toThrow(
			'call catalogue entry differs between repositories: anruf-erinnerung'
		);
	});
});
