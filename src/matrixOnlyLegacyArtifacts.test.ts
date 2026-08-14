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
		return /\.(?:bak|css|html|js|json|jsx|md|ts|tsx|ya?ml)$/i.test(
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
		// Provenance and SBOM are conditional on actually pushing: a discarded
		// validation build must not pay for attestations it throws away. The
		// guarantee still holds for every published image — ci-main.yml is the
		// only publishing caller of this action and passes push_to_ghcr: true
		// (release-image.yml calls docker/build-push-action directly and is
		// covered by the unconditional assertions further down).
		expect(buildAction).toMatch(
			/provenance: \$\{\{ inputs\.push_to_ghcr == 'true' && 'mode=max' \|\| 'false' \}\}/
		);
		expect(buildAction).toMatch(
			/sbom: \$\{\{ inputs\.push_to_ghcr == 'true' \}\}/
		);
		expect(mainWorkflow).toContain('push_to_ghcr: true');
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
			/rocket[._-]?chat|storybookRocketChat|\bddp(?:[._-]?client)?\b|api\/v1\/settings\.public|rooms\/get|subscriptions\/get|ji[t]si/i;
		const findings = collectTextFiles(storybookRoot).flatMap((file) => {
			const relativePath = path.relative(repoRoot, file);
			const source = fs.readFileSync(file, 'utf8');
			return forbidden.test(relativePath) || forbidden.test(source)
				? [relativePath]
				: [];
		});

		expect(findings).toEqual([]);
		expect(
			fs.existsSync(path.join(storybookRoot, 'preview.tsx.sb7.bak'))
		).toBe(false);
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

	it('does not ship the retired LiveService browser transport', () => {
		const packageJson = fs.readFileSync(
			path.join(repoRoot, 'package.json'),
			'utf8'
		);
		const endpoints = fs.readFileSync(
			path.join(repoRoot, 'src/resources/scripts/endpoints.ts'),
			'utf8'
		);
		const appShell = fs.readFileSync(
			path.join(repoRoot, 'src/components/app/app.tsx'),
			'utf8'
		);
		const envExample = fs.readFileSync(
			path.join(repoRoot, '.env.example'),
			'utf8'
		);
		const matrixTokenBootstrap = fs.readFileSync(
			path.join(
				repoRoot,
				'src/components/sessionCookie/getMatrixAccessToken.ts'
			),
			'utf8'
		);

		expect(packageJson).not.toMatch(
			/@stomp\/stompjs|sockjs-client|mock-socket/
		);
		expect(endpoints).not.toMatch(/liveservice|\/service\/live/);
		expect(appShell).not.toMatch(/WebsocketHandler|disconnectWebsocket/);
		expect(envExample).not.toContain('REACT_APP_DISABLE_LIVE_WEBSOCKET');
		expect(matrixTokenBootstrap).not.toContain(
			'REACT_APP_DISABLE_LIVE_WEBSOCKET'
		);
		expect(
			fs.existsSync(
				path.join(repoRoot, 'src/components/app/WebsocketHandler.tsx')
			)
		).toBe(false);
		expect(
			fs.existsSync(
				path.join(
					repoRoot,
					'src/globalState/provider/WebsocketConnectionDeactivatedProvider.tsx'
				)
			)
		).toBe(false);
	});

	it('does not retain the superseded LiveService Storybook worklog', () => {
		expect(
			fs.existsSync(
				path.join(
					repoRoot,
					'docs/cursor-orchestrator/2026-07-28_remove-storybook-rocketchat'
				)
			)
		).toBe(false);
	});
});
