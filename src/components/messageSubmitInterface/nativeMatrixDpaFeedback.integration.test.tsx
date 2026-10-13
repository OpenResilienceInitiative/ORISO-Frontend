// @vitest-environment jsdom
import * as React from 'react';
import { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { MatrixClient } from 'matrix-js-sdk';
import { MessageSubmitInterfaceComponent } from './messageSubmitInterfaceComponent';
import { MatrixClientService } from '../../services/matrixClientService';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import {
	ActiveSessionContext,
	SessionTypeContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { E2EEProvider } from '../../globalState/provider/E2EEProvider';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import {
	buildMockGroupSession,
	mockComposerUserData
} from './__storybook__/composerStoryDecorator';
import de from '../../resources/i18n/de/common.json';
import en from '../../resources/i18n/en/common.json';

// jsdom has no canvas; this is the browser drawing boundary, not application code.
vi.hoisted(() => {
	Object.defineProperty(document, 'elementFromPoint', {
		configurable: true,
		value: () => null
	});
	Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
		configurable: true,
		value: () =>
			new Proxy(
				{},
				{
					get: (_target, key) =>
						key === 'measureText' ? () => ({ width: 0 }) : () => {}
				}
			)
	});
});

// Crypto and sync startup belong to the external SDK, outside this join/send
// contract. The application service, SDK join HTTP parser, composer and drafts
// remain real. All HTTP replies are disposable synthetic fixtures.
const i18n = createInstance().use(initReactI18next);
let service: MatrixClientService;
let joinAllowed = false;
let nextJoinFailure:
	| { status: number; data: Record<string, unknown> }
	| 'network'
	| null = null;
const groupSession = buildMockGroupSession();
const requests: Array<{ path: string; method: string }> = [];
class BrowserRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		super(input, { ...init, signal: undefined });
	}
}

function Composer() {
	const [failedMessage, setFailedMessage] = useState('');
	return (
		<I18nextProvider i18n={i18n}>
			<MemoryRouter>
				<TenantContext.Provider
					value={
						{
							tenant: { id: 41, settings: {} },
							setTenant: () => {}
						} as React.ContextType<typeof TenantContext>
					}
				>
					<UserDataContext.Provider
						value={{
							userData: mockComposerUserData,
							setUserData: () => {},
							reloadUserData: async () => mockComposerUserData
						}}
					>
						<ActiveSessionContext.Provider
							value={{
								activeSession: groupSession,
								reloadActiveSession: () => {},
								readActiveSession: () => {}
							}}
						>
							<SessionTypeContext.Provider
								value={{
									type: SESSION_LIST_TYPES.MY_SESSION,
									path: '/sessions/consultant/sessionView'
								}}
							>
								<E2EEProvider>
									<MatrixClientContext.Provider
										value={{
											matrixClientService: service,
											setMatrixClientService: () => {}
										}}
									>
										<MessageSubmitInterfaceComponent
											placeholder="Synthetic draft"
											autoFocusEditor={false}
											onSendError={(message) =>
												setFailedMessage(message)
											}
										/>
										{failedMessage && (
											<output aria-label="Failed message">
												{failedMessage}
											</output>
										)}
									</MatrixClientContext.Provider>
								</E2EEProvider>
							</SessionTypeContext.Provider>
						</ActiveSessionContext.Provider>
					</UserDataContext.Provider>
				</TenantContext.Provider>
			</MemoryRouter>
		</I18nextProvider>
	);
}

beforeEach(async () => {
	requests.length = 0;
	joinAllowed = false;
	nextJoinFailure = null;
	window.localStorage.clear();
	vi.stubGlobal('Request', BrowserRequest);
	vi.spyOn(MatrixClient.prototype, 'initRustCrypto').mockResolvedValue(
		undefined
	);
	vi.spyOn(MatrixClient.prototype, 'startClient').mockResolvedValue(
		undefined
	);
	await i18n.init({
		lng: 'en',
		fallbackLng: false,
		resources: { de: { translation: de }, en: { translation: en } },
		interpolation: { escapeValue: false }
	});
});

afterEach(() => {
	cleanup();
	service?.stopAndCleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	window.localStorage.clear();
});

