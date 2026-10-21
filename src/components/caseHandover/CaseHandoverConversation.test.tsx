import { apiDecideCaseHandoverClientConsent } from '../../api/apiCaseHandover';
// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { UserDataContext } from '../../globalState/context/UserDataContext';
import { TenantContext } from '../../globalState/provider/TenantProvider';
import type { TenantDataInterface } from '../../globalState/interfaces/TenantDataInterface';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { CaseHandoverConversation } from './CaseHandoverConversation';
import { StandingAccessSettings } from './StandingAccessSettings';
import { useStandingAccessPreference } from './useStandingAccessPreference';
import { notificationSettingsStore } from '../../utils/notificationSettings/store';
import { UserDataInterface } from '../../globalState/interfaces/UserDataInterface';

vi.hoisted(() => {
	HTMLCanvasElement.prototype.getContext = (() => ({
		fillStyle: '',
		fillRect() {}
	})) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
const { patch, request, putEmail } = vi.hoisted(() => ({
	patch: vi.fn(),
	request: vi.fn(),
	putEmail: vi.fn()
}));
vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: patch }));
vi.mock('../../api', () => ({
	apiPutEmail: putEmail,
	FETCH_ERRORS: {},
	X_REASON: {}
}));
vi.mock('lottie-web', () => ({
	default: {
		loadAnimation: () => ({
			destroy() {},
			addEventListener() {},
			play() {},
			stop() {}
		})
	}
}));
vi.mock('focus-trap-react', () => ({
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: unknown) =>
			typeof fallback === 'string' ? fallback : key
	})
}));
const account = {
	email: 'asker@example.org',
	emailNotifications: {
		emailNotificationsEnabled: false,
		settings: {
			newChatMessageNotificationEnabled: false,
			appointmentNotificationEnabled: false
		}
	}
} as UserDataInterface;
let saved: UserDataInterface;
let futurePreference = false;
let rejectPreferenceReadback = false;
let httpRequests: { method: string; url: string; body?: unknown }[] = [];
const approve = vi.fn();
const decline = vi.fn();
function setup(
	initial = account,
	isEmailEnabled?: boolean,
	conversationType?: string,
	contextSettings: Record<string, boolean> = {},
	card: Partial<React.ComponentProps<typeof CaseHandoverConversation>> = {}
) {
	const TestAccount = ({
		sessionKey = '1',
		emailEnabled = isEmailEnabled
	}: {
		sessionKey?: string;
		emailEnabled?: boolean;
	}) => {
		const [userData, setUserData] = React.useState(initial);
		const reloadUserData = async () => {
			setUserData(saved);
			return saved;
		};
		return (
			<UserDataContext.Provider
				value={{ userData, reloadUserData, setUserData }}
			>
				<TenantContext.Provider
					value={{
						tenant: {
							settings: {
								featureAskerEmailEnabled: emailEnabled,
								...contextSettings
							}
						} as TenantDataInterface,
						setTenant: () => {},
						updateTenantSettings: () => {}
					}}
				>
					<ModalProvider>
						<CaseHandoverConversation
							sessionId={Number(sessionKey)}
							key={sessionKey}
							conversationType={conversationType}
							onApprove={() => {
								approve();
								void apiDecideCaseHandoverClientConsent(
									Number(sessionKey),
									88,
									true
								);
							}}
							onDecline={() => {
								decline();
								void apiDecideCaseHandoverClientConsent(
									Number(sessionKey),
									88,
									false
								);
							}}
							consentGranted={false}
							{...card}
						/>
					</ModalProvider>
				</TenantContext.Provider>
			</UserDataContext.Provider>
		);
	};
	const view = render(<TestAccount />);
	return {
		...view,
		switchSession: (id: string) =>
			view.rerender(<TestAccount sessionKey={id} />),
		disableEmail: () => view.rerender(<TestAccount emailEnabled={false} />)
	};
}
beforeEach(() => {
	futurePreference = false;
	rejectPreferenceReadback = false;
	httpRequests = [];
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input instanceof Request ? input.url : String(input);
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			const bodyText =
				init?.body ??
				(input instanceof Request ? await input.clone().text() : '');
			const body = bodyText ? JSON.parse(String(bodyText)) : undefined;
			httpRequests.push({ url, method, body });
			const path = new URL(url, window.location.href).pathname.split('/');
			const sessionId = Number(path[path.indexOf('sessions') + 1]);
			if (url.endsWith('/consent-preference')) {
				if (method === 'PUT' && !rejectPreferenceReadback)
					futurePreference = body.alwaysAskBeforeAdditionalAccess;
				return new Response(
					JSON.stringify({
						sessionId,
						alwaysAskBeforeAdditionalAccess: futurePreference
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			if (url.endsWith('/client-consent'))
				return new Response(
					JSON.stringify({
						sessionId,
						requestId: 88,
						status: 'GRANTED',
						canViewContent: true
					}),
					{
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			throw new Error('Unexpected HTTP request ' + method + ' ' + url);
		}
	);
	approve.mockClear();
	decline.mockClear();
	localStorage.clear();
	notificationSettingsStore.resetForTests();
	patch.mockReset();
	request.mockReset();
	putEmail.mockReset();
	saved = {
		...account,
		emailNotifications: {
			...account.emailNotifications,
			emailNotificationsEnabled: true,
			settings: {
				newChatMessageNotificationEnabled: true,
				reassignmentNotificationEnabled: true
			}
		}
	};
	patch.mockResolvedValue(undefined);
	vi.stubGlobal('Notification', {
		permission: 'default',
		requestPermission: request
	});
	request.mockImplementation(async () => {
		Object.defineProperty(Notification, 'permission', {
			value: 'granted',
			configurable: true
		});
		return 'granted';
	});
	document.body.innerHTML = '<div id="overlay"></div>';
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

async function openSetup() {
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	return screen.findByRole('region', {
		name: 'caseHandover.consent.info.notificationsAction'
	});
}
it('opens and focuses one same-conversation setup message without changing consent', async () => {
	setup();
	const message = await openSetup();
	await waitFor(() => expect(document.activeElement).toBe(message));
	expect(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	).toBeTruthy();
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
	await openSetup();
	expect(
		screen.getAllByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toHaveLength(1);
});
it('reading and closing the explanation does not start notification setup', async () => {
	setup();
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	fireEvent.click(
		(await screen.findAllByRole('button', { name: 'app.close' }))[0]
	);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	expect(approve).not.toHaveBeenCalled();
});
it('cancelling email setup leaves consent and channels untouched', async () => {
	setup({ ...account, email: undefined });
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	fireEvent.click(
		await screen.findByRole('button', {
			name: 'furtherSteps.email.overlay.button2.label'
		})
	);
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
	expect(patch).not.toHaveBeenCalled();
	expect(request).not.toHaveBeenCalled();
});
it('reopening setup preserves saved email instead of collecting it again', async () => {
	setup(saved);
	await openSetup();
	expect(
		screen
			.getByRole('button', { name: /notificationChoice.email / })
			.getAttribute('aria-pressed')
	).toBe('true');
	await openSetup();
	expect(screen.queryByRole('textbox')).toBeNull();
	expect(patch).not.toHaveBeenCalled();
});
it('the shortcut uses the same tenant email restriction as regular setup', async () => {
	setup(account, false);
	await openSetup();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.email / })
	).toBeNull();
	expect(
		screen.queryByRole('button', { name: /notificationChoice.both/ })
	).toBeNull();
	expect(
		screen.getByRole('button', { name: /notificationChoice.browser / })
	).toBeTruthy();
});
it('failure remains retryable without deciding handover consent', async () => {
	patch.mockRejectedValueOnce(new Error('offline'));
	setup();
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.email / })
	);
	await screen.findByRole('alert');
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.email / })
	);
	await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
});

