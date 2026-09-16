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

describe('live chat chip visibility', () => {
	it('shows while the consultant is available for new live chats', () => {
		expect(
			isLiveChatChipVisible({ available: true, hasLiveChatRow: false })
		).toBe(true);
	});

	it('keeps showing once availability is off but a live chat is open', () => {
		expect(
			isLiveChatChipVisible({ available: false, hasLiveChatRow: true })
		).toBe(true);
	});

	it('hides when neither availability nor a live chat exists', () => {
		expect(
			isLiveChatChipVisible({ available: false, hasLiveChatRow: false })
		).toBe(false);
	});
});
