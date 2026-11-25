import * as React from 'react';
import { useLayoutEffect, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
// Resolve the lazy session view and composer before the timed interaction.
// A cold CI shard otherwise compiles both while the exercise is running.
import '../session/SessionView';
import '../messageSubmitInterface/messageSubmitInterfaceComponent';
import { NavigationBar } from '../app/NavigationBar';
import { RouterConfigConsultant } from '../app/RouterConfig';
import { SessionsZone } from '../app/SessionsZone';
import { CalendarPageWired } from '../calendar/CalendarPageWired';
import { Header } from '../header/Header';
import { Profile } from '../profile/Profile';
import { Walkthrough } from '../walkthrough/Walkthrough';
import '../app/authenticatedApp.styles.scss';
import '../app/navigation.styles.scss';
import {
	AppConfigContext,
	ConsultantListContext,
	ConsultingTypesContext,
	ServerSettingsContext,
	SessionsDataContext,
	TenantContext,
	TopicsContext,
	UserDataContext
} from '../../globalState';
import { LanguagesContext } from '../../globalState/provider/LanguagesProvider';
import { MatrixClientContext } from '../../globalState/context/MatrixClientContext';
import { config } from '../../resources/scripts/config';
import { replaceTenantSettings } from '../../utils/tenantSettingsHelper';
import { PracticeBanner } from '../../practice/PracticeBanner';
import { PracticeLayer } from '../../practice/PracticeLayer';
import { PracticeSurface } from '../../practice/PracticeSurface';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import { practiceCounsellorFixture } from '../../practice/fixtures/practiceCounsellorFixture';
import {
	getPracticeNetworkGuard,
	getPracticeSnapshot
} from '../../practice/practiceMode';

const TUTORIAL_PROGRESS = '/service/users/tutorials/progress';
const HELP_ROUTE = '/profile/hilfe/rundgaenge';
const TENANT_FLAGS = {
	featureTeamDiscussionEnabled: false,
	featureSupervisionEnabled: true,
	featureAnonymousChatEnabled: false
};
/** The real availability (GET/PUT) and its heartbeat (POST) share this path. */
const LIVE_CHAT_AVAILABILITY =
	'/service/conversations/consultants/availability';

interface StageArgs {
	teamDiscussion?: boolean;
	/** The Träger offers live chat: the Live-Chat tour is on the Help page. */
	liveChat?: boolean;
	/** The counsellor moved the availability switch into the menu bar. */
	liveChatViaSidebar?: boolean;
}

const tenantFlagsFor = ({
	teamDiscussion = false,
	liveChat = false
}: StageArgs) => ({
	...TENANT_FLAGS,
	featureTeamDiscussionEnabled: teamDiscussion,
	featureAnonymousChatEnabled: liveChat
});

interface RecordedRequest {
	method: string;
	url: string;
	status?: string;
}

/** Every request that reached the page's network, in order. */
const requestLog: RecordedRequest[] = [];
/** Write-like calls on the real Matrix client, which practice must not use. */
const realMatrixWrites: string[] = [];

const realMatrixStandIn = new Proxy(
	{},
	{
		get: (_target, key) => {
			if (
				typeof key === 'string' &&
				/^(send|set|join|invite|leave|redact|create)/.test(key)
			) {
				realMatrixWrites.push(key);
			}
			return () => null;
		}
	}
);

/**
 * The page's network: records every request and answers only the tutorial
 * progress (read: nothing done yet; write: accepted). Everything else fails
 * like an unreachable backend, so no story ever talks to a real one.
 * Installed in a layout effect, before the shell's first fetch and before the
 * practice guard wraps it.
 */
const RecordedNetwork = ({ children }: { children: React.ReactNode }) => {
	useLayoutEffect(() => {
		const pageFetch = window.fetch;
		requestLog.length = 0;
		realMatrixWrites.length = 0;
		const progress = new Map<string, ITutorialProgressItem>();
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const request = new Request(input, init);
			const progressWrite =
				request.method === 'PUT' &&
				request.url.includes(TUTORIAL_PROGRESS);
			const saved = progressWrite
				? ((await request.clone().json()) as ITutorialProgressItem)
				: undefined;
			if (saved)
				progress.set(`${saved.tourId}:${saved.tourVersion}`, saved);
			requestLog.push({
				method: request.method,
				url: request.url,
				status: saved?.status
			});
			// The counsellor is really NOT available; only the read is answered.
			if (
				request.method === 'GET' &&
				new URL(request.url).pathname.endsWith(LIVE_CHAT_AVAILABILITY)
			) {
				return new Response(JSON.stringify({ available: false }), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			if (request.url.includes(TUTORIAL_PROGRESS)) {
				return request.method === 'GET'
					? new Response(JSON.stringify([...progress.values()]), {
							status: 200,
							headers: { 'content-type': 'application/json' }
						})
					: new Response(null, { status: 204 });
			}
			throw new TypeError('Failed to fetch');
		}) as typeof window.fetch;
		return () => {
			window.fetch = pageFetch;
		};
	}, []);
	return <>{children}</>;
};

/** App-level stores the session views read; practice brings its own data. */
const SessionSupport = ({ children }: { children: React.ReactNode }) => (
	<ConsultantListContext.Provider
		value={{ consultantList: [], setConsultantList: () => {} } as never}
	>
		<ServerSettingsContext.Provider
			value={{ getSetting: () => undefined } as never}
		>
			<TopicsContext.Provider
				value={{ topics: [], setTopics: () => {} } as never}
			>
				<LanguagesContext.Provider
					value={{ fixed: ['de'], spoken: [] } as never}
				>
					{children}
				</LanguagesContext.Provider>
			</TopicsContext.Provider>
		</ServerSettingsContext.Provider>
	</ConsultantListContext.Provider>
);

/**
 * The authenticated shell as `Routing.tsx` builds it, below `PracticeLayer`:
 * tour host, practice banner, navigation, header, and the routed content in
 * `PracticeSurface`. Profile and sessions are the real pages.
 */
const PracticeFlowStage = ({
	teamDiscussion = false,
	liveChat = false,
	liveChatViaSidebar = false
}: StageArgs) => {
	const store = useMemo(() => createStore(), []);
	const tenantFlags = useMemo(
		() => tenantFlagsFor({ teamDiscussion, liveChat }),
		[teamDiscussion, liveChat]
	);
	const settings = useMemo(
		() => ({
			...config,
			enableWalkthrough: true,
			useOverviewPage: false,
			releaseToggles: {
				...config.releaseToggles,
				enablePracticeArea: true
			}
		}),
		[]
	);
	const routerConfig = useMemo(
		() => RouterConfigConsultant(settings),
		[settings]
	);
	const userData = useMemo(
		() => ({
			...practiceCounsellorFixture({ isWalkThroughEnabled: false }),
			liveChatViaSidebar
		}),
		[liveChatViaSidebar]
	);

	return (
		<RecordedNetwork>
			<JotaiProvider store={store}>
				<AppConfigContext.Provider value={settings}>
					<UserDataContext.Provider
						value={{
							userData,
							setUserData: () => undefined,
							reloadUserData: async () => userData
						}}
					>
						<TenantContext.Provider
							value={{
								tenant: {
									id: 1,
									name: 'ORISO Storybook',
									settings: tenantFlags
								} as never,
								setTenant: () => {},
								updateTenantSettings: () => {}
							}}
						>
							<ConsultingTypesContext.Provider
								value={{
									consultingTypes: [
										{ id: 0, isVideoCallAllowed: false }
									] as never,
									setConsultingTypes: () => {}
								}}
							>
								<SessionsDataContext.Provider
									value={{
										ready: true,
										sessions: [],
										dispatch: () => {}
									}}
								>
									<MatrixClientContext.Provider
										value={
											{
												matrixClientService:
													realMatrixStandIn,
												setMatrixClientService: () => {}
											} as never
										}
									>
										<SessionSupport>
											<PracticeLayer>
												<Walkthrough />
												<PracticeBanner />
												<div
													className="app__wrapper"
													style={{ height: '100vh' }}
												>
													<NavigationBar
														routerConfig={
															routerConfig
														}
														onLogout={() => {}}
													/>
													<section className="contentWrapper">
														<Header />
														<div className="contentWrapper__content">
															<PracticeSurface>
																<Routes>
																	<Route
																		path="/sessions/*"
																		element={
																			<SessionsZone
																				routerConfig={
																					routerConfig
																				}
																			/>
																		}
																	/>
																	<Route
																		path="/booking/events"
																		element={
																			<CalendarPageWired />
																		}
																	/>
																	<Route
																		path="/profile/*"
																		element={
																			<div className="contentWrapper__profile">
																				<Profile />
																			</div>
																		}
																	/>
																</Routes>
															</PracticeSurface>
														</div>
													</section>
												</div>
											</PracticeLayer>
										</SessionSupport>
									</MatrixClientContext.Provider>
								</SessionsDataContext.Provider>
							</ConsultingTypesContext.Provider>
						</TenantContext.Provider>
					</UserDataContext.Provider>
				</AppConfigContext.Provider>
			</JotaiProvider>
		</RecordedNetwork>
	);
};

const storageSnapshot = () =>
	[localStorage, sessionStorage].map((storage) =>
		Array.from({ length: storage.length }, (_, index) => {
			const key = storage.key(index) as string;
			return `${key}=${storage.getItem(key)}`;
		}).sort()
	);

// Fail at the stalled UI action before the whole story reaches its 15s limit.
const SLOW = { timeout: 5000 };

/** The tour tooltip of the step on screen. */
const tooltip = () => screen.findByRole('alertdialog', {}, SLOW);

const progressText = () =>
	document.querySelector('.productTourTooltip__progress')?.textContent ?? '';

const expectStep = (step: number, of: number) =>
	waitFor(
		() =>
			expect(
				progressText(),
				`Practice step ${step} of ${of}; observed: ${progressText()}`
			).toMatch(new RegExp(`${step}\\D+${of}`)),
		SLOW
	);

const target = (name: string) =>
	waitFor(() => {
		const element = document.querySelector<HTMLElement>(
			`[data-tour-target="${name}"]`
		);
		expect(element).not.toBeNull();
		return element!;
	}, SLOW);

const meta = {
	title: 'Organisms/PracticeFlow',
	component: PracticeFlowStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: HELP_ROUTE },
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The practice area end to end (#1622): the real Help page, practice cards, tour host, banner, navigation, header, session views and calendar, wired as in `Routing.tsx`. Practice runs on the in-memory world. Every request that reaches the page is recorded; only the tutorial progress is answered, everything else fails like an unreachable backend.'
			}
		}
	},
	globals: { viewport: { value: 'desktop1440', isRotated: false } },
	args: { teamDiscussion: false, liveChat: false, liveChatViaSidebar: false },
	beforeEach: ({ args }) => {
		replaceTenantSettings(tenantFlagsFor(args));
		// #1338: the tour (react-joyride and its floating-ui positioning)
		// re-measures inside ResizeObserver callbacks, and Chrome reports the
		// harmless "loop completed with undelivered notifications", once or twice
		// per run. While these stories run, callbacks arrive on the next frame, as
		// the browser would deliver them anyway; observers created meanwhile keep
		// that through the story's unmount.
		const NativeResizeObserver = window.ResizeObserver;
		window.ResizeObserver = class extends NativeResizeObserver {
			constructor(callback: ResizeObserverCallback) {
				super((entries, observer) =>
					requestAnimationFrame(() => callback(entries, observer))
				);
			}
		};
		return () => {
			window.ResizeObserver = NativeResizeObserver;
			replaceTenantSettings({});
		};
	}
} satisfies Meta<typeof PracticeFlowStage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sends through the visible composer, without calling the editor's internals. */
const sendReply = async (scope: HTMLElement, text: string) => {
	const editor = await waitFor(() => {
		const field = scope.querySelector<HTMLElement>(
			'.ProseMirror[contenteditable="true"]'
		);
		expect(field).not.toBeNull();
		return field!;
	}, SLOW);
	await userEvent.click(editor);
	await userEvent.keyboard(text);
	const send = await waitFor(() => {
		const button = within(scope).getByRole('button', {
			name: 'Nachricht senden'
		});
		expect(button).toBeEnabled();
		return button;
	}, SLOW);
	await userEvent.click(send);
	await waitFor(() => {
		expect(editor.textContent?.trim()).toBe('');
		expect(send).toBeDisabled();
	}, SLOW);
};

