// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Registration } from './Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';
import deCommon from '../../resources/i18n/de/common.json';
import deInformalCommon from '../../resources/i18n/de@informal/common.json';
import enCommon from '../../resources/i18n/en/common.json';
import frCommon from '../../resources/i18n/fr/common.json';
import ruCommon from '../../resources/i18n/ru/common.json';
import tiCommon from '../../resources/i18n/ti/common.json';
import trCommon from '../../resources/i18n/tr/common.json';

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

// The real German catalogue: the labels below are what a person reads.
const i18n = createInstance().use(initReactI18next);
beforeAll(async () => {
	await i18n.init({
		lng: 'de',
		ns: ['common'],
		defaultNS: 'common',
		resources: { de: { common: deCommon } },
		interpolation: { escapeValue: false }
	});
});

const renderAccountStep = (
	search: string,
	registrationData: Record<string, unknown> = {}
) =>
	render(
		<I18nextProvider i18n={i18n}>
			<AppConfigContext.Provider value={{} as any}>
				<GlobalComponentContext.Provider
					value={{ Stage: () => <div /> } as any}
				>
					<NotificationsContext.Provider
						value={{ addNotification: () => undefined } as any}
					>
						<TenantContext.Provider value={{ tenant: null } as any}>
							<LocaleContext.Provider
								value={{ locale: 'de' } as any}
							>
								<RegistrationContext.Provider
									value={
										{
											disabledNextButton: false,
											setDisabledNextButton: () =>
												undefined,
											updateRegistrationData: () =>
												undefined,
											registrationData,
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
		</I18nextProvider>
	);

/** The wide-layout primary action — the way on. */
const primaryLabel = () =>
	document.querySelector('[data-cy="button-register"]')?.textContent;

const REGISTER = 'Registrieren';

const INCOMPLETE_HINT_DE =
	'Dieser Einladungslink ist unvollständig, daher ist das Beitreten ohne Konto nicht möglich. Bitte registrieren Sie sich mit einem Konto oder fragen Sie nach einem neuen Link.';

const toggles = () =>
	Array.from(document.querySelectorAll('[data-cy="button-temporary-join"]'));

afterEach(() => {
	sessionStorage.clear();
	cleanup();
});

describe('registration — temporary join', () => {
	it('offers the temporary join and renames the way on when a group-chat link brought the person here', () => {
		// A valid invite names the agency the person registers at.
		renderAccountStep('?gcid=15&aid=88', { agency: { id: 88 } });

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

	it('shows the toggle disabled with a hint when the invite link lacks the Beratungsstelle id', () => {
		// `gcid` without `aid`: the backend would refuse `temporary`.
		renderAccountStep('?gcid=15.abc_DEF', { agency: { id: 88 } });

		expect(toggles().length, 'the toggle is still shown').toBeGreaterThan(
			0
		);
		toggles().forEach((toggle) => {
			expect((toggle as HTMLButtonElement).disabled).toBe(true);
			expect(toggle.textContent).toBe('Ohne Konto beitreten');
		});
		expect(
			screen.getAllByText(INCOMPLETE_HINT_DE).length,
			'the hint says why'
		).toBeGreaterThan(0);

		fireEvent.click(toggles()[0]);

		// Nothing changes: still an ordinary registration.
		expect(toggles()[0].textContent).toBe('Ohne Konto beitreten');
		expect(primaryLabel()).toBe(REGISTER);
	});

	it('treats a blank aid like a missing one', () => {
		renderAccountStep('?gcid=15&aid=%20', { agency: { id: 88 } });

		expect((toggles()[0] as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getAllByText(INCOMPLETE_HINT_DE).length).toBeGreaterThan(
			0
		);
	});

	it('shows no hint and an enabled toggle when the invite link is complete', () => {
		renderAccountStep('?gcid=15&aid=88', { agency: { id: 88 } });

		expect((toggles()[0] as HTMLButtonElement).disabled).toBe(false);
		expect(screen.queryAllByText(INCOMPLETE_HINT_DE).length).toBe(0);
	});

	it('leaves the ordinary registration untouched — no link, no second way on', () => {
		renderAccountStep('');

		expect(screen.getByTestId('step-body')).toBeTruthy();
		expect(toggles().length, 'no temporary join without a gcid').toBe(0);
		expect(screen.queryAllByText(INCOMPLETE_HINT_DE).length).toBe(0);
		expect(primaryLabel()).toBe(REGISTER);
	});
});

describe('registration — incomplete invite link hint in every language', () => {
	const catalogues: Array<[string, any]> = [
		['de', deCommon],
		['de@informal', deInformalCommon],
		['en', enCommon],
		['fr', frCommon],
		['ru', ruCommon],
		['ti', tiCommon],
		['tr', trCommon]
	];
	const hintOf = (catalogue: any): string =>
		catalogue.registration.account.temporary.incompleteLink;

	it.each(catalogues)('%s has the hint', (_locale, catalogue) => {
		expect(hintOf(catalogue).trim().length).toBeGreaterThan(20);
	});

	it('translates the hint instead of repeating the English text', () => {
		const english = hintOf(enCommon);
		expect(english).toBe(
			'This invite link is incomplete, so joining without an account is not available. Please register with an account or ask for a new link.'
		);
		catalogues
			.filter(([locale]) => locale !== 'en')
			.forEach(([, catalogue]) => {
				expect(hintOf(catalogue)).not.toBe(english);
			});
		expect(hintOf(deCommon)).toBe(INCOMPLETE_HINT_DE);
		expect(hintOf(deInformalCommon)).toMatch(/registriere dich/);
	});
});
