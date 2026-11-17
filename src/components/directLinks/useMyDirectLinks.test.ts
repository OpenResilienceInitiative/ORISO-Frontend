// @vitest-environment oriso-jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiGetOwnDirectLinks } from '../../api/apiDirectLinks';
import type { DirectLink } from '../conversationCreate/directLink/directLink';
import { useMyDirectLinks } from './useMyDirectLinks';

vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiGetOwnDirectLinks: vi.fn()
}));

afterEach(() => vi.clearAllMocks());

/* #2285: an expiry timer asks again until a read has been applied. */
describe('useMyDirectLinks reload', () => {
	it('does not count a read that a newer one replaced as done', async () => {
		const answers: ((links: DirectLink[]) => void)[] = [];
		vi.mocked(apiGetOwnDirectLinks).mockImplementation(
			() =>
				new Promise<DirectLink[]>((resolve) => {
					answers.push(resolve);
				})
		);
		const { result } = renderHook(() => useMyDirectLinks());
		let older: Promise<boolean> | undefined;
		act(() => {
			older = result.current.reload();
			void result.current.reload();
		});

		/* The first read (from mounting) and the older one answer late. */
		await act(async () => {
			answers.forEach((answer) => answer([]));
		});

		await expect(older).resolves.toBe(false);
	});
});
