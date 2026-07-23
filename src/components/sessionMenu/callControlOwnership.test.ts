import { describe, expect, it } from 'vitest';
import { sessionMenuOwnsCallControls } from './callControlOwnership';

describe('sessionMenuOwnsCallControls', () => {
	it('leaves group-call controls exclusively to GroupChatHeader', () => {
		expect(sessionMenuOwnsCallControls(true)).toBe(false);
	});

	it('keeps call controls for non-group sessions', () => {
		expect(sessionMenuOwnsCallControls(false)).toBe(true);
	});
});
