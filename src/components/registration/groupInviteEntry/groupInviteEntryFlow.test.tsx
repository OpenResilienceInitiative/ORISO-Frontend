// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Registration } from '../Registration';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	RegistrationContext,
	TenantContext
} from '../../../globalState';
import { GlobalComponentContext } from '../../../globalState/provider/GlobalComponentContext';
import { UrlParamsContext } from '../../../globalState/provider/UrlParamsProvider';
import { INVITE_LOGIN_STATE } from './groupInviteEntryState';

vi.mock('lottie-react', () => ({ default: () => null }));

/* The layout is captured, not drawn: what matters is what the entry asks of it
   (login link keeps the invite, no stepper, footer actions). */
const stageProps: Record<string, unknown>[] = [];
vi.mock('../../stageLayout/StageLayout', () => ({
	StageLayout: (props: Record<string, unknown>) => {
		stageProps.push(props);
		return (
			<div data-testid="stage-layout">
				{props.children as React.ReactNode}
			</div>
		);
	}
}));

vi.mock('../accountData/AccountData', () => ({
	AccountData: ({
		entry,
		temporary
	}: {
		entry?: string;
		temporary?: boolean;
	}) => (
		<div
			data-testid="account-data"
			data-entry={entry}
			data-temporary={String(temporary)}
		/>
	)
}));

const apiPostRegistration = vi.fn(() => Promise.resolve());
vi.mock('../../../api', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	apiPostRegistration: (...args: unknown[]) =>
		(apiPostRegistration as any)(...args),
	apiGetAskerSessionList: () =>
		Promise.resolve({ sessions: [{ session: { id: 211 } }] })
}));

const redirectToApp = vi.fn();
vi.mock('../autoLogin', async (importOriginal) => ({
	...(await importOriginal<Record<string, unknown>>()),
	redirectToApp: (...args: unknown[]) => redirectToApp(...args)
}));

/**
 * # The designed newcomer entry, wired (#1499, FE#1289)
 *
 * `/login?gcid=19&aid=19` hands a newcomer to `/registration/account-data`
 * with the link. There the registration shows Storybook's "0a — Eintritt: ohne
 * Konto" instead of the four steps: one screen, temporary join by default,
 * "Konto anlegen" switches to 0b. Joining runs the ordinary registration and
 * hands the link on, which leads into `/groups/19/entry`.
 */
const Step = () => <div data-testid="step-body" />;
const steps = [
	{
		name: 'topic-selection',
		component: Step,
		mandatoryFields: ['mainTopic']
	},
	{ name: 'account-data', component: Step }
];
const agency = {
	id: 19,
	name: 'Beratungstelle',
	topicIds: [17],
	consultingType: 1
};
const grief = { id: 17, name: 'Trauerberatung' };

const renderAt = (
	search: string,
	registrationData: Record<string, unknown> = {
		agency,
		mainTopic: grief,
		zipcode: '00000',
		username: 'ente_yuki_7984',
		password: 'Minted-in-the-test-1'
	}
) =>
	render(
		<AppConfigContext.Provider
			value={
				{ urls: {}, multitenancyWithSingleDomainEnabled: false } as any
			}
		>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div /> } as any}
			>
				<NotificationsContext.Provider
					value={{ addNotification: () => undefined } as any}
				>
					<TenantContext.Provider value={{ tenant: null } as any}>
						<LocaleContext.Provider value={{ locale: 'de' } as any}>
							<UrlParamsContext.Provider
								value={
									{
										agency:
											(registrationData.agency as object) ??
											agency,
										loaded: true
									} as any
								}
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
											availableSteps: steps,
											registrationConsultingType: {}
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
							</UrlParamsContext.Provider>
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</NotificationsContext.Provider>
			</GlobalComponentContext.Provider>
		</AppConfigContext.Provider>
	);

const primary = () => screen.getByTestId('registration-footer-primary');
const secondary = () => screen.getByTestId('registration-footer-secondary');
const lastStage = () => stageProps[stageProps.length - 1];