async function prepareJoinFailure(
	status: number,
	data: Record<string, unknown>,
	locale: 'de' | 'en' = 'en'
) {
	await i18n.changeLanguage(locale);
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const path = new URL(
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.href
						: input.url
			).pathname;
			const method =
				init?.method ||
				(input instanceof Request ? input.method : 'GET');
			requests.push({ path, method });
			if (path.startsWith('/_matrix/client/v3/join/')) {
				if (nextJoinFailure === 'network')
					throw new TypeError('Synthetic network failure');
				return joinAllowed
					? Response.json({ room_id: '!storybook-group:example.org' })
					: Response.json(nextJoinFailure?.data ?? data, {
							status: nextJoinFailure?.status ?? status
						});
			}
			if (
				path.startsWith('/_matrix/client/v3/rooms/') &&
				path.includes('/send/')
			)
				return Response.json({ event_id: '$synthetic-message' });
			if (path.endsWith('/_matrix/client/versions'))
				return Response.json({ versions: ['v1.11'] });
			if (path.endsWith('/drafts/single'))
				return new Response(null, { status: 204 });
			if (path.endsWith('/consultants') || path.endsWith('/supervisors'))
				return Response.json([]);
			return new Response(null, { status: 204 });
		}
	);
	service = new MatrixClientService();
	await service.initializeClient({
		userId: '@synthetic:example.invalid',
		accessToken: 'synthetic-token',
		deviceId: 'SYNTHETIC',
		homeserverUrl: 'https://matrix.example.invalid'
	});
	render(<Composer />);
	const editor = await screen.findByRole('textbox');
	const user = userEvent.setup();
	await user.click(editor);
	await user.type(editor, 'Synthetic message stays here');
	await user.click(
		screen.getByRole('button', {
			name: i18n.t('enquiry.write.input.button.title')
		})
	);
	return editor;
}

it('explains a native join refusal in the composer and retains the draft without a failed timeline echo', async () => {
	const editor = await prepareJoinFailure(403, {
		'errcode': 'M_FORBIDDEN',
		'error': 'Not allowed to join this room',
		'org.oriso.reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
	});
	const alert = await screen.findByRole('alert');
	expect(alert.textContent).toContain(
		'New counselling is currently restricted'
	);
	expect(editor.textContent).toBe('Synthetic message stays here');
	expect(screen.queryByLabelText('Failed message')).toBeNull();
	await waitFor(() =>
		expect(
			screen
				.getByRole('button', { name: 'Send message' })
				.hasAttribute('disabled')
		).toBe(false)
	);
	expect(
		requests
			.filter(({ path }) => path.startsWith('/_matrix/'))
			.map(({ path }) => path)
	).toEqual(['/_matrix/client/v3/join/!storybook-group%3Aexample.org']);
});

it.each([
	[
		'de',
		403,
		'M_FORBIDDEN',
		'DPA_NEW_COUNSELLING_NOT_ALLOWED',
		'Neue Beratung derzeit gesperrt'
	],
	[
		'de',
		502,
		'M_UNKNOWN',
		'DPA_POLICY_UNAVAILABLE',
		'Beratung derzeit nicht prüfbar'
	],
	[
		'en',
		502,
		'M_UNKNOWN',
		'DPA_POLICY_UNAVAILABLE',
		'Counselling availability cannot be checked'
	]
] as const)(
	'explains native %s/%s with the existing alert and preserves explicit retry input',
	async (locale, status, errcode, reason, title) => {
		const editor = await prepareJoinFailure(
			status,
			{
				errcode,
				'error': 'Synthetic join failure',
				'org.oriso.reason': reason
			},
			locale
		);
		expect((await screen.findByRole('alert')).textContent).toContain(title);
		expect(editor.textContent).toBe('Synthetic message stays here');
		expect(screen.queryByLabelText('Failed message')).toBeNull();
		expect(
			screen
				.getByRole('button', {
					name: i18n.t('enquiry.write.input.button.title')
				})
				.hasAttribute('disabled')
		).toBe(false);
		expect(
			requests
				.filter(({ path }) => path.startsWith('/_matrix/'))
				.map(({ path }) => path)
		).toEqual(['/_matrix/client/v3/join/!storybook-group%3Aexample.org']);
	}
);

