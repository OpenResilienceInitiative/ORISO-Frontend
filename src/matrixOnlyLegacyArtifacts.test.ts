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

const collectTextFiles = (root: string): string[] => {
	if (!fs.existsSync(root)) {
		return [];
	}

	return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			return collectTextFiles(entryPath);
		}
		return /\.(?:bak|css|html|js|json|jsx|md|ts|tsx|ya?ml)$/.test(
			entry.name
		)
			? [entryPath]
			: [];
	});
};

describe('Matrix-only active frontend artifacts', () => {
	it('publishes immutable multi-platform images with supply-chain evidence', () => {
		const buildAction = fs.readFileSync(
			path.join(repoRoot, '.github/actions/docker-build-push/action.yml'),
			'utf8'
		);
		const mainWorkflow = fs.readFileSync(
			path.join(repoRoot, '.github/workflows/ci-main.yml'),
			'utf8'
		);
		const releaseWorkflow = fs.readFileSync(
			path.join(repoRoot, '.github/workflows/release-image.yml'),
			'utf8'
		);

		expect(buildAction).toContain('linux/amd64,linux/arm64');
		expect(buildAction).toContain('provenance: mode=max');
		expect(buildAction).toContain('sbom: true');
		expect(buildAction).toMatch(
			/value: \$\{\{ steps\.build\.outputs\.digest \}\}/
		);

		for (const workflow of [mainWorkflow, releaseWorkflow]) {
			expect(workflow).toContain('id-token: write');
			expect(workflow).toContain('attestations: write');
			expect(workflow).toContain(
				'aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25'
			);
			expect(workflow).toContain(
				'actions/attest@f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6'
			);
			expect(workflow).toContain('subject-digest: ${{ steps.');
			expect(workflow).toMatch(
				/image-ref: .*@\$\{\{ steps\..*\.outputs\.digest \}\}/
			);
		}

		expect(releaseWorkflow).toContain('platforms: linux/amd64,linux/arm64');
		expect(releaseWorkflow).toContain('provenance: mode=max');
		expect(releaseWorkflow).toContain('sbom: true');
	});

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

	it('does not keep Rocket.Chat, DDP, or Jitsi artifacts in Storybook', () => {
		const storybookRoot = path.join(repoRoot, '.storybook');
		const forbidden =
			/Rocket\.?Chat|storybookRocketChat|\bDDP\b|ddp-client|ddpClient|api\/v1\/settings\.public|rooms\/get|subscriptions\/get|Jitsi/;
		const findings = collectTextFiles(storybookRoot).flatMap((file) => {
			const source = fs.readFileSync(file, 'utf8');
			return forbidden.test(source)
				? [path.relative(repoRoot, file)]
				: [];
		});

		expect(findings).toEqual([]);
		expect(
			fs.existsSync(path.join(storybookRoot, 'preview.tsx.sb7.bak'))
		).toBe(false);

		const preview = fs.readFileSync(
			path.join(storybookRoot, 'preview.tsx'),
			'utf8'
		);
		expect(preview).toContain('installStorybookRealtimeMocks');
		expect(preview).toContain('/service/live');
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
