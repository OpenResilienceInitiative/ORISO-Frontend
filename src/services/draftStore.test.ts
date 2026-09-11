// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import * as draftStore from './draftStore';
import { hasDraftContent } from './draftStore';

describe('draftStore', () => {
	// #1071: drafts are server-side and room-key encrypted. The local plaintext
	// store is gone, and this guard keeps it from creeping back in — on the
	// shared PCs counselling agencies use, a re-introduced writer would leave
	// counselling text readable for the next person at the machine.
	it('exposes no Web Storage draft API any more', () => {
		expect(Object.keys(draftStore).sort()).toEqual([
			'DRAFTS_UPDATED_EVENT',
			'REMOTE_DRAFT_INDEX_SCOPE',
			'hasDraftContent'
		]);
	});

	describe('hasDraftContent (#976)', () => {
		it.each([
			['', false],
			['   ', false],
			[null, false],
			[undefined, false],
			['<p></p>', false],
			['<p><br></p>', false],
			['<p>&nbsp;</p>', false],
			['<p>​</p>', false],
			['<p>Hallo</p>', true],
			['Hallo', true],
			// E2EE drafts are opaque ciphertext and always count as content.
			['enc.AbCdEf123', true]
		])('treats %j as content=%s', (text, expected) => {
			expect(hasDraftContent(text as string | null | undefined)).toBe(
				expected
			);
		});
	});
});