it('does not carry a transient setup message into another session', async () => {
	const view = setup();
	await openSetup();
	view.switchSession('2');
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	expect(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	).toBeTruthy();
});
it('reload reads saved notification state when the shortcut is reopened', async () => {
	setup(saved);
	await openSetup();
	cleanup();
	setup(saved);
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	await openSetup();
	expect(
		screen
			.getByRole('button', { name: /notificationChoice.email / })
			.getAttribute('aria-pressed')
	).toBe('true');
	expect(screen.queryByRole('textbox')).toBeNull();
});

it('both channels wait for saved email and a separate browser gesture through the shortcut', async () => {
	setup();
	await openSetup();
	fireEvent.click(
		screen.getByRole('button', { name: /notificationChoice.both/ })
	);
	const activate = await screen.findByRole('button', {
		name: 'erstantwort.notificationChoice.enableBrowser'
	});
	expect(request).not.toHaveBeenCalled();
	fireEvent.click(activate);
	await waitFor(() => expect(Notification.permission).toBe('granted'));
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
});

for (const change of ['session', 'tenant'] as const) {
	it(`does not activate notifications when delayed address save finishes after ${change} changes`, async () => {
		let resolveSave!: () => void;
		putEmail.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve;
				})
		);
		const view = setup({ ...account, email: undefined });
		await openSetup();
		fireEvent.click(
			screen.getByRole('button', { name: /notificationChoice.both/ })
		);
		fireEvent.change(await screen.findByRole('textbox'), {
			target: { value: 'asker@example.org' }
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'furtherSteps.email.overlay.button1.label'
			})
		);
		expect(putEmail).toHaveBeenCalledOnce();
		if (change === 'session') view.switchSession('2');
		else view.disableEmail();
		await act(async () => resolveSave());
		expect(patch).not.toHaveBeenCalled();
		expect(request).not.toHaveBeenCalled();
	});
}

