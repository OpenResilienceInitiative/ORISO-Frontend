import * as React from 'react';
import { expect, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import { UserDataContext } from '../../globalState';
import { ConsultingTypesContext } from '../../globalState/provider/ConsultingTypesProvider';
import { ModalProvider } from '../../globalState/provider/ModalProvider';
import { SessionsDataContext } from '../../globalState/provider/SessionsDataProvider';
import { LegalLinksProvider } from '../../globalState/provider/LegalLinksProvider';
import { AuthenticatedBuildIdentityBoundary } from '../app/BuildIdentity';
import { Profile } from './Profile';
import '../app/authenticatedApp.styles.scss';

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

const noGlobalAvatarChooser = async (canvasElement: HTMLElement) => {
	await expect(
		canvasElement.querySelector(
			'.profile__header [data-testid="profile-avatar-choice"]'
		)
	).toBeNull();
	await expect(canvasElement.querySelector('.avatarPicker--row')).toBeNull();
};

const noSettingsAvatarChooser = async (canvasElement: HTMLElement) => {
	await noGlobalAvatarChooser(canvasElement);
	await expect(
		canvasElement.querySelector('[data-testid="profile-avatar-choice"]')
	).toBeNull();
};

const avatarInGeneralCard = async (
	canvasElement: HTMLElement,
	title: string
) => {
	await noGlobalAvatarChooser(canvasElement);
	const editor = await within(canvasElement).findByTestId(
		'profile-avatar-choice'
	);
	const card = editor.closest<HTMLElement>('[data-testid="profile-card"]');
	await expect(card).not.toBeNull();
	if (!card) throw new Error('Avatar editor must use its existing data card');
	await expect(
		within(card).getByRole('heading', { name: title })
	).toBeVisible();
};

export const AskerDesktop1440: Story = {
	decorators: [withStage(asker)],
	globals: desktop1440,
	play: async ({ canvasElement }) => {
		await noSettingsAvatarChooser(canvasElement);
		const cards =
			await within(canvasElement).findAllByTestId('profile-card');
		await expect(cards.length).toBeGreaterThanOrEqual(4);
	}
};

export const ConsultantDesktop1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	play: ({ canvasElement }) => noSettingsAvatarChooser(canvasElement)
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
	},
	play: ({ canvasElement }) => noSettingsAvatarChooser(canvasElement)
};

/** #1540: the other tabs share the card layout. */
export const ConsultantGeneral1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/allgemeines' } },
	play: ({ canvasElement }) =>
		avatarInGeneralCard(canvasElement, 'Kontaktdaten')
};

