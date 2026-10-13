import * as React from 'react';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Profile } from './Profile';
import { HelpToursSection } from './HelpToursSection';
import { NavigationBar } from '../app/NavigationBar';
import { RouterConfigConsultant } from '../app/RouterConfig';
import {
	NavigationStoryProviders,
	storybookSettings
} from '../app/navigationStoryHelpers';
import { Header } from '../header/Header';
import '../app/authenticatedApp.styles.scss';
import '../app/navigation.styles.scss';
import {
	AppConfigContext,
	AUTHORITIES,
	ConsultingTypesContext,
	UserDataContext,
	TenantContext
} from '../../globalState';
import { config } from '../../resources/scripts/config';
import { consultantWalkthroughTour } from '../productTour/tourDefinitions';
import type { ITutorialProgressItem } from '../../api/apiTutorialProgress';
import { APP_ORISO_FIGMA_URL } from '../storybookDesignLinks';

type ProgressFixture = Pick<
	ITutorialProgressItem,
	'tourId' | 'tourVersion' | 'surface' | 'status'
>[];

interface StageOptions {
	/** Platform master switch (`settings.enableWalkthrough`). */
	platformTours?: boolean;
	/** The counsellor's own switch (`userData.isWalkThroughEnabled`). */
	ownSwitch?: boolean;
	/** Release flag `releaseToggles.enablePracticeArea` (#1622), off by default. */
	practiceArea?: boolean;
	/** Tenant-level feature gate. */
	supervision?: boolean;
	progress?: ProgressFixture;
}

const counsellor = (isWalkThroughEnabled: boolean) => ({
	userId: 'sb-counsellor',
	userName: 'mara.berger',
	firstName: 'Mara',
	lastName: 'Berger',
	displayName: 'Mara Berger',
	email: 'mara.berger@example.org',
	grantedAuthorities: [AUTHORITIES.CONSULTANT_DEFAULT],
	agencies: [],
	languages: ['de'],
	isWalkThroughEnabled,
	twoFactorAuth: {
		isEnabled: false,
		isActive: false,
		isShown: false,
		isToBeActivated: false,
		secret: '',
		qrCode: ''
	}
});

const json = (body: unknown) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});

/**
 * Serves the two calls the Tours area makes — the versioned progress read and
 * the switch PATCH — so the switch round-trips like on Dev. Installed in a
 * layout effect: it runs before the carousel's passive-effect fetch, and the
 * cleanup restores `fetch` even when React abandons a render.
 */
