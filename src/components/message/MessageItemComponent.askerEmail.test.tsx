// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	ActiveSessionContext,
	AUTHORITIES,
	E2EEContext,
	ServerSettingsContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import type { TenantDataInterface } from '../../globalState/interfaces';
import { MessageTimeline } from '../session/MessageTimeline';
import { MessageItemComponent, type MessageItem } from './MessageItemComponent';
import {
	MOCK_ASKER_MATRIX_ID,
	mockActiveSession1on1,
	mockE2EEContext,
	mockE2eeParams,
	mockMessageItemComponentProps,
	mockServerSettingsContext,
	mockUserData
} from './MessageItemComponent.mocks';

const preferenceApi = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('../../api/apiCaseHandover', async (original) => ({
	...(await original<typeof import('../../api/apiCaseHandover')>()),
	apiGetCaseHandoverConsentPreference: preferenceApi.get,
	apiSaveCaseHandoverConsentPreference: preferenceApi.put
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : _key
	})
}));

/* Pulled in transitively through the Erstantwort illustration; lottie-web
   touches a canvas 2D context at import time and jsdom has none. Same stub as
   SessionListItemComponent.test.tsx. */
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

/**
 * The wiring test the Träger switch never had (VERDRAHTUNG §5.2 no. 1, inventory
 * finding L5). `isBausteinSilenced` and its unit test have existed since ADR-018
 * landed; what was missing is the single line that carries the tenant setting
 * from the provider into `ErstantwortMessage`, so the silencing never fired in
 * the product. This test renders the real call site rather than the resolver, so
 * a future refactor that drops the prop again goes red here.
 */

const EMAIL_BAUSTEIN_BODY =
	'Sie können freiwillig eine E-Mail-Adresse hinterlegen. Der Inhalt der Beratung steht nie in dieser E-Mail.';
const GREETING_BAUSTEIN_BODY = 'Schön, dass Sie sich gemeldet haben.';

const erstantwortEvent = `[SYSTEM_NOTIFICATION]${JSON.stringify({
	type: 'FIRST_RESPONSE',
	version: 1,
	bausteine: [
		{ id: 'greeting', body: GREETING_BAUSTEIN_BODY },
		{
			id: 'whoReadsAlong',
			headline: 'Wer liest meine Nachricht?',
			body: 'Nur die zuständige Stelle liest diese Anfrage.'
		},
		{
			id: 'emailNotification',
			body: EMAIL_BAUSTEIN_BODY,
			action: { kind: 'ADD_EMAIL', label: 'E-Mail-Adresse angeben' }
		}
	]
})}`;

const tenantWith = (featureAskerEmailEnabled?: boolean): TenantDataInterface =>
	({
		id: 1,
		name: 'Testträger',
		settings: {
			/* Only the key under test is set; the switch must be read as an
			   independent flag, not inferred from its neighbours. */
			...(featureAskerEmailEnabled === undefined
				? {}
				: { featureAskerEmailEnabled })
		}
	}) as unknown as TenantDataInterface;

