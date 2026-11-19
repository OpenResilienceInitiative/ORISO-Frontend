import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

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
		const readSource = (file: string) =>
			fs
				.readFileSync(path.join(repoRoot, file), 'utf8')
				.split('\n')
				.filter((line) => !line.trim().startsWith('#'))
				.join('\n');
		const expectOrder = (source: string, ...markers: string[]) => {
			let previous = -1;
			for (const marker of markers) {
				const current = source.indexOf(marker);
				expect(current).toBeGreaterThan(previous);
				previous = current;
			}
		};

		const buildAction = readSource(
			'.github/actions/docker-build-push/action.yml'
		);
		const mainWorkflow = readSource('.github/workflows/ci-main.yml');
		const storybookWorkflow = readSource(
			'.github/workflows/ci-storybook-main.yml'
		);
		const releaseWorkflow = readSource('.github/workflows/release-image.yml');
		const scanScript = readSource('scripts/ci/scan-image-archive.sh');
		const publishScript = readSource('scripts/ci/publish-image-archive.sh');
		const composite = 'uses: ./.github/actions/docker-build-push';

		expect(buildAction).toContain('default: linux/amd64,linux/arm64');
		expect(
			buildAction.match(/^\s*uses: docker\/build-push-action@/gm)
		).toHaveLength(1);
		expect(buildAction).toMatch(
			/platforms: \$\{\{ inputs\.platforms \}\}\s+push: false\s+outputs: type=oci,/
		);
		expect(buildAction).toMatch(/^\s*provenance: mode=max$/m);
		expect(buildAction).toMatch(/^\s*sbom: true$/m);
		expect(buildAction).toContain('value: ${{ steps.publish.outputs.digest }}');
		expect(buildAction).toContain('IMAGE_ARCHIVE: ${{ steps.scan.outputs.archive }}');
		expect(buildAction).toContain(
			'EXPECTED_ARCHIVE_SHA256: ${{ steps.scan.outputs.archive_sha256 }}'
		);
		expect(buildAction).toContain(
			'aquasecurity/setup-trivy@3fb12ec12f41e471780db15c232d5dd185dcb514'
		);
		expect(scanScript).toContain(
			'trivy image --input "$scan_root/$arch" --platform "$platform"'
		);
		expect(scanScript).toContain('--exit-code 1 --ignore-unfixed');
		expect(scanScript).toContain('--vuln-type os,library --severity CRITICAL,HIGH');
		expectOrder(
			buildAction,
			'uses: docker/build-push-action@v7',
			'bash scripts/ci/scan-image-archive.sh',
			'uses: docker/login-action@v4',
			'bash scripts/ci/publish-image-archive.sh'
		);
		expectOrder(
			publishScript,
			'!= "$expected_archive_sha256"',
			'skopeo copy --all --preserve-digests',
			'!= "$expected_digest"',
			"printf 'digest=%s"
		);

		for (const tag of ['type=sha', 'value=latest', 'value=dev', 'value=pre-dev']) {
			expect(buildAction).toContain(tag);
		}
		for (const workflow of [mainWorkflow, storybookWorkflow]) {
			expect(workflow).toContain(composite);
			expect(workflow).toContain('push_to_ghcr: true');
			expect(workflow).not.toMatch(/^\s*platforms:/m);
		}
		expect(storybookWorkflow).toContain('dockerfile: Dockerfile.storybook');

		for (const workflow of [mainWorkflow, releaseWorkflow]) {
			expect(workflow).toContain('id-token: write');
			expect(workflow).toContain('attestations: write');
			expect(workflow).toContain(
				'actions/attest@f7c74d28b9d84cb8768d0b8ca14a4bac6ef463e6'
			);
			expect(workflow).toContain('push-to-registry: true');
		}
		expect(mainWorkflow).toContain(
			'subject-digest: ${{ steps.image.outputs.digest }}'
		);

		expect(
			releaseWorkflow.match(/uses: \.\/\.github\/actions\/docker-build-push/g)
		).toHaveLength(2);
		expect(releaseWorkflow.match(/push_to_ghcr: false/g)).toHaveLength(2);
		expect(
			releaseWorkflow.match(/bash scripts\/ci\/publish-image-archive\.sh/g)
		).toHaveLength(2);
		expect(releaseWorkflow).not.toMatch(
			/docker\/build-push-action|^\s*(?:push: true$|platforms:)/m
		);
		expect(releaseWorkflow).toContain(
			"steps.disposition.outputs.mode == 'verify_existing'"
		);
		for (const image of ['frontend', 'storybook']) {
			expect(releaseWorkflow).toContain(
				'EXPECTED_ARCHIVE_SHA256: ${{ steps.' +
					image +
					'_archive.outputs.archive_sha256 }}'
			);
			expect(releaseWorkflow).toContain(
				'subject-digest: ${{ steps.' + image + '_image.outputs.digest }}'
			);
		}
		expectOrder(
			releaseWorkflow,
			'id: frontend_archive',
			'id: storybook_archive',
			'uses: docker/login-action@v4',
			'Verify tag still absent before publishing',
			'id: frontend_image',
			'id: storybook_image',
			'Verify tag still absent before tagging',
			'Create and push release tag',
			'Create GitHub Release'
		);
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
		// Dockerfile.storybook has no node base: it copies the storybook-static
		// output the workflow builds. nginx is the only base it still pulls, so
		// asserting a NODE_VERSION pin here would demand a stage that must not
		// come back — an in-image `npm install` for linux/arm64 runs under QEMU
		// and cost that workflow ~28 minutes per publish.
		expect(storybookDockerfile).not.toMatch(/ARG NODE_VERSION=/);
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
});
