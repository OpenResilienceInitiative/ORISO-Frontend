import { describe, expect, it } from 'vite-plus/test';
import deCommon from './de/common.json';
import deInformalCommon from './de@informal/common.json';
import enCommon from './en/common.json';
import frCommon from './fr/common.json';
import ruCommon from './ru/common.json';
import trCommon from './tr/common.json';

/**
 * Glossary (ORISO-Docs#262, ORISO-Frontend#2207): the team-only room of an open
 * enquiry is called "Team-Chat" / "Team chat". The old name "Team-Besprechung"
 * (and its translations) must not come back in any string a person reads.
 * Identifiers such as `teamDiscussion` stay unchanged.
 */
const retiredNames: Array<[string, unknown, RegExp]> = [
	['de', deCommon, /team-?besprechung/i],
	['de@informal', deInformalCommon, /team-?besprechung/i],
	['en', enCommon, /team discussion/i],
	['fr', frCommon, /(discussion|réunion) d[’']équipe/i],
	['ru', ruCommon, /обсуждени\S* (в )?команд|командное обсуждение/i],
	['tr', trCommon, /ekip görüşme/i]
];

const strings = (node: unknown, path = ''): Array<[string, string]> => {
	if (typeof node === 'string') return [[path, node]];
	if (node && typeof node === 'object') {
		return Object.entries(node).flatMap(([key, value]) =>
			strings(value, path ? `${path}.${key}` : key)
		);
	}
	return [];
};

const at = (bundle: unknown, path: string) =>
	path
		.split('.')
		.reduce<unknown>(
			(node, key) => (node as Record<string, unknown>)?.[key],
			bundle
		);

describe('team chat name (ORISO-Frontend#2207)', () => {
	it.each(retiredNames)(
		'never shows the retired name in %s',
		(_lang, bundle, retired) => {
			const leftovers = strings(bundle).filter(([, text]) =>
				retired.test(text)
			);
			expect(leftovers).toEqual([]);
		}
	);

	it('uses the glossary name in formal and informal German and English', () => {
		expect(at(deCommon, 'teamDiscussion.title')).toBe('Team-Chat');
		expect(at(deInformalCommon, 'teamDiscussion.title')).toBe('Team-Chat');
		expect(at(enCommon, 'teamDiscussion.title')).toBe('Team chat');
	});

	it('does not call the team chat "Teamberatung", the other team function', () => {
		expect(
			at(deCommon, 'notifications.center.preview.teamClosed')
		).not.toMatch(/teamberatung/i);
	});

	it('quotes the real button label in the practice tour', () => {
		const button = at(deCommon, 'enquiry.teamDiscussion.open') as string;
		expect(
			at(deCommon, 'tour.practiceAccept.step.openTeam.intro')
		).toContain(`„${button}“`);
		expect(
			at(deInformalCommon, 'tour.practiceAccept.step.openTeam.intro')
		).toContain(`„${button}“`);
	});
});