const next = async (label = 'Weiter') =>
	userEvent.click(
		within(await tooltip()).getByRole('button', { name: label })
	);

/** No practice data or action may reach the real page's network or storage. */
const expectIsolated = async (
	storageBefore: ReturnType<typeof storageSnapshot>,
	terminalStatus = 'completed'
) => {
	await expect(
		requestLog.filter(
			({ method, url }) =>
				method !== 'GET' &&
				!(method === 'PUT' && url.includes(TUTORIAL_PROGRESS))
		)
	).toEqual([]);
	await expect(
		requestLog.some(
			({ method, url, status }) =>
				method === 'PUT' &&
				url.includes(TUTORIAL_PROGRESS) &&
				status === terminalStatus
		)
	).toBe(true);
	await expect(
		requestLog.filter(({ url }) =>
			/(\/|=)-\d+(\/|&|$)|practice/.test(decodeURIComponent(url))
		)
	).toEqual([]);
	await expect(realMatrixWrites).toEqual([]);
	await expect(storageSnapshot()).toEqual(storageBefore);
};

const expectExited = async (
	canvas: ReturnType<typeof within>,
	storageBefore: ReturnType<typeof storageSnapshot>,
	terminalStatus = 'completed'
) => {
	await waitFor(
		() => expect(getPracticeSnapshot().status).toBe('inactive'),
		SLOW
	);
	await expect(
		await canvas.findByRole(
			'heading',
			{ name: 'Übung: Anfrage annehmen' },
			SLOW
		)
	).toBeVisible();
	await expect(
		screen.queryByRole('status', { name: 'Übungsmodus' })
	).toBeNull();
	await expectIsolated(storageBefore, terminalStatus);
};

