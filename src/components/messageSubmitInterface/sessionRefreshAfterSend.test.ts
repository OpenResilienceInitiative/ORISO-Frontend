import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
	reloadSessionAfterSendIfNeeded,
	shouldReloadSessionAfterSend
} from './sessionRefreshAfterSend';

describe('shouldReloadSessionAfterSend', () => {
	it('reloads a Matrix session whose room appeared after the page loaded', () => {
		expect(
			shouldReloadSessionAfterSend({
				isMatrixSession: true,
				clientRoomId: undefined
			})
		).toBe(true);
	});

	it.each([
		{ isMatrixSession: true, clientRoomId: '!room:matrix.example' },
		{ isMatrixSession: false, clientRoomId: undefined }
	])('does not reload an already-current or non-Matrix session', (input) => {
		expect(shouldReloadSessionAfterSend(input)).toBe(false);
	});
});

describe('reloadSessionAfterSendIfNeeded', () => {
	it('refreshes the active session after the first successful stale-room send', () => {
		const reload = vi.fn();

		reloadSessionAfterSendIfNeeded(
			{ isMatrixSession: true, clientRoomId: undefined },
			reload
		);

		expect(reload).toHaveBeenCalledOnce();
	});

	it.each([
		{ isMatrixSession: true, clientRoomId: '!room:matrix.example' },
		{ isMatrixSession: false, clientRoomId: undefined }
	])('does not reload when no refresh is needed', (input) => {
		const reload = vi.fn();

		reloadSessionAfterSendIfNeeded(input, reload);

		expect(reload).not.toHaveBeenCalled();
	});

	it('allows the optional reload callback to be omitted', () => {
		expect(() =>
			reloadSessionAfterSendIfNeeded({
				isMatrixSession: true,
				clientRoomId: undefined
			})
		).not.toThrow();
	});
});
