import * as React from 'react';
import { useLayoutEffect, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { createStore, Provider as JotaiProvider } from 'jotai';
import { expect, screen, userEvent, waitFor, within } from 'storybook/test';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';
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
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const request = new Request(input, init);
			requestLog.push({ method: request.method, url: request.url });
			if (request.url.includes(TUTORIAL_PROGRESS)) {
				return request.method === 'GET'
					? new Response('[]', {
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
const PracticeFlowStage = () => {
	const store = useMemo(() => createStore(), []);
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
									settings: TENANT_FLAGS
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

const SLOW = { timeout: 15000 };

/** The tour tooltip of the step on screen. */
const tooltip = () => screen.findByRole('alertdialog', {}, SLOW);

const progressText = () =>
	document.querySelector('.productTourTooltip__progress')?.textContent ?? '';

const expectStep = (step: number, of: number) =>
	waitFor(
		() => expect(progressText()).toMatch(new RegExp(`${step}\\D+${of}`)),
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
	beforeEach: () => {
		replaceTenantSettings(TENANT_FLAGS);
		return () => {
			replaceTenantSettings({});
		};
	}
} satisfies Meta<typeof PracticeFlowStage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AcceptAnEnquiry: Story = {
	name: 'Accept an enquiry · desktop',
	parameters: {
		docs: {
			description: {
				story: 'Starts "Übung: Anfrage annehmen" from its card and walks it with the real controls: open the practice enquiry, accept it, read the Erstantwort, send a reply, finish. Nothing but the allowlisted tutorial progress write leaves the page, the browser storage is unchanged, and the page returns to the Help page.'
			}
		}
	},
	play: async ({ canvas }) => {
		const card = (
			await canvas.findByRole(
				'heading',
				{ name: 'Übung: Anfrage annehmen' },
				SLOW
			)
		).closest('li')!;
		const storageBefore = storageSnapshot();

		await userEvent.click(
			within(card).getByRole('button', { name: 'Übung starten' })
		);

		// 1: the Anfragen icon in the navigation.
		await expectStep(1, 6);
		await expect(getPracticeSnapshot().status).toBe('active');
		await expect(canvas.queryByLabelText('Klassisches Design')).toBeNull();
		await userEvent.click(
			within(await tooltip()).getByRole('button', { name: 'Weiter' })
		);

		// 2: the practice enquiry in the real list; click it.
		await expectStep(2, 6);
		await userEvent.click(await target('enquiry-list-item'));

		// 3: the real accept button; click it.
		await expectStep(3, 6);
		await userEvent.click(await target('enquiry-accept-button'));

		// 4: the Erstantwort, explained.
		await expectStep(4, 6);
		await userEvent.click(
			within(await tooltip()).getByRole('button', { name: 'Weiter' })
		);

		// 5: the composer; a reply, answered by the script.
		await expectStep(5, 6);
		const composer = await target('session-composer');
		const editor = await waitFor(() => {
			const field = composer.querySelector<HTMLElement>(
				'.ProseMirror[contenteditable="true"]'
			);
			expect(field).not.toBeNull();
			return field!;
		}, SLOW);
		await userEvent.click(editor);
		await userEvent.keyboard('Hallo Sam, schön, dass Sie sich melden.');
		const send = await waitFor(() => {
			const button = within(
				document.querySelector<HTMLElement>('.chatStage__mainPane')!
			).getByRole('button', { name: 'Nachricht senden' });
			expect(button).toBeEnabled();
			return button;
		}, SLOW);
		await userEvent.click(send);
		await waitFor(
			() =>
				expect(
					document.querySelector('.chatStage__mainPane')?.textContent
				).toContain('Vielen Dank für Ihre Antwort'),
			SLOW
		);

		// 6: done.
		await expectStep(6, 6);
		await expect(getPracticeNetworkGuard()?.blockedRequests).toEqual([]);
		await userEvent.click(
			within(await tooltip()).getByRole('button', { name: 'Fertig' })
		);

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
			canvas.queryByRole('status', { name: 'Übungsmodus' })
		).toBeNull();

		// Only the allowlisted progress write left the page.
		await expect(
			requestLog.filter(
				({ method, url }) =>
					method !== 'GET' &&
					!(method === 'PUT' && url.includes(TUTORIAL_PROGRESS))
			)
		).toEqual([]);
		await expect(
			requestLog.some(
				({ method, url }) =>
					method === 'PUT' && url.includes(TUTORIAL_PROGRESS)
			)
		).toBe(true);
		await expect(
			requestLog.filter(({ url }) =>
				/(\/|=)-\d+(\/|&|$)|practice/.test(decodeURIComponent(url))
			)
		).toEqual([]);
		await expect(realMatrixWrites).toEqual([]);
		await expect(storageSnapshot()).toEqual(storageBefore);
	}
};
