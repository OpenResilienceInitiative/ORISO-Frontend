// @vitest-environment jsdom
import React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within
} from '@testing-library/react';
import { createStore, Provider } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AppConfigContext,
	AUTHORITIES,
	TenantContext,
	UserDataContext
} from '../globalState';
import { tourLaunchRequestAtom } from '../components/productTour/tourLaunchState';
import { versionedTourProgressRepository } from '../components/productTour/versionedTourProgressRepository';
import { PracticeOverviewSection } from './PracticeOverviewSection';

vi.mock('react-i18next', async () => {
	const { makeTranslate } = await import('./practiceTestTranslate');
	const t = makeTranslate();
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});

// The globalState barrel pulls lottie (crashes in jsdom): stub the player.
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../components/productTour/versionedTourProgressRepository', () => ({
	versionedTourProgressRepository: {
		getProgress: vi.fn(() => Promise.resolve([])),
		saveProgress: vi.fn(() => Promise.resolve())
	}
}));

const phone = vi.hoisted(() => ({ value: false }));
vi.mock('../hooks/useResponsive', () => ({
	useResponsive: () => ({ untilM: phone.value })
}));

interface Scenario {
	enableWalkthrough?: boolean;
	releaseToggles?: Record<string, unknown>;
	authorities?: string[];
	ownSwitch?: boolean;
	tenant?: Record<string, unknown> | null;
}

const tree = ({
	enableWalkthrough = true,
	releaseToggles = { enablePracticeArea: true },
	authorities = [AUTHORITIES.CONSULTANT_DEFAULT],
	ownSwitch = false,
	tenant = {}
}: Scenario = {}) => (
	<AppConfigContext.Provider
		value={{ enableWalkthrough, releaseToggles } as never}
	>
		<UserDataContext.Provider
			value={
				{
					userData: {
						grantedAuthorities: authorities,
						isWalkThroughEnabled: ownSwitch
					}
				} as never
			}
		>
			<TenantContext.Provider
				value={
					tenant ? ({ tenant: { settings: tenant } } as never) : null
				}
			>
				<PracticeOverviewSection />
			</TenantContext.Provider>
		</UserDataContext.Provider>
	</AppConfigContext.Provider>
);

const renderSection = (scenario?: Scenario) => {
	const store = createStore();
	const utils = render(<Provider store={store}>{tree(scenario)}</Provider>);
	const rerenderWith = (next: Scenario) =>
		utils.rerender(<Provider store={store}>{tree(next)}</Provider>);
	return { store, rerenderWith, ...utils };
};

afterEach(() => {
	cleanup();
	phone.value = false;
	vi.clearAllMocks();
});

describe('PracticeOverviewSection (T10)', () => {
	it('starts a flow by hand with the personal tutorial switch off', async () => {
		const { store } = renderSection({ ownSwitch: false });

		fireEvent.click(
			within(
				(
					await screen.findByRole('heading', {
						name: 'Übung: Anfrage annehmen'
					})
				).closest('li') as HTMLElement
			).getByRole('button', { name: 'Übung starten' })
		);

		expect(store.get(tourLaunchRequestAtom)).toEqual({
			tourId: 'consultant-practice-accept',
			mode: 'start',
			requestedAt: expect.any(Number)
		});
	});

	it('restarts a finished flow through the same launch request', async () => {
		vi.mocked(
			versionedTourProgressRepository.getProgress
		).mockResolvedValueOnce([
			{
				tourId: 'consultant-practice-accept',
				tourVersion: 1,
				surface: 'frontend',
				status: 'completed'
			}
		] as never);
		const { store } = renderSection();

		const accept = (
			await screen.findByRole('heading', {
				name: 'Übung: Anfrage annehmen'
			})
		).closest('li') as HTMLElement;
		expect(within(accept).getByText('Abgeschlossen')).toBeTruthy();
		fireEvent.click(
			within(accept).getByRole('button', { name: 'Noch einmal üben' })
		);

		expect(store.get(tourLaunchRequestAtom)?.mode).toBe('restart');
	});

	it('is hidden while the platform master switch is off', async () => {
		const { container } = renderSection({ enableWalkthrough: false });
		await Promise.resolve();

		expect(container.innerHTML).toBe('');
	});

	it.each([
		['unset', {}],
		['off', { enablePracticeArea: false }]
	])(
		'is hidden while the release flag is %s',
		async (_name, releaseToggles) => {
			const { container } = renderSection({ releaseToggles });
			await Promise.resolve();

			expect(container.innerHTML).toBe('');
		}
	);

	it('is hidden from advice seekers', async () => {
		const { container } = renderSection({
			authorities: [AUTHORITIES.ASKER_DEFAULT]
		});
		await Promise.resolve();

		expect(container.innerHTML).toBe('');
	});

	describe('Supervision card', () => {
		it('is offered while the tenant never switched the feature off', async () => {
			renderSection({ tenant: {} });

			expect(
				await screen.findByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeTruthy();
		});

		it('is offered without any tenant data (unset means on)', async () => {
			renderSection({ tenant: null });

			expect(
				await screen.findByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeTruthy();
		});

		it('is hidden, not greyed, when the tenant switched Supervision off', async () => {
			renderSection({ tenant: { featureSupervisionEnabled: false } });

			expect(
				await screen.findByRole('heading', {
					name: 'Übung: Anfrage annehmen'
				})
			).toBeTruthy();
			expect(
				screen.queryByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeNull();
			expect(screen.queryByText(/Supervisor:in hinzuzufügen/)).toBeNull();
		});

		it('follows the tenant switch while the page is open', async () => {
			const { rerenderWith } = renderSection({ tenant: {} });
			await screen.findByRole('heading', {
				name: 'Übung: Supervision hinzufügen'
			});

			rerenderWith({ tenant: { featureSupervisionEnabled: false } });
			expect(
				screen.queryByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeNull();

			rerenderWith({ tenant: { featureSupervisionEnabled: true } });
			expect(
				await screen.findByRole('heading', {
					name: 'Übung: Supervision hinzufügen'
				})
			).toBeTruthy();
		});
	});

	describe('on a phone', () => {
		it('asks to practise on a computer and cannot start', async () => {
			phone.value = true;
			const { store } = renderSection();

			const accept = (
				await screen.findByRole('heading', {
					name: 'Übung: Anfrage annehmen'
				})
			).closest('li') as HTMLElement;
			const start = within(accept).getByRole('button', {
				name: 'Übung starten'
			}) as HTMLButtonElement;

			expect(start.disabled).toBe(true);
			expect(
				within(accept).getByText('Bitte üben Sie am Computer.')
			).toBeTruthy();
			fireEvent.click(start);
			expect(store.get(tourLaunchRequestAtom)).toBeNull();
		});
	});
});