const acceptAnEnquiry: NonNullable<Story['play']> = async ({
	canvas,
	step,
	args
}) => {
	// FE#2491: the team chat lives in "Weitere Funktionen"; the tour has no
	// team steps whatever the flag says.
	const of = 6;
	const storageBefore = storageSnapshot();
	await step('Start the exercise from its Help card', async () => {
		const card = (
			await canvas.findByRole(
				'heading',
				{ name: 'Übung: Anfrage annehmen' },
				SLOW
			)
		).closest('li')!;
		await userEvent.click(
			within(card).getByRole('button', { name: 'Übung starten' })
		);
	});

	await step('1: Find the enquiry navigation', async () => {
		await expectStep(1, of);
		await expect(getPracticeSnapshot().status).toBe('active');
		await expect(canvas.queryByLabelText('Klassisches Design')).toBeNull();
		await next();
	});
	await step('2: Open the practice enquiry in the real list', async () => {
		await expectStep(2, of);
		await userEvent.click(await target('enquiry-list-item'));
	});

	const acceptAt = 3;
	await step(`${acceptAt}: Accept the enquiry`, async () => {
		await expectStep(acceptAt, of);
		await expect(
			document.querySelector('[data-cy="enquiry-open-team"]')
		).toBeNull();
		await userEvent.click(await target('enquiry-accept-button'));
	});
	await step(
		`${acceptAt + 1}: Read the first answer explanation`,
		async () => {
			await expectStep(acceptAt + 1, of);
			await next();
		}
	);
	await step(
		`${acceptAt + 2}: Send a reply and receive Sam's answer`,
		async () => {
			await expectStep(acceptAt + 2, of);
			await target('session-composer');
			await sendReply(
				document.querySelector<HTMLElement>('.chatStage__mainPane')!,
				'Hallo Sam, schön, dass Sie sich melden.'
			);
			await waitFor(
				() =>
					expect(
						document.querySelector('.chatStage__mainPane')
							?.textContent
					).toContain('Vielen Dank für Ihre Antwort'),
				SLOW
			);
		}
	);
	await step(
		`${of}: Finish and return to Help without outbound writes`,
		async () => {
			await expectStep(of, of);
			await expect(getPracticeNetworkGuard()?.blockedRequests).toEqual(
				[]
			);
			await next('Fertig');
			await expectExited(canvas, storageBefore);
		}
	);
};

