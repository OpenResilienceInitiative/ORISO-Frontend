// @vitest-environment jsdom
import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserDataContext } from '../../globalState';
import { ErstantwortMessage } from './ErstantwortMessage';

vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('lottie-web', () => ({ default: {} }));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'de' }
	})
}));

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

const renderMessage = () =>
	render(
		<MemoryRouter>
			<UserDataContext.Provider
				value={
					{
						userData,
						reloadUserData: vi.fn()
					} as React.ContextType<typeof UserDataContext>
				}
			>
				<ErstantwortMessage
					trigger="AFTER_FIRST_MESSAGE"
					skipAnimation
				/>
			</UserDataContext.Provider>
		</MemoryRouter>
	);

describe('ErstantwortMessage email action', () => {
	it('opens the email overlay when E-Mail-Adresse angeben is pressed', () => {
		renderMessage();

		expect(
			screen.queryByRole('heading', { name: 'Add an e-mail address' })
		).toBeNull();

		act(() => {
			screen
				.getByRole('button', { name: 'E-Mail-Adresse angeben' })
				.click();
		});

		expect(
			screen.getByRole('heading', { name: 'Add an e-mail address' })
		).toBeTruthy();
		expect(screen.getByRole('textbox')).toBeTruthy();
	});

	it('starts 2FA with the backup-key follow-on when Zugang schützen is pressed', () => {
		renderMessage();

		act(() => {
			screen.getByRole('button', { name: 'Zugang schützen' }).click();
		});

		expect(openTwoFactorSettings).toHaveBeenCalledWith({
			showBackupKey: true
		});
	});

	it('opens the display-name overlay when Namen ändern is pressed', () => {
		render(
			<MemoryRouter>
				<UserDataContext.Provider
					value={
						{
							userData,
							reloadUserData: vi.fn()
						} as React.ContextType<typeof UserDataContext>
					}
				>
					<ErstantwortMessage
						trigger="AFTER_ENQUIRY_DISPATCHED"
						skipAnimation
					/>
				</UserDataContext.Provider>
			</MemoryRouter>
		);

		act(() => {
			screen.getByRole('button', { name: 'Namen ändern' }).click();
		});

		expect(
			screen.getByRole('button', { name: 'Namen neu würfeln' })
		).toBeTruthy();
		expect(screen.getByText('Sanftes Alpaka Kala')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeTruthy();
	});
});
