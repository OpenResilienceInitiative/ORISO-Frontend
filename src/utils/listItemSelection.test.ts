/**
 * WP-06 Activity Timeline — unit coverage for the route-derived list-item
 * selection (Slice 0b). Pure-logic vitest spec: imports the selection utility
 * directly and asserts. No app visit / backend / DOM required.
 *
 * Runs in CI via `npm run test:unit` (vitest, `src/**\/*.test.{ts,tsx}`).
 * Supersedes the non-CI `cypress/e2e/listItemSelection.cy.ts` logic spec.
 */

import { describe, it, expect } from 'vitest';
import {
	deriveActiveSelection,
	isListItemActive,
	pickActiveItemKey,
	ListItemIdentity
} from './listItemSelection';

describe('WP-06 list-item selection controller', () => {
	describe('deriveActiveSelection', () => {
		it('has no active item on bare list views or the timeline', () => {
			[
				'/sessions/consultant/sessionView',
				'/sessions/user/view',
				'/notifications',
				'/',
				''
			].forEach((p) => {
				expect(deriveActiveSelection(p)).toEqual({
					groupId: null,
					sessionId: null
				});
			});
		});

		it('derives the sessionId from a Matrix session route (groupId null)', () => {
			expect(
				deriveActiveSelection(
					'/sessions/consultant/sessionView/session/123'
				)
			).toEqual({ groupId: null, sessionId: '123' });
			expect(
				deriveActiveSelection('/sessions/user/view/session/55')
			).toEqual({ groupId: null, sessionId: '55' });
		});

		it('derives groupId + sessionId from a RocketChat route', () => {
			expect(
				deriveActiveSelection(
					'/sessions/consultant/sessionView/AbCdGroup/123'
				)
			).toEqual({ groupId: 'AbCdGroup', sessionId: '123' });
		});

		it('derives the sessionId from the enquiry write route', () => {
			expect(
				deriveActiveSelection('/sessions/user/view/write/77')
			).toEqual({ groupId: null, sessionId: '77' });
		});

		it('does not mistake the "session"/"write" literal for a group id', () => {
			expect(
				deriveActiveSelection(
					'/sessions/consultant/sessionPreview/session/9'
				).groupId
			).toBe(null);
		});

		it('tolerates a trailing slash', () => {
			expect(
				deriveActiveSelection(
					'/sessions/consultant/sessionView/session/123/'
				)
			).toEqual({ groupId: null, sessionId: '123' });
		});
	});

	describe('isListItemActive', () => {
		it('matches by sessionId, normalising number vs string', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/123'
			);
			expect(isListItemActive(selection, { sessionId: 123 })).toBe(true);
			expect(isListItemActive(selection, { sessionId: '123' })).toBe(
				true
			);
			expect(isListItemActive(selection, { sessionId: 456 })).toBe(false);
		});

		it('matches by groupId or rid', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/AbCdGroup/123'
			);
			expect(isListItemActive(selection, { groupId: 'AbCdGroup' })).toBe(
				true
			);
			expect(isListItemActive(selection, { rid: 'AbCdGroup' })).toBe(
				true
			);
			expect(isListItemActive(selection, { groupId: 'OtherGroup' })).toBe(
				false
			);
		});

		it('NEW: entering a Matrix chat room activates that conversation', () => {
			// Previously `activeSession.rid === groupIdFromParam` compared against
			// the literal "session" segment and never matched — so the room did
			// not light up. The route-derived sessionId now matches the item.
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/55'
			);
			const matrixRoomItem: ListItemIdentity = {
				groupId: null,
				rid: '!abc:matrix.example',
				sessionId: 55
			};
			expect(isListItemActive(selection, matrixRoomItem)).toBe(true);
		});

		it('nothing is active when no conversation is open', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView'
			);
			expect(
				isListItemActive(selection, { sessionId: 1, groupId: 'g' })
			).toBe(false);
		});

		it('returns false for a null/undefined selection', () => {
			expect(isListItemActive(null, { sessionId: 1 })).toBe(false);
			expect(isListItemActive(undefined, { sessionId: 1 })).toBe(false);
		});
	});

	describe('exactly-one-active invariant', () => {
		const items: ListItemIdentity[] = [
			{ sessionId: 1, groupId: 'g1', rid: 'g1' },
			{ sessionId: 2, groupId: 'g2', rid: 'g2' },
			{ sessionId: 3, groupId: 'g3', rid: 'g3' }
		];

		const activeCount = (pathname: string) => {
			const selection = deriveActiveSelection(pathname);
			return items.filter((it) => isListItemActive(selection, it)).length;
		};

		it('marks exactly one item active inside a conversation', () => {
			expect(
				activeCount('/sessions/consultant/sessionView/session/2')
			).toBe(1);
			expect(activeCount('/sessions/consultant/sessionView/g3/3')).toBe(
				1
			);
		});

		it('marks zero items active on the bare list', () => {
			expect(activeCount('/sessions/consultant/sessionView')).toBe(0);
		});
	});

	describe('pickActiveItemKey (timeline ↔ global selection bridge)', () => {
		// Timeline-shaped items: their own id (key space) plus an origin
		// conversation the route can match against.
		type Card = { id: string; sessionId?: number | null };
		const cards: Card[] = [
			{ id: 'n1', sessionId: 10 },
			{ id: 'n2', sessionId: 20 },
			{ id: 'n3', sessionId: 30 }
		];
		const identity = (c: Card): ListItemIdentity => ({
			sessionId: c.sessionId
		});
		const key = (c: Card) => c.id;

		it('uses the in-page fallback when no conversation is route-active', () => {
			const selection = deriveActiveSelection('/notifications');
			expect(
				pickActiveItemKey(cards, selection, identity, key, 'n2')
			).toBe('n2');
		});

		it('the route-active conversation card wins over the fallback', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/30'
			);
			// fallback points at n1, but the route is in session 30 → n3 wins.
			expect(
				pickActiveItemKey(cards, selection, identity, key, 'n1')
			).toBe('n3');
		});

		it('returns exactly one key even when several cards share the conversation', () => {
			const dupes: Card[] = [
				{ id: 'a', sessionId: 30 },
				{ id: 'b', sessionId: 30 },
				{ id: 'c', sessionId: 99 }
			];
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/30'
			);
			// First match wins — never two active at once.
			expect(
				pickActiveItemKey(dupes, selection, identity, key, 'c')
			).toBe('a');
		});

		it('falls back when the route-active conversation matches no card', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/999'
			);
			expect(
				pickActiveItemKey(cards, selection, identity, key, 'n2')
			).toBe('n2');
		});

		it('returns null when there is no match and no fallback', () => {
			const selection = deriveActiveSelection('/notifications');
			expect(
				pickActiveItemKey(cards, selection, identity, key, null)
			).toBe(null);
			expect(
				pickActiveItemKey([], selection, identity, key, undefined)
			).toBe(null);
		});
	});
});
