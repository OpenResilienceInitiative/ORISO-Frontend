import { describe, expect, it } from 'vitest';
import {
	consultantGroupChatPath,
	isGroupChatId
} from './consultantGroupChatPath';

// The id comes from the address bar and ends up in a route (#1499).
describe('isGroupChatId', () => {
	it.each(['1', '42', 42, String(Number.MAX_SAFE_INTEGER)])(
		'accepts the positive safe integer %s',
		(value) => {
			expect(isGroupChatId(value)).toBe(true);
		}
	);

	it.each([
		'0',
		'-1',
		'01',
		'1.5',
		'1e3',
		' 42',
		'',
		null,
		undefined,
		// Would round (9007199254740993 → …992) or become Infinity in Number().
		'9007199254740993',
		'9'.repeat(400)
	])('rejects %s', (value) => {
		expect(isGroupChatId(value)).toBe(false);
	});
});

describe('consultantGroupChatPath', () => {
	it('keeps the exact id in the counsellor route', () => {
		expect(consultantGroupChatPath('42')).toContain('/42');
	});
});
