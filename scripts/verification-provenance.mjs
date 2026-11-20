import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { version as runtimeViteVersion } from 'vite';

const require = createRequire(import.meta.url);
const addonRequire = createRequire(
	require.resolve('@storybook/addon-a11y/package.json')
);
const git = (cwd, ...args) =>
	execFileSync('git', args, { cwd, encoding: 'utf8' });
const hash = (value) => createHash('sha256').update(value).digest('hex');
const version = (name) =>
	JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8'))
		.version;

// Hash the actual nonignored source bytes, including local untracked additions.
// Persist only an aggregate digest/count, never file contents or the environment.
export const sourceIdentity = (cwd, suppliedRevision) => {
	const root = git(cwd, 'rev-parse', '--show-toplevel').trim();
	const revision = git(root, 'rev-parse', 'HEAD').trim();
	if (suppliedRevision && suppliedRevision !== revision)
		throw new Error(
			'Verification source SHA does not match checked-out HEAD'
		);
	const files = [
		...new Set(
			git(
				root,
				'ls-files',
				'--cached',
				'--others',
				'--exclude-standard',
				'-z'
			)
				.split('\0')
				.filter(Boolean)
		)
	].sort();
	const digest = createHash('sha256');
	for (const file of files) {
		const absolute = path.join(root, file);
		let content;
		try {
			const stat = lstatSync(absolute);
			if (stat.isSymbolicLink())
				content = `symlink:${readlinkSync(absolute)}`;
			else if (stat.isFile())
				content = `file:${stat.mode & 0o111}:${hash(readFileSync(absolute))}`;
			else content = 'non-file';
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
			content = 'deleted';
		}
		digest.update(`${file}\0${content}\0`);
	}
	return {
		revision,
		revisionOrigin: suppliedRevision ? 'explicit-checkout-sha' : 'git-head',
		dirty:
			git(root, 'status', '--porcelain', '--untracked-files=all').length >
			0,
		snapshot: {
			algorithm: 'sha256',
			digest: digest.digest('hex'),
			files: files.length
		}
	};
};

export const createRunProvenance = ({ runId, projects, inputs }) => ({
	schemaVersion: 1,
	runId,
	startedAt: new Date().toISOString(),
	source: sourceIdentity(process.cwd(), process.env.VERIFICATION_SOURCE_SHA),
	runtime: {
		node: process.version,
		platform: process.platform,
		arch: process.arch
	},
	toolchain: {
		vitePlus: version('vite-plus'),
		vitest: version('vitest'),
		storybook: version('storybook'),
		axeCore: JSON.parse(
			readFileSync(addonRequire.resolve('axe-core/package.json'), 'utf8')
		).version,
		vite: {
			package: JSON.parse(
				readFileSync(require.resolve('vite/package.json'), 'utf8')
			).name,
			packageVersion: version('vite'),
			runtimeVersion: runtimeViteVersion
		}
	},
	invocation: {
		verificationMode: {
			controls: process.env.ORISO_VERIFICATION_CONTROLS === 'true',
			phase: process.env.ORISO_A11Y_CONTROL_PHASE ?? null,
			taskOnlyEntries:
				process.env.ORISO_VERIFICATION_CONTROLS === 'true'
					? JSON.parse(process.env.ORISO_A11Y_BASELINE_JSON || '[]')
							.length
					: 0
		},
		command: [...process.argv],
		npmScript: process.env.npm_lifecycle_script,
		projects,
		inputs: inputs.map((file) => ({
			path: path.relative(process.cwd(), file),
			sha256: hash(readFileSync(file))
		}))
	}
});

export const suppliedBrowser = (meta) => {
	const userAgent = meta?.verificationA11y?.reports?.find(
		(report) => report.result?.testEnvironment?.userAgent
	)?.result.testEnvironment.userAgent;
	if (typeof userAgent !== 'string') return undefined;
	const chromium = /(?:HeadlessChrome|Chrome)\/([\d.]+)/.exec(userAgent);
	return {
		name: chromium ? 'chromium' : 'browser',
		...(chromium && { version: chromium[1] }),
		userAgent
	};
};
