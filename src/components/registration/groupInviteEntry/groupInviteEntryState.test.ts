import { describe, expect, it } from 'vitest';
import {
	buildGroupInviteEntryPath,
	getGroupInviteTopicId,
	INVITE_LOGIN_STATE,
	isInviteLoginState,
	resolveGroupInviteEntry,
	shouldOpenGroupInviteEntry
} from './groupInviteEntryState';

/*
 * A self-help group invite (`/login?gcid=<id>&aid=<agency>`, #1499) opens the
 * designed entry screen (Storybook "0a — Eintritt: ohne Konto") for a newcomer
 * instead of the four-step counselling registration (FE#1289).
 */

const STEPS = [
	'topic-selection',
	'zipcode',
	'agency-selection',
	'account-data'
];
const agency = { id: 19, topicIds: [17] };
const grief = { id: 17 };

describe('shouldOpenGroupInviteEntry — who the login page hands over', () => {
	it('a newcomer with a group link and its agency goes to the entry', () => {
		expect(
			shouldOpenGroupInviteEntry({
				gcid: '19',
				aid: '19',
				hasSession: false,
				loginChosen: false
			})
		).toBe(true);
	});

	it('someone who is logged in keeps the existing join (no entry)', () => {
		expect(
			shouldOpenGroupInviteEntry({
				gcid: '19',
				aid: '19',
				hasSession: true,
				loginChosen: false
			})
		).toBe(false);
	});

	it('"Einloggen" on the entry leads to the login form, not back to the entry', () => {
		expect(
			shouldOpenGroupInviteEntry({
				gcid: '19',
				aid: '19',
				hasSession: false,
				loginChosen: true
			})
		).toBe(false);
	});

	it.each([
		[null, '19'],
		['19', null],
		['  ', '19']
	])(
		'without both ids there is nothing to enter (gcid=%s, aid=%s)',
		(gcid, aid) => {
			expect(
				shouldOpenGroupInviteEntry({
					gcid,
					aid,
					hasSession: false,
					loginChosen: false
				})
			).toBe(false);
		}
	);
});

describe('buildGroupInviteEntryPath', () => {
	it('keeps the link on the way into registration', () => {
		expect(buildGroupInviteEntryPath('19', '19')).toBe(
			'/registration/account-data?gcid=19&aid=19'
		);
	});
});

describe('the login choice travels as router state', () => {
	it('is recognised, and nothing else is', () => {
		expect(isInviteLoginState(INVITE_LOGIN_STATE)).toBe(true);
		expect(isInviteLoginState(null)).toBe(false);
		expect(isInviteLoginState({ other: true })).toBe(false);
	});
});

describe('getGroupInviteTopicId — the group has one topic', () => {
	it('an agency with exactly one topic names it', () => {
		expect(getGroupInviteTopicId(agency)).toBe(17);
		expect(getGroupInviteTopicId({ topicIds: [17, 17] })).toBe(17);
	});

	it.each([[{ topicIds: [17, 18] }], [{ topicIds: [] }], [{}], [null]])(
		'cannot be told otherwise (%j)',
		(value) => {
			expect(getGroupInviteTopicId(value)).toBeNull();
		}
	);
});

describe('resolveGroupInviteEntry — what the registration route shows', () => {
	const base = {
		gcid: '19',
		aid: '19',
		agency,
		mainTopic: grief,
		stepNames: STEPS,
		consultingTypeReady: true
	};

	it('shows the entry once agency and topic are known', () => {
		expect(resolveGroupInviteEntry(base)).toBe('entry');
	});

	it('waits while the single topic is still being loaded', () => {
		expect(resolveGroupInviteEntry({ ...base, mainTopic: undefined })).toBe(
			'pending'
		);
	});

	it('waits while the consulting type (extra steps) is unknown', () => {
		expect(
			resolveGroupInviteEntry({ ...base, consultingTypeReady: false })
		).toBe('pending');
	});

	it('does not trust a topic left over from an earlier registration', () => {
		expect(
			resolveGroupInviteEntry({ ...base, mainTopic: { id: 14 } })
		).toBe('pending');
	});

	it('falls back to the steps when the agency has several topics', () => {
		expect(
			resolveGroupInviteEntry({
				...base,
				agency: { id: 19, topicIds: [17, 18] },
				mainTopic: undefined
			})
		).toBe('steps');
	});

	it('falls back to the steps when the consulting type asks for more (age, state)', () => {
		expect(
			resolveGroupInviteEntry({ ...base, stepNames: [...STEPS, 'age'] })
		).toBe('steps');
	});

	it('falls back to the steps when the agency could not be loaded', () => {
		expect(resolveGroupInviteEntry({ ...base, agency: null })).toBe(
			'steps'
		);
	});

	it('is not an invite without gcid and aid', () => {
		expect(resolveGroupInviteEntry({ ...base, gcid: null })).toBe('none');
		expect(resolveGroupInviteEntry({ ...base, aid: null })).toBe('none');
	});
});