export const AskerGeneral1440: Story = {
	decorators: [withStage(asker)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/allgemeines' } },
	play: ({ canvasElement }) => avatarInGeneralCard(canvasElement, 'Über mich')
};

export const ConsultantActivities1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/aktivitaeten' } },
	// #1338: the activities tab loads the counsellor's figures for the month.
	beforeEach: () => {
		const realFetch = window.fetch;
		window.fetch = (async (
			input: RequestInfo | URL,
			init?: RequestInit
		) => {
			const url = new URL(
				String(
					typeof input === 'string' || input instanceof URL
						? input
						: input.url
				),
				window.location.href
			);
			if (url.pathname === '/service/users/statistics/consultant') {
				return new Response(
					JSON.stringify({
						startDate: url.searchParams.get('startDate'),
						endDate: url.searchParams.get('endDate'),
						numberOfAssignedSessions: 12,
						numberOfActiveSessions: 5,
						numberOfSentMessages: 48
					}),
					{
						status: 200,
						headers: { 'content-type': 'application/json' }
					}
				);
			}
			return realFetch(input, init);
		}) as typeof window.fetch;
		return () => {
			window.fetch = realFetch;
		};
	}
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

const legalDocuments = [
	{
		url: '/datenschutz',
		label: 'login.legal.infoText.dataprotection',
		registration: true
	},
	{
		url: '/impressum',
		label: 'login.legal.infoText.impressum',
		registration: true
	}
];

const ProfileFooterStage = () => (
	<AuthenticatedBuildIdentityBoundary>
		<LegalLinksProvider legalLinks={legalDocuments}>
			<div className="app__wrapper" style={{ height: '100dvh' }}>
				<div className="navigation__wrapper" aria-hidden="true" />
				<main className="contentWrapper">
					<div className="contentWrapper__profile">
						<Routes>
							<Route path="/profile/*" element={<Profile />} />
						</Routes>
					</div>
				</main>
			</div>
		</LegalLinksProvider>
	</AuthenticatedBuildIdentityBoundary>
);

const withPlatformVersion = (version: string) => () => {
	const runtimeWindow: Window & {
		__ORISO_RUNTIME_CONFIG__?: Record<string, string | undefined>;
	} = window;
	const previous = runtimeWindow.__ORISO_RUNTIME_CONFIG__;
	runtimeWindow.__ORISO_RUNTIME_CONFIG__ = {
		...previous,
		REACT_APP_PLATFORM_VERSION: version,
		VITE_PLATFORM_VERSION: undefined
	};
	return () => {
		runtimeWindow.__ORISO_RUNTIME_CONFIG__ = previous;
	};
};

const legalFooter = (canvasElement: HTMLElement) => {
	const footer = canvasElement.querySelector<HTMLElement>('.profile__footer');
	if (!footer) throw new Error('Profile legal footer is missing');
	return footer;
};

const footerLabels = {
	de: ['Datenschutzerklärung', 'Impressum'],
	en: ['Privacy policy', 'Imprint'],
	fr: ['Déclaration de confidentialité', 'Mentions légales']
};

const verifyFooter =
	(width: number, locale: keyof typeof footerLabels = 'de'): Story['play'] =>
	async ({ canvasElement }) => {
		const footer = legalFooter(canvasElement);
		footer.scrollIntoView({ block: 'end' });
		await waitFor(async () => {
			await expect(window.innerWidth).toBe(width);
			const identities =
				within(canvasElement).getAllByTestId('build-identity');
			await expect(identities).toHaveLength(1);
			const identity = identities[0];
			await expect(identity).toBeVisible();
			const build = identity.getBoundingClientRect();
			const links = within(footer).getAllByRole('link');
			await expect(links).toHaveLength(2);
			for (const [index, link] of links.entries()) {
				await expect(link).toHaveAccessibleName(
					footerLabels[locale][index]
				);
				await expect(link).toHaveAttribute(
					'href',
					`${window.location.origin}${legalDocuments[index].url}`
				);
				await expect(link).toHaveAttribute('target', '_blank');
				const rect = link.getBoundingClientRect();
				const overlaps =
					build.left < rect.right &&
					build.right > rect.left &&
					build.top < rect.bottom &&
					build.bottom > rect.top;
				await expect(overlaps).toBe(false);
			}
			await expect(footer).toContainElement(identity);
			await expect(build.right).toBeLessThanOrEqual(width);
		});
	};

export const LegalFooterDesktop1440: Story = {
	decorators: [withStage(consultant)],
	globals: desktop1440,
	parameters: { router: { initialPath: '/profile/einstellungen/email' } },
	beforeEach: withPlatformVersion('v2.0.15'),
	render: () => <ProfileFooterStage />,
	play: verifyFooter(1440)
};

export const LegalFooterTablet820: Story = {
	...LegalFooterDesktop1440,
	globals: { viewport: { value: 'tablet820' }, locale: 'en' },
	play: verifyFooter(820, 'en')
};

export const LegalFooterMobile390: Story = {
	...LegalFooterDesktop1440,
	globals: phone390,
	play: verifyFooter(390)
};

export const LegalFooterMobileFrench390: Story = {
	...LegalFooterMobile390,
	globals: { ...phone390, locale: 'fr' },
	play: verifyFooter(390, 'fr')
};

export const LegalFooterWithoutIdentity: Story = {
	...LegalFooterMobile390,
	beforeEach: withPlatformVersion(''),
	play: async ({ canvasElement }) => {
		const footer = legalFooter(canvasElement);
		await expect(within(footer).getAllByRole('link')).toHaveLength(2);
		await expect(
			within(canvasElement).queryByTestId('build-identity')
		).toBeNull();
		await expect(footer.children).toHaveLength(3);
	}
};