const renderErstantwortMessage = (
	tenant: TenantDataInterface,
	{
		raw = erstantwortEvent,
		account = {},
		modality = 'AGENCY_COUNSELLING',
		session = {},
		agency,
		timelineMessages
	} = {} as {
		raw?: string;
		account?: Record<string, unknown>;
		modality?: string;
		session?: Record<string, unknown>;
		agency?: Record<string, unknown>;
		timelineMessages?: MessageItem[];
	}
) =>
	render(
		<MemoryRouter>
			<TenantContext.Provider value={{ tenant, setTenant: () => {} }}>
				<ServerSettingsContext.Provider
					value={mockServerSettingsContext() as any}
				>
					<E2EEContext.Provider value={mockE2EEContext() as any}>
						<UserDataContext.Provider
							value={
								{
									userData: mockUserData({
										userId: MOCK_ASKER_MATRIX_ID,
										email: undefined,
										...account
									} as any),
									setUserData: () => {},
									reloadUserData: async () => null as any
								} as any
							}
						>
							<ActiveSessionContext.Provider
								value={
									{
										activeSession: {
											...mockActiveSession1on1(),
											...(agency ? { agency } : {}),
											item: {
												...mockActiveSession1on1().item,
												conversationType: modality,
												...session
											}
										},
										reloadActiveSession: () => {},
										readActiveSession: () => {}
									} as any
								}
							>
								{timelineMessages ? (
									<MessageTimeline
										messages={timelineMessages}
										clientName="asker"
										isMyMessage={() => false}
										handleDecryptionErrors={() => {}}
										handleDecryptionSuccess={() => {}}
										e2eeParams={mockE2eeParams() as any}
									/>
								) : (
									<MessageItemComponent
										{...mockMessageItemComponentProps({
											message: raw,
											/* Old enough that the stagger is skipped —
										   the whole sequence must be in the DOM
										   synchronously for a truthful assertion. */
											messageTime: '1',
											t: null
										})}
										handleDecryptionErrors={() => {}}
										handleDecryptionSuccess={() => {}}
										e2eeParams={mockE2eeParams() as any}
									/>
								)}
							</ActiveSessionContext.Provider>
						</UserDataContext.Provider>
					</E2EEContext.Provider>
				</ServerSettingsContext.Provider>
			</TenantContext.Provider>
		</MemoryRouter>
	);

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('MessageItemComponent — Träger switch for the asker e-mail', () => {
	it('drops the e-mail Baustein when the Träger switched the invitation off', () => {
		renderErstantwortMessage(tenantWith(false));

		expect(screen.queryByText(EMAIL_BAUSTEIN_BODY)).toBeNull();
		expect(
			screen.queryByRole('button', { name: 'E-Mail-Adresse angeben' })
		).toBeNull();
		// The rest of the sequence is untouched — the switch silences one
		// Baustein, it does not suppress the Erstantwort.
		expect(screen.getByText(GREETING_BAUSTEIN_BODY)).toBeTruthy();
	});

	it('keeps the e-mail Baustein when the Träger switched the invitation on', () => {
		renderErstantwortMessage(tenantWith(true));

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
		expect(
			screen.getByRole('button', { name: /notificationChoice.email/ })
		).toBeTruthy();
	});

	/* The setting is opt-out (TenantSettings.BOOLEAN_FIELD_DEFAULTS): a tenant
	   that has never opened the card sends no key at all, and `undefined` must
	   keep today's behaviour. Reading it as "off" would silently take the
	   Baustein away from every existing Träger. */
	it('keeps the e-mail Baustein when the Träger never configured the switch', () => {
		renderErstantwortMessage(tenantWith(undefined));

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
	});

	it('keeps the e-mail Baustein when no tenant is loaded at all', () => {
		renderErstantwortMessage(undefined as unknown as TenantDataInterface);

		expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
	});
});

it('offers the regular channels after the frozen FAQ without an optional popup', () => {
	vi.stubGlobal('Notification', {
		permission: 'default',
		requestPermission: vi.fn()
	});
	renderErstantwortMessage(tenantWith(true));
	const faq = screen.getByText('Wer liest meine Nachricht?');
	const choice = screen.getByRole('button', {
		name: /notificationChoice.both/
	});
	expect(faq.tagName).toBe('SUMMARY');
	expect(
		faq.compareDocumentPosition(choice) & Node.DOCUMENT_POSITION_FOLLOWING
	).toBeTruthy();
	expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: 'E-Mail-Adresse angeben' })
	).toBeNull();
	expect(screen.queryByRole('dialog')).toBeNull();
	vi.unstubAllGlobals();
});

it('retains browser-only regular continuation with tenant email disabled', () => {
	vi.stubGlobal('Notification', {
		permission: 'default',
		requestPermission: vi.fn()
	});
	renderErstantwortMessage(tenantWith(false));
	expect(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	).toBeTruthy();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.both/ })
	).toBeNull();
	expect(screen.queryByText(EMAIL_BAUSTEIN_BODY)).toBeNull();
});
it('suppresses repeated setup through the persisted regular call site when email is already active', () => {
	renderErstantwortMessage(tenantWith(true), {
		account: {
			email: 'asker@example.org',
			emailNotifications: {
				emailNotificationsEnabled: true,
				settings: { newChatMessageNotificationEnabled: true }
			}
		}
	});
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(screen.getByText(EMAIL_BAUSTEIN_BODY)).toBeTruthy();
});
for (const testCase of [
	{ raw: erstantwortEvent.replace('"version":1', '"version":2') },
	{ modality: 'LIVE_CHAT' },
	{
		raw: `[SYSTEM_NOTIFICATION]${JSON.stringify({ type: 'FIRST_RESPONSE', version: 1, bausteine: [{ id: 'greeting', body: GREETING_BAUSTEIN_BODY }] })}`
	}
]) {
	it(`does not invent an async invitation for ${JSON.stringify(testCase)}`, () => {
		vi.stubGlobal('Notification', {
			permission: 'default',
			requestPermission: vi.fn()
		});
		renderErstantwortMessage(tenantWith(true), testCase);
		expect(
			screen.queryByRole('button', { name: /notificationChoice/ })
		).toBeNull();
	});
}

