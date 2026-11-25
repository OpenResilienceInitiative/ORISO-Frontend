// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { tourLaunchRequestAtom } from '../productTour/tourLaunchState';
import { Context as ResponsiveContext } from 'react-responsive';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import {
	AppConfigContext,
	AUTHORITIES,
	NotificationsContext,
	TenantContext,
	UserDataContext
} from '../../globalState';
import { isTabGroup, solveCondition } from '../../utils/tabsHelper';
import { ProfileCardList } from './ProfileCardList';
import { profileRoutesHelp } from './profileHelp.routes';
import { PracticeCards } from '../../practice/PracticeCards';
import { practiceTours } from '../../practice/practiceTours';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import(
		'../../practice/practiceTestTranslate'
	);
	return { useTranslation: () => ({ t: makeTranslate() }) };
});

interface HelpScenario {
	allHelp?: boolean;
	width?: number;
	practiceArea?: boolean;
	platformTours?: boolean;
	authorities?: string[];
	supervision?: boolean;
	oneOnOne?: boolean;
}
let savedPreference = false;

const renderHelp = ({
	allHelp = false,
	width = 1440,
	practiceArea = true,
	platformTours = true,
	authorities = [AUTHORITIES.CONSULTANT_DEFAULT],
	supervision = true,
	oneOnOne = true
}: HelpScenario = {}) => {
	const store = createStore();
	const settings = {
		enableWalkthrough: platformTours,
		urls: { toLogin: 'http://localhost/login' },
		releaseToggles: { enablePracticeArea: practiceArea }
	};
	const Stage = () => {
		const [ownSwitch, setOwnSwitch] = React.useState(false);
		const userData = {
			userId: 'help-user',
			grantedAuthorities: authorities,
			isWalkThroughEnabled: ownSwitch
		};
		const elements = profileRoutesHelp(settings as never)
			.filter(
				(element) =>
					allHelp ||
					(isTabGroup(element) && element.url === '/rundgaenge')
			)
			.flatMap((element) =>
				isTabGroup(element) ? element.elements : element
			)
			.filter((element) =>
				solveCondition(element.condition, userData, [])
			);
		return (
			<Provider store={store}>
				<ResponsiveContext.Provider value={{ width }}>
					<AppConfigContext.Provider value={settings as never}>
						<UserDataContext.Provider
							value={
								{
									userData,
									reloadUserData: async () =>
										setOwnSwitch(savedPreference)
								} as never
							}
						>
							<TenantContext.Provider
								value={
									{
										tenant: {
											settings: {
												featureSupervisionEnabled:
													supervision,
												featureSupervisionOneOnOneChatsEnabled:
													oneOnOne
											}
										}
									} as never
								}
							>
								<NotificationsContext.Provider
									value={
										{ addNotification: vi.fn() } as never
									}
								>
									<ProfileCardList elements={elements} />
								</NotificationsContext.Provider>
							</TenantContext.Provider>
						</UserDataContext.Provider>
					</AppConfigContext.Provider>
				</ResponsiveContext.Provider>
			</Provider>
		);
	};
	return { store, ...render(<Stage />) };
};

