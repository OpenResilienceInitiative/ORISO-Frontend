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
	featureSupervisionEnabled: true
};

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
const PracticeFlowStage = ({ teamDiscussion = false }) => {
	const store = useMemo(() => createStore(), []);
	const tenantFlags = useMemo(
		() => ({
			...TENANT_FLAGS,
			featureTeamDiscussionEnabled: teamDiscussion
		}),
		[teamDiscussion]
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
		() => practiceCounsellorFixture({ isWalkThroughEnabled: false }),
		[]
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
					'The practice area end to end (#1622): the real Help page, practice cards, tour host, banner, navigation, header and session views, wired as in `Routing.tsx`. Practice runs on the in-memory world. Every request that reaches the page is recorded; only the tutorial progress is answered, everything else fails like an unreachable backend.'
			}
		}
	},
	globals: { viewport: { value: 'desktop1440', isRotated: false } },
	args: { teamDiscussion: false },
	beforeEach: ({ args }) => {
		replaceTenantSettings({
			...TENANT_FLAGS,
			featureTeamDiscussionEnabled: args.teamDiscussion
		});
		return () => {
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
	const of = args.teamDiscussion ? 8 : 6;
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

	if (args.teamDiscussion) {
		await step('3: Open the team discussion', async () => {
			await expectStep(3, of);
			await userEvent.click(await target('enquiry-team-button'));
		});
		await step('4: Send a reply in the team discussion', async () => {
			await expectStep(4, of);
			const panel = await target('team-discussion-panel');
			await sendReply(panel, 'Ich übernehme das gern.');
			await expect(
				document.querySelector('.chatStage__mainPane')?.textContent
			).not.toContain('Ich übernehme das gern.');
		});
	}

	const acceptAt = args.teamDiscussion ? 5 : 3;
	await step(`${acceptAt}: Accept the enquiry`, async () => {
		await expectStep(acceptAt, of);
		if (!args.teamDiscussion) {
			await expect(
				document.querySelector(
					'[data-tour-target="enquiry-team-button"]'
				)
			).toBeNull();
		}
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
				story: 'Walks all eight acceptance steps with Team-Besprechung enabled. The team reply stays in its side thread; the case reply receives the scripted answer. Completion returns to Help with no practice writes outside the page.'
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

export const AddASupervisor: Story = {
	name: 'Add a supervisor · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Starts "Übung: Supervision hinzufügen" from Help, adds Robin through the real picker, reads the reply in the supervision thread, and finishes back on Help. No practice write reaches the real network, Matrix service or browser storage.'
			}
		}
	},
	play: async ({ canvas, step }) => {
		const storageBefore = storageSnapshot();
		await step('Start supervision from its Help card', async () => {
			const card = (
				await canvas.findByRole(
					'heading',
					{ name: 'Übung: Supervision hinzufügen' },
					SLOW
				)
			).closest('li')!;
			await userEvent.click(
				within(card).getByRole('button', { name: 'Übung starten' })
			);
		});
		await step(
			'1: Choose Robin, enter a reason and add the supervisor',
			async () => {
				await expectStep(1, 4);
				await expect(getPracticeSnapshot().status).toBe('active');
				await expect(
					canvas.queryByLabelText('Klassisches Design')
				).toBeNull();
				await userEvent.click(await target('session-supervisor-add'));
				await userEvent.click(
					await screen.findByRole('combobox', {}, SLOW)
				);
				await userEvent.click(
					await screen.findByRole(
						'option',
						{ name: 'Robin (Übung)' },
						SLOW
					)
				);
				await userEvent.type(
					screen.getByPlaceholderText(
						'Bitte geben Sie den Grund für die Supervision an...'
					),
					'Ich möchte mich zum Vorgehen absichern.'
				);
				await userEvent.click(
					screen.getByRole('button', { name: 'Hinzufügen' })
				);
			}
		);
		await step(
			'2: Read the supervisor reply in the side thread',
			async () => {
				await expectStep(2, 4);
				const panel = await target('supervision-panel');
				await waitFor(
					() =>
						expect(panel.textContent).toContain(
							'Das klingt gut so.'
						),
					SLOW
				);
				await expect(
					document.querySelector('.chatStage__mainPane')?.textContent
				).not.toContain('Das klingt gut so.');
				await next();
			}
		);
		await step('3: Read the standing assignment explanation', async () => {
			await expectStep(3, 4);
			await next();
		});
		await step(
			'4: Finish and return to Help without outbound writes',
			async () => {
				await expectStep(4, 4);
				await expect(
					getPracticeNetworkGuard()?.blockedRequests
				).toEqual([]);
				await next('Fertig');
				await expectExited(canvas, storageBefore);
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
				story: 'Uses only Tab, Enter and typing to start supervision, reach the real add button, choose Robin in the modal, and end practice while the picker is open. The permanent banner stays accessible and no practice data leaves the page.'
			}
		}
	},
	play: async ({ canvas, step }) => {
		const storageBefore = storageSnapshot();
		await step('Start supervision with Tab and Enter', async () => {
			const card = (
				await canvas.findByRole(
					'heading',
					{ name: 'Übung: Supervision hinzufügen' },
					SLOW
				)
			).closest('li')!;
			await tabTo(
				within(card).getByRole('button', { name: 'Übung starten' })
			);
			await userEvent.keyboard('{Enter}');
			await expectStep(1, 4);
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
			'Open the picker, choose Robin and type the reason with the keyboard',
			async () => {
				await userEvent.keyboard('{Enter}');
				const picker = await screen.findByRole('combobox', {}, SLOW);
				await tabTo(picker);
				await userEvent.keyboard('{Enter}');
				const robin = await screen.findByRole(
					'option',
					{ name: 'Robin (Übung)' },
					SLOW
				);
				await waitFor(() => expect(robin).toHaveFocus(), SLOW);
				await userEvent.keyboard('{Enter}');
				await expect(picker).toHaveTextContent('Robin (Übung)');
				const reason = screen.getByPlaceholderText(
					'Bitte geben Sie den Grund für die Supervision an...'
				);
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
