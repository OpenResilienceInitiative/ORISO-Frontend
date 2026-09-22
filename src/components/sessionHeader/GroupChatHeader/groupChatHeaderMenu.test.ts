import { describe, expect, it } from 'vitest';
import {
	shouldShowGroupChatMenu,
	shouldShowWaitingRoomPhoneMenu
} from './groupChatHeaderMenu';

describe('shouldShowGroupChatMenu', () => {
	it('shows the role-independent menu in an active joined group chat', () => {
		expect(
			shouldShowGroupChatMenu({
				isActive: true,
				isJoinGroupChatView: false
			})
		).toBe(true);
	});

	it.each([
		{ isActive: false, isJoinGroupChatView: false },
		{ isActive: true, isJoinGroupChatView: true }
	])('hides the menu when the active joined view is unavailable', (state) => {
		expect(shouldShowGroupChatMenu(state)).toBe(false);
	});
});

describe('shouldShowWaitingRoomPhoneMenu', () => {
	const waitingRoom = {
		isActive: false,
		isJoinGroupChatView: true,
		isConsultant: true,
		isPhone: true
	};

	it('gives the counsellor the menu in the waiting room on a phone', () => {
		expect(shouldShowWaitingRoomPhoneMenu(waitingRoom)).toBe(true);
		// Joining a group that already runs is still the waiting-room header.
		expect(
			shouldShowWaitingRoomPhoneMenu({ ...waitingRoom, isActive: true })
		).toBe(true);
	});

	it('leaves desktop to the "Chat-Info" link', () => {
		expect(
			shouldShowWaitingRoomPhoneMenu({ ...waitingRoom, isPhone: false })
		).toBe(false);
	});

	it('stays hidden for advice seekers, who have no Chat-Info', () => {
		expect(
			shouldShowWaitingRoomPhoneMenu({
				...waitingRoom,
				isConsultant: false
			})
		).toBe(false);
	});

	it('is not needed once the counsellor is inside the running group', () => {
		expect(
			shouldShowWaitingRoomPhoneMenu({
				...waitingRoom,
				isActive: true,
				isJoinGroupChatView: false
			})
		).toBe(false);
	});
});
