// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Registration } from './Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';

/** Lottie touches a canvas 2d context at module load; jsdom has none. */
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../components/stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="stage-layout">{children}</div>
	)
}));

/**
 * # What this file is for
 *
 * A `gcid` in the URL means an invitation link brought this person to a group
 * chat. Only then does the account step offer the second way on — join without
 * ever choosing a password — and only then does the way on stop being called
 * "Registrieren".
 *
 * The step body is stubbed: this is about the decision the footer offers, not
 * about the account form, which has its own tests. What matters is that the
 * ordinary registration — no `gcid` — is left exactly as it was.
 */
const Step = () => <div data-testid="step-body" />;

const availableSteps = [
	{ name: 'topic-selection', component: Step },
	{ name: 'account-data', component: Step }
];

const renderAccountStep = (search: string) =>
	render(
		<AppConfigContext.Provider value={{} as any}>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div /> } as any}
			>
				<NotificationsContext.Provider
					value={{ addNotification: () => undefined } as any}
				>
					<TenantContext.Provider value={{ tenant: null } as any}>
						<LocaleContext.Provider value={{ locale: 'de' } as any}>
							<RegistrationContext.Provider
								value={
									{
										disabledNextButton: false,
										setDisabledNextButton: () => undefined,
										updateRegistrationData: () => undefined,
										registrationData: {},
										availableSteps,
										registrationConsultingType: null
									} as any
								}
							>
								<MemoryRouter
									initialEntries={[
										`/registration/account-data${search}`
									]}
								>
									<Routes>
										<Route
											path="/registration/:step"
											element={<Registration />}
										/>
									</Routes>
								</MemoryRouter>
							</RegistrationContext.Provider>
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</NotificationsContext.Provider>
			</GlobalComponentContext.Provider>
		</AppConfigContext.Provider>
	);

/** The wide-layout primary action — the way on. */
const primaryLabel = () =>
	document.querySelector('[data-cy="button-register"]')?.textContent;

/* No i18next instance is initialised in this environment, so `t(key)` returns
   the key and `t(key, fallback)` returns the fallback. The assertions below
   therefore name the fallback for the new keys and the key for the existing
   `registration.register` — which is exactly what tells the two apart. */
const REGISTER = 'registration.register';

const toggles = () =>
	Array.from(document.querySelectorAll('[data-cy="button-temporary-join"]'));

afterEach(() => {
	sessionStorage.clear();
	cleanup();
});

describe('registration — temporary join', () => {
	it('offers the temporary join and renames the way on when a group-chat link brought the person here', () => {
		renderAccountStep('?gcid=15');

		expect(toggles().length, 'the toggle is in the footer').toBeGreaterThan(
			0
		);
		expect(toggles()[0].textContent).toBe('Ohne Konto beitreten');
		expect(primaryLabel()).toBe(REGISTER);

		fireEvent.click(toggles()[0]);

		expect(toggles()[0].textContent).toBe('Konto anlegen');
		expect(primaryLabel()).toBe('Beitreten');

		fireEvent.click(toggles()[0]);

		expect(primaryLabel()).toBe(REGISTER);
	});

	it('leaves the ordinary registration untouched — no link, no second way on', () => {
		renderAccountStep('');

		expect(screen.getByTestId('step-body')).toBeTruthy();
		expect(toggles().length, 'no temporary join without a gcid').toBe(0);
		expect(primaryLabel()).toBe(REGISTER);
	});
});
