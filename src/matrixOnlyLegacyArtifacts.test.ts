import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..');

const collectFiles = (root: string): string[] => {
	if (!fs.existsSync(root)) {
		return [];
	}

	return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			return collectFiles(entryPath);
		}
		return /\.(?:ts|tsx|json)$/.test(entry.name) ? [entryPath] : [];
	});
};

describe('Matrix-only active frontend artifacts', () => {
	it('pins every container base used by the release Dockerfiles', () => {
		const runtimeDockerfile = fs.readFileSync(
			path.join(repoRoot, 'Dockerfile'),
			'utf8'
		);
		const storybookDockerfile = fs.readFileSync(
			path.join(repoRoot, 'Dockerfile.storybook'),
			'utf8'
		);

		expect(runtimeDockerfile).toMatch(
			/ARG NODE_VERSION=[^\s]+@sha256:[a-f0-9]{64}/
		);
		expect(storybookDockerfile).toMatch(
			/ARG NODE_VERSION=[^\s]+@sha256:[a-f0-9]{64}/
		);
		expect(storybookDockerfile).toMatch(
			/FROM nginx:[^\s]+@sha256:[a-f0-9]{64}/
		);
		expect(
			fs.readFileSync(path.join(repoRoot, '.dockerignore'), 'utf8')
		).toMatch(/\*\*\/node_modules[\s\S]*proxy\/\*\*\/\*\.test\.js/);
		expect(
			fs.existsSync(path.join(repoRoot, 'proxy/routes/index.js.backup'))
		).toBe(false);
		expect(
			fs.existsSync(
				path.join(repoRoot, 'proxy/routes/weblate.js.backup.original')
			)
		).toBe(false);
	});

	it('does not ship the frozen MessageService API snapshot', () => {
		expect(
			fs.existsSync(
				path.join(repoRoot, 'src/generated/messageservice.d.ts')
			)
		).toBe(false);
	});

	it('does not keep Rocket.Chat credentials or identifiers in Cypress', () => {
		const forbidden =
			/rc_token|rc_uid|rcLogin|rcGroupId|rcGroupIds|askerRcId|initiatorRcUserId|MessageService|api\.v1\.login|Rocket\.?Chat/;
		const findings = collectFiles(path.join(repoRoot, 'cypress')).flatMap(
			(file) => {
				const source = fs.readFileSync(file, 'utf8');
				return forbidden.test(source)
					? [path.relative(repoRoot, file)]
					: [];
			}
		);

		expect(findings).toEqual([]);
	});

	it('does not export dormant server-side video-call endpoints', () => {
		const apiIndex = fs.readFileSync(
			path.join(repoRoot, 'src/api/index.ts'),
			'utf8'
		);
		const endpoints = fs.readFileSync(
			path.join(repoRoot, 'src/resources/scripts/endpoints.ts'),
			'utf8'
		);

		expect(apiIndex).not.toContain('apiStartVideoCall');
		expect(endpoints).not.toMatch(/startVideoCall|rejectVideoCall/);
		expect(
			fs.existsSync(path.join(repoRoot, 'src/api/apiStartVideoCall.ts'))
		).toBe(false);
		expect(
			fs.existsSync(
				path.join(
					repoRoot,
					'src/components/sessionHeader/GroupChatHeader/useStartVideoCall/index.ts'
				)
			)
		).toBe(false);
	});
});
