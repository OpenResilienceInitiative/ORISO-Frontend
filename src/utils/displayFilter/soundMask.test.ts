import { beforeEach, describe, expect, it } from 'vitest';
import { isEventMutedByKind, soundOverrideForEvent } from './soundMask';
import { sessionKindRegistry } from './sessionKindRegistry';
import { DEFAULT_DISPLAY_FILTERS, withSectionOverride } from './model';

describe('isEventMutedByKind (Ton column, #1377)', () => {
	beforeEach(() => sessionKindRegistry.reset());

	it('mutes an event whose session kind is muted in the effective filter of its section', () => {
		sessionKindRegistry.publish('sessions', { '42': 'circle' });
		const filters = withSectionOverride(
			DEFAULT_DISPLAY_FILTERS,
			'sessions',
			{
				kinds: { circle: { show: true, pill: true, sound: 'none' } },
				autoReadHidden: false
			}
		);
		expect(isEventMutedByKind(filters, '42')).toBe(true);
		expect(isEventMutedByKind(filters, '43')).toBe(false);
		expect(isEventMutedByKind(DEFAULT_DISPLAY_FILTERS, '42')).toBe(false);
	});

	it('hands the chosen tone of the session kind to the player', () => {
		sessionKindRegistry.publish('requests', { '7': 'nearby' });
		const filters = withSectionOverride(
			DEFAULT_DISPLAY_FILTERS,
			'requests',
			{
				kinds: { nearby: { show: true, pill: true, sound: 'chime' } },
				autoReadHidden: false
			}
		);
		expect(soundOverrideForEvent(filters, '7')).toBe('chime');
		expect(soundOverrideForEvent(filters, '8')).toBeUndefined();
		expect(
			soundOverrideForEvent(DEFAULT_DISPLAY_FILTERS, '7')
		).toBeUndefined();
	});
});