export const AcceptAnEnquiry: Story = {
	name: 'Accept an enquiry · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Starts "Übung: Anfrage annehmen" from its card with Team-Besprechung disabled and walks six steps with the real controls. Nothing but the allowlisted tutorial progress write leaves the page, the browser storage is unchanged, and the page returns to Help.'
			}
		}
	},
	play: acceptAnEnquiry
};

export const AcceptAnEnquiryWithTeamDiscussion: Story = {
	name: 'Accept an enquiry with team discussion · desktop',
	args: { teamDiscussion: true },
	parameters: {
		docs: {
			description: {
				story: 'With the team chat enabled the exercise walks the same six steps (FE#2491: the team chat is switched on in "Weitere Funktionen", there is no team button beside "Annehmen" for the tour to point at). Completion returns to Help with no practice writes outside the page.'
			}
		}
	},
	play: acceptAnEnquiry
};

export const CancelAnExercise: Story = {
	name: 'End resets an interrupted exercise · desktop',
	play: async ({ canvas }) => {
		const storageBefore = storageSnapshot();
		const card = (
			await canvas.findByRole(
				'heading',
				{ name: 'Übung: Anfrage annehmen' },
				SLOW
			)
		).closest('li')!;
		await userEvent.click(
			within(card).getByRole('button', { name: 'Übung starten' })
		);
		await expectStep(1, 6);
		await next();
		await expectStep(2, 6);
		await userEvent.click(
			screen.getByRole('button', { name: 'Übung beenden' })
		);
		await expectExited(canvas, storageBefore, 'not_started');
		const restored = canvas
			.getByRole('heading', { name: 'Übung: Anfrage annehmen' })
			.closest('li')!;
		await expect(
			within(restored).getByText('Nicht gestartet')
		).toBeVisible();
		await expect(
			requestLog.filter(({ method }) => method === 'PUT').at(-1)?.status
		).toBe('not_started');
	}
};

/** A tour anchor that `target` has waited for. */
const anchor = (name: string) =>
	document.querySelector<HTMLElement>(`[data-tour-target="${name}"]`)!;

/** Opens the header "+" of the open case and picks an entry of its menu. */
const pickPlusMenuEntry = async (
	entry: 'Supervisor verwalten' | 'Beratung übergeben'
) => {
	await userEvent.click(await target('session-supervisor-add'));
	await userEvent.click(
		await screen.findByRole('menuitem', { name: new RegExp(entry) }, SLOW)
	);
};

/** Picks an option of a real select inside a dialog. */
const choose = async (
	select: HTMLElement,
	option: (name: string) => boolean
) => {
	await userEvent.click(within(select).getByRole('combobox'));
	const options = await screen.findAllByRole('option', {}, SLOW);
	await userEvent.click(
		options.find((element) => option(element.textContent ?? ''))!
	);
};

