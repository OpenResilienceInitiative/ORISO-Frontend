// @vitest-environment oriso-jsdom
import * as React from 'react';
import { createContext } from 'react';
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from 'vite-plus/test';
import { NotificationsContext, UserDataContext } from '../../globalState';
import { AskerDisplayNameSettings } from './AskerDisplayNameSettings';

const tenant = vi.hoisted(() => ({
	settings: { featureDisplayNameEditable: true } as Record<string, unknown>
}));
const api = vi.hoisted(() => ({
	list: vi.fn(),
	put: vi.fn()
}));

vi.mock('../../globalState', () => ({
	UserDataContext: createContext(null),
	NotificationsContext: createContext(null),
	NOTIFICATION_TYPE_ERROR: 'error',
	useTenant: () => ({ settings: tenant.settings })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) =>
			options?.name ? `${key}:${options.name}` : key
	})
}));
vi.mock('../../api/apiGetAskerSessionList', () => ({
	apiGetAskerSessionList: api.list
}));
vi.mock('../../api/apiPutSessionData', () => ({
	apiPutSessionData: api.put
}));

const session = (
	id: number,
	topic: string,
	displayName?: string,
	conversationType = 'AGENCY_COUNSELLING'
) => ({
	session: { id, topic: { name: topic }, conversationType },
	agency: { name: `Stelle ${id}` },
	user: { username: 'lisa', displayName, sessionData: {} }
});

const addNotification = vi.fn();
const view = () => (
	<NotificationsContext.Provider value={{ addNotification } as never}>
		<UserDataContext.Provider
			value={{ userData: { userName: 'lisa.simpson' } } as never}
		>
			<AskerDisplayNameSettings />
		</UserDataContext.Provider>
	</NotificationsContext.Provider>
);

const row = async (topic: string) =>
	(await screen.findByText(topic)).closest('li') as HTMLElement;

beforeEach(() => {
	tenant.settings = { featureDisplayNameEditable: true };
	api.list.mockResolvedValue({
		sessions: [
			session(16, 'Eltern und Familie', 'Blauer Falke'),
			session(14, 'Schulden'),
			{ chat: { id: 9, topic: 'Gruppe' } }
		]
	});
	api.put.mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('AskerDisplayNameSettings (#2175)', () => {
	it('shows the username and the name counsellors see in each conversation', async () => {
		render(view());
		expect(screen.getByText('lisa.simpson')).toBeTruthy();
		expect(
			within(await row('Eltern und Familie')).getByText('Blauer Falke')
		).toBeTruthy();
		// No alias yet: the counsellor sees the username.
		expect(
			within(await row('Schulden')).getByText(
				'profile.askerDisplayName.usernameShown'
			)
		).toBeTruthy();
		// Same topic twice stays distinguishable by its counselling centre.
		expect(
			within(await row('Schulden')).getByText('Stelle 14')
		).toBeTruthy();
		// Group chats carry no personal alias.
		expect(screen.queryByText('Gruppe')).toBeNull();
		expect(api.list).toHaveBeenCalledWith({ fresh: true });
	});

	it('saves an edited name for that conversation only', async () => {
		render(view());
		const item = await row('Eltern und Familie');
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.askerDisplayName.edit:Eltern und Familie'
			})
		);
		fireEvent.change(within(item).getByRole('textbox'), {
			target: { value: '  Roter Fuchs ' }
		});
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
		await waitFor(() =>
			expect(api.put).toHaveBeenCalledWith(16, {
				displayName: 'Roter Fuchs'
			})
		);
		expect(await within(item).findByText('Roter Fuchs')).toBeTruthy();
		expect(api.put).toHaveBeenCalledTimes(1);
	});

	it('does not save an empty name', async () => {
		render(view());
		const item = await row('Schulden');
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.askerDisplayName.edit:Schulden'
			})
		);
		fireEvent.change(within(item).getByRole('textbox'), {
			target: { value: '   ' }
		});
		expect(
			(
				within(item).getByRole('button', {
					name: 'profile.data.edit.button.save'
				}) as HTMLButtonElement
			).disabled
		).toBe(true);
	});

	it('keeps the old name and reports when saving fails', async () => {
		api.put.mockRejectedValue(new Error('403'));
		render(view());
		const item = await row('Eltern und Familie');
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.askerDisplayName.edit:Eltern und Familie'
			})
		);
		fireEvent.change(within(item).getByRole('textbox'), {
			target: { value: 'Roter Fuchs' }
		});
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.data.edit.button.save'
			})
		);
		await waitFor(() => expect(addNotification).toHaveBeenCalled());
		fireEvent.click(
			within(item).getByRole('button', {
				name: 'profile.data.edit.button.cancel'
			})
		);
		expect(within(item).getByText('Blauer Falke')).toBeTruthy();
	});

	it('shows names read-only when the tenant disables name changes', async () => {
		tenant.settings = { featureDisplayNameEditable: false };
		render(view());
		const item = await row('Eltern und Familie');
		expect(within(item).getByText('Blauer Falke')).toBeTruthy();
		expect(within(item).queryByRole('button')).toBeNull();
	});
});
