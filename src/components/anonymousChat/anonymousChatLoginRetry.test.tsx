// @vitest-environment jsdom
import * as React from 'react';
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AppConfigContext,
	LocaleContext,
	NotificationsContext,
	TenantContext
} from '../../globalState';
import { GlobalComponentContext } from '../../globalState/provider/GlobalComponentContext';

const api = vi.hoisted(() => ({
	apiGetTopicsData: vi.fn(),
	apiAgencySelection: vi.fn(),
	apiGetConsultantAvailability: vi.fn(),
	apiPostRegistration: vi.fn(),
	autoLogin: vi.fn(),
	redirectToApp: vi.fn(),
	addNotification: vi.fn()
}));

vi.mock('../../api/apiGetTopicsData', () => ({
	apiGetTopicsData: api.apiGetTopicsData
}));
vi.mock('../../api/apiAgencySelection', () => ({
	apiAgencySelection: api.apiAgencySelection
}));
vi.mock('../../api/apiGetConsultantAvailability', () => ({
	apiGetConsultantAvailability: api.apiGetConsultantAvailability
}));
vi.mock('../../api/apiPostRegistration', () => ({
	apiPostRegistration: api.apiPostRegistration
}));
vi.mock('../registration/autoLogin', () => ({
	autoLogin: api.autoLogin,
	redirectToApp: api.redirectToApp
}));
vi.mock('react-i18next', () => {
	const t = (key: string) => key;
	return { useTranslation: () => ({ t, i18n: { language: 'de' } }) };
});
vi.mock('../stageLayout/StageLayout', () => ({
	StageLayout: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	)
}));
vi.mock('../pseudonym/AnimalAvatar', () => ({ AnimalAvatar: () => null }));
vi.mock('../../api/apiAgencyLanguages', () => ({
	apiAgencyLanguages: vi.fn(() => Promise.resolve({ languages: [] }))
}));
vi.mock('lottie-react', () => ({ default: () => null }));

const { AnonymousChat } = await import('./AnonymousChat');

const topic = { id: 11, name: 'Sucht', slug: 'sucht', status: 'ACTIVE' };
const agency = { id: 7, name: 'Beratungsstelle', consultingType: 3 };
const tenant = { id: 1 };

const renderChat = () =>
	render(
		<AppConfigContext.Provider value={{} as any}>
			<GlobalComponentContext.Provider
				value={{ Stage: () => <div /> } as any}
			>
				<NotificationsContext.Provider
					value={{ addNotification: api.addNotification } as any}
				>
					<TenantContext.Provider value={{ tenant } as any}>
						<LocaleContext.Provider value={{ locale: 'de' } as any}>
							<MemoryRouter>
								<AnonymousChat onBack={() => undefined} />
							</MemoryRouter>
						</LocaleContext.Provider>
					</TenantContext.Provider>
				</NotificationsContext.Provider>
			</GlobalComponentContext.Provider>
		</AppConfigContext.Provider>
	);

const startButton = () =>
	screen.getByRole('button', { name: 'anonymousChat.start' });

/**
 * The anonymous chat generates the User-ID and password itself. When the
 * account was created and only the login after it failed, the next press of
 * "start" only logs in again (#1533) — and nothing about the topic or the
 * counselling centre can matter any more: the account, and the enquiry with
 * it, already exist. So a counsellor going offline in between must not block
 * that login, and the selection must not be changeable into something the
 * existing account does not have (CodeRabbit on #1567).
 */