it.each([
	['AGENCY_COUNSELLING', true],
	['LIVE_CHAT', false],
	['SELF_HELP', true]
])(
	'manual handover setup uses the actual %s channel context',
	async (context, emailAllowed) => {
		setup(account, true, context);
		await openSetup();
		expect(
			Boolean(
				screen.queryByRole('button', {
					name: /notificationChoice.email/
				})
			)
		).toBe(emailAllowed);
	}
);
it('an unknown future conversation cannot open an empty notification flow', async () => {
	setup(account, true, 'UNKNOWN_FUTURE');
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	await screen.findByRole('dialog');
	expect(
		screen.queryByRole('button', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	expect(
		screen.queryByText('caseHandover.consent.info.notificationsCopy')
	).toBeNull();
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
});

it('does not recommend or open setup when actual context policy forbids both channels', async () => {
	setup(account, true, 'AGENCY_COUNSELLING', {
		featureAskerEmailAgencyCounsellingEnabled: false,
		featureAskerBrowserAgencyCounsellingEnabled: false
	});
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	await screen.findByRole('dialog');
	expect(
		screen.queryByRole('button', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	expect(
		screen.queryByText('caseHandover.consent.info.notificationsCopy')
	).toBeNull();
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
});

it('shows the saved future preference beneath pending request buttons and shares it with More information without deciding this request', async () => {
	setup();
	const inline = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	expect((inline as HTMLInputElement).checked).toBe(false);
	fireEvent.click(inline);
	await waitFor(() =>
		expect((inline as HTMLInputElement).checked).toBe(true)
	);
	fireEvent.click(
		screen.getByRole('button', { name: 'caseHandover.consent.info.more' })
	);
	const dialog = within(await screen.findByRole('dialog'));
	const same = await dialog.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	expect((same as HTMLInputElement).checked).toBe(true);
	fireEvent.click(same);
	await waitFor(() => expect((same as HTMLInputElement).checked).toBe(false));
	expect((inline as HTMLInputElement).checked).toBe(false);
	expect(
		httpRequests.filter((r) => r.method === 'PUT').map((r) => r.body)
	).toEqual([
		{ alwaysAskBeforeAdditionalAccess: true },
		{ alwaysAskBeforeAdditionalAccess: false }
	]);
	expect(httpRequests.some((r) => r.method === 'POST')).toBe(false);
	expect(approve).not.toHaveBeenCalled();
	expect(decline).not.toHaveBeenCalled();
});

it('does not show a future-policy change as saved when the HTTP readback rejects it', async () => {
	rejectPreferenceReadback = true;
	setup();
	const control = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	fireEvent.click(control);
	await screen.findByRole('alert');
	expect((control as HTMLInputElement).checked).toBe(false);
	expect(
		screen.queryByText('caseHandover.standingPreference.saved')
	).toBeNull();
	expect(httpRequests.filter((r) => r.method === 'GET')).toHaveLength(2);
	expect(httpRequests.some((r) => r.method === 'POST')).toBe(false);
});

it('a forbidden future-preference HTTP load exposes retry rather than an invented unchecked setting', async () => {
	const transport = globalThis.fetch;
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url.endsWith('/consent-preference'))
				return new Response('{}', { status: 403 });
			return transport(input, init);
		}
	);
	setup();
	await screen.findByRole('alert');
	expect(
		screen.queryByRole('switch', {
			name: 'caseHandover.standingPreference.label'
		})
	).toBeNull();
	expect(
		httpRequests.some((r) => r.method === 'PUT' || r.method === 'POST')
	).toBe(false);
	vi.stubGlobal('fetch', transport);
	fireEvent.click(
		screen.getByRole('button', { name: 'sessionList.reloadButton.label' })
	);
	const control = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	expect((control as HTMLInputElement).checked).toBe(false);
});

it.each([
	['pending opt-in', { mode: 'OPT_IN' as const }],
	['active opt-out', { mode: 'OPT_OUT' as const, consentGranted: true }],
	['silent information', { mode: 'NONE' as const }],
	[
		'closed request',
		{ mode: 'OPT_IN' as const, status: 'CLIENT_CONSENT_DECLINED' }
	]
])(
	'keeps the saved future setting separate in the %s message and dialog',
	async (_label, card) => {
		setup(saved, true, 'AGENCY_COUNSELLING', {}, card);
		const control = await screen.findByRole('switch', {
			name: 'caseHandover.standingPreference.label'
		});
		fireEvent.click(control);
		await waitFor(() =>
			expect((control as HTMLInputElement).checked).toBe(true)
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.more'
			})
		);
		const dialog = within(await screen.findByRole('dialog'));
		expect(
			(
				(await dialog.findByRole('switch', {
					name: 'caseHandover.standingPreference.label'
				})) as HTMLInputElement
			).checked
		).toBe(true);
		expect(dialog.getAllByRole('switch')).toHaveLength(1);
		expect(httpRequests.some((r) => r.method === 'POST')).toBe(false);
		expect(approve).not.toHaveBeenCalled();
		expect(decline).not.toHaveBeenCalled();
	}
);
it('a late HTTP load from another conversation cannot replace the current saved future setting', async () => {
	const transport = globalThis.fetch;
	let resolveOld!: (response: Response) => void;
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input instanceof Request ? input.url : String(input);
			if (
				url.includes('/sessions/1/') &&
				url.endsWith('/consent-preference')
			)
				return new Promise<Response>((resolve) => {
					resolveOld = resolve;
				});
			return transport(input, init);
		}
	);
	const view = setup(saved, true, 'AGENCY_COUNSELLING');
	expect(
		screen.queryByRole('switch', {
			name: 'caseHandover.standingPreference.label'
		})
	).toBeNull();
	view.switchSession('2');
	const current = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	expect((current as HTMLInputElement).checked).toBe(false);
	await act(async () =>
		resolveOld(
			new Response(
				JSON.stringify({
					sessionId: 1,
					alwaysAskBeforeAdditionalAccess: true
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } }
			)
		)
	);
	expect((current as HTMLInputElement).checked).toBe(false);
});

