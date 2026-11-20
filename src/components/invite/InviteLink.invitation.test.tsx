// @vitest-environment oriso-jsdom

import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { redeemInviteLink } from '../../api/apiRedeemInviteLink';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { autoLogin } from '../registration/autoLogin';
import {
	apiGetInviteLinkContext,
	type InviteLinkContext
} from '../../api/apiGetInviteLinkContext';

vi.mock('../../api/apiRedeemInviteLink', async () => {
	const actual = await vi.importActual<
		typeof import('../../api/apiRedeemInviteLink')
	>('../../api/apiRedeemInviteLink');
	return {
		...actual,
		redeemInviteLink: vi.fn()
	};
});

vi.mock('../../api/apiPostRegistration', () => ({
	apiPostRegistration: vi.fn(),
	// The retry goes through the deadline wrapper; the mocked login behind it
	// is what these tests watch.
	autoLoginWithDeadline: async (props: Parameters<typeof autoLogin>[0]) =>
		(await import('../registration/autoLogin')).autoLogin(props)
}));

vi.mock('../../api/apiGetAnonymousEnquiryDetails', () => ({
	apiGetAnonymousEnquiryDetails: vi.fn()
}));

vi.mock('../registration/autoLogin', () => ({
	redirectToApp: vi.fn(),
	autoLogin: vi.fn()
}));

/* The room owns the pre-session flow; here only what it is handed matters. */
const roomProps = vi.hoisted(() => ({ current: null as any }));
vi.mock('../anonymousChat/entryRoom/LiveChatEntryRoom', () => ({
	LiveChatEntryRoom: (props: any) => {
		roomProps.current = props;
		return (
			<div data-testid="live-chat-entry-room">
				room{' '}
				{props.sessionId ?? `invite ${props.invite?.topicId ?? '?'}`}
			</div>
		);
	}
}));
/* Without a context the page falls back to redeeming on arrival, which is
   what the older describes below exercise. */
vi.mock('../../api/apiFinishAnonymousConversation', () => ({
	apiFinishAnonymousConversation: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiGetInviteLinkContext', () => ({
	apiGetInviteLinkContext: vi.fn(() => Promise.reject(new Error('none')))
}));
/* Real consulting types are served by another service; calls are allowed
   unless a test says otherwise. */
vi.mock('../../api/apiGetConsultingType', () => ({
	apiGetConsultingType: vi.fn(() =>
		Promise.resolve({ id: 3, isVideoCallAllowed: true })
	)
}));
vi.mock('./inviteLinkHelpers', () => ({
	applyRedeemSessionCredentials: vi.fn(),
	assignInviteSessionDisplayName: vi.fn(),
	redirectToInviteSession: vi.fn()
}));

/* #2252: the joiner's own consent, before the conversation opens. */
vi.mock('../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn(() =>
		Promise.resolve({ status: 'ok', consentText: null })
	)
}));
vi.mock('../../api/apiPutSessionConsent', () => ({
	apiPutSessionConsent: vi.fn(() => Promise.resolve())
}));
vi.mock('../../api/apiGetAgencyId', () => ({
	apiGetAgencyById: vi.fn(() => Promise.resolve({ name: 'Beratung Mitte' }))
}));
vi.mock('../../api/apiGetPublicTopicName', () => ({
	apiGetPublicTopicName: vi.fn(() => Promise.resolve('Schulden'))
}));

vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('../stage/stage', () => ({
	Stage: () => null
}));

vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<main>{children}</main>
	)
}));

vi.mock('../pseudonym/AnimalAvatar', () => ({
	AnimalAvatar: () => <div data-testid="animal-avatar" />
}));

/* One stable t, as i18next gives: InviteLink lists t in effect and callback
   deps, so a fresh function per render would re-run them in tests only. */
