import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const readSource = (relativePath: string): string =>
	readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Matrix-only UserService API contract', () => {
	it('queries sessions by Matrix room IDs', () => {
		const source = readSource('./apiGetSessionRooms.ts');

		expect(source).toContain('roomIds[]');
		expect(source).not.toMatch(/rcGroupIds|ByGroupIds/);
	});

	it('bans a Matrix user without Rocket.Chat identifiers', () => {
		const endpointSource = readSource('../resources/scripts/endpoints.ts');
		const apiSource = readSource('./apiPostBanUser.ts');

		expect(endpointSource).toContain('banUser: (matrixUserId, chatId)');
		expect(apiSource).toContain('matrixUserId');
		expect(`${endpointSource}\n${apiSource}`).not.toMatch(
			/rcUserId|rcToken/
		);
	});
});
