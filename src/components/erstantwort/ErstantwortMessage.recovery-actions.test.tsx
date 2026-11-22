import { TenantContext } from '../../globalState/provider/TenantProvider';
import { accountPolicyTenant } from '../../test/fixtures/askerAccountPolicyFixtures';
// @vitest-environment oriso-jsdom
import * as React from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import german from '../../resources/i18n/de/common.json';
import { MemoryRouter } from 'react-router-dom';
import {
	act,
	cleanup,
	render,
	screen,
	fireEvent,
	waitFor
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { UserDataContext } from '../../globalState';
import { ErstantwortMessage } from './ErstantwortMessage';
import { apiPutSessionData } from '../../api/apiPutSessionData';
vi.mock('../../api/apiPutSessionData', () => ({
	apiPutSessionData: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

const i18n = createInstance();
void i18n.init({
	lng: 'de',
	fallbackLng: 'de',
	resources: { de: { translation: german } },
	initImmediate: false,
	interpolation: { escapeValue: false }
});

const openTwoFactorSettings = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useOpenTwoFactorSettings', () => ({
	TWO_FACTOR_SETTINGS_PATH: '/profile/einstellungen/sicherheit',
	useOpenTwoFactorSettings: () => openTwoFactorSettings
}));

vi.mock('../../utils/notificationHelpers', () => ({
	isSupported: () => false,
	requestPermissions: vi.fn()
}));

/* Overlay portals + focus trap are not this regression. Keep the buttonSet
   contract so the email overlay's form (headline + textbox) is what we assert. */
vi.mock('../overlay/Overlay', () => ({
	OVERLAY_FUNCTIONS: { CLOSE: 'CLOSE' },
	Overlay: ({ item, handleOverlay }: any) => (
		<div>
			<h2>{item.headline}</h2>
			{item.copy && <p>{item.copy}</p>}
			{item.nestedComponent}
			{item.buttonSet?.map((button: any) => (
				<button
					key={button.label}
					disabled={button.disabled}
					onClick={() => handleOverlay(button.function)}
				>
					{button.label}
				</button>
			))}
		</div>
	)
}));

vi.mock('../../resources/img/icons/envelope.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));
vi.mock('../../resources/img/illustrations/envelope-check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));
vi.mock('../../resources/img/illustrations/check.svg', () => ({
	ReactComponent: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />
}));

afterEach(cleanup);
beforeEach(() => {
	openTwoFactorSettings.mockClear();
});

const userData = {
	email: '',
	userName: 'askertest',
	displayName: 'Sanftes Alpaka Kala',
	twoFactorAuth: {
		isEnabled: true,
		isActive: false
	}
};
const accountProtection = german.erstantwort.accountProtection;

const renderMessage = (viewer: object = userData, rawMessage?: string) =>
	render(
		<I18nextProvider i18n={i18n}>
			<MemoryRouter>
				<UserDataContext.Provider
					value={
						{
							userData: viewer,
							reloadUserData: vi.fn()
						} as React.ContextType<typeof UserDataContext>
					}
				>
					<ErstantwortMessage
						conversationType="AGENCY_COUNSELLING"
						rawMessage={rawMessage}
						trigger="AFTER_FIRST_MESSAGE"
						skipAnimation
					/>
				</UserDataContext.Provider>
			</MemoryRouter>
		</I18nextProvider>
	);

describe('ErstantwortMessage email action', () => {
	it('opens the email overlay when E-Mail-Adresse angeben is pressed', () => {
		renderMessage();

		expect(
			screen.queryByRole('heading', { name: 'Zugang sichern' })
		).toBeNull();

		act(() => {
			screen
				.getByRole('button', { name: 'E-Mail-Adresse angeben' })
				.click();
		});

		expect(
			screen.getByRole('heading', { name: 'Zugang sichern' })
		).toBeTruthy();
		expect(screen.getByRole('textbox')).toBeTruthy();
	});

	it('keeps email setup without the second-factor invitation in a new first answer', () => {
		renderMessage();

		expect(
			screen.getByRole('button', { name: 'E-Mail-Adresse angeben' })
		).toBeTruthy();
		expect(screen.queryByText(accountProtection.headline)).toBeNull();
		expect(screen.queryByText(accountProtection.body)).toBeNull();
		expect(
			screen.queryByRole('button', { name: accountProtection.action })
		).toBeNull();
		expect(openTwoFactorSettings).not.toHaveBeenCalled();
	});

	it.each([
		{ reader: 'the advice seeker', viewer: userData },
		{
			reader: 'a counsellor',
			viewer: {
				...userData,
				grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT']
			}
		}
	])(
		'hides the stored second-factor invitation from $reader and keeps the greeting',
		({ viewer }) => {
			const greeting = 'Ihre Nachricht ist bei uns angekommen.';
			renderMessage(
				viewer,
				`[SYSTEM_NOTIFICATION]${JSON.stringify({
					type: 'FIRST_RESPONSE',
					version: 1,
					bausteine: [
						{ id: 'greeting', body: greeting },
						{
							id: 'accountProtection',
							headline: accountProtection.headline,
							body: accountProtection.body,
							action: {
								kind: 'ENABLE_2FA',
								label: accountProtection.action
							}
						}
					]
				})}`
			);

			expect(screen.getByText(greeting)).toBeTruthy();
			expect(screen.queryByText(accountProtection.headline)).toBeNull();
			expect(screen.queryByText(accountProtection.body)).toBeNull();
			expect(
				screen.queryByRole('button', { name: accountProtection.action })
			).toBeNull();
		}
	);

	it('edits the actual session alias instead of issuing an ignored account patch', async () => {
		render(
			<I18nextProvider i18n={i18n}>
				<MemoryRouter>
					<TenantContext.Provider
						value={{
							tenant: accountPolicyTenant(),
							setTenant: vi.fn(),
							updateTenantSettings: vi.fn()
						}}
					>
						<UserDataContext.Provider
							value={
								{
									userData,
									reloadUserData: vi.fn()
								} as React.ContextType<typeof UserDataContext>
							}
						>
							<ErstantwortMessage
								conversationType="AGENCY_COUNSELLING"
								trigger="AFTER_ENQUIRY_DISPATCHED"
								sessionId={51}
								displayName="Sanftes Alpaka Kala"
								skipAnimation
							/>
						</UserDataContext.Provider>
					</TenantContext.Provider>
				</MemoryRouter>
			</I18nextProvider>
		);

		act(() => {
			screen.getByRole('button', { name: 'Namen ändern' }).click();
		});

		expect(
			screen.getByRole('button', { name: 'Namen neu würfeln' })
		).toBeTruthy();
		expect(
			screen.getByRole<HTMLInputElement>('textbox', {
				name: 'Anzeigename'
			}).value
		).toBe('Sanftes Alpaka Kala');
		fireEvent.change(screen.getByRole('textbox', { name: 'Anzeigename' }), {
			target: { value: 'Session only alias' }
		});
		fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
		await waitFor(() =>
			expect(apiPutSessionData).toHaveBeenCalledWith(51, {
				displayName: 'Session only alias'
			})
		);
	});
});

it('does not offer the email action when fresh account eligibility is denied', () => {
	const denied = { ...userData, isAskerEmailCollectionAllowed: false };
	renderMessage(denied);
	expect(
		screen.queryByRole('button', { name: 'E-Mail-Adresse angeben' })
	).toBeNull();
});