it.each([
	[
		'legacy team agency',
		{
			conversationType: undefined,
			teamSession: true,
			registrationType: 'REGISTERED'
		},
		true
	],
	[
		'legacy anonymous',
		{ conversationType: undefined, registrationType: 'ANONYMOUS' },
		false
	],
	['explicit self help', { conversationType: 'SELF_HELP' }, true],
	['explicit internal', { conversationType: 'INTERNAL_GROUP' }, false],
	['future unknown', { conversationType: 'FUTURE_MODE' }, false]
])(
	'uses the server channel context at the real message caller: %s',
	(_label, session, allowsEmail) => {
		renderErstantwortMessage(tenantWith(true), { session });
		expect(
			Boolean(
				screen.queryByRole('button', {
					name: /notificationChoice.email/
				})
			)
		).toBe(allowsEmail);
	}
);

describe('persisted NONE grant notification continuation', () => {
	const grant = (handover?: unknown) =>
		'[SYSTEM_NOTIFICATION]' +
		JSON.stringify({
			type: 'CASE_HANDOVER_GRANTED',
			description: 'The counsellor has taken over.',
			...(handover ? { handover } : {})
		});
	it('shows completed takeover details and adds notification setup only after a manual dialog action', () => {
		const result = renderErstantwortMessage(tenantWith(true), {
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] },
			raw: grant({
				requestId: 42,
				clientConsent: 'NONE',
				accessType: 'TAKEOVER'
			})
		});
		expect(screen.getByText('The counsellor has taken over.')).toBeTruthy();
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(
			result.container.querySelector('.notificationChoiceHost')
		).toBeNull();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
		expect(
			within(screen.getByRole('dialog')).queryByRole('switch')
		).toBeNull();
		fireEvent.click(
			within(screen.getByRole('dialog')).getByRole('button', {
				name: 'caseHandover.consent.info.notificationsAction'
			})
		);
		const setup = result.container.querySelector('.notificationChoiceHost');
		expect(setup).toBeTruthy();
		expect(setup?.closest('.messageItem__message')).toBeNull();
	});
	it.each([
		undefined,
		{ requestId: 42, clientConsent: 'UNKNOWN', accessType: 'TAKEOVER' }
	])(
		'preserves legacy or malformed grant descriptions without reconstructing current policy',
		(metadata) => {
			renderErstantwortMessage(tenantWith(true), {
				account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] },
				raw: grant(metadata)
			});
			expect(
				screen.getByText('The counsellor has taken over.')
			).toBeTruthy();
			expect(
				screen.queryByRole('button', {
					name: 'caseHandover.consent.info.more'
				})
			).toBeNull();
		}
	);
});

describe('standing preference stays inside the persisted access-grant message', () => {
	it.each(['NONE', 'OPT_IN', 'OPT_OUT'])(
		'loads the scoped preference from the existing %s grant explanation',
		async (clientConsent) => {
			preferenceApi.get.mockReset().mockResolvedValue({
				sessionId: 73,
				alwaysAskBeforeAdditionalAccess: false
			});
			const result = renderErstantwortMessage(tenantWith(true), {
				account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] },
				session: { id: 73, status: 2 },
				raw:
					'[SYSTEM_NOTIFICATION]' +
					JSON.stringify({
						type: 'CASE_HANDOVER_GRANTED',
						description: 'Access has been granted.',
						handover: {
							requestId: 42,
							clientConsent,
							accessType: 'TAKEOVER'
						}
					})
			});
			const action = screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			});
			expect(
				action.closest('.messageItem__message--systemNotification')
			).toBeTruthy();
			expect(
				screen.queryByRole('button', {
					name: 'caseHandover.consent.info.title'
				})
			).toBeNull();
			expect(preferenceApi.get).not.toHaveBeenCalled();
			fireEvent.click(action);
			expect(
				(await screen.findByRole('switch')).matches(':checked')
			).toBe(false);
			expect(preferenceApi.get).toHaveBeenCalledWith(73);
			expect(
				result.container.querySelectorAll(
					'.messageItem__message--systemNotification'
				)
			).toHaveLength(1);
		}
	);
	it('does not fabricate an access-setting event from the pre-acceptance FIRST_RESPONSE greeting', () => {
		renderErstantwortMessage(tenantWith(true), {
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] },
			session: { id: 73, status: 1 }
		});
		expect(
			screen.queryByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		).toBeNull();
		expect(
			screen.queryByRole('button', {
				name: 'caseHandover.consent.info.title'
			})
		).toBeNull();
	});
});

