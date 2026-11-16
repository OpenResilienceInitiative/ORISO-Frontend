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
		usernameEditable,
		askPostcode
	}: CallEntryRoomProps) => (
		<>
			<div>{askPostcode ? 'asks postcode' : 'no postcode'}</div>
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
						postcode: '10115',
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
	SharedCallGuest: ({
		deviceChoice
	}: {
		deviceChoice?: { controls: { micOn: boolean; cameraOn: boolean } };
	}) => (
		<>
			<div>call-only entry</div>
			<div>
				{deviceChoice
					? `mic ${deviceChoice.controls.micOn ? 'on' : 'off'}, camera ${deviceChoice.controls.cameraOn ? 'on' : 'off'}`
					: 'no device choice'}
			</div>
		</>
	)
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

describe('the postcode of a call guest (ORISO-Frontend#1795)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
	});
	afterEach(cleanup);

	it('is not asked of a temporary account, which keeps the placeholder', async () => {
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				deps={{ open: vi.fn() }}
			/>
		);
		await screen.findByText('no postcode');
		fireEvent.click(
			screen.getByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
		expect(apiPostRegistration).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ postcode: '00000' }),
			false,
			undefined,
			expect.any(Function)
		);
	});

	it('is asked of a registered account and sent along', async () => {
		render(
			<DirectLinkCallEntry
				token="direct-token"
				context={{
					...call,
					linkKind: undefined,
					temporaryAccount: false,
					hidePasswordField: false
				}}
				modality="video"
				deps={{ open: vi.fn() }}
			/>
		);
		await screen.findByText('asks postcode');
		fireEvent.click(
			screen.getByRole('button', { name: 'Agree and enter' })
		);
		await vi.waitFor(() =>
			expect(apiPostRegistration).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					postcode: '10115',
					temporary: false
				}),
				false,
				undefined,
				expect.any(Function)
			)
		);
	});

	it('is not asked of a signed-in person', async () => {
		render(
			<DirectLinkCallEntry
				token="direct-token"
				context={{ ...call, temporaryAccount: false }}
				modality="video"
				signedIn
			/>
		);
		await screen.findByText('no postcode');
	});
});

/*
 * FE#2209 live test (16 Nov): the guest picked a lamb before entering, the
 * counsellor's knock card showed a frog and the call a fox. The pick was
 * never stored; every surface derived its own animal.
 */
describe('the animal a call guest picks before entering', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(apiPostRegistration).mockResolvedValue(undefined);
	});
	afterEach(cleanup);

	it('is stored on the new account before the call opens', async () => {
		const order: string[] = [];
		vi.mocked(apiPostRegistration).mockImplementation(async () => {
			order.push('register');
		});
		const saveAvatar = vi.fn(async () => {
			order.push('avatar');
		});
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				deps={{ saveAvatar }}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
		expect(saveAvatar).toHaveBeenCalledWith('owl');
		expect(order).toEqual(['register', 'avatar']);
	});

	it('does not keep the guest out of the call when storing it fails', async () => {
		const saveAvatar = vi.fn(async () => {
			throw new Error('offline');
		});
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				deps={{ saveAvatar }}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
	});

	it("leaves a signed-in person's own animal alone", async () => {
		const saveAvatar = vi.fn();
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				signedIn
				deps={{ saveAvatar }}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('call-only entry');
		expect(saveAvatar).not.toHaveBeenCalled();
	});

	it('hands the device choice from the check on to the call', async () => {
		render(
			<DirectLinkCallEntry
				token="shared-token"
				context={call}
				modality="video"
				deps={{ saveAvatar: vi.fn() }}
			/>
		);
		fireEvent.click(
			await screen.findByRole('button', { name: 'Agree and enter' })
		);
		await screen.findByText('mic on, camera on');
	});
});