export const HandOverCases: Story = {
	name: 'Hand over cases · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Starts "Fälle übergeben" from Help with the practice area open (FE#2545). In the accepted practice case the counsellor adds Robin through "+" → "Supervisor verwalten" (the former card "Supervisor hinzufügen"), offers the case to Alex through "+" → "Beratung übergeben", searches "Alex" in the sessions list, clicks "Zugriff anfragen" on Alex\'s case and sends the request through the curtain. Every handover request is answered in memory; only the completed progress is written.'
			}
		}
	},
	play: async ({ canvas, step }) => {
		const of = 10;
		const storageBefore = storageSnapshot();
		await step('Start "Fälle übergeben" from its Help card', async () => {
			const card = (
				await canvas.findByRole(
					'heading',
					{ name: 'Fälle übergeben' },
					SLOW
				)
			).closest('li')!;
			await userEvent.click(
				within(card).getByRole('button', { name: 'Starten' })
			);
		});
		await step('1: Read that this is an exercise', async () => {
			await expectStep(1, of);
			await expect(getPracticeSnapshot().status).toBe('active');
			await next();
		});
		await step(
			'2: "+" → "Supervisor verwalten": choose Robin and add him',
			async () => {
				await expectStep(2, of);
				await pickPlusMenuEntry('Supervisor verwalten');
				await userEvent.click(
					await screen.findByRole(
						'button',
						{ name: 'Robin (Übung) hinzufügen' },
						SLOW
					)
				);
				await userEvent.type(
					await screen.findByPlaceholderText(
						'Warum soll diese Person den Fall supervidieren?'
					),
					'Ich möchte mich zum Vorgehen absichern.'
				);
				await userEvent.click(
					screen.getByRole('button', {
						name: 'Robin (Übung) hinzufügen'
					})
				);
				await waitFor(
					() =>
						expect(
							screen.queryByTestId('manage-people-dialog')
						).toBeNull(),
					SLOW
				);
			}
		);
		await step("3: Read Robin's reply in the side thread", async () => {
			await expectStep(3, of);
			await waitFor(async () => {
				await expect(
					document.querySelector(
						'[data-tour-target="supervision-panel"]'
					)?.textContent
				).toContain('Das klingt gut so.');
			}, SLOW);
			await next();
		});
		await step(
			'4: "+" → "Beratung übergeben": Alex, a reason, "Übergabe anbieten"',
			async () => {
				await expectStep(4, of);
				await pickPlusMenuEntry('Beratung übergeben');
				const dialog = await screen.findByTestId(
					'supervisor-dialog',
					{},
					SLOW
				);
				await choose(
					within(dialog).getByTestId('supervisor-dialog-person'),
					(name) => name.startsWith('Alex (Übung)')
				);
				await choose(
					within(dialog).getByTestId('supervisor-dialog-reason'),
					(name) => name.trim() !== '' && !/auswählen/i.test(name)
				);
				await userEvent.click(
					within(dialog).getByRole('button', {
						name: 'Übergabe anbieten'
					})
				);
			}
		);
		await step(
			'5: The offer waits for Alex; close its dialog',
			async () => {
				await expectStep(5, of);
				const state = await screen.findByTestId(
					'case-handover-state-dialog',
					{},
					SLOW
				);
				// The dialog fades in.
				await waitFor(
					() =>
						expect(
							within(state).getByRole('button', {
								name: 'Angebot zurückziehen'
							})
						).toBeVisible(),
					SLOW
				);
				await userEvent.click(
					within(state)
						.getAllByRole('button', { name: 'Schließen' })
						.at(-1)!
				);
				await next();
			}
		);
		await step('6: Search "Alex" in the sessions list', async () => {
			await expectStep(6, of);
			await target('sessions-search');
			const search = anchor('sessions-search');
			if (!search.querySelector('input')) {
				await userEvent.click(
					within(search).getByRole('button', {
						name: 'Suchergebnisse öffnen oder schließen'
					})
				);
			}
			await userEvent.type(
				await waitFor(() => {
					const input = search.querySelector('input');
					expect(input).not.toBeNull();
					return input!;
				}, SLOW),
				'Alex'
			);
		});
		await step('7: "Zugriff anfragen" on Alex\'s case', async () => {
			await expectStep(7, of);
			await target('case-handover-request-access');
			const action = anchor('case-handover-request-access');
			await userEvent.click(
				action.matches('button')
					? action
					: within(action).getAllByRole('button')[0]
			);
		});
		await step(
			'8: The curtain: a reason, a short text, "Zugriff anfragen"',
			async () => {
				await expectStep(8, of);
				await target('case-handover-curtain');
				const curtain = anchor('case-handover-curtain');
				await userEvent.click(
					within(curtain).getByRole('button', {
						name: 'Schritt für Schritt zeigen'
					})
				);
				await userEvent.click(
					(await within(curtain).findAllByRole('radio', {}, SLOW))[0]
				);
				const forward = () =>
					document.querySelector<HTMLButtonElement>(
						'[data-cy="case-handover-curtain-next"]'
					)!;
				await userEvent.click(forward());
				await userEvent.type(
					await waitFor(() => {
						const field = document.querySelector<HTMLElement>(
							'[data-cy="case-handover-curtain-explanation"]'
						);
						expect(field).not.toBeNull();
						return field!;
					}, SLOW),
					'Ich vertrete Alex in dieser Woche.'
				);
				await userEvent.click(forward());
				await waitFor(
					() =>
						expect(curtain.textContent).toContain(
							'Warten auf Freigabe'
						),
					SLOW
				);
			}
		);
		await step('9: Where the status shows', async () => {
			await expectStep(9, of);
			await next();
		});
		await step(
			`${of}: Finish and return to Help without outbound writes`,
			async () => {
				await expectStep(of, of);
				await expect(
					getPracticeNetworkGuard()?.blockedRequests
				).toEqual([]);
				await next('Fertig');
				await expectExited(canvas, storageBefore);
				await expect(
					requestLog.filter(({ url }) =>
						url.includes('case-handover')
					)
				).toEqual([]);
			}
		);
	}
};

