// @vitest-environment oriso-jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { apiPostRegistration } from '../../api/apiPostRegistration';
import { TenantContext } from '../../globalState';
import type { InviteLinkContext } from '../../api/apiGetInviteLinkContext';
import type { CallEntryRoomProps } from '../waitingRoom/callEntry/CallEntryRoom';
import { DirectLinkCallEntry } from './DirectLinkCallEntry';

vi.mock('../../api/apiPostRegistration', () => ({
	apiPostRegistration: vi.fn()
}));
vi.mock('../../api/apiGetConsentText', () => ({
	apiGetConsentText: vi.fn(async () => ({
		status: 'ok',
		consentText: { sentence: 'Department consent', versionId: 1 }
	}))
}));
vi.mock('../waitingRoom/useConsentContext', () => ({
	useConsentContext: () => ({ context: {}, pending: false })
}));
vi.mock('../waitingRoom/useConsentSentences', () => ({
	useConsentSentences: () => ({
		platformHtml: 'Platform consent',
		missingPolicyHtml: 'No department policy',
		legalLinksHtml: ''
	})
}));
vi.mock('../waitingRoom/callEntry/useLiveCallDevices', () => ({
	useLiveCallDevices: () => ({
		devices: { camera: [], microphone: [], speaker: [] },
		micLevel: 0
	})
}));
vi.mock('../waitingRoom/callEntry/CallEntryRoom', () => ({
	CallEntryRoom: ({
		onJoin,
		signedIn,
		hidePassword,
		consent,
		usernameEditable
	}: CallEntryRoomProps) => (
		<>
			<div>{usernameEditable ? 'typed names' : 'generated names'}</div>
			<div>
				{signedIn
					? 'existing account'
					: hidePassword
						? 'temporary account'
						: 'new account'}
			</div>
			<div>{consent && consent.html}</div>
			<button
				onClick={() =>
					onJoin?.({
						username: 'test-guest',
						password: 'secret-123',
						identity: {
							displayName: 'Test Guest',
							animalLabel: 'owl',
							name: 'Test',
							avatar: {
								file: 'owl.svg',
								bg: '#eee',
								iconColor: '#333'
							}
						}
					})
				}
			>
				Agree and enter
			</button>
		</>
	)
}));
vi.mock('../app/AuthenticatedApp', () => ({
	AuthenticatedApp: ({ content }: { content: React.ReactNode }) => (
		<>{content}</>
	)
}));
vi.mock('./SharedCallGuest', () => ({
	SharedCallGuest: () => <div>call-only entry</div>
}));
vi.mock('../anonymousChat/entryRoom/EntryRoomShell', () => ({
	EntryRoomShell: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	)
}));
vi.mock('../app/Loading', () => ({ Loading: () => null }));
vi.mock('../auth/auth', () => ({ hasActiveAuthSession: () => false }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));

const call: InviteLinkContext = {
	linkKind: 'CALL',
	tenantId: 7,
	agencyId: 2,
	consultingTypeId: 5,
	topicId: 3,
	chatType: 'VIDEO',
	temporaryAccount: true,
	hidePasswordField: true
};

const renderWithSettings = (settings: Record<string, boolean>) =>
	render(
		<TenantContext.Provider
			value={
				{ tenant: { settings }, setTenant: () => undefined } as never
			}
		>
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
			/>
		</TenantContext.Provider>
	);

describe('the User-ID of a call guest', () => {
	afterEach(cleanup);

	it('can be typed where the counselling name rule allows it', async () => {
		renderWithSettings({});
		await screen.findByText('typed names');
	});

	it.each([
		'featureDisplayNameEditable',
		'featureDisplayNameEditableAgencyCounsellingEnabled'
	])('is generated only when %s is off', async (setting) => {
		renderWithSettings({ [setting]: false });
		await screen.findByText('generated names');
	});

	it('follows the counselling rule, not the live chat one', async () => {
		renderWithSettings({
			featureDisplayNameEditableLiveChatEnabled: false
		});
		await screen.findByText('typed names');
	});
});

describe('entry before a shared call', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
	});
	afterEach(cleanup);

	it('registers a temporary account for this CALL token only after consent', async () => {
		const open = vi.fn();
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				deps={{ open }}
			/>
		);
		await screen.findByText('Department consent');
		await screen.findByText('temporary account');
		expect(apiPostRegistration).not.toHaveBeenCalled();
		fireEvent.click(
			screen.getByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
		expect(apiPostRegistration).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				directLinkToken: 'shared-token',
				temporary: true,
				termsAccepted: 'true',
				agencyId: '2',
				consultingType: '5',
				mainTopicId: '3'
			}),
			false,
			undefined,
			expect.any(Function)
		);
		expect(open).not.toHaveBeenCalled();
	});

	it('takes a signed-in person to the same call entry without registration', async () => {
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				signedIn
			/>
		);
		await screen.findByText('existing account');
		fireEvent.click(
			screen.getByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
		expect(apiPostRegistration).not.toHaveBeenCalled();
	});

	it('requires sign-in when there is no department for registration', async () => {
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={{ ...call, agencyId: null }}
				modality="video"
			/>
		);
		const login = await screen.findByRole('link', {
			name: 'directLink.entry.haveAccount'
		});
		expect(login.getAttribute('href')).toBe(
			'/login?returnTo=%2Finvite%2Fshared-token'
		);
		expect(screen.queryByText('temporary account')).toBeNull();
	});
});
