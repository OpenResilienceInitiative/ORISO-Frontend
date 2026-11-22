import { describe, expect, it } from 'vite-plus/test';
import { isEmailShapedLogin } from './isEmailShapedLogin';

describe('email-shaped login names', () => {
	it.each([
		'legacy.owner_at_example.test',
		'other.asker_at_example.org',
		' Alias+case@contact.example ',
		'local_at_alias_AT_sub.example'
	])('recognizes a credential shape (%s)', (value) => {
		expect(isEmailShapedLogin(value)).toBe(true);
	});

	it.each(['Ruhiges Yak', 'ruhiges_yak', 'anon_123', 'meet_at_noon', ''])(
		'keeps a non-email label (%s)',
		(value) => expect(isEmailShapedLogin(value)).toBe(false)
	);
});
