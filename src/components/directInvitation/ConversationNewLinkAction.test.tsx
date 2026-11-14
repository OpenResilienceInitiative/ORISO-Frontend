// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import {
	apiGetOwnDirectLinks,
	apiRenewDirectInvitation,
	DIRECT_LINKS_CHANGED_EVENT
} from '../../api/apiDirectLinks';
import { createSnackbarStack } from '../m3Snackbar/snackbarStack';
import { ConversationNewLinkAction } from './ConversationNewLinkAction';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiGetOwnDirectLinks: vi.fn(),
	apiRenewDirectInvitation: vi.fn()
}));

const link = (id: string, sessionId: number, expired: boolean) => ({
	id,
	name: `Termin ${id}`,
	topic: 'Schulden',
	medium: 'VIDEO' as const,
	temporary: true,
	active: true,
	url: `https://app.example/invite/${id}`,
	sessionId,
	expired
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/* #2252, decision 7: the counsellor sends a new link from the chat on their own. */
describe('ConversationNewLinkAction', () => {
	it('offers "Neuen Link senden" only for an expired invitation of this conversation', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([
			link('1', 5, false),
			link('2', 7, true)
		]);
		const onChange = vi.fn();
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={onChange}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		expect(onChange).not.toHaveBeenLastCalledWith(expect.any(Function));
	});

	it('sends a new link and shows it to share', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([link('2', 5, true)]);
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue(
			link('2', 5, false)
		);
		let open: (() => void) | undefined;
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={(next) => {
					open = next;
				}}
				stack={createSnackbarStack()}
			/>
		);
		await vi.waitFor(() => expect(open).toBeInstanceOf(Function));
		await act(async () => open?.());

		expect(apiRenewDirectInvitation).toHaveBeenCalledWith('2');
		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
	});

	it('reads the links again when they change', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([]);
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled
				onChange={vi.fn()}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		await act(async () => {
			window.dispatchEvent(new Event(DIRECT_LINKS_CHANGED_EVENT));
		});
		expect(apiGetOwnDirectLinks).toHaveBeenCalledTimes(2);
	});

	it('reads nothing for somebody who may not send links', async () => {
		render(
			<ConversationNewLinkAction
				sessionId={5}
				enabled={false}
				onChange={vi.fn()}
				stack={createSnackbarStack()}
			/>
		);
		await act(async () => undefined);
		expect(apiGetOwnDirectLinks).not.toHaveBeenCalled();
	});
});
