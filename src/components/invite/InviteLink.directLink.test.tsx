// @vitest-environment oriso-jsdom

import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { redeemInviteLink } from '../../api/apiRedeemInviteLink';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { LocaleContext, TenantContext } from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { autoLogin, redirectToApp } from '../registration/autoLogin';
import { apiGetInviteLinkContext } from '../../api/apiGetInviteLinkContext';
import { directLinkRegistration } from '../directLinkEntry/directLinkRegistration';

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
vi.mock('./inviteLinkHelpers', () => ({
	applyRedeemSessionCredentials: vi.fn(),
	assignInviteSessionDisplayName: vi.fn(),
	redirectToInviteSession: vi.fn()
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
		'directLink.entry.haveAccount': 'Sie haben schon ein Konto? Anmelden',
		'inviteLink.resume.retry': 'Erneut versuchen',
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
	return { ...actual, apiStartDirectLinkConversation: vi.fn() };
});
vi.mock('../auth/auth', async () => {
	const actual =
		await vi.importActual<typeof import('../auth/auth')>('../auth/auth');
	return { ...actual, hasActiveAuthSession: vi.fn(() => false) };
});
vi.mock('../directLinkEntry/DirectLinkCallEntry', () => ({
	DirectLinkCallEntry: (props: any) => (
		<div data-testid="direct-link-call-entry">{props.modality}</div>
	)
}));
vi.mock('../app/Loading', () => ({
	Loading: () => <div data-testid="loading" />
}));

const { InviteLink } = await import('./InviteLink');
const { apiStartDirectLinkConversation } = await import(
	'../../api/apiDirectLinks'
);
const { hasActiveAuthSession } = await import('../auth/auth');
const { readPendingKnock } = await import(
	'../directLinkEntry/directLinkEntryFlow'
);

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

const directContext = (chatType: string) => ({
	tenantId: 1,
	agencyId: 7,
	consultingTypeId: 3,
	topicId: 11,
	chatType,
	temporaryAccount: chatType !== 'CHAT',
	admission: chatType === 'CHAT' ? 'DIRECT' : 'KNOCK'
});

describe('InviteLink with a counsellor direct link (#1795)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
		vi.mocked(hasActiveAuthSession).mockReturnValue(false);
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
	});

	it('takes a signed-in person straight into their own chat', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 42,
			medium: 'CHAT',
			admission: 'DIRECT',
			created: true
		});
		renderInvite();

		await waitFor(() =>
			expect(redirectToApp).toHaveBeenCalledWith(undefined, {
				sessionId: 42
			})
		);
		expect(apiStartDirectLinkConversation).toHaveBeenCalledWith(
			'token-123'
		);
		expect(redeemInviteLink).not.toHaveBeenCalled();
		expect(apiPostRegistration).not.toHaveBeenCalled();
	});

	it('hands a signed-in caller’s knock to the app', async () => {
		vi.mocked(hasActiveAuthSession).mockReturnValue(true);
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('AUDIO') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 42,
			matrixRoomId: '!r:oriso',
			medium: 'AUDIO',
			admission: 'KNOCK',
			created: true,
			knockId: 5,
			knockStatus: 'PENDING'
		});
		renderInvite();

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		expect(readPendingKnock()).toMatchObject({
			knockId: 5,
			sessionId: 42,
			medium: 'AUDIO'
		});
		expect(screen.queryByTestId('direct-link-call-entry')).toBeNull();
	});

	it('opens the call entry for a call guest without an account', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('VIDEO') as any
		);
		renderInvite();

		expect(
			(await screen.findByTestId('direct-link-call-entry')).textContent
		).toBe('video');
		expect(apiStartDirectLinkConversation).not.toHaveBeenCalled();
		expect(redeemInviteLink).not.toHaveBeenCalled();
	});

	it('lets a chat guest create an account, then opens the conversation', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 43,
			medium: 'CHAT',
			admission: 'DIRECT',
			created: true
		});
		renderInvite();

		await screen.findByLabelText('User-ID');
		const login = screen.getByRole('link', {
			name: 'Sie haben schon ein Konto? Anmelden'
		});
		expect(login.getAttribute('href')).toBe(
			'/login?returnTo=%2Finvite%2Ftoken-123'
		);
		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);

		await waitFor(() =>
			expect(redirectToApp).toHaveBeenCalledWith(undefined, {
				sessionId: 43
			})
		);
		expect(apiPostRegistration).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				agencyId: '7',
				consultingType: '3',
				mainTopicId: '11',
				// ORISO-UserService#1486: the link and its temporary flag go along.
				directLinkToken: 'token-123',
				temporary: false
			}),
			false,
			tenantValue.tenant,
			expect.any(Function)
		);
		expect(redeemInviteLink).not.toHaveBeenCalled();
	});

	it('hides the password of a temporary chat guest when the platform says so', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce({
			...directContext('CHAT'),
			temporaryAccount: true,
			hidePasswordField: true,
			messageRetention: 'GUEST_DECIDES'
		} as any);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 44,
			medium: 'CHAT',
			admission: 'DIRECT',
			created: true
		});
		renderInvite();

		await screen.findByLabelText('User-ID');
		expect(screen.queryByLabelText('Passwort')).toBeNull();
		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);
		await waitFor(() =>
			expect(redirectToApp).toHaveBeenCalledWith(undefined, {
				sessionId: 44
			})
		);
		// The account still gets the generated password.
		const body = vi.mocked(apiPostRegistration).mock.calls[0][1] as any;
		expect(body).toMatchObject({
			directLinkToken: 'token-123',
			temporary: true
		});
		expect(body.password.length).toBeGreaterThan(8);
	});

	it('sends a chat link the same registration as a call link', async () => {
		const context = { ...directContext('CHAT'), agencyId: null };
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			context as any
		);
		vi.mocked(apiStartDirectLinkConversation).mockResolvedValueOnce({
			sessionId: 45,
			medium: 'CHAT',
			admission: 'DIRECT',
			created: true
		});
		renderInvite();
		await screen.findByLabelText('User-ID');
		fireEvent.click(
			screen.getByRole('button', { name: 'Weiter mit Auswahl' })
		);
		await waitFor(() => expect(apiPostRegistration).toHaveBeenCalled());
		const body = vi.mocked(apiPostRegistration).mock.calls[0][1] as any;
		expect(body).toEqual(
			directLinkRegistration(
				context as any,
				body,
				body.preferredLanguage,
				'token-123'
			)
		);
	});

	it('shows the password field when the platform does not hide it', async () => {
		vi.mocked(apiGetInviteLinkContext).mockResolvedValueOnce(
			directContext('CHAT') as any
		);
		renderInvite();
		await screen.findByLabelText('User-ID');
		expect(screen.getByLabelText('Passwort')).toBeTruthy();
	});

	it('says a switched-off link is no longer active', async () => {
		vi.mocked(apiGetInviteLinkContext).mockRejectedValueOnce(
			new Response('{"reason":"DIRECT_LINK_INACTIVE"}', { status: 410 })
		);
		renderInvite();

		expect(
			await screen.findByText('Dieser Link ist nicht mehr aktiv.')
		).toBeTruthy();
		expect(redeemInviteLink).not.toHaveBeenCalled();
	});
});
