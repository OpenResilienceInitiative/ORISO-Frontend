// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDeletedMatrixAccountStorage } from './matrixAccountStorage';

describe('clearDeletedMatrixAccountStorage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('removes the deleted identity device state and crypto database', async () => {
		const userId = '@deleted:matrix.localhost';
		const deviceId = 'ORISO_WEB_DELETED';
		localStorage.setItem('matrix_user_id', userId);
		localStorage.setItem('matrix_access_token', 'expired-token');
		localStorage.setItem('matrix_device_id', deviceId);
		localStorage.setItem(`matrix_device_id:${userId}`, deviceId);
		// Retired Element Call SPA fallback key: may still linger in browsers
		// from before the widget-only refactor and must be swept as well.
		localStorage.setItem('matrix_call_device_id', 'ORISO_CALL_LEGACY');
		localStorage.setItem(
			`mxjssdk_memory_filter_FILTER_SYNC_${userId}`,
			'filter'
		);
		localStorage.setItem('unrelated_key', 'keep-me');
		const request = {} as IDBOpenDBRequest;
		Object.defineProperty(request, 'onsuccess', {
			set: (handler: () => void) => queueMicrotask(handler)
		});
		const deleteDatabase = vi.fn(() => request);
		vi.stubGlobal('indexedDB', { deleteDatabase });

		await clearDeletedMatrixAccountStorage();

		expect(localStorage.getItem('matrix_user_id')).toBeNull();
		expect(localStorage.getItem('matrix_access_token')).toBeNull();
		expect(localStorage.getItem('matrix_device_id')).toBeNull();
		expect(localStorage.getItem(`matrix_device_id:${userId}`)).toBeNull();
		expect(localStorage.getItem('matrix_call_device_id')).toBeNull();
		expect(localStorage.getItem('unrelated_key')).toBe('keep-me');
		expect(
			localStorage.getItem(`mxjssdk_memory_filter_FILTER_SYNC_${userId}`)
		).toBeNull();
		expect(deleteDatabase).toHaveBeenCalledWith(
			expect.stringContaining('::matrix-sdk-crypto')
		);
	});
});