/** Bounded native Tab navigation: never moves focus through a test-only API. */
const tabTo = async (control: HTMLElement) => {
	for (
		let count = 0;
		document.activeElement !== control && count < 40;
		count += 1
	) {
		// eslint-disable-next-line no-await-in-loop -- exercise real sequential Tab navigation
		await userEvent.tab();
	}
	await expect(control).toHaveFocus();
};

export const SupervisorPickerWithKeyboard: Story = {
	name: 'Supervisor picker and End with keyboard · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Uses only Tab, Enter and typing to start "Fälle übergeben", open "+" → "Supervisor verwalten", choose Robin in the modal, and end practice while the picker is open. The permanent banner stays accessible and no practice data leaves the page.'
			}
		}
	},
	play: async ({ canvas, step }) => {
		const storageBefore = storageSnapshot();
		await step('Start "Fälle übergeben" with Tab and Enter', async () => {
			const card = (
				await canvas.findByRole(
					'heading',
					{ name: 'Fälle übergeben' },
					SLOW
				)
			).closest('li')!;
			await tabTo(within(card).getByRole('button', { name: 'Starten' }));
			await userEvent.keyboard('{Enter}');
			await expectStep(1, 10);
			await tabTo(
				within(await tooltip()).getByRole('button', { name: 'Weiter' })
			);
			await userEvent.keyboard('{Enter}');
			await expectStep(2, 10);
			await waitFor(
				() =>
					expect(document.activeElement).toBe(
						document.querySelector(
							'[data-tour-target="session-supervisor-add"]'
						)
					),
				SLOW
			);
			await expect(await tooltip()).not.toHaveAttribute(
				'aria-modal',
				'true'
			);
		});
		await step(
			'Open "+" → "Supervisor verwalten", choose Robin and type the reason with the keyboard',
			async () => {
				await userEvent.keyboard('{Enter}');
				const entry = await screen.findByRole(
					'menuitem',
					{ name: /Supervisor verwalten/ },
					SLOW
				);
				await waitFor(() => expect(entry).toHaveFocus(), SLOW);
				await userEvent.keyboard('{Enter}');
				const robin = await screen.findByRole(
					'button',
					{ name: 'Robin (Übung) hinzufügen' },
					SLOW
				);
				await tabTo(robin);
				await userEvent.keyboard('{Enter}');
				const reason = await screen.findByPlaceholderText(
					'Warum soll diese Person den Fall supervidieren?',
					{},
					SLOW
				);
				await expect(
					within(screen.getByRole('dialog')).getAllByText(
						'Robin (Übung)'
					)[0]
				).toBeVisible();
				await tabTo(reason);
				await userEvent.keyboard(
					'Ich möchte mich zum Vorgehen absichern.'
				);
				await expect(reason).toHaveValue(
					'Ich möchte mich zum Vorgehen absichern.'
				);
			}
		);
		await step(
			'Reach the permanent banner and end while the picker remains open',
			async () => {
				const banner = screen.getByRole('status', {
					name: 'Übungsmodus'
				});
				await expect(banner.closest('[aria-hidden="true"]')).toBeNull();
				await expect(screen.getByRole('dialog')).toBeVisible();
				await tabTo(
					within(banner).getByRole('button', {
						name: 'Übung beenden'
					})
				);
				await userEvent.keyboard('{Enter}');
				await waitFor(
					() => expect(getPracticeSnapshot().status).toBe('inactive'),
					SLOW
				);
				await expect(
					screen.queryByRole('status', { name: 'Übungsmodus' })
				).toBeNull();
				await expect(screen.queryByRole('dialog')).toBeNull();
				await expect(
					requestLog.filter(
						({ method, url }) =>
							method !== 'GET' &&
							!(
								method === 'PUT' &&
								url.includes(TUTORIAL_PROGRESS)
							)
					)
				).toEqual([]);
				await expect(
					requestLog.some(({ status }) => status === 'completed')
				).toBe(false);
				await expect(realMatrixWrites).toEqual([]);
				await expect(storageSnapshot()).toEqual(storageBefore);
			}
		);
	}
};

/** The keys the real availability shares between tabs, and their values. */
const liveChatStorage = () =>
	Array.from({ length: localStorage.length }, (_, index) => {
		const key = localStorage.key(index) as string;
		return key.startsWith('oriso_liveChat')
			? `${key}=${localStorage.getItem(key)}`
			: null;
	})
		.filter(Boolean)
		.sort();

