// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registration } from './Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import { clearRegistrationSubmitting } from './registrationSubmission';

/**
 * Never settles: the submit stays in flight, which is the state under test.
 * Hoisted with the `vi.mock` calls below, which run before this file's own
 * imports are evaluated.
 */
const { pendingRegistration } = vi.hoisted(() => ({
	pendingRegistration: vi.fn(() => new Promise<void>(() => undefined))
}));

/** Lottie touches a canvas 2d context at module load; jsdom has none. */
vi.mock('lottie-react', () => ({ default: () => null }));

vi.mock('../../components/stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="stage-layout">{children}</div>
	)
}));

vi.mock('../../api', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		apiPostRegistration: () => pendingRegistration(),
		apiGetAskerSessionList: vi.fn(async () => ({ sessions: [] }))
	};
});

/**
 * # What this file is for
 *
 * A person presses "Registrieren", the handover screen comes up — and then the
 * account form is back on screen, their own password in the field, before the
 * app finally jumps away and loads again (Frank, 2026-09-22: "Ich sehe auf
 * einmal kurz wieder mein Passwort. Dann springt es weg. Und lädt wieder.").
 *
 * The cause is a remount, not a navigation: applying the authentication cookie
 * reloads the tenant, and the provider above the router renders nothing while
 * it does (ORISO-Frontend#1475). Everything below unmounts and mounts again
 * mid-submit. What this test does is exactly that — unmount the registration
 * screen while the registration request is still in flight and mount it again —
 * and it holds the screen to the only honest answer: the account has been
 * submitted, so the handover stands and the form does not come back.
 *
 * The step body is stubbed. This is about what the screen shows while a submit
 * is in flight, not about the account form, which has its own tests.
 */
const Step = () => <div data-testid="step-body" />;

const availableSteps = [
	{
		name: 'topic-selection',
		component: Step,
		mandatoryFields: ['mainTopic']
	},
	{
		name: 'account-data',
		component: Step,
		mandatoryFields: ['username', 'password']
	}
];

const registrationData = {
	mainTopicId: '1',
	mainTopic: { id: 1, name: 'Thema' },
	agencyId: '7',
	agency: { id: 7, name: 'Beratungsstelle' },
	zipcode: '50667',
	username: 'blaue-wolke',
	password: 'Sicher!Genug-2026'
};

const renderAccountStep = () =>
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
										registrationData,
										availableSteps,
										registrationConsultingType: null
									} as any
								}
							>
								<MemoryRouter
									initialEntries={[
										'/registration/account-data'
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

const registerButton = () =>
	document.querySelector('[data-cy="button-register"]') as HTMLElement;
const handover = () =>
	document.querySelector('[data-cy="registration-handover"]');
const form = () => document.querySelector('[data-cy="registration-form"]');

beforeEach(() => {
	clearRegistrationSubmitting();
	pendingRegistration.mockClear();
});

afterEach(() => {
	cleanup();
	clearRegistrationSubmitting();
	sessionStorage.clear();
});

describe('registration — a submit that is already in flight', () => {
	it('keeps the handover screen when the surface is mounted again mid-submit', async () => {
		const first = renderAccountStep();

		fireEvent.click(registerButton());

		await waitFor(() => expect(handover()).toBeTruthy());
		expect(form(), 'the account form gave way to the handover').toBeNull();
		expect(pendingRegistration).toHaveBeenCalledTimes(1);

		// The tenant refresh: everything below the provider goes away and comes
		// back while the request is still open.
		first.unmount();
		renderAccountStep();

		await waitFor(() => expect(handover()).toBeTruthy());
		expect(
			form(),
			'the account form must not return once the account was submitted'
		).toBeNull();
		expect(
			pendingRegistration,
			'and the account must not be registered a second time'
		).toHaveBeenCalledTimes(1);
	});

	it('shows the form on a fresh visit, because no submit is in flight', async () => {
		renderAccountStep();

		await waitFor(() => expect(form()).toBeTruthy());
		expect(handover()).toBeNull();
	});
});