const StubbedToursApi = ({
	options,
	children
}: {
	options: StageOptions;
	children: (
		ownSwitch: boolean,
		reload: () => Promise<unknown>
	) => React.ReactNode;
}) => {
	const [ownSwitch, setOwnSwitch] = useState(!!options.ownSwitch);
	const server = useMemo(() => ({ ownSwitch: !!options.ownSwitch }), []); // eslint-disable-line react-hooks/exhaustive-deps

	useLayoutEffect(() => {
		const realFetch = window.fetch;
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const url = String(
				typeof input === 'string' || input instanceof URL
					? input
					: input.url
			);
			// fetchData passes a Request, so method and body live on it.
			const request = new Request(input, init);
			if (url.includes('/service/users/tutorials/progress')) {
				return json(options.progress ?? []);
			}
			if (
				url.includes('/service/users/data') &&
				request.method === 'PATCH'
			) {
				const body = JSON.parse((await request.text()) || '{}');
				server.ownSwitch = !!body.walkThroughEnabled;
				return json({});
			}
			return realFetch(input as RequestInfo, init);
		}) as typeof window.fetch;
		return () => {
			window.fetch = realFetch;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	const reload = useCallback(async () => {
		setOwnSwitch(server.ownSwitch);
		return null;
	}, [server]);

	return <>{children(ownSwitch, reload)}</>;
};

/**
 * The authenticated app shell as `Routing.tsx` builds it: navigation, header
 * and the profile column. The production SCSS decides the layout by viewport
 * width, so a phone gets the bottom navigation bar and a desktop the rail.
 */
const AppShell = ({ children }: { children: React.ReactNode }) => {
	const routerConfig = useMemo(
		() => RouterConfigConsultant({ ...config, ...storybookSettings }),
		[]
	);
	return (
		<div className="app__wrapper" style={{ height: '100vh' }}>
			<NavigationStoryProviders role="consultant">
				<NavigationBar
					routerConfig={routerConfig}
					onLogout={() => {}}
				/>
			</NavigationStoryProviders>
			<section className="contentWrapper">
				<Header />
				<div className="contentWrapper__content">
					<div className="contentWrapper__profile">{children}</div>
				</div>
			</section>
		</div>
	);
};

const renderStage = (options: StageOptions) => () => (
	<StubbedToursApi options={options}>
		{(ownSwitch, reload) => (
			<AppConfigContext.Provider
				value={{
					...config,
					enableWalkthrough: options.platformTours ?? true,
					releaseToggles: {
						...config.releaseToggles,
						enablePracticeArea: options.practiceArea ?? false
					}
				}}
			>
				<ConsultingTypesContext.Provider
					value={{
						consultingTypes: [],
						setConsultingTypes: () => {}
					}}
				>
					<UserDataContext.Provider
						value={
							{
								userData: counsellor(ownSwitch),
								setUserData: () => undefined,
								reloadUserData: reload
							} as never
						}
					>
						<TenantContext.Provider
							value={
								{
									tenant: {
										settings: {
											featureSupervisionEnabled:
												options.supervision ?? true
										}
									}
								} as never
							}
						>
							<AppShell>
								<Routes>
									<Route
										path="/profile/*"
										element={<Profile />}
									/>
								</Routes>
							</AppShell>
						</TenantContext.Provider>
					</UserDataContext.Provider>
				</ConsultingTypesContext.Provider>
			</AppConfigContext.Provider>
		)}
	</StubbedToursApi>
);

const SWITCH_NAME = 'Einführung automatisch starten';
const HINT_OFF =
	'Aus: Rundgänge starten nicht von selbst. Sie können sie hier jederzeit starten.';
const HINT_ON =
	'An: Der Einführungsrundgang startet von selbst, bis Sie ihn abgeschlossen oder übersprungen haben. Alle Rundgänge können Sie hier jederzeit starten.';

type Canvas = Parameters<NonNullable<Story['play']>>[0]['canvas'];

/** Switch, state word and hint have to tell the same story. */
const expectSwitchState = async (canvas: Canvas, on: boolean) => {
	const toggle = await canvas.findByRole('switch', { name: SWITCH_NAME });
	if (on) {
		await expect(toggle).toBeChecked();
	} else {
		await expect(toggle).not.toBeChecked();
	}
	await expect(canvas.getByText(on ? 'An' : 'Aus')).toBeVisible();
	await expect(canvas.getByText(on ? HINT_ON : HINT_OFF)).toBeVisible();
	await expect(canvas.queryByText(on ? HINT_OFF : HINT_ON)).toBeNull();
};

/** On a phone the app's navigation sits as a bar at the bottom edge. */
const expectBottomNavigation = async (canvasElement: HTMLElement) => {
	const nav = canvasElement.querySelector<HTMLElement>(
		'.navigation__wrapper'
	);
	await expect(nav).not.toBeNull();
	await expect(nav).toBeVisible();
	// Only a viewport below the app's 900 px breakpoint lays it out as a bar.
	if (window.innerWidth < 900) {
		const bar = nav!.getBoundingClientRect();
		await expect(Math.round(bar.bottom)).toBeGreaterThanOrEqual(
			window.innerHeight - 1
		);
		await expect(Math.round(bar.width)).toBe(window.innerWidth);
	}
};

const desktop = {
	globals: { viewport: { value: 'desktop1440', isRotated: false } },
	parameters: { router: { initialPath: '/profile/hilfe' } }
};

const phone = (path: string) => ({
	globals: { viewport: { value: 'phone390', isRotated: false } },
	parameters: { router: { initialPath: path } }
});

/**
 * Profile → Help → Tours, wired exactly like the app: the app shell with its
 * navigation (bottom bar on a phone), the real `Profile` page, the real Help
 * routes and the real switch and tour list. Only the two backend calls are
 * stubbed.
 */
const meta = {
	title: 'Organisms/HelpTours',
	component: Profile,
	subcomponents: { HelpToursSection },
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		design: { type: 'figma', url: APP_ORISO_FIGMA_URL },
		docs: {
			description: {
				component:
					'The introduction and practice exercises share one My tours card (#1622). Each counsellor decides whether the introduction starts on its own (#1526). The subordinate switch lives inside My tours under Profile → Help and is **off by default**. Off only stops the automatic start: the manual learning options in the same card stay visible ("disable, don\'t hide"). On, only the introduction starts on its own once per tour version, and not again after it was completed or skipped. The platform switch `enableWalkthrough` still gates everything: off, the Tours area is gone.'
			}
		}
	}
} satisfies Meta<typeof Profile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OffByDefault: Story = {
	name: 'Off (default) · desktop',
	...desktop,
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		await expectSwitchState(canvas, false);
		const card = canvas
			.getByRole('heading', { name: 'Meine Rundgänge' })
			.closest('section')!;
		await expect(
			within(card).getByRole('switch', { name: SWITCH_NAME })
		).toBeInTheDocument();
		await expect(within(card).getByText(SWITCH_NAME)).toBeVisible();
		await expect(
			await within(card).findByRole('heading', { name: 'Einführung' })
		).toBeVisible();
		await expect(
			canvas.queryByRole('heading', { name: 'Mail-Beratung' })
		).toBeNull();
		// The introduction stays available by hand while auto-start is off.
		const startButtons = await canvas.findAllByRole('button', {
			name: 'Starten'
		});
		for (const button of startButtons) {
			await expect(button).toBeEnabled();
		}
	}
};

