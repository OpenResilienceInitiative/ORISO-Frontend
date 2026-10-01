import * as React from 'react';
import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes, useLocation } from 'react-router-dom';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Login } from '../../login/Login';
import { Registration } from '../Registration';
import {
	AgencySpecificContext,
	RegistrationProvider,
	TenantContext
} from '../../../globalState';
import { registrationSessionStorageKey } from '../../../globalState/provider/RegistrationProvider';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { LegalLinksProvider } from '../../../globalState/provider/LegalLinksProvider';
import { AgencyDataInterface } from '../../../globalState/interfaces';
import { Stage } from '../../stage/stage';
import {
	desktop1440Globals,
	phone390Globals
} from '../../message/messageStoryShell';

/**
 * #1499 / FE#1289 — the designed newcomer entry, wired.
 *
 * The real `Login`, `RegistrationProvider` and `Registration` behind a real
 * route table: the story opens `/login?gcid=15&aid=88` and the app itself hands
 * the newcomer to the entry screen. Compare with "Group chat/Self-help entry
 * room" 0a/0b — the approved design this reproduces.
 *
 * One stand-in: `UrlParamsContext` carries the agency fixture. In the app,
 * `UrlParamsProvider` loads it from `aid` in `window.location`, which in
 * Storybook is the iframe URL, not the story's memory route.
 */

const agency = {
	id: 88,
	name: 'Caritas Berlin, Selbsthilfegruppe Trauer',
	postcode: '10117',
	city: 'Berlin',
	description: '',
	teamAgency: false,
	consultingType: 1,
	topicIds: [4],
	external: false
} as unknown as AgencyDataInterface;

const LINK = '/login?gcid=15&aid=88';

/** The route the app is on, for the play functions. */
const LocationProbe = () => {
	const location = useLocation();
	return (
		<span data-testid="story-location" hidden>
			{`${location.pathname}${location.search}`}
		</span>
	);
};

const WiredInviteEntry = () => {
	const [ready, setReady] = useState(false);
	const [specificAgency, setSpecificAgency] = useState<any>(null);

	/* A left-over registration draft of another story must not leak in. */
	useEffect(() => {
		sessionStorage.removeItem(registrationSessionStorageKey);
		setReady(true);
	}, []);

	if (!ready) {
		return null;
	}

	return (
		<TenantContext.Provider
			value={
				{
					tenant: { id: 1, name: 'ORISO', settings: {} },
					setTenant: () => undefined
				} as any
			}
		>
			<LegalLinksProvider
				legalLinks={[
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
				]}
			>
				<AgencySpecificContext.Provider
					value={{ specificAgency, setSpecificAgency }}
				>
					<GlobalComponentContext.Provider value={{ Stage }}>
						<UrlParamsContext.Provider
							value={{
								agency,
								consultingType: null,
								consultant: null,
								topic: null,
								loaded: true,
								slugFallback: '',
								zipcode: ''
							}}
						>
							<LocationProbe />
							<div style={{ height: '100vh' }}>
								<Routes>
									<Route path="/login" element={<Login />} />
									<Route
										path="/registration/:step"
										element={
											<RegistrationProvider>
												<Registration />
											</RegistrationProvider>
										}
									/>
								</Routes>
							</div>
						</UrlParamsContext.Provider>
					</GlobalComponentContext.Provider>
				</AgencySpecificContext.Provider>
			</LegalLinksProvider>
		</TenantContext.Provider>
	);
};

const meta = {
	title: 'Group chat/Self-help entry room — wired',
	component: WiredInviteEntry,
	parameters: {
		layout: 'fullscreen',
		router: { initialPath: LINK }
	}
} satisfies Meta<typeof WiredInviteEntry>;

export default meta;
type Story = StoryObj<typeof meta>;

const page = (canvasElement: HTMLElement) =>
	within(canvasElement.ownerDocument.body);

const where = (canvasElement: HTMLElement) =>
	canvasElement.ownerDocument.querySelector('[data-testid="story-location"]')
		?.textContent;

const joinButton = (canvasElement: HTMLElement) =>
	page(canvasElement).findByTestId(
		'registration-footer-primary',
		{},
		{ timeout: 8000 }
	);

const expectEntryScreen = async (canvasElement: HTMLElement) => {
	await expect(await joinButton(canvasElement)).toHaveTextContent(
		'Der Gruppe beitreten'
	);
	await expect(where(canvasElement)).toBe(
		'/registration/account-data?gcid=15&aid=88'
	);
	await expect(
		page(canvasElement).getByTestId('registration-footer-secondary')
	).toHaveTextContent('Konto anlegen');
	/* What the link already answered is not asked again: no stepper, no
	   footer chips, no agency box. */
	await expect(
		canvasElement.ownerDocument.querySelector(
			'[data-cy="registration-form"]'
		)
	).toBeNull();
	await expect(page(canvasElement).queryByText('Thema wählen')).toBeNull();
	await expect(
		page(canvasElement).queryByText('Ihre Beratungsstelle:')
	).toBeNull();
	await expect(
		page(canvasElement).getByText(
			'Diese Sitzung endet, wenn Sie den Browser schließen.'
		)
	).toBeVisible();
};

/** 0a — the newcomer follows the link and lands on the entry, not the login. */
export const NewcomerLinkDesktop: Story = {
	name: 'Link → 0a Eintritt ohne Konto · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => expectEntryScreen(canvasElement)
};

export const NewcomerLinkMobile: Story = {
	name: 'Link → 0a Eintritt ohne Konto · 390',
	globals: phone390Globals,
	play: async ({ canvasElement }) => expectEntryScreen(canvasElement)
};

const switchToAccount = async (canvasElement: HTMLElement) => {
	await expectEntryScreen(canvasElement);
	await userEvent.click(
		page(canvasElement).getByTestId('registration-footer-secondary')
	);
	await waitFor(() =>
		expect(
			page(canvasElement).getByTestId('registration-footer-primary')
		).toHaveTextContent('Registrieren')
	);
	await expect(
		page(canvasElement).getByTestId('registration-footer-secondary')
	).toHaveTextContent('Ohne Konto beitreten');
	await expect(
		canvasElement.ownerDocument.querySelectorAll('input[type="password"]')
			.length
	).toBe(2);
};

/** 0b — "Konto anlegen" asks for a password; the way back stays. */
export const CreateAccountDesktop: Story = {
	name: 'Link → 0b Eintritt mit Konto · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => switchToAccount(canvasElement)
};

export const CreateAccountMobile: Story = {
	name: 'Link → 0b Eintritt mit Konto · 390',
	globals: phone390Globals,
	play: async ({ canvasElement }) => switchToAccount(canvasElement)
};

/** "Einloggen" leads to the login form with the invite still in the URL. */
export const LoginKeepsTheLink: Story = {
	name: 'Link → 0a → Einloggen · 1440',
	globals: desktop1440Globals,
	play: async ({ canvasElement }) => {
		await expectEntryScreen(canvasElement);
		const login = canvasElement.ownerDocument.querySelector(
			'.stageLayout__toLogin__button'
		) as HTMLElement;
		await userEvent.click(login);
		await waitFor(() => expect(where(canvasElement)).toBe(LINK));
		/* The login form, not the entry: a password field and no join. */
		await waitFor(() =>
			expect(
				canvasElement.ownerDocument.querySelector(
					'input[type="password"]'
				)
			).not.toBeNull()
		);
		await expect(
			page(canvasElement).queryByTestId('registration-footer-primary')
		).toBeNull();
	}
};