it.each([
	[403, 'M_FORBIDDEN', undefined],
	[403, 'M_FORBIDDEN', 'OTHER_PERMISSION'],
	[502, 'M_UNKNOWN', undefined],
	[502, 'M_FORBIDDEN', 'DPA_POLICY_UNAVAILABLE']
] as const)(
	'retains ordinary native %s/%s failed-message handling without a false AVV notice',
	async (status, errcode, reason) => {
		const editor = await prepareJoinFailure(status, {
			errcode,
			'error': 'Synthetic ordinary join failure',
			'org.oriso.reason': reason
		});
		expect(
			(await screen.findByLabelText('Failed message')).textContent
		).toContain('Synthetic message stays here');
		expect(screen.queryByRole('alert')).toBeNull();
		expect(editor.textContent).toBe('Synthetic message stays here');
	}
);

it('allows an explicit keyboard retry after the owner becomes available and sends the retained draft once', async () => {
	const editor = await prepareJoinFailure(502, {
		'errcode': 'M_UNKNOWN',
		'error': 'Group participation could not be checked',
		'org.oriso.reason': 'DPA_POLICY_UNAVAILABLE'
	});
	await screen.findByRole('alert');
	expect(requests.filter(({ path }) => path.includes('/send/'))).toHaveLength(
		0
	);
	joinAllowed = true;
	const send = screen.getByRole('button', { name: 'Send message' });
	send.focus();
	await userEvent.setup().keyboard('{Enter}');
	await waitFor(() => expect(editor.textContent).toBe(''));
	expect(screen.queryByRole('alert')).toBeNull();
	expect(screen.queryByLabelText('Failed message')).toBeNull();
	expect(
		requests.filter(({ path }) =>
			path.startsWith('/_matrix/client/v3/join/')
		)
	).toHaveLength(2);
	expect(
		requests.filter(({ path }) => path.includes('/send/m.room.message/'))
	).toHaveLength(1);
});

it.each([
	[
		403,
		'M_FORBIDDEN',
		'DPA_NEW_COUNSELLING_NOT_ALLOWED',
		'ordinary-permission'
	],
	[502, 'M_UNKNOWN', 'DPA_POLICY_UNAVAILABLE', 'ordinary-permission'],
	[
		403,
		'M_FORBIDDEN',
		'DPA_NEW_COUNSELLING_NOT_ALLOWED',
		'mismatched-outage'
	],
	[502, 'M_UNKNOWN', 'DPA_POLICY_UNAVAILABLE', 'mismatched-outage'],
	[403, 'M_FORBIDDEN', 'DPA_NEW_COUNSELLING_NOT_ALLOWED', 'network'],
	[502, 'M_UNKNOWN', 'DPA_POLICY_UNAVAILABLE', 'network']
] as const)(
	'removes previous %s/%s/%s feedback after an explicit %s retry failure',
	async (status, errcode, reason, retryFailure) => {
		const editor = await prepareJoinFailure(status, {
			errcode,
			'error': 'Synthetic policy failure',
			'org.oriso.reason': reason
		});
		await screen.findByRole('alert');
		nextJoinFailure =
			retryFailure === 'network'
				? 'network'
				: retryFailure === 'ordinary-permission'
					? {
							status: 403,
							data: {
								errcode: 'M_FORBIDDEN',
								error: 'Synthetic ordinary permission failure'
							}
						}
					: {
							status: 502,
							data: {
								'errcode': 'M_FORBIDDEN',
								'error': 'Synthetic mismatched outage',
								'org.oriso.reason': 'DPA_POLICY_UNAVAILABLE'
							}
						};
		const send = screen.getByRole('button', { name: 'Send message' });
		send.focus();
		await userEvent.setup().keyboard('{Enter}');
		expect(
			(await screen.findByLabelText('Failed message')).textContent
		).toContain('Synthetic message stays here');
		expect(screen.queryByRole('alert')).toBeNull();
		expect(editor.textContent).toBe('Synthetic message stays here');
		expect(send.hasAttribute('disabled')).toBe(false);
		expect(
			requests.filter(({ path }) => path.includes('/send/'))
		).toHaveLength(0);
		expect(
			requests.filter(({ path }) =>
				path.startsWith('/_matrix/client/v3/join/')
			)
		).toHaveLength(2);
	}
);
