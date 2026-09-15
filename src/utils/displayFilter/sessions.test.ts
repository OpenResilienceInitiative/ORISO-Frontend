/**
 * #1377 slice 4/5 — Gespräche/Anfragen classification and filters
 * (spec §5.2 order and asker rule, §5.3).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_DISPLAY_FILTER, DisplayFilter } from './model';
import {
	applyRequestsFilter,
	applySessionsFilter,
	classifyRequest,
	classifySession
} from './sessions';

const ME = 'consultant-me';
const OWNER = 'consultant-owner';

const session = (
	overrides: Record<string, unknown> = {},
	consultantId: string | null = OWNER
) => {
	const raw = {
		consultant: consultantId ? { id: consultantId } : undefined,
		user: { username: 'Ruhiges Yak' },
		session: {
			id: 1,
			matrixRoomId: '!room:hs',
			messagesRead: true,
			conversationType: 'AGENCY_COUNSELLING',
			...overrides
		}
	} as any;
	return { raw, extended: { isGroup: false, item: raw.session } as any };
};

const group = (conversationType: 'SELF_HELP' | 'INTERNAL_GROUP', id = 9) => {
	const raw = {
		consultant: { id: OWNER },
		chat: { id, matrixRoomId: `!g${id}:hs`, conversationType }
	} as any;
	return { raw, extended: { isGroup: true, item: raw.chat } as any };
};

const supervisedByMe = {
	supervision: {
		supervisedByMe: true,
		supervisorConsultantIds: [ME],
		supervisorDisplayNames: ['Me']
	}
};

const hide = (...kinds: string[]): DisplayFilter => ({
	kinds: Object.fromEntries(
		kinds.map((kind) => [kind, { show: false, pill: false }])
	),
	autoReadHidden: false
});

describe('classifySession (§5.2 order)', () => {
	it('marker-backed supervision wins for an eligible viewer', () => {
		const { raw, extended } = session(supervisedByMe);
		expect(classifySession(raw, extended, ME, true)).toBe('supervision');
	});

	it('an asker never gets "supervision": the same row is one-to-one', () => {
		const { raw, extended } = session(supervisedByMe);
		expect(classifySession(raw, extended, 'asker-1', false)).toBe(
			'oneToOne'
		);
		// … and the legacy fallback (no marker, owned by another consultant)
		// stays one-to-one for the asker too.
		const legacy = session({});
		expect(
			classifySession(legacy.raw, legacy.extended, 'asker-1', false)
		).toBe('oneToOne');
	});

	it('legacy fallback: no marker, owned by another consultant → supervision, only if eligible', () => {
		const { raw, extended } = session({});
		expect(classifySession(raw, extended, ME, true)).toBe('supervision');
		const mine = session({}, ME);
		expect(classifySession(mine.raw, mine.extended, ME, true)).toBe(
			'oneToOne'
		);
	});

	it('an empty marker on an ordinary row is not supervision', () => {
		const { raw, extended } = session({
			supervision: { supervisedByMe: false, supervisorConsultantIds: [] }
		});
		expect(classifySession(raw, extended, ME, true)).toBe('oneToOne');
	});

	it('structural group kinds come before the legacy fallback', () => {
		const circle = group('SELF_HELP');
		const internal = group('INTERNAL_GROUP');
		expect(classifySession(circle.raw, circle.extended, ME, true)).toBe(
			'circle'
		);
		expect(classifySession(internal.raw, internal.extended, ME, true)).toBe(
			'internalGroup'
		);
	});

	it('live chats are their own kind', () => {
		const { raw, extended } = session({ conversationType: 'LIVE_CHAT' });
		expect(classifySession(raw, extended, ME, true)).toBe('liveChat');
	});

	it('a row without session or chat lands in "other"', () => {
		expect(
			classifySession({} as any, { item: null } as any, ME, true)
		).toBe('other');
	});
});

describe('applySessionsFilter', () => {
	const rows = [
		session({ id: 1 }, ME),
		session({ id: 2, conversationType: 'LIVE_CHAT' }, ME),
		group('SELF_HELP', 3),
		group('INTERNAL_GROUP', 4),
		session({ id: 5, ...supervisedByMe })
	];
	const ids = (pairs: typeof rows) =>
		pairs.map((p) => p.raw.session?.id ?? p.raw.chat?.id);

	it('shows everything by default', () => {
		const result = applySessionsFilter(rows, DEFAULT_DISPLAY_FILTER, {
			currentUserId: ME,
			canSupervise: true
		});
		expect(ids(result.visible)).toEqual([1, 2, 3, 4, 5]);
		expect(result.hiddenActiveIds.size).toBe(0);
	});

	it('hides kinds, keeps the active row and reports it for dimming', () => {
		const result = applySessionsFilter(
			rows,
			hide('circle', 'supervision'),
			{
				currentUserId: ME,
				canSupervise: true,
				isActive: (extended) => extended.item?.id === 3
			}
		);
		expect(ids(result.visible)).toEqual([1, 2, 3, 4]);
		expect(Array.from(result.hiddenActiveIds)).toEqual(['3']);
	});

	it('hiding one-to-one chats leaves supervised cases visible', () => {
		const result = applySessionsFilter(rows, hide('oneToOne'), {
			currentUserId: ME,
			canSupervise: true
		});
		expect(ids(result.visible)).toEqual([2, 3, 4, 5]);
	});
});

describe('Anfragen (§5.3)', () => {
	it('classifies live chats vs nearby and filters accordingly', () => {
		const live = session({ id: 7, conversationType: 'LIVE_CHAT' }, null);
		const nearby = session({ id: 8 }, null);
		expect(classifyRequest(live.raw, live.extended)).toBe('liveChat');
		expect(classifyRequest(nearby.raw, nearby.extended)).toBe('nearby');
		const result = applyRequestsFilter([live, nearby], hide('liveChat'));
		expect(result.visible.map((p) => p.raw.session.id)).toEqual([8]);
	});
});
