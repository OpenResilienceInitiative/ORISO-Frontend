// @vitest-environment oriso-jsdom
import { describe, expect, it, vi } from 'vite-plus/test';
import {
	announceDeletedAskerArchived,
	DELETED_ASKER_ARCHIVED_EVENT,
	deletedAskerPath,
	parseFormerSessionId
} from './deletedAskerPath';
import { isRestorableSessionPath } from '../../utils/lastOpenSession';

describe('deletedAskerPath', () => {
	it('builds the notice route of a former session', () => {
		expect(deletedAskerPath(77)).toBe(
			'/sessions/consultant/sessionView/deleted/77'
		);
	});

	it('accepts only a positive safe integer from the address bar', () => {
		expect(parseFormerSessionId('77')).toBe(77);
		expect(parseFormerSessionId('0')).toBeNull();
		expect(parseFormerSessionId('-1')).toBeNull();
		expect(parseFormerSessionId('7a')).toBeNull();
		expect(parseFormerSessionId('99999999999999999999')).toBeNull();
		expect(parseFormerSessionId(undefined)).toBeNull();
	});

	it('is never resumed as the last open conversation', () => {
		expect(isRestorableSessionPath(deletedAskerPath(77))).toBe(false);
		expect(
			isRestorableSessionPath(
				'/sessions/consultant/sessionView/session/77'
			)
		).toBe(true);
	});

	it('tells the list when a placeholder moved into the archive', () => {
		const listener = vi.fn();
		window.addEventListener(DELETED_ASKER_ARCHIVED_EVENT, listener);
		announceDeletedAskerArchived(77);
		window.removeEventListener(DELETED_ASKER_ARCHIVED_EVENT, listener);

		expect(listener).toHaveBeenCalledTimes(1);
		expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
			formerSessionId: 77
		});
	});
});
