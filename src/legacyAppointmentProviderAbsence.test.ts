// @vitest-environment node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const scanRoots = ['src', 'cypress', 'package.json', 'package-lock.json'];
const forbiddenTokens = [
	['@ji', 'tsi/react-sdk'].join(''),
	['Ji', 'tsiMeeting'].join(''),
	['Ji', 'tsiMeetExternalAPI'].join(''),
	['videocall', 'ServiceBase'].join(''),
	['consultantVideo', 'Conference'].join(''),
	['ji', 'tsi'].join(''),
	['x', 'describe'].join(''),
	['USER_', 'VIDEO'].join(''),
	['emitVideo', 'CallRequest'].join('')
];

const collectFiles = (path: string): string[] => {
	const absolutePath = resolve(repositoryRoot, path);
	if (statSync(absolutePath).isFile()) return [absolutePath];

	return readdirSync(absolutePath).flatMap((entry) =>
		collectFiles(join(path, entry))
	);
};

describe('legacy appointment provider removal', () => {
	it('keeps active source, configuration, tests, locales, and packages free of the removed provider', () => {
		const violations = scanRoots.flatMap(collectFiles).flatMap((file) => {
			const content = readFileSync(file, 'utf8');
			return forbiddenTokens
				.filter((token) => content.includes(token))
				.map((token) => `${relative(repositoryRoot, file)}: ${token}`);
		});

		expect(violations).toEqual([]);
	});
});
