import { describe, expect, it } from 'vitest';
import { sessionMatchesToolbar } from './sessionToolbarFilters';
import { isLiveChatChipVisible } from './liveChatChipVisibility';
import type { ListItemInterface } from '../../globalState/interfaces/SessionsDataInterface';
import type { ExtendedSessionInterface } from '../../globalState/helpers/stateHelpers';

const liveChatRow = () => {
	const raw = {
		session: {
			id: 4711,
			registrationType: 'ANONYMOUS',
			matrixRoomId: '!live:oriso'
		},
		consultant: { id: 'consultant-1' },
		user: { username: 'Anonymous-1700000000' }
	} as unknown as ListItemInterface;
	const extended = {
		item: raw.session,
		isSession: true,
		isGroup: false,
		rid: '!live:oriso'
	} as unknown as ExtendedSessionInterface;
	return { raw, extended };
};

const registeredRow = () => {
	const raw = {
		session: { id: 99, registrationType: 'REGISTERED', postcode: '50667' },
		user: { username: 'lisa' }
	} as unknown as ListItemInterface;
	const extended = {
		item: raw.session,
		isSession: true,
		isGroup: false,
		rid: '!reg:oriso'
	} as unknown as ExtendedSessionInterface;
	return { raw, extended };
};

describe('an accepted live chat the consultant is currently in', () => {
	it('survives a chip that does not match it (route-active row, #1404)', () => {
		const { raw, extended } = liveChatRow();

		// Not the open row: the Chats chip legitimately hides live chats.
		expect(
			sessionMatchesToolbar(raw, extended, '', 'nearby', [], [], 'c1')
		).toBe(false);

		// The open row must stay in the list, otherwise the consultant loses
		// the conversation they are in as soon as the chip flips.
		expect(
			sessionMatchesToolbar(
				raw,
				extended,
				'',
				'nearby',
				[],
				[],
				'c1',
				true
			)
		).toBe(true);
	});

	it('still applies the search axis to the route-active row', () => {
		const { raw, extended } = liveChatRow();
		expect(
			sessionMatchesToolbar(
				raw,
				extended,
				'zzz-no-match',
				'nearby',
				[],
				[],
				'c1',
				true
			)
		).toBe(false);
	});

	it('does not smuggle other rows past the chip', () => {
		const { raw, extended } = registeredRow();
		expect(
			sessionMatchesToolbar(
				raw,
				extended,
				'',
				'liveChat',
				[],
				[],
				'c1',
				false
			)
		).toBe(false);
	});
});

describe('live chat chip visibility per pill mode (Frank 2026-09-16)', () => {
	const base = {
		available: false,
		hasLiveChatRow: false,
		unreadCount: 0,
		activeIsLiveChat: false
	};

	it('dynamic: shows while the consultant is available for new live chats', () => {
		expect(
			isLiveChatChipVisible({ ...base, mode: 'dynamic', available: true })
		).toBe(true);
	});

	it('dynamic: shows when an asker wrote something new, even with availability off', () => {
		expect(
			isLiveChatChipVisible({
				...base,
				mode: 'dynamic',
				hasLiveChatRow: true,
				unreadCount: 1
			})
		).toBe(true);
	});

	it('dynamic: hides an open live chat nobody wrote in once availability is off', () => {
		expect(
			isLiveChatChipVisible({
				...base,
				mode: 'dynamic',
				hasLiveChatRow: true
			})
		).toBe(false);
	});

	it('dynamic: never hides the chip of the live chat the consultant is in right now', () => {
		expect(
			isLiveChatChipVisible({
				...base,
				mode: 'dynamic',
				hasLiveChatRow: true,
				activeIsLiveChat: true
			})
		).toBe(true);
	});

	it('session: keeps the chip while any live chat is in the list, new messages or not', () => {
		expect(
			isLiveChatChipVisible({
				...base,
				mode: 'session',
				hasLiveChatRow: true
			})
		).toBe(true);
		expect(
			isLiveChatChipVisible({ ...base, mode: 'session', available: true })
		).toBe(true);
		expect(isLiveChatChipVisible({ ...base, mode: 'session' })).toBe(false);
	});

	it('fixed: always', () => {
		expect(isLiveChatChipVisible({ ...base, mode: 'fixed' })).toBe(true);
	});
});
