import * as React from 'react';
import { expect, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { ConsultingTypesContext } from '../../globalState/provider/ConsultingTypesProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { Profile } from './Profile';

/**
 * #878 Phase 1: the wired settings tab. The real `Profile` page renders the
 * real sections; only the layout changed — one card per section with a
 * leading icon, cards flowing in two columns on desktop.
 */

const asker = {
	userId: 'storybook-asker',
	userName: 'elster_linden_1908',
	userRoles: ['user'],
	grantedAuthorities: ['AUTHORIZATION_USER_DEFAULT'],
	twoFactorAuth: { isEnabled: false, isActive: false },
	consultingTypes: {},
	agencies: []
};

const consultant = {
	userId: 'storybook-consultant',
	userName: 'blink.fish',
	firstName: 'Blink',
	lastName: 'Fish',
	email: 'blink.fish@example.org',
	userRoles: ['consultant'],
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	twoFactorAuth: {
		isEnabled: true,
		isActive: true,
		type: 'APP'
	},
	languages: ['de'],
	displayName: 'Blinky Stinky',
	emailToggles: [
		{ name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER', state: true }
	],
	agencies: []
};

const withStage =
	(userData: Record<string, unknown>) => (Story: React.ComponentType) => (
		<UserDataContext.Provider
			value={
				{
					userData,
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
						<Story />
					</ModalProvider>
				</SessionsDataContext.Provider>
			</ConsultingTypesContext.Provider>
		</UserDataContext.Provider>
	);

const ProfileStage = () => (
	<div className="app" style={{ minHeight: '100dvh' }}>
		<Routes>
			<Route path="/profile/*" element={<Profile />} />
		</Routes>
	</div>
);

const meta = {
	title: 'Pages/Profile settings (stage)',
	component: ProfileStage,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: '/profile/einstellungen' }
	}
} satisfies Meta<typeof ProfileStage>;

export default meta;
type Story = StoryObj<typeof meta>;

const desktop1440 = { viewport: { value: 'desktop1440' } };
const desktop1280 = { viewport: { value: 'desktop1280' } };
const phone390 = { viewport: { value: 'phone390' } };

export const AskerDesktop1440: Story = {
	decorators: [withStage(asker)],
	globals: desktop1440,
	play: async ({ canvasElement }) => {
		const cards =
			await within(canvasElement).findAllByTestId('profile-card');
		await expect(cards.length).toBeGreaterThanOrEqual(4);
	}
};

export const ConsultantDesktop1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440
};

export const ConsultantDesktop1280: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1280
};

/** Mobile keeps its sub-menu; a group page shows the same cards in one column. */
export const AskerMobile390Security: Story = {
	decorators: [withStage(asker)],
	globals: phone390,
	parameters: {
		router: { initialPath: '/profile/einstellungen/sicherheit' }
	}
};

/** #1540: the other tabs share the card layout. */
export const ConsultantGeneral1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/allgemeines' } }
};

export const AskerGeneral1440: Story = {
	decorators: [withStage(asker)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/allgemeines' } }
};

export const ConsultantActivities1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/aktivitaeten' } }
};

export const ConsultantHelp1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/hilfe' } }
};

/** Mobile keeps the tab list and the sub-menu per tab. */
export const AskerMobile390Menu: Story = {
	decorators: [withStage(asker)],
	globals: phone390,
	parameters: { router: { initialPath: '/profile/einstellungen' } }
};

export const ConsultantMobile390Keyboard: Story = {
	decorators: [withStage(consultant)],
	globals: phone390,
	parameters: {
		router: { initialPath: '/profile/einstellungen/tastatur' }
	}
};
