// @vitest-environment oriso-jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { apiRenewDirectInvitation } from '../../api/apiDirectLinks';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import { useSendNewLink } from './useSendNewLink';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiRenewDirectInvitation: vi.fn()
}));

const renewed = {
	id: '9',
	name: 'Termin',
	topic: 'Schulden',
	medium: 'VIDEO' as const,
	temporary: true,
	active: true,
	url: 'https://app.example/invite/new'
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* #2252: every renewal issues a new token and expires the one before. */
describe('useSendNewLink', () => {
	it('makes one new link while a renewal of the same invitation is running', async () => {
		let resolve: (link: typeof renewed) => void = () => undefined;
		vi.mocked(apiRenewDirectInvitation).mockReturnValue(
			new Promise((done) => {
				resolve = done;
			})
		);
		const header = renderHook(() => useSendNewLink(createSnackbarStack()));
		const notice = renderHook(() => useSendNewLink(createSnackbarStack()));

		let results: boolean[] = [];
		await act(async () => {
			const all = Promise.all([
				header.result.current.send('9'),
				header.result.current.send('9'),
				notice.result.current.send('9')
			]);
			resolve(renewed);
			results = await all;
		});

		expect(apiRenewDirectInvitation).toHaveBeenCalledTimes(1);
		expect(results).toEqual([true, true, true]);
	});

	it('renews again once the earlier renewal has finished', async () => {
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue(renewed);
		const { result } = renderHook(() =>
			useSendNewLink(createSnackbarStack())
		);
		await act(async () => {
			await result.current.send('9');
		});
		await act(async () => {
			await result.current.send('9');
		});
		expect(apiRenewDirectInvitation).toHaveBeenCalledTimes(2);
	});
});
