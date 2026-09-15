// @vitest-environment jsdom
import React, { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ActiveSessionContext, E2EEContext } from '../../globalState';
import { useDraftMessage } from './useDraftMessage';

type DraftPayload = {
	text?: string;
	[key: string]: unknown;
};

type DeleteDraftMock = (scopeKey: string) => Promise<void>;
type GetDraftMock = (
	scopeKey: string,
	signal?: AbortSignal
) => Promise<DraftPayload>;
type UpsertDraftMock = (
	scopeKey: string,
	payload: DraftPayload
) => Promise<void>;

const mocks = vi.hoisted(() => {
	const env = process.env as Record<string, string>;
	env.REACT_APP_API_URL = 'http://localhost:9001';
	env.REACT_APP_KEYCLOAK_REALM = 'oriso';

	return {
		apiDeleteUserDraft: vi.fn<DeleteDraftMock>(() => Promise.resolve()),
		apiGetUserDraft: vi.fn<GetDraftMock>(() =>
			Promise.reject({ message: 'EMPTY' })
		),
		apiUpsertUserDraft: vi.fn<UpsertDraftMock>(() => Promise.resolve()),
		encryptText: vi.fn((text: string) => Promise.resolve(text)),
		e2ee: {
			encrypted: false,
			key: 'test-key',
			keyID: 'test-key-id',
			ready: true
		}
	};
});

vi.mock('../../api', () => ({
	apiDeleteUserDraft: (scopeKey: string) =>
		mocks.apiDeleteUserDraft(scopeKey),
	apiGetUserDraft: (scopeKey: string, signal?: AbortSignal) =>
		mocks.apiGetUserDraft(scopeKey, signal),
	apiUpsertUserDraft: (scopeKey: string, payload: DraftPayload) =>
		mocks.apiUpsertUserDraft(scopeKey, payload),
	FETCH_ERRORS: { EMPTY: 'EMPTY' }
}));

vi.mock('../../api/apiPostError', () => ({
	apiPostError: vi.fn(() => Promise.resolve()),
	ERROR_LEVEL_WARN: 'warn'
}));

vi.mock('../../globalState', async () => {
	const ReactModule = await import('react');

	return {
		ActiveSessionContext: ReactModule.createContext({
			activeSession: null,
			reloadActiveSession: vi.fn(),
			readActiveSession: vi.fn()
		}),
		E2EEContext: ReactModule.createContext({
			e2EEReady: true,
			isE2eeEnabled: false,
			key: null,
			reloadPrivateKey: vi.fn()
		})
	};
});

vi.mock('../../hooks/useE2EE', () => ({
	useE2EE: () => mocks.e2ee
}));

vi.mock('../../utils/encryptionHelpers', () => ({
	encryptText: (text: string, ...rest: unknown[]) =>
		mocks.encryptText(text, ...rest),
	decryptText: (text: string) => Promise.resolve(text)
}));

const wrapper = ({ children }: PropsWithChildren<{}>) => (
	<E2EEContext.Provider
		value={{
			e2EEReady: true,
			isE2eeEnabled: false,
			key: null,
			reloadPrivateKey: vi.fn()
		}}
	>
		<ActiveSessionContext.Provider
			value={{
				activeSession: {
					item: { id: 42 },
					rid: '!room:matrix.test'
				} as any,
				reloadActiveSession: vi.fn(),
				readActiveSession: vi.fn()
			}}
		>
			{children}
		</ActiveSessionContext.Provider>
	</E2EEContext.Provider>
);

