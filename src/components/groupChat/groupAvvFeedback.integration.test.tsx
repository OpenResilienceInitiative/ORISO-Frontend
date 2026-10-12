// @vitest-environment jsdom
import * as React from 'react';
import { useContext, useEffect, useState } from 'react';
import {
	act,
	cleanup,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vitest';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import en from '../../resources/i18n/en/common.json';
import de from '../../resources/i18n/de/common.json';
import { CircleSettingsView } from '../conversationCreate/circle/CircleSettingsView';
import { SessionsDataProvider } from '../../globalState/provider/SessionsDataProvider';
import { UserDataProvider } from '../../globalState/provider/UserDataProvider';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import {
	TenantProvider,
	TenantContext
} from '../../globalState/provider/TenantProvider';
import {
	NotificationsProvider,
	NotificationsContext
} from '../../globalState/provider/NotificationsProvider';
import { Notifications } from '../notifications/Notifications';
import { usePendingGroupChatJoin } from '../../hooks/usePendingGroupChatJoin';
import { GroupEntryRoom } from './entryRoom/GroupEntryRoom';
import {
	ConsultingTypesProvider,
	ConsultingTypesContext
} from '../../globalState/provider/ConsultingTypesProvider';
import { TopicsProvider } from '../../globalState/provider/TopicsProvider';
import { LocaleContext } from '../../globalState/context/LocaleContext';
import { AgencySpecificContext } from '../../globalState/provider/AgencySpecificProvider';
import { AppConfigContext } from '../../globalState/provider/AppConfigProvider';
import { config } from '../../resources/scripts/config';
import { JoinGroupChatView } from './JoinGroupChatView';
import { ActiveSessionProvider } from '../../globalState/provider/ActiveSessionProvider';
import { MatrixClientProvider } from '../../globalState/context/MatrixClientContext';
import { SessionTypeProvider } from '../../globalState/provider/SessionTypeProvider';
import { buildExtendedSession } from '../../globalState/helpers/stateHelpers';
import { SESSION_LIST_TYPES } from '../session/sessionHelpers';
import { ModalProvider } from '../../globalState/provider/ModalProvider';

// jsdom's canvas boundary is absent; all application components remain real.
const canvas = vi.hoisted(() => {
	const original = HTMLCanvasElement.prototype.getContext;
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
	return { original };
});

class BrowserRequest extends Request {
	constructor(input: RequestInfo | URL, init?: RequestInit) {
		super(input, { ...init, signal: undefined });
	}
}

const i18n = createInstance().use(initReactI18next);
let overlayHost: HTMLDivElement;
const tenant = { id: 41, settings: { featureGroupChatV2Enabled: true } };
const asker = {
	userId: 'synthetic-asker',
	userName: 'synthetic-asker',
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT']
};

const PrepareProviders = ({
	children,
	user = asker
}: {
	children: React.ReactNode;
	user?: typeof asker;
}) => {
	const { setTenant } = useContext(TenantContext);
	const { userData, setUserData } = useContext(UserDataContext);
	useEffect(() => {
		setTenant(tenant as Parameters<typeof setTenant>[0]);
		setUserData(user);
	}, [setTenant, setUserData, user]);
	return userData ? <>{children}</> : null;
};
const PrepareConsultingTypes = ({
	children
}: {
	children: React.ReactNode;
}) => {
	const { consultingTypes, setConsultingTypes } = useContext(
		ConsultingTypesContext
	);
	useEffect(() => {
		setConsultingTypes([]);
	}, [setConsultingTypes]);
	return consultingTypes ? <>{children}</> : null;
};
const ReaderProviders = ({ children }: { children: React.ReactNode }) => (
	<AppConfigContext.Provider value={config}>
		<LocaleContext.Provider
			value={{
				locale: i18n.language,
				initLocale: i18n.language,
				locales: ['en', 'de'],
				selectableLocales: ['en', 'de'],
				setLocale: (locale) => {
					void i18n.changeLanguage(locale);
				}
			}}
		>
			<AgencySpecificContext.Provider
				value={{ specificAgency: null, setSpecificAgency: () => {} }}
			>
				<ConsultingTypesProvider>
					<PrepareConsultingTypes>
						<TopicsProvider>{children}</TopicsProvider>
					</PrepareConsultingTypes>
				</ConsultingTypesProvider>
			</AgencySpecificContext.Provider>
		</LocaleContext.Provider>
	</AppConfigContext.Provider>
);
const VisibleNotifications = () => {
	const { notifications } = useContext(NotificationsContext);
	return <Notifications notifications={notifications} />;
};
const RouteLocation = () => {
	const location = useLocation();
	return <output aria-label="Current route">{location.pathname}</output>;
};
const PendingAssignment = () => {
	const { userData } = useContext(UserDataContext);
	usePendingGroupChatJoin(userData);
	return null;
};
const ChangeTenant = () => {
	const { setTenant } = useContext(TenantContext);
	return (
		<button
			onClick={() =>
				setTenant({ ...tenant, id: 43 } as Parameters<
					typeof setTenant
				>[0])
			}
		>
			Change tenant
		</button>
	);
};
const WaitingSession = ({ active }: { active: boolean }) => {
	const [reloads, setReloads] = useState(0);
	const session = buildExtendedSession(
		{
			chat: {
				id: 19,
				active,
				topic: 'Synthetic support',
				matrixRoomId: '!synthetic:example.invalid',
				hintMessage: 'Synthetic welcome',
				sourceLanguage: 'en'
			}
		} as Parameters<typeof buildExtendedSession>[0],
		null
	);
	return (
		<MatrixClientProvider>
			<SessionTypeProvider type={SESSION_LIST_TYPES.MY_SESSION}>
				<ActiveSessionProvider
					activeSession={session}
					reloadActiveSession={() => setReloads((value) => value + 1)}
				>
					<JoinGroupChatView />
					<output aria-label="Successful session reloads">
						{reloads}
					</output>
				</ActiveSessionProvider>
			</SessionTypeProvider>
		</MatrixClientProvider>
	);
};
const renderWithProviders = (
	children: React.ReactNode,
	route = '/sessions/user/view',
	user = asker
) =>
	render(
		<I18nextProvider i18n={i18n}>
			<MemoryRouter initialEntries={[route]}>
				<SessionsDataProvider>
					<TenantProvider>
						<UserDataProvider>
							<NotificationsProvider>
								<ModalProvider>
									<PrepareProviders user={user}>
										{children}
										<VisibleNotifications />
										<RouteLocation />
									</PrepareProviders>
								</ModalProvider>
							</NotificationsProvider>
						</UserDataProvider>
					</TenantProvider>
				</SessionsDataProvider>
			</MemoryRouter>
		</I18nextProvider>
	);

beforeEach(async () => {
	localStorage.clear();
	sessionStorage.clear();
	document.cookie = 'keycloak=; Max-Age=0';
	window.history.replaceState(null, '', '/sessions/user/view');
	vi.stubGlobal('Request', BrowserRequest);
	vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
	overlayHost = document.createElement('div');
	overlayHost.id = 'overlay';
	document.body.append(overlayHost);
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
		() => [{ width: 100, height: 40 }] as unknown as DOMRectList
	);
	await i18n.init({
		lng: 'en',
		fallbackLng: 'en',
		defaultNS: 'common',
		resources: { en: { common: en }, de: { common: de } },
		interpolation: { escapeValue: false }
	});
});
afterEach(() => {
	cleanup();
	overlayHost.remove();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
afterAll(() => {
	HTMLCanvasElement.prototype.getContext = canvas.original;
});

const failures = [
	[
		403,
		'DPA_NEW_COUNSELLING_NOT_ALLOWED',
		'en',
		'New counselling is currently restricted'
	],
	[502, 'DPA_POLICY_UNAVAILABLE', 'de', 'Beratung derzeit nicht prüfbar']
] as const;

describe('group AVV feedback at the real provider and HTTP boundaries', () => {
	it.each(['success', 'tenant change'] as const)(
		'keeps one assignment notice when the reason changes, then clears it on %s',
		async (outcome) => {
			window.history.replaceState(
				null,
				'',
				'/sessions/user/view?gcid=19.Ab3_x-Yz'
			);
			const requests: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(new URL(request.url).pathname).toBe(
						'/service/users/chat/19/assign'
					);
					expect(request.method).toBe('PUT');
					requests.push(request.url);
					if (requests.length === 1)
						return new Response('', {
							status: 403,
							headers: {
								'X-Reason': 'DPA_NEW_COUNSELLING_NOT_ALLOWED'
							}
						});
					if (requests.length === 2)
						return new Response('', {
							status: 502,
							headers: { 'X-Reason': 'DPA_POLICY_UNAVAILABLE' }
						});
					return new Response(null, { status: 204 });
				})
			);
			renderWithProviders(
				<>
					<PendingAssignment />
					<ChangeTenant />
				</>
			);
			const user = userEvent.setup();
			const refused = await screen.findByRole('alert');
			expect(
				within(refused).getByText(
					'New counselling is currently restricted'
				)
			).toBeTruthy();
			await user.click(
				within(refused).getByRole('button', {
					name: i18n.t('groupChat.loadError.retry')
				})
			);
			await screen.findByText(
				'Counselling availability cannot be checked'
			);
			expect(screen.getAllByRole('alert')).toHaveLength(1);
			expect(
				screen.queryByText('New counselling is currently restricted')
			).toBeNull();
			if (outcome === 'success') {
				await user.click(
					within(screen.getByRole('alert')).getByRole('button', {
						name: i18n.t('groupChat.loadError.retry')
					})
				);
				await waitFor(() =>
					expect(
						screen.getByLabelText('Current route').textContent
					).toBe('/groups/19/entry')
				);
				expect(requests).toHaveLength(3);
				expect(requests.every((url) => url === requests[0])).toBe(true);
			} else {
				await user.click(
					screen.getByRole('button', { name: 'Change tenant' })
				);
				expect(requests).toHaveLength(2);
				expect(screen.getByLabelText('Current route').textContent).toBe(
					'/sessions/user/view'
				);
			}
			await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
		}
	);

	it('ignores an assignment response after the tenant changes', async () => {
		window.history.replaceState(
			null,
			'',
			'/sessions/user/view?gcid=19.Ab3_x-Yz'
		);
		let release: (response: Response) => void;
		const response = new Promise<Response>((resolve) => {
			release = resolve;
		});
		const http = vi.fn(async (request: Request) => {
			expect(new URL(request.url).pathname).toBe(
				'/service/users/chat/19/assign'
			);
			return response;
		});
		vi.stubGlobal('fetch', http);
		renderWithProviders(
			<>
				<PendingAssignment />
				<ChangeTenant />
			</>
		);
		await waitFor(() => expect(http).toHaveBeenCalledTimes(1));
		await userEvent
			.setup()
			.click(screen.getByRole('button', { name: 'Change tenant' }));
		await act(async () => {
			release(new Response(null, { status: 204 }));
			await response;
		});
		await waitFor(() => expect(http).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText('Current route').textContent).toBe(
			'/sessions/user/view'
		);
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it.each([403, 409])(
		'preserves entry-room handling of ordinary assignment HTTP%s',
		async (status) => {
			window.history.replaceState(
				null,
				'',
				'/sessions/user/view?gcid=19.Ab3_x-Yz'
			);
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(
						new URL(request.url).searchParams.get('inviteToken')
					).toBe('Ab3_x-Yz');
					return new Response('', { status });
				})
			);
			renderWithProviders(<PendingAssignment />);
			await waitFor(() =>
				expect(screen.getByLabelText('Current route').textContent).toBe(
					'/groups/19/entry'
				)
			);
			expect(screen.queryByRole('alert')).toBeNull();
		}
	);

	it.each(
		failures.flatMap((failure) =>
			['start', 'join'].map((command) => [...failure, command] as const)
		)
	)(
		'keeps the waiting session on HTTP%s/%s in %s (%s), command %s',
		async (status, reason, locale, title, command) => {
			await i18n.changeLanguage(locale);
			const active = command === 'join';
			const user = active
				? asker
				: {
						...asker,
						userId: 'synthetic-moderator',
						grantedAuthorities: [
							'AUTHORIZATION_CONSULTANT_DEFAULT',
							'AUTHORIZATION_CREATE_NEW_CHAT'
						]
					};
			const requests: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					const path = new URL(request.url).pathname;
					if (
						request.method === 'GET' &&
						path === '/service/topic/public'
					)
						return Response.json([]);
					if (
						request.method === 'GET' &&
						path === '/service/users/chat/19'
					)
						return Response.json({ id: 19, active });
					expect(path).toBe(`/service/users/chat/19/${command}`);
					expect(request.method).toBe('PUT');
					requests.push(request.url);
					return new Response('', {
						status,
						headers: { 'X-Reason': reason }
					});
				})
			);
			renderWithProviders(
				<ReaderProviders>
					<WaitingSession active={active} />
				</ReaderProviders>,
				'/sessions/user/view',
				user
			);
			const submit = await screen.findByRole('button', {
				name: i18n.t(`groupChat.join.button.label.${command}`)
			});
			const actor = userEvent.setup();
			await actor.click(submit);
			const notice = await screen.findByRole('alert');
			expect(within(notice).getByText(title)).toBeTruthy();
			expect(
				screen.getByLabelText('Successful session reloads').textContent
			).toBe('0');
			expect(screen.getByLabelText('Current route').textContent).toBe(
				'/sessions/user/view'
			);
			await actor.click(
				within(notice).getByRole('button', {
					name: i18n.t('app.close')
				})
			);
			await actor.click(submit);
			await waitFor(() => expect(requests).toHaveLength(2));
			expect(requests[1]).toBe(requests[0]);
			expect(
				screen.getByLabelText('Successful session reloads').textContent
			).toBe('0');
		}
	);

	it.each(failures)(
		'keeps the entry room and unlocks Join after HTTP%s',
		async (status, reason, locale, title) => {
			await i18n.changeLanguage(locale);
			const requests: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					const path = new URL(request.url).pathname;
					if (
						request.method === 'GET' &&
						path === '/service/topic/public'
					)
						return Response.json([]);
					if (
						request.method === 'GET' &&
						path === '/service/users/sessions/askers'
					)
						return Response.json({
							sessions: [
								{
									chat: {
										id: 19,
										active: true,
										topic: 'Synthetic support',
										matrixRoomId:
											'!synthetic:example.invalid',
										hintMessage: 'Synthetic welcome',
										sourceLanguage: 'en'
									}
								}
							]
						});
					if (
						request.method === 'GET' &&
						path === '/service/users/chat/19'
					)
						return Response.json({ id: 19, active: true });
					expect(path).toBe('/service/users/chat/19/join');
					expect(request.method).toBe('PUT');
					requests.push(request.url);
					return new Response('', {
						status,
						headers: { 'X-Reason': reason }
					});
				})
			);
			renderWithProviders(
				<ReaderProviders>
					<Routes>
						<Route
							path="/groups/:chatId/entry"
							element={<GroupEntryRoom />}
						/>
					</Routes>
				</ReaderProviders>,
				'/groups/19/entry'
			);
			const join = await screen.findByRole('button', {
				name: i18n.t('groupChat.entry.join')
			});
			const user = userEvent.setup();
			await user.click(join);
			const notice = await screen.findByRole('alert');
			expect(within(notice).getByText(title)).toBeTruthy();
			await waitFor(() =>
				expect((join as HTMLButtonElement).disabled).toBe(false)
			);
			expect(screen.getByLabelText('Current route').textContent).toBe(
				'/groups/19/entry'
			);
			await user.click(
				within(notice).getByRole('button', {
					name: i18n.t('app.close')
				})
			);
			await user.click(join);
			await waitFor(() => expect(requests).toHaveLength(2));
			expect(requests[1]).toBe(requests[0]);
		}
	);

	it.each(failures)(
		'retains the invitation for explicit assignment retry after HTTP%s',
		async (status, reason, locale, title) => {
			await i18n.changeLanguage(locale);
			window.history.replaceState(
				null,
				'',
				'/sessions/user/view?gcid=19.Ab3_x-Yz'
			);
			const requests: string[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(request.method).toBe('PUT');
					expect(new URL(request.url).pathname).toBe(
						'/service/users/chat/19/assign'
					);
					requests.push(request.url);
					return requests.length === 1
						? new Response('', {
								status,
								headers: { 'X-Reason': reason }
							})
						: new Response(null, { status: 204 });
				})
			);
			renderWithProviders(<PendingAssignment />);
			const notice = await screen.findByRole('alert');
			expect(within(notice).getByText(title)).toBeTruthy();
			expect(screen.getByLabelText('Current route').textContent).toBe(
				'/sessions/user/view'
			);
			expect(requests).toHaveLength(1);
			await userEvent.setup().click(
				within(notice).getByRole('button', {
					name: i18n.t('groupChat.loadError.retry')
				})
			);
			await waitFor(() =>
				expect(screen.getByLabelText('Current route').textContent).toBe(
					'/groups/19/entry'
				)
			);
			expect(requests).toHaveLength(2);
			expect(requests[1]).toBe(requests[0]);
			expect(new URL(requests[1]).searchParams.get('inviteToken')).toBe(
				'Ab3_x-Yz'
			);
			await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
		}
	);

	it.each(
		failures.flatMap((failure) =>
			['create', 'update'].map(
				(command) => [...failure, command] as const
			)
		)
	)(
		'retains a circle draft on HTTP%s/%s in %s (%s), command %s',
		async (status, reason, locale, title, command) => {
			await i18n.changeLanguage(locale);
			const requests: unknown[] = [];
			vi.stubGlobal(
				'fetch',
				vi.fn(async (request: Request) => {
					expect(new URL(request.url).pathname).toBe(
						command === 'create'
							? '/service/users/chat/v2/new'
							: '/service/users/chat/19/update'
					);
					expect(request.method).toBe(
						command === 'create' ? 'POST' : 'PUT'
					);
					requests.push(await request.json());
					return new Response('', {
						status,
						headers: { 'X-Reason': reason }
					});
				})
			);
			renderWithProviders(
				<CircleSettingsView
					editChatId={command === 'update' ? 19 : undefined}
					agencyOptions={[{ value: '42', label: 'Synthetic centre' }]}
					selectedAgency={42}
					onAgencyChange={() => {}}
					activeLanguages={['en']}
					translationAvailable={false}
					prefill={{
						topic: 'Synthetic support',
						startDate: '2026-10-01',
						startTime: '10:00',
						duration: 90,
						repeatCount: 2,
						consultantIds: ['synthetic-colleague']
					}}
				/>
			);
			const user = userEvent.setup();
			const welcome = screen.getByRole('textbox', {
				name: i18n.t('groupChat.create.authorContent.welcome')
			});
			await user.type(welcome, 'Changed synthetic welcome');
			const submit = screen.getByRole('button', {
				name: i18n.t(
					command === 'create'
						? 'groupChat.circle.createLabel'
						: 'groupChat.circle.saveLabel'
				)
			});
			await user.click(submit);
			const notice = await screen.findByRole('alert');
			expect(within(notice).getByText(title)).toBeTruthy();
			await waitFor(() =>
				expect((submit as HTMLButtonElement).disabled).toBe(false)
			);
			expect((welcome as HTMLTextAreaElement).value).toBe(
				'Changed synthetic welcome'
			);
			expect(screen.getByLabelText('Current route').textContent).toBe(
				'/sessions/user/view'
			);
			await user.click(
				within(notice).getByRole('button', {
					name: i18n.t('app.close')
				})
			);
			await user.click(submit);
			await waitFor(() => expect(requests).toHaveLength(2));
			expect(requests[0]).toMatchObject({
				topic: 'Synthetic support',
				startDate: '2026-10-01',
				startTime: '10:00',
				duration: 90,
				repeatCount: 2,
				consultantIds: ['synthetic-colleague'],
				hintMessage: 'Changed synthetic welcome'
			});
			expect(requests[1]).toEqual(requests[0]);
		}
	);
});