beforeEach(() => {
	savedPreference = false;
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: Request) => {
			if (input.method === 'PATCH') {
				savedPreference = JSON.parse(
					await input.text()
				).walkThroughEnabled;
				return new Response('{}', { status: 200 });
			}
			return new Response('[]', { status: 200 });
		})
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('Help learning card', () => {
	it('presents the learning actions before Video-Call in the Help reading order', async () => {
		renderHelp({ allHelp: true });
		await screen.findAllByRole('button', { name: 'Übung starten' });
		const cards = screen.getAllByTestId('profile-card');
		expect(cards).toHaveLength(2);
		expect(
			within(cards[0]).getByRole('heading', { name: 'Meine Rundgänge' })
		).toBeTruthy();
		expect(
			within(cards[0]).getAllByRole('button', { name: 'Starten' })
		).not.toHaveLength(0);
		expect(
			within(cards[1]).getByRole('heading', { name: 'Video-Call' })
		).toBeTruthy();
	});

	it('keeps standalone fictional-data summaries and short Help summaries separate', async () => {
		render(
			<PracticeCards
				tours={practiceTours}
				isPhone={false}
				loadProgress={async () => []}
				onStartTour={() => {}}
			/>
		);
		await screen.findAllByRole('button', { name: 'Übung starten' });
		// F1 only: Supervision is a topic tour since FE#2545.
		expect(
			screen.getAllByText(/Alle Personen und Inhalte sind erfunden\./)
		).toHaveLength(1);
		cleanup();
		renderHelp();
		await screen.findAllByRole('button', { name: 'Übung starten' });
		expect(
			screen.getByText(
				'Eine Anfrage annehmen und eine erste Antwort schreiben.'
			)
		).toBeTruthy();
		expect(
			screen.queryByText(/Alle Personen und Inhalte sind erfunden\./)
		).toBeNull();
		expect(screen.getByText(/an einem erfundenen Fall/)).toBeTruthy();
	});

	it('keeps manual learning actions with the auto-start control in one card', async () => {
		renderHelp();
		await screen.findAllByRole('button', { name: 'Übung starten' });
		const card = screen
			.getByRole('heading', { name: 'Meine Rundgänge' })
			.closest('section')!;
		const content = within(card);
		expect(
			content.getByRole('switch', {
				name: 'Einführung automatisch starten'
			})
		).toBeTruthy();
		expect(
			content.getAllByRole('button', { name: 'Übung starten' })
		).toHaveLength(1);
		// FE#2545: Supervision is a topic tour, no "Übung:" card any more.
		expect(
			content.getByRole('heading', { name: 'Supervision' })
		).toBeTruthy();
		// The introduction plus every topic tour of the role, one row each;
		// the topic packages add more rows, so only the floor is fixed here.
		expect(
			content.getAllByRole('button', { name: 'Starten' }).length
		).toBeGreaterThanOrEqual(2);
		expect(
			content.getByRole('heading', { name: 'Mail-Beratung' })
		).toBeTruthy();
		expect(
			content.getByRole('switch', { name: 'Rundgang-Knopf anzeigen' })
		).toBeTruthy();
	});

	it('gives advice seekers the launcher switch without counsellor-only parts', async () => {
		renderHelp({ authorities: [AUTHORITIES.ASKER_DEFAULT] });
		const card = (
			await screen.findByRole('heading', { name: 'Meine Rundgänge' })
		).closest('section')!;
		const content = within(card);
		expect(
			content.getByRole('switch', { name: 'Rundgang-Knopf anzeigen' })
		).toBeTruthy();
		expect(
			content.queryByRole('switch', {
				name: 'Einführung automatisch starten'
			})
		).toBeNull();
		expect(
			content.queryByRole('heading', { name: 'Einführung' })
		).toBeNull();
		expect(
			content.queryByRole('button', { name: 'Übung starten' })
		).toBeNull();
	});

	it('hides the "?" launcher for this user when the switch is turned off', async () => {
		renderHelp();
		const toggle = await screen.findByRole('switch', {
			name: 'Rundgang-Knopf anzeigen'
		});
		expect(
			toggle.getAttribute('aria-checked') ??
				(toggle as HTMLInputElement).checked.toString()
		).toBe('true');
		fireEvent.click(toggle);
		await waitFor(() =>
			expect(
				window.localStorage.getItem(
					'oriso.tourLauncher.hidden.help-user'
				)
			).toBe('true')
		);
		fireEvent.click(toggle);
		await waitFor(() =>
			expect(
				window.localStorage.getItem(
					'oriso.tourLauncher.hidden.help-user'
				)
			).toBeNull()
		);
	});

	it('offers only the introduction when the practice release flag is off', async () => {
		renderHelp({ practiceArea: false });
		await screen.findAllByRole('button', { name: 'Starten' });
		expect(
			screen.getByRole('heading', { name: 'Einführung' })
		).toBeTruthy();
		expect(
			screen.queryByRole('heading', { name: 'Übungsbereich' })
		).toBeNull();
		// Supervision exists only as practice (FE#2545).
		expect(
			screen.queryByRole('heading', { name: 'Supervision' })
		).toBeNull();
	});

	it('starts the introduction and each exercise by hand with auto-start off', async () => {
		const { store } = renderHelp();
		await screen.findAllByRole('button', { name: 'Übung starten' });
		for (const [heading, action, id] of [
			['Einführung', 'Starten', 'consultant-walkthrough'],
			[
				'Übung: Anfrage annehmen',
				'Übung starten',
				'consultant-practice-accept'
			],
			['Supervision', 'Starten', 'consultant-practice-supervision']
		]) {
			const tile = screen
				.getByRole('heading', { name: heading })
				.closest('li')!;
			fireEvent.click(within(tile).getByRole('button', { name: action }));
			expect(store.get(tourLaunchRequestAtom)).toMatchObject({
				tourId: id,
				mode: 'start'
			});
		}
	});

	it('saves the subordinate auto-start preference while manual options stay available', async () => {
		renderHelp();
		await screen.findAllByRole('button', { name: 'Übung starten' });
		const toggle = screen.getByRole('switch', {
			name: 'Einführung automatisch starten'
		}) as HTMLInputElement;
		fireEvent.click(toggle);
		await waitFor(() => expect(toggle.checked).toBe(true));
		expect(screen.getByText(/^An: Der Einführungsrundgang/)).toBeTruthy();
		expect(
			screen
				.getAllByRole('button', { name: 'Übung starten' })
				.every((button) => !(button as HTMLButtonElement).disabled)
		).toBe(true);
	});

	it.each([{ supervision: false }, { oneOnOne: false }])(
		'hides the Supervision card where the tenant cannot offer its practice: %j',
		async (scenario) => {
			renderHelp(scenario);
			await screen.findByRole('button', { name: 'Übung starten' });
			expect(
				screen.queryByRole('heading', { name: 'Supervision' })
			).toBeNull();
		}
	);

	it.each([
		{
			width: 1199,
			acceptDisabled: false,
			supervisionHint:
				'Bitte vergrößern Sie das Browserfenster für diese Übung.'
		},
		{ width: 1200, acceptDisabled: false, supervisionHint: null },
		{
			width: 390,
			acceptDisabled: true,
			supervisionHint: 'Bitte üben Sie am Computer.'
		}
	])(
		'preserves the practice viewport gates at $width px',
		async ({ width, acceptDisabled, supervisionHint }) => {
			renderHelp({ width });
			await screen.findAllByRole('button', { name: 'Übung starten' });
			const disabled = (name: string) =>
				(
					within(
						screen.getByRole('heading', { name }).closest('li')!
					).getByRole('button') as HTMLButtonElement
				).disabled;
			expect(disabled('Übung: Anfrage annehmen')).toBe(acceptDisabled);
			// FE#2545: the Supervision topic tour exists only as practice;
			// below its width its card shows the hint and cannot start.
			const supervision = screen
				.getByRole('heading', { name: 'Supervision' })
				.closest('li')!;
			expect(disabled('Supervision')).toBe(supervisionHint !== null);
			if (supervisionHint) {
				expect(
					within(supervision).getByText(supervisionHint)
				).toBeTruthy();
			} else {
				expect(
					supervision.querySelector('.tourOverview__hint')
				).toBeNull();
			}
			expect(
				screen.queryByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeNull();
		}
	);

	it.each([
		{ platformTours: false },
		{ authorities: [AUTHORITIES.ANONYMOUS_DEFAULT] }
	])(
		'hides the whole learning card without platform access or a tour audience: %j',
		(scenario) => {
			renderHelp(scenario);
			expect(
				screen.queryByRole('heading', { name: 'Meine Rundgänge' })
			).toBeNull();
			expect(screen.queryByRole('switch')).toBeNull();
		}
	);
});
