// @vitest-environment oriso-jsdom
import * as React from 'react';
import {
	act,
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
import { UserDataContext } from '../../globalState';
import {
	apiGetOwnDirectLinks,
	apiRenewDirectInvitation,
	apiUpdateDirectLink,
	notifyDirectLinksChanged
} from '../../api/apiDirectLinks';
import { M3SnackbarHost } from '../m3Snackbar/M3SnackbarHost';
import { appSnackbarStack } from '../m3Snackbar/snackbarStack';
import { apiGetTenantAgenciesTopics } from '../../api/apiGetTenantAgenciesTopics';
import { apiGetUpcomingAppointments } from '../../api/apiSessionAppointments';
import { DirectLink } from '../conversationCreate/directLink/directLink';
import { CREATE_CHAT_PATH, MyDirectLinksPage } from './MyDirectLinksPanel';

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
	...(await importOriginal<typeof import('react-router-dom')>()),
	useNavigate: () => navigate,
	useLocation: () => ({ pathname: '/direct-links' })
}));
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { name?: string }) =>
			options?.name ? `${key}:${options.name}` : key
	})
}));
vi.mock('lottie-react', () => ({ default: () => null }));
vi.mock('qrcode', () => ({
	default: { toDataURL: () => Promise.resolve('data:image/png;base64,') }
}));
vi.mock('../../api/apiDirectLinks', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../api/apiDirectLinks')>()),
	apiGetOwnDirectLinks: vi.fn(),
	apiUpdateDirectLink: vi.fn(),
	apiRenewDirectInvitation: vi.fn()
}));
/* The dial and calendar have their own tests: here they only show a value. */
vi.mock('../form/OrisoDatePicker', () => ({
	OrisoDatePicker: ({ label }: { label: string }) => (
		<input aria-label={label} readOnly />
	)
}));
vi.mock('../form/OrisoTimePicker', () => ({
	OrisoTimePicker: ({ label }: { label: string }) => (
		<input aria-label={label} readOnly />
	)
}));
vi.mock('../../api/apiSessionAppointments', () => ({
	apiGetUpcomingAppointments: vi.fn()
}));
vi.mock('../../api/apiGetTenantAgenciesTopics', () => ({
	apiGetTenantAgenciesTopics: vi.fn()
}));

const flyer: DirectLink = {
	id: '7',
	name: 'Flyer Schule',
	topic: 'Schulden',
	topicId: 3,
	agencyId: 11,
	medium: 'VIDEO',
	temporary: true,
	active: true,
	url: 'https://app.example/invite/abc'
};

const renderPage = () =>
	render(
		<UserDataContext.Provider
			value={{ userData: { agencies: [] }, setUserData: vi.fn() } as any}
		>
			<MyDirectLinksPage />
			<M3SnackbarHost />
		</UserDataContext.Provider>
	);

beforeEach(() => {
	vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([flyer]);
	vi.mocked(apiGetUpcomingAppointments).mockResolvedValue([]);
	vi.mocked(apiGetTenantAgenciesTopics).mockResolvedValue([
		{ id: 3, name: 'Schulden' },
		{ id: 4, name: 'Sucht' }
	] as any);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	appSnackbarStack.clear();
});

