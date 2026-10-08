import { describe, expect, it } from 'vitest';
import { isPracticeAreaEnabled } from './releaseFlag';

describe('practice area release flag (default off)', () => {
	it.each([
		['no settings', undefined],
		['null settings', null],
		['settings without toggles', {}],
		['toggles without the flag', { releaseToggles: {} }],
		[
			'the flag set to false',
			{ releaseToggles: { enablePracticeArea: false } }
		]
	])('is off for %s', (_label, settings) => {
		expect(isPracticeAreaEnabled(settings)).toBe(false);
	});

	it('is on only for the boolean true', () => {
		expect(
			isPracticeAreaEnabled({
				releaseToggles: { enablePracticeArea: true }
			})
		).toBe(true);
	});

	it.each(['true', 1, 'yes', {}])(
		'stays off for the truthy non-boolean %j (the server map is converted before it gets here)',
		(value) => {
			expect(
				isPracticeAreaEnabled({
					releaseToggles: { enablePracticeArea: value as never }
				})
			).toBe(false);
		}
	);

	it('is not switched on by the neighbouring release toggles', () => {
		expect(
			isPracticeAreaEnabled({
				releaseToggles: {
					enableNewNotifications: true,
					enableMagicLinksLogin: true
				}
			})
		).toBe(false);
	});
});
