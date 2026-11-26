import * as React from 'react';
import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Route, Routes } from 'react-router-dom';
import {
	ApiGetConsultantStatisticsInterface,
	ConsultantStatisticsDTO
} from '../../api/apiGetConsultantStatistics';
import { UserDataContext } from '../../globalState';
import { ConsultingTypesContext } from '../../globalState/provider/ConsultingTypesProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { ConsultantStatistics } from './ConsultantStatistics';
import { Profile } from './Profile';
import './profile.styles';
import '../app/authenticatedApp.styles.scss';

/**
 * ORISO-Frontend#2558 (redesign of #2299): "Meine Statistik" in the
 * counsellor's profile (Mein Profil → Meine Aktivitäten). Period as two
 * segmented buttons (Woche/Monat/Jahr, this/last), calm tiles, appointment
 * kinds as chips, CSV as a tonal button. States: figures, empty, loading,
 * error. The "Page" stories render the real profile route.
 */

const SAMPLE = {
	numberOfAssignedSessions: 4,
	numberOfActiveSessions: 11,
	numberOfSentMessages: 86,
	numberOfAppointments: 9,
	numberOfVideoAppointments: 4,
	numberOfPhoneAppointments: 2,
	numberOfOnsiteAppointments: 2,
	numberOfChatAppointments: 1,
	numberOfCancelledAppointments: 1
};

const YEAR = {
	numberOfAssignedSessions: 61,
	numberOfActiveSessions: 143,
	numberOfSentMessages: 1284,
	numberOfAppointments: 117,
	numberOfVideoAppointments: 52,
	numberOfPhoneAppointments: 31,
	numberOfOnsiteAppointments: 26,
	numberOfChatAppointments: 8,
	numberOfCancelledAppointments: 14
};

const ZERO = {
	numberOfAssignedSessions: 0,
	numberOfActiveSessions: 0,
	numberOfSentMessages: 0,
	numberOfAppointments: 0,
	numberOfVideoAppointments: 0,
	numberOfPhoneAppointments: 0,
	numberOfOnsiteAppointments: 0,
	numberOfChatAppointments: 0,
	numberOfCancelledAppointments: 0
};

const answer =
	(pick: (request: ApiGetConsultantStatisticsInterface) => typeof SAMPLE) =>
	async (
		request: ApiGetConsultantStatisticsInterface
	): Promise<ConsultantStatisticsDTO> => {
		const figures = pick(request);
		return {
			startDate: request.startDate,
			endDate: request.endDate,
			...figures,
			breakdown: [
				{
					startDate: request.startDate,
					endDate: request.endDate,
					...figures
				}
			]
		};
	};

const byPeriod = answer((request) =>
	request.breakdown === 'MONTH' ? YEAR : SAMPLE
);

/** The card the cards layout puts around a section ("Karten v2"). */
const InCard = (Story: React.ComponentType) => (
	<div
		style={{
			padding: 24,
			background: 'var(--m3-surface-container-high, #eae7e8)',
			minHeight: '100%'
		}}
	>
		<section
			style={{
				maxWidth: 560,
				margin: '0 auto',
				padding: '28px 24px 24px',
				borderRadius: 28,
				background: 'var(--m3-surface-container-low, #f6f3f3)'
			}}
		>
			<Story />
		</section>
	</div>
);

const meta: Meta<typeof ConsultantStatistics> = {
	title: 'Profile/ConsultantStatistics',
	component: ConsultantStatistics,
	parameters: { layout: 'fullscreen' }
};
export default meta;

type Story = StoryObj<typeof ConsultantStatistics>;

const desktop1440 = { viewport: { value: 'desktop1440' } };
const phone390 = { viewport: { value: 'phone390' } };
const dark = { scheme: 'dark' };

export const WithFigures: Story = {
	decorators: [InCard],
	name: 'Month with appointments, consultations and messages',
	args: { loadStatistics: byPeriod },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText('86')).toBeTruthy());
		await expect(canvas.getByText('9')).toBeTruthy();
		await expect(
			canvas.getByRole('button', { name: 'Monat' })
		).toHaveAttribute('aria-pressed', 'true');
		await expect(canvas.getByText('Als CSV herunterladen')).toBeTruthy();
	}
};

export const Year: Story = {
	decorators: [InCard],
	name: 'Switch to this year',
	args: { loadStatistics: byPeriod },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() => expect(canvas.getByText('86')).toBeTruthy());
		await userEvent.click(canvas.getByRole('button', { name: 'Jahr' }));
		await waitFor(() => expect(canvas.getByText('1284')).toBeTruthy());
		await expect(
			canvas.getByText(/Eine Zeile pro Monat/)
		).toBeInTheDocument();
	}
};

