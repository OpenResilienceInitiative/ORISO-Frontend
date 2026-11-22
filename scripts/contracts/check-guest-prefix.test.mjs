import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkGuestPrefix, findPrefixChecks } from './check-guest-prefix.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('flags every way the old code detected guests by name', () => {
	for (const line of [
		"(username.startsWith('Anonymous-') || username.startsWith('anon_'));",
		"(value) => !value.toLowerCase().startsWith('anonymous-')",
		'const LOGIN_LIKE = /@|_at_|^enc\\.|^Anonymous-|^anon_/i;',
		'const LEGACY = /^(?:Anonymous-|anon_)/;',
		"if (name.slice(0, 5) === 'anon_') return true;",
		'const re = new RegExp("^anon_");',
		'if (user.username.includes(`anon_`)) {}'
	]) {
		assert.equal(findPrefixChecks(line).length, 1, line);
	}
});

test('ignores comments, storage keys and fixtures that merely mention the prefix', () => {
	for (const line of [
		'// live chat once minted Anonymous-<timestamp> and later anon_N',
		' * a historical `Anonymous-` / `anon_` login.',
		'sessionStorage.getItem(`anonymous-pseudonym-name-${id}`);',
		'const key = (id) => `anonymous-waiting-dismissed-${id}`;',
		"userName: 'anon_5',"
	]) {
		assert.deepEqual(findPrefixChecks(line), [], line);
	}
});

test('src/ has no name-prefix guest detection outside the allowlist', () => {
	assert.deepEqual(checkGuestPrefix(root), { violations: [], stale: [] });
});
