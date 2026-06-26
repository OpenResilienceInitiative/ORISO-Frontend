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
		apiUpsertUserDraft: vi.fn<UpsertDraftMock>(() => Promise.resolve())
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
	useE2EE: () => ({
		encrypted: false,
		key: null,
		keyID: null,
		ready: true
	})
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
		mocks.apiDeleteUserDraft.mockClear();
		mocks.apiGetUserDraft.mockClear();
		mocks.apiUpsertUserDraft.mockClear();
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

		act(() => {
			result.current.clearDraftMessage();
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1600);
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

		unmount();
	});
});