beforeEach(() => {
	stageProps.length = 0;
	apiPostRegistration.mockClear();
	redirectToApp.mockClear();
});

afterEach(() => {
	sessionStorage.clear();
	cleanup();
});

describe('newcomer entry for a self-help group link', () => {
	it('opens on 0a: temporary join, "Der Gruppe beitreten", no steps', () => {
		renderAt('?gcid=19&aid=19');

		const account = screen.getByTestId('account-data');
		expect(account.dataset.entry).toBe('link');
		expect(account.dataset.temporary).toBe('true');
		expect(primary().textContent).toBe('Der Gruppe beitreten');
		expect(secondary().textContent).toBe('Konto anlegen');
		expect(screen.queryByTestId('step-body')).toBeNull();
		expect(
			document.querySelector('[data-cy="registration-form"]'),
			'no four-step form, no stepper, no footer chips'
		).toBeNull();
		expect(lastStage().showRegistrationLink).toBe(false);
	});

	it('"Konto anlegen" switches to 0b with a password, and back', () => {
		renderAt('?gcid=19&aid=19');

		fireEvent.click(secondary());
		expect(screen.getByTestId('account-data').dataset.temporary).toBe(
			'false'
		);
		expect(primary().textContent).toBe('registration.register');
		expect(secondary().textContent).toBe('Ohne Konto beitreten');

		fireEvent.click(secondary());
		expect(screen.getByTestId('account-data').dataset.temporary).toBe(
			'true'
		);
	});

	it('"Einloggen" returns to the login with gcid and aid and the login choice', () => {
		renderAt('?gcid=19&aid=19');

		expect(lastStage().showLoginLink).toBe(true);
		expect(lastStage().loginParams).toBe('gcid=19&aid=19');
		expect(lastStage().loginState).toEqual(INVITE_LOGIN_STATE);
	});

	it('joining registers at the group agency and hands the link on to the entry room', async () => {
		renderAt('?gcid=19&aid=19');

		fireEvent.click(primary());

		await waitFor(() => expect(redirectToApp).toHaveBeenCalled());
		const [, body] = apiPostRegistration.mock.calls[0] as unknown as [
			string,
			Record<string, unknown>
		];
		expect(body.agencyId).toBe('19');
		expect(body.mainTopicId).toBe('17');
		expect(redirectToApp).toHaveBeenCalledWith('19', { sessionId: '211' });
	});

	it('joining names the group, so the registration opens no counselling enquiry', async () => {
		renderAt('?gcid=19&aid=19');

		fireEvent.click(primary());

		await waitFor(() => expect(apiPostRegistration).toHaveBeenCalled());
		const [, body] = apiPostRegistration.mock.calls[0] as unknown as [
			string,
			Record<string, unknown>
		];
		expect(body.groupChatId).toBe(19);
	});

	it('does not name the group when the person registers at another agency', async () => {
		renderAt('?gcid=19', {
			agency: { ...agency, id: 7 },
			mainTopic: grief,
			zipcode: '10115',
			username: 'ente_yuki_7984',
			password: 'Minted-in-the-test-1'
		});

		fireEvent.click(
			document.querySelector('[data-cy="button-register"]') as Element
		);

		await waitFor(() => expect(apiPostRegistration).toHaveBeenCalled());
		const [, body] = apiPostRegistration.mock.calls[0] as unknown as [
			string,
			Record<string, unknown>
		];
		expect(body.agencyId).toBe('7');
		expect(body).not.toHaveProperty('groupChatId');
	});

	it('keeps the four steps when the topic cannot be told from the agency', () => {
		renderAt('?gcid=19&aid=19', {
			agency: { ...agency, topicIds: [17, 18] }
		});
		expect(screen.queryByTestId('account-data')).toBeNull();
		expect(screen.getByTestId('step-body')).toBeTruthy();
	});

	it('leaves an ordinary registration untouched', () => {
		renderAt('');
		expect(screen.queryByTestId('account-data')).toBeNull();
		expect(screen.getByTestId('step-body')).toBeTruthy();
	});
});
