// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
	buildInitialAuthorContent,
	getGeneralRules,
	loadCircleDefaults,
	saveCircleDefaults
} from './circleDefaults';

describe('getGeneralRules', () => {
	it('provides two general rules per language', () => {
		['de', 'en', 'fr', 'tr'].forEach((language) => {
			expect(getGeneralRules(language)).toHaveLength(2);
		});
	});

	it('falls back to English for unknown languages', () => {
		expect(getGeneralRules('xx')).toEqual(getGeneralRules('en'));
	});

	it('returns a fresh copy each time', () => {
		const first = getGeneralRules('de');
		first[0] = 'mutated';
		expect(getGeneralRules('de')[0]).not.toBe('mutated');
	});
});

describe('buildInitialAuthorContent', () => {
	it('seeds every active language with the two general rules', () => {
		const draft = buildInitialAuthorContent(['de', 'en']);
		expect(draft.sourceLanguage).toBe('de');
		expect(draft.groupChatRulesTranslations.de).toHaveLength(2);
		expect(draft.groupChatRulesTranslations.en).toHaveLength(2);
		expect(draft.hintMessageTranslations).toEqual({ de: '', en: '' });
	});

	it('defaults to German when no languages are active', () => {
		expect(buildInitialAuthorContent([]).sourceLanguage).toBe('de');
	});
});

describe('circle defaults persistence', () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	const defaults = {
		series: {
			duration: 90,
			repeatCount: 12,
			interval: 'WEEKLY' as const,
			modality: 'VIDEO' as const
		},
		authorContent: buildInitialAuthorContent(['de'])
	};

	it('round-trips defaults per agency', () => {
		saveCircleDefaults(7, defaults);
		expect(loadCircleDefaults(7)).toEqual(defaults);
		expect(loadCircleDefaults(8)).toBeNull();
	});

	it('overwrites older entries with newer ones', () => {
		saveCircleDefaults(7, defaults);
		saveCircleDefaults(7, {
			...defaults,
			series: { ...defaults.series, duration: 30 }
		});
		expect(loadCircleDefaults(7)?.series.duration).toBe(30);
	});

	it('ignores missing agency and corrupt payloads', () => {
		expect(loadCircleDefaults(null)).toBeNull();
		window.localStorage.setItem('oriso.circleDefaults.v1.9', '{broken');
		expect(loadCircleDefaults(9)).toBeNull();
	});
});