export const SwitchingOn: Story = {
	name: 'Switching on · desktop',
	...desktop,
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas }) => {
		await expectSwitchState(canvas, false);
		const toggle = await canvas.findByRole('switch', { name: SWITCH_NAME });
		toggle.focus();
		await userEvent.keyboard(' ');
		await waitFor(() =>
			expect(
				canvas.getByRole('switch', { name: SWITCH_NAME })
			).toBeChecked()
		);
		await expectSwitchState(canvas, true);
	}
};

export const On: Story = {
	name: 'On · desktop',
	...desktop,
	render: renderStage({ ownSwitch: true }),
	play: async ({ canvas }) => {
		await expectSwitchState(canvas, true);
	}
};

export const OnWithCompletedTour: Story = {
	name: 'On, intro tour already completed · desktop',
	...desktop,
	render: renderStage({
		ownSwitch: true,
		progress: [
			{
				tourId: consultantWalkthroughTour.id,
				tourVersion: consultantWalkthroughTour.version,
				surface: 'frontend',
				status: 'completed'
			}
		]
	}),
	parameters: {
		...desktop.parameters,
		docs: {
			description: {
				story: 'The completed intro does not start again on its own. The list offers "Neu starten" instead.'
			}
		}
	},
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByText('Abgeschlossen')
		).toBeInTheDocument();
	}
};

export const PlatformSwitchOff: Story = {
	name: 'Platform switch off · desktop',
	...desktop,
	render: renderStage({ platformTours: false, ownSwitch: true }),
	play: async ({ canvas }) => {
		await canvas.findByRole('tab', { name: 'Hilfe' });
		// The navigation has its own Live Chat switch; only ours must be gone.
		await expect(
			canvas.queryByRole('switch', { name: SWITCH_NAME })
		).toBeNull();
		await expect(canvas.queryByText('Meine Rundgänge')).toBeNull();
	}
};

export const PhoneHelpMenu: Story = {
	name: 'Help menu · phone 390',
	...phone('/profile/hilfe'),
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas, canvasElement }) => {
		const tours = await canvas.findByRole('link', { name: /Rundgänge/ });
		await expect(tours).toBeVisible();
		const videoCall = canvas.getByRole('link', { name: /Video-Call/ });
		await expect(
			tours.compareDocumentPosition(videoCall) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		await expectBottomNavigation(canvasElement);
		tours.focus();
		await userEvent.keyboard('{Enter}');
		await expect(
			await canvas.findByRole('heading', { name: 'Meine Rundgänge' })
		).toBeVisible();
	}
};