it('withdraws an unstarted channel recommendation when the confirmed future preference returns to agency policy', async () => {
	setup();
	const future = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	fireEvent.click(future);
	await screen.findByRole('region', {
		name: 'caseHandover.consent.info.notificationsAction'
	});
	await waitFor(() =>
		expect((future as HTMLInputElement).checked).toBe(true)
	);
	fireEvent.click(future);
	await waitFor(() =>
		expect((future as HTMLInputElement).checked).toBe(false)
	);
	expect(
		screen.queryByRole('region', {
			name: 'caseHandover.consent.info.notificationsAction'
		})
	).toBeNull();
	expect(httpRequests.some((r) => r.method === 'POST')).toBe(false);
});

it('serializes a pending future-preference HTTP mutation across close and reopen', async () => {
	const transport = globalThis.fetch;
	let releasePut!: () => void;
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (method === 'PUT')
				await new Promise<void>((resolve) => {
					releasePut = resolve;
				});
			return transport(input, init);
		}
	);
	render(
		<UserDataContext.Provider
			value={{
				userData: account,
				reloadUserData: async () => account,
				setUserData: () => {}
			}}
		>
			<TenantContext.Provider
				value={{
					tenant: {
						settings: { featureAskerEmailEnabled: false }
					} as TenantDataInterface,
					setTenant: () => {},
					updateTenantSettings: () => {}
				}}
			>
				<ModalProvider>
					<StandingAccessSettings sessionId={1} />
				</ModalProvider>
			</TenantContext.Provider>
		</UserDataContext.Provider>
	);
	const open = () =>
		fireEvent.click(
			screen.getByRole('button', {
				name: 'caseHandover.consent.info.title'
			})
		);
	open();
	fireEvent.click(
		await screen.findByRole('switch', {
			name: 'caseHandover.standingPreference.label'
		})
	);
	await waitFor(() => expect(releasePut).toBeTypeOf('function'));
	fireEvent.click(screen.getAllByRole('button', { name: 'app.close' })[0]);
	await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
	open();
	const reopened = await screen.findByRole('switch', {
		name: 'caseHandover.standingPreference.label'
	});
	expect(reopened).toHaveProperty('disabled', true);
	fireEvent.click(reopened);
	await act(async () => releasePut());
	await waitFor(() => {
		const confirmed = screen.getByRole('switch', {
			name: 'caseHandover.standingPreference.label'
		});
		expect(confirmed).toHaveProperty('checked', true);
		expect(confirmed).toHaveProperty('disabled', false);
	});
	expect(httpRequests.filter((item) => item.method === 'PUT')).toHaveLength(
		1
	);
	expect(httpRequests.some((item) => item.method === 'POST')).toBe(false);
});