describe('initial acceptance is its own persisted chat event', () => {
	const acceptance = (
		metadata: unknown = {
			sessionId: 73,
			acceptedAt: '2026-10-09T10:20:00Z'
		}
	) =>
		'[SYSTEM_NOTIFICATION]' +
		JSON.stringify({
			type: 'INQUIRY_ACCEPTED',
			username: 'public-counsellor',
			description: 'Your enquiry was accepted.',
			acceptance: metadata
		});
	it.each([undefined, '', '   '])(
		'uses neutral acceptance copy when description is absent or blank: %j',
		(description) => {
			renderErstantwortMessage(tenantWith(true), {
				raw:
					'[SYSTEM_NOTIFICATION]' +
					JSON.stringify({
						type: 'INQUIRY_ACCEPTED',
						username: 'public-counsellor',
						description,
						acceptance: {
							sessionId: 73,
							acceptedAt: '2026-10-09T10:20:00Z'
						}
					}),
				session: { id: 73, status: 2 },
				agency: { name: 'Known counselling agency' },
				account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
			});
			expect(
				screen.getByText('notifications.events.inquiryAccepted.text')
			).toBeTruthy();
			expect(screen.queryByText('caseHandover.accepted.copy')).toBeNull();
		}
	);
	it('offers scoped settings inside the accepted message rather than the earlier enquiry greeting', async () => {
		preferenceApi.get.mockReset().mockResolvedValue({
			sessionId: 73,
			alwaysAskBeforeAdditionalAccess: true
		});
		const result = renderErstantwortMessage(tenantWith(true), {
			raw: acceptance(),
			session: { id: 73, status: 2 },
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
		});
		const action = screen.getByRole('button', {
			name: 'caseHandover.consent.info.more'
		});
		expect(
			action.closest('.messageItem__message--systemNotification')
		).toBeTruthy();
		fireEvent.click(action);
		expect((await screen.findByRole('switch')).matches(':checked')).toBe(
			true
		);
		expect(preferenceApi.get).toHaveBeenCalledWith(73);
		expect(
			result.container.querySelectorAll(
				'.messageItem__message--systemNotification'
			)
		).toHaveLength(1);
	});
	it('shows the translated acceptance text, never the description frozen in the server language', () => {
		renderErstantwortMessage(tenantWith(true), {
			raw:
				'[SYSTEM_NOTIFICATION]' +
				JSON.stringify({
					type: 'INQUIRY_ACCEPTED',
					description: 'Die Anfrage wurde angenommen.',
					acceptance: {
						sessionId: 73,
						acceptedAt: '2026-10-09T10:20:00Z'
					}
				}),
			session: { id: 73, status: 2 },
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
		});
		expect(
			screen.getByText('notifications.events.inquiryAccepted.text')
		).toBeTruthy();
		expect(screen.queryByText('Die Anfrage wurde angenommen.')).toBeNull();
	});
	it('opens the full three-column explanation, not the reduced dialog', async () => {
		preferenceApi.get.mockReset().mockResolvedValue({
			sessionId: 73,
			alwaysAskBeforeAdditionalAccess: true
		});
		renderErstantwortMessage(tenantWith(true), {
			raw: acceptance(),
			session: { id: 73, status: 2 },
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
		await screen.findByRole('switch');
		const dialog = screen.getByRole('dialog');
		expect(
			dialog.querySelectorAll(
				'.caseHandoverConsentInfo__sections section'
			)
		).toHaveLength(3);
		expect(dialog.querySelector('.caseHandoverConsentInfo')).toBeTruthy();
	});
	it.each([
		undefined,
		{},
		{ sessionId: 99, acceptedAt: '2026-10-09T10:20:00Z' },
		{ sessionId: 73, acceptedAt: 'bad-date' }
	])(
		'does not expose settings for an unbound or malformed event: %j',
		(metadata) => {
			const raw =
				'[SYSTEM_NOTIFICATION]' +
				JSON.stringify({
					type: 'INQUIRY_ACCEPTED',
					description: 'Your enquiry was accepted.',
					...(metadata === undefined ? {} : { acceptance: metadata })
				});
			renderErstantwortMessage(tenantWith(true), {
				raw,
				session: { id: 73, status: 2 },
				account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
			});
			expect(
				screen.queryByRole('button', {
					name: 'caseHandover.consent.info.more'
				})
			).toBeNull();
		}
	);
	it.each(['LIVE_CHAT', 'INTERNAL_GROUP', 'SELF_HELP'])(
		'does not expose agency preference in %s',
		(modality) => {
			renderErstantwortMessage(tenantWith(true), {
				raw: acceptance(),
				modality,
				session: { id: 73, status: 2 },
				account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
			});
			expect(
				screen.queryByRole('button', {
					name: 'caseHandover.consent.info.more'
				})
			).toBeNull();
		}
	);
	it('does not expose asker preference to counsellors', () => {
		renderErstantwortMessage(tenantWith(true), {
			raw: acceptance(),
			session: { id: 73, status: 2 },
			account: { grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT] }
		});
		expect(
			screen.queryByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		).toBeNull();
	});
});

it('keeps initial acceptance in the real chronological message rail on remount, with one notice and no invented first-response action', () => {
	const message = (id: string, time: number, body: string) =>
		({
			...mockMessageItemComponentProps({
				message: body,
				messageTime: String(time),
				t: null
			}),
			_id: id
		}) as MessageItem;
	const timelineMessages = [
		message('enquiry', 1, 'Original enquiry'),
		message(
			'acceptance',
			2,
			'[SYSTEM_NOTIFICATION]' +
				JSON.stringify({
					type: 'INQUIRY_ACCEPTED',
					acceptance: {
						sessionId: 73,
						acceptedAt: '2026-10-09T10:20:00Z'
					},
					description: 'Accepted in the timeline'
				})
		),
		message('answer', 3, 'The later answer')
	];
	const setup = () =>
		renderErstantwortMessage(tenantWith(true), {
			timelineMessages,
			session: { id: 73, status: 2 },
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] }
		});
	let result = setup();
	const check = () => {
		const rows = [...result.container.querySelectorAll('.messageItem')];
		expect(rows.map((row) => row.textContent)).toEqual([
			expect.stringContaining('Original enquiry'),
			expect.stringContaining(
				'notifications.events.inquiryAccepted.text'
			),
			expect.stringContaining('The later answer')
		]);
		expect(
			screen.getAllByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		).toHaveLength(1);
		expect(
			result.container.querySelectorAll(
				'.messageItem__message--systemNotification'
			)
		).toHaveLength(1);
	};
	check();
	result.unmount();
	result = setup();
	check();
});

it.each([
	['CO_ACCESS', 'caseHandover.consent.info.noticeTitle'],
	['TAKEOVER', 'caseHandover.systemMessage.tookOverTitle']
])(
	'names the immutable %s grant correctly in the real message header',
	(accessType, expectedTitle) => {
		const result = renderErstantwortMessage(tenantWith(true), {
			account: { grantedAuthorities: [AUTHORITIES.ASKER_DEFAULT] },
			session: { id: 73, status: 2 },
			raw:
				'[SYSTEM_NOTIFICATION]' +
				JSON.stringify({
					type: 'CASE_HANDOVER_GRANTED',
					description: 'The recorded access was granted.',
					handover: {
						requestId: 42,
						clientConsent: 'NONE',
						accessType
					}
				})
		});
		const header = result.container.querySelector(
			'.messageItem__systemNotificationHeaderText'
		);
		expect(header?.textContent).toContain(expectedTitle);
		if (accessType === 'CO_ACCESS')
			expect(header?.textContent).not.toContain(
				'caseHandover.systemMessage.tookOverTitle'
			);
	}
);
