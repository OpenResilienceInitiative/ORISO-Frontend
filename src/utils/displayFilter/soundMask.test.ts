import { beforeEach, describe, expect, it } from 'vitest';
import { isEventMutedByKind } from './soundMask';
import { sessionKindRegistry } from './sessionKindRegistry';
import { DEFAULT_DISPLAY_FILTERS, withSectionOverride } from './model';

describe('isEventMutedByKind (Ton column, #1377)', () => {
	beforeEach(() => sessionKindRegistry.reset());

	it('mutes an event whose session kind is muted in the effective filter of its section', () => {
		sessionKindRegistry.publish('sessions', { '42': 'circle' });
		const filters = withSectionOverride(DEFAULT_DISPLAY_FILTERS, 'sessions', {
			kinds: { circle: { show: true, pill: true, sound: false } },
			autoReadHidden: false
		});
		expect(isEventMutedByKind(filters, '42')).toBe(true);
		expect(isEventMutedByKind(filters, '43')).toBe(false);
		expect(isEventMutedByKind(DEFAULT_DISPLAY_FILTERS, '42')).toBe(false);
	});
});
