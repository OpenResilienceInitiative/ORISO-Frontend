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
	apiUpdateDirectLink,
	notifyDirectLinksChanged
} from '../../api/apiDirectLinks';
import { apiGetTenantAgenciesTopics } from '../../api/apiGetTenantAgenciesTopics';
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
	apiUpdateDirectLink: vi.fn()
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
		</UserDataContext.Provider>
	);

beforeEach(() => {
	vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([flyer]);
	vi.mocked(apiGetTenantAgenciesTopics).mockResolvedValue([
		{ id: 3, name: 'Schulden' },
		{ id: 4, name: 'Sucht' }
	] as any);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('My direct links (#1894)', () => {
	it('shows the empty state, and the round button leads to "Create chat"', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValue([]);
		renderPage();

		expect(await screen.findByTestId('direct-links-empty')).toBeTruthy();
		expect(screen.getByText('directLink.page.emptyHeadline')).toBeTruthy();
		fireEvent.click(screen.getByTestId('direct-links-create'));
		expect(navigate).toHaveBeenCalledWith(CREATE_CHAT_PATH);
	});

	it('shows a link that "Create chat" announces straight away', async () => {
		vi.mocked(apiGetOwnDirectLinks).mockResolvedValueOnce([]);
		renderPage();
		await screen.findByTestId('direct-links-empty');

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

	it('switches back and says so when the server refuses', async () => {
		vi.mocked(apiUpdateDirectLink).mockRejectedValue(new Error('403'));
		renderPage();
		const tile = (await screen.findByText('Flyer Schule')).closest('li')!;

		fireEvent.click(within(tile).getByRole('switch'));

		expect(
			await screen.findByText('directLink.page.toggleFailed')
		).toBeTruthy();
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