const i18nMock = vi.hoisted(() => {
	const catalogue: Record<string, string> = {
		'registration.account.username.label': 'User-ID',
		'registration.account.password.label': 'Passwort',
		'registration.registering': 'Registrierung läuft...',
		'anonymousChat.pseudonym.changeName': 'Name ändern',
		'anonymousChat.pseudonym.continueWithSelection': 'Weiter mit Auswahl',
		'liveChat.entry.staff.headline': 'Sie sind als Beraterin angemeldet.',
		'inviteLink.error.title': 'This invite link can no longer be used',
		'directLink.entry.inactive': 'Dieser Link ist nicht mehr aktiv.',
		'directLink.entry.callsDisabled': 'Anrufe sind nicht möglich.',
		'inviteLink.paused': 'Dieser Link ist aktuell pausiert.',
		'directLink.entry.haveAccount': 'Sie haben schon ein Konto? Anmelden',
		'inviteLink.resume.retry': 'Erneut versuchen',
		'registration.zipcode.label': 'Ihre Postleitzahl',
		'directInvitation.entry.roomNotEncrypted':
			'directInvitation.entry.roomNotEncrypted',
		'directInvitation.entry.access.guestsOnly':
			'Dieser Link ist nur für Gäste.',
		'directInvitation.entry.access.accountsOnly':
			'Für diesen Link brauchen Sie ein Konto.',
		'registration.accountCreated.retry':
			'Ihr Zugang wurde angelegt, aber die Anmeldung hat nicht geklappt. Bitte versuchen Sie es noch einmal.'
	};
	return { t: (key: string) => catalogue[key] ?? key };
});

vi.mock('react-i18next', () => ({
	useTranslation: () => i18nMock
}));

vi.mock('../../api/apiDirectLinks', async () => {
	const actual = await vi.importActual<
		typeof import('../../api/apiDirectLinks')
	>('../../api/apiDirectLinks');
	return {
		...actual,
		apiStartDirectLinkConversation: vi.fn(),
		apiRequestDirectInvitationRenewal: vi.fn(),
		apiCancelOwnCallKnock: vi.fn(() => Promise.resolve())
	};
});
vi.mock('../auth/auth', async () => {
	const actual =
		await vi.importActual<typeof import('../auth/auth')>('../auth/auth');
	return { ...actual, hasActiveAuthSession: vi.fn(() => false) };
});
vi.mock('../directLinkEntry/DirectLinkCallEntry', () => ({
	DirectLinkCallEntry: (props: any) => (
		<div
			data-testid="direct-link-call-entry"
			data-signed-in={String(Boolean(props.signedIn))}
		>
			{props.modality}
		</div>
	)
}));
const ics = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('../../utils/downloadICSFile', () => ({
	downloadICSFile: ics.download
}));
vi.mock('../app/Loading', () => ({
	Loading: () => <div data-testid="loading" />
}));

const { InviteLink } = await import('./InviteLink');
const {
	apiStartDirectLinkConversation,
	apiRequestDirectInvitationRenewal,
	apiCancelOwnCallKnock
} = await import('../../api/apiDirectLinks');
const { redirectToApp } = await import('../registration/autoLogin');
const { apiGetConsentText } = await import('../../api/apiGetConsentText');
const { apiPutSessionConsent } = await import('../../api/apiPutSessionConsent');
const { readPendingKnock } = await import(
	'../directLinkEntry/directLinkEntryFlow'
);
const { hasActiveAuthSession } = await import('../auth/auth');
const { apiGetConsultingType } = await import('../../api/apiGetConsultingType');

const localeValue = {
	locale: 'de',
	initLocale: 'de',
	setLocale: vi.fn(),
	locales: ['de'],
	selectableLocales: ['de']
};

const tenantValue = {
	tenant: { id: 1 },
	setTenant: vi.fn()
};

const Stage = () => <div data-testid="stage" />;

const renderInvite = () =>
	render(
		<GlobalComponentContext.Provider value={{ Stage }}>
			<TenantContext.Provider value={tenantValue as any}>
				<LocaleContext.Provider value={localeValue}>
					<MemoryRouter initialEntries={['/invite/token-123']}>
						<Routes>
							<Route
								path="/invite/:token"
								element={<InviteLink />}
							/>
						</Routes>
					</MemoryRouter>
				</LocaleContext.Provider>
			</TenantContext.Provider>
		</GlobalComponentContext.Provider>
	);

const typePostcode = (value: string) =>
	fireEvent.change(screen.getByLabelText('Ihre Postleitzahl'), {
		target: { value }
	});

const directContext = (chatType: string) => ({
	tenantId: 1,
	agencyId: 7,
	consultingTypeId: 3,
	topicId: 11,
	chatType,
	temporaryAccount: chatType !== 'CHAT',
	admission: chatType === 'CHAT' ? 'DIRECT' : 'KNOCK'
});