it('confirms a same-conversation HTTP save after presentation close and reload without reporting a false failure', async () => {
	const transport = globalThis.fetch;
	let releasePut!: () => void;
	vi.stubGlobal(
		'fetch',
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const method =
				init?.method ??
				(input instanceof Request ? input.method : 'GET');
			if (method === 'PUT')
				await new Promise<void>((resolve) => {
					releasePut = resolve;
				});
			return transport(input, init);
		}
	);
	const PreferenceConsumer = () => {
		const future = useStandingAccessPreference(1, true);
		const [open, setOpen] = React.useState(true);
		const [result, setResult] = React.useState('');
		return (
			<>
				<button
					onClick={() => {
						future.invalidate();
						setOpen(false);
					}}
				>
					Close preference
				</button>
				<button
					onClick={() => {
						setOpen(true);
						void future.load();
					}}
				>
					Reopen preference
				</button>
				{open && future.preference && (
					<button
						disabled={future.saving || future.loading}
						onClick={async () => {
							try {
								const saved = await future.save(true);
								setResult(
									saved && future.didStrengthen()
										? 'Confirmed stronger future gate'
										: 'Unconfirmed future gate'
								);
							} catch {
								setResult('Save failed');
							}
						}}
					>
						Require future agreement
					</button>
				)}
				<output>{result}</output>
			</>
		);
	};
	render(
		<UserDataContext.Provider
			value={{
				userData: account,
				reloadUserData: async () => account,
				setUserData: () => {}
			}}
		>
			<PreferenceConsumer />
		</UserDataContext.Provider>
	);
	fireEvent.click(
		await screen.findByRole('button', { name: 'Require future agreement' })
	);
	await waitFor(() => expect(releasePut).toBeTypeOf('function'));
	fireEvent.click(screen.getByRole('button', { name: 'Close preference' }));
	fireEvent.click(screen.getByRole('button', { name: 'Reopen preference' }));
	await waitFor(() =>
		expect(
			screen.getByRole('button', { name: 'Require future agreement' })
		).toHaveProperty('disabled', true)
	);
	await act(async () => releasePut());
	await screen.findByText('Confirmed stronger future gate');
	expect(screen.queryByText('Save failed')).toBeNull();
	expect(httpRequests.filter((item) => item.method === 'PUT')).toHaveLength(
		1
	);
	expect(httpRequests.some((item) => item.method === 'POST')).toBe(false);
});
