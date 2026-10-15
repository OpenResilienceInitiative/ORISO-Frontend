// @vitest-environment jsdom
import * as React from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { apiPatchUserData } from '../../api/apiPatchUserData';
import { EmailNotification } from '../profile/EmailNotifications';
import { DisplayFilterDialog, SESSION_COLUMNS } from './DisplayFilterDialog';
import { EMPTY_DISPLAY_FILTER } from './displayFilterTypes';
import { SESSION_KINDS, STORY_LABELS } from './displayFilterStoryData';
import { useDisplayFilterEmailColumn } from './useDisplayFilterEmailColumn';

vi.mock('../../api/apiPatchUserData', () => ({ apiPatchUserData: vi.fn() }));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key })
}));
vi.mock('../../utils/notificationSettings/soundPlayback', () => ({
	previewNotificationSound: vi.fn(),
	soundAssetFor: () => null
}));

const userData = () => ({
	email: 'counsellor@example.test',
	grantedAuthorities: ['AUTHORIZATION_CONSULTANT_DEFAULT'],
	emailNotifications: {
		emailNotificationsEnabled: true,
		settings: {
			initialEnquiryNotificationEnabled: true,
			appointmentNotificationEnabled: true
		}
	},
	emailToggles: [
		{ name: 'DAILY_ENQUIRY', state: true },
		{ name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER', state: true }
	]
});

const withUser = (ui: React.ReactNode) => (
	<MemoryRouter>
		<NotificationsContext.Provider
			value={{ addNotification: vi.fn() } as never}
		>
			<UserDataContext.Provider
				value={
					{
						userData: userData(),
						reloadUserData: vi.fn(async () => undefined)
					} as never
				}
			>
				{ui}
			</UserDataContext.Provider>
		</NotificationsContext.Provider>
	</MemoryRouter>
);

const ConnectedDialog = () => {
	const email = useDisplayFilterEmailColumn('sessions');
	return (
		<DisplayFilterDialog
			open
			onClose={() => undefined}
			onReset={() => undefined}
			onChange={() => undefined}
			kinds={SESSION_KINDS}
			value={EMPTY_DISPLAY_FILTER}
			labels={STORY_LABELS}
			columns={SESSION_COLUMNS}
			email={email}
		/>
	);
};

beforeEach(() => {
	vi.mocked(apiPatchUserData).mockReset();
	vi.mocked(apiPatchUserData).mockResolvedValue(undefined);
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn()
	});
});
afterEach(cleanup);

describe('display-filter E-Mail column (FE#1377 redesign)', () => {
	it('saves exactly what the profile switch saves (one source of truth)', async () => {
		// The profile page: switch "Nachrichten von Ratsuchenden" off.
		const profile = render(withUser(<EmailNotification />));
		fireEvent.click(
			screen.getByRole('switch', {
				name: 'profile.notifications.matrix.consultant.newMessage.title'
			})
		);
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
		const fromProfile = vi.mocked(apiPatchUserData).mock.calls[0][0];
		profile.unmount();
		vi.mocked(apiPatchUserData).mockClear();

		// The dialog: Mail-Beratung → E-Mail → Aus.
		render(withUser(<ConnectedDialog />));
		const picker = screen.getByRole('button', {
			name: 'E-Mail: Mail-Beratung'
		});
		expect(picker.textContent).toContain('An');
		fireEvent.click(
			screen.getByRole('button', { name: 'E-Mail wählen: Mail-Beratung' })
		);
		fireEvent.click(screen.getByRole('menuitemradio', { name: 'Aus' }));
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
		expect(vi.mocked(apiPatchUserData).mock.calls[0][0]).toEqual(
			fromProfile
		);
		expect(fromProfile).toEqual({
			emailToggles: [
				{ name: 'DAILY_ENQUIRY', state: true },
				{ name: 'NEW_CHAT_MESSAGE_FROM_ADVICE_SEEKER', state: false }
			]
		});
	});

	it('saves a settings-blob flag the same way as the profile switch', async () => {
		const profile = render(withUser(<EmailNotification />));
		fireEvent.click(
			screen.getByRole('switch', {
				name: 'profile.notifications.appointmentNotificationEnabled.title'
			})
		);
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
		const fromProfile = vi.mocked(apiPatchUserData).mock.calls[0][0];
		profile.unmount();
		vi.mocked(apiPatchUserData).mockClear();

		render(withUser(<ConnectedDialog />));
		fireEvent.click(
			screen.getByRole('button', { name: 'E-Mail wählen: Termine' })
		);
		fireEvent.click(screen.getByRole('menuitemradio', { name: 'Aus' }));
		await waitFor(() => expect(apiPatchUserData).toHaveBeenCalledOnce());
		expect(vi.mocked(apiPatchUserData).mock.calls[0][0]).toEqual(
			fromProfile
		);
	});

	it('shows "nicht verfügbar" without a focus stop where no e-mail setting exists, and says why', () => {
		render(withUser(<ConnectedDialog />));
		const row = screen.getByRole('row', { name: /Live-Chat/ });
		expect(row.textContent).toContain(STORY_LABELS.emailUnavailable);
		expect(row.textContent).toContain(STORY_LABELS.emailUnavailableReason);
		expect(
			screen.queryByRole('button', { name: 'E-Mail: Live-Chat' })
		).toBeNull();
		const unavailable = row.querySelector(
			'.displayFilterDialog__unavailable'
		) as HTMLElement;
		expect(unavailable.getAttribute('title')).toBe(
			STORY_LABELS.emailUnavailableReason
		);
		expect(
			unavailable.querySelector('[tabindex], button, input')
		).toBeNull();
	});
});