/**
 * FE#2545: the practice Live-Chat tour, started from its Help card. The
 * availability step points at the control the counsellor uses: the settings
 * switch, or the rail toggle with the "via sidebar" preference.
 */
const practiseLiveChat =
	(
		availabilityControl: () => Promise<HTMLElement>
	): NonNullable<Story['play']> =>
	async ({ canvas, step }) => {
		const of = 7;
		const storageBefore = storageSnapshot();
		const liveChatBefore = liveChatStorage();
		await step('Start the Live-Chat tour from its Help card', async () => {
			const card = (
				await canvas.findByRole('heading', { name: 'Live-Chat' }, SLOW)
			).closest('li')!;
			await userEvent.click(
				within(card).getByRole('button', { name: 'Starten' })
			);
		});
		await step('1: Read what is different about live chat', async () => {
			await expectStep(1, of);
			await expect(getPracticeSnapshot().status).toBe('active');
			await next();
		});
		await step(
			'2: Switch "Bin verfügbar" on, in practice only',
			async () => {
				await expectStep(2, of);
				await target('livechat-availability-control');
				const tourAnchor = document.querySelector<HTMLElement>(
					'[data-tour-target="livechat-availability-control"]'
				)!;
				const control = await availabilityControl();
				// The anchor is the control, or sits inside it (the rail button).
				const anchoredOnControl =
					tourAnchor.contains(control) ||
					control.contains(tourAnchor);
				await expect(anchoredOnControl).toBe(true);
				// Practice starts "off", like the real state here.
				await expect(control).not.toBeChecked();
				await userEvent.click(control);
			}
		);
		await step(
			'3: Read the queue with the live-chat filter on',
			async () => {
				await expectStep(3, of);
				await target('livechat-queue');
				await next();
			}
		);
		await step('4: Open the waiting practice live chat', async () => {
			await expectStep(4, of);
			await userEvent.click(await target('enquiry-list-item'));
		});
		await step('5: Start the chat with the real button', async () => {
			await expectStep(5, of);
			await userEvent.click(await target('enquiry-accept-button'));
		});
		await step('6: Reply and receive the asker’s answer', async () => {
			await expectStep(6, of);
			await target('session-composer');
			await sendReply(
				document.querySelector<HTMLElement>('.chatStage__mainPane')!,
				'Hallo, schön, dass Sie schreiben. Was beschäftigt Sie?'
			);
			await waitFor(
				() =>
					expect(
						document.querySelector('.chatStage__mainPane')
							?.textContent
					).toContain('Vielen Dank für Ihre Antwort'),
				SLOW
			);
		});
		await step(
			`${of}: Finish and return to Help without outbound writes`,
			async () => {
				await expectStep(of, of);
				await expect(
					getPracticeNetworkGuard()?.blockedRequests
				).toEqual([]);
				await next('Fertig');
				await expectExited(canvas, storageBefore);
				// The real availability: no PUT, no heartbeat, no shared state.
				await expect(
					requestLog.filter(
						({ method, url }) =>
							url.includes(LIVE_CHAT_AVAILABILITY) &&
							method !== 'GET'
					)
				).toEqual([]);
				await expect(liveChatStorage()).toEqual(liveChatBefore);
			}
		);
	};

export const LiveChatWithProfileSwitch: Story = {
	name: 'Live chat with the settings switch · desktop',
	args: { liveChat: true },
	parameters: {
		docs: {
			description: {
				story: 'Starts the Live-Chat tour from Help with the practice area open (FE#2545). "Bin verfügbar" on the real settings page is switched on in practice only, the waiting practice live chat is opened, started with "Chat starten" and answered by the scripted asker. Completion is written; the real availability, its heartbeat and the `oriso_liveChat*` storage stay untouched.'
			}
		}
	},
	play: practiseLiveChat(() =>
		screen.findByRole('switch', { name: 'Bin verfügbar' }, SLOW)
	)
};

export const LiveChatWithSidebarToggle: Story = {
	name: 'Live chat with the menu bar toggle · desktop',
	args: { liveChat: true, liveChatViaSidebar: true },
	parameters: {
		docs: {
			description: {
				story: 'The same practice run for a counsellor who moved the availability switch into the menu bar: the rail toggle is the control, the settings switch only mirrors it. Nothing reaches the real availability, heartbeat or browser storage.'
			}
		}
	},
	play: practiseLiveChat(() => target('livechat-availability-toggle'))
};

/** A dialog of the calendar, by its test id. */
const calendarDialog = async (testId: string): Promise<HTMLElement> => {
	let dialog: HTMLElement | null = null;
	await waitFor(() => {
		dialog = document.querySelector<HTMLElement>(
			`[data-testid="${testId}"]`
		);
		expect(dialog, testId).not.toBeNull();
	}, SLOW);
	return dialog!;
};

/**
 * "Neu" on the real calendar: the practice conversation, optionally with
 * "Weitere Personen per Link einladen", saved with the dialog's own button.
 */