describe('anonymous chat — login retry after the account exists', () => {
	beforeEach(() => {
		Object.values(api).forEach((fn) => fn.mockReset());
		api.apiGetTopicsData.mockResolvedValue([topic]);
		api.apiAgencySelection.mockResolvedValue([agency]);
		api.apiGetConsultantAvailability.mockResolvedValue({ available: true });
		api.apiPostRegistration.mockImplementation(
			(_u, _d, _m, _t, onAccountCreated?: () => void) => {
				onAccountCreated?.();
				return Promise.reject(new Error('auto-login failed'));
			}
		);
		api.autoLogin.mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
	});

	it('only logs in again, even when the topic has meanwhile gone offline', async () => {
		renderChat();

		await waitFor(() =>
			expect(startButton()).toHaveProperty('disabled', false)
		);
		fireEvent.click(startButton());

		await waitFor(() =>
			expect(api.addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					text: 'registration.accountCreated.retry'
				})
			)
		);
		await waitFor(() =>
			expect(startButton()).toHaveProperty('disabled', false)
		);

		/* Between the two presses the counsellors of the topic go offline. */
		api.apiGetConsultantAvailability.mockClear();
		api.apiGetConsultantAvailability.mockResolvedValue({
			available: false
		});

		await act(async () => {
			fireEvent.click(startButton());
		});

		await waitFor(() => expect(api.redirectToApp).toHaveBeenCalled());
		expect(
			api.apiGetConsultantAvailability,
			'the account and its enquiry exist — availability cannot block the login'
		).not.toHaveBeenCalled();
		expect(api.apiPostRegistration).toHaveBeenCalledTimes(1);
		expect(api.autoLogin).toHaveBeenCalledTimes(1);
	});

	it('keeps the choice when a topic opened before the start answers only after the account exists', async () => {
		/* A second topic was opened before "start"; its list of centres is
		   still on the way when the account is created and the login fails.
		   When it arrives it must not replace or clear the centre the account
		   was created for — an empty answer used to clear it, which switched
		   the start button off and left no way to log in (CodeRabbit on
		   #1567). */
		const secondTopic = {
			id: 12,
			name: 'Familie',
			slug: 'familie',
			status: 'ACTIVE'
		};
		let answerSecondTopic: (agencies: unknown[]) => void = () => undefined;
		api.apiGetTopicsData.mockResolvedValue([topic, secondTopic]);
		api.apiAgencySelection.mockImplementation(
			({ topicId }: { topicId: number }) =>
				topicId === secondTopic.id
					? new Promise((resolve) => {
							answerSecondTopic = resolve;
						})
					: Promise.resolve([agency])
		);
		renderChat();

		await waitFor(() =>
			expect(startButton()).toHaveProperty('disabled', false)
		);
		fireEvent.click(screen.getByText('anonymousChat.topics.names.familie'));
		await waitFor(() =>
			expect(api.apiAgencySelection).toHaveBeenCalledWith(
				expect.objectContaining({ topicId: secondTopic.id }),
				expect.anything()
			)
		);

		fireEvent.click(startButton());
		await waitFor(() =>
			expect(api.addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					text: 'registration.accountCreated.retry'
				})
			)
		);

		await act(async () => {
			answerSecondTopic([]);
		});

		await waitFor(() =>
			expect(
				startButton(),
				'a late answer must not take the start button away from the login retry'
			).toHaveProperty('disabled', false)
		);
		fireEvent.click(startButton());
		await waitFor(() => expect(api.redirectToApp).toHaveBeenCalled());
		expect(api.apiPostRegistration).toHaveBeenCalledTimes(1);
		expect(api.autoLogin).toHaveBeenCalledTimes(1);
	});

	it('freezes the counselling-centre choice once the account exists', async () => {
		renderChat();

		await waitFor(() =>
			expect(startButton()).toHaveProperty('disabled', false)
		);
		const radio = screen.getByRole('radio') as HTMLInputElement;
		expect(radio.disabled).toBe(false);

		fireEvent.click(startButton());
		await waitFor(() =>
			expect(api.addNotification).toHaveBeenCalledWith(
				expect.objectContaining({
					text: 'registration.accountCreated.retry'
				})
			)
		);

		await waitFor(() =>
			expect(
				(screen.getByRole('radio') as HTMLInputElement).disabled,
				'the account was created for this centre — choosing another would change nothing but the screen'
			).toBe(true)
		);
	});
});
