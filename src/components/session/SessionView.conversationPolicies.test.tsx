// @vitest-environment oriso-jsdom
import * as React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { SessionView } from './SessionView';
import { useSession } from '../../hooks/useSession';
import { AUTH_SESSION_CHANGE_EVENT } from '../sessionCookie/accessSessionCookie';
import {
	canonicalAgencySettings,
	conversationAgency
} from '../../test/fixtures/conversationPolicyFixtures';
import type { TenantDataSettingsInterface } from '../../globalState/interfaces/TenantDataInterface';
import { fetchData } from '../../api/fetchData';
import {
	ActiveSessionContext,
	SessionTypeContext,
	UserDataContext
} from '../../globalState';
import { SESSION_LIST_TYPES } from './sessionHelpers';
import {
	mockActiveSession1on1,
	mockActiveSessionGroup,
	mockUserData
} from '../message/MessageItemComponent.mocks';
import { useConversationFeatureSettings } from '../../hooks/useConversationFeatureSettings';
import { resolveCallFeatureGates } from '../call/callFeatureGates';
import type { AgencyDataInterface } from '../../globalState/interfaces';

const runtimeTenant = vi.hoisted(() => {
	const settings: Partial<TenantDataSettingsInterface> = {};
	return { settings };
});
vi.mock('lottie-web', () => ({ default: {} }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../hooks/useSession', () => ({ useSession: vi.fn() }));
vi.mock('../../hooks/useResponsive', () => ({
	useResponsive: () => ({ fromL: true })
}));
vi.mock('../../api/fetchData', async (original) => ({
	...(await original<typeof import('../../api/fetchData')>()),
	fetchData: vi.fn()
}));
vi.mock('./SessionStream', () => ({
	SessionStream: () => {
		const features = useConversationFeatureSettings(runtimeTenant.settings);
		const context = React.useContext(ActiveSessionContext);
		return (
			<div>
				<output data-testid="policy-state">
					{context?.agencyFeaturePolicy?.state ?? 'legacy'}
				</output>
				<output data-testid="video-allowed">
					{String(
						resolveCallFeatureGates(features, 'oneOnOne').video
					)}
				</output>
			</div>
		);
	}
}));
const policy = {
	value: true,
	mode: 'SUGGESTED',
	inherited: false
} satisfies import('../../globalState/interfaces/ConversationFeatureSettings').AgencyFeaturePolicy;
const agency: AgencyDataInterface = {
	id: 101,
	name: 'Test agency',
	city: '',
	consultingType: 1,
	description: '',
	offline: false,
	postcode: '',
	settings: {
		permissionPolicies: {
			featureCallsEnabled: policy,
			featureVideoCallsEnabled: policy,
			featureVideoCallsOneOnOneChatsEnabled: policy
		}
	}
};
const view = () => {
	const userData = mockUserData();
	return (
		<JotaiProvider>
			<UserDataContext.Provider
				value={{
					userData,
					setUserData: () => {},
					reloadUserData: async () => userData
				}}
			>
				<SessionTypeContext.Provider
					value={{
						type: SESSION_LIST_TYPES.MY_SESSION,
						path: '/sessions/consultant/sessionView'
					}}
				>
					<MemoryRouter
						initialEntries={['/sessions/consultant/sessionView']}
					>
						<SessionView />
					</MemoryRouter>
				</SessionTypeContext.Provider>
			</UserDataContext.Provider>
		</JotaiProvider>
	);
};
beforeEach(() => {
	runtimeTenant.settings = {
		featureVideoCallsEnabled: false,
		featureVideoCallsOneOnOneChatsEnabled: false
	};
	vi.clearAllMocks();
	vi.mocked(useSession).mockReturnValue({
		session: mockActiveSession1on1(),
		ready: true,
		reload: async () => {},
		read: () => {}
	});
});
afterEach(() => {
	cleanup();
	document.cookie = 'keycloak=; Max-Age=0';
});
it('publishes the existing public-agency response to all conversation consumers', async () => {
	vi.mocked(fetchData).mockResolvedValue([agency]);
	render(view());
	await waitFor(() =>
		expect(screen.getByTestId('video-allowed').textContent).toBe('true')
	);
	expect(fetchData).toHaveBeenCalledTimes(1);
});

function deferred<T>() {
	let resolve: (value: T) => void = () => {};
	let reject: (reason: Error) => void = () => {};
	const promise = new Promise<T>((ok, fail) => {
		resolve = ok;
		reject = fail;
	});
	return { promise, resolve, reject };
}
const selectSession = (id: number, agencyId: number) => {
	const session = mockActiveSession1on1();
	vi.mocked(useSession).mockReturnValue({
		session: { ...session, item: { ...session.item, id, agencyId } },
		ready: true,
		reload: async () => {},
		read: () => {}
	});
};
it('keeps known-agency actions closed while loading and after a public API outage', async () => {
	runtimeTenant.settings = {};
	const request = deferred<AgencyDataInterface[]>();
	vi.mocked(fetchData).mockReturnValue(request.promise);
	render(view());
	await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
	expect(screen.getByTestId('policy-state').textContent).toBe('loading');
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
	await act(async () => {
		request.reject(new Error('Unavailable'));
	});
	expect(screen.getByTestId('policy-state').textContent).toBe('unavailable');
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
});
it('drops an older A response after changing agencies A to B and back to A', async () => {
	const first = deferred<AgencyDataInterface[]>();
	const last = deferred<AgencyDataInterface[]>();
	vi.mocked(fetchData)
		.mockReturnValueOnce(first.promise)
		.mockResolvedValueOnce([conversationAgency(102)])
		.mockReturnValueOnce(last.promise);
	selectSession(41, 101);
	const rendered = render(view());
	await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
	selectSession(42, 102);
	rendered.rerender(view());
	await waitFor(() =>
		expect(screen.getByTestId('policy-state').textContent).toBe('ready')
	);
	selectSession(41, 101);
	rendered.rerender(view());
	await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(3));
	await act(async () => {
		first.resolve([conversationAgency(101)]);
	});
	expect(screen.getByTestId('policy-state').textContent).toBe('loading');
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
	await act(async () => {
		last.resolve([conversationAgency(101)]);
	});
	expect(screen.getByTestId('policy-state').textContent).toBe('ready');
	expect(screen.getByTestId('video-allowed').textContent).toBe('true');
});
it('does not borrow another agency from the public response', async () => {
	vi.mocked(fetchData).mockResolvedValue([conversationAgency(999)]);
	render(view());
	await waitFor(() =>
		expect(screen.getByTestId('policy-state').textContent).toBe(
			'unavailable'
		)
	);
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
});
it('clears the old authority immediately when the authenticated tenant changes', async () => {
	const setTenant = (tenantId: number) => {
		document.cookie = `keycloak=header.${btoa(JSON.stringify({ tenantId }))}.signature`;
		window.dispatchEvent(new Event(AUTH_SESSION_CHANGE_EVENT));
	};
	setTenant(14);
	const next = deferred<AgencyDataInterface[]>();
	vi.mocked(fetchData)
		.mockResolvedValueOnce([{ ...conversationAgency(101), tenantId: 14 }])
		.mockReturnValueOnce(next.promise);
	render(view());
	await waitFor(() =>
		expect(screen.getByTestId('video-allowed').textContent).toBe('true')
	);
	act(() => setTenant(17));
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
	await act(async () => {
		next.resolve([{ ...conversationAgency(101), tenantId: 17 }]);
	});
	expect(screen.getByTestId('video-allowed').textContent).toBe('true');
});

it('rejects duplicate matching agency projections instead of selecting the first', async () => {
	vi.mocked(fetchData).mockResolvedValue([
		conversationAgency(101),
		conversationAgency(
			101,
			canonicalAgencySettings({ featureVideoCallsEnabled: false })
		)
	]);
	render(view());
	await waitFor(() => expect(fetchData).toHaveBeenCalledTimes(1));
	await waitFor(() =>
		expect(screen.getByTestId('policy-state').textContent).toBe(
			'unavailable'
		)
	);
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
});

// Members-only group participants can belong to a different Träger than the
// authorized session's stored agency. The JWT tenant scopes request lifetime.
it('uses the authorized session agency for a cross-Träger participant', async () => {
	document.cookie = `keycloak=header.${btoa(JSON.stringify({ tenantId: 14 }))}.signature`;
	vi.mocked(fetchData).mockResolvedValue([
		{ ...conversationAgency(101), tenantId: 17 }
	]);
	render(view());
	await waitFor(() =>
		expect(screen.getByTestId('video-allowed').textContent).toBe('true')
	);
	expect(screen.getByTestId('policy-state').textContent).toBe('ready');
	expect(fetchData).toHaveBeenCalledTimes(1);
});

for (const conversationType of ['SELF_HELP', 'INTERNAL_GROUP'] as const) {
	it(`loads the persisted assigned agency for the real ${conversationType} DTO shape`, async () => {
		const session = mockActiveSessionGroup();
		const { agencyId: _legacyFixtureAgencyId, ...groupItem } = session.item;
		vi.mocked(useSession).mockReturnValue({
			session: {
				...session,
				item: {
					...groupItem,
					conversationType,
					assignedAgencies: [conversationAgency(101)]
				}
			},
			ready: true,
			reload: async () => {},
			read: () => {}
		});
		vi.mocked(fetchData).mockResolvedValue([conversationAgency(101)]);
		render(view());
		await waitFor(() =>
			expect(screen.getByTestId('video-allowed').textContent).toBe('true')
		);
		expect(fetchData).toHaveBeenCalledWith(
			expect.objectContaining({
				url: expect.stringContaining('/service/agencies/101')
			})
		);
	});
}
it('keeps ambiguous multiple group agency assignments unavailable', async () => {
	const session = mockActiveSessionGroup();
	const { agencyId: _legacyFixtureAgencyId, ...groupItem } = session.item;
	vi.mocked(useSession).mockReturnValue({
		session: {
			...session,
			item: {
				...groupItem,
				assignedAgencies: [
					conversationAgency(101),
					conversationAgency(102)
				]
			}
		},
		ready: true,
		reload: async () => {},
		read: () => {}
	});
	render(view());
	expect(screen.getByTestId('policy-state').textContent).toBe('unavailable');
	expect(screen.getByTestId('video-allowed').textContent).toBe('false');
	expect(fetchData).not.toHaveBeenCalledWith(
		expect.objectContaining({
			url: expect.stringContaining('/service/agencies/')
		})
	);
});
