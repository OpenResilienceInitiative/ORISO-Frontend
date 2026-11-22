// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import {
	notifySessionSupervisorsChanged,
	useSessionSupervisorsRevision
} from './sessionSupervisorsRefresh';

/**
 * FE#2386: accepting an enquiry attaches the counsellor's standing supervisor
 * on the server. The open conversation resolved the supervision side room
 * before that, so it must be told to look again.
 */
describe('session supervisors refresh signal', () => {
	afterEach(cleanup);

	it('changes for the announced session', () => {
		const { result } = renderHook(() => useSessionSupervisorsRevision(76));
		const before = result.current;

		act(() => notifySessionSupervisorsChanged(76));

		expect(result.current).not.toBe(before);
	});

	it('leaves other sessions alone, so their side rooms are not re-read', () => {
		const { result } = renderHook(() => useSessionSupervisorsRevision(77));
		const before = result.current;

		act(() => notifySessionSupervisorsChanged(76));

		expect(result.current).toBe(before);
	});

	it('stays stable without a session', () => {
		const { result } = renderHook(() =>
			useSessionSupervisorsRevision(undefined)
		);

		act(() => notifySessionSupervisorsChanged(76));

		expect(result.current).toBe(0);
	});
});