const enterPracticeAppointment = async (inviteOthers = false) => {
	await userEvent.click(await target('calendar-create'));
	const dialog = await calendarDialog('calendar-appointment-dialog');
	await userEvent.click(within(dialog).getByRole('combobox'));
	// The practice advice seeker is the only conversation.
	const [conversation] = await screen.findAllByRole('option', {}, SLOW);
	await userEvent.click(conversation);
	if (inviteOthers)
		await userEvent.click(
			within(dialog).getByRole('switch', {
				name: 'Weitere Personen per Link einladen'
			})
		);
	await userEvent.click(
		within(dialog).getByTestId('calendar-appointment-save')
	);
	await waitFor(
		() =>
			expect(
				document.querySelector(
					'[data-testid="calendar-appointment-dialog"]'
				)
			).toBeNull(),
		SLOW
	);
};

export const Calendar: Story = {
	name: 'Calendar · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Starts the Kalender tour from Help with the practice area open (FE#2545). On the real "Meine Termine" the counsellor enters an appointment with the practice advice seeker, a second one with a Terminlink (a practice link to a reserved host), cancels one from "Als Nächstes", enters a Sperrzeit and switches "Buchungen automatisch bestätigen" on in the Sprechstunden. Every calendar request is answered in memory; only the completed progress is written.'
			}
		}
	},
	play: async ({ canvas, step }) => {
		const of = 7;
		const storageBefore = storageSnapshot();
		// The navigation's own real reads before the start are not practice.
		let practiceStart = 0;
		await step('Start the Kalender tour from its Help card', async () => {
			const card = (
				await canvas.findByRole('heading', { name: 'Kalender' }, SLOW)
			).closest('li')!;
			await userEvent.click(
				within(card).getByRole('button', { name: 'Starten' })
			);
		});
		await step('1: Read that this is an exercise', async () => {
			await expectStep(1, of);
			await expect(getPracticeSnapshot().status).toBe('active');
			practiceStart = requestLog.length;
			await next();
		});
		await step('2: Enter an appointment', async () => {
			await expectStep(2, of);
			await enterPracticeAppointment();
		});
		await step('3: Enter one with a Terminlink', async () => {
			await expectStep(3, of);
			await enterPracticeAppointment(true);
			const share = await calendarDialog('direct-link-share-dialog');
			await expect(
				within(share).getByDisplayValue(
					/^https:\/\/practice\.invalid\//
				)
			).toBeVisible();
			await userEvent.click(
				within(share).getByRole('button', { name: 'Schließen' })
			);
		});
		await step('4: Cancel one from "Als Nächstes"', async () => {
			await expectStep(4, of);
			await target('calendar-upcoming');
			const row = await waitFor(() => {
				const found = document.querySelector<HTMLElement>(
					'[data-tour-target="calendar-upcoming"] [data-cy^="calendar-upcoming-practice-appointment-"]'
				);
				expect(found).not.toBeNull();
				return found!;
			}, SLOW);
			await userEvent.click(row);
			await userEvent.click(
				await waitFor(() => {
					const item = document.querySelector<HTMLElement>(
						'[data-cy="calendar-entry-cancel"]'
					);
					expect(item).not.toBeNull();
					return item!;
				}, SLOW)
			);
			await userEvent.click(
				await screen.findByTestId('calendar-cancel-confirm', {}, SLOW)
			);
		});
		await step('5: Enter a Sperrzeit', async () => {
			await expectStep(5, of);
			await userEvent.click(await target('calendar-create'));
			await userEvent.click(
				await screen.findByRole('tab', { name: 'Sperrzeit' }, SLOW)
			);
			const dialog = await calendarDialog('calendar-blocker-dialog');
			await userEvent.click(
				within(dialog).getByTestId('calendar-blocker-save')
			);
		});
		await step(
			'6: Switch automatic confirmation on in the Sprechstunden',
			async () => {
				await expectStep(6, of);
				await userEvent.click(await target('calendar-settings'));
				await userEvent.click(
					await screen.findByText('Sprechstunden', {}, SLOW)
				);
				const dialog = await calendarDialog(
					'calendar-consultation-hours-dialog'
				);
				const autoAccept = within(dialog).getByTestId(
					'consultation-hours-auto-accept'
				);
				await userEvent.click(
					autoAccept.querySelector('input') ?? autoAccept
				);
				await userEvent.click(
					within(dialog).getByTestId('consultation-hours-save')
				);
			}
		);
		await step(
			`${of}: Finish and return to Help without outbound writes`,
			async () => {
				await expectStep(of, of);
				await expect(
					getPracticeNetworkGuard()?.blockedRequests
				).toEqual([]);
				await next('Fertig');
				await expectExited(canvas, storageBefore);
				// The practice calendar never reached the network.
				await expect(
					requestLog
						.slice(practiceStart)
						.filter(({ url }) =>
							/\/calendar\/|appointments|direct-invitations|directlinks/.test(
								url
							)
						)
				).toEqual([]);
			}
		);
	}
};