export const Empty: Story = {
	decorators: [InCard],
	name: 'Period without figures',
	args: { loadStatistics: answer(() => ZERO) },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByText(
					'In diesem Zeitraum gibt es noch keine Zahlen.'
				)
			).toBeTruthy()
		);
	}
};

export const Loading: Story = {
	decorators: [InCard],
	name: 'Loading',
	args: { loadStatistics: () => new Promise(() => {}) },
	play: async ({ canvasElement }) => {
		const tiles = canvasElement.querySelector('.statistics__tiles');
		await expect(tiles).toHaveAttribute('aria-busy', 'true');
		await expect(
			within(canvasElement).queryByText('Als CSV herunterladen')
		).toBeNull();
	}
};

export const LoadError: Story = {
	decorators: [InCard],
	name: 'Figures could not be loaded',
	args: { loadStatistics: () => Promise.reject(new Error('503')) },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await waitFor(() =>
			expect(
				canvas.getByRole('button', { name: 'Erneut versuchen' })
			).toBeTruthy()
		);
	}
};

export const OlderBackend: Story = {
	decorators: [InCard],
	name: 'Backend without appointment figures: tiles show 0',
	args: {
		loadStatistics: async ({ startDate, endDate }) => ({
			startDate,
			endDate,
			numberOfAssignedSessions: 3,
			numberOfActiveSessions: 5,
			numberOfSentMessages: 20
		})
	}
};

export const Phone390: Story = {
	decorators: [InCard],
	name: 'Phone 390 px',
	args: { loadStatistics: byPeriod },
	globals: phone390
};

export const Phone390Dark: Story = {
	decorators: [InCard],
	name: 'Phone 390 px, dark',
	args: { loadStatistics: byPeriod },
	globals: { ...phone390, ...dark }
};

export const Desktop1440Dark: Story = {
	decorators: [InCard],
	name: 'Desktop, dark',
	args: { loadStatistics: byPeriod },
	globals: { ...desktop1440, ...dark }
};

/* ---- The wired page: the real profile route with a stubbed endpoint ---- */

const consultant = {
	userId: 'storybook-consultant',
	userName: 'blink.fish',
	firstName: 'Blink',
	lastName: 'Fish',
	email: 'blink.fish@example.org',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	twoFactorAuth: { isEnabled: true, isActive: true, type: 'APP' },
	languages: ['de'],
	displayName: 'Blinky Stinky',
	agencies: []
};

const StatisticsEndpoint = ({ children }: { children: React.ReactNode }) => {
	const restore = useRef<(() => void) | null>(null);
	if (!restore.current) {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = async (input, init) => {
			const url =
				typeof input === 'string'
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.includes('/statistics/consultant')) {
				const query = new URL(url, 'http://storybook').searchParams;
				const body = await byPeriod({
					startDate: query.get('startDate') ?? '',
					endDate: query.get('endDate') ?? '',
					breakdown:
						(query.get('breakdown') as 'DAY' | 'WEEK' | 'MONTH') ??
						undefined
				});
				return new Response(JSON.stringify(body), {
					status: 200,
					headers: { 'content-type': 'application/json' }
				});
			}
			return originalFetch(input, init);
		};
		restore.current = () => {
			globalThis.fetch = originalFetch;
		};
	}
	useEffect(() => () => restore.current?.(), []);
	return <>{children}</>;
};

const ProfilePage = () => (
	<UserDataContext.Provider
		value={
			{
				userData: consultant,
				reloadUserData: () => Promise.resolve(),
				setUserData: () => undefined
			} as never
		}
	>
		<ConsultingTypesContext.Provider
			value={{ consultingTypes: [], setConsultingTypes: () => {} }}
		>
			<SessionsDataContext.Provider
				value={{ sessions: [], ready: true, dispatch: () => {} }}
			>
				<ModalProvider>
					<StatisticsEndpoint>
						<div className="app" style={{ minHeight: '100dvh' }}>
							<Routes>
								<Route
									path="/profile/*"
									element={<Profile />}
								/>
							</Routes>
						</div>
					</StatisticsEndpoint>
				</ModalProvider>
			</SessionsDataContext.Provider>
		</ConsultingTypesContext.Provider>
	</UserDataContext.Provider>
);

const page: Partial<Story> = {
	render: () => <ProfilePage />,
	parameters: {
		router: { initialPath: '/profile/aktivitaeten/statistik' }
	}
};

export const PageDesktop1440: Story = {
	...page,
	name: 'Page: Meine Aktivitäten, desktop',
	globals: desktop1440,
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(within(canvasElement).getByText('86')).toBeTruthy()
		);
	}
};

export const PagePhone390: Story = {
	...page,
	name: 'Page: Meine Statistik, phone 390 px',
	globals: phone390
};

export const PageDesktop1440Dark: Story = {
	...page,
	name: 'Page: Meine Aktivitäten, desktop, dark',
	globals: { ...desktop1440, ...dark }
};
