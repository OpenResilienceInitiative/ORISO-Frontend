// @vitest-environment jsdom
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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
}
let savedPreference = false;

const renderHelp = ({
	allHelp = false,
	width = 1440,
	practiceArea = true,
	platformTours = true,
	authorities = [AUTHORITIES.CONSULTANT_DEFAULT],
	supervision = true
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
													supervision
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
			within(cards[0]).getByRole('button', { name: 'Starten' })
		).toBeTruthy();
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
		expect(
			screen.getAllByText(/Alle Personen und Inhalte sind erfunden\./)
		).toHaveLength(2);
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
		).toHaveLength(2);
		expect(
			content.getAllByRole('button', { name: 'Starten' })
		).toHaveLength(1);
		expect(
			content.queryByRole('heading', { name: 'Mail-Beratung' })
		).toBeNull();
	});

	it('offers only the introduction when the practice release flag is off', async () => {
		renderHelp({ practiceArea: false });
		await screen.findByRole('button', { name: 'Starten' });
		expect(
			screen.getByRole('heading', { name: 'Einführung' })
		).toBeTruthy();
		expect(
			screen.queryByRole('heading', { name: 'Mail-Beratung' })
		).toBeNull();
		expect(
			screen.queryByRole('heading', { name: 'Übungsbereich' })
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
			[
				'Übung: Supervision hinzufügen',
				'Übung starten',
				'consultant-practice-supervision'
			]
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

	it('hides supervision when the tenant switched it off', async () => {
		renderHelp({ supervision: false });
		await screen.findByRole('button', { name: 'Übung starten' });
		expect(
			screen.queryByRole('heading', {
				name: 'Übung: Supervision hinzufügen'
			})
		).toBeNull();
	});

	it.each([
		{ width: 1199, acceptDisabled: false, supervisionDisabled: true },
		{ width: 1200, acceptDisabled: false, supervisionDisabled: false },
		{ width: 390, acceptDisabled: true, supervisionDisabled: true }
	])(
		'preserves the practice viewport gates at $width px',
		async ({ width, acceptDisabled, supervisionDisabled }) => {
			renderHelp({ width });
			await screen.findAllByRole('button', { name: 'Übung starten' });
			const disabled = (name: string) =>
				(
					within(
						screen.getByRole('heading', { name }).closest('li')!
					).getByRole('button') as HTMLButtonElement
				).disabled;
			expect(disabled('Übung: Anfrage annehmen')).toBe(acceptDisabled);
			expect(disabled('Übung: Supervision hinzufügen')).toBe(
				supervisionDisabled
			);
		}
	);

	it.each([
		{ platformTours: false },
		{ authorities: [AUTHORITIES.ASKER_DEFAULT] }
	])(
		'hides the whole learning card without platform or counsellor access: %j',
		(scenario) => {
			renderHelp(scenario);
			expect(
				screen.queryByRole('heading', { name: 'Meine Rundgänge' })
			).toBeNull();
			expect(screen.queryByRole('switch')).toBeNull();
		}
	);
});
