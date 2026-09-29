import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// The postbuild gate is the Frontend CI guard against deployment hosts baked
// into the bundle (ORISO-Helm#368). Test it directly so a pattern cannot be
// dropped without a red run.

const script = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	'validate-hardcoded-hosts.sh'
);

const runGuardOn = (content, fileName = 'main.js') => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hosts-guard-'));
	try {
		fs.writeFileSync(path.join(dir, fileName), content);
		return spawnSync('bash', [script, dir], { encoding: 'utf8' });
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
};

for (const host of [
	'https://app.oriso.org',
	'https://oriso.org/www.beratung.example.org',
	'https://auth.oriso.org/realms/x',
	'@user:oriso.org',
	'https://app.oriso-dev.site',
	'https://call.oriso.site'
]) {
	test(`fails the build when the bundle contains ${host}`, () => {
		const result = runGuardOn(`const u = "${host}";`);
		assert.equal(result.status, 1, result.stdout + result.stderr);
	});
}

test('passes a bundle that only uses example hosts', () => {
	const result = runGuardOn('const u = "https://app.example.org";');
	assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('ignores source maps, which embed comments', () => {
	const result = runGuardOn('// app.oriso.org', 'main.js.map');
	assert.equal(result.status, 0, result.stdout + result.stderr);
});