describe('My direct links (#1894)', () => {
	it('shows the empty state, and the round button leads to "Create chat"', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([]);
		renderPage();

		/* #2252: the page is "Termine & Direkteinladungen" now. */
		expect(await screen.findByTestId('invitations-empty')).toBeTruthy();
		expect(
			screen.getByText('directInvitation.overview.emptyHeadline')
		).toBeTruthy();
		fireEvent.click(screen.getByTestId('invitations-create'));
		expect(navigate).toHaveBeenCalledWith(CREATE_CHAT_PATH);
	});

	it('shows a link that "Create chat" announces straight away', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValueOnce([]);
		renderPage();
		await screen.findByTestId('invitations-empty');

		vi.mocked(apiGetOwnDirectLinks).mockResolvedValueOnce([flyer]);
		act(() => notifyDirectLinksChanged());

		expect(await screen.findByText('Flyer Schule')).toBeTruthy();
	});

	it('greys a link out when it is switched off and saves it', async () => {
		vi.mocked(apiUpdateDirectLink).mockResolvedValue({
			...flyer,
			active: false
		});
		renderPage();
		const tile = (await screen.findByText('Flyer Schule')).closest('li')!;

		fireEvent.click(
			within(tile).getByRole('switch', {
				name: 'directLink.list.active:Flyer Schule'
			})
		);

		expect(tile.className).toContain('directLinkTile--off');
		expect(apiUpdateDirectLink).toHaveBeenCalledWith('7', {
			active: false
		});
		await waitFor(() =>
			expect(
				within(tile).getByRole('button', { name: 'directLink.copy' })
			).toHaveProperty('disabled', true)
		);
	});

	it('holds the switch until its request answers, then restores the value before it', async () => {
		let refuse: (error: Error) => void = () => undefined;
		vi.mocked(apiUpdateDirectLink).mockReturnValueOnce(
			new Promise((_resolve, reject) => {
				refuse = reject;
			})
		);
		renderPage();
		const tile = (await screen.findByText('Flyer Schule')).closest('li')!;
		const toggle = within(tile).getByRole('switch');

		fireEvent.click(toggle);
		expect(toggle).toHaveProperty('disabled', true);
		fireEvent.click(toggle);
		expect(apiUpdateDirectLink).toHaveBeenCalledOnce();

		await act(async () => refuse(new Error('500')));
		expect(toggle).toHaveProperty('disabled', false);
		expect(tile.className).not.toContain('directLinkTile--off');
	});

	it('switches back and says so when the server refuses', async () => {
		vi.mocked(apiUpdateDirectLink).mockRejectedValue(new Error('403'));
		renderPage();
		const tile = (await screen.findByText('Flyer Schule')).closest('li')!;

		fireEvent.click(within(tile).getByRole('switch'));

		/* #2252: a titled pop-up, not a box in the page. */
		const text = await screen.findByText('directLink.page.toggleFailed');
		expect(
			screen.getByText('directLink.page.toggleFailedTitle')
		).toBeTruthy();
		expect(screen.getByTestId('my-direct-links-page').contains(text)).toBe(
			false
		);
		expect(tile.className).not.toContain('directLinkTile--off');
	});

	it('edits the name and sends only what changed', async () => {
		vi.mocked(apiUpdateDirectLink).mockResolvedValue({
			...flyer,
			name: 'Flyer Rathaus'
		});
		renderPage();
		await screen.findByText('Flyer Schule');

		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		const dialog = await screen.findByTestId('direct-link-edit-dialog');
		fireEvent.change(
			within(dialog).getByLabelText('directLink.edit.name'),
			{ target: { value: 'Flyer Rathaus' } }
		);
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));

		await waitFor(() =>
			expect(apiUpdateDirectLink).toHaveBeenCalledWith('7', {
				name: 'Flyer Rathaus'
			})
		);
		expect(await screen.findByText('Flyer Rathaus')).toBeTruthy();
		await waitFor(() =>
			expect(screen.queryByTestId('direct-link-edit-dialog')).toBeNull()
		);
	});

	/* ORISO-Frontend#2142: the noted date and time shows on the tile and can be changed or removed. */
	it('shows the noted date and time on the tile', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([
			{
				...flyer,
				scheduledAt: new Date(2026, 10, 20, 14, 30).toISOString()
			}
		]);
		renderPage();
		const time = await screen.findByTestId('direct-link-scheduled-at');
		expect(time.textContent).toContain('14:30');
		expect(time.getAttribute('datetime')).toBe(
			new Date(2026, 10, 20, 14, 30).toISOString()
		);
	});

	it('sets, and then removes, the date and time in the edit dialog', async () => {
		const at = new Date('2026-11-20T14:30').toISOString();
		vi.mocked(apiUpdateDirectLink).mockResolvedValueOnce({
			...flyer,
			scheduledAt: at
		});
		renderPage();
		await screen.findByText('Flyer Schule');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		let dialog = await screen.findByTestId('direct-link-edit-dialog');
		fireEvent.change(
			within(dialog).getByLabelText('directLink.edit.scheduledAt'),
			{ target: { value: '2026-11-20T14:30' } }
		);
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));
		await waitFor(() =>
			expect(apiUpdateDirectLink).toHaveBeenCalledWith('7', {
				scheduledAt: at
			})
		);
		await screen.findByTestId('direct-link-scheduled-at');

		vi.mocked(apiUpdateDirectLink).mockResolvedValueOnce(flyer);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		dialog = await screen.findByTestId('direct-link-edit-dialog');
		expect(
			(
				within(dialog).getByLabelText(
					'directLink.edit.scheduledAt'
				) as HTMLInputElement
			).value
		).toBe('2026-11-20T14:30');
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'directLink.edit.clearScheduledAt'
			})
		);
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));
		await waitFor(() =>
			expect(apiUpdateDirectLink).toHaveBeenLastCalledWith('7', {
				clearScheduledAt: true
			})
		);
	});

	it('keeps the date when the edited date/time is incomplete', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([
			{
				...flyer,
				scheduledAt: new Date(2026, 10, 20, 14, 30).toISOString()
			}
		]);
		renderPage();
		await screen.findByText('Flyer Schule');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		const dialog = await screen.findByTestId('direct-link-edit-dialog');
		const input = within(dialog).getByLabelText(
			'directLink.edit.scheduledAt'
		) as HTMLInputElement;
		Object.defineProperty(input, 'validity', {
			configurable: true,
			value: { badInput: true, valid: false }
		});
		fireEvent.change(input, { target: { value: '' } });
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));

		expect(apiUpdateDirectLink).not.toHaveBeenCalled();
		expect(
			within(dialog).getByText('directLink.card.scheduledAtIncomplete')
		).toBeTruthy();
	});

	it('changes the temporary switch for new people only', async () => {
		vi.mocked(apiUpdateDirectLink).mockResolvedValue({
			...flyer,
			temporary: false
		});
		renderPage();
		await screen.findByText('Flyer Schule');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		const dialog = await screen.findByTestId('direct-link-edit-dialog');
		expect(
			within(dialog).getByText('directLink.edit.temporaryHint')
		).toBeTruthy();

		fireEvent.click(
			within(dialog).getByRole('switch', {
				name: 'directLink.card.temporary'
			})
		);
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));

		await waitFor(() =>
			expect(apiUpdateDirectLink).toHaveBeenCalledWith('7', {
				temporary: false
			})
		);
	});

	it('keeps the dialog open with a message when saving fails', async () => {
		vi.mocked(apiUpdateDirectLink).mockRejectedValue(new Error('500'));
		renderPage();
		await screen.findByText('Flyer Schule');
		fireEvent.click(
			screen.getByRole('button', {
				name: 'directLink.list.edit:Flyer Schule'
			})
		);
		const dialog = await screen.findByTestId('direct-link-edit-dialog');
		fireEvent.change(
			within(dialog).getByLabelText('directLink.edit.name'),
			{ target: { value: 'Neu' } }
		);
		fireEvent.click(within(dialog).getByTestId('direct-link-edit-save'));

		expect(
			await within(dialog).findByText('directLink.edit.failed')
		).toBeTruthy();
		expect(screen.getByText('Flyer Schule')).toBeTruthy();
	});

	it('opens the QR code of a link', async () => {
		renderPage();
		await screen.findByText('Flyer Schule');

		fireEvent.click(
			screen.getByRole('button', { name: 'directLink.list.qr' })
		);

		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
	});

	it('offers a retry when the list cannot be loaded', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockRejectedValueOnce(new Error('x'));
		renderPage();

		fireEvent.click(
			await screen.findByRole('button', { name: 'directLink.page.retry' })
		);

		expect(await screen.findByText('Flyer Schule')).toBeTruthy();
	});
});

