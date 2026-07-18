import { describe, expect, it } from 'vitest';
import { parseMessagePrefixes, buildVisibleToPrefix } from './messageConstants';

/**
 * ADR-017 hard cut: `[THREAD:…]` no longer carries thread identity. These
 * guard the one behaviour that survives — a purely cosmetic strip of a
 * leftover leading token — plus the unrelated prefixes that must keep working.
 */
describe('parseMessagePrefixes — ADR-017 thread cosmetic strip', () => {
	it('strips a leading [THREAD:…] token from the body with no thread semantics', () => {
		const parsed = parseMessagePrefixes('[THREAD:$root:hs] Hallo Welt');

		expect(parsed.cleanedMessage).toBe('Hallo Welt');
		// No thread fields are exposed anymore.
		expect(parsed).not.toHaveProperty('threadRootId');
		expect(parsed).not.toHaveProperty('isThreadMessage');
	});

	it('leaves a message without the token untouched', () => {
		expect(parseMessagePrefixes('kein Prefix hier').cleanedMessage).toBe(
			'kein Prefix hier'
		);
	});

	it('keeps VISIBLE_TO parsing intact (ADR-008 aside routing)', () => {
		const parsed = parseMessagePrefixes(
			`${buildVisibleToPrefix(['u1', 'u2'])} geheim`
		);

		expect(parsed.visibleToUserIds).toEqual(['u1', 'u2']);
		expect(parsed.cleanedMessage).toBe('geheim');
	});

	it('still strips the [THREAD:…] token even when combined with VISIBLE_TO', () => {
		const parsed = parseMessagePrefixes(
			`[THREAD:$root:hs] ${buildVisibleToPrefix(['u1'])} inhalt`
		);

		expect(parsed.visibleToUserIds).toEqual(['u1']);
		expect(parsed.cleanedMessage).toBe('inhalt');
	});
});
