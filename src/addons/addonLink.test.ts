import { describe, expect, it } from 'vitest';
import { addonLinkPath, localizedText } from './addonLink';

const tools = { addon: 'digisucht-tools', appId: 'goals' };

describe('add-on link targets', () => {
	it('opens navigation apps on their own page', () => {
		expect(addonLinkPath({ ...tools, slot: 'asker.navigation' })).toBe(
			'/addons/digisucht-tools/goals'
		);
		expect(
			addonLinkPath({
				...tools,
				slot: 'consultant.navigation',
				sessionId: 7
			})
		).toBe('/addons/digisucht-tools/goals');
	});

	it('opens a session app as the side panel of the case view', () => {
		expect(
			addonLinkPath(
				{ ...tools, slot: 'consultant.session', sessionId: 42 },
				'/sessions/consultant/sessionView'
			)
		).toBe(
			'/sessions/consultant/sessionView/session/42?addon=digisucht-tools%2Fgoals'
		);
	});

	it('opens the case view for an asker-profile app', () => {
		expect(
			addonLinkPath(
				{ ...tools, slot: 'consultant.asker-profile', sessionId: '42' },
				'/sessions/consultant/sessionView'
			)
		).toBe('/sessions/consultant/sessionView/session/42');
	});

	it('has no target without add-on, app, session or a known slot', () => {
		expect(
			addonLinkPath({ appId: 'goals', slot: 'asker.navigation' })
		).toBe(null);
		expect(addonLinkPath({ ...tools, slot: 'consultant.session' })).toBe(
			null
		);
		expect(
			addonLinkPath({ ...tools, slot: 'admin.page', sessionId: 1 })
		).toBe(null);
		expect(addonLinkPath({ ...tools })).toBe(null);
	});
});

describe('localizedText', () => {
	const texts = { de: 'Ziele', en: 'Goals' };

	it('picks the user language, then German, then any text', () => {
		expect(localizedText(texts, 'en')).toBe('Goals');
		expect(localizedText(texts, 'de@informal')).toBe('Ziele');
		expect(localizedText(texts, 'fr')).toBe('Ziele');
		expect(localizedText({ en: 'Goals' }, 'fr')).toBe('Goals');
		expect(localizedText(undefined, 'de')).toBeUndefined();
	});
});
