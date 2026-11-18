// @vitest-environment oriso-jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { useGroupInviteGuestAccountMode } from './useGroupInviteGuestAccountMode';

/* A plain function, not a spy: a spy keeps a rejected answer it recorded
   unhandled, which fails the test although the hook catches it. */
let answer: () => Promise<unknown> = () => Promise.resolve({});
const calls: unknown[][] = [];
vi.mock('../../../api/apiGetGroupInviteContext', () => ({
	apiGetGroupInviteContext: (...args: unknown[]) => {
		calls.push(args);
		return answer();
	}
}));

beforeEach(() => {
	calls.length = 0;
	answer = () => Promise.resolve({});
});
afterEach(cleanup);

describe('UserService#1662: the Gesprächskreis entry reads the circle’s mode', () => {
	it.each(['TEMPORARY', 'GUEST_CHOOSES', 'PERMANENT'])(
		'is unknown while it loads, then %s',
		async (mode) => {
			answer = () => Promise.resolve({ guestAccountMode: mode });
			const { result } = renderHook(() =>
				useGroupInviteGuestAccountMode('19.q2Vx8mK4TzJ1bR7n', '7')
			);
			expect(result.current).toBeUndefined();
			await waitFor(() => expect(result.current).toBe(mode));
			expect(calls).toEqual([[19, '7', 'q2Vx8mK4TzJ1bR7n']]);
		}
	);

	it('keeps the old entry (guest chooses) when the server cannot tell', async () => {
		answer = () => Promise.reject(new Error('404'));
		const { result } = renderHook(() =>
			useGroupInviteGuestAccountMode('19.q2Vx8mK4TzJ1bR7n', '7')
		);
		await waitFor(() => expect(result.current).toBe('GUEST_CHOOSES'));
	});

	it('keeps the old entry for an answer without a mode', async () => {
		const { result } = renderHook(() =>
			useGroupInviteGuestAccountMode('19.q2Vx8mK4TzJ1bR7n', '7')
		);
		await waitFor(() => expect(result.current).toBe('GUEST_CHOOSES'));
	});

	it.each([
		['no invite token', '19', '7'],
		['no agency', '19.q2Vx8mK4TzJ1bR7n', null],
		['no group link', null, '7']
	])('asks nothing for a link with %s', (_, gcid, aid) => {
		const { result } = renderHook(() =>
			useGroupInviteGuestAccountMode(gcid, aid)
		);
		expect(result.current).toBe('GUEST_CHOOSES');
		expect(calls).toEqual([]);
	});
});