describe('InviteLink with a Direkteinladung (#2252)', () => {
	afterEach(cleanup);
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiGetInviteLinkContext)
			.mockReset()
			.mockRejectedValue(new Error('none'));
		vi.mocked(apiStartDirectLinkConversation).mockReset();
		sessionStorage.clear();
		vi.mocked(hasActiveAuthSession).mockReturnValue(false);
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
		/* clearAllMocks keeps queued one-time results of an unused mock. */
		vi.mocked(apiStartDirectLinkConversation).mockReset();
		vi.mocked(apiGetInviteLinkContext)
			.mockReset()
			.mockImplementation(() => Promise.reject(new Error('none')));
		vi.mocked(apiGetConsultingType)
			.mockReset()
			.mockResolvedValue({ id: 3, isVideoCallAllowed: true } as any);
	});

	afterEach(cleanup);

	const at = (minutes: number) =>
		new Date(Date.now() + minutes * 60_000).toISOString();
	const appointmentContext = (
		chatType: string,
		startsInMinutes: number,
		extra: Partial<InviteLinkContext> = {}
	) =>
		({
			...directContext(chatType),
			accessMode: 'BOTH',
			knock: true,
			appointmentStartTime: at(startsInMinutes),
			appointmentEndTime: at(startsInMinutes + 60),
			callOpensAt: at(startsInMinutes - 15),
			expiresAt: at(startsInMinutes + 60 + 1440),
			...extra
		}) as InviteLinkContext;
	const gone = (reason: string) =>
		new Response(JSON.stringify({ reason }), { status: 410 });

	it('shows the date and "In Kalender eintragen" before the waiting room opens', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			appointmentContext('VIDEO', 20)
		);
		renderInvite();

		expect(
			await screen.findByTestId('invitation-before-start')
		).toBeTruthy();
		expect(screen.queryByTestId('direct-link-call-entry')).toBeNull();
		/* The one waiting-room frame, not a hand-built stage page. */
		expect(document.querySelector('[data-cy="entry-room"]')).toBeTruthy();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'groupChat.calendar.addThis'
			})
		);
		expect(ics.download).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining('BEGIN:VCALENDAR')
		);
	});

	it('lets the person into the chat before the call opens', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
			appointmentContext('CHAT', 20)
		);
		renderInvite();
		fireEvent.click(
			await screen.findByRole('button', {
				name: /directInvitation.entry.beforeStart.openChat/
			})
		);

		expect(await screen.findByLabelText('User-ID')).toBeTruthy();
	});

	it('lets a signed-out person into the chat of a call invitation before the call opens, without the device check', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
			appointmentContext('VIDEO', 20)
		);
		renderInvite();
		fireEvent.click(
			await screen.findByRole('button', {
				name: /directInvitation.entry.beforeStart.openChat/
			})
		);

		expect(await screen.findByLabelText('User-ID')).toBeTruthy();
		expect(screen.queryByTestId('direct-link-call-entry')).toBeNull();
	});

	/* The call opened while the person registered: the server knocks, but
	   the person chose the chat and must not land in the call's knock. */
	const knockingVideo = {
		sessionId: 60,
		matrixRoomId: '!room:oriso',
		medium: 'VIDEO' as const,
		admission: 'KNOCK' as const,
		created: true,
		knockId: 31,
		knockStatus: 'PENDING' as const
	};

	it('enters the chat, not the call knock, after "Zum Chat" and registering', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
			appointmentContext('VIDEO', 20)
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce(
			knockingVideo as any
		);
		renderInvite();
		fireEvent.click(
			await screen.findByRole('button', {
				name: /directInvitation.entry.beforeStart.openChat/
			})
		);
		await screen.findByLabelText('User-ID');
		if (screen.queryByLabelText('Ihre Postleitzahl')) typePostcode('10115');
		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(readPendingKnock()).toBeNull();
		expect(apiCancelOwnCallKnock).toHaveBeenCalledWith(31);
	});

	it('enters the chat, not the call knock, after "Zum Chat" when signed in', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
			appointmentContext('VIDEO', 20)
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce(
			knockingVideo as any
		);
		renderInvite();
		fireEvent.click(
			await screen.findByRole('button', {
				name: /directInvitation.entry.beforeStart.openChat/
			})
		);

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(readPendingKnock()).toBeNull();
		expect(apiCancelOwnCallKnock).toHaveBeenCalledWith(31);
	});

	describe('a joiner who has not agreed yet', () => {
		const joining = {
			sessionId: 70,
			matrixRoomId: '!shared:oriso',
			medium: 'CHAT' as const,
			admission: 'DIRECT' as const,
			created: false,
			appointmentConversation: true,
			consentRequired: true
		};
		const openAsJoiner = async () => {
			vi.mocked(hasActiveAuthSession).mockReturnValue(true);
			vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
				appointmentContext('CHAT', 5)
			);
			vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce(
				joining as any
			);
			renderInvite();
			return screen.findByTestId('invitation-consent');
		};
		const agree = () => {
			fireEvent.click(screen.getByRole('checkbox'));
			fireEvent.click(
				screen.getByRole('button', { name: 'groupChat.consent.accept' })
			);
		};

		it("pins the centre's version, then enters", async () => {
			vi.mocked(apiGetConsentText).mockResolvedValue({
				status: 'ok',
				consentText: { sentence: 'Ich stimme zu.', versionId: 44 }
			} as any);
			await openAsJoiner();
			expect(await screen.findByText('Ich stimme zu.')).toBeTruthy();
			expect(redirectToApp).not.toHaveBeenCalled();
			agree();

			await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
			expect(apiPutSessionConsent).toHaveBeenCalledWith(70, 44);
		});

		it('records the platform text without a version, then enters', async () => {
			vi.mocked(apiGetConsentText).mockResolvedValue({
				status: 'ok',
				consentText: null
			} as any);
			await openAsJoiner();
			agree();

			await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
			expect(apiPutSessionConsent).toHaveBeenCalledWith(70, null);
		});

		it('does not enter without agreeing', async () => {
			await openAsJoiner();
			fireEvent.click(
				screen.getByRole('button', { name: 'groupChat.consent.reject' })
			);
			expect(
				screen.getByText('directInvitation.entry.consent.rejected')
			).toBeTruthy();
			/* Not ticked: "Einverstanden" asks for the box instead. */
			fireEvent.click(
				screen.getByRole('button', { name: 'groupChat.consent.accept' })
			);
			await new Promise((resolve) => setTimeout(resolve, 20));
			expect(apiPutSessionConsent).not.toHaveBeenCalled();
			expect(redirectToApp).not.toHaveBeenCalled();
		});

		it('stays on the consent when it cannot be saved', async () => {
			vi.mocked(apiPutSessionConsent).mockRejectedValueOnce(
				new Error('down')
			);
			await openAsJoiner();
			agree();

			expect(
				await screen.findByText('groupChat.consent.saveFailed')
			).toBeTruthy();
			expect(redirectToApp).not.toHaveBeenCalled();
		});
	});

	it('opens the waiting room from 15 minutes before the start', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			appointmentContext('VIDEO', 10)
		);
		renderInvite();

		expect(
			await screen.findByTestId('direct-link-call-entry')
		).toBeTruthy();
		expect(screen.queryByTestId('invitation-before-start')).toBeNull();
	});

	it('opens the waiting room by itself when the time comes', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		try {
			vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
				appointmentContext('VIDEO', 16)
			);
			renderInvite();
			await vi.waitFor(() =>
				expect(
					screen.getByTestId('invitation-before-start')
				).toBeTruthy()
			);
			await vi.advanceTimersByTimeAsync(61_000);
			await vi.waitFor(() =>
				expect(
					screen.getByTestId('direct-link-call-entry')
				).toBeTruthy()
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('stays on the date page for an appointment more than 25 days ahead', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
		try {
			vi.mocked(apiGetInviteLinkContext).mockResolvedValue(
				appointmentContext('VIDEO', 40 * 24 * 60)
			);
			renderInvite();
			await vi.waitFor(() =>
				expect(
					screen.getByTestId('invitation-before-start')
				).toBeTruthy()
			);
			await vi.advanceTimersByTimeAsync(60_000);
			expect(screen.getByTestId('invitation-before-start')).toBeTruthy();
			expect(screen.queryByTestId('direct-link-call-entry')).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it('says the conversation could not be reached, so the person tries again', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockRejectedValueOnce(
			new Response(null, { status: 502 })
		);
		renderInvite();

		expect(
			await screen.findByText('directInvitation.entry.roomUnavailable')
		).toBeTruthy();
	});

	it('says a 1:1 without encryption takes nobody by link', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockRejectedValueOnce(
			new Response(
				JSON.stringify({
					reason: 'DIRECT_INVITATION_ROOM_NOT_ENCRYPTED'
				}),
				{ status: 409 }
			)
		);
		renderInvite();

		expect(
			await screen.findByText('directInvitation.entry.roomNotEncrypted')
		).toBeTruthy();
	});

	it('offers no account sign-in on a guests-only invitation', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce({
			...directContext('CHAT'),
			temporaryAccount: true,
			accessMode: 'GUESTS_ONLY'
		} as InviteLinkContext);
		renderInvite();

		await screen.findByLabelText('User-ID');
		expect(
			screen.queryByRole('link', {
				name: 'Sie haben schon ein Konto? Anmelden'
			})
		).toBeNull();
	});

	it('registers a permanent account on an accounts-only invitation', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce({
			...directContext('CHAT'),
			temporaryAccount: true,
			accessMode: 'ACCOUNTS_ONLY'
		} as InviteLinkContext);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 50,
			medium: 'CHAT',
			admission: 'DIRECT',
			created: true
		});
		renderInvite();

		await screen.findByLabelText('User-ID');
		expect(
			screen.getByRole('link', {
				name: 'Sie haben schon ein Konto? Anmelden'
			})
		).toBeTruthy();
		typePostcode('10115');
		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);
		await waitFor(() => expect(apiPostRegistration).toHaveBeenCalled());
		expect(vi.mocked(apiPostRegistration).mock.calls[0][1]).toMatchObject({
			temporary: false
		});
	});

	it('says which way in a signed-in person lacks', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce({
			...directContext('CHAT'),
			accessMode: 'GUESTS_ONLY'
		} as InviteLinkContext);
		vi.mocked(apiStartDirectLinkConversation).mockRejectedValueOnce(
			new Response(
				JSON.stringify({ reason: 'DIRECT_INVITATION_GUESTS_ONLY' }),
				{ status: 403 }
			)
		);
		renderInvite();

		expect(
			await screen.findByText('Dieser Link ist nur für Gäste.')
		).toBeTruthy();
	});

	it('shows "Link abgelaufen", and a signed-in person asks for a new link', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockRejectedValueOnce(
			gone('DIRECT_LINK_EXPIRED')
		);
		vi.mocked(apiRequestDirectInvitationRenewal).mockResolvedValueOnce(
			undefined
		);
		renderInvite();

		expect(await screen.findByTestId('invitation-expired')).toBeTruthy();
		expect(redeemInviteLink).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole('button', {
				name: /directInvitation.entry.expired.request/
			})
		);

		expect(
			await screen.findByText('directInvitation.entry.expired.sent')
		).toBeTruthy();
		expect(apiRequestDirectInvitationRenewal).toHaveBeenCalledWith(
			'token-123'
		);
	});

	it('says so when asking for a new link fails', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockRejectedValueOnce(
			gone('DIRECT_LINK_EXPIRED')
		);
		vi.mocked(apiRequestDirectInvitationRenewal).mockRejectedValueOnce(
			new Response(null, { status: 404 })
		);
		renderInvite();
		fireEvent.click(
			await screen.findByRole('button', {
				name: /directInvitation.entry.expired.request/
			})
		);

		/* A pop-up with a title and a close control, not a box in the page. */
		const title = await screen.findByText(
			'directInvitation.entry.expired.failedTitle'
		);
		expect(screen.getByTestId('invitation-expired').contains(title)).toBe(
			false
		);
		expect(
			screen.getByText('directInvitation.entry.expired.failed')
		).toBeTruthy();
		expect(screen.getByRole('button', { name: 'app.close' })).toBeTruthy();
	});

	it('sends a signed-out person to sign in first, then back to the link', async () => {
		vi.mocked(apiGetInviteLinkContext).mockRejectedValueOnce(
			gone('DIRECT_LINK_EXPIRED')
		);
		const assign = vi.fn();
		const original = window.location;
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...original, assign }
		});
		try {
			renderInvite();
			/* A guest without a sign-in cannot ask; the page says so. */
			expect(
				await screen.findByText(
					'directInvitation.entry.expired.signedOut'
				)
			).toBeTruthy();
			fireEvent.click(
				await screen.findByRole('button', {
					name: /directInvitation.entry.expired.signIn/
				})
			);
			expect(assign).toHaveBeenCalledWith(
				'/login?returnTo=%2Finvite%2Ftoken-123'
			);
			expect(apiRequestDirectInvitationRenewal).not.toHaveBeenCalled();
		} finally {
			Object.defineProperty(window, 'location', {
				configurable: true,
				value: original
			});
		}
	});

	it('shows the expired page when the link expires while the person registers', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockRejectedValueOnce(
			gone('DIRECT_LINK_EXPIRED')
		);
		renderInvite();

		expect(await screen.findByTestId('invitation-expired')).toBeTruthy();
	});

	it('keeps a switched-off link apart from an expired one', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockRejectedValueOnce(
			gone('DIRECT_LINK_INACTIVE')
		);
		renderInvite();

		expect(
			await screen.findByText('Dieser Link ist aktuell pausiert.')
		).toBeTruthy();
		expect(screen.queryByTestId('invitation-expired')).toBeNull();
	});
});