describe('Termine & Direkteinladungen (#2252)', () => {
	const inTwoDays = (hour: number) => {
		const date = new Date();
		date.setDate(date.getDate() + 2);
		date.setHours(hour, 0, 0, 0);
		return date.toISOString();
	};
	const meeting: DirectLink = {
		...flyer,
		id: '9',
		name: 'Termin Frau M.',
		url: 'https://app.example/invite/t9',
		appointment: { id: 'a-9', start: inTwoDays(10), end: inTwoDays(11) },
		validityMinutes: 1440,
		access: 'guests',
		knock: false
	};

	it('lists an invitation with a date under the upcoming appointments, not as a tile', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([flyer, meeting]);
		renderPage();

		const row = await screen.findByTestId('upcoming-invitation');
		expect(within(row).getByText('Termin Frau M.')).toBeTruthy();
		expect(
			within(row).getByText('directInvitation.dialog.access.guests')
		).toBeTruthy();
		expect(screen.getByText('Flyer Schule').closest('li')).not.toBe(row);
		expect(screen.getAllByTestId('upcoming-invitation')).toHaveLength(1);
	});

	it('lists an expired invitation with "Neuen Link senden", which renews it', async () => {
		const past = (hour: number) => {
			const date = new Date();
			date.setDate(date.getDate() - 3);
			date.setHours(hour, 0, 0, 0);
			return date.toISOString();
		};
		const expired: DirectLink = {
			...meeting,
			appointment: { id: 'a-9', start: past(10), end: past(11) },
			expired: true
		};
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([expired]);
		vi.mocked(apiRenewDirectInvitation).mockResolvedValue({
			...meeting,
			url: 'https://app.example/invite/new'
		});
		renderPage();

		const row = await screen.findByTestId('expired-invitation');
		expect(within(row).getByText('Termin Frau M.')).toBeTruthy();
		fireEvent.click(
			within(row).getByRole('button', {
				name: 'directInvitation.overview.sendNewLink:Termin Frau M.'
			})
		);

		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
		expect(apiRenewDirectInvitation).toHaveBeenCalledWith('9');
	});

	it('adds the 1:1 appointments, once each, with the person they are with', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting]);
		vi.mocked(apiGetUpcomingAppointments).mockResolvedValue([
			{
				id: 'a-9',
				sessionId: 5,
				startTime: inTwoDays(10),
				endTime: inTwoDays(11),
				status: 'SCHEDULED'
			},
			{
				id: 'a-2',
				sessionId: 6,
				startTime: inTwoDays(15),
				endTime: inTwoDays(16),
				status: 'SCHEDULED',
				counterpart: { displayName: 'Ali' }
			}
		]);
		renderPage();

		await waitFor(() =>
			expect(screen.getAllByTestId('upcoming-invitation')).toHaveLength(2)
		);
		expect(
			screen.getByText('directInvitation.overview.oneToOne:Ali')
		).toBeTruthy();
	});

	it('still shows the invitations when the 1:1 appointments cannot be read', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting]);
		vi.mocked(apiGetUpcomingAppointments).mockRejectedValue(new Error('x'));
		renderPage();

		expect(await screen.findByTestId('upcoming-invitation')).toBeTruthy();
	});

	it('edits an appointment invitation in the shared dialog and saves its settings', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting]);
		vi.mocked(apiUpdateDirectLink).mockResolvedValue({
			...meeting,
			knock: true
		});
		renderPage();
		const row = await screen.findByTestId('upcoming-invitation');

		fireEvent.click(
			within(row).getByRole('button', {
				name: 'directInvitation.overview.edit:Termin Frau M.'
			})
		);
		const dialog = await screen.findByTestId('invitation-dialog');
		fireEvent.click(
			within(dialog).getByRole('switch', {
				name: 'directInvitation.dialog.knock'
			})
		);
		fireEvent.click(
			within(dialog).getByRole('button', {
				name: 'directInvitation.dialog.saveAction'
			})
		);

		await waitFor(() =>
			expect(apiUpdateDirectLink).toHaveBeenCalledWith('9', {
				appointment: {
					startTime: meeting.appointment!.start,
					endTime: meeting.appointment!.end
				},
				validityAfterEndMinutes: 1440,
				accessMode: 'GUESTS_ONLY',
				knock: true
			})
		);
		await waitFor(() =>
			expect(screen.queryByTestId('invitation-dialog')).toBeNull()
		);
	});

	it('opens the QR code of an appointment invitation', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([meeting]);
		renderPage();
		const row = await screen.findByTestId('upcoming-invitation');

		fireEvent.click(
			within(row).getByRole('button', {
				name: 'directInvitation.overview.qr:Termin Frau M.'
			})
		);

		expect(
			await screen.findByTestId('direct-link-share-dialog')
		).toBeTruthy();
	});
});

describe('My direct links when direct invitation is off (#1894)', () => {
	it('leaves /direct-links for the counsellor start page', async () => {
		const { TenantContext } = await import('../../globalState');
		render(
			<TenantContext.Provider
				value={
					{
						tenant: {
							id: 1,
							settings: {
								featureDirectInviteChatEnabled: false,
								featureDirectInviteAudioEnabled: false,
								featureDirectInviteVideoEnabled: false
							}
						},
						setTenant: vi.fn(),
						updateTenantSettings: vi.fn()
					} as any
				}
			>
				<UserDataContext.Provider
					value={
						{
							userData: { agencies: [] },
							setUserData: vi.fn()
						} as any
					}
				>
					<MyDirectLinksPage />
				</UserDataContext.Provider>
			</TenantContext.Provider>
		);
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith(
				'/sessions/consultant/sessionPreview',
				{ replace: true }
			)
		);
		expect(screen.queryByTestId('my-direct-links-page')).toBeNull();
	});
});