describe('useDraftMessage', () => {
	beforeEach(() => {
		mocks.apiDeleteUserDraft.mockReset();
		mocks.apiDeleteUserDraft.mockImplementation(() => Promise.resolve());
		mocks.apiGetUserDraft.mockReset();
		mocks.apiGetUserDraft.mockImplementation(() =>
			Promise.reject({ message: 'EMPTY' })
		);
		mocks.apiUpsertUserDraft.mockReset();
		mocks.apiUpsertUserDraft.mockImplementation(() => Promise.resolve());
		mocks.encryptText.mockReset();
		mocks.encryptText.mockImplementation((text: string) =>
			Promise.resolve(text)
		);
		mocks.e2ee.encrypted = false;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('cancels pending autosave when clearing a sent draft', async () => {
		const loadDraft = vi.fn();

		const { result, unmount } = renderHook(
			() =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: 'scope:session-42|thread:main'
				}),
			{ wrapper }
		);

		await waitFor(() => expect(result.current.loaded).toBe(true));

		vi.useFakeTimers();

		act(() => {
			result.current.onChange('<p>Sent enquiry text</p>');
		});

		await act(async () => {
			await Promise.resolve();
		});

		await act(async () => {
			await result.current.clearDraftMessage();
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1600);
		});

		act(() => {
			unmount();
		});

		const staleDraftSave = mocks.apiUpsertUserDraft.mock.calls.find(
			([scopeKey, payload]) =>
				scopeKey === 'scope:session-42|thread:main' &&
				payload?.text === '<p>Sent enquiry text</p>'
		);

		expect(staleDraftSave).toBeUndefined();
		expect(mocks.apiDeleteUserDraft).toHaveBeenCalledWith(
			'scope:session-42|thread:main'
		);
	});

	// #976: a zero-content autosave used to upsert `text: ''`, which left a
	// draft row the badge kept counting but no view could ever open.
	it('deletes the remote draft instead of storing an empty one', async () => {
		const loadDraft = vi.fn();

		const { result } = renderHook(
			() =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: 'scope:session-42|thread:main'
				}),
			{ wrapper }
		);

		await waitFor(() => expect(result.current.loaded).toBe(true));

		vi.useFakeTimers();

		act(() => {
			result.current.onChange('<p>Halb getippt</p>');
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1600);
		});

		expect(mocks.apiUpsertUserDraft).toHaveBeenCalledWith(
			'scope:session-42|thread:main',
			expect.objectContaining({ text: '<p>Halb getippt</p>' })
		);

		mocks.apiUpsertUserDraft.mockClear();

		// TipTap serialises an emptied composer as `<p></p>`.
		act(() => {
			result.current.onChange('<p></p>');
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1600);
		});

		expect(mocks.apiDeleteUserDraft).toHaveBeenCalledWith(
			'scope:session-42|thread:main'
		);
		expect(
			mocks.apiUpsertUserDraft.mock.calls.filter(
				([scopeKey]) => scopeKey === 'scope:session-42|thread:main'
			)
		).toHaveLength(0);
	});

	// #976: autosave also fires on unmount. A conversation that was only opened
	// must not leave a draft row behind.
	it('does not persist a draft for a conversation that was only visited', async () => {
		const loadDraft = vi.fn();

		const { result, unmount } = renderHook(
			() =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: 'scope:session-42|thread:main'
				}),
			{ wrapper }
		);

		await waitFor(() => expect(result.current.loaded).toBe(true));

		await act(async () => {
			unmount();
			await Promise.resolve();
		});

		expect(
			mocks.apiUpsertUserDraft.mock.calls.filter(
				([scopeKey]) => scopeKey === 'scope:session-42|thread:main'
			)
		).toHaveLength(0);
		// #976: no index row was ever written, so there is nothing to delete.
		expect(mocks.apiDeleteUserDraft).not.toHaveBeenCalled();
	});

	it('does not carry buffered text over into the next scope', async () => {
		const loadDraft = vi.fn();

		const { result, rerender, unmount } = renderHook(
			({ scopeKey }: { scopeKey: string }) =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: scopeKey
				}),
			{
				wrapper,
				initialProps: { scopeKey: 'scope:session-42|thread:main' }
			}
		);

		await waitFor(() => expect(result.current.loaded).toBe(true));

		act(() => {
			result.current.onChange('<p>Im Gespräch getippt</p>');
		});

		// Switch to a thread that has no draft of its own, before the
		// debounced autosave for the session has fired.
		rerender({ scopeKey: 'scope:session-42|thread:root-1' });
		await waitFor(() => expect(result.current.loaded).toBe(true));

		mocks.apiUpsertUserDraft.mockClear();

		await act(async () => {
			unmount();
			await Promise.resolve();
		});

		expect(
			mocks.apiUpsertUserDraft.mock.calls.filter(
				([scopeKey]) => scopeKey === 'scope:session-42|thread:root-1'
			)
		).toHaveLength(0);
	});

	/**
	 * Frank, 15.09.: "kann es sein dass das was mit dem Entwurf zu tun hatte?"
	 * — the story's lost keystrokes were a re-render storm, but the question
	 * points at a second, real hole: the stored draft is pushed into the
	 * composer whenever it finally arrives, and nothing asks whether the
	 * reader has started writing in the meantime. The wait can be long: the
	 * fetch itself, and with E2EE the key (Frank's own screenshots carry the
	 * "Wiederherstellungsschlüssel" banner, so the key was not there yet).
	 */
	it('leaves what the reader typed while the draft was still loading', async () => {
		const loadDraft = vi.fn();
		let releaseDraft: (payload: DraftPayload) => void = () => undefined;
		mocks.apiGetUserDraft.mockImplementation(
			() =>
				new Promise<DraftPayload>((resolve) => {
					releaseDraft = resolve;
				})
		);

		const { result } = renderHook(() => useDraftMessage(true, loadDraft), {
			wrapper
		});

		// The reader does not wait for the network: they open the chat and
		// type. (`onChange` is dropped while `loaded` is false — the hook has
		// no idea anything was written.)
		act(() => {
			result.current.onChange('<p>Ich melde mich gleich</p>');
		});
		expect(loadDraft).not.toHaveBeenCalled();

		await act(async () => {
			releaseDraft({ text: '<p>Ein alter Entwurf von gestern</p>' });
			await Promise.resolve();
		});

		await waitFor(() => expect(result.current.loaded).toBe(true));
		// Yesterday's draft never reaches the composer: the sentence the
		// reader is in the middle of writing stands.
		expect(loadDraft).not.toHaveBeenCalled();
	});

	it('still restores the draft when the reader has not touched the composer', async () => {
		const loadDraft = vi.fn();
		let releaseDraft: (payload: DraftPayload) => void = () => undefined;
		mocks.apiGetUserDraft.mockImplementation(
			() =>
				new Promise<DraftPayload>((resolve) => {
					releaseDraft = resolve;
				})
		);

		const { result } = renderHook(() => useDraftMessage(true, loadDraft), {
			wrapper
		});

		await act(async () => {
			releaseDraft({ text: '<p>Ein alter Entwurf von gestern</p>' });
			await Promise.resolve();
		});

		await waitFor(() => expect(result.current.loaded).toBe(true));
		expect(loadDraft.mock.calls[0][1]).toBe(
			'<p>Ein alter Entwurf von gestern</p>'
		);
	});

	it('saves what was typed before the draft arrived, once saving is possible', async () => {
		const loadDraft = vi.fn();
		let releaseDraft: (payload: DraftPayload) => void = () => undefined;
		mocks.apiGetUserDraft.mockImplementation(
			() =>
				new Promise<DraftPayload>((resolve) => {
					releaseDraft = resolve;
				})
		);

		const { result } = renderHook(() => useDraftMessage(true, loadDraft), {
			wrapper
		});

		act(() => {
			result.current.onChange('<p>Ich melde mich gleich</p>');
		});

		await act(async () => {
			releaseDraft({ text: '<p>Ein alter Entwurf von gestern</p>' });
			await Promise.resolve();
		});

		// Without the flush the text would only have been saved by the
		// unmount cleanup — and a conversation switch before that dropped it.
		await waitFor(() =>
			expect(
				mocks.apiUpsertUserDraft.mock.calls.some(
					([, payload]) =>
						payload?.text === '<p>Ich melde mich gleich</p>'
				)
			).toBe(true)
		);
	});

	it('does not resurrect text the reader deleted before the draft arrived', async () => {
		const loadDraft = vi.fn();
		let releaseDraft: (payload: DraftPayload) => void = () => undefined;
		mocks.apiGetUserDraft.mockImplementation(
			() =>
				new Promise<DraftPayload>((resolve) => {
					releaseDraft = resolve;
				})
		);

		const { result, unmount } = renderHook(
			() => useDraftMessage(true, loadDraft),
			{ wrapper }
		);

		act(() => {
			result.current.onChange('<p>Halber Satz</p>');
			result.current.onChange('');
		});

		await act(async () => {
			releaseDraft({ text: '<p>Ein alter Entwurf von gestern</p>' });
			await Promise.resolve();
		});
		await waitFor(() => expect(result.current.loaded).toBe(true));

		mocks.apiUpsertUserDraft.mockClear();
		await act(async () => {
			unmount();
			await Promise.resolve();
		});

		expect(
			mocks.apiUpsertUserDraft.mock.calls.some(([, payload]) =>
				String(payload?.text ?? '').includes('Halber Satz')
			)
		).toBe(false);
	});

	it('a draft still in flight cannot refill the composer after sending', async () => {
		const loadDraft = vi.fn();
		let releaseDraft: (payload: DraftPayload) => void = () => undefined;
		mocks.apiGetUserDraft.mockImplementation((scopeKey: string) => {
			// The drafts index is read by the clear path itself — only the
			// conversation's own draft is the one left hanging here.
			if (scopeKey === 'scope:__draft-index__|thread:main') {
				return Promise.reject({ message: 'EMPTY' });
			}
			return new Promise<DraftPayload>((resolve) => {
				releaseDraft = resolve;
			});
		});

		const { result } = renderHook(() => useDraftMessage(true, loadDraft), {
			wrapper
		});

		// Sending does not wait for the draft to load.
		await act(async () => {
			await result.current.clearDraftMessage();
		});

		await act(async () => {
			releaseDraft({ text: '<p>Ein alter Entwurf von gestern</p>' });
			await Promise.resolve();
		});

		expect(loadDraft).not.toHaveBeenCalled();
	});

	it('saves pre-load typing when the conversation unmounts before the draft arrives', async () => {
		const loadDraft = vi.fn();
		mocks.apiGetUserDraft.mockImplementation(
			() => new Promise<DraftPayload>(() => undefined)
		);

		const { result, unmount } = renderHook(
			() =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: 'scope:session-42|thread:main'
				}),
			{ wrapper }
		);

		act(() => {
			result.current.onChange('<p>Vor dem Laden getippt</p>');
		});

		await act(async () => {
			unmount();
			await Promise.resolve();
			await Promise.resolve();
		});

		await waitFor(() =>
			expect(mocks.apiUpsertUserDraft).toHaveBeenCalledWith(
				'scope:session-42|thread:main',
				expect.objectContaining({
					text: '<p>Vor dem Laden getippt</p>'
				})
			)
		);
	});

	it('saves pre-load typing under the conversation that was left, not the one just opened', async () => {
		const loadDraft = vi.fn();
		mocks.apiGetUserDraft.mockImplementation(
			() => new Promise<DraftPayload>(() => undefined)
		);

		const { result, rerender } = renderHook(
			({ scopeKey }: { scopeKey: string }) =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: scopeKey
				}),
			{
				wrapper,
				initialProps: { scopeKey: 'scope:session-42|thread:main' }
			}
		);

		act(() => {
			result.current.onChange('<p>Noch im ersten Gespräch</p>');
		});

		rerender({ scopeKey: 'scope:session-42|thread:root-1' });

		await waitFor(() =>
			expect(mocks.apiUpsertUserDraft).toHaveBeenCalledWith(
				'scope:session-42|thread:main',
				expect.objectContaining({
					text: '<p>Noch im ersten Gespräch</p>'
				})
			)
		);
		expect(
			mocks.apiUpsertUserDraft.mock.calls.filter(
				([scopeKey]) => scopeKey === 'scope:session-42|thread:root-1'
			)
		).toHaveLength(0);
	});

	it('does not let an in-flight encrypted save from the old conversation delete the new one', async () => {
		mocks.e2ee.encrypted = true;
		const encryptedWrapper = ({ children }: PropsWithChildren<{}>) => (
			<E2EEContext.Provider
				value={{
					e2EEReady: true,
					isE2eeEnabled: true,
					key: 'test-key',
					reloadPrivateKey: vi.fn()
				}}
			>
				<ActiveSessionContext.Provider
					value={{
						activeSession: {
							item: { id: 42 },
							rid: '!room:matrix.test'
						} as any,
						reloadActiveSession: vi.fn(),
						readActiveSession: vi.fn()
					}}
				>
					{children}
				</ActiveSessionContext.Provider>
			</E2EEContext.Provider>
		);

		let releaseEncrypt: (cipher: string) => void = () => undefined;
		mocks.encryptText.mockImplementation(
			() =>
				new Promise<string>((resolve) => {
					releaseEncrypt = resolve;
				})
		);

		const loadDraft = vi.fn();
		const { result, rerender, unmount } = renderHook(
			({ scopeKey }: { scopeKey: string }) =>
				useDraftMessage(true, loadDraft, {
					forcedScopeKey: scopeKey
				}),
			{
				wrapper: encryptedWrapper,
				initialProps: { scopeKey: 'scope:session-42|thread:main' }
			}
		);

		await waitFor(() => expect(result.current.loaded).toBe(true));

		vi.useFakeTimers();
		act(() => {
			result.current.onChange('<p>Aus dem ersten Gespräch</p>');
		});
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1600);
		});
		vi.useRealTimers();

		rerender({ scopeKey: 'scope:session-99|thread:main' });
		await waitFor(() => expect(result.current.loaded).toBe(true));

		await act(async () => {
			releaseEncrypt('enc.from-old-scope');
			await Promise.resolve();
			await Promise.resolve();
		});

		mocks.apiDeleteUserDraft.mockClear();
		await act(async () => {
			unmount();
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(
			mocks.apiDeleteUserDraft.mock.calls.filter(
				([scopeKey]) => scopeKey === 'scope:session-99|thread:main'
			)
		).toHaveLength(0);
		expect(
			mocks.apiUpsertUserDraft.mock.calls.some(
				([scopeKey]) => scopeKey === 'scope:session-99|thread:main'
			)
		).toBe(false);
	});
});
