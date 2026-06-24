/**
 * WP-06 Activity Timeline — unit coverage for the route-derived list-item
 * selection (Slice 0b). Pure-logic spec: imports the selection utility directly
 * and asserts with chai's `expect`. No app visit / backend required.
 */

import {
	deriveActiveSelection,
	isListItemActive,
	ListItemIdentity
} from '../../src/utils/listItemSelection';

describe('WP-06 list-item selection controller', () => {
	describe('deriveActiveSelection', () => {
		it('has no active item on bare list views or the timeline', () => {
			['/sessions/consultant/sessionView', '/sessions/user/view', '/notifications', '/', ''].forEach(
				(p) => {
					expect(deriveActiveSelection(p), p).to.deep.equal({
						groupId: null,
						sessionId: null
					});
				}
			);
		});

		it('derives the sessionId from a Matrix session route (groupId null)', () => {
			expect(
				deriveActiveSelection('/sessions/consultant/sessionView/session/123')
			).to.deep.equal({ groupId: null, sessionId: '123' });
			expect(
				deriveActiveSelection('/sessions/user/view/session/55')
			).to.deep.equal({ groupId: null, sessionId: '55' });
		});

		it('derives groupId + sessionId from a RocketChat route', () => {
			expect(
				deriveActiveSelection('/sessions/consultant/sessionView/AbCdGroup/123')
			).to.deep.equal({ groupId: 'AbCdGroup', sessionId: '123' });
		});

		it('derives the sessionId from the enquiry write route', () => {
			expect(
				deriveActiveSelection('/sessions/user/view/write/77')
			).to.deep.equal({ groupId: null, sessionId: '77' });
		});

		it('does not mistake the "session"/"write" literal for a group id', () => {
			expect(
				deriveActiveSelection('/sessions/consultant/sessionPreview/session/9').groupId
			).to.equal(null);
		});

		it('tolerates a trailing slash', () => {
			expect(
				deriveActiveSelection('/sessions/consultant/sessionView/session/123/')
			).to.deep.equal({ groupId: null, sessionId: '123' });
		});
	});

	describe('isListItemActive', () => {
		it('matches by sessionId, normalising number vs string', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/session/123'
			);
			expect(isListItemActive(selection, { sessionId: 123 })).to.equal(true);
			expect(isListItemActive(selection, { sessionId: '123' })).to.equal(true);
			expect(isListItemActive(selection, { sessionId: 456 })).to.equal(false);
		});

		it('matches by groupId or rid', () => {
			const selection = deriveActiveSelection(
				'/sessions/consultant/sessionView/AbCdGroup/123'
			);
			expect(isListItemActive(selection, { groupId: 'AbCdGroup' })).to.equal(true);
			expect(isListItemActive(selection, { rid: 'AbCdGroup' })).to.equal(true);
			expect(isListItemActive(selection, { groupId: 'OtherGroup' })).to.equal(false);
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
			expect(isListItemActive(selection, matrixRoomItem)).to.equal(true);
		});

		it('nothing is active when no conversation is open', () => {
			const selection = deriveActiveSelection('/sessions/consultant/sessionView');
			expect(isListItemActive(selection, { sessionId: 1, groupId: 'g' })).to.equal(
				false
			);
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
			expect(activeCount('/sessions/consultant/sessionView/session/2')).to.equal(1);
			expect(activeCount('/sessions/consultant/sessionView/g3/3')).to.equal(1);
		});

		it('marks zero items active on the bare list', () => {
			expect(activeCount('/sessions/consultant/sessionView')).to.equal(0);
		});
	});
});