export const PhoneOff: Story = {
	name: 'Off (default) · phone 390',
	...phone('/profile/hilfe/rundgaenge'),
	render: renderStage({ ownSwitch: false }),
	play: async ({ canvas, canvasElement }) => {
		await expectSwitchState(canvas, false);
		await expectBottomNavigation(canvasElement);
	}
};

export const PhoneOn: Story = {
	name: 'On · phone 390',
	...phone('/profile/hilfe/rundgaenge'),
	render: renderStage({ ownSwitch: true }),
	play: async ({ canvas, canvasElement }) => {
		await expectSwitchState(canvas, true);
		await expectBottomNavigation(canvasElement);
	}
};

export const PracticeCardsOn: Story = {
	name: 'Practice cards on, personal switch off · desktop',
	...desktop,
	parameters: {
		...desktop.parameters,
		docs: {
			description: {
				story: 'With the release flag `enablePracticeArea` on, the practice flows (#1622) join the introduction inside the same outer My tours card, marked "Übung". Start works with the personal switch off.'
			}
		}
	},
	render: renderStage({ ownSwitch: false, practiceArea: true }),
	play: async ({ canvas }) => {
		await expectSwitchState(canvas, false);
		const card = canvas
			.getByRole('heading', { name: 'Meine Rundgänge' })
			.closest('section')!;
		const learning = within(card);
		const videoCard = canvas
			.getByRole('heading', { name: 'Video-Call' })
			.closest('section')!;
		await expect(card.getBoundingClientRect().left).toBeLessThan(
			videoCard.getBoundingClientRect().left
		);
		await expect(
			learning.getByRole('switch', { name: SWITCH_NAME })
		).toBeInTheDocument();
		await expect(learning.getByText(SWITCH_NAME)).toBeVisible();
		await expect(
			await learning.findByRole('heading', { name: 'Einführung' })
		).toBeVisible();
		await expect(
			learning.queryByRole('heading', { name: 'Mail-Beratung' })
		).toBeNull();
		await expect(
			await learning.findAllByRole('button', { name: 'Übung starten' })
		).toHaveLength(2);
		await expect(
			await learning.findByRole('heading', { name: 'Übungsbereich' })
		).toBeVisible();
		for (const button of await canvas.findAllByRole('button', {
			name: 'Übung starten'
		})) {
			await expect(button).toBeEnabled();
		}
	}
};

export const PracticeCardsPhone: Story = {
	name: 'Practice cards on · phone 390',
	...phone('/profile/hilfe/rundgaenge'),
	render: renderStage({ practiceArea: true }),
	play: async ({ canvas, canvasElement }) => {
		await expectSwitchState(canvas, false);
		const card = canvas
			.getByRole('heading', { name: 'Meine Rundgänge' })
			.closest<HTMLElement>('.profile__item')!;
		await expect(
			within(card).getByRole('switch', { name: SWITCH_NAME })
		).toBeInTheDocument();
		await expect(within(card).getByText(SWITCH_NAME)).toBeVisible();
		await expect(
			await within(card).findAllByRole('button', {
				name: 'Übung starten'
			})
		).toHaveLength(2);
		if (window.innerWidth < 900) {
			for (const button of within(card).getAllByRole('button', {
				name: 'Übung starten'
			})) {
				await expect(button).toBeDisabled();
			}
		}
		await expectBottomNavigation(canvasElement);
	}
};

export const PracticeSupervisionOff: Story = {
	name: 'One learning card, supervision disabled by tenant',
	...desktop,
	render: renderStage({ practiceArea: true, supervision: false }),
	play: async ({ canvas }) => {
		await expect(
			await canvas.findByRole('heading', {
				name: 'Übung: Anfrage annehmen'
			})
		).toBeVisible();
		await expect(
			canvas.queryByRole('heading', {
				name: 'Übung: Supervision hinzufügen'
			})
		).toBeNull();
		await expect(
			canvas.queryByRole('heading', { name: 'Mail-Beratung' })
		).toBeNull();
	}
};
